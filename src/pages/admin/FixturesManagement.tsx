import { useState, useEffect, Fragment, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Calendar, Upload, Pencil, Trash2, Plus, Save, X, Eye, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { AdminCascadeFilters } from "@/components/admin/AdminCascadeFilters";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { nextSortState, stableSortRows, type SortState } from "@/lib/adminSorting";
import {
  ALL_CASCADE_VALUE,
  emptyCascadeValue,
  getCascadeOptions,
  type CascadeValue,
} from "@/lib/adminCascade";
import * as XLSX from "xlsx";
import { getFixtureDisplayStatus } from "@/lib/fixtureDisplay";
import {
  combineZonedDateTime,
  DEFAULT_ASSOCIATION_TIMEZONE,
  splitZonedDateTime,
} from "@/lib/timezoneDateTime";

interface FixtureRow {
  id: string;
  division_id: string | null;
  season_id: string | null;
  fixture_date: string | null;
  scheduled_end_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  round_number: number | null;
  home_team_id: string;
  away_team_id: string | null;
  venue_id: string | null;
  pitch_id: string | null;
  revsports_match_url: string | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
}

type FixtureSortKey = "date" | "association" | "division" | "home" | "away" | "round" | "venue" | "status" | "score";

interface RevSportsPlayer {
  id: string;
  fixture_id: string | null;
  team_side: "home" | "away";
  attended: boolean;
  jersey: string | null;
  player_name: string | null;
  is_captain: boolean;
  is_fillin: boolean;
  goals: number;
  green_cards: number;
  yellow_cards: number;
  red_cards: number;
  umpire_1: string | null;
  umpire_2: string | null;
}

interface FixtureForm {
  home_team_id: string;
  away_team_id: string;
  round_number: string;
  fixture_date: string;
  game_time: string;
  scheduled_end_date: string;
  scheduled_end_time: string;
  venue_id: string;
  pitch_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  notes: string;
}

interface FixtureTeam {
  id: string;
  name: string;
  club_id: string;
  division_id: string | null;
  divisionName: string | null;
  associationName: string | null;
}

interface FixtureTeamScope {
  associationId: string;
  divisionId: string;
}

const emptyForm: FixtureForm = {
  home_team_id: "",
  away_team_id: "",
  round_number: "",
  fixture_date: "",
  game_time: "",
  scheduled_end_date: "",
  scheduled_end_time: "",
  venue_id: "",
  pitch_id: "",
  status: "SCHEDULED",
  home_score: null,
  away_score: null,
  notes: "",
};

const emptyFixtureTeamScope: FixtureTeamScope = {
  associationId: ALL_CASCADE_VALUE,
  divisionId: ALL_CASCADE_VALUE,
};

const FIXTURE_SELECT =
  "id, division_id, season_id, fixture_date, scheduled_end_at, status, home_score, away_score, notes, round_number, venue_id, pitch_id, home_team_id, away_team_id, revsports_match_url, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

const isByeFixture = (fixture: FixtureRow) =>
  fixture.away_team_id === null && fixture.revsports_match_url?.startsWith("revsports-bye|");

const getByeRoundLocations = (fixture: FixtureRow) => {
  if (!isByeFixture(fixture)) return "";
  const marker = "BYE — Round locations: ";
  return fixture.notes?.startsWith(marker) ? fixture.notes.slice(marker.length) : "";
};

const getFixtureLocationLabel = (fixture: FixtureRow) =>
  (fixture.venue?.name ?? getByeRoundLocations(fixture)) ||
  (isByeFixture(fixture) ? "No match venue — bye" : "TBD");

const combineOptionalDateTime = (date: string, time: string, timeZone: string) =>
  date && time ? combineZonedDateTime(date, time, timeZone) : null;

const isValidExactEnd = (startAt: string, exactEndAt: string | null) =>
  exactEndAt === null || new Date(exactEndAt).getTime() > new Date(startAt).getTime();

const normaliseStatus = (status: string) => status.toUpperCase();
const formatStatusLabel = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
const toDbStatus = (status: string) => status.toUpperCase();

const FIXTURE_DIALOG_STORAGE_KEY = "sportstack:fixtures:active-dialog";
type FixtureDialogState = {
  type: "add" | "edit" | "details" | "delete";
  fixtureId?: string;
};

const rememberFixtureDialog = (dialog: FixtureDialogState) => {
  window.sessionStorage.setItem(FIXTURE_DIALOG_STORAGE_KEY, JSON.stringify(dialog));
};

const forgetFixtureDialog = () => {
  window.sessionStorage.removeItem(FIXTURE_DIALOG_STORAGE_KEY);
};

const readRememberedFixtureDialog = (): FixtureDialogState | null => {
  try {
    const rawDialog = window.sessionStorage.getItem(FIXTURE_DIALOG_STORAGE_KEY);
    if (!rawDialog) return null;
    const dialog = JSON.parse(rawDialog) as Partial<FixtureDialogState>;
    if (!dialog.type || !["add", "edit", "details", "delete"].includes(dialog.type)) return null;
    return dialog as FixtureDialogState;
  } catch {
    forgetFixtureDialog();
    return null;
  }
};

const FixturesManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedTeamId, selectedAssociationId, selectedClubId, selectedDivision } = useTeamContext();
  const { scopedTeamIds } = useAdminScope();
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFixture, setSelectedFixture] = useState<FixtureRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    date: "",
    time: "",
    endDate: "",
    endTime: "",
    homeTeamId: "",
    awayTeamId: "",
    round: "",
    venueId: "",
    pitchId: "",
    status: "",
    homeScore: "",
    awayScore: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsFixture, setDetailsFixture] = useState<FixtureRow | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [rosterPlayers, setRosterPlayers] = useState<RevSportsPlayer[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<FixtureForm>(emptyForm);
  const [addTeamScope, setAddTeamScope] = useState<FixtureTeamScope>(emptyFixtureTeamScope);
  const [editTeamScope, setEditTeamScope] = useState<FixtureTeamScope>(emptyFixtureTeamScope);
  const [allAssocTeams, setAllAssocTeams] = useState<FixtureTeam[]>([]);
  const [allAssociations, setAllAssociations] = useState<{ id: string; name: string; timezone: string | null }[]>([]);
  const [allClubs, setAllClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [allDivisions, setAllDivisions] = useState<{ id: string; name: string; association_id: string; season_id: string | null }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [pitches, setPitches] = useState<{ id: string; name: string; venue_id: string }[]>([]);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterRound, setFilterRound] = useState("");
  const [fixtureCascade, setFixtureCascade] = useState<CascadeValue>(emptyCascadeValue);
  const [assocTeamIds, setAssocTeamIds] = useState<string[]>([]);
  const [fixtureSort, setFixtureSort] = useState<SortState<FixtureSortKey> | null>(null);

  const teamIds = useMemo(
    () => selectedTeamId
      ? [selectedTeamId]
      : scopedTeamIds.length > 0
      ? scopedTeamIds
      : [],
    [selectedTeamId, scopedTeamIds],
  );

  useEffect(() => {
    setFixtureCascade({
      associationId: selectedAssociationId || ALL_CASCADE_VALUE,
      clubId: selectedClubId || ALL_CASCADE_VALUE,
      divisionId: selectedDivision || ALL_CASCADE_VALUE,
      teamId: selectedTeamId || ALL_CASCADE_VALUE,
    });
  }, [selectedAssociationId, selectedClubId, selectedDivision, selectedTeamId]);

  useEffect(() => {
    const loadRefData = async () => {
      if (!selectedAssociationId) {
        const [venueRes, teamRes, pitchRes, divisionRes, associationRes, clubRes] = await Promise.all([
          supabase.from("venues").select("id, name").order("name"),
          supabase.from("teams").select("id, name, club_id, division_id, divisions(name, association_id, associations(name))").order("name"),
          supabase.from("pitches").select("id, name, venue_id").order("name"),
          supabase.from("divisions").select("id, name, association_id, season_id").order("name"),
          supabase.from("associations").select("id, name, timezone").order("name"),
          supabase.from("clubs").select("id, name, association_id").order("name"),
        ]);
        setVenues(venueRes.data || []);
        setAllAssocTeams((teamRes.data || []).map((team) => ({
          id: team.id,
          name: team.name,
          club_id: team.club_id,
          division_id: team.division_id,
          divisionName: team.divisions?.name ?? null,
          associationName: team.divisions?.associations?.name ?? null,
        })));
        setPitches(pitchRes.data || []);
        setAllDivisions(divisionRes.data || []);
        setAllAssociations(associationRes.data || []);
        setAllClubs(clubRes.data || []);
        return;
      }
      const [clubRes, venueRes, divisionRes, associationRes] = await Promise.all([
        supabase.from("clubs").select("id, name, association_id").eq("association_id", selectedAssociationId).order("name"),
        supabase.from("venues").select("id, name").eq("association_id", selectedAssociationId).order("name"),
        supabase.from("divisions").select("id, name, association_id, season_id").order("name"),
        supabase.from("associations").select("id, name, timezone").order("name"),
      ]);

      const clubIds = (clubRes.data || []).map((club) => club.id);
      const loadedVenues = venueRes.data || [];
      setVenues(loadedVenues);
      setAllDivisions(divisionRes.data || []);
      setAllAssociations(associationRes.data || []);
      setAllClubs(clubRes.data || []);

      if (clubIds.length > 0) {
        const { data: teamData } = await supabase.from("teams").select("id, name, club_id, division_id, divisions(name, association_id, associations(name))").in("club_id", clubIds).order("name");
        setAllAssocTeams((teamData || []).map((team) => ({
          id: team.id,
          name: team.name,
          club_id: team.club_id,
          division_id: team.division_id,
          divisionName: team.divisions?.name ?? null,
          associationName: team.divisions?.associations?.name ?? null,
        })));
      } else {
        setAllAssocTeams([]);
      }

      if (loadedVenues.length > 0) {
        const { data: pitchData } = await supabase.from("pitches").select("id, name, venue_id").in("venue_id", loadedVenues.map((venue) => venue.id)).order("name");
        setPitches(pitchData || []);
      } else {
        setPitches([]);
      }
    };
    loadRefData();
  }, [selectedAssociationId]);

  useEffect(() => {
    if (selectedAssociationId && teamIds.length === 0) {
      const fetchAssocTeams = async () => {
        const { data: clubs } = await supabase.from("clubs").select("id").eq("association_id", selectedAssociationId);
        const clubIds = (clubs || []).map((club) => club.id);
        if (clubIds.length === 0) {
          setAssocTeamIds([]);
          return;
        }
        const { data: teams } = await supabase.from("teams").select("id").in("club_id", clubIds);
        setAssocTeamIds((teams || []).map((team) => team.id));
      };
      void fetchAssocTeams();
    } else {
      setAssocTeamIds([]);
    }
  }, [selectedAssociationId, teamIds.length]);

  const fetchFixtures = useCallback(async () => {
    const shouldFetchAll = !selectedAssociationId && !selectedTeamId && scopedTeamIds.length === 0;
    const idsToUse = shouldFetchAll ? null : teamIds.length > 0 ? teamIds : assocTeamIds;

    setLoading(true);
    let query = supabase.from("fixtures").select(FIXTURE_SELECT).order("fixture_date", { ascending: true });

    if (idsToUse !== null) {
      if (idsToUse.length === 0) {
        setFixtures([]);
        setLoading(false);
        return;
      }
      const idList = idsToUse.join(",");
      query = query.or(`home_team_id.in.(${idList}),away_team_id.in.(${idList})`);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setFixtures([]);
      setLoading(false);
      return;
    }

    const loadedFixtures = (data as FixtureRow[]) || [];
    setFixtures(loadedFixtures);
    setLoading(false);
  }, [assocTeamIds, scopedTeamIds.length, selectedAssociationId, selectedTeamId, teamIds, toast]);

  useEffect(() => {
    void fetchFixtures();
  }, [fetchFixtures]);

  const teamById = useMemo(
    () => new Map(allAssocTeams.map((team) => [team.id, team])),
    [allAssocTeams],
  );

  const clubById = useMemo(
    () => new Map(allClubs.map((club) => [club.id, club])),
    [allClubs],
  );

  const fixtureCascadeOptions = useMemo(
    () =>
      getCascadeOptions({
        associations: allAssociations,
        clubs: allClubs,
        divisions: allDivisions,
        teams: allAssocTeams,
        value: fixtureCascade,
      }),
    [allAssociations, allClubs, allDivisions, allAssocTeams, fixtureCascade],
  );

  const getFixtureTeamScopeOptions = (scope: FixtureTeamScope) => {
    const divisions =
      scope.associationId === ALL_CASCADE_VALUE
        ? []
        : allDivisions.filter((division) => division.association_id === scope.associationId);

    const teams =
      scope.divisionId === ALL_CASCADE_VALUE
        ? []
        : allAssocTeams.filter((team) => {
            if (team.division_id !== scope.divisionId) return false;
            const club = clubById.get(team.club_id);
            return scope.associationId === ALL_CASCADE_VALUE || club?.association_id === scope.associationId;
          });

    return { divisions, teams };
  };

  const addTeamScopeOptions = getFixtureTeamScopeOptions(addTeamScope);
  const editTeamScopeOptions = getFixtureTeamScopeOptions(editTeamScope);

  const getFixtureTeamLabel = (team: FixtureTeam | undefined, fallback = "Unknown") => {
    if (!team) return fallback;
    return team.name;
  };

  const getTeamLabel = (teamId: string | null | undefined, fallback = "BYE") => {
    if (!teamId) return fallback;
    return getFixtureTeamLabel(teamById.get(teamId), fallback);
  };

  const isTeamInFixtureScope = (teamId: string | null | undefined, scope: FixtureTeamScope) => {
    if (!teamId) return true;
    if (scope.associationId === ALL_CASCADE_VALUE || scope.divisionId === ALL_CASCADE_VALUE) return false;
    const team = teamById.get(teamId);
    if (!team || team.division_id !== scope.divisionId) return false;
    const club = clubById.get(team.club_id);
    return club?.association_id === scope.associationId;
  };

  const handleExport = () => {
    if (displayFixtures.length === 0) return;
    const rows = displayFixtures.map((fixture) => {
      const date = fixture.fixture_date ? new Date(fixture.fixture_date) : null;
      const isBye = isByeFixture(fixture);
      return {
        Date: date ? date.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
        Day: date ? date.toLocaleDateString("en-AU", { weekday: "short" }) : "",
        Time: date && !isBye ? date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "",
        "Home Team": getTeamLabel(fixture.home_team_id, fixture.home_team?.name ?? "Unknown"),
        "Away Team": getTeamLabel(fixture.away_team_id, fixture.away_team?.name ?? "BYE"),
        Venue: getFixtureLocationLabel(fixture),
        Round: fixture.round_number ?? "",
        Status: getFixtureDisplayStatus({
          fixtureDate: fixture.fixture_date,
          status: fixture.status,
          homeTeam: fixture.home_team,
          awayTeam: fixture.away_team,
        }),
        "Home Score": fixture.home_score ?? "",
        "Away Score": fixture.away_score ?? "",
        Notes: fixture.notes || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fixtures");
    XLSX.writeFile(wb, `fixtures-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exported", description: `${displayFixtures.length} fixtures exported.` });
  };

  const openEdit = useCallback((fixture: FixtureRow) => {
    const homeTeam = allAssocTeams.find(t => t.id === fixture.home_team_id);
    const awayTeam = fixture.away_team_id ? allAssocTeams.find(t => t.id === fixture.away_team_id) : undefined;
    const scopeTeam = homeTeam ?? awayTeam;
    const club = scopeTeam ? clubById.get(scopeTeam.club_id) : undefined;
    setEditTeamScope({
      associationId: club?.association_id ?? ALL_CASCADE_VALUE,
      divisionId: scopeTeam?.division_id ?? ALL_CASCADE_VALUE,
    });
    
    const timeZone = allAssociations.find((association) => association.id === club?.association_id)?.timezone
      ?? DEFAULT_ASSOCIATION_TIMEZONE;
    const dateParts = splitZonedDateTime(fixture.fixture_date, timeZone);
    const endParts = splitZonedDateTime(fixture.scheduled_end_at, timeZone);
    
    setEditForm({
      date: dateParts.fixture_date,
      time: dateParts.game_time,
      endDate: endParts.fixture_date,
      endTime: endParts.game_time,
      homeTeamId: fixture.home_team_id ?? "",
      awayTeamId: fixture.away_team_id ?? "",
      round: String(fixture.round_number ?? ""),
      venueId: fixture.venue_id ?? "",
      pitchId: fixture.pitch_id ?? "",
      status: fixture.status ?? "SCHEDULED",
      homeScore: fixture.home_score !== null ? String(fixture.home_score) : "",
      awayScore: fixture.away_score !== null ? String(fixture.away_score) : "",
    });
    setSelectedFixture(fixture);
    setIsEditModalOpen(true);
    rememberFixtureDialog({ type: "edit", fixtureId: fixture.id });
  }, [allAssocTeams, allAssociations, clubById]);

  const openDetails = useCallback(async (fixture: FixtureRow) => {
    setDetailsFixture(fixture);
    setIsDetailsOpen(true);
    setDetailsLoading(true);
    setRosterPlayers([]);
    rememberFixtureDialog({ type: "details", fixtureId: fixture.id });

    try {
      const { data, error } = await supabase
        .from("revsports_players")
        .select("*")
        .eq("fixture_id", fixture.id);

      if (error) {
        toast({ title: "Error fetching details", description: error.message, variant: "destructive" });
      } else {
        setRosterPlayers((data as RevSportsPlayer[]) || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setDetailsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const restoreRememberedDialog = () => {
      const rememberedDialog = readRememberedFixtureDialog();
      if (!rememberedDialog) return;

      if (rememberedDialog.type === "add") {
        setAddDialogOpen(true);
        return;
      }

      const fixture = fixtures.find((candidate) => candidate.id === rememberedDialog.fixtureId);
      if (!fixture) return;

      if (rememberedDialog.type === "edit" && !isEditModalOpen) {
        openEdit(fixture);
      } else if (rememberedDialog.type === "details" && !isDetailsOpen) {
        void openDetails(fixture);
      } else if (rememberedDialog.type === "delete" && !deleteDialogOpen) {
        setDeleteTarget(fixture.id);
        setDeleteDialogOpen(true);
      }
    };
    const restoreWhenVisible = () => {
      if (document.visibilityState === "visible") restoreRememberedDialog();
    };

    window.addEventListener("focus", restoreRememberedDialog);
    document.addEventListener("visibilitychange", restoreWhenVisible);
    restoreRememberedDialog();
    return () => {
      window.removeEventListener("focus", restoreRememberedDialog);
      document.removeEventListener("visibilitychange", restoreWhenVisible);
    };
  }, [deleteDialogOpen, fixtures, isDetailsOpen, isEditModalOpen, openDetails, openEdit]);

  const handleUpdateFixture = async () => {
    if (!selectedFixture) return;
    if (!editForm.homeTeamId || !editForm.date) {
      toast({ title: "Error", description: "Home team and date are required.", variant: "destructive" });
      return;
    }
    if (
      !isTeamInFixtureScope(editForm.homeTeamId, editTeamScope) ||
      !isTeamInFixtureScope(editForm.awayTeamId, editTeamScope)
    ) {
      toast({
        title: "Team mapping needs checking",
        description: "Home and away teams must match the selected association and division.",
        variant: "destructive",
      });
      return;
    }

    const selectedDivision = allDivisions.find((division) => division.id === editTeamScope.divisionId);
    if (!selectedDivision?.season_id) {
      toast({
        title: "Division setup needs checking",
        description: "Choose a division with an assigned season before saving this fixture.",
        variant: "destructive",
      });
      return;
    }

    if ((editForm.endDate && !editForm.endTime) || (!editForm.endDate && editForm.endTime)) {
      toast({ title: "Check exact finish", description: "Enter both an end date and end time, or leave both blank.", variant: "destructive" });
      return;
    }

    const timeZone = allAssociations.find((association) => association.id === editTeamScope.associationId)?.timezone
      ?? DEFAULT_ASSOCIATION_TIMEZONE;
    const fixtureStartAt = combineZonedDateTime(editForm.date, editForm.time, timeZone);
    const exactEndAt = combineOptionalDateTime(editForm.endDate, editForm.endTime, timeZone);
    if (!isValidExactEnd(fixtureStartAt, exactEndAt)) {
      toast({ title: "Check exact finish", description: "The exact finish must be after the fixture start.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("fixtures").update({
      division_id: selectedDivision.id,
      season_id: selectedDivision.season_id,
      home_team_id: editForm.homeTeamId,
      away_team_id: editForm.awayTeamId || null,
      round_number: editForm.round ? parseInt(editForm.round, 10) : null,
      fixture_date: fixtureStartAt,
      scheduled_end_at: exactEndAt,
      venue_id: editForm.venueId || null,
      pitch_id: editForm.pitchId || null,
      status: toDbStatus(editForm.status),
      home_score: editForm.homeScore ? parseInt(editForm.homeScore, 10) : null,
      away_score: editForm.awayScore ? parseInt(editForm.awayScore, 10) : null,
    }).eq("id", selectedFixture.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Updated", description: "Fixture updated successfully." });
    forgetFixtureDialog();
    setIsEditModalOpen(false);
    setSelectedFixture(null);
    fetchFixtures();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("fixtures").delete().eq("id", deleteTarget);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Fixture deleted." });
      fetchFixtures();
    }
    forgetFixtureDialog();
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleAddFixture = async () => {
    if (!addForm.home_team_id || !addForm.fixture_date) {
      toast({ title: "Error", description: "Home team and date are required.", variant: "destructive" });
      return;
    }

    const selectedDivision = allDivisions.find((division) => division.id === addTeamScope.divisionId);
    if (!selectedDivision?.season_id) {
      toast({
        title: "Division setup needs checking",
        description: "Choose a division with an assigned season before creating this fixture.",
        variant: "destructive",
      });
      return;
    }

    if ((addForm.scheduled_end_date && !addForm.scheduled_end_time) || (!addForm.scheduled_end_date && addForm.scheduled_end_time)) {
      toast({ title: "Check exact finish", description: "Enter both an end date and end time, or leave both blank.", variant: "destructive" });
      return;
    }

    const timeZone = allAssociations.find((association) => association.id === addTeamScope.associationId)?.timezone
      ?? DEFAULT_ASSOCIATION_TIMEZONE;
    const fixtureStartAt = combineZonedDateTime(addForm.fixture_date, addForm.game_time, timeZone);
    const exactEndAt = combineOptionalDateTime(addForm.scheduled_end_date, addForm.scheduled_end_time, timeZone);
    if (!isValidExactEnd(fixtureStartAt, exactEndAt)) {
      toast({ title: "Check exact finish", description: "The exact finish must be after the fixture start.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("fixtures").insert({
      division_id: selectedDivision.id,
      season_id: selectedDivision.season_id,
      home_team_id: addForm.home_team_id,
      away_team_id: addForm.away_team_id || null,
      round_number: addForm.round_number ? parseInt(addForm.round_number, 10) : null,
      fixture_date: fixtureStartAt,
      scheduled_end_at: exactEndAt,
      venue_id: addForm.venue_id || null,
      pitch_id: addForm.pitch_id || null,
      status: toDbStatus(addForm.status),
      home_score: addForm.home_score,
      away_score: addForm.away_score,
      notes: addForm.notes || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Created", description: "Fixture added." });
    forgetFixtureDialog();
    setAddDialogOpen(false);
    setAddForm(emptyForm);
    fetchFixtures();
  };

  const renderTeamSelect = (
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    teamsList: FixtureTeam[],
    allowBye = false,
    disabled = false,
  ) => {
    const selectValue = value === "" ? "__none__" : value || "__none__";
    return (
      <Select value={selectValue} onValueChange={(value) => onChange(value === "__none__" ? "" : value)} disabled={disabled}>
        <SelectTrigger className="h-10 text-sm w-full min-w-0 overflow-hidden px-3"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{allowBye ? "BYE" : "None"}</SelectItem>
          {teamsList.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {getFixtureTeamLabel(team)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const includeSelectedTeams = (teamsList: FixtureTeam[], selectedIds: string[]) => {
    const optionIds = new Set(teamsList.map((team) => team.id));
    const selectedTeams = selectedIds
      .map((id) => teamById.get(id))
      .filter((team): team is FixtureTeam => Boolean(team) && !optionIds.has(team.id));
    return [...teamsList, ...selectedTeams];
  };

  const renderFixtureTeamScopeControls = (
    scope: FixtureTeamScope,
    onChange: (nextScope: FixtureTeamScope) => void,
  ) => {
    const options = getFixtureTeamScopeOptions(scope);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Association</Label>
          <Select
            value={scope.associationId}
            onValueChange={(associationId) => onChange({ associationId, divisionId: ALL_CASCADE_VALUE })}
          >
            <SelectTrigger className="h-10 w-full min-w-0 overflow-hidden px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CASCADE_VALUE}>All associations</SelectItem>
              {allAssociations.map((association) => (
                <SelectItem key={association.id} value={association.id}>
                  {association.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Division</Label>
          <Select
            value={scope.divisionId}
            onValueChange={(divisionId) => onChange({ ...scope, divisionId })}
            disabled={scope.associationId === ALL_CASCADE_VALUE}
          >
            <SelectTrigger className="h-10 w-full min-w-0 overflow-hidden px-3">
              <SelectValue placeholder={scope.associationId === ALL_CASCADE_VALUE ? "Select association first" : undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CASCADE_VALUE}>All divisions</SelectItem>
              {options.divisions.map((division) => (
                <SelectItem key={division.id} value={division.id}>
                  {division.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const sortPlayers = (a: RevSportsPlayer, b: RevSportsPlayer) => {
      if (a.is_fillin !== b.is_fillin) return a.is_fillin ? 1 : -1;
      const numA = parseInt(a.jersey, 10);
      const numB = parseInt(b.jersey, 10);
      const hasA = !isNaN(numA);
      const hasB = !isNaN(numB);
      if (hasA && hasB) return numA - numB;
      if (hasA) return -1;
      if (hasB) return 1;
      return (a.player_name || "").localeCompare(b.player_name || "");
  };

  const homePlayers = rosterPlayers
    .filter((p) => p.team_side === "home" && p.attended === true)
    .sort(sortPlayers);

  const awayPlayers = rosterPlayers
    .filter((p) => p.team_side === "away" && p.attended === true)
    .sort(sortPlayers);

  const umpire1 = rosterPlayers.length > 0 ? rosterPlayers[0].umpire_1 : null;
  const umpire2 = rosterPlayers.length > 0 ? rosterPlayers[0].umpire_2 : null;

  const filteredFixtures = fixtures.filter((fixture) => {
    const matchesStatus = filterStatus === "ALL" || fixture.status === filterStatus;
    const matchesRound = !filterRound || fixture.round_number?.toString() === filterRound;
    const homeTeamInfo = teamById.get(fixture.home_team_id);
    const awayTeamInfo = fixture.away_team_id ? teamById.get(fixture.away_team_id) : null;
    const fixtureTeams = [homeTeamInfo, awayTeamInfo].filter(Boolean) as FixtureTeam[];
    const matchesAssociation =
      fixtureCascade.associationId === ALL_CASCADE_VALUE ||
      fixtureTeams.some((team) => clubById.get(team.club_id)?.association_id === fixtureCascade.associationId);
    const matchesClub =
      fixtureCascade.clubId === ALL_CASCADE_VALUE ||
      fixtureTeams.some((team) => team.club_id === fixtureCascade.clubId);
    const matchesDivision =
      fixtureCascade.divisionId === ALL_CASCADE_VALUE ||
      fixtureTeams.some((team) => team.division_id === fixtureCascade.divisionId);
    const matchesTeam =
      fixtureCascade.teamId === ALL_CASCADE_VALUE ||
      fixture.home_team_id === fixtureCascade.teamId ||
      fixture.away_team_id === fixtureCascade.teamId;
    return matchesStatus && matchesRound && matchesAssociation && matchesClub && matchesDivision && matchesTeam;
  });
  const displayFixtures = fixtureSort ? stableSortRows(filteredFixtures, fixtureSort, (fixture, key) => {
    const team = allAssocTeams.find((item) => item.id === fixture.home_team_id);
    if (key === "date") return fixture.fixture_date;
    if (key === "association") return team?.associationName;
    if (key === "division") return team?.divisionName;
    if (key === "home") return getTeamLabel(fixture.home_team_id, fixture.home_team?.name || "Unknown");
    if (key === "away") return getTeamLabel(fixture.away_team_id, fixture.away_team?.name || "BYE");
    if (key === "round") return fixture.round_number;
    if (key === "venue") return getFixtureLocationLabel(fixture);
    if (key === "status") return fixture.status;
    return fixture.home_score === null || fixture.away_score === null ? null : `${fixture.home_score}-${fixture.away_score}`;
  }) : filteredFixtures;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-foreground">
            FIXTURES MANAGEMENT
          </h1>
          <p className="text-muted-foreground mt-1">
            Import, edit, and manage fixtures across teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/fixture-import")} className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={displayFixtures.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Export ({displayFixtures.length})
          </Button>
          <Button
            onClick={() => {
              setAddTeamScope(emptyFixtureTeamScope);
              setAddForm(emptyForm);
              setAddDialogOpen(true);
              rememberFixtureDialog({ type: "add" });
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminCascadeFilters
          associations={fixtureCascadeOptions.associations}
          clubs={allClubs}
          divisions={allDivisions}
          teams={allAssocTeams}
          value={fixtureCascade}
          onChange={setFixtureCascade}
          className="contents"
          triggerClassName="w-full min-w-0 overflow-hidden"
        />
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="POSTPONED">Postponed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Round</Label>
          <Input
            className="h-9 w-full"
            type="number"
            placeholder="All"
            value={filterRound}
            onChange={(event) => setFilterRound(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
        </div>
      ) : displayFixtures.length === 0 ? (
        <Card variant="ghost" className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No fixtures found. Import fixtures or add one manually.
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {displayFixtures.length} Fixture{displayFixtures.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Date" sortKey="date" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Association" sortKey="association" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Division" sortKey="division" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Home Team" sortKey="home" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Away Team" sortKey="away" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Round" sortKey="round" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Venue" sortKey="venue" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Status" sortKey="status" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <SortableTableHead label="Score" sortKey="score" sort={fixtureSort} onSort={(key) => setFixtureSort(nextSortState(fixtureSort, key))} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayFixtures.map((fixture) => {
                    const date = fixture.fixture_date ? new Date(fixture.fixture_date) : null;
                    const tz = "Australia/Melbourne";
                    const isBye = isByeFixture(fixture);
                    const venueName = getFixtureLocationLabel(fixture);
                    const statusLabel = formatStatusLabel(getFixtureDisplayStatus({
                      fixtureDate: fixture.fixture_date,
                      status: fixture.status,
                      homeTeam: fixture.home_team,
                      awayTeam: fixture.away_team,
                    }));

                    return (
                      <TableRow key={fixture.id}>
                        <TableCell className="whitespace-nowrap text-foreground">
                          {date ? (
                            <div className="flex flex-col">
                              <span>{date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", timeZone: tz })}</span>
                              {!isBye && (
                                <span className="text-xs text-muted-foreground">
                                  {date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: tz })}
                                </span>
                              )}
                            </div>
                          ) : "TBD"}
                        </TableCell>
                        <TableCell>
                          {allAssocTeams.find((t) => t.id === fixture.home_team_id)?.associationName ?? "-"}
                        </TableCell>
                        <TableCell>
                          {allAssocTeams.find((t) => t.id === fixture.home_team_id)?.divisionName ?? "-"}
                        </TableCell>
                        <TableCell>
                          {getTeamLabel(fixture.home_team_id, fixture.home_team?.name ?? "Unknown")}
                        </TableCell>
                        <TableCell>
                          {getTeamLabel(fixture.away_team_id, fixture.away_team?.name ?? "BYE")}
                        </TableCell>
                        <TableCell>
                          {fixture.round_number ?? "-"}
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground truncate max-w-[150px] block">{venueName}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{statusLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          {isBye
                            ? "Bye"
                            : fixture.home_score !== null && fixture.away_score !== null
                              ? `${fixture.home_score}-${fixture.away_score}`
                              : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetails(fixture)} aria-label="View match details" title="View match details">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(fixture)} aria-label="Edit fixture" title="Edit fixture"><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteTarget(fixture.id); setDeleteDialogOpen(true); rememberFixtureDialog({ type: "delete", fixtureId: fixture.id }); }} aria-label="Delete fixture" title="Delete fixture"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => open && setDeleteDialogOpen(true)}>
        <DialogContent className="[&>button.absolute]:hidden">
          <DialogHeader>
            <DialogTitle>Delete Fixture</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { forgetFixtureDialog(); setDeleteDialogOpen(false); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={(open) => open && setAddDialogOpen(true)}>
        <DialogContent
          className="[&>button.absolute]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add Fixture</DialogTitle>
            <DialogDescription>Manually create a single fixture.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {renderFixtureTeamScopeControls(addTeamScope, (nextScope) => {
              setAddTeamScope(nextScope);
              setAddForm((form) => ({ ...form, home_team_id: "", away_team_id: "" }));
            })}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Home Team *</Label>
                {renderTeamSelect(
                  addForm.home_team_id,
                  (value) => setAddForm((form) => ({ ...form, home_team_id: value })),
                  addTeamScope.divisionId === ALL_CASCADE_VALUE ? "Select division first" : "Select home team",
                  addTeamScopeOptions.teams,
                  false,
                  addTeamScope.divisionId === ALL_CASCADE_VALUE,
                )}
              </div>
              <div className="space-y-2">
                <Label>Away Team</Label>
                {renderTeamSelect(
                  addForm.away_team_id,
                  (value) => setAddForm((form) => ({ ...form, away_team_id: value })),
                  addTeamScope.divisionId === ALL_CASCADE_VALUE ? "Select division first" : "Select away team or BYE",
                  addTeamScopeOptions.teams,
                  true,
                  addTeamScope.divisionId === ALL_CASCADE_VALUE,
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={addForm.fixture_date} onChange={(event) => setAddForm((form) => ({ ...form, fixture_date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={addForm.game_time} onChange={(event) => setAddForm((form) => ({ ...form, game_time: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Exact finish override</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  aria-label="Exact finish date"
                  type="date"
                  value={addForm.scheduled_end_date}
                  onChange={(event) => setAddForm((form) => ({ ...form, scheduled_end_date: event.target.value }))}
                />
                <Input
                  aria-label="Exact finish time"
                  type="time"
                  value={addForm.scheduled_end_time}
                  onChange={(event) => setAddForm((form) => ({ ...form, scheduled_end_time: event.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Optional. Leave blank to use the division or association duration.</p>
            </div>
            <div className="space-y-2">
              <Label>Round</Label>
              <Input type="number" value={addForm.round_number} onChange={(event) => setAddForm((form) => ({ ...form, round_number: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Venue</Label>
                <Select value={addForm.venue_id || "__none__"} onValueChange={(value) => setAddForm((form) => ({ ...form, venue_id: value === "__none__" ? "" : value, pitch_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pitch</Label>
                <Select disabled={!addForm.venue_id} value={addForm.pitch_id || "__none__"} onValueChange={(value) => setAddForm((form) => ({ ...form, pitch_id: value === "__none__" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Select pitch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {pitches.filter((pitch) => pitch.venue_id === addForm.venue_id).map((pitch) => (
                      <SelectItem key={pitch.id} value={pitch.id}>{pitch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { forgetFixtureDialog(); setAddDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleAddFixture}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={(open) => open && setIsEditModalOpen(true)}>
        <DialogContent
          className="max-h-[90vh] max-w-3xl overflow-y-auto [&>button.absolute]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit Fixture</DialogTitle>
            <DialogDescription>Update fixture details.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-6">
            {/* Row 5: status, score and source link */}
            <div className="order-8 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-3">
              <Label className="text-sm font-medium">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm((form) => ({ ...form, status: value }))}
              >
                <SelectTrigger className="h-10 w-full min-w-0 px-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="POSTPONED">Postponed</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="order-5 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-6">
              {renderFixtureTeamScopeControls(editTeamScope, (nextScope) => {
                setEditTeamScope(nextScope);
                setEditForm((form) => ({ ...form, homeTeamId: "", awayTeamId: "" }));
              })}
            </div>

            {/* Row 1: round, date and time */}
            <div className="order-1 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-2">
              <Label className="text-sm font-medium">Round</Label>
              <Input
                type="number"
                value={editForm.round}
                onChange={(e) => setEditForm((form) => ({ ...form, round: e.target.value }))}
                className="h-10 w-full"
              />
            </div>
            <div className="order-6 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-3">
              <Label className="text-sm font-medium">Venue</Label>
              <Select
                value={editForm.venueId || "__none__"}
                onValueChange={(value) => setEditForm((form) => ({ ...form, venueId: value === "__none__" ? "" : value, pitchId: "" }))}
              >
                <SelectTrigger className="h-10 w-full min-w-0 px-3"><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="order-7 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-3">
              <Label className="text-sm font-medium">Pitch</Label>
              <Select
                disabled={!editForm.venueId}
                value={editForm.pitchId || "__none__"}
                onValueChange={(value) => setEditForm((form) => ({ ...form, pitchId: value === "__none__" ? "" : value }))}
              >
                <SelectTrigger className="h-10 w-full min-w-0 px-3">
                  <SelectValue placeholder="Select pitch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {pitches.filter((pitch) => pitch.venue_id === editForm.venueId).map((pitch) => (
                    <SelectItem key={pitch.id} value={pitch.id}>{pitch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: home and away teams */}
            <div className="order-8 grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/10 p-4 sm:grid-cols-2 md:col-span-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Home Team *</Label>
                {renderTeamSelect(
                  editForm.homeTeamId,
                  (value) => setEditForm((form) => ({ ...form, homeTeamId: value })),
                  editTeamScope.divisionId === ALL_CASCADE_VALUE ? "Select division first" : "Select home team",
                  includeSelectedTeams(editTeamScopeOptions.teams, [editForm.homeTeamId, editForm.awayTeamId]),
                  false,
                  editTeamScope.divisionId === ALL_CASCADE_VALUE,
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Away Team</Label>
                {renderTeamSelect(
                  editForm.awayTeamId,
                  (value) => setEditForm((form) => ({ ...form, awayTeamId: value })),
                  editTeamScope.divisionId === ALL_CASCADE_VALUE ? "Select division first" : "Select away team or BYE",
                  includeSelectedTeams(editTeamScopeOptions.teams, [editForm.homeTeamId, editForm.awayTeamId]),
                  true,
                  editTeamScope.divisionId === ALL_CASCADE_VALUE,
                )}
              </div>
            </div>

            {/* Date and time stay ordered beside round on desktop. */}
            <div className="order-2 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-2">
              <Label className="text-sm font-medium">Date *</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((form) => ({ ...form, date: e.target.value }))}
                className="h-10 w-full"
              />
            </div>
            <div className="order-3 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-2">
              <Label className="text-sm font-medium">Start Time</Label>
              <Input
                type="time"
                value={editForm.time}
                onChange={(e) => setEditForm((form) => ({ ...form, time: e.target.value }))}
                className="h-10 w-full"
              />
            </div>
            <div className="order-4 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-6">
              <Label className="text-sm font-medium">Exact finish override</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Exact finish date"
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((form) => ({ ...form, endDate: e.target.value }))}
                  className="h-10 w-full"
                />
                <Input
                  aria-label="Exact finish time"
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((form) => ({ ...form, endTime: e.target.value }))}
                  className="h-10 w-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">Optional. If the start moves and this value is unchanged, the same match length is kept.</p>
            </div>
            <div className="order-10 space-y-2 rounded-lg border border-border bg-muted/10 p-4 md:col-span-3">
              <Label className="text-sm font-medium">Score</Label>
              <div className="flex h-10 items-center gap-2">
                <Input
                  type="number"
                  value={editForm.homeScore}
                  onChange={(e) => setEditForm((form) => ({ ...form, homeScore: e.target.value }))}
                  className="h-10 w-20 text-center"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  value={editForm.awayScore}
                  onChange={(e) => setEditForm((form) => ({ ...form, awayScore: e.target.value }))}
                  className="h-10 w-20 text-center"
                />
              </div>
              {selectedFixture?.revsports_match_url && (
                <a
                  href={selectedFixture.revsports_match_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                >
                  View on RevSports
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { forgetFixtureDialog(); setIsEditModalOpen(false); }}>Cancel</Button>
            <Button onClick={handleUpdateFixture}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={(open) => open && setIsDetailsOpen(true)}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Match Details</DialogTitle>
            <DialogDescription>
              Captured RevSports data for this fixture.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
              <Skeleton className="h-8 w-2/3" />
            </div>
          ) : rosterPlayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No RevSports data captured for this match yet.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Context */}
              <div className="bg-muted/40 p-4 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                  <span>Round {detailsFixture?.round_number ?? "-"}</span>
                  <span>
                    {detailsFixture?.fixture_date
                      ? new Date(detailsFixture.fixture_date).toLocaleDateString("en-AU", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "Australia/Melbourne",
                        })
                      : "TBD"}
                  </span>
                  <span>{detailsFixture ? getFixtureLocationLabel(detailsFixture) : "TBD"}</span>
                </div>
                <div className="flex items-center justify-between font-display text-lg">
                  <span className="font-semibold">{detailsFixture?.home_team?.name ?? "Unknown"}</span>
                  <span className="font-bold bg-muted px-3 py-1 rounded-md">
                    {detailsFixture?.home_score !== null && detailsFixture?.away_score !== null
                      ? `${detailsFixture.home_score} – ${detailsFixture.away_score}`
                      : "vs"}
                  </span>
                  <span className="font-semibold text-right">{detailsFixture?.away_team?.name ?? "BYE"}</span>
                </div>
              </div>

              {/* Roster Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Home Team */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2 text-primary">
                    {detailsFixture?.home_team?.name ?? "Home Team"}
                  </h4>
                  {homePlayers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No home players registered</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
                      {homePlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between text-sm py-1 border-b border-border/20 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                              {player.jersey ? `#${player.jersey}` : "—"}
                            </span>
                            <span className="truncate font-medium">{player.player_name}</span>
                            {player.is_captain && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50">
                                C
                              </Badge>
                            )}
                            {player.is_fillin && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-200 text-blue-700 bg-blue-50">
                                Fill-in
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-xs">
                            {player.goals > 0 && (
                              <Badge className="bg-green-600 hover:bg-green-600 text-white font-semibold">
                                {player.goals} {player.goals === 1 ? "Goal" : "Goals"}
                              </Badge>
                            )}
                            {player.green_cards > 0 && (
                              <span className="w-4 h-5 bg-green-500 rounded flex items-center justify-center text-[10px] text-white font-bold" title="Green Card">
                                {player.green_cards}
                              </span>
                            )}
                            {player.yellow_cards > 0 && (
                              <span className="w-4 h-5 bg-yellow-500 rounded flex items-center justify-center text-[10px] text-black font-bold" title="Yellow Card">
                                {player.yellow_cards}
                              </span>
                            )}
                            {player.red_cards > 0 && (
                              <span className="w-4 h-5 bg-red-600 rounded flex items-center justify-center text-[10px] text-white font-bold" title="Red Card">
                                {player.red_cards}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Away Team */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2 text-primary text-right md:text-left">
                    {detailsFixture?.away_team?.name ?? "Away Team"}
                  </h4>
                  {awayPlayers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No away players registered</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
                      {awayPlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between text-sm py-1 border-b border-border/20 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                              {player.jersey ? `#${player.jersey}` : "—"}
                            </span>
                            <span className="truncate font-medium">{player.player_name}</span>
                            {player.is_captain && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50">
                                C
                              </Badge>
                            )}
                            {player.is_fillin && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-200 text-blue-700 bg-blue-50">
                                Fill-in
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-xs">
                            {player.goals > 0 && (
                              <Badge className="bg-green-600 hover:bg-green-600 text-white font-semibold">
                                {player.goals} {player.goals === 1 ? "Goal" : "Goals"}
                              </Badge>
                            )}
                            {player.green_cards > 0 && (
                              <span className="w-4 h-5 bg-green-500 rounded flex items-center justify-center text-[10px] text-white font-bold" title="Green Card">
                                {player.green_cards}
                              </span>
                            )}
                            {player.yellow_cards > 0 && (
                              <span className="w-4 h-5 bg-yellow-500 rounded flex items-center justify-center text-[10px] text-black font-bold" title="Yellow Card">
                                {player.yellow_cards}
                              </span>
                            )}
                            {player.red_cards > 0 && (
                              <span className="w-4 h-5 bg-red-600 rounded flex items-center justify-center text-[10px] text-white font-bold" title="Red Card">
                                {player.red_cards}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Umpires Section */}
              {(umpire1 || umpire2) && (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">Match Umpires</h4>
                  <div className="flex gap-4 text-sm font-medium">
                    {umpire1 && (
                      <div className="bg-muted px-3 py-1.5 rounded-md flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Umpire 1:</span>
                        {umpire1}
                      </div>
                    )}
                    {umpire2 && (
                      <div className="bg-muted px-3 py-1.5 rounded-md flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Umpire 2:</span>
                        {umpire2}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => { forgetFixtureDialog(); setIsDetailsOpen(false); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixturesManagement;
