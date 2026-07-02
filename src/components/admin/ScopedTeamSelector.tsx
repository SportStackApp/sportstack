import { useEffect, useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";

interface ScopedTeamSelectorProps {
  selectedTeamId: string;
  onTeamChange: (teamId: string) => void;
}

interface Association {
  id: string;
  name: string;
}

interface Club {
  id: string;
  name: string;
  association_id: string;
}

interface Team {
  id: string;
  name: string;
  club_id: string;
  division: string | null;
}

export const ScopedTeamSelector = ({
  selectedTeamId,
  onTeamChange,
}: ScopedTeamSelectorProps) => {
  const {
    loading: scopeLoading,
    isSuperAdmin,
    scopedAssociationIds,
    scopedClubIds,
    scopedTeamIds,
  } = useAdminScope();

  const [associations, setAssociations] = useState<Association[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");

  // Load reference data
  useEffect(() => {
    const load = async () => {
      const [aRes, cRes, tRes] = await Promise.all([
        supabase.from("associations").select("id, name").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("teams").select("id, name, club_id, division").order("name"),
      ]);
      setAssociations(aRes.data || []);
      setClubs(cRes.data || []);
      setTeams(tRes.data || []);
    };
    load();
  }, []);

  // Auto-lock selectors based on scope
  useEffect(() => {
    if (scopeLoading || teams.length === 0 || clubs.length === 0) return;

    if (!isSuperAdmin) {
      if (scopedAssociationIds.length === 1) {
        setSelectedAssociationId(scopedAssociationIds[0]);
      }
      if (scopedClubIds.length === 1) {
        setSelectedClubId(scopedClubIds[0]);
        const club = clubs.find((c) => c.id === scopedClubIds[0]);
        if (club) setSelectedAssociationId(club.association_id);
      }
      if (scopedTeamIds.length === 1) {
        const team = teams.find((t) => t.id === scopedTeamIds[0]);
        if (team) {
          setSelectedClubId(team.club_id);
          if (team.division) setSelectedDivision(team.division);
          onTeamChange(team.id);
          const club = clubs.find((c) => c.id === team.club_id);
          if (club) setSelectedAssociationId(club.association_id);
        }
      }
    }
  }, [scopeLoading, isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds, teams, clubs]);

  // Filter based on scope
  const availableAssociations = isSuperAdmin
    ? associations
    : associations.filter(
        (a) =>
          scopedAssociationIds.includes(a.id) ||
          clubs.some(
            (c) =>
              c.association_id === a.id &&
              (scopedClubIds.includes(c.id) ||
                teams.some((t) => t.club_id === c.id && scopedTeamIds.includes(t.id)))
          )
      );

  const availableClubs = clubs.filter((c) => {
    if (selectedAssociationId && c.association_id !== selectedAssociationId) return false;
    if (isSuperAdmin) return true;
    return (
      scopedClubIds.includes(c.id) ||
      scopedAssociationIds.includes(c.association_id) ||
      teams.some((t) => t.club_id === c.id && scopedTeamIds.includes(t.id))
    );
  });

  // Teams filtered by club and scope (before division filter)
  const clubFilteredTeams = teams.filter((t) => {
    if (selectedClubId && t.club_id !== selectedClubId) return false;
    if (isSuperAdmin) return true;
    return scopedTeamIds.includes(t.id);
  });

  // Distinct divisions from club-filtered teams
  const availableDivisions = useMemo(() => {
    const divs = new Set<string>();
    clubFilteredTeams.forEach((t) => {
      if (t.division) divs.add(t.division);
    });
    return Array.from(divs).sort();
  }, [clubFilteredTeams]);

  // Final team list filtered by division
  const availableTeams = selectedDivision
    ? clubFilteredTeams.filter((t) => t.division === selectedDivision)
    : [];

  const isAssociationLocked =
    !isSuperAdmin && scopedAssociationIds.length === 0 && scopedClubIds.length > 0;
  const isClubLocked =
    !isSuperAdmin &&
    scopedAssociationIds.length === 0 &&
    scopedClubIds.length <= 1 &&
    scopedTeamIds.length > 0;
  const isTeamLocked = !isSuperAdmin && scopedTeamIds.length === 1;

  const handleAssociationChange = (id: string) => {
    setSelectedAssociationId(id);
    setSelectedClubId("");
    setSelectedDivision("");
    onTeamChange("");
  };

  const handleClubChange = (id: string) => {
    setSelectedClubId(id);
    setSelectedDivision("");
    onTeamChange("");
  };

  const handleDivisionChange = (div: string) => {
    setSelectedDivision(div);
    onTeamChange("");
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2">
        <Label>Association</Label>
        <Select
          value={selectedAssociationId}
          onValueChange={handleAssociationChange}
          disabled={isAssociationLocked || availableAssociations.length <= 1}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select association" />
          </SelectTrigger>
          <SelectContent>
            {availableAssociations.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Club</Label>
        <Select
          value={selectedClubId}
          onValueChange={handleClubChange}
          disabled={isClubLocked || !selectedAssociationId || availableClubs.length <= 1}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select club" />
          </SelectTrigger>
          <SelectContent>
            {availableClubs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Division</Label>
        <Select
          value={selectedDivision}
          onValueChange={handleDivisionChange}
          disabled={!selectedClubId || availableDivisions.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select division" />
          </SelectTrigger>
          <SelectContent>
            {availableDivisions.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Team Name</Label>
        <Select
          value={selectedTeamId}
          onValueChange={onTeamChange}
          disabled={isTeamLocked || !selectedClubId || !selectedDivision}
        >
          <SelectTrigger>
            <SelectValue placeholder={!selectedDivision ? "Select division first" : "Select team"} />
          </SelectTrigger>
          <SelectContent>
            {availableTeams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
