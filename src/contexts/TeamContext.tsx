/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useMemo, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Association {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  primary_colour?: string | null;
  secondary_colour?: string | null;
}

interface Club {
  id: string;
  association_id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  home_ground: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  banner_url: string | null;
}

interface Team {
  id: string;
  club_id: string;
  name: string;
  logo_url?: string | null;
  banner_url?: string | null;
  primary_colour?: string | null;
  secondary_colour?: string | null;
  age_group: string | null;
  gender: string | null;
  division: string | null;
  division_id?: string | null;
}

interface Division {
  id: string;
  association_id: string;
  name: string;
}

interface TeamDivision {
  team_id: string;
  division_id: string;
}

export interface TeamScopeSelection {
  associationId: string;
  clubId: string;
  divisionId: string;
  teamId: string;
}

interface TeamContextType {
  associations: Association[];
  clubs: Club[];
  teams: Team[];
  divisions: Division[];
  teamDivisions: TeamDivision[];
  selectedAssociationId: string;
  selectedClubId: string;
  selectedTeamId: string;
  selectedDivision: string;
  setSelectedAssociationId: (id: string) => void;
  setSelectedClubId: (id: string) => void;
  setSelectedTeamId: (id: string) => void;
  setSelectedDivision: (d: string) => void;
  setSelectedScope: (scope: TeamScopeSelection) => void;
  filteredClubs: Club[];
  filteredTeams: Team[];
  filteredDivisions: Division[];
  selectedAssociation: Association | undefined;
  selectedClub: Club | undefined;
  selectedTeam: Team | undefined;
  loading: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

const selectionKey = (userId: string, key: "association" | "club" | "division" | "team") =>
  `team_context:${userId}:${key}`;

const hexToHsl = (hex?: string | null) => {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    if (max === green) hue = (blue - red) / delta + 2;
    if (max === blue) hue = (red - green) / delta + 4;
    hue /= 6;
  }

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<TeamDivision[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setSelectedAssociationId("");
      setSelectedClubId("");
      setSelectedTeamId("");
      setSelectedDivision("");
      return;
    }

    setSelectedAssociationId(localStorage.getItem(selectionKey(user.id, "association")) || "");
    setSelectedClubId(localStorage.getItem(selectionKey(user.id, "club")) || "");
    setSelectedDivision(localStorage.getItem(selectionKey(user.id, "division")) || "");
    setSelectedTeamId(localStorage.getItem(selectionKey(user.id, "team")) || "");
  }, [user?.id]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [assocRes, clubRes, teamRes, tdRes] = await Promise.all([
        supabase.from("associations").select("*").order("name"),
        supabase.from("clubs").select("*").order("name"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("team_divisions" as any).select("*"),
      ]);

      const assocs = assocRes.data || [];
      const allClubs = clubRes.data || [];
      const allTeams = teamRes.data || [];
      const allTeamDivisions = (tdRes.data as any) || [];
      const allDivs: Division[] = [];

      setAssociations(assocs);
      setClubs(allClubs);
      setTeams(allTeams);
      setDivisions(allDivs);
      setTeamDivisions(allTeamDivisions);

      // No auto-select - selectors start empty, mode determines what's shown

      setLoading(false);
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const associationId = selectedAssociationId || clubs.find(c => c.id === selectedClubId)?.association_id;
    if (!associationId) {
      setDivisions([]);
      return;
    }

    const fetchDivisions = async () => {
      setLoading(true);
      const { data, error } = (await supabase
        .from("divisions" as any)
        .select("*")
        .eq("association_id", associationId)) as any;

      if (error) {
        console.error("Error fetching divisions:", error);
        setDivisions([]);
      } else {
        setDivisions(data || []);
      }

      setLoading(false);
    };

    fetchDivisions();
  }, [selectedAssociationId, selectedClubId, clubs]);

  const filteredClubs = clubs.filter(c => c.association_id === selectedAssociationId);

  const filteredDivisions = useMemo(() => {
    if (!selectedClubId) return selectedAssociationId ? divisions : [];
    const clubTeams = teams.filter((team) => team.club_id === selectedClubId);
    const clubTeamIds = new Set(clubTeams.map((team) => team.id));
    const activeDivisionIds = new Set(
      teamDivisions.filter((item) => clubTeamIds.has(item.team_id)).map((item) => item.division_id),
    );
    clubTeams.forEach((team) => {
      if (team.division_id) activeDivisionIds.add(team.division_id);
    });
    return divisions.filter((division) => activeDivisionIds.has(division.id));
  }, [divisions, selectedAssociationId, selectedClubId, teamDivisions, teams]);

  // Filter teams by club AND verify they belong to the selected division via team_divisions
  const filteredTeams = useMemo(() => teams.filter((team) => {
    if (team.club_id !== selectedClubId) return false;
    if (selectedDivision) {
      const isInDivision = team.division_id === selectedDivision
        || teamDivisions.some((item) => item.team_id === team.id && item.division_id === selectedDivision);
      if (!isInDivision) return false;
    }
    return true;
  }), [selectedClubId, selectedDivision, teamDivisions, teams]);

  const handleAssociationChange = useCallback((id: string) => {
    setSelectedAssociationId(id);
    if (user?.id) {
      if (id) localStorage.setItem(selectionKey(user.id, "association"), id);
      else localStorage.removeItem(selectionKey(user.id, "association"));
    }

    setSelectedClubId("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "club"));

    setSelectedTeamId("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "team"));

    setSelectedDivision("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "division"));
  }, [user?.id]);

  const handleClubChange = useCallback((id: string) => {
    setSelectedClubId(id);
    if (user?.id) {
      if (id) localStorage.setItem(selectionKey(user.id, "club"), id);
      else localStorage.removeItem(selectionKey(user.id, "club"));
    }

    setSelectedTeamId("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "team"));

    setSelectedDivision("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "division"));
  }, [user?.id]);

  const handleDivisionChange = useCallback((divisionId: string) => {
    setSelectedDivision(divisionId);
    if (user?.id) {
      if (divisionId) localStorage.setItem(selectionKey(user.id, "division"), divisionId);
      else localStorage.removeItem(selectionKey(user.id, "division"));
    }

    setSelectedTeamId("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "team"));
  }, [user?.id]);

  const handleTeamChange = useCallback((id: string) => {
    setSelectedTeamId(id);
    if (user?.id) {
      if (id) localStorage.setItem(selectionKey(user.id, "team"), id);
      else localStorage.removeItem(selectionKey(user.id, "team"));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!selectedAssociationId) return;
    if (!associations.some((association) => association.id === selectedAssociationId)) {
      handleAssociationChange("");
    }
  }, [associations, handleAssociationChange, selectedAssociationId]);

  useEffect(() => {
    if (!selectedClubId) return;
    const selectedClub = clubs.find((club) => club.id === selectedClubId);
    if (!selectedClub || (selectedAssociationId && selectedClub.association_id !== selectedAssociationId)) {
      handleClubChange("");
    }
  }, [clubs, handleClubChange, selectedAssociationId, selectedClubId]);

  useEffect(() => {
    if (!selectedDivision) return;
    if (filteredDivisions.length > 0 && !filteredDivisions.some((division) => division.id === selectedDivision)) {
      handleDivisionChange("");
    }
  }, [filteredDivisions, handleDivisionChange, selectedDivision]);

  useEffect(() => {
    if (!selectedTeamId) return;
    if (filteredTeams.length > 0 && !filteredTeams.some((team) => team.id === selectedTeamId)) {
      handleTeamChange("");
    }
  }, [filteredTeams, handleTeamChange, selectedTeamId]);

  // Team switching needs to change the full cascade together. Calling each
  // normal setter in sequence clears the levels below it and causes visible
  // bouncing between the old team, no team and the new team.
  const handleScopeChange = useCallback((scope: TeamScopeSelection) => {
    setSelectedAssociationId(scope.associationId);
    setSelectedClubId(scope.clubId);
    setSelectedDivision(scope.divisionId);
    setSelectedTeamId(scope.teamId);

    if (!user?.id) return;
    const values = {
      association: scope.associationId,
      club: scope.clubId,
      division: scope.divisionId,
      team: scope.teamId,
    } as const;
    for (const [key, value] of Object.entries(values)) {
      const storageKey = selectionKey(user.id, key as keyof typeof values);
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    }
  }, [user?.id]);

  const selectedAssociation = associations.find(a => a.id === selectedAssociationId);
  const selectedClub = clubs.find(c => c.id === selectedClubId);
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  useEffect(() => {
    const root = document.documentElement;
    const primary = hexToHsl(
      selectedTeam?.primary_colour || selectedClub?.primary_colour || selectedAssociation?.primary_colour,
    );
    const secondary = hexToHsl(
      selectedTeam?.secondary_colour || selectedClub?.secondary_colour || selectedAssociation?.secondary_colour,
    );
    const properties = [
      "--primary",
      "--primary-foreground",
      "--accent",
      "--accent-foreground",
      "--secondary",
      "--secondary-foreground",
      "--ring",
      "--sidebar",
      "--sidebar-background",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent-foreground",
      "--sidebar-ring",
      "--gradient-hero",
      "--gradient-accent",
    ];

    properties.forEach((property) => root.style.removeProperty(property));
    if (!primary) return;

    const foreground = secondary || "0 0% 100%";
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", foreground);
    root.style.setProperty("--accent", primary);
    root.style.setProperty("--accent-foreground", foreground);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar", primary);
    root.style.setProperty("--sidebar-background", primary);
    root.style.setProperty("--sidebar-foreground", foreground);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", foreground);
    root.style.setProperty("--sidebar-accent-foreground", foreground);
    root.style.setProperty("--sidebar-ring", foreground);
    root.style.setProperty("--gradient-hero", `linear-gradient(135deg, hsl(${primary}) 0%, hsl(${primary} / .82) 100%)`);
    root.style.setProperty("--gradient-accent", `linear-gradient(135deg, hsl(${primary}) 0%, hsl(${primary} / .78) 100%)`);

    if (secondary) {
      root.style.setProperty("--secondary", secondary);
      root.style.setProperty("--secondary-foreground", primary);
    }

    return () => {
      properties.forEach((property) => root.style.removeProperty(property));
    };
  }, [selectedAssociation, selectedClub, selectedTeam]);

  return (
    <TeamContext.Provider
      value={{
        associations,
        clubs,
        teams,
        divisions,
        teamDivisions,
        selectedAssociationId,
        selectedClubId,
        selectedTeamId,
        selectedDivision,
        setSelectedAssociationId: handleAssociationChange,
        setSelectedClubId: handleClubChange,
        setSelectedTeamId: handleTeamChange,
        setSelectedDivision: handleDivisionChange,
        setSelectedScope: handleScopeChange,
        filteredClubs,
        filteredTeams,
        filteredDivisions,
        selectedAssociation,
        selectedClub,
        selectedTeam,
        loading,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeamContext() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeamContext must be used within TeamProvider");
  }
  return context;
}
