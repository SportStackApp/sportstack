import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTeamContext } from "@/contexts/TeamContext";
import { HOCKEY_POSITION_OPTIONS } from "@/components/profile/PlayerPositionPreferences";
import { loadPlayerHistory, type PlayerHistoryRecord } from "@/lib/playerHistory";

const POSITIONS = HOCKEY_POSITION_OPTIONS.map((position) => position.code);

interface Profile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
}

interface Assessment {
  assessment: number;
  notes: string;
}

export default function CoachingPlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedTeamId } = useTeamContext();
  
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assessments, setAssessments] = useState<Record<string, Assessment>>({});
  const [preferences, setPreferences] = useState<Record<string, number>>({});
  const [matchHistory, setMatchHistory] = useState<PlayerHistoryRecord[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<"This Season" | "All Time">("This Season");
  const [activeSeason, setActiveSeason] = useState<{ startDate: string | null; endDate: string | null; year: number | null } | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!user || !playerId) return;
      try {
        // Check if Super Admin
        const { data: superAdminCheck } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "SUPER_ADMIN")
          .maybeSingle() as any;

        const isSuperAdmin = !!superAdminCheck;
        let tId = null;

        if (isSuperAdmin) {
          tId = selectedTeamId;
          if (!tId) {
            toast.error("Please select a team from the cascade menu first.");
            navigate("/coaching");
            return;
          }
        } else {
          // 1. Check coach role
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("team_id")
            .eq("user_id", user.id)
            .eq("role", "COACH")
            .maybeSingle() as any;

          if (!roleData?.team_id) {
            toast.error("You are not assigned as a coach for any team.");
            navigate("/coaching");
            return;
          }
          
          tId = roleData.team_id;
        }

        setTeamId(tId);

        const { data: teamData } = await supabase
          .from("teams")
          .select("revsports_team_id, clubs(association_id)")
          .eq("id", tId)
          .maybeSingle();
        const club = Array.isArray(teamData?.clubs) ? teamData.clubs[0] : teamData?.clubs;
        const associationId = club?.association_id;
        if (associationId) {
          const { data: seasonData } = await supabase
            .from("seasons")
            .select("start_date, end_date, year")
            .eq("association_id", associationId)
            .eq("is_active", true)
            .maybeSingle();
          if (seasonData) {
            setActiveSeason({ startDate: seasonData.start_date, endDate: seasonData.end_date, year: seasonData.year });
          }
        }

        // 3. Load profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, last_name, avatar_url, date_of_birth")
          .eq("id", playerId)
          .single();
          
        if (profileData) setProfile(profileData as Profile);

        // 4. Load coach assessments
        const { data: assessmentsData } = await supabase
          .from("coach_position_assessments" as any)
          .select("position_code, assessment, notes")
          .eq("coach_id", user.id)
          .eq("player_id", playerId)
          .eq("team_id", tId) as any;

        const assMap: Record<string, Assessment> = {};
        if (assessmentsData) {
          assessmentsData.forEach((row: any) => {
            assMap[row.position_code] = { assessment: row.assessment, notes: row.notes || "" };
          });
        }
        setAssessments(assMap);

        // 5. Load player preferences
        const { data: prefsData } = await supabase
          .from("player_position_preferences" as any)
          .select("position_code, preference")
          .eq("player_id", playerId)
          .eq("team_id", tId) as any;

        const prefsMap: Record<string, number> = {};
        if (prefsData) {
          prefsData.forEach((row: any) => {
            prefsMap[row.position_code] = row.preference;
          });
        }
        setPreferences(prefsMap);

        setMatchHistory(await loadPlayerHistory(playerId, teamData?.revsports_team_id));

      } catch (err: any) {
        console.error("Error loading profile:", err);
        toast.error("Failed to load player profile.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, playerId, navigate, selectedTeamId]);

  const handleAssessmentChange = async (position: string, val: number) => {
    if (!user || !playerId || !teamId) return;
    
    // Optimistic update
    setAssessments(prev => ({ ...prev, [position]: { ...prev[position], assessment: val } }));
    
    try {
      await (supabase.from("coach_position_assessments" as any).upsert({
        coach_id: user.id,
        player_id: playerId,
        team_id: teamId,
        position_code: position,
        assessment: val
      }, { onConflict: "coach_id,player_id,team_id,position_code" }) as any);
      toast.success("Assessment saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save assessment");
    }
  };

  const handleNotesBlur = async (position: string, notes: string) => {
    if (!user || !playerId || !teamId) return;
    try {
      // Upsert note (assessment might be null if only notes are added first)
      await (supabase.from("coach_position_assessments" as any).upsert({
        coach_id: user.id,
        player_id: playerId,
        team_id: teamId,
        position_code: position,
        notes: notes,
        assessment: assessments[position]?.assessment || 2,
      }, { onConflict: "coach_id,player_id,team_id,position_code" }) as any);
      toast.success("Notes saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save notes");
    }
  };

  const getPrefLabel = (val?: number) => {
    switch (val) {
      case 1: return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Love it</Badge>;
      case 2: return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Happy to play</Badge>;
      case 3: return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Can do it</Badge>;
      case 4: return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Prefer not to</Badge>;
      default: return <span className="text-muted-foreground">-</span>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-24 mb-6" />
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-6 mt-8">
          <Skeleton className="h-[600px] w-full lg:w-[60%]" />
          <Skeleton className="h-[600px] w-full lg:w-[40%]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground">Player not found.</p>
      </div>
    );
  }

  const filteredMatches = matchHistory.filter((match) => {
    if (seasonFilter === "All Time") return true;
    const time = new Date(match.date).getTime();
    if (activeSeason?.startDate && time < new Date(activeSeason.startDate).getTime()) return false;
    if (activeSeason?.endDate && time > new Date(activeSeason.endDate).getTime()) return false;
    if (!activeSeason?.startDate && !activeSeason?.endDate && activeSeason?.year) {
      return new Date(match.date).getFullYear() === activeSeason.year;
    }
    return activeSeason ? true : new Date(match.date).getFullYear() === new Date().getFullYear();
  });

  const gamesPlayed = filteredMatches.length;
  const goalsScored = filteredMatches.reduce((sum, match) => sum + match.goals, 0);
  const cardsRecorded = filteredMatches.reduce(
    (sum, match) => sum + match.greenCards + match.yellowCards + match.redCards,
    0,
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <Button variant="ghost" className="mb-4 -ml-4 text-muted-foreground hover:text-foreground" onClick={() => navigate("/coaching")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Squad
      </Button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border-2">
          <AvatarImage src={profile.avatar_url || undefined} />
          <AvatarFallback className="text-xl">
            {profile.first_name?.[0]}{profile.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {profile.first_name} {profile.last_name}
          </h1>
          <div className="flex gap-3 mt-2 text-muted-foreground font-medium">
            {profile.date_of_birth && <span>DOB: {new Date(profile.date_of_birth).toLocaleDateString("en-AU")}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-8">
        
        {/* LEFT: Position Ratings */}
        <div className="w-full lg:w-[60%] space-y-4">
          <h2 className="font-display text-2xl font-bold">Position Ratings</h2>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 font-medium">Player Pref</th>
                    <th className="px-4 py-3 font-medium">Your Assessment</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {POSITIONS.map(pos => {
                    const currentAss = assessments[pos]?.assessment;
                    return (
                      <tr key={pos} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-bold">{pos}</td>
                        <td className="px-4 py-3">{getPrefLabel(preferences[pos])}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleAssessmentChange(pos, 1)} className={cn("w-6 h-6 rounded border flex items-center justify-center text-xs font-bold transition-colors", currentAss === 1 ? "bg-green-500 border-green-600 text-white" : "bg-white hover:bg-green-50")}>1</button>
                            <button onClick={() => handleAssessmentChange(pos, 2)} className={cn("w-6 h-6 rounded border flex items-center justify-center text-xs font-bold transition-colors", currentAss === 2 ? "bg-blue-500 border-blue-600 text-white" : "bg-white hover:bg-blue-50")}>2</button>
                            <button onClick={() => handleAssessmentChange(pos, 3)} className={cn("w-6 h-6 rounded border flex items-center justify-center text-xs font-bold transition-colors", currentAss === 3 ? "bg-yellow-400 border-yellow-500 text-white" : "bg-white hover:bg-yellow-50")}>3</button>
                            <button onClick={() => handleAssessmentChange(pos, 4)} className={cn("w-6 h-6 rounded border flex items-center justify-center text-xs font-bold transition-colors", currentAss === 4 ? "bg-red-500 border-red-600 text-white" : "bg-white hover:bg-red-50")}>4</button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input 
                            type="text" 
                            className="h-8 text-xs" 
                            placeholder="Add notes..." 
                            defaultValue={assessments[pos]?.notes || ""}
                            onBlur={(e) => handleNotesBlur(pos, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Match History */}
        <div className="w-full lg:w-[40%] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Match History</h2>
            <div className="flex bg-muted p-1 rounded-lg">
              <button 
                className={cn("px-3 py-1 text-xs font-medium rounded-md", seasonFilter === "This Season" ? "bg-background shadow-sm" : "text-muted-foreground")}
                onClick={() => setSeasonFilter("This Season")}
              >
                This Season
              </button>
              <button 
                className={cn("px-3 py-1 text-xs font-medium rounded-md", seasonFilter === "All Time" ? "bg-background shadow-sm" : "text-muted-foreground")}
                onClick={() => setSeasonFilter("All Time")}
              >
                All Time
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-display">{gamesPlayed}</span>
                <span className="text-xs text-muted-foreground text-center">Played</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-display">{goalsScored}</span>
                <span className="text-xs text-muted-foreground text-center">Goals</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-display leading-tight flex-1 flex items-center">{cardsRecorded}</span>
                <span className="text-xs text-muted-foreground text-center w-full">Cards</span>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredMatches.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <p className="text-muted-foreground text-sm">No linked RevSports match history was found for this team.</p>
              </Card>
            ) : (
              filteredMatches.map(m => (
                <Card key={m.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm">
                          {new Date(m.date).toLocaleDateString("en-AU")}
                        </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {m.result}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-xs text-muted-foreground">vs</div>
                        <div className="font-bold">{m.opponent}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{m.teamName}</div>
                        <div className="font-bold font-mono">{m.goals} goal{m.goals === 1 ? "" : "s"}</div>
                        {(m.greenCards + m.yellowCards + m.redCards) > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Cards: {m.greenCards}G {m.yellowCards}Y {m.redCards}R
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
