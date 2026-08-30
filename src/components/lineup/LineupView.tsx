/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RotateCcw, Save, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HockeyPitch } from "./HockeyPitch";
import { RosterSelectorDialog, type RosterCandidate } from "./FillInFinderDialog";
import { type FormationIconRow, type FormationPositionRow, type FormationRow, formatOwnerScope, getFormationFieldSource } from "@/lib/formationPlanner";
import {
  displayedFormationPosition,
  mobilePitchPosition,
  orientedPitchPosition,
  pitchOrientationFromBounds,
  pitchPlayerLabel,
  pitchPositionFromOrientedPointer,
  type PitchOrientation,
  type PitchPositionOverride,
  type PointerOffset,
} from "@/lib/lineupPlanner";
import { formatStandardName } from "@/lib/profileNames";
import { loadPlayerHistory, type PlayerHistoryRecord } from "@/lib/playerHistory";
import { playerHistoryForCalendarYear } from "@/lib/playerHistoryFilters";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const supabase = typedSupabase as any;
type LineupPlayer = RosterCandidate & { displayNickname: boolean };
type FixtureLineup = { id: string; formation_id: string | null };
type FixtureLineupAssignment = { player_id: string; formation_position_id: string | null; is_starting: boolean; sort_order: number };

interface LineupViewProps {
  gameId: string;
  fixtureDate: string;
  teamId: string;
  teamName: string;
  opponentName: string;
  isCoach?: boolean;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: "Available", UNAVAILABLE: "Unavailable", UNSURE: "Unsure", MAYBE: "Maybe", NO_RESPONSE: "No response",
  UMPIRING: "Umpiring", TECHNICAL_BENCH: "Technical bench", VOLUNTEERING: "Volunteering",
};
const fullName = (player: LineupPlayer) => formatStandardName({ firstName: player.firstName, lastName: player.lastName });

type MarkerDrag = {
  positionId: string;
  pointerId: number;
  offset: PointerOffset;
  startX: number;
  startY: number;
  moved: boolean;
  orientation: PitchOrientation;
};

export const LineupView = ({ gameId, fixtureDate, teamId, teamName, opponentName, isCoach = false }: LineupViewProps) => {
  const { user } = useAuth();
  const pitchRef = useRef<HTMLDivElement>(null);
  const markerDragRef = useRef<MarkerDrag | null>(null);
  const suppressMarkerClickRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [icons, setIcons] = useState<FormationIconRow[]>([]);
  const [positions, setPositions] = useState<FormationPositionRow[]>([]);
  const [roster, setRoster] = useState<LineupPlayer[]>([]);
  const [selectedFormationId, setSelectedFormationId] = useState("__none__");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, PitchPositionOverride>>({});
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null);
  const [history, setHistory] = useState<PlayerHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selectedFormation = formations.find((formation) => formation.id === selectedFormationId) || null;
  const assignedPlayerIds = useMemo(() => new Set([...Object.values(assignments), ...benchIds]), [assignments, benchIds]);
  const selectedRosterIds = useMemo(() => roster.map((player) => player.id), [roster]);
  const availablePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return roster.filter((player) => !assignedPlayerIds.has(player.id)).filter((player) => !query || fullName(player).toLowerCase().includes(query) || String(player.jerseyNumber || "").includes(query));
  }, [assignedPlayerIds, roster, search]);
  const benchPlayers = benchIds.map((id) => roster.find((player) => player.id === id)).filter(Boolean) as LineupPlayer[];

  const loadLineup = useCallback(async () => {
    setLoading(true);
    const [formationsRes, iconsRes, lineupRes] = await Promise.all([
      supabase.from("formations").select("*, field_templates(*)").order("is_default", { ascending: false }).order("name"),
      supabase.from("formation_icons").select("*").order("name"),
      supabase.from("fixture_lineups").select("id, formation_id").eq("fixture_id", gameId).eq("team_id", teamId).maybeSingle(),
    ]);
    const firstError = formationsRes.error || iconsRes.error || lineupRes.error;
    if (firstError) { toast.error(firstError.message); setLoading(false); return; }

    const formationRows = (formationsRes.data || []) as FormationRow[];
    const savedLineup = lineupRes.data as FixtureLineup | null;
    setFormations(formationRows);
    setIcons((iconsRes.data || []) as FormationIconRow[]);
    setSelectedFormationId(savedLineup?.formation_id || formationRows.find((formation) => formation.is_default)?.id || formationRows[0]?.id || "__none__");
    if (!savedLineup?.id) { setRoster([]); setAssignments({}); setBenchIds([]); setPositionOverrides({}); setLoading(false); return; }

    const [rosterRes, assignmentsRes, overridesRes] = await Promise.all([
      supabase.from("fixture_lineup_roster_selections").select("player_id, sort_order, display_nickname").eq("fixture_lineup_id", savedLineup.id).order("sort_order"),
      supabase.from("fixture_lineup_assignments").select("player_id, formation_position_id, is_starting, sort_order").eq("fixture_lineup_id", savedLineup.id).order("sort_order"),
      supabase.from("fixture_lineup_position_overrides").select("formation_position_id, x_percent, y_percent").eq("fixture_lineup_id", savedLineup.id),
    ]);
    const childError = rosterRes.error || assignmentsRes.error || overridesRes.error;
    if (childError) toast.error(childError.message);
    const rosterRows = rosterRes.data || [];
    const playerIds = rosterRows.map((row: any) => row.player_id);
    const [profilesRes, membershipsRes, availabilityRes] = await Promise.all([
      playerIds.length ? supabase.from("profiles").select("id, first_name, last_name, nickname").in("id", playerIds) : Promise.resolve({ data: [], error: null }),
      playerIds.length ? supabase.from("team_memberships").select("user_id, jersey_number, membership_type, position").eq("team_id", teamId).eq("status", "ACTIVE").in("user_id", playerIds) : Promise.resolve({ data: [], error: null }),
      playerIds.length ? supabase.from("fixture_availability").select("user_id, status").eq("fixture_id", gameId).in("user_id", playerIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const profileMap = new Map((profilesRes.data || []).map((row: any) => [row.id, row]));
    const membershipMap = new Map((membershipsRes.data || []).map((row: any) => [row.user_id, row]));
    const availabilityMap = new Map((availabilityRes.data || []).map((row: any) => [row.user_id, row.status]));
    setRoster(rosterRows.map((row: any) => {
      const profile = profileMap.get(row.player_id) as any;
      const membership = membershipMap.get(row.player_id) as any;
      return { id: row.player_id, firstName: profile?.first_name || null, lastName: profile?.last_name || null, nickname: profile?.nickname || null,
        jerseyNumber: membership?.jersey_number ?? null, membershipType: membership?.membership_type || "FILL_IN", rosterPosition: membership?.position || null,
        availability: availabilityMap.get(row.player_id) || "NO_RESPONSE", isTeamMember: Boolean(membership), lastFillInDate: null, displayNickname: Boolean(row.display_nickname) } as LineupPlayer;
    }));
    const nextAssignments: Record<string, string> = {};
    const nextBench: string[] = [];
    ((assignmentsRes.data || []) as FixtureLineupAssignment[]).forEach((row) => row.is_starting && row.formation_position_id ? nextAssignments[row.formation_position_id] = row.player_id : nextBench.push(row.player_id));
    setAssignments(nextAssignments);
    setBenchIds(nextBench);
    setPositionOverrides(Object.fromEntries((overridesRes.data || []).map((row: any) => [row.formation_position_id, { xPercent: Number(row.x_percent), yPercent: Number(row.y_percent) }])));
    setLoading(false);
  }, [gameId, teamId]);

  const loadPositions = useCallback(async (formationId: string) => {
    const { data, error } = await supabase.from("formation_positions").select("*").eq("formation_id", formationId).order("sort_order");
    if (error) toast.error(error.message);
    setPositions((data || []) as FormationPositionRow[]);
  }, []);

  useEffect(() => { void loadLineup(); }, [loadLineup]);
  useEffect(() => { if (selectedFormationId === "__none__") setPositions([]); else void loadPositions(selectedFormationId); }, [loadPositions, selectedFormationId]);
  useEffect(() => {
    if (!historyPlayerId) { setHistory([]); return; }
    setHistoryLoading(true);
    const fixtureYear = new Date(fixtureDate).getFullYear();
    void loadPlayerHistory(historyPlayerId).then((rows) => setHistory(playerHistoryForCalendarYear(rows, fixtureYear))).catch((error) => { toast.error(`Player history could not be loaded: ${error.message}`); setHistory([]); }).finally(() => setHistoryLoading(false));
  }, [fixtureDate, historyPlayerId]);

  const assignPlayerToPosition = (playerId: string, positionId: string) => {
    setAssignments((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([, assignedId]) => assignedId !== playerId)), [positionId]: playerId }));
    setBenchIds((current) => current.filter((id) => id !== playerId));
  };
  const removeFromPitchOrBench = (playerId: string) => {
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, assignedId]) => assignedId !== playerId)));
    setBenchIds((current) => current.filter((id) => id !== playerId));
  };
  const moveToBench = (playerId: string) => {
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, assignedId]) => assignedId !== playerId)));
    setBenchIds((current) => current.includes(playerId) ? current : [...current, playerId]);
  };
  const applyRoster = (players: RosterCandidate[]) => {
    const nextIds = new Set(players.map((player) => player.id));
    setRoster(players.map((player) => ({ ...player, displayNickname: roster.find((current) => current.id === player.id)?.displayNickname || false })));
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, playerId]) => nextIds.has(playerId))));
    setBenchIds((current) => current.filter((playerId) => nextIds.has(playerId)));
    if (historyPlayerId && !nextIds.has(historyPlayerId)) setHistoryPlayerId(null);
  };
  const changeFormation = (formationId: string) => {
    if (!isCoach || formationId === selectedFormationId) return;
    const placedIds = Array.from(new Set([...Object.values(assignments), ...benchIds]));
    setAssignments({}); setBenchIds(placedIds); setPositionOverrides({}); setSelectedPositionId(null); setSelectedFormationId(formationId);
    if (placedIds.length) toast.info("Placed players moved to the bench for the new formation.");
  };
  const moveMarker = (positionId: string, clientX: number, clientY: number, offset: PointerOffset, orientation: PitchOrientation) => {
    const bounds = pitchRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPositionOverrides((current) => ({
      ...current,
      [positionId]: pitchPositionFromOrientedPointer(clientX, clientY, bounds, offset, orientation),
    }));
  };

  const mirrorLegacyLineups = async () => {
    const rows = [
      ...Object.entries(assignments).map(([positionId, playerId]) => { const position = positions.find((item) => item.id === positionId); return { fixture_id: gameId, team_id: teamId, player_id: playerId, position: position?.code || position?.name || "Starter", is_starting: true }; }),
      ...benchIds.map((playerId) => ({ fixture_id: gameId, team_id: teamId, player_id: playerId, position: "Bench", is_starting: false })),
    ];
    const existing = await supabase.from("lineups").select("id").eq("fixture_id", gameId).eq("team_id", teamId);
    if (existing.error) return toast.warning(`Legacy line-up sync could not start: ${existing.error.message}`);
    if ((existing.data || []).length) await supabase.from("lineups").delete().in("id", existing.data.map((row: any) => row.id));
    if (rows.length) { const inserted = await supabase.from("lineups").insert(rows); if (inserted.error) toast.warning(`New line-up saved, but the legacy copy failed: ${inserted.error.message}`); }
  };

  const saveLineup = async () => {
    if (!user || selectedFormationId === "__none__") return toast.error("Choose a formation before saving.");
    setSaving(true);
    try {
      const lineupRes = await supabase.from("fixture_lineups").upsert({ fixture_id: gameId, team_id: teamId, formation_id: selectedFormationId, created_by: user.id }, { onConflict: "fixture_id,team_id" }).select("id").single();
      if (lineupRes.error) throw lineupRes.error;
      const lineupId = lineupRes.data.id as string;

      const existingRoster = await supabase.from("fixture_lineup_roster_selections").select("player_id").eq("fixture_lineup_id", lineupId);
      if (existingRoster.error) throw existingRoster.error;
      if (roster.length) { const result = await supabase.from("fixture_lineup_roster_selections").upsert(roster.map((player, index) => ({ fixture_lineup_id: lineupId, player_id: player.id, sort_order: index, display_nickname: player.displayNickname })), { onConflict: "fixture_lineup_id,player_id" }); if (result.error) throw result.error; }
      const rosterIds = new Set(roster.map((player) => player.id));
      const removedRosterIds = (existingRoster.data || []).map((row: any) => row.player_id).filter((id: string) => !rosterIds.has(id));
      if (removedRosterIds.length) { const result = await supabase.from("fixture_lineup_roster_selections").delete().eq("fixture_lineup_id", lineupId).in("player_id", removedRosterIds); if (result.error) throw result.error; }

      const assignmentRows = [
        ...Object.entries(assignments).map(([positionId, playerId], index) => ({ fixture_lineup_id: lineupId, formation_position_id: positionId, player_id: playerId, is_starting: true, sort_order: index })),
        ...benchIds.map((playerId, index) => ({ fixture_lineup_id: lineupId, formation_position_id: null, player_id: playerId, is_starting: false, sort_order: Object.keys(assignments).length + index })),
      ];
      const existingAssignments = await supabase.from("fixture_lineup_assignments").select("player_id").eq("fixture_lineup_id", lineupId);
      if (existingAssignments.error) throw existingAssignments.error;
      if (assignmentRows.length) { const result = await supabase.from("fixture_lineup_assignments").upsert(assignmentRows, { onConflict: "fixture_lineup_id,player_id" }); if (result.error) throw result.error; }
      const placedIds = new Set(assignmentRows.map((row) => row.player_id));
      const removedAssignmentIds = (existingAssignments.data || []).map((row: any) => row.player_id).filter((id: string) => !placedIds.has(id));
      if (removedAssignmentIds.length) { const result = await supabase.from("fixture_lineup_assignments").delete().eq("fixture_lineup_id", lineupId).in("player_id", removedAssignmentIds); if (result.error) throw result.error; }

      const existingOverrides = await supabase.from("fixture_lineup_position_overrides").select("formation_position_id").eq("fixture_lineup_id", lineupId);
      if (existingOverrides.error) throw existingOverrides.error;
      const overrideRows = Object.entries(positionOverrides).map(([positionId, override]) => ({ fixture_lineup_id: lineupId, formation_position_id: positionId, x_percent: override.xPercent, y_percent: override.yPercent, updated_by: user.id }));
      if (overrideRows.length) { const result = await supabase.from("fixture_lineup_position_overrides").upsert(overrideRows, { onConflict: "fixture_lineup_id,formation_position_id" }); if (result.error) throw result.error; }
      const overrideIds = new Set(Object.keys(positionOverrides));
      const resetOverrideIds = (existingOverrides.data || []).map((row: any) => row.formation_position_id).filter((id: string) => !overrideIds.has(id));
      if (resetOverrideIds.length) { const result = await supabase.from("fixture_lineup_position_overrides").delete().eq("fixture_lineup_id", lineupId).in("formation_position_id", resetOverrideIds); if (result.error) throw result.error; }

      const currentFillIns = await supabase.from("fixture_fill_ins").select("id, player_id").eq("fixture_id", gameId).eq("team_id", teamId).eq("status", "SELECTED");
      if (currentFillIns.error) throw currentFillIns.error;
      const desiredFillIns = roster.filter((player) => !player.isTeamMember);
      if (desiredFillIns.length) { const result = await supabase.from("fixture_fill_ins").upsert(desiredFillIns.map((player) => ({ fixture_id: gameId, team_id: teamId, player_id: player.id, status: "SELECTED", access_starts_at: new Date().toISOString(), added_by: user.id })), { onConflict: "fixture_id,team_id,player_id" }); if (result.error) throw result.error; }
      const desiredFillInIds = new Set(desiredFillIns.map((player) => player.id));
      const removedFillInRows = (currentFillIns.data || []).filter((row: any) => !desiredFillInIds.has(row.player_id));
      if (removedFillInRows.length) { const result = await supabase.from("fixture_fill_ins").update({ status: "REMOVED", removed_at: new Date().toISOString(), removed_by: user.id, removal_reason: "Removed from the match roster" }).in("id", removedFillInRows.map((row: any) => row.id)); if (result.error) throw result.error; }
      const published = await supabase.from("fixture_lineups").update({ published_at: new Date().toISOString() }).eq("id", lineupId);
      if (published.error) throw published.error;
      await mirrorLegacyLineups();
      toast.success("Line-up saved.");
    } catch (error: any) { toast.error(`The line-up could not be saved: ${error.message}`); }
    finally { setSaving(false); }
  };

  const playerCard = (player: LineupPlayer, action: "add" | "remove") => (
    <div key={player.id} className={cn("rounded-md border p-2", player.availability === "UNAVAILABLE" && "border-destructive/40")} draggable={isCoach} onDragStart={() => isCoach && setDraggingPlayerId(player.id)} onDragEnd={() => setDraggingPlayerId(null)}>
      <div className="flex items-center gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setHistoryPlayerId(historyPlayerId === player.id ? null : player.id)}>
          <p className="truncate text-sm font-medium">{fullName(player)}</p>
          <p className="truncate text-xs text-muted-foreground">{player.membershipType.replaceAll("_", " ")} · {AVAILABILITY_LABELS[player.availability] || player.availability}</p>
        </button>
        {isCoach && <Button size="sm" variant={action === "add" ? "default" : "outline"} aria-label={action === "add" ? undefined : `Remove ${fullName(player)} from line-up`} onClick={() => action === "add" ? (selectedPositionId ? assignPlayerToPosition(player.id, selectedPositionId) : moveToBench(player.id)) : removeFromPitchOrBench(player.id)}>{action === "add" ? "Add" : <UserMinus className="h-4 w-4" />}</Button>}
      </div>
      {player.nickname && <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={player.displayNickname} disabled={!isCoach} onCheckedChange={(checked) => setRoster((current) => current.map((item) => item.id === player.id ? { ...item, displayNickname: Boolean(checked) } : item))} />Display nickname “{player.nickname}” on pitch</label>}
    </div>
  );

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading line-up...</CardContent></Card>;
  const fieldSource = getFormationFieldSource(selectedFormation);
  const historyPlayer = historyPlayerId ? roster.find((player) => player.id === historyPlayerId) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg">{teamName} Line-up</CardTitle><p className="text-sm text-muted-foreground">vs {opponentName}</p></div><Badge variant="outline" className="gap-1"><Users className="h-3 w-3" /> {Object.keys(assignments).length}/{positions.filter((position) => position.is_starting_slot).length}</Badge></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <Select value={selectedFormationId} onValueChange={changeFormation} disabled={!isCoach}><SelectTrigger aria-label="Formation"><SelectValue placeholder="Choose formation" /></SelectTrigger><SelectContent><SelectItem value="__none__">Choose a formation</SelectItem>{formations.map((formation) => <SelectItem key={formation.id} value={formation.id}>{formation.name} - {formatOwnerScope(formation.owner_scope)}</SelectItem>)}</SelectContent></Select>
            {isCoach && <Button variant="outline" onClick={() => setRosterDialogOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Select roster</Button>}
            {isCoach && <Button variant="outline" onClick={() => setPositionOverrides({})} disabled={!Object.keys(positionOverrides).length}><RotateCcw className="mr-2 h-4 w-4" /> Reset positions</Button>}
            {isCoach && <Button onClick={() => void saveLineup()} disabled={saving || selectedFormationId === "__none__"}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save"}</Button>}
          </div>
          {roster.length === 0 && isCoach && <button type="button" onClick={() => setRosterDialogOpen(true)} className="w-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:border-primary hover:text-foreground">Start by selecting the match roster.</button>}
          <div ref={pitchRef}>
            <HockeyPitch backgroundUrl={fieldSource.background_image_url} orientation="responsive">
              {positions.map((originalPosition) => {
                const position = displayedFormationPosition(originalPosition, positionOverrides[originalPosition.id]);
                const mobilePosition = mobilePitchPosition({
                  xPercent: position.x_percent,
                  yPercent: position.y_percent,
                });
                const markerStyle = {
                  "--pitch-desktop-left": `${position.x_percent}%`,
                  "--pitch-desktop-top": `${position.y_percent}%`,
                  "--pitch-mobile-left": `${mobilePosition.xPercent}%`,
                  "--pitch-mobile-top": `${mobilePosition.yPercent}%`,
                } as CSSProperties;
                const player = roster.find((item) => item.id === assignments[originalPosition.id]);
                const icon = icons.find((item) => item.id === originalPosition.icon_id);
                const selected = selectedPositionId === originalPosition.id || Boolean(player && historyPlayerId === player.id);
                return <button key={originalPosition.id} type="button" aria-label={`${originalPosition.name}: ${player ? fullName(player) : "unassigned"}`} className={cn("lineup-marker absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg", selected ? "scale-110 bg-accent ring-4 ring-amber-400 ring-offset-2 ring-offset-[#2d8a4e]" : player ? "bg-primary text-primary-foreground" : "bg-background/80", isCoach && "touch-none cursor-grab hover:scale-105 active:cursor-grabbing")} style={markerStyle} onClick={() => { if (suppressMarkerClickRef.current === originalPosition.id) { suppressMarkerClickRef.current = null; return; } const nextSelected = !selected; if (isCoach) setSelectedPositionId(nextSelected ? originalPosition.id : null); if (player) setHistoryPlayerId(nextSelected ? player.id : null); }} onPointerDown={(event) => { if (!isCoach) return; const bounds = pitchRef.current?.getBoundingClientRect(); if (!bounds) return; const orientation = pitchOrientationFromBounds(bounds); const displayedPosition = orientedPitchPosition({ xPercent: position.x_percent, yPercent: position.y_percent }, orientation); markerDragRef.current = { positionId: originalPosition.id, pointerId: event.pointerId, offset: { x: event.clientX - (bounds.left + (displayedPosition.xPercent / 100) * bounds.width), y: event.clientY - (bounds.top + (displayedPosition.yPercent / 100) * bounds.height) }, startX: event.clientX, startY: event.clientY, moved: false, orientation }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const drag = markerDragRef.current; if (!isCoach || !drag || drag.positionId !== originalPosition.id || drag.pointerId !== event.pointerId) return; if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return; drag.moved = true; event.preventDefault(); moveMarker(originalPosition.id, event.clientX, event.clientY, drag.offset, drag.orientation); }} onPointerUp={(event) => { const drag = markerDragRef.current; if (drag?.pointerId === event.pointerId && drag.moved) suppressMarkerClickRef.current = drag.positionId; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (drag?.pointerId === event.pointerId) markerDragRef.current = null; }} onPointerCancel={(event) => { if (markerDragRef.current?.pointerId === event.pointerId) markerDragRef.current = null; }} onDragOver={(event) => isCoach && event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (isCoach && draggingPlayerId) assignPlayerToPosition(draggingPlayerId, originalPosition.id); setDraggingPlayerId(null); }}>
                  {icon?.image_url ? <img src={icon.image_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center text-xs font-bold">{player?.jerseyNumber || originalPosition.code}</span>}
                  <span className={cn("absolute left-1/2 top-full mt-1 max-w-[76px] -translate-x-1/2 truncate whitespace-nowrap rounded bg-background/90 px-1 text-[9px] font-semibold text-foreground sm:max-w-none sm:text-[10px]", originalPosition.y_percent < 15 && "max-sm:left-0 max-sm:translate-x-0", originalPosition.y_percent > 85 && "max-sm:left-auto max-sm:right-0 max-sm:translate-x-0")}>{player ? pitchPlayerLabel({ firstName: player.firstName, lastName: player.lastName, nickname: player.nickname }, player.displayNickname) : originalPosition.code}</span>
                </button>;
              })}
            </HockeyPitch>
          </div>
          <div className={cn("rounded-lg border bg-muted/30 p-3", draggingPlayerId && "border-dashed border-primary")} onDragOver={(event) => isCoach && event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (isCoach && draggingPlayerId) moveToBench(draggingPlayerId); setDraggingPlayerId(null); }}><p className="mb-2 text-sm font-medium">Bench / reserves</p><div className="grid gap-2 md:grid-cols-2">{benchPlayers.length ? benchPlayers.map((player) => playerCard(player, "remove")) : <p className="text-sm text-muted-foreground">No bench players selected.</p>}</div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{selectedPositionId ? "Choose a player" : "Line-up"}</CardTitle></CardHeader>
        <CardContent className="space-y-3"><p className="text-xs text-muted-foreground">Selected roster players not yet placed on the pitch or bench.</p><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search selected players..." className="pl-9" /></div><div className="max-h-[420px] space-y-2 overflow-auto pr-1">{availablePlayers.length ? availablePlayers.map((player) => playerCard(player, "add")) : <p className="py-5 text-center text-sm text-muted-foreground">No unplaced players.</p>}</div>
          {historyPlayerId && <div className="space-y-2 border-t pt-3"><p className="text-sm font-semibold">Season games{historyPlayer ? ` — ${fullName(historyPlayer)}` : ""}</p>{historyLoading ? <p className="text-xs text-muted-foreground">Loading history...</p> : history.length ? history.map((row) => <div key={row.id} className="rounded-md bg-muted/50 p-2 text-xs"><p className="font-medium">{new Date(row.date).toLocaleDateString("en-AU")} vs {row.opponent} · {row.result}</p><p className="text-muted-foreground">{row.positionName || "Position not recorded"} · {row.goals} goals · cards {row.greenCards}/{row.yellowCards}/{row.redCards}</p></div>) : <p className="text-xs text-muted-foreground">No game history found for this season.</p>}</div>}
        </CardContent>
      </Card>
      <RosterSelectorDialog open={rosterDialogOpen} onOpenChange={setRosterDialogOpen} fixtureId={gameId} teamId={teamId} selectedPlayerIds={selectedRosterIds} onApply={applyRoster} />
    </div>
  );
};
