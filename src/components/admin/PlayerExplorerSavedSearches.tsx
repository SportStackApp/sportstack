import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, BookmarkPlus, CalendarClock, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  normalisePlayerExplorerExpression,
  validatePlayerExplorerExpression,
  type PlayerExplorerFilterExpression,
  type PlayerExplorerResult,
} from "@/lib/playerExplorer";

type Tables = Database["public"]["Tables"];
type SavedSearch = Tables["player_explorer_saved_searches"]["Row"];
type SearchRun = Tables["player_explorer_search_runs"]["Row"];
type ScheduleFrequency = "MANUAL" | "DAILY" | "WEEKLY" | "MONTHLY";

interface PlayerExplorerSavedSearchesProps {
  expression: PlayerExplorerFilterExpression;
  disabled?: boolean;
  onLoad: (expression: PlayerExplorerFilterExpression) => void;
}

interface ResultSummary {
  players?: Array<Pick<
    PlayerExplorerResult,
    "revsportsPlayerId" | "displayName" | "teamNames" | "gamesPlayed" | "goals"
  >>;
  truncated?: boolean;
}

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  MANUAL: "Manual only",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
};

const getMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "The saved search could not be updated.";
};

export function PlayerExplorerSavedSearches({
  expression,
  disabled = false,
  onLoad,
}: PlayerExplorerSavedSearchesProps) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSearchId = searchParams.get("savedSearch");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [latestRun, setLatestRun] = useState<SearchRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [newFrequency, setNewFrequency] = useState<ScheduleFrequency>("MANUAL");
  const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency>("MANUAL");

  const selectedSearch = useMemo(
    () => savedSearches.find((search) => search.id === selectedId) || null,
    [savedSearches, selectedId],
  );

  const loadLatestRun = useCallback(async (savedSearchId: string) => {
    const { data, error } = await supabase
      .from("player_explorer_search_runs")
      .select("*")
      .eq("saved_search_id", savedSearchId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    setLatestRun(data);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("player_explorer_saved_searches")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = data || [];
      setSavedSearches(rows);
      const nextSelectedId = requestedSearchId && rows.some((row) => row.id === requestedSearchId)
        ? requestedSearchId
        : selectedId && rows.some((row) => row.id === selectedId)
          ? selectedId
          : rows[0]?.id || "";
      setSelectedId(nextSelectedId);
      const selected = rows.find((row) => row.id === nextSelectedId);
      setSelectedFrequency((selected?.schedule_frequency as ScheduleFrequency) || "MANUAL");
      if (selected) await loadLatestRun(selected.id);
      else setLatestRun(null);
    } catch (error) {
      toast({ title: "Saved searches could not load", description: getMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [loadLatestRun, requestedSearchId, selectedId, toast]);

  useEffect(() => {
    void refresh();
  // The selected row is managed inside refresh; rerunning for each selection would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSearchId]);

  useEffect(() => {
    if (!selectedSearch) return;
    setSelectedFrequency(selectedSearch.schedule_frequency as ScheduleFrequency);
    void loadLatestRun(selectedSearch.id).catch((error) => {
      toast({ title: "Latest result could not load", description: getMessage(error), variant: "destructive" });
    });
  }, [loadLatestRun, selectedSearch, toast]);

  const selectSearch = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set("savedSearch", id);
    setSearchParams(next, { replace: true });
  };

  const loadSelected = () => {
    if (!selectedSearch) return;
    onLoad(normalisePlayerExplorerExpression(selectedSearch.filter_expression));
    toast({ title: "Saved search loaded", description: selectedSearch.name });
  };

  const saveCurrent = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Enter a search name", variant: "destructive" });
      return;
    }
    const validationError = validatePlayerExplorerExpression(expression);
    if (validationError) {
      toast({ title: "Check the filters", description: validationError, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error("Please sign in again.");
      const { data, error } = await supabase
        .from("player_explorer_saved_searches")
        .insert({
          owner_id: authData.user.id,
          name: trimmedName,
          filter_expression: expression as unknown as Json,
          schedule_frequency: newFrequency,
          schedule_enabled: newFrequency !== "MANUAL",
          delivery_in_app: true,
          delivery_email: true,
        })
        .select("*")
        .single();
      if (error) throw error;
      setDialogOpen(false);
      setName("");
      setNewFrequency("MANUAL");
      setSavedSearches((current) => [data, ...current]);
      selectSearch(data.id);
      toast({
        title: "Search saved",
        description: data.schedule_enabled
          ? "The first recurring run is scheduled. Results will appear in SportStack and by email."
          : "You can load this filter again at any time.",
      });
    } catch (error) {
      toast({ title: "Search not saved", description: getMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveSchedule = async () => {
    if (!selectedSearch) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("player_explorer_saved_searches")
        .update({
          schedule_frequency: selectedFrequency,
          schedule_enabled: selectedFrequency !== "MANUAL",
          delivery_in_app: true,
          delivery_email: true,
        })
        .eq("id", selectedSearch.id);
      if (error) throw error;
      await refresh();
      toast({
        title: selectedFrequency === "MANUAL" ? "Recurring search paused" : "Schedule saved",
        description: selectedFrequency === "MANUAL"
          ? "The saved filter remains available for manual use."
          : "Each run will create an in-app result and send an email.",
      });
    } catch (error) {
      toast({ title: "Schedule not saved", description: getMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const summary = (latestRun?.result_summary || {}) as ResultSummary;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" />Saved and recurring searches</CardTitle>
        <CardDescription>
          Save the current filters. Daily, weekly or monthly runs send both an in-app result and an email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <Select value={selectedId} onValueChange={selectSearch} disabled={disabled || loading || savedSearches.length === 0}>
            <SelectTrigger className="w-full min-w-0 overflow-hidden lg:flex-1" aria-label="Saved Player Explorer search">
              <SelectValue placeholder={loading ? "Loading saved searches…" : "No saved searches yet"} />
            </SelectTrigger>
            <SelectContent>
              {savedSearches.map((search) => <SelectItem key={search.id} value={search.id}>{search.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={loadSelected} disabled={disabled || !selectedSearch}>Load filters</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" disabled={disabled}><BookmarkPlus className="mr-2 h-4 w-4" />Save current</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Player Explorer search</DialogTitle>
                <DialogDescription>Give this filter a name and choose whether it should run automatically.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="player-explorer-search-name" className="text-sm font-medium">Search name</label>
                  <Input id="player-explorer-search-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Division movement check" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select value={newFrequency} onValueChange={(value) => setNewFrequency(value as ScheduleFrequency)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FREQUENCY_LABELS) as ScheduleFrequency[]).map((frequency) => (
                        <SelectItem key={frequency} value={frequency}>{FREQUENCY_LABELS[frequency]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newFrequency !== "MANUAL" ? <p className="text-xs text-muted-foreground">The first run occurs after one full {FREQUENCY_LABELS[newFrequency].toLocaleLowerCase("en-AU")} interval.</p> : null}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
                <Button type="button" onClick={() => void saveCurrent()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save search
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {selectedSearch ? (
          <div className="grid gap-4 rounded-md border p-4 lg:grid-cols-[minmax(180px,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <p className="font-medium">{selectedSearch.name}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full space-y-1 sm:w-52">
                  <label className="text-xs font-medium">Recurring frequency</label>
                  <Select value={selectedFrequency} onValueChange={(value) => setSelectedFrequency(value as ScheduleFrequency)} disabled={disabled || saving}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FREQUENCY_LABELS) as ScheduleFrequency[]).map((frequency) => (
                        <SelectItem key={frequency} value={frequency}>{FREQUENCY_LABELS[frequency]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="pb-2 text-xs text-muted-foreground">Next run: {formatDateTime(selectedSearch.next_run_at)}</p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void saveSchedule()} disabled={disabled || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
              Save schedule
            </Button>
          </div>
        ) : null}

        {latestRun ? (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium">Latest recurring result: {latestRun.matched_player_count} player{latestRun.matched_player_count === 1 ? "" : "s"}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(latestRun.completed_at || latestRun.started_at)} · {latestRun.status}</p>
            </div>
            {summary.players?.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.players.slice(0, 5).map((player) => player.displayName).join(", ")}
                {latestRun.matched_player_count > 5 ? ` and ${latestRun.matched_player_count - 5} more` : ""}
              </p>
            ) : latestRun.error_message ? <p className="mt-2 text-sm text-destructive">{latestRun.error_message}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
