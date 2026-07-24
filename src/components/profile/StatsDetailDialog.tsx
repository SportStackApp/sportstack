import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Target } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface PlayerGameRecord {
  id: string;
  date: string;
  teamName: string;
  clubName: string;
  associationName: string;
  opponent: string;
  location: string;
  result?: string;
}

export interface PlayerGoalRecord {
  id: string;
  date: string;
  gameId: string;
  teamName: string;
  clubName: string;
  associationName: string;
  opponent: string;
  minute?: number;
}

interface StatsDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "games" | "goals";
  games?: PlayerGameRecord[];
  goals?: PlayerGoalRecord[];
}

export const StatsDetailDialog = ({
  open,
  onOpenChange,
  type,
  games = [],
  goals = [],
}: StatsDetailDialogProps) => {
  const title = type === "games" ? "Games Played" : "Goals Scored";
  const count = type === "games" ? games.length : goals.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "games" ? (
              <Calendar className="h-5 w-5 text-accent" />
            ) : (
              <Target className="h-5 w-5 text-accent" />
            )}
            {title}
            <Badge variant="secondary" className="ml-2">
              {count}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {type === "games" ? (
            <div className="space-y-3">
              {games.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No games recorded yet
                </p>
              ) : (
                games.map((game) => (
                  <div
                    key={game.id}
                    className="p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm">
                          vs {game.opponent}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {game.teamName} • {game.clubName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {game.associationName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-foreground">
                          {new Date(game.date).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </p>
                        {game.result && (
                          <Badge
                            variant={
                              game.result.startsWith("W")
                                ? "default"
                                : game.result.startsWith("L")
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs mt-1"
                          >
                            {game.result}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {game.location}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No goals recorded yet
                </p>
              ) : (
                goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm">
                          vs {goal.opponent}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {goal.teamName} • {goal.clubName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {goal.associationName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-foreground">
                          {new Date(goal.date).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </p>
                        {goal.minute && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {goal.minute}'
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
