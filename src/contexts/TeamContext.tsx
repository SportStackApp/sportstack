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

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<TeamDivision[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState(() => localStorage.getItem("selectedAssociationId") || "");
  const [selectedClubId, setSelectedClubId] = useState(() => localStorage.getItem("selectedClubId") || "");
  const [selectedTeamId, setSelectedTeamId] = useState(() => localStorage.getItem("selectedTeamId") || "");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [assocRes, clubRes, teamRes, tdRes] = await Promise.all([
        supabase.from("associations").select("*").order("name"),
        supabase.from("clubs").select("*").order("name"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("team_divisions").select("*"),
      ]);

      const assocs = assocRes.data || [];
      const allClubs = clubRes.data || [];
      const allTeams = teamRes.data || [];
      const allTeamDivisions = tdRes.data || [];
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
      const { data, error } = await supabase
        .from("divisions")
        .select("*")
        .eq("association_id", associationId);

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
      const isInDivision = teamDivisions.some(td => td.team_id === t.id && td.division_id === selectedDivision);
      if (!isInDivision) return false;
    }
    return true;
  });

  const handleAssociationChange = (id: string) => {
    setSelectedAssociationId(id);
    if (id) localStorage.setItem("selectedAssociationId", id);
    else localStorage.removeItem("selectedAssociationId");
    
    setSelectedClubId("");
    localStorage.removeItem("selectedClubId");
    
    setSelectedTeamId("");
    localStorage.removeItem("selectedTeamId");
    
    setSelectedDivision("");
  };

  const handleClubChange = (id: string) => {
    setSelectedClubId(id);
    if (id) localStorage.setItem("selectedClubId", id);
    else localStorage.removeItem("selectedClubId");
    
    setSelectedTeamId("");
    localStorage.removeItem("selectedTeamId");
    
    setSelectedDivision("");
  };

  const handleDivisionChange = (d: string) => {
    setSelectedDivision(d);
    setSelectedTeamId("");
    localStorage.removeItem("selectedTeamId");
  };

  const handleTeamChange = (id: string) => {
    setSelectedTeamId(id);
    if (id) localStorage.setItem("selectedTeamId", id);
    else localStorage.removeItem("selectedTeamId");
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
