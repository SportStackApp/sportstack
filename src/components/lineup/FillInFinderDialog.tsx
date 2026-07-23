/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, UserPlus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const supabase = typedSupabase as any;

type ProfileOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type FillInRow = {
  id: string;
  player_id: string;
  fixture_id: string;
  access_expires_at: string;
  fixtures?: { fixture_date: string } | null;
};

interface FillInFinderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixtureId: string;
  teamId: string;
  rosterPlayerIds: string[];
  onChanged: () => Promise<void> | void;
}

const displayName = (profile?: ProfileOption | null) =>
  [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || "Unnamed player";

const formatGameDate = (value: string) =>
  new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });

export const FillInFinderDialog = ({
  open,
  onOpenChange,
  fixtureId,
  teamId,
  rosterPlayerIds,
  onChanged,
}: FillInFinderDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [currentRows, setCurrentRows] = useState<FillInRow[]>([]);
  const [previousRows, setPreviousRows] = useState<FillInRow[]>([]);

  const load = useCallback(async () => {
    if (!open || !teamId || !fixtureId) return;
    setLoading(true);

    const [currentRes, previousRes, profileRes] = await Promise.all([
      supabase
        .from("fixture_fill_ins")
        .select("id, player_id, fixture_id, access_expires_at")
        .eq("team_id", teamId)
        .eq("fixture_id", fixtureId)
        .eq("status", "SELECTED"),
      supabase
        .from("fixture_fill_ins")
        .select("id, player_id, fixture_id, access_expires_at, fixtures(fixture_date)")
        .eq("team_id", teamId)
        .eq("status", "SELECTED")
        .neq("fixture_id", fixtureId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("is_placeholder", false)
        .order("last_name")
        .limit(500),
    ]);

    const firstError = currentRes.error || previousRes.error || profileRes.error;
    if (firstError) {
      toast.error(`Fill-ins could not be loaded: ${firstError.message}`);
    }

    setCurrentRows((currentRes.data || []) as FillInRow[]);
    setPreviousRows((previousRes.data || []) as FillInRow[]);
    setProfiles((profileRes.data || []) as ProfileOption[]);
    setLoading(false);
  }, [fixtureId, open, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const currentPlayerIds = useMemo(
    () => new Set(currentRows.map((row) => row.player_id)),
    [currentRows],
  );
  const persistentRosterIds = useMemo(() => new Set(rosterPlayerIds), [rosterPlayerIds]);
  const previousPlayers = useMemo(() => {
    const firstGameByPlayer = new Map<string, FillInRow>();
    previousRows.forEach((row) => {
      if (!firstGameByPlayer.has(row.player_id)) firstGameByPlayer.set(row.player_id, row);
    });
    return Array.from(firstGameByPlayer.values()).filter((row) => !currentPlayerIds.has(row.player_id));
  }, [currentPlayerIds, previousRows]);
  const searchResults = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (normalised.length < 2) return [];
    return profiles
      .filter((profile) => !persistentRosterIds.has(profile.id) && !currentPlayerIds.has(profile.id))
      .filter((profile) => displayName(profile).toLowerCase().includes(normalised))
      .slice(0, 30);
  }, [currentPlayerIds, persistentRosterIds, profiles, query]);

  const selectFillIn = async (playerId: string) => {
    if (!user) return;
    setSavingPlayerId(playerId);
    const { error } = await supabase.from("fixture_fill_ins").upsert(
      {
        fixture_id: fixtureId,
        team_id: teamId,
        player_id: playerId,
        status: "SELECTED",
        access_starts_at: new Date().toISOString(),
        added_by: user.id,
      },
      { onConflict: "fixture_id,team_id,player_id" },
    );

    if (error) {
      toast.error(`Fill-in was not added: ${error.message}`);
    } else {
      toast.success(`${displayName(profileById.get(playerId))} added as a fill-in.`);
      await load();
      await onChanged();
    }
    setSavingPlayerId(null);
  };

  const removeFillIn = async (row: FillInRow) => {
    if (!user) return;
    setSavingPlayerId(row.player_id);
    const { error } = await supabase
      .from("fixture_fill_ins")
      .update({
        status: "REMOVED",
        removed_at: new Date().toISOString(),
        removed_by: user.id,
        removal_reason: "Removed from the fixture line-up",
      })
      .eq("id", row.id);

    if (error) {
      toast.error(`Fill-in was not removed: ${error.message}`);
    } else {
      toast.success("Fill-in removed from this fixture.");
      await load();
      await onChanged();
    }
    setSavingPlayerId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find a fill-in</DialogTitle>
          <DialogDescription>
            Fill-ins receive this team’s dashboard, chat and line-up access until one hour after the match.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading fill-ins...</p>
        ) : (
          <div className="space-y-5">
            {currentRows.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Selected for this game</h3>
                {currentRows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{displayName(profileById.get(row.player_id))}</p>
                      <p className="text-xs text-muted-foreground">
                        Access ends {new Date(row.access_expires_at).toLocaleString("en-AU")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingPlayerId === row.player_id}
                      onClick={() => void removeFillIn(row)}
                    >
                      <X className="mr-1 h-4 w-4" /> Remove
                    </Button>
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Previous fill-ins</h3>
                <Badge variant="secondary">{previousPlayers.length}</Badge>
              </div>
              {previousPlayers.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No previous fill-ins for this team.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {previousPlayers.map((row) => (
                    <div key={row.player_id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{displayName(profileById.get(row.player_id))}</p>
                        {row.fixtures?.fixture_date && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" /> {formatGameDate(row.fixtures.fixture_date)}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={savingPlayerId === row.player_id}
                        onClick={() => void selectFillIn(row.player_id)}
                      >
                        <UserPlus className="h-4 w-4" />
                        <span className="sr-only">Add {displayName(profileById.get(row.player_id))}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Search players</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type at least two letters..."
                  className="pl-9"
                />
              </div>
              {query.trim().length >= 2 && (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No matching players found.</p>
                  ) : searchResults.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <p className="truncate text-sm font-medium">{displayName(profile)}</p>
                      <Button
                        size="sm"
                        disabled={savingPlayerId === profile.id}
                        onClick={() => void selectFillIn(profile.id)}
                      >
                        <UserPlus className="mr-1 h-4 w-4" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
