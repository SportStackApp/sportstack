import { useEffect, useMemo, useState } from "react";
import { Gauge, Pause, Play, RefreshCw, SkipForward, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  buildPlaybackFrames,
  buildRuleCommentary,
  calculateLeaderboard,
  frameDelayMs,
  limitLeaderboard,
  podiumResults,
  TALLY_SPEEDS,
} from "./logic";
import type {
  MvpTallyCardSnapshot,
  MvpTallyCommentarySnapshot,
  MvpTallyResult,
  MvpTallySpeed,
  MvpTallyTheme,
} from "./types";

interface MvpTallyPresentationProps {
  title: string;
  subtitle?: string | null;
  teamName: string;
  theme: MvpTallyTheme;
  snapshot: MvpTallyCardSnapshot;
  finalResults: MvpTallyResult[];
  commentary?: MvpTallyCommentarySnapshot | null;
  initialSpeed: MvpTallySpeed;
  storageKey?: string;
  preview?: boolean;
}

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

const PlayerAvatar = ({ name, url, large = false }: { name: string; url: string | null; large?: boolean }) => (
  <div
    className={`shrink-0 overflow-hidden rounded-full border-2 border-white/25 bg-white/15 font-black text-white ${large ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm"}`}
  >
    {url ? <img className="h-full w-full object-cover" src={url} alt="" /> : (
      <span className="flex h-full w-full items-center justify-center">{initials(name)}</span>
    )}
  </div>
);

export function MvpTallyPresentation({
  title,
  subtitle,
  teamName,
  theme,
  snapshot,
  finalResults,
  commentary,
  initialSpeed,
  storageKey,
  preview = false,
}: MvpTallyPresentationProps) {
  const frames = useMemo(() => buildPlaybackFrames(snapshot), [snapshot]);
  const [frameIndex, setFrameIndex] = useState(() => {
    if (!storageKey) return 0;
    const saved = Number(window.localStorage.getItem(storageKey));
    return Number.isInteger(saved) && saved >= 0 ? Math.min(saved, Math.max(frames.length - 1, 0)) : 0;
  });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<MvpTallySpeed>(initialSpeed);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
  );
  const frame = frames[Math.min(frameIndex, Math.max(frames.length - 1, 0))];
  const effectiveCommentary = useMemo(
    () => commentary || buildRuleCommentary(snapshot),
    [commentary, snapshot],
  );

  useEffect(() => {
    if (storageKey) window.localStorage.setItem(storageKey, String(frameIndex));
  }, [frameIndex, storageKey]);

  useEffect(() => {
    if (!playing || !frame || frame.kind === "FINAL") return;
    const timer = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(current + 1, frames.length - 1));
    }, frameDelayMs(frame, speed, reducedMotion));
    return () => window.clearTimeout(timer);
  }, [frame, frames.length, playing, reducedMotion, speed]);

  useEffect(() => {
    if (frame?.kind === "FINAL") setPlaying(false);
  }, [frame?.kind]);

  if (!frame || snapshot.rounds.length === 0) {
    return <div className="flex min-h-[500px] items-center justify-center bg-slate-950 text-white">No tally cards to show.</div>;
  }

  const currentRound = snapshot.rounds[frame.roundIndex] || snapshot.rounds[0];
  const completeLiveResults = frame.kind === "FINAL"
    ? finalResults
    : calculateLeaderboard(snapshot, frame.revealedCards);
  const liveResults = limitLeaderboard(completeLiveResults, theme.leaderboardLimit);
  const maxPoints = Math.max(...liveResults.map((result) => result.points), 1);
  const background = theme.backgroundStyle === "SOLID"
    ? theme.secondaryColour
    : theme.backgroundStyle === "GRADIENT"
      ? `linear-gradient(135deg, ${theme.secondaryColour}, ${theme.primaryColour})`
      : `radial-gradient(circle at 75% 20%, ${theme.primaryColour}cc 0%, transparent 38%), linear-gradient(135deg, ${theme.secondaryColour}, #080b1d 72%)`;
  const podium = podiumResults(finalResults);

  return (
    <main
      className={`relative flex min-h-screen flex-col overflow-hidden text-white ${preview ? "min-h-[680px] rounded-xl" : ""}`}
      style={{ background }}
    >
      {theme.bannerUrl && (
        <div className="pointer-events-none absolute inset-0 opacity-15">
          <img className="h-full w-full object-cover" src={theme.bannerUrl} alt="" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/15 bg-black/20 px-4 py-4 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {theme.logoUrl ? (
            <img className="h-12 w-12 rounded-xl bg-white/95 object-contain p-1" src={theme.logoUrl} alt={`${teamName} logo`} />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10"><Trophy /></div>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-[0.24em] text-white/65">{teamName}</p>
            <h1 className="truncate text-xl font-black tracking-tight md:text-3xl">{title}</h1>
            {subtitle && <p className="truncate text-sm text-white/65">{subtitle}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">Round progress</p>
          <p className="text-xl font-black">{Math.min(frame.roundIndex + 1, snapshot.rounds.length)} / {snapshot.rounds.length}</p>
        </div>
      </header>

      <section className="relative z-10 grid flex-1 gap-5 p-4 md:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] md:p-8">
        <div className="rounded-2xl border border-white/15 bg-black/25 p-4 shadow-2xl backdrop-blur-md md:p-6">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/55">Live leaderboard</p>
              <h2 className="mt-1 text-2xl font-black">
                {theme.leaderboardLimit == null ? "Complete tally" : `Top ${theme.leaderboardLimit}`}
              </h2>
            </div>
            <p className="text-sm text-white/60">{frame.revealedCards} cards revealed</p>
          </div>
          <div className="space-y-3">
            {liveResults.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-white/20 text-center text-white/55">
                The first result is about to be revealed.
              </div>
            ) : liveResults.map((result) => (
              <div key={result.playerKey} className="grid grid-cols-[2rem_2.5rem_minmax(0,1fr)_3rem] items-center gap-3 rounded-xl bg-white/[0.07] p-2.5">
                <span className="text-center text-lg font-black text-white/65">{result.rank}</span>
                <PlayerAvatar name={result.playerName} url={result.avatarUrl} />
                <div className="min-w-0">
                  <div className="flex justify-between gap-3">
                    <span className="truncate font-bold">{result.playerName}</span>
                    {!result.linked && <span className="text-xs text-amber-300">Unlinked</span>}
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${Math.max(8, (result.points / maxPoints) * 100)}%`, backgroundColor: theme.accentColour }}
                    />
                  </div>
                </div>
                <span className="text-right text-xl font-black" style={{ color: theme.accentColour }}>{result.points}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-white/15 bg-black/30 p-6 text-center shadow-2xl backdrop-blur-md">
          {frame.kind === "INTRO" && (
            <div className={reducedMotion ? "" : "animate-in fade-in zoom-in duration-700"}>
              <Trophy className="mx-auto h-20 w-20" style={{ color: theme.accentColour }} />
              <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-white/55">Player MVP results</p>
              <h2 className="mt-2 text-4xl font-black">Let the count begin</h2>
            </div>
          )}
          {frame.kind === "ROUND_INTRO" && (
            <div className={reducedMotion ? "" : "animate-in slide-in-from-right-8 fade-in duration-500"}>
              <p className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: theme.accentColour }}>Next round</p>
              <h2 className="mt-3 text-5xl font-black">{currentRound.roundLabel}</h2>
              <p className="mt-3 text-lg text-white/65">{currentRound.matchLabel}</p>
            </div>
          )}
          {frame.kind === "CARD" && (
            <div className={`w-full ${reducedMotion ? "" : "animate-in zoom-in-75 fade-in duration-500"}`} key={frame.card.cardId}>
              <div className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-6xl font-black shadow-2xl" style={{ color: theme.accentColour }}>
                {frame.card.points}
              </div>
              <div className="mt-7 flex flex-col items-center">
                <PlayerAvatar name={frame.card.playerName} url={frame.card.avatarUrl} large />
                <h2 className="mt-4 text-3xl font-black">{frame.card.playerName}</h2>
                <p className="mt-2 text-white/60">{frame.card.points} {frame.card.points === 1 ? "point" : "points"}</p>
              </div>
            </div>
          )}
          {frame.kind === "ROUND_SUMMARY" && (
            <div className={reducedMotion ? "" : "animate-in fade-in slide-in-from-bottom-6 duration-500"}>
              <p className="text-sm font-bold uppercase tracking-[0.3em]" style={{ color: theme.accentColour }}>Round complete</p>
              <h2 className="mt-3 text-4xl font-black">{currentRound.roundLabel}</h2>
              <p className="mt-3 max-w-xl text-lg text-white/70">
                {effectiveCommentary.rounds.find((item) => item.sessionId === currentRound.sessionId)?.text}
              </p>
            </div>
          )}
          {frame.kind === "FINAL" && (
            <div className={`w-full ${reducedMotion ? "" : "animate-in fade-in zoom-in duration-700"}`}>
              <Trophy className="mx-auto h-14 w-14" style={{ color: theme.accentColour }} />
              <p className="mt-4 text-sm font-bold uppercase tracking-[0.3em] text-white/55">Final podium</p>
              <div className="mt-5 max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {podium.map((result) => (
                  <div key={result.playerKey} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3 text-left">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/20 text-2xl font-black" style={{ color: theme.accentColour }}>#{result.rank}</span>
                    <PlayerAvatar name={result.playerName} url={result.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-lg font-black leading-tight">{result.playerName}</p>
                      <p className="mt-1 text-sm text-white/60">
                        {result.rank === 1 ? "Winner" : result.rank === 2 ? "Second place" : "Third place"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-black" style={{ color: theme.accentColour }}>{result.points}</p>
                      <p className="text-xs text-white/55">points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/15 bg-black/35 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
            {snapshot.rounds.map((round, index) => (
              <div key={round.sessionId} className="flex shrink-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${index <= frame.roundIndex ? "bg-white" : "bg-white/25"}`} />
                <button
                  type="button"
                  className={`rounded px-1 py-0.5 text-xs font-bold transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${index === frame.roundIndex ? "text-white" : "text-white/45"}`}
                  onClick={() => {
                    const roundIntroIndex = frames.findIndex((candidate) => candidate.kind === "ROUND_INTRO" && candidate.roundIndex === index);
                    if (roundIntroIndex >= 0) setFrameIndex(roundIntroIndex);
                  }}
                  aria-label={`Jump to ${round.roundLabel}`}
                >
                  {round.roundLabel}
                </button>
                {index < snapshot.rounds.length - 1 && <span className="h-px w-6 bg-white/20" />}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPlaying((current) => !current)}>
              {playing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {playing ? "Pause" : "Resume"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setFrameIndex(0); setPlaying(true); }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Replay
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setFrameIndex(frames.length - 1); setPlaying(false); }}>
              <SkipForward className="mr-2 h-4 w-4" /> Skip
            </Button>
            <Select value={String(speed)} onValueChange={(value) => setSpeed(Number(value) as MvpTallySpeed)}>
              <SelectTrigger className="w-24 border-white/20 bg-white/10 text-white"><Gauge className="mr-1 h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                {TALLY_SPEEDS.map((option) => <SelectItem key={option} value={String(option)}>{option}×</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} /> Reduced motion
            </label>
          </div>
        </div>
      </footer>
    </main>
  );
}
