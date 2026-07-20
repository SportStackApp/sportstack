import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_CASCADE_VALUE,
  getCascadeOptions,
  getTeamNameLabel,
  type CascadeAssociation,
  type CascadeClub,
  type CascadeDivision,
  type CascadeTeam,
  type CascadeValue,
} from "@/lib/adminCascade";

interface AdminCascadeFiltersProps {
  associations: CascadeAssociation[];
  clubs: CascadeClub[];
  divisions: CascadeDivision[];
  teams: CascadeTeam[];
  value: CascadeValue;
  onChange: (nextValue: CascadeValue) => void;
  disabledAssociation?: boolean;
  showTeam?: boolean;
  className?: string;
  triggerClassName?: string;
  labelClassName?: string;
  allLabels?: Partial<Record<keyof CascadeValue, string>>;
  getTeamLabel?: (team: CascadeTeam) => string;
}

export function AdminCascadeFilters({
  associations,
  clubs,
  divisions,
  teams,
  value,
  onChange,
  disabledAssociation = false,
  showTeam = true,
  className = "grid gap-3 md:grid-cols-2 xl:grid-cols-4",
  triggerClassName = "w-full min-w-0 overflow-hidden",
  labelClassName = "text-sm font-medium",
  allLabels,
  getTeamLabel = getTeamNameLabel,
}: AdminCascadeFiltersProps) {
  const options = getCascadeOptions({ associations, clubs, divisions, teams, value });
  const isClubDisabled = value.associationId === ALL_CASCADE_VALUE;
  const isDivisionDisabled = value.clubId === ALL_CASCADE_VALUE;
  const isTeamDisabled = value.clubId === ALL_CASCADE_VALUE || value.divisionId === ALL_CASCADE_VALUE;

  useEffect(() => {
    const nextValue = { ...value };

    if (value.associationId === ALL_CASCADE_VALUE) {
      nextValue.clubId = ALL_CASCADE_VALUE;
      nextValue.divisionId = ALL_CASCADE_VALUE;
      nextValue.teamId = ALL_CASCADE_VALUE;
    } else if (value.clubId !== ALL_CASCADE_VALUE && !options.clubs.some((club) => club.id === value.clubId)) {
      nextValue.clubId = ALL_CASCADE_VALUE;
      nextValue.divisionId = ALL_CASCADE_VALUE;
      nextValue.teamId = ALL_CASCADE_VALUE;
    }

    if (nextValue.clubId === ALL_CASCADE_VALUE) {
      nextValue.divisionId = ALL_CASCADE_VALUE;
      nextValue.teamId = ALL_CASCADE_VALUE;
    } else if (
      value.divisionId !== ALL_CASCADE_VALUE &&
      !options.divisions.some((division) => division.id === value.divisionId)
    ) {
      nextValue.divisionId = ALL_CASCADE_VALUE;
      nextValue.teamId = ALL_CASCADE_VALUE;
    }

    if (nextValue.divisionId === ALL_CASCADE_VALUE) {
      nextValue.teamId = ALL_CASCADE_VALUE;
    } else if (value.teamId !== ALL_CASCADE_VALUE && !options.teams.some((team) => team.id === value.teamId)) {
      nextValue.teamId = ALL_CASCADE_VALUE;
    }

    if (
      nextValue.associationId !== value.associationId ||
      nextValue.clubId !== value.clubId ||
      nextValue.divisionId !== value.divisionId ||
      nextValue.teamId !== value.teamId
    ) {
      onChange(nextValue);
    }
  }, [onChange, options.clubs, options.divisions, options.teams, value]);

  const updateAssociation = (associationId: string) => {
    onChange({
      associationId,
      clubId: ALL_CASCADE_VALUE,
      divisionId: ALL_CASCADE_VALUE,
      teamId: ALL_CASCADE_VALUE,
    });
  };

  const updateClub = (clubId: string) => {
    onChange({
      ...value,
      clubId,
      divisionId: ALL_CASCADE_VALUE,
      teamId: ALL_CASCADE_VALUE,
    });
  };

  const updateDivision = (divisionId: string) => {
    onChange({
      ...value,
      divisionId,
      teamId: ALL_CASCADE_VALUE,
    });
  };

  const updateTeam = (teamId: string) => {
    onChange({ ...value, teamId });
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label className={labelClassName}>Association</Label>
        <Select value={value.associationId} onValueChange={updateAssociation} disabled={disabledAssociation}>
          <SelectTrigger className={triggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CASCADE_VALUE}>{allLabels?.associationId || "All associations"}</SelectItem>
            {options.associations.map((association) => (
              <SelectItem key={association.id} value={association.id}>
                {association.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className={labelClassName}>Club</Label>
        <Select value={value.clubId} onValueChange={updateClub} disabled={isClubDisabled}>
          <SelectTrigger className={triggerClassName}>
            <SelectValue placeholder={isClubDisabled ? "Select association first" : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CASCADE_VALUE}>{allLabels?.clubId || "All clubs"}</SelectItem>
            {options.clubs.map((club) => (
              <SelectItem key={club.id} value={club.id}>
                {club.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className={labelClassName}>Division</Label>
        <Select value={value.divisionId} onValueChange={updateDivision} disabled={isDivisionDisabled}>
          <SelectTrigger className={triggerClassName}>
            <SelectValue placeholder={isDivisionDisabled ? "Select club first" : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CASCADE_VALUE}>{allLabels?.divisionId || "All divisions"}</SelectItem>
            {options.divisions.map((division) => (
              <SelectItem key={division.id} value={division.id}>
                {division.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showTeam && (
        <div className="space-y-2">
          <Label className={labelClassName}>Team</Label>
          <Select
            value={value.teamId}
            onValueChange={updateTeam}
            disabled={isTeamDisabled}
          >
            <SelectTrigger className={triggerClassName}>
              <SelectValue placeholder={isTeamDisabled ? "Select division first" : undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CASCADE_VALUE}>{allLabels?.teamId || "All teams"}</SelectItem>
              {options.teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {getTeamLabel(team)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
