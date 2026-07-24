import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MembershipTypeBadge } from "@/components/MembershipTypeBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const HOCKEY_POSITION_OPTIONS = [
  { code: "GK", label: "Goalkeeper" },
  { code: "FB-L", label: "Left fullback" },
  { code: "FB-C", label: "Centre fullback" },
  { code: "FB-R", label: "Right fullback" },
  { code: "HB-L", label: "Left half" },
  { code: "HB-C", label: "Centre half" },
  { code: "HB-R", label: "Right half" },
  { code: "IF-L", label: "Left inside" },
  { code: "IF-R", label: "Right inside" },
  { code: "CF", label: "Centre forward" },
  { code: "FF-L", label: "Left forward" },
  { code: "FF-C", label: "Centre forward line" },
  { code: "FF-R", label: "Right forward" },
] as const;

interface PositionTeam {
  teamId: string;
  teamName: string;
  clubName: string;
  membershipType: string;
}

interface PlayerPositionPreferencesProps {
  teams: PositionTeam[];
}

export function PlayerPositionPreferences({ teams }: PlayerPositionPreferencesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedByTeam, setSelectedByTeam] = useState<Record<string, string[]>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const teamIds = useMemo(() => teams.map((team) => team.teamId), [teams]);

  useEffect(() => {
    if (!user || teamIds.length === 0) {
      setSelectedByTeam({});
      return;
    }

    const loadPreferences = async () => {
      const { data, error } = await supabase
        .from("player_position_preferences")
        .select("team_id, position_code")
        .eq("player_id", user.id)
        .in("team_id", teamIds)
        .order("position_code");

      if (error) {
        toast({ title: "Positions could not be loaded", description: error.message, variant: "destructive" });
        return;
      }

      const next: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!row.team_id) continue;
        next[row.team_id] = [...(next[row.team_id] || []), row.position_code];
      }
      setSelectedByTeam(next);
    };

    void loadPreferences();
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

  if (teams.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Preferred playing positions</CardTitle>
        <CardDescription>Select every position you are happy to play for each regular team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {teams.map((team) => (
          <section key={team.teamId} className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-medium">{team.teamName}</h3>
                <p className="text-xs text-muted-foreground">{team.clubName}</p>
              </div>
              <MembershipTypeBadge membershipType={team.membershipType} />
            </div>
            <div className="flex flex-wrap gap-2">
              {HOCKEY_POSITION_OPTIONS.map((position) => {
                const selected = selectedByTeam[team.teamId]?.includes(position.code) || false;
                return (
                  <Button
                    type="button"
                    key={position.code}
                    variant={selected ? "default" : "outline"}
                    size="sm"
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
