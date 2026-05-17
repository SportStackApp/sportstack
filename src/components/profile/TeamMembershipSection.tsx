import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, RefreshCw, Calendar, Shirt, Plus, X } from "lucide-react";

interface TeamMembership {
  teamId: string;
  teamName: string;
  clubId: string;
  clubName: string;
  associationId: string;
  associationName: string;
  type: "PRIMARY" | "PERMANENT" | "FILL_IN";
  position?: string;
  jerseyNumber?: number;
  gameDate?: string;
}

interface PendingAdditionalTeam {
  id: string;
  teamId: string;
  teamName: string;
  clubName: string;
  type: string;
}

interface PendingChangeRequest {
  id: string;
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string;
  toTeamName: string;
  status: string;
  requestedAt: string;
}

interface TeamMembershipSectionProps {
  primaryTeam: TeamMembership | null;
  extraTeams: TeamMembership[];
  pendingChangeRequest: PendingChangeRequest | null;
  pendingPrimaryRequest?: { id: string; teamId: string; teamName: string; clubName: string; type: string; };
  onRequestChange: () => void;
  onCancelRequest?: () => void;
  onSetPrimaryTeam?: () => void;
  pendingAdditionalTeams?: Array<{id: string; teamId: string; teamName: string; clubName: string; type: string;}>;
  onCancelAdditionalRequest?: (id: string) => void;
  onRequestAdditionalTeam?: () => void;
  onConfirmChange?: () => void;
  hasApprovedTeams: boolean;
}

export const TeamMembershipSection = ({
  primaryTeam,
  extraTeams,
  pendingChangeRequest,
  pendingPrimaryRequest,
  onRequestChange,
  onCancelRequest,
  onSetPrimaryTeam,
  pendingAdditionalTeams = [],
  onCancelAdditionalRequest,
  onRequestAdditionalTeam,
  onConfirmChange,
  hasApprovedTeams,
}: TeamMembershipSectionProps) => {
  return (
    <div className="space-y-4">
      {/* Primary Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Primary Team</CardTitle>
          {primaryTeam && !pendingChangeRequest && (
            <Button variant="outline" size="sm" onClick={onRequestChange}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Request Change
            </Button>
          )}
          {!primaryTeam && !pendingChangeRequest && onSetPrimaryTeam && (
            <Button variant="outline" size="sm" onClick={onSetPrimaryTeam}>
              <Plus className="h-4 w-4 mr-2" />
              Set Primary Team
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {primaryTeam ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{primaryTeam.teamName}</p>
                <p className="text-sm text-muted-foreground">
                  {primaryTeam.clubName} • {primaryTeam.associationName}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {primaryTeam.position && (
                    <Badge variant="secondary" className="text-xs">
                      {primaryTeam.position}
                    </Badge>
                  )}
                  {primaryTeam.jerseyNumber && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shirt className="h-3 w-3" />#{primaryTeam.jerseyNumber}
                    </div>
                  )}
                </div>
              </div>
              <Badge variant="default">Primary</Badge>
            </div>
          ) : (
            <div className="text-center py-6">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No primary team</p>
              <p className="text-sm text-muted-foreground mt-1">
                {"Click \u0027Set Primary Team\u0027 above to choose your main team"}
              </p>
            </div>
          )}

          {/* Pending / Admin-Approved Change Request */}
          {pendingChangeRequest && (
            <div className="mt-4 p-3 bg-muted rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">
                    {pendingChangeRequest.status === "ADMIN_APPROVED"
                      ? "Change Approved — Confirm to Complete"
                      : "Change Request Pending"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {pendingChangeRequest.status === "ADMIN_APPROVED" && onConfirmChange && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 px-3"
                      onClick={onConfirmChange}
                    >
                      Confirm Change
                    </Button>
                  )}
                  {onCancelRequest && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={onCancelRequest}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingChangeRequest.fromTeamName
                  ? `Requesting to change from ${pendingChangeRequest.fromTeamName} to ${pendingChangeRequest.toTeamName}`
                  : `Requesting to set ${pendingChangeRequest.toTeamName} as primary`}
              </p>
            </div>
          )}

          {/* Pending primary request from team invite */}
          {pendingPrimaryRequest && (
            <div className="mt-4 p-3 bg-muted rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{pendingPrimaryRequest.teamName}</p>
                    <p className="text-xs text-muted-foreground">{pendingPrimaryRequest.clubName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                    Pending
                  </Badge>
                  {onCancelAdditionalRequest && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onCancelAdditionalRequest(pendingPrimaryRequest.id)}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extra Teams */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Additional Teams</CardTitle>
          {onRequestAdditionalTeam && (
            <Button variant="outline" size="sm" onClick={onRequestAdditionalTeam}>
              <Plus className="h-4 w-4 mr-2" />
              Request Team
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {extraTeams.length > 0 ? (
            <div className="space-y-3">
              {extraTeams.map((team, index) => (
                <div
                  key={`${team.teamId}-${index}`}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{team.teamName}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.clubName} • {team.associationName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {team.position && (
                        <span className="text-xs text-muted-foreground">{team.position}</span>
                      )}
                      {team.jerseyNumber && (
                        <span className="text-xs text-muted-foreground">
                          • #{team.jerseyNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={team.type === "FILL_IN" ? "outline" : "secondary"}
                      className="text-xs"
                    >
                      {team.type === "FILL_IN" ? "Fill-in" : "Permanent"}
                    </Badge>
                    {team.type === "FILL_IN" && team.gameDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(team.gameDate).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            pendingAdditionalTeams.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No additional team memberships
              </p>
            )
          )}

          {/* Pending additional team requests */}
          {pendingAdditionalTeams.length > 0 && (
            <div className={`space-y-2 ${extraTeams.length > 0 ? "mt-3 border-t border-border pt-3" : ""}`}>
              {pendingAdditionalTeams.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{req.teamName}</p>
                      <p className="text-xs text-muted-foreground">{req.clubName} � Request pending approval</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                      Pending
                    </Badge>
                    {onCancelAdditionalRequest && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onCancelAdditionalRequest(req.id)}>
                        <X className="h-4 w-4 mr-1" />Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
