import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { useTeamContext } from "@/contexts/TeamContext";

interface Player {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  jersey_number: number | null;
  membership_type: string;
  assessments: { position_code: string; assessment: number }[];
}

export default function CoachingSquad() {
  const { user } = useAuth();
  const { selectedTeamId } = useTeamContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isCoach, setIsCoach] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSquad() {
      if (!user) return;
      try {
        // Check if Super Admin
        const { data: superAdminCheck } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "SUPER_ADMIN")
          .maybeSingle() as any;

        const isSuperAdmin = !!superAdminCheck;
        let teamId = null;

        if (isSuperAdmin) {
          teamId = selectedTeamId;
          if (!teamId) {
            setError("Select a team from the top menu to view their coaching squad.");
            setLoading(false);
            return;
          }
        } else {
          // 1. Check if user has COACH role and get team_id
          const { data: roleData, error: roleError } = await supabase
            .from("user_roles")
            .select("team_id")
            .eq("user_id", user.id)
            .eq("role", "COACH")
            .maybeSingle() as any;

          if (roleError) throw roleError;

          if (!roleData) {
            setIsCoach(false);
            setLoading(false);
            return;
          }

          teamId = roleData.team_id;
          if (!teamId) {
            setError("No team assigned. Please contact your administrator.");
            setLoading(false);
            return;
          }
        }

        // Fetch team name
        const { data: teamData } = await supabase
          .from("teams")
          .select("name")
          .eq("id", teamId)
          .maybeSingle();
        
        if (teamData) setTeamName(teamData.name);

        // 2. Fetch active team members with their profiles
        // Query 1: get memberships
        const { data: membersData, error: membersError } = await supabase
          .from("team_memberships")
          .select("user_id, membership_type, jersey_number")
          .eq("team_id", teamId)
          .eq("status", "ACTIVE");

        if (membersError) throw membersError;

        // Query 2: get profiles for those user_ids
        const userIds = (membersData || []).map((m: any) => m.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        // Build a lookup map
        const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

        // 3. Fetch coach assessments for this team
        const { data: assessmentsData, error: assessmentsError } = await supabase
          .from("coach_position_assessments")
          .select("player_id, position_code, assessment")
          .eq("coach_id", user.id) as any;

        if (assessmentsError) throw assessmentsError;

        const assessmentsByPlayer = (assessmentsData || []).reduce((acc: any, row: any) => {
          if (!acc[row.player_id]) acc[row.player_id] = [];
          acc[row.player_id].push({ position_code: row.position_code, assessment: row.assessment });
          return acc;
        }, {});

        // Build players array
        const builtPlayers: Player[] = (membersData || []).map((m: any) => {
          const profile = profileMap.get(m.user_id);
          return {
            user_id: m.user_id,
            first_name: profile?.first_name || "Unknown",
            last_name: profile?.last_name || "",
            avatar_url: profile?.avatar_url || null,
            jersey_number: m.jersey_number || null,
            membership_type: m.membership_type || "PRIMARY",
            assessments: (assessmentsByPlayer[m.user_id] || []).slice(0, 3)
          };
        });

        // Sort: Primary first, then alphabetically
        builtPlayers.sort((a, b) => {
          if (a.membership_type === "PRIMARY" && b.membership_type !== "PRIMARY") return -1;
          if (a.membership_type !== "PRIMARY" && b.membership_type === "PRIMARY") return 1;
          const aName = `${a.first_name} ${a.last_name}`.trim();
          const bName = `${b.first_name} ${b.last_name}`.trim();
          return aName.localeCompare(bName);
        });

        setPlayers(builtPlayers);
      } catch (err: any) {
        console.error("Error loading squad:", err);
        setError(err.message || "Failed to load squad data");
      } finally {
        setLoading(false);
      }
    }

    loadSquad();
  }, [user, selectedTeamId]);

  const getAssessmentColor = (val: number) => {
    switch (val) {
      case 1: return "bg-green-100 text-green-800 hover:bg-green-100";
      case 2: return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case 3: return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case 4: return "bg-red-100 text-red-800 hover:bg-red-100";
      default: return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  if (!isCoach) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground">You need a Coach role to access this page.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Error</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight uppercase">MY SQUAD</h1>
        {teamName && <p className="text-muted-foreground mt-1 text-lg">{teamName}</p>}
      </div>

      {players.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">No players found in this squad.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {players.map(player => {
            const isPrimary = player.membership_type === "PRIMARY";
            const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`;

            return (
              <Card key={player.user_id} className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border">
                        <AvatarImage src={player.avatar_url || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">
                          {player.first_name} {player.last_name}
                        </h3>
                        <Badge variant="outline" className={cn("mt-1", isPrimary ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-600 bg-slate-50")}>
                          {isPrimary ? "Primary" : "Secondary"}
                        </Badge>
                      </div>
                    </div>
                    {player.jersey_number && (
                      <div className="flex items-center justify-center h-10 w-10 bg-accent rounded-full text-accent-foreground font-display font-bold text-lg">
                        {player.jersey_number}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-end">
                    {player.assessments.length > 0 ? (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Top Positions</p>
                        <div className="flex gap-2 flex-wrap">
                          {player.assessments.map(a => (
                            <Badge key={a.position_code} className={cn("font-mono font-bold", getAssessmentColor(a.assessment))}>
                              {a.position_code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 text-sm text-muted-foreground italic">
                        No positions assessed
                      </div>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="w-full mt-auto" 
                      onClick={() => navigate(`/coaching/${player.user_id}`)}
                    >
                      View Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
