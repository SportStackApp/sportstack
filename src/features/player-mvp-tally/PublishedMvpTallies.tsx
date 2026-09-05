import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMvpTallyPresentations } from "./api";
import type { MvpTallyPresentationRecord } from "./types";

export function PublishedMvpTallies() {
  const [tallies, setTallies] = useState<MvpTallyPresentationRecord[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await listMvpTallyPresentations();
        if (active) setTallies(data.filter((item) => item.status === "PUBLISHED"));
      } catch (error) {
        // A missing migration should not stop normal Player MVP voting.
        console.error("Unable to load published Player MVP tallies", error);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  if (tallies.length === 0) return null;
  const [latest, ...earlier] = tallies;

  return (
    <section className="space-y-4" aria-labelledby="published-tallies-title">
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-amber-500/10 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <Badge className="gap-1"><Sparkles className="h-3 w-3" />New results</Badge>
            <Trophy className="h-8 w-8 text-amber-500" />
          </div>
          <CardTitle id="published-tallies-title" className="pt-3 text-2xl">{latest.title}</CardTitle>
          <CardDescription>{latest.subtitle || "Your team’s animated Player MVP tally is ready."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link to={`/mvp-votes/tallies/${latest.id}`}><Play className="mr-2 h-4 w-4" />Watch tally</Link></Button>
        </CardContent>
      </Card>

      {earlier.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Published tallies</CardTitle><CardDescription>Replay earlier Player MVP result presentations.</CardDescription></CardHeader>
          <CardContent className="divide-y rounded-md border p-0">
            {earlier.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0"><p className="truncate font-medium">{item.title}</p><p className="text-xs text-muted-foreground">Published {item.published_at ? new Date(item.published_at).toLocaleDateString("en-AU") : "recently"}</p></div>
                <Button asChild size="sm" variant="outline"><Link to={`/mvp-votes/tallies/${item.id}`}>Replay</Link></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
