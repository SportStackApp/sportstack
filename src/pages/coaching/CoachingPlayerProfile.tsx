import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTeamContext } from "@/contexts/TeamContext";
import { loadPlayerHistory, type PlayerHistoryRecord } from "@/lib/playerHistory";
import {
  HOCKEY_POSITION_AREAS,
  HOCKEY_POSITION_SIDES,
  areaPositionCode,
  sidePositionCode,
} from "@/lib/hockeyPositions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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

interface CoachNote {
  id: string;
  note: string;
  source: "MANUAL" | "COACH_NARRATIVE";
  created_at: string;
}

const POSITION_TRAITS = [
  ...HOCKEY_POSITION_AREAS.map((position) => ({
    code: areaPositionCode(position.value),
    label: position.label,
    section: "Playing area",
  })),
  ...HOCKEY_POSITION_SIDES.map((position) => ({
    code: sidePositionCode(position.value),
    label: position.label,
    section: "Preferred side",
  })),
];

export default function CoachingPlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [selectedMatch, setSelectedMatch] = useState<PlayerHistoryRecord | null>(null);
  const [matchNotes, setMatchNotes] = useState<CoachNote[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const requestedTeamId = searchParams.get("team");

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!user || !playerId) return;
      try {
        // Check if Super Admin
        const { data: superAdminCheck } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "SUPER_ADMIN")
          .maybeSingle();

        const isSuperAdmin = !!superAdminCheck;
        let tId: string | null = null;

        if (isSuperAdmin) {
          tId = requestedTeamId || selectedTeamId;
          if (!tId) {
            toast.error("Please select a team from the cascade menu first.");
            navigate("/coaching");
            return;
          }
        } else {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("team_id")
            .eq("user_id", user.id)
            .in("role", ["COACH", "TEAM_MANAGER"]);

          const authorisedTeamIds = Array.from(new Set((roleData || []).map((role) => role.team_id).filter(Boolean)));
          tId = requestedTeamId && authorisedTeamIds.includes(requestedTeamId)
            ? requestedTeamId
            : authorisedTeamIds[0] || null;
          if (!tId) {
            toast.error("You are not assigned as a coach or team manager for any team.");
            navigate("/coaching");
            return;
          }
        }

        if (!active || !tId) return;
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
            if (active) setActiveSeason({ startDate: seasonData.start_date, endDate: seasonData.end_date, year: seasonData.year });
          }
        }

        // 3. Load profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, last_name, avatar_url, date_of_birth")
          .eq("id", playerId)
          .single();
          
        if (profileData && active) setProfile(profileData as Profile);

        // 4. Load coach assessments
        const { data: assessmentsData } = await supabase
          .from("coach_position_assessments")
          .select("position_code, assessment, notes")
          .eq("coach_id", user.id)
          .eq("player_id", playerId)
          .eq("team_id", tId);

        const assMap: Record<string, Assessment> = {};
        if (assessmentsData) {
          assessmentsData.forEach((row) => {
            assMap[row.position_code] = { assessment: row.assessment, notes: row.notes || "" };
          });
        }
        if (active) setAssessments(assMap);

        // 5. Load player preferences
        const { data: prefsData } = await supabase
          .from("player_position_preferences")
          .select("position_code, preference")
          .eq("player_id", playerId)
          .eq("team_id", tId);

        const prefsMap: Record<string, number> = {};
        if (prefsData) {
          prefsData.forEach((row) => {
            prefsMap[row.position_code] = row.preference;
          });
        }
        if (active) setPreferences(prefsMap);

        const history = await loadPlayerHistory(playerId, teamData?.revsports_team_id);
        if (active) setMatchHistory(history);

      } catch (err: unknown) {
        console.error("Error loading profile:", err);
        if (active) toast.error("Failed to load player profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [user, playerId, navigate, requestedTeamId, selectedTeamId]);

  const handleAssessmentChange = async (position: string, val: number) => {
    if (!user || !playerId || !teamId) return;
    
    // Optimistic update
    setAssessments(prev => ({ ...prev, [position]: { ...prev[position], assessment: val } }));
    
    try {
      const { error } = await supabase.from("coach_position_assessments").upsert({
        coach_id: user.id,
        player_id: playerId,
        team_id: teamId,
        position_code: position,
        assessment: val
      }, { onConflict: "coach_id,player_id,team_id,position_code" });
      if (error) throw error;
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
      const { error } = await supabase.from("coach_position_assessments").upsert({
        coach_id: user.id,
        player_id: playerId,
        team_id: teamId,
        position_code: position,
        notes: notes,
        assessment: assessments[position]?.assessment || 2,
      }, { onConflict: "coach_id,player_id,team_id,position_code" });
      if (error) throw error;
      toast.success("Notes saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save notes");
    }
  };

  useEffect(() => {
    let active = true;
    async function loadMatchNotes() {
      if (!selectedMatch?.fixtureId || !teamId || !playerId || !user) {
        setMatchNotes([]);
        return;
      }
      setNotesLoading(true);
      const { data, error } = await supabase
        .from("coach_player_fixture_notes")
        .select("id, note, source, created_at")
        .eq("fixture_id", selectedMatch.fixtureId)
        .eq("team_id", teamId)
        .eq("player_id", playerId)
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) toast.error("Match notes could not be loaded.");
      setMatchNotes((data || []) as CoachNote[]);
      setNotesLoading(false);
    }
    void loadMatchNotes();
    return () => { active = false; };
  }, [playerId, selectedMatch, teamId, user]);

  const addMatchNote = async () => {
    if (!selectedMatch?.fixtureId || !teamId || !playerId || !user || !draftNote.trim()) return;
    const { data, error } = await supabase
      .from("coach_player_fixture_notes")
      .insert({
        fixture_id: selectedMatch.fixtureId,
        team_id: teamId,
        player_id: playerId,
        author_id: user.id,
        note: draftNote.trim(),
        source: "MANUAL",
      })
      .select("id, note, source, created_at")
      .single();
    if (error) {
      toast.error("Match note could not be saved.");
      return;
    }
    setMatchNotes((current) => [data as CoachNote, ...current]);
    setDraftNote("");
    toast.success("Match note saved.");
  };

  const updateMatchNote = async (note: CoachNote) => {
    if (!note.note.trim()) return;
    const { error } = await supabase
      .from("coach_player_fixture_notes")
      .update({ note: note.note.trim() })
      .eq("id", note.id);
    if (error) toast.error("Match note could not be updated.");
    else toast.success("Match note updated.");
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
      <Button variant="ghost" className="mb-4 -ml-4 text-muted-foreground hover:text-foreground" onClick={() => navigate(teamId ? `/coaching?team=${teamId}` : "/coaching")}>
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
                  {POSITION_TRAITS.map((position) => {
                    const pos = position.code;
                    const currentAss = assessments[pos]?.assessment;
                    return (
                      <tr key={pos} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{position.label}</div>
                          <div className="text-xs text-muted-foreground">{position.section}</div>
                        </td>
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
                <button key={m.id} type="button" className="w-full text-left" onClick={() => setSelectedMatch(m)}>
                <Card className="transition-colors hover:border-primary/50 hover:bg-muted/20">
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
                        <div className="text-xs text-muted-foreground">{m.positionName || "Position not recorded"}</div>
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
                </button>
              ))
            )}
          </div>
        </div>

      </div>

      <Dialog open={Boolean(selectedMatch)} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Match notes</DialogTitle>
            <DialogDescription>
              {selectedMatch ? `${new Date(selectedMatch.date).toLocaleDateString("en-AU")} vs ${selectedMatch.opponent}` : ""}
            </DialogDescription>
          </DialogHeader>
          {!selectedMatch?.fixtureId ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">This historical game is not linked to a SportStack fixture, so notes cannot be attached yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Add your note for this player and game…" rows={4} />
                <Button onClick={() => void addMatchNote()} disabled={!draftNote.trim()}><Plus className="mr-2 h-4 w-4" />Add note</Button>
              </div>
              {notesLoading ? (
                <p className="text-sm text-muted-foreground">Loading notes…</p>
              ) : matchNotes.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No private coaching notes for this match yet.</p>
              ) : (
                <div className="space-y-3">
                  {matchNotes.map((note) => (
                    <div key={note.id} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{new Date(note.created_at).toLocaleString("en-AU")}</span>
                        <Badge variant="outline">{note.source === "COACH_NARRATIVE" ? "Coach Narrative" : "Manual"}</Badge>
                      </div>
                      <Textarea value={note.note} onChange={(event) => setMatchNotes((current) => current.map((item) => item.id === note.id ? { ...item, note: event.target.value } : item))} rows={3} />
                      <Button size="sm" variant="outline" onClick={() => void updateMatchNote(note)}>Save changes</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
