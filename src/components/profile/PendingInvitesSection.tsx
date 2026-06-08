import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, Clock, User, Check, X } from "lucide-react";
import type { TeamInvite } from "@/lib/mockData";

interface PendingInvitesSectionProps {
  invites: TeamInvite[];
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
}

export const PendingInvitesSection = ({
  invites,
  onAccept,
  onDecline,
}: PendingInvitesSectionProps) => {
  const pendingInvites = invites.filter((inv) => inv.status === "PENDING");

  if (pendingInvites.length === 0) {
    return null;
  }

  const getDaysUntilExpiry = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card className="border-accent border-2">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">Pending Invites</CardTitle>
          <Badge variant="default" className="ml-auto text-xs">
            {pendingInvites.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {pendingInvites.map((invite) => {
          const daysLeft = getDaysUntilExpiry(invite.expiresAt);
          const isUrgent = daysLeft <= 3;

          return (
            <div
              key={invite.id}
              className="p-3 bg-muted/50 rounded-lg border border-border"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm truncate">
                      {invite.teamName}
                    </p>
                    <Badge
                      variant={invite.type === "FILL_IN" ? "outline" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {invite.type === "FILL_IN" ? "Fill-in" : "Secondary"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    <span>{invite.clubName}</span>
                    {invite.type === "FILL_IN" && invite.gameDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(invite.gameDate).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {invite.sentBy}
                    </span>
                    <span
                      className={`flex items-center gap-1 ${
                        isUrgent ? "text-destructive" : ""
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {daysLeft > 0 ? `${daysLeft}d` : "Today"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => onAccept(invite.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3"
                    onClick={() => onDecline(invite.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
