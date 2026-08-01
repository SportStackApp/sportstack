import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MembershipTypeBadge } from "@/components/MembershipTypeBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { loadTeamPositionOptions, type TeamPositionOption } from "@/lib/teamPositions";

interface PositionTeam {
  membershipId: string;
  teamId: string;
  teamName: string;
  clubName: string;
  membershipType: string;
  jerseyNumber: number | null;
}

interface PlayerPositionPreferencesProps {
  teams: PositionTeam[];
}

export function PlayerPositionPreferences({ teams }: PlayerPositionPreferencesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedByTeam, setSelectedByTeam] = useState<Record<string, string[]>>({});
  const [optionsByTeam, setOptionsByTeam] = useState<Record<string, TeamPositionOption[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [numbersByTeam, setNumbersByTeam] = useState<Record<string, string>>({});
  const teamIds = useMemo(() => teams.map((team) => team.teamId), [teams]);

  useEffect(() => {
    setNumbersByTeam(Object.fromEntries(teams.map((team) => [team.teamId, team.jerseyNumber === null ? "" : String(team.jerseyNumber)])));
  }, [teams]);

  useEffect(() => {
    let active = true;
    if (!user || teamIds.length === 0) {
      setSelectedByTeam({});
      setOptionsByTeam({});
      setLoadingOptions(false);
      return () => {
        active = false;
      };
    }

    const loadPreferences = async () => {
      setLoadingOptions(true);
      const [{ data, error }, teamOptions] = await Promise.all([
        supabase
          .from("player_position_preferences")
          .select("team_id, position_code")
          .eq("player_id", user.id)
          .in("team_id", teamIds)
          .order("position_code"),
        loadTeamPositionOptions(teamIds),
      ]);

      if (error) {
        if (active) {
          toast({ title: "Positions could not be loaded", description: error.message, variant: "destructive" });
          setLoadingOptions(false);
        }
        return;
      }

      const next: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!row.team_id) continue;
        next[row.team_id] = [...(next[row.team_id] || []), row.position_code];
      }
      if (active) {
        setSelectedByTeam(next);
        setOptionsByTeam(teamOptions);
        setLoadingOptions(false);
      }
    };

    void loadPreferences().catch((error: Error) => {
      if (active) {
        setLoadingOptions(false);
        toast({ title: "Team positions could not be loaded", description: error.message, variant: "destructive" });
      }
    });
    return () => {
      active = false;
    };
  }, [teamIds, toast, user]);

  const togglePosition = async (teamId: string, positionCode: string) => {
    if (!user || savingKey) return;
    const key = `${teamId}:${positionCode}`;
    const wasSelected = selectedByTeam[teamId]?.includes(positionCode) || false;
    setSavingKey(key);
    setSelectedByTeam((current) => ({
      ...current,
      [teamId]: wasSelected
        ? (current[teamId] || []).filter((code) => code !== positionCode)
        : [...(current[teamId] || []), positionCode],
    }));

    const table = supabase.from("player_position_preferences");
    const result = wasSelected
      ? await table
          .delete()
          .eq("player_id", user.id)
          .eq("team_id", teamId)
          .eq("position_code", positionCode)
      : await table.insert({
          player_id: user.id,
          team_id: teamId,
          position_code: positionCode,
          preference: 1,
        });

    if (result.error) {
      setSelectedByTeam((current) => ({
        ...current,
        [teamId]: wasSelected
          ? [...(current[teamId] || []), positionCode]
          : (current[teamId] || []).filter((code) => code !== positionCode),
      }));
      toast({ title: "Position not saved", description: result.error.message, variant: "destructive" });
    }
    setSavingKey(null);
  };

  const savePlayerNumber = async (team: PositionTeam) => {
    const value = numbersByTeam[team.teamId]?.trim() || "";
    if (value && !/^\d+$/.test(value)) {
      toast({ title: "Number not saved", description: "Use a whole number only.", variant: "destructive" });
      return;
    }
    setSavingKey(`${team.teamId}:number`);
    const { error } = await supabase
      .from("team_memberships")
      .update({ jersey_number: value ? Number(value) : null })
      .eq("id", team.membershipId)
      .eq("user_id", user?.id || "");
    setSavingKey(null);
    if (error) toast({ title: "Player number not saved", description: error.message, variant: "destructive" });
    else toast({ title: "Team player details saved" });
  };

  if (teams.length === 0) return null;

  return (
    <Card>
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardTitle className="text-base">Team Player Details</CardTitle>
        <CardDescription className="text-xs">Set your player number and preferred positions separately for each team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-0">
        {teams.map((team) => (
          <section key={team.teamId} className="space-y-2 rounded-lg border p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium">{team.teamName}</h3>
                <p className="text-xs text-muted-foreground">{team.clubName}</p>
              </div>
              <MembershipTypeBadge membershipType={team.membershipType} compact />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex-1 text-xs font-medium">
                Player number
                <Input
                  inputMode="numeric"
                  className="mt-1 h-8"
                  placeholder="Not set"
                  value={numbersByTeam[team.teamId] || ""}
                  onChange={(event) => setNumbersByTeam((current) => ({ ...current, [team.teamId]: event.target.value }))}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={savingKey === `${team.teamId}:number`}
                onClick={() => void savePlayerNumber(team)}
              >
                Save number
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {loadingOptions ? (
                <span className="text-xs text-muted-foreground">Loading team positions…</span>
              ) : (optionsByTeam[team.teamId] || []).length === 0 ? (
                <span className="text-xs text-muted-foreground">No team positions configured yet.</span>
              ) : optionsByTeam[team.teamId].map((position) => {
                const selected = selectedByTeam[team.teamId]?.includes(position.code) || false;
                return (
                  <Button
                    type="button"
                    key={position.code}
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-xs"
                    disabled={savingKey === `${team.teamId}:${position.code}`}
                    aria-pressed={selected}
                    onClick={() => void togglePosition(team.teamId, position.code)}
                  >
                    {position.label}
                  </Button>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
