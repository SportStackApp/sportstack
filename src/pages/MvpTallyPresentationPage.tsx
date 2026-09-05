import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMvpTallyPresentation } from "@/features/player-mvp-tally/api";
import { MvpTallyPresentation } from "@/features/player-mvp-tally/MvpTallyPresentation";
import type { MvpTallyPresentationRecord } from "@/features/player-mvp-tally/types";
import { supabase } from "@/integrations/supabase/client";

export default function MvpTallyPresentationPage() {
  const { id } = useParams();
  const [presentation, setPresentation] = useState<MvpTallyPresentationRecord | null>(null);
  const [teamName, setTeamName] = useState("Player MVP");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const item = await getMvpTallyPresentation(id);
        if (!item || !item.card_snapshot || !item.result_snapshot || item.status === "WITHDRAWN") {
          if (active) setUnavailable(true);
          return;
        }
        const { data: team } = await supabase.from("teams").select("name").eq("id", item.team_id).maybeSingle();
        if (active) {
          setPresentation(item);
          setTeamName(team?.name || "Player MVP");
        }
      } catch (error) {
        console.error("Unable to open Player MVP tally", error);
        if (active) setUnavailable(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading your tally…</div>;
  if (unavailable || !presentation || !presentation.card_snapshot || !presentation.result_snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="max-w-md text-center"><Lock className="mx-auto h-12 w-12 text-white/55" /><h1 className="mt-4 text-2xl font-black">Tally unavailable</h1><p className="mt-2 text-white/65">This presentation may have been withdrawn, or it was not published to your profile.</p><Button asChild className="mt-6" variant="secondary"><Link to="/mvp-votes"><ArrowLeft className="mr-2 h-4 w-4" />Back to Player MVP</Link></Button></div>
      </main>
    );
  }

  return (
    <MvpTallyPresentation
      title={presentation.title}
      subtitle={presentation.subtitle}
      teamName={teamName}
      theme={presentation.theme}
      snapshot={presentation.card_snapshot}
      finalResults={presentation.result_snapshot}
      commentary={presentation.commentary_snapshot}
      initialSpeed={presentation.playback_speed}
      storageKey={`sportstack:mvp-tally:${presentation.id}:frame`}
    />
  );
}
