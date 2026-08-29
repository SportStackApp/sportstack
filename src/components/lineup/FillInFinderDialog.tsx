/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, Users } from "lucide-react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const supabase = typedSupabase as any;

export type RosterCandidate = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  jerseyNumber: number | null;
  membershipType: string;
  rosterPosition: string | null;
  availability: string;
  isTeamMember: boolean;
  lastFillInDate: string | null;
};

interface RosterSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  teamId: string;
  selectedPlayerIds: string[];
  onApply: (players: RosterCandidate[]) => void;
}

const fullName = (player: Pick<RosterCandidate, "firstName" | "lastName">) =>
  [player.firstName, player.lastName].filter(Boolean).join(" ").trim() || "Unnamed player";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });

export const RosterSelectorDialog = ({
  open,
  onOpenChange,
  fixtureId,
  teamId,
  selectedPlayerIds,
  onApply,
}: RosterSelectorDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<RosterCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setSelectedIds(new Set(selectedPlayerIds));

    const [membershipsRes, fillInsRes, availabilityRes, profilesRes] = await Promise.all([
      supabase
        .from("team_memberships")
        .select("user_id, jersey_number, membership_type, position")
        .eq("team_id", teamId)
        .eq("status", "ACTIVE"),
      supabase
        .from("fixture_fill_ins")
        .select("player_id, fixture_id, created_at, fixtures(fixture_date)")
        .eq("team_id", teamId)
        .eq("status", "SELECTED")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("fixture_availability").select("user_id, status").eq("fixture_id", fixtureId),
      supabase
        .from("profiles")
        .select("id, first_name, last_name, nickname")
        .eq("is_placeholder", false)
        .order("last_name")
        .limit(1000),
    ]);

    const firstError = membershipsRes.error || fillInsRes.error || availabilityRes.error || profilesRes.error;
    if (firstError) {
      toast.error(`The roster could not be loaded: ${firstError.message}`);
      setLoading(false);
      return;
    }

    const memberships = new Map((membershipsRes.data || []).map((row: any) => [row.user_id, row]));
    const availability = new Map((availabilityRes.data || []).map((row: any) => [row.user_id, row.status]));
    const lastFillIn = new Map<string, string>();
    (fillInsRes.data || []).forEach((row: any) => {
      const fixture = Array.isArray(row.fixtures) ? row.fixtures[0] : row.fixtures;
      if (!lastFillIn.has(row.player_id) && fixture?.fixture_date) lastFillIn.set(row.player_id, fixture.fixture_date);
    });

    const rows = (profilesRes.data || [])
      .map((profile: any): RosterCandidate => {
        const membership = memberships.get(profile.id) as any;
        return {
          id: profile.id,
          firstName: profile.first_name,
          lastName: profile.last_name,
          nickname: profile.nickname,
          jerseyNumber: membership?.jersey_number ?? null,
          membershipType: membership?.membership_type || (lastFillIn.has(profile.id) ? "PREVIOUS FILL-IN" : "OTHER PLAYER"),
          rosterPosition: membership?.position || null,
          availability: availability.get(profile.id) || "NO_RESPONSE",
          isTeamMember: Boolean(membership),
          lastFillInDate: lastFillIn.get(profile.id) || null,
        };
      })
      .sort((a: RosterCandidate, b: RosterCandidate) => {
        if (a.isTeamMember !== b.isTeamMember) return a.isTeamMember ? -1 : 1;
        return fullName(a).localeCompare(fullName(b), "en-AU");
      });

    setCandidates(rows);
    setLoading(false);
  }, [fixtureId, open, selectedPlayerIds, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCandidates = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return candidates.filter((candidate) => candidate.isTeamMember || candidate.lastFillInDate || selectedIds.has(candidate.id));
    if (normalised.length < 2) return [];
    return candidates.filter((candidate) =>
      [fullName(candidate), candidate.nickname, candidate.rosterPosition, candidate.membershipType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalised)),
    );
  }, [candidates, query, selectedIds]);

  const apply = () => {
    onApply(candidates.filter((candidate) => selectedIds.has(candidate.id)));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Roster</DialogTitle>
          <DialogDescription>
            Select the players you want available while building this match line-up. You can return here to add or remove players.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all players (type at least two letters)..." className="pl-9" />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading roster...</p>
          ) : filteredCandidates.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No matching players.</p>
          ) : filteredCandidates.map((candidate) => (
            <label key={candidate.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
              <Checkbox
                checked={selectedIds.has(candidate.id)}
                onCheckedChange={(checked) => setSelectedIds((current) => {
                  const next = new Set(current);
                  if (checked) next.add(candidate.id);
                  else next.delete(candidate.id);
                  return next;
                })}
                aria-label={`Select ${fullName(candidate)}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{fullName(candidate)}</span>
                  {candidate.jerseyNumber && <Badge variant="outline">#{candidate.jerseyNumber}</Badge>}
                  <Badge variant={candidate.isTeamMember ? "secondary" : "outline"}>{candidate.membershipType.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {candidate.rosterPosition || "No position recorded"} · {candidate.availability.replaceAll("_", " ").toLowerCase()}
                </p>
                {candidate.lastFillInDate && !candidate.isTeamMember && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" /> Last selected {formatDate(candidate.lastFillInDate)}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> {selectedIds.size} selected
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={loading}>Use selected roster</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
