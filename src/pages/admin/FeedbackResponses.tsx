import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, RefreshCw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type FeedbackStatus = "OPEN" | "REVIEWED" | "CLOSED";

interface FeedbackRow {
  id: string;
  user_id: string;
  message: string;
  page_path: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FeedbackClient {
  from: (table: "app_feedback") => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        limit: (count: number) => Promise<{ data: FeedbackRow[] | null; error: { message?: string } | null }>;
      };
    };
    update: (payload: Partial<Pick<FeedbackRow, "status" | "admin_notes">>) => {
      eq: (column: "id", value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: "Open",
  REVIEWED: "Reviewed",
  CLOSED: "Completed",
};

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  OPEN: "bg-warning/15 text-warning-foreground border-warning/30",
  REVIEWED: "bg-primary/15 text-primary border-primary/30",
  CLOSED: "bg-success/15 text-success border-success/30",
};

const FeedbackResponses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, highestScopedRole } = useAdminScope();
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: FeedbackStatus; admin_notes: string }>>({});

  const canViewFeedback = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN";

  const feedbackClient = useMemo(() => supabase as unknown as FeedbackClient, []);

  const fetchFeedback = async () => {
    setLoading(true);
    const { data, error } = await feedbackClient
      .from("app_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast({
        title: "Feedback not loaded",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const rows = data || [];
    setFeedbackRows(rows);
    setDrafts(
      rows.reduce<Record<string, { status: FeedbackStatus; admin_notes: string }>>((acc, row) => {
        acc[row.id] = {
          status: row.status,
          admin_notes: row.admin_notes || "",
        };
        return acc;
      }, {})
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && !canViewFeedback) {
      navigate("/dashboard");
    }
  }, [scopeLoading, canViewFeedback, navigate]);

  useEffect(() => {
    if (!scopeLoading && canViewFeedback) {
      fetchFeedback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLoading, canViewFeedback]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleDraftChange = (id: string, changes: Partial<{ status: FeedbackStatus; admin_notes: string }>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...changes,
      },
    }));
  };

  const handleSave = async (row: FeedbackRow) => {
    const draft = drafts[row.id];
    if (!draft || savingId) return;

    setSavingId(row.id);
    const { error } = await feedbackClient
      .from("app_feedback")
      .update({
        status: draft.status,
        admin_notes: draft.admin_notes.trim() || null,
      })
      .eq("id", row.id);

    setSavingId(null);

    if (error) {
      toast({
        title: "Feedback not saved",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setFeedbackRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? { ...item, status: draft.status, admin_notes: draft.admin_notes.trim() || null }
          : item
      )
    );
    toast({
      title: "Feedback saved",
      description: "Notes and status have been updated.",
    });
  };

  if (scopeLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Feedback Responses</h1>
            <p className="text-muted-foreground">Review feedback, add admin notes, and track completion.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFeedback}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {feedbackRows.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
            <p className="font-medium text-foreground">No feedback has been submitted yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Submitted Feedback</CardTitle>
            <CardDescription>{feedbackRows.length} item(s), newest first</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">When</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead className="w-44">Status</TableHead>
                  <TableHead className="min-w-64">Admin notes</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbackRows.map((row) => {
                  const draft = drafts[row.id] || { status: row.status, admin_notes: row.admin_notes || "" };
                  const hasChanges = draft.status !== row.status || draft.admin_notes !== (row.admin_notes || "");

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(row.created_at)}
                      </TableCell>
                      <TableCell className="min-w-72">
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap text-sm">{row.message}</p>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p className="break-all">Page: {row.page_path || "-"}</p>
                            <p className="break-all">User: {row.user_id}</p>
                          </div>
                          <Badge variant="outline" className={STATUS_STYLES[row.status]}>
                            {STATUS_LABELS[row.status]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={draft.status}
                          onValueChange={(value) => handleDraftChange(row.id, { status: value as FeedbackStatus })}
                        >
                          <SelectTrigger className="w-full min-w-0 overflow-hidden">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="REVIEWED">Reviewed</SelectItem>
                            <SelectItem value="CLOSED">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Label htmlFor={`notes-${row.id}`} className="sr-only">
                          Admin notes
                        </Label>
                        <Textarea
                          id={`notes-${row.id}`}
                          value={draft.admin_notes}
                          onChange={(event) => handleDraftChange(row.id, { admin_notes: event.target.value })}
                          placeholder="Add notes"
                          className="min-h-24 resize-none"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSave(row)}
                          disabled={!hasChanges || savingId === row.id}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FeedbackResponses;
