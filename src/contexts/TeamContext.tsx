import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Association {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
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
  
  const clubTeamIds = selectedClubId ? teams.filter(t => t.club_id === selectedClubId).map(t => t.id) : [];
  const activeDivisionIds = new Set(
    teamDivisions.filter(td => clubTeamIds.includes(td.team_id)).map(td => td.division_id)
  );
  const filteredDivisions = selectedClubId
    ? divisions.filter(d => activeDivisionIds.has(d.id))
    : selectedAssociationId
      ? divisions
      : [];

  // Filter teams by club AND verify they belong to the selected division via team_divisions
  const filteredTeams = teams.filter(t => {
    if (t.club_id !== selectedClubId) return false;
    if (selectedDivision) {
      const isInDivision = t.division_id === selectedDivision || teamDivisions.some(td => td.team_id === t.id && td.division_id === selectedDivision);
      if (!isInDivision) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!selectedAssociationId) return;
    if (!associations.some((association) => association.id === selectedAssociationId)) {
      handleAssociationChange("");
    }
  }, [associations, selectedAssociationId]);

  useEffect(() => {
    if (!selectedClubId) return;
    const selectedClub = clubs.find((club) => club.id === selectedClubId);
    if (!selectedClub || (selectedAssociationId && selectedClub.association_id !== selectedAssociationId)) {
      handleClubChange("");
    }
  }, [clubs, selectedAssociationId, selectedClubId]);

  useEffect(() => {
    if (!selectedDivision) return;
    if (filteredDivisions.length > 0 && !filteredDivisions.some((division) => division.id === selectedDivision)) {
      handleDivisionChange("");
    }
  }, [filteredDivisions, selectedDivision]);

  useEffect(() => {
    if (!selectedTeamId) return;
    if (filteredTeams.length > 0 && !filteredTeams.some((team) => team.id === selectedTeamId)) {
      handleTeamChange("");
    }
  }, [filteredTeams, selectedTeamId]);

  const handleAssociationChange = (id: string) => {
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
  };

  const handleClubChange = (id: string) => {
    setSelectedClubId(id);
    if (user?.id) {
      if (id) localStorage.setItem(selectionKey(user.id, "club"), id);
      else localStorage.removeItem(selectionKey(user.id, "club"));
    }
    
    setSelectedTeamId("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "team"));
    
    setSelectedDivision("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "division"));
  };

  const handleDivisionChange = (d: string) => {
    setSelectedDivision(d);
    if (user?.id) {
      if (d) localStorage.setItem(selectionKey(user.id, "division"), d);
      else localStorage.removeItem(selectionKey(user.id, "division"));
    }

    setSelectedTeamId("");
    if (user?.id) localStorage.removeItem(selectionKey(user.id, "team"));
  };

  const handleTeamChange = (id: string) => {
    setSelectedTeamId(id);
    if (user?.id) {
      if (id) localStorage.setItem(selectionKey(user.id, "team"), id);
      else localStorage.removeItem(selectionKey(user.id, "team"));
    }
  };

  const selectedAssociation = associations.find(a => a.id === selectedAssociationId);
  const selectedClub = clubs.find(c => c.id === selectedClubId);
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

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
