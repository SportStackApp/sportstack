/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HockeyPitch } from "./HockeyPitch";
import { FillInFinderDialog } from "./FillInFinderDialog";
import {
  type FormationIconRow,
  type FormationPositionRow,
  type FormationRow,
  formatOwnerScope,
  getFormationFieldSource,
  preferenceScore,
} from "@/lib/formationPlanner";
import { cn } from "@/lib/utils";
import { Lightbulb, Save, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  coordinationAvailabilityLabel,
  type CoordinationAvailabilityStatus,
} from "@/features/coordination/coordination";

const supabase = typedSupabase as any;

type RosterPlayer = {
  id: string;
  name: string;
  jerseyNumber: number | null;
  membershipType: string;
  rosterPosition: string | null;
  availability: "AVAILABLE" | "UNAVAILABLE" | "UNSURE" | "MAYBE" | "NO_RESPONSE" | CoordinationAvailabilityStatus;
};

type FixtureLineup = {
  id: string;
  formation_id: string | null;
};

type FixtureLineupAssignment = {
  player_id: string;
  formation_position_id: string | null;
  is_starting: boolean;
  sort_order: number;
};

interface LineupViewProps {
  gameId: string;
  teamId: string;
  teamName: string;
  opponentName: string;
  isCoach?: boolean;
}

const AVAILABILITY_LABELS: Record<RosterPlayer["availability"], string> = {
  AVAILABLE: "Available",
  UNAVAILABLE: "Unavailable",
  UNSURE: "Unsure",
  MAYBE: "Maybe",
  NO_RESPONSE: "No response",
  UMPIRING: coordinationAvailabilityLabel("UMPIRING"),
  TECHNICAL_BENCH: coordinationAvailabilityLabel("TECHNICAL_BENCH"),
  VOLUNTEERING: coordinationAvailabilityLabel("VOLUNTEERING"),
};

const MEMBERSHIP_ORDER: Record<string, number> = {
  PRIMARY: 0,
  PERMANENT: 1,
  FILL_IN: 2,
  SECONDARY: 3,
};

const EXPECTED_SCHEMA_ERROR_PATTERNS = [
  "field_templates",
  "field_template_id",
  "could not find",
  "does not exist",
  "schema cache",
  "relationship",
];

const isExpectedMissingSchemaError = (error?: { message?: string } | null) => {
  const message = String(error?.message || "").toLowerCase();
  return EXPECTED_SCHEMA_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const LineupView = ({ gameId, teamId, teamName, opponentName, isCoach = false }: LineupViewProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [icons, setIcons] = useState<FormationIconRow[]>([]);
  const [positions, setPositions] = useState<FormationPositionRow[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [preferences, setPreferences] = useState<Record<string, Record<string, number>>>({});
  const [selectedFormationId, setSelectedFormationId] = useState<string>("__none__");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fixtureLineupId, setFixtureLineupId] = useState<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [fillInFinderOpen, setFillInFinderOpen] = useState(false);

  const selectedFormation = formations.find((formation) => formation.id === selectedFormationId) || null;
  const selectedPositionPlayer = selectedPositionId
    ? roster.find((player) => player.id === assignments[selectedPositionId])
    : undefined;

  const assignedPlayerIds = useMemo(() => {
    return new Set([...Object.values(assignments), ...benchIds]);
  }, [assignments, benchIds]);

  const availablePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return roster
      .filter((player) => !assignedPlayerIds.has(player.id))
      .filter((player) => {
        if (!query) return true;
        return player.name.toLowerCase().includes(query) || String(player.jerseyNumber || "").includes(query);
      });
  }, [roster, assignedPlayerIds, search]);

  const assignedBenchPlayers = benchIds
    .map((playerId) => roster.find((player) => player.id === playerId))
    .filter(Boolean) as RosterPlayer[];

  const startersCount = Object.values(assignments).filter(Boolean).length;
  const selectedFieldSource = getFormationFieldSource(selectedFormation);

  const loadFormationRows = useCallback(async () => {
    const [fieldTemplateIdRes, fieldTemplatesRes] = await Promise.all([
      supabase.from("formations").select("id, field_template_id").limit(1),
      supabase.from("field_templates").select("id").limit(1),
    ]);

    const canUseLinkedFieldTemplates = !fieldTemplateIdRes.error && !fieldTemplatesRes.error;

    if (canUseLinkedFieldTemplates) {
      const linkedRes = await supabase
        .from("formations")
        .select("*, field_templates(*)")
        .order("is_default", { ascending: false })
        .order("name");

      if (!linkedRes.error) return linkedRes;
      if (!isExpectedMissingSchemaError(linkedRes.error)) {
        toast.warning(`Field template data is unavailable: ${linkedRes.error.message}`);
      }
    } else {
      if (fieldTemplateIdRes.error && !isExpectedMissingSchemaError(fieldTemplateIdRes.error)) {
        toast.warning(`Field template links are unavailable: ${fieldTemplateIdRes.error.message}`);
      }
    }

    return supabase.from("formations").select("*").order("is_default", { ascending: false }).order("name");
  }, []);

  const loadSavedAssignments = useCallback(async (lineupId: string) => {
    const { data, error } = await supabase
      .from("fixture_lineup_assignments")
      .select("player_id, formation_position_id, is_starting, sort_order")
      .eq("fixture_lineup_id", lineupId)
      .order("sort_order");

    if (error) {
      toast.error(error.message);
      return;
    }

    const nextAssignments: Record<string, string> = {};
    const nextBench: string[] = [];
    ((data || []) as FixtureLineupAssignment[]).forEach((row) => {
      if (row.is_starting && row.formation_position_id) {
        nextAssignments[row.formation_position_id] = row.player_id;
      } else {
        nextBench.push(row.player_id);
      }
    });
    setAssignments(nextAssignments);
    setBenchIds(nextBench);
  }, []);

  const loadLineupData = useCallback(async () => {
    setLoading(true);
    const formationsPromise = loadFormationRows();
    const [formationsRes, iconsRes, rosterRes, fillInsRes, availabilityRes, prefsRes, lineupRes] = await Promise.all([
      formationsPromise,
      supabase.from("formation_icons").select("*").order("name"),
      supabase
        .from("team_memberships")
        .select("user_id, jersey_number, membership_type, position")
        .eq("team_id", teamId)
        .eq("status", "ACTIVE"),
      supabase
        .from("fixture_fill_ins")
        .select("player_id")
        .eq("fixture_id", gameId)
        .eq("team_id", teamId)
        .eq("status", "SELECTED"),
      supabase.from("fixture_availability").select("user_id, status").eq("fixture_id", gameId),
      supabase
        .from("player_position_preferences")
        .select("player_id, position_code, preference")
        .or(`team_id.eq.${teamId},team_id.is.null`),
      supabase
        .from("fixture_lineups")
        .select("id, formation_id")
        .eq("fixture_id", gameId)
        .eq("team_id", teamId)
        .maybeSingle(),
    ]);

    if (formationsRes.error) toast.error(formationsRes.error.message);
    if (iconsRes.error) toast.error(iconsRes.error.message);
    if (rosterRes.error) toast.error(rosterRes.error.message);
    if (fillInsRes.error) toast.error(fillInsRes.error.message);
    if (availabilityRes.error) toast.error(availabilityRes.error.message);
    if (prefsRes.error) toast.error(prefsRes.error.message);
    if (lineupRes.error) toast.error(lineupRes.error.message);

    const memberships = [
      ...(rosterRes.data || []),
      ...(fillInsRes.data || []).map((row: any) => ({
        user_id: row.player_id,
        jersey_number: null,
        membership_type: "FILL_IN",
        position: null,
      })),
    ];
    const userIds = memberships.map((member: any) => member.user_id);
    const profilesRes = userIds.length
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds)
      : { data: [], error: null };

    if (profilesRes.error) toast.error(profilesRes.error.message);

    const profileMap = new Map((profilesRes.data || []).map((profile: any) => [profile.id, profile]));
    const availabilityMap = new Map((availabilityRes.data || []).map((row: any) => [row.user_id, row.status]));

    const sortedRoster = memberships
      .map((member: any) => {
        const profile = profileMap.get(member.user_id);
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || "Unknown player";
        return {
          id: member.user_id,
          name,
          jerseyNumber: member.jersey_number,
          membershipType: member.membership_type || "UNKNOWN",
          rosterPosition: member.position,
          availability: availabilityMap.get(member.user_id) || "NO_RESPONSE",
        } as RosterPlayer;
      })
      .sort((a, b) => {
        const order = (MEMBERSHIP_ORDER[a.membershipType] ?? 99) - (MEMBERSHIP_ORDER[b.membershipType] ?? 99);
        if (order !== 0) return order;
        if (a.availability === "UNAVAILABLE" && b.availability !== "UNAVAILABLE") return 1;
        if (a.availability !== "UNAVAILABLE" && b.availability === "UNAVAILABLE") return -1;
        return a.name.localeCompare(b.name);
      });
    const builtRoster = sortedRoster.filter(
      (player, index, allPlayers) => allPlayers.findIndex((item) => item.id === player.id) === index
    );

    const prefMap: Record<string, Record<string, number>> = {};
    (prefsRes.data || []).forEach((row: any) => {
      if (!prefMap[row.player_id]) prefMap[row.player_id] = {};
      prefMap[row.player_id][String(row.position_code).toUpperCase()] = row.preference;
    });

    const formationRows = (formationsRes.data || []) as FormationRow[];
    const savedLineup = lineupRes.data as FixtureLineup | null;
    const initialFormationId = savedLineup?.formation_id || formationRows.find((formation) => formation.is_default)?.id || formationRows[0]?.id || "__none__";

    setFormations(formationRows);
    setIcons((iconsRes.data || []) as FormationIconRow[]);
    setRoster(builtRoster);
    setPreferences(prefMap);
    setSelectedFormationId(initialFormationId);
    setFixtureLineupId(savedLineup?.id || null);

    if (savedLineup?.id) {
      await loadSavedAssignments(savedLineup.id);
    } else {
      setAssignments({});
      setBenchIds([]);
    }

    setLoading(false);
  }, [gameId, loadFormationRows, loadSavedAssignments, teamId]);

  const loadFormationPositions = useCallback(async (formationId: string) => {
    const { data, error } = await supabase
      .from("formation_positions")
      .select("*")
      .eq("formation_id", formationId)
      .order("sort_order");

    if (error) {
      toast.error(error.message);
      setPositions([]);
      return;
    }
    setPositions((data || []) as FormationPositionRow[]);
  }, []);

  useEffect(() => {
    if (!teamId || !gameId) return;
    void loadLineupData();
  }, [gameId, loadLineupData, teamId]);

  useEffect(() => {
    if (selectedFormationId === "__none__") {
      setPositions([]);
      return;
    }
    void loadFormationPositions(selectedFormationId);
  }, [loadFormationPositions, selectedFormationId]);

  const assignPlayer = (playerId: string) => {
    if (!selectedPositionId) {
      movePlayerToBench(playerId);
      return;
    }

    assignPlayerToPosition(playerId, selectedPositionId);
    setSelectedPositionId(null);
  };

  const assignPlayerToPosition = (playerId: string, positionId: string) => {
    setAssignments((current) => {
      const withoutPlayer = Object.fromEntries(Object.entries(current).filter(([, assignedId]) => assignedId !== playerId));
      return { ...withoutPlayer, [positionId]: playerId };
    });
    setBenchIds((current) => current.filter((id) => id !== playerId));
  };

  const movePlayerToBench = (playerId: string) => {
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, assignedId]) => assignedId !== playerId)));
    setBenchIds((current) => (current.includes(playerId) ? current : [...current, playerId]));
  };

  const removePlayer = (playerId: string) => {
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, assignedId]) => assignedId !== playerId)));
    setBenchIds((current) => current.filter((id) => id !== playerId));
  };

  const suggestLineup = () => {
    if (positions.length === 0 || roster.length === 0) return;

    const used = new Set<string>();
    const nextAssignments: Record<string, string> = {};
    const sortedPositions = positions.filter((position) => position.is_starting_slot);

    sortedPositions.forEach((position) => {
      const positionCode = position.code.toUpperCase();
      const ranked = roster
        .filter((player) => !used.has(player.id) && player.availability !== "UNAVAILABLE")
        .map((player) => {
          const pref = preferenceScore(preferences[player.id]?.[positionCode]);
          const rosterMatch = player.rosterPosition?.toLowerCase().includes(position.name.toLowerCase()) || player.rosterPosition?.toLowerCase().includes(positionCode.toLowerCase());
          return { player, score: pref + (rosterMatch ? 2 : 0) };
        })
        .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));

      const chosen = ranked[0]?.player;
      if (chosen) {
        used.add(chosen.id);
        nextAssignments[position.id] = chosen.id;
      }
    });

    setAssignments(nextAssignments);
    // A suggested line-up must not silently select someone who has said they
    // are unavailable. Coaches can still review the full availability list on
    // the fixture before making a deliberate manual change.
    setBenchIds(
      roster
        .filter((player) => !used.has(player.id) && player.availability !== "UNAVAILABLE")
        .map((player) => player.id),
    );
    toast.success("Suggested line-up created. Review it before saving.");
  };

  const changeFormation = (formationId: string) => {
    if (!isCoach || formationId === selectedFormationId) return;
    const selectedPlayerIds = Array.from(new Set([...Object.values(assignments), ...benchIds]));
    setAssignments({});
    setBenchIds(selectedPlayerIds);
    setSelectedPositionId(null);
    setSelectedFormationId(formationId);
    if (selectedPlayerIds.length > 0) {
      toast.info("Selected players were moved to the bench. Place them into the new formation before saving.");
    }
  };

  const saveLineup = async () => {
    if (!user || selectedFormationId === "__none__") {
      toast.error("Choose a formation before saving.");
      return;
    }

    setSaving(true);
    const lineupPayload = {
      fixture_id: gameId,
      team_id: teamId,
      formation_id: selectedFormationId,
      created_by: user.id,
    };

    const lineupRes = await supabase
      .from("fixture_lineups")
      .upsert(lineupPayload, { onConflict: "fixture_id,team_id" })
      .select("id")
      .single();

    if (lineupRes.error) {
      setSaving(false);
      toast.error(lineupRes.error.message);
      return;
    }

    const lineupId = lineupRes.data.id as string;
    setFixtureLineupId(lineupId);

    const starterRows = Object.entries(assignments).map(([positionId, playerId], index) => ({
      fixture_lineup_id: lineupId,
      formation_position_id: positionId,
      player_id: playerId,
      is_starting: true,
      sort_order: index,
    }));
    const benchRows = benchIds.map((playerId, index) => ({
      fixture_lineup_id: lineupId,
      formation_position_id: null,
      player_id: playerId,
      is_starting: false,
      sort_order: starterRows.length + index,
    }));

    const assignmentRows = [...starterRows, ...benchRows];
    const existingAssignmentsRes = await supabase
      .from("fixture_lineup_assignments")
      .select("player_id")
      .eq("fixture_lineup_id", lineupId);
    if (existingAssignmentsRes.error) {
      setSaving(false);
      toast.error(existingAssignmentsRes.error.message);
      return;
    }

    if (assignmentRows.length > 0) {
      const assignmentRes = await supabase
        .from("fixture_lineup_assignments")
        .upsert(assignmentRows, { onConflict: "fixture_lineup_id,player_id" });
      if (assignmentRes.error) {
        setSaving(false);
        toast.error(assignmentRes.error.message);
        return;
      }
    }

    const desiredPlayerIds = new Set(assignmentRows.map((row) => row.player_id));
    const removedPlayerIds = (existingAssignmentsRes.data || [])
      .map((row: any) => row.player_id as string)
      .filter((playerId: string) => !desiredPlayerIds.has(playerId));
    if (removedPlayerIds.length > 0) {
      const removeResult = await supabase
        .from("fixture_lineup_assignments")
        .delete()
        .eq("fixture_lineup_id", lineupId)
        .in("player_id", removedPlayerIds);
      if (removeResult.error) {
        await loadSavedAssignments(lineupId);
        setSaving(false);
        toast.error(`The line-up could not be fully updated: ${removeResult.error.message}`);
        return;
      }
    }

    const publishResult = await supabase
      .from("fixture_lineups")
      .update({ published_at: new Date().toISOString() })
      .eq("id", lineupId);
    if (publishResult.error) {
      setSaving(false);
      toast.error(`The line-up was saved but could not be published: ${publishResult.error.message}`);
      return;
    }

    await mirrorLegacyLineups();
    setSaving(false);
    toast.success("Line-up saved.");
  };

  const mirrorLegacyLineups = async () => {
    const starterRows = Object.entries(assignments).map(([positionId, playerId]) => {
      const position = positions.find((item) => item.id === positionId);
      return {
        fixture_id: gameId,
        team_id: teamId,
        player_id: playerId,
        position: position?.code || position?.name || "Starter",
        is_starting: true,
      };
    });
    const benchRows = benchIds.map((playerId) => ({
      fixture_id: gameId,
      team_id: teamId,
      player_id: playerId,
      position: "Bench",
      is_starting: false,
    }));
    const rows = [...starterRows, ...benchRows];
    const existingResult = await supabase.from("lineups").select("id").eq("fixture_id", gameId).eq("team_id", teamId);
    if (existingResult.error) {
      toast.warning(`Saved new line-up, but legacy lineups could not be checked: ${existingResult.error.message}`);
      return;
    }

    let insertedIds: string[] = [];
    if (rows.length > 0) {
      const insertResult = await supabase.from("lineups").insert(rows).select("id");
      if (insertResult.error) {
        toast.warning(`Saved new line-up, but legacy lineups sync failed: ${insertResult.error.message}`);
        return;
      }
      insertedIds = (insertResult.data || []).map((row: any) => row.id as string);
    }

    const existingIds = (existingResult.data || []).map((row: any) => row.id as string);
    if (existingIds.length > 0) {
      const deleteResult = await supabase.from("lineups").delete().in("id", existingIds);
      if (deleteResult.error) {
        if (insertedIds.length > 0) await supabase.from("lineups").delete().in("id", insertedIds);
        toast.warning(`Saved new line-up, but legacy lineups sync failed: ${deleteResult.error.message}`);
      }
    }
  };

  const playerCard = (player: RosterPlayer, action: "assign" | "remove") => (
    <div
      key={player.id}
      draggable={isCoach}
      onDragStart={() => isCoach && setDraggingPlayerId(player.id)}
      onDragEnd={() => setDraggingPlayerId(null)}
      className={cn("flex items-center gap-2 rounded-md border p-2", isCoach && "cursor-grab", player.availability === "UNAVAILABLE" && "opacity-60")}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {player.jerseyNumber || "-"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{player.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {player.membershipType} - {AVAILABILITY_LABELS[player.availability]}
        </p>
      </div>
      {isCoach && (
        <Button size="sm" variant={action === "assign" ? "default" : "outline"} onClick={() => (action === "assign" ? assignPlayer(player.id) : removePlayer(player.id))}>
          {action === "assign" ? "Add" : <UserMinus className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );

  if (loading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading line-up...</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{teamName} Line-up</CardTitle>
              <p className="text-sm text-muted-foreground">vs {opponentName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {startersCount}/{positions.filter((position) => position.is_starting_slot).length || 0}
              </Badge>
              {!isCoach && <Badge variant="secondary">View only</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Select value={selectedFormationId} onValueChange={changeFormation} disabled={!isCoach}>
              <SelectTrigger>
                <SelectValue placeholder="Choose formation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Choose a formation</SelectItem>
                {formations.map((formation) => (
                  <SelectItem key={formation.id} value={formation.id}>
                    {formation.name} - {formatOwnerScope(formation.owner_scope)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCoach && (
              <Button variant="outline" onClick={() => setFillInFinderOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Find a fill-in
              </Button>
            )}
            {isCoach && (
              <Button variant="outline" onClick={suggestLineup} disabled={positions.length === 0 || roster.length === 0}>
                <Lightbulb className="h-4 w-4 mr-2" />
                Suggest
              </Button>
            )}
            {isCoach && (
              <Button onClick={saveLineup} disabled={saving || selectedFormationId === "__none__"}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>

          {selectedFormation && (
            <div className="text-xs text-muted-foreground">
              {selectedFormation.description || "Reusable formation template."}
            </div>
          )}

          <HockeyPitch backgroundUrl={selectedFieldSource.background_image_url}>
            {positions.map((position) => {
              const player = roster.find((item) => item.id === assignments[position.id]);
              const icon = icons.find((item) => item.id === position.icon_id);
              const selected = selectedPositionId === position.id;
              return (
                <button
                  key={position.id}
                  type="button"
                  aria-label={`${position.name}: ${player?.name || "unassigned"}`}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition-transform",
                    selected ? "scale-110 bg-accent text-accent-foreground" : player ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground",
                    isCoach && "hover:scale-105",
                  )}
                  style={{ left: `${position.x_percent}%`, top: `${position.y_percent}%` }}
                  onClick={() => isCoach && setSelectedPositionId(selected ? null : position.id)}
                  draggable={isCoach && Boolean(player)}
                  onDragStart={() => player && setDraggingPlayerId(player.id)}
                  onDragEnd={() => setDraggingPlayerId(null)}
                  onDragOver={(event) => isCoach && event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!isCoach || !draggingPlayerId) return;
                    assignPlayerToPosition(draggingPlayerId, position.id);
                    setDraggingPlayerId(null);
                  }}
                >
                  {icon?.image_url ? (
                    <img src={icon.image_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center text-xs font-bold">
                      {player?.jerseyNumber || position.code}
                    </span>
                  )}
                  <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-background/90 px-1 text-[10px] font-semibold text-foreground">
                    {player ? player.name.split(" ").slice(-1)[0] : position.code}
                  </span>
                </button>
              );
            })}
          </HockeyPitch>

          <div
            className={cn("rounded-lg border bg-muted/30 p-3", isCoach && draggingPlayerId && "border-dashed border-primary")}
            onDragOver={(event) => isCoach && event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!isCoach || !draggingPlayerId) return;
              movePlayerToBench(draggingPlayerId);
              setDraggingPlayerId(null);
            }}
          >
            <p className="mb-2 text-sm font-medium">Bench / reserves</p>
            <div className="grid gap-2 md:grid-cols-2">
              {assignedBenchPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bench players selected.</p>
              ) : (
                assignedBenchPlayers.map((player) => playerCard(player, "remove"))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isCoach && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{selectedPositionId ? "Select player" : "Roster"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search players..." className="pl-9" />
            </div>
            {selectedPositionId && (
              <div className="space-y-2">
                {selectedPositionPlayer && (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      removePlayer(selectedPositionPlayer.id);
                      setSelectedPositionId(null);
                    }}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Remove {selectedPositionPlayer.name}
                  </Button>
                )}
                <Button variant="ghost" className="w-full" onClick={() => setSelectedPositionId(null)}>
                  Clear position selection
                </Button>
              </div>
            )}
            <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
              {availablePlayers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No available roster players.</p>
              ) : (
                availablePlayers.map((player) => playerCard(player, "assign"))
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <FillInFinderDialog
        open={fillInFinderOpen}
        onOpenChange={setFillInFinderOpen}
        fixtureId={gameId}
        teamId={teamId}
        rosterPlayerIds={roster.map((player) => player.id)}
        onChanged={loadLineupData}
      />
    </div>
  );
};
