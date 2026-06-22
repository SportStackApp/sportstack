import { useState, useEffect, useMemo } from "react";
// Import the Supabase client from our integration package
import { supabase as originalSupabase } from "@/integrations/supabase/client";
// Import the custom hook to check user administration permissions and scopes
import { useAdminScope } from "@/hooks/useAdminScope";
// Import the hook for displaying temporary alerts or messages to the user
import { useToast } from "@/hooks/use-toast";
// Import icons from Lucide library to make the interface visually appealing
import { 
  Trophy, RefreshCw, XCircle, Clock, Users, BarChart3, ChevronDown, X, ShieldAlert, Search
} from "lucide-react";
// Import standard UI structural components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Cast the Supabase client to `any` type to widen API support for these tables
const supabase = originalSupabase as any;

export default function Analytics() {
  const { toast } = useToast();
  
  // 1. ACCESS CONTROL AND PERMISSIONS
  // Any user with administrative access (isAnyAdmin) is allowed on this page.
  // But individual votes are restricted to Super Admins and Association Admins.
  const { loading: scopeLoading, isAnyAdmin, isSuperAdmin, highestScopedRole } = useAdminScope();

  // Determine whether the current user has access to view the individual votes section
  const isPrivilegedAdmin = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN";

  // 2. STATE VARIABLES
  // Main data lists fetched from Supabase
  const [sessions, setSessions] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [revsportsPlayers, setRevsportsPlayers] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filter States: Grade, Rounds (multi-select), Date Range, Voter, and Voted For
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedRounds, setSelectedRounds] = useState<string[]>(["all"]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedVoter, setSelectedVoter] = useState<string>("all");
  const [selectedVotedFor, setSelectedVotedFor] = useState<string>("all");

  // Filter States for Individual Votes Log table: Grade, Rounds (multi-select), Date Range, Voter, and Voted For
  const [logSelectedGrade, setLogSelectedGrade] = useState<string>("all");
  const [logSelectedRounds, setLogSelectedRounds] = useState<string[]>(["all"]);
  const [logStartDate, setLogStartDate] = useState<string>("");
  const [logEndDate, setLogEndDate] = useState<string>("");
  const [logSelectedVoter, setLogSelectedVoter] = useState<string>("all");
  const [logSelectedVotedFor, setLogSelectedVotedFor] = useState<string>("all");

  // Search query for the individual votes log
  const [individualSearchQuery, setIndividualSearchQuery] = useState<string>("");

  // 3. DATA FETCHING FUNCTION
  // Fetch all necessary rows from Supabase in separate clean queries to prevent join bugs,
  // then map and process relationships client-side.
  const loadData = async () => {
    setDataLoading(true);
    try {
      // Step A: Load MVP Voting Sessions
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from("mvp_voting_sessions")
        .select("id, grade, round, game_date, home_team, away_team, status, opened_at, closes_at")
        .order("game_date", { ascending: false });

      if (sessionsErr) throw sessionsErr;
      const loadedSessions = sessionsData || [];
      setSessions(loadedSessions);

      // Step B: Load MVP Votes
      const { data: votesData, error: votesErr } = await supabase
        .from("mvp_votes")
        .select("id, session_id, player_id, points, voter_profile_id, created_at");

      if (votesErr) throw votesErr;
      const loadedVotes = votesData || [];
      setVotes(loadedVotes);

      // Step C: Load Player Names from revsports_players
      // We extract all unique player_ids that received votes to lookup their names and profiles
      const uniquePlayerIds = Array.from(new Set(loadedVotes.map((v: any) => v.player_id))).filter(Boolean);
      
      let loadedPlayers: any[] = [];
      if (uniquePlayerIds.length > 0) {
        const { data: playersData, error: playersErr } = await supabase
          .from("revsports_players")
          .select("id, player_name, profile_id")
          .in("id", uniquePlayerIds);
        if (playersErr) throw playersErr;
        loadedPlayers = playersData || [];
        setRevsportsPlayers(loadedPlayers);
      } else {
        setRevsportsPlayers([]);
      }

      // Step D: Load Registered Profiles
      // We query profile information for all voters and players who have a linked profile
      const profileIds = new Set<string>();
      loadedVotes.forEach((v: any) => {
        if (v.voter_profile_id) profileIds.add(v.voter_profile_id);
      });
      loadedPlayers.forEach((p: any) => {
        if (p.profile_id) profileIds.add(p.profile_id);
      });

      if (profileIds.size > 0) {
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", Array.from(profileIds));
        
        if (profilesErr) throw profilesErr;
        setProfiles(profilesData || []);
      } else {
        setProfiles([]);
      }

    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error loading analytics data",
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      setDataLoading(false);
    }
  };

  // Run initial data fetch when component mounts and user has access
  useEffect(() => {
    if (isAnyAdmin) {
      loadData();
    }
  }, [isAnyAdmin]);

  // 4. MAPS FOR SPEEDY CLIENT-SIDE LOOKUPS
  // We use ES6 Maps to quickly cross-reference related IDs without looping arrays repeatedly.

  // Map of profile id -> formatted full name
  const profileNameMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach((p) => {
      const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      map.set(p.id, fullName || "Unknown Profile");
    });
    return map;
  }, [profiles]);

  // Map of revsports_player_id -> full row data { id, player_name, profile_id }
  const revsportsPlayerMap = useMemo(() => {
    const map = new Map<string, any>();
    revsportsPlayers.forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [revsportsPlayers]);

  // Helper function to dynamically resolve a player's display name.
  // Prefer the profile full name, fall back to scraped player name, otherwise default to Unknown.
  const getPlayerName = (playerId: string) => {
    const pRow = revsportsPlayerMap.get(playerId);
    if (pRow) {
      if (pRow.profile_id && profileNameMap.has(pRow.profile_id)) {
        return profileNameMap.get(pRow.profile_id)!;
      }
      return pRow.player_name || "Unknown Player";
    }
    // Also support fallback if player_id is a profile ID directly
    if (profileNameMap.has(playerId)) {
      return profileNameMap.get(playerId)!;
    }
    return "Unknown Player";
  };

  // Helper function to resolve a voter's display name.
  const getVoterName = (voterProfileId: string) => {
    return profileNameMap.get(voterProfileId) || "Unknown Voter";
  };

  // 5. EXTRACTING UNIQUE SLICER VALUE ARRAYS
  // Sourced from unique properties in the complete sessions database
  const uniqueGrades = useMemo(() => {
    const grades = sessions.map((s) => s.grade).filter(Boolean);
    return Array.from(new Set(grades)).sort();
  }, [sessions]);

  const uniqueRounds = useMemo(() => {
    const rounds = sessions.map((s) => s.round).filter(Boolean);
    return Array.from(new Set(rounds)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [sessions]);

  // Distinct voters from the entire unfiltered votes dataset for the Voter selector dropdown
  const distinctVotersListAll = useMemo(() => {
    const voterIds = Array.from(new Set(votes.map((v) => v.voter_profile_id).filter(Boolean)));
    return voterIds.map((id) => ({
      id,
      name: profileNameMap.get(id) || "Unknown Voter",
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [votes, profileNameMap]);

  // Distinct deduplicated players from the entire unfiltered votes dataset for the Voted For selector dropdown.
  // Utilises the exact same grouping logic as the standings leaderboard.
  const leaderboardAll = useMemo(() => {
    const groups = new Map<string, { name: string }>();
    votes.forEach((vote) => {
      const pId = vote.player_id;
      if (!pId) return;

      const pRow = revsportsPlayerMap.get(pId);
      let groupKey = "";
      let name = "";

      if (pRow) {
        if (pRow.profile_id) {
          groupKey = pRow.profile_id;
          name = profileNameMap.get(pRow.profile_id) || pRow.player_name || "Unknown Player";
        } else {
          const cleanName = (pRow.player_name || "").trim();
          groupKey = cleanName.toLowerCase() || "unknown-empty";
          name = cleanName || "Unknown Player";
        }
      } else {
        groupKey = pId;
        name = "Unknown Player";
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { name });
      }
    });

    return Array.from(groups.entries())
      .map(([key, val]) => ({
        key,
        name: val.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [votes, revsportsPlayerMap, profileNameMap]);

  // 6. FILTERING LOGIC
  // Combine all slicers to filter sessions first based on grade, round, date range.
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Filter by Grade
      if (selectedGrade !== "all" && session.grade !== selectedGrade) {
        return false;
      }
      // Filter by Rounds (if "all" is not in array)
      if (!selectedRounds.includes("all") && !selectedRounds.includes(session.round)) {
        return false;
      }
      // Filter by Start Date
      if (startDate && session.game_date < startDate) {
        return false;
      }
      // Filter by End Date
      if (endDate && session.game_date > endDate) {
        return false;
      }
      return true;
    });
  }, [sessions, selectedGrade, selectedRounds, startDate, endDate]);

  // Optimize lookup of filtered session IDs using a Set
  const filteredSessionIds = useMemo(() => {
    return new Set(filteredSessions.map((s) => s.id));
  }, [filteredSessions]);

  // Filter votes belonging to matches that passed the session filter,
  // and also apply voter and voted for filters.
  const filteredVotes = useMemo(() => {
    return votes.filter((vote) => {
      // 1. Session filter (Grade, Round, Date Range)
      if (!filteredSessionIds.has(vote.session_id)) {
        return false;
      }

      // 2. Voter Filter
      if (selectedVoter !== "all" && vote.voter_profile_id !== selectedVoter) {
        return false;
      }

      // 3. Voted For (Player) Filter
      if (selectedVotedFor !== "all") {
        const pId = vote.player_id;
        let groupKey = "";
        if (pId) {
          const pRow = revsportsPlayerMap.get(pId);
          if (pRow) {
            if (pRow.profile_id) {
              groupKey = pRow.profile_id;
            } else {
              groupKey = (pRow.player_name || "").trim().toLowerCase();
            }
          } else {
            groupKey = pId;
          }
        }
        if (groupKey !== selectedVotedFor) {
          return false;
        }
      }

      return true;
    });
  }, [votes, filteredSessionIds, selectedVoter, selectedVotedFor, revsportsPlayerMap]);

  // Separate filter logic for Individual Votes Log
  const logFilteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (logSelectedGrade !== "all" && session.grade !== logSelectedGrade) {
        return false;
      }
      if (!logSelectedRounds.includes("all") && !logSelectedRounds.includes(session.round)) {
        return false;
      }
      if (logStartDate && session.game_date < logStartDate) {
        return false;
      }
      if (logEndDate && session.game_date > logEndDate) {
        return false;
      }
      return true;
    });
  }, [sessions, logSelectedGrade, logSelectedRounds, logStartDate, logEndDate]);

  const logFilteredSessionIds = useMemo(() => {
    return new Set(logFilteredSessions.map((s) => s.id));
  }, [logFilteredSessions]);

  const logFilteredVotes = useMemo(() => {
    return votes.filter((vote) => {
      if (!logFilteredSessionIds.has(vote.session_id)) {
        return false;
      }
      if (logSelectedVoter !== "all" && vote.voter_profile_id !== logSelectedVoter) {
        return false;
      }
      if (logSelectedVotedFor !== "all") {
        const pId = vote.player_id;
        let groupKey = "";
        if (pId) {
          const pRow = revsportsPlayerMap.get(pId);
          if (pRow) {
            if (pRow.profile_id) {
              groupKey = pRow.profile_id;
            } else {
              groupKey = (pRow.player_name || "").trim().toLowerCase();
            }
          } else {
            groupKey = pId;
          }
        }
        if (groupKey !== logSelectedVotedFor) {
          return false;
        }
      }
      return true;
    });
  }, [votes, logFilteredSessionIds, logSelectedVoter, logSelectedVotedFor, revsportsPlayerMap]);

  // 7. COMPILING METRICS (Stats Cards)
  // Compute votes count, voter pool and averages from filtered data
  const totalVotesCount = filteredVotes.length;
  const distinctSessionsCount = filteredSessions.length;
  
  // Calculate average votes per game
  const averageVotesPerGame = useMemo(() => {
    if (distinctSessionsCount === 0) return "0.0";
    return (totalVotesCount / distinctSessionsCount).toFixed(1);
  }, [totalVotesCount, distinctSessionsCount]);

  // Count distinct profiles who submitted votes
  const distinctVotersCount = useMemo(() => {
    const voters = filteredVotes.map((v) => v.voter_profile_id).filter(Boolean);
    return new Set(voters).size;
  }, [filteredVotes]);

  // 8. COMPILING STANDINGS (Leaderboard Table - Deduplicated)
  // Group votes by profile_id (fallback to lowercased player name if no profile linked)
  // to ensure duplicate appearances for the same player across rounds/clubs are merged.
  const leaderboard = useMemo(() => {
    const statsMap = new Map<string, { name: string; points: number; votesCount: number }>();

    filteredVotes.forEach((vote) => {
      const pId = vote.player_id;
      if (!pId) return;

      const pRow = revsportsPlayerMap.get(pId);
      let groupKey = "";
      let name = "";

      if (pRow) {
        if (pRow.profile_id) {
          groupKey = pRow.profile_id;
          name = profileNameMap.get(pRow.profile_id) || pRow.player_name || "Unknown Player";
        } else {
          const cleanName = (pRow.player_name || "").trim();
          groupKey = cleanName.toLowerCase() || "unknown-empty";
          name = cleanName || "Unknown Player";
        }
      } else {
        groupKey = pId;
        name = "Unknown Player";
      }

      const current = statsMap.get(groupKey) || { name, points: 0, votesCount: 0 };
      current.points += vote.points || 0;
      current.votesCount += 1;
      statsMap.set(groupKey, current);
    });

    return Array.from(statsMap.entries())
      .map(([key, stats]) => ({
        key,
        name: stats.name,
        points: stats.points,
        votesCount: stats.votesCount,
      }))
      .sort((a, b) => b.points - a.points);
  }, [filteredVotes, revsportsPlayerMap, profileNameMap]);

  // 9. AUDITING (Individual Votes - Restricted)
  // Detailed audit list showing how voter profiles allocated points.
  // This list inherits all active filters because it maps over logFilteredVotes.
  const individualVotesList = useMemo(() => {
    if (!isPrivilegedAdmin) return [];

    const sessionMap = new Map<string, any>(sessions.map((s) => [s.id, s]));

    return logFilteredVotes.map((vote) => {
      const session = sessionMap.get(vote.session_id);
      return {
        id: vote.id,
        voterName: getVoterName(vote.voter_profile_id),
        playerName: getPlayerName(vote.player_id),
        points: vote.points,
        round: session ? session.round : "Unknown",
      };
    }).sort((a, b) => b.round.localeCompare(a.round, undefined, { numeric: true }) || a.voterName.localeCompare(b.voterName));
  }, [logFilteredVotes, sessions, isPrivilegedAdmin, revsportsPlayerMap, profileNameMap]);

  // Apply search query input to filter the restricted individual votes list.
  const searchedIndividualVotes = useMemo(() => {
    if (!individualSearchQuery.trim()) return Array.from(individualVotesList);
    const query = individualSearchQuery.toLowerCase().trim();
    return individualVotesList.filter((vote) => {
      return (
        vote.voterName.toLowerCase().includes(query) ||
        vote.playerName.toLowerCase().includes(query)
      );
    });
  }, [individualVotesList, individualSearchQuery]);

  // Helper handlers for modifying filters
  const handleRoundToggle = (round: string) => {
    if (round === "all") {
      setSelectedRounds(["all"]);
    } else {
      let next = selectedRounds.filter((r) => r !== "all");
      if (next.includes(round)) {
        next = next.filter((r) => r !== round);
      } else {
        next.push(round);
      }
      if (next.length === 0) {
        next = ["all"];
      }
      setSelectedRounds(next);
    }
  };

  const handleResetFilters = () => {
    setSelectedGrade("all");
    setSelectedRounds(["all"]);
    setStartDate("");
    setEndDate("");
    setSelectedVoter("all");
    setSelectedVotedFor("all");
  };

  const hasActiveFilters = selectedGrade !== "all" || !selectedRounds.includes("all") || startDate || endDate || selectedVoter !== "all" || selectedVotedFor !== "all";

  const handleLogRoundToggle = (round: string) => {
    if (round === "all") {
      setLogSelectedRounds(["all"]);
    } else {
      let next = logSelectedRounds.filter((r) => r !== "all");
      if (next.includes(round)) {
        next = next.filter((r) => r !== round);
      } else {
        next.push(round);
      }
      if (next.length === 0) {
        next = ["all"];
      }
      setLogSelectedRounds(next);
    }
  };

  const handleResetLogFilters = () => {
    setLogSelectedGrade("all");
    setLogSelectedRounds(["all"]);
    setLogStartDate("");
    setLogEndDate("");
    setLogSelectedVoter("all");
    setLogSelectedVotedFor("all");
  };

  const hasActiveLogFilters = logSelectedGrade !== "all" || !logSelectedRounds.includes("all") || logStartDate || logEndDate || logSelectedVoter !== "all" || logSelectedVotedFor !== "all";

  // 10. CONDITIONAL RENDERING (Access Denied / Loading screens)
  if (scopeLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAnyAdmin) {
    return (
      <div className="container mx-auto p-6 flex justify-center items-center min-h-[400px]">
        <Card className="w-full max-w-md border-red-200 bg-red-50/50 shadow-lg animate-fade-in">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Access Denied
            </CardTitle>
            <CardDescription className="text-red-600 font-medium">
              Administrative permissions required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 text-sm">
              You must have administrative privileges to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Top Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualise standings and vote data metrics
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={dataLoading} className="self-start md:self-auto gap-2">
          <RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} /> Refresh Data
        </Button>
      </div>

      {/* Main Tabbed Layout container */}
      <Tabs defaultValue="mvp-voting" className="w-full">
        <TabsList className="bg-muted p-1 rounded-lg border border-border inline-flex">
          <TabsTrigger value="mvp-voting" className="font-semibold">MVP Voting</TabsTrigger>
        </TabsList>

        <TabsContent value="mvp-voting" className="space-y-6 mt-4">
          {dataLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          ) : (
            <>
              {/* SECTION 1: SLICERS (FILTERS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end bg-muted/30 p-4 rounded-xl border border-border shadow-sm">
                
                {/* Grade Filter Dropdown */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grade</Label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {uniqueGrades.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rounds Multi-Select Checkbox Popover */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rounds</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between bg-background font-normal text-left">
                        <span className="truncate">
                          {selectedRounds.includes("all")
                            ? "All Rounds"
                            : selectedRounds.length === 1
                            ? selectedRounds[0]
                            : `${selectedRounds.length} Rounds`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 bg-background border border-border shadow-md" align="start">
                      <div className="max-h-60 overflow-y-auto space-y-2 p-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="round-all"
                            checked={selectedRounds.includes("all")}
                            onCheckedChange={() => handleRoundToggle("all")}
                          />
                          <label htmlFor="round-all" className="text-sm font-medium leading-none cursor-pointer">
                            All Rounds
                          </label>
                        </div>
                        <div className="h-px bg-border my-1" />
                        {uniqueRounds.map((round) => (
                          <div key={round} className="flex items-center space-x-2">
                            <Checkbox
                              id={`round-${round}`}
                              checked={selectedRounds.includes(round)}
                              onCheckedChange={() => handleRoundToggle(round)}
                            />
                            <label htmlFor={`round-${round}`} className="text-sm font-medium leading-none cursor-pointer">
                              {round}
                            </label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Voter Selector Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voter</Label>
                  <Select value={selectedVoter} onValueChange={setSelectedVoter}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="All Voters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Voters</SelectItem>
                      {distinctVotersListAll.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Voted For Player Selector Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voted For</Label>
                  <Select value={selectedVotedFor} onValueChange={setSelectedVotedFor}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="All Players" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Players</SelectItem>
                      {leaderboardAll.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Game Date - Start Date Slicer */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-background"
                  />
                </div>

                {/* Game Date - End Date Slicer */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-background flex-1"
                    />
                    {hasActiveFilters && (
                      <Button variant="ghost" onClick={handleResetFilters} size="icon" title="Clear Filters" className="shrink-0 border border-border hover:bg-muted">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: STATS CARDS ROW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Metric Card A: Total Votes */}
                <Card className="shadow-sm border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Votes Cast</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-foreground">{totalVotesCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">Sum of all points allocations</p>
                  </CardContent>
                </Card>

                {/* Metric Card B: Average Votes */}
                <Card className="shadow-sm border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average Votes Per Game</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-foreground">{averageVotesPerGame}</div>
                    <p className="text-xs text-muted-foreground mt-1">Votes divided by matching games ({distinctSessionsCount})</p>
                  </CardContent>
                </Card>

                {/* Metric Card C: Unique Voters */}
                <Card className="shadow-sm border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distinct Voters</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-foreground">{distinctVotersCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">Different teammates who submitted votes</p>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION 3: LEADERBOARD TABLE */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <Card className="shadow-sm border-border lg:col-span-2">
                  <CardHeader className="bg-muted/20 border-b py-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500 fill-yellow-500/20" /> Player Leaderboard
                    </CardTitle>
                    <CardDescription>Ranked standouts by cumulative voting points (deduplicated by profile)</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {leaderboard.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground text-sm">
                        No votes match the selected filters.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="w-20 font-bold text-center">Rank</TableHead>
                              <TableHead className="font-semibold">Player Name</TableHead>
                              <TableHead className="text-center font-semibold">Votes Received</TableHead>
                              <TableHead className="text-right font-semibold">Total Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leaderboard.map((res, index) => {
                              const isWinner = index === 0;
                              return (
                                <TableRow 
                                  key={res.key} 
                                  className={`${isWinner ? "bg-amber-50/70 hover:bg-amber-50" : "hover:bg-muted/30"} transition-colors`}
                                >
                                  <TableCell className="font-bold text-center">
                                    {isWinner ? "🥇 1" : index + 1}
                                  </TableCell>
                                  <TableCell className={`font-semibold ${isWinner ? "text-amber-900" : ""}`}>
                                    {res.name}
                                  </TableCell>
                                  <TableCell className="text-center font-medium text-muted-foreground">
                                    {res.votesCount}
                                  </TableCell>
                                  <TableCell className={`text-right font-black ${isWinner ? "text-amber-900 text-base" : ""}`}>
                                    {res.points}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Info and Guide Sidebar Card */}
                <Card className="shadow-sm border-border h-fit">
                  <CardHeader className="bg-muted/20 border-b py-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-muted-foreground" /> Analytics Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 text-sm text-muted-foreground space-y-3">
                    <p>
                      Standings are compiled dynamically by aggregating votes cast by players.
                    </p>
                    <p>
                      The leaderboard automatically consolidates votes received by the same player across different rounds and clubs based on their profile linkage.
                    </p>
                    <p>
                      Dates and rounds respect standard Australian Melbourne formatting values.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION 4: RESTRICTED INDIVIDUAL VOTES PANEL */}
              {isPrivilegedAdmin && (
                <Card className="shadow-sm border-border">
                  <CardHeader className="bg-muted/20 border-b py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" /> Individual Votes Log
                      </CardTitle>
                      <CardDescription>Detailed audit of individual votes and voter allocations</CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 self-start md:self-auto uppercase text-[10px] font-bold tracking-wider py-1 px-3">
                      Restricted: visible to Super and Association Admins only.
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    {/* Log Filters Bar */}
                    <div className="px-6 pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end bg-muted/30 p-4 rounded-xl border border-border shadow-sm">
                        
                        {/* Grade Filter Dropdown */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grade</Label>
                          <Select value={logSelectedGrade} onValueChange={setLogSelectedGrade}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="All Grades" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Grades</SelectItem>
                              {uniqueGrades.map((grade) => (
                                <SelectItem key={grade} value={grade}>
                                  {grade}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Rounds Multi-Select Checkbox Popover */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rounds</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between bg-background font-normal text-left">
                                <span className="truncate">
                                  {logSelectedRounds.includes("all")
                                    ? "All Rounds"
                                    : logSelectedRounds.length === 1
                                    ? logSelectedRounds[0]
                                    : `${logSelectedRounds.length} Rounds`}
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2 bg-background border border-border shadow-md" align="start">
                              <div className="max-h-60 overflow-y-auto space-y-2 p-1">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="log-round-all"
                                    checked={logSelectedRounds.includes("all")}
                                    onCheckedChange={() => handleLogRoundToggle("all")}
                                  />
                                  <label htmlFor="log-round-all" className="text-sm font-medium leading-none cursor-pointer">
                                    All Rounds
                                  </label>
                                </div>
                                <div className="h-px bg-border my-1" />
                                {uniqueRounds.map((round) => (
                                  <div key={round} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`log-round-${round}`}
                                      checked={logSelectedRounds.includes(round)}
                                      onCheckedChange={() => handleLogRoundToggle(round)}
                                    />
                                    <label htmlFor={`log-round-${round}`} className="text-sm font-medium leading-none cursor-pointer">
                                      {round}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Voter Selector Filter */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voter</Label>
                          <Select value={logSelectedVoter} onValueChange={setLogSelectedVoter}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="All Voters" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Voters</SelectItem>
                              {distinctVotersListAll.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Voted For Player Selector Filter */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voted For</Label>
                          <Select value={logSelectedVotedFor} onValueChange={setLogSelectedVotedFor}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="All Players" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Players</SelectItem>
                              {leaderboardAll.map((p) => (
                                <SelectItem key={p.key} value={p.key}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Game Date - Start Date Slicer */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                          <Input
                            type="date"
                            value={logStartDate}
                            onChange={(e) => setLogStartDate(e.target.value)}
                            className="bg-background"
                          />
                        </div>

                        {/* Game Date - End Date Slicer */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</Label>
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={logEndDate}
                              onChange={(e) => setLogEndDate(e.target.value)}
                              className="bg-background flex-1"
                            />
                            {hasActiveLogFilters && (
                              <Button variant="ghost" onClick={handleResetLogFilters} size="icon" title="Clear Filters" className="shrink-0 border border-border hover:bg-muted">
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Search box for individual votes log filtering */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by voter name or player name..."
                          value={individualSearchQuery}
                          onChange={(e) => setIndividualSearchQuery(e.target.value)}
                          className="pl-9 bg-background max-w-sm"
                        />
                      </div>
                    </div>

                    {searchedIndividualVotes.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground text-sm">
                        No individual votes records found for these filters.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="font-semibold">Voter Name</TableHead>
                              <TableHead className="font-semibold">Voted-For Player Name</TableHead>
                              <TableHead className="text-center font-semibold">Points</TableHead>
                              <TableHead className="text-right font-semibold">Round</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchedIndividualVotes.map((vote) => (
                              <TableRow key={vote.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium text-foreground">{vote.voterName}</TableCell>
                                <TableCell className="font-medium text-muted-foreground">{vote.playerName}</TableCell>
                                <TableCell className="text-center font-bold">
                                  <Badge variant="outline" className="px-2.5 py-0.5">
                                    {vote.points} {vote.points === 1 ? "point" : "points"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">{vote.round}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
