import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, MessageSquare, RefreshCw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { nextSortState, stableSortRows, type SortState } from "@/lib/adminSorting";

type FeedbackSortKey = "createdAt" | "message" | "status" | "adminNotes";

type FeedbackStatus = "OPEN" | "REVIEWED" | "CLOSED";

interface FeedbackRow {
  id: string;
  user_id: string;
  submitter_name?: string;
  message: string;
  page_path: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
}

interface FeedbackAttachmentRow {
  id: string;
  feedback_id: string;
  storage_path: string;
  file_name: string | null;
  content_type: string | null;
  file_size: number | null;
  created_at: string;
  signedUrl?: string;
}

interface FeedbackProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
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

interface FeedbackAttachmentClient {
  from: (table: "app_feedback_attachments") => {
    select: (columns: string) => {
      in: (column: "feedback_id", values: string[]) => Promise<{ data: FeedbackAttachmentRow[] | null; error: { message?: string } | null }>;
    };
  };
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: "Open",
  REVIEWED: "Reviewed",
  CLOSED: "Archived",
};

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  OPEN: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700",
  REVIEWED: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-700",
  CLOSED: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-700",
};

const STATUS_ORDER: Record<FeedbackStatus, number> = { OPEN: 0, REVIEWED: 1, CLOSED: 2 };

const FeedbackResponses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, highestScopedRole } = useAdminScope();
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: FeedbackStatus; admin_notes: string }>>({});
  const [feedbackAttachments, setFeedbackAttachments] = useState<Record<string, FeedbackAttachmentRow[]>>({});
  const [sort, setSort] = useState<SortState<FeedbackSortKey> | null>(null);

  const canViewFeedback = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN";

  const feedbackClient = useMemo(() => supabase as unknown as FeedbackClient, []);
  const attachmentClient = useMemo(() => supabase as unknown as FeedbackAttachmentClient, []);
  const displayedFeedbackRows = useMemo(() => {
    if (!sort) return feedbackRows;
    return stableSortRows(feedbackRows, sort, (row, key) => {
      if (key === "createdAt") return row.created_at;
      if (key === "message") return row.message;
      if (key === "status") return STATUS_ORDER[row.status];
      return row.admin_notes || "";
    });
  }, [feedbackRows, sort]);

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
    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    let profileMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      profileMap = new Map(
        ((profiles || []) as FeedbackProfileRow[]).map((profile) => [
          profile.id,
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown user",
        ])
      );
    }

    const rowsWithNames = rows.map((row) => ({
      ...row,
      submitter_name: profileMap.get(row.user_id) || "Unknown user",
    }));

    const attachmentMap: Record<string, FeedbackAttachmentRow[]> = {};
    const feedbackIds = rowsWithNames.map((row) => row.id);

    if (feedbackIds.length > 0) {
      const { data: attachments } = await attachmentClient
        .from("app_feedback_attachments")
        .select("*")
        .in("feedback_id", feedbackIds);

      const attachmentRows = attachments || [];
      const legacyAttachments = rowsWithNames
        .filter((row) => row.screenshot_path)
        .map<FeedbackAttachmentRow>((row) => ({
          id: `${row.id}-legacy-screenshot`,
          feedback_id: row.id,
          storage_path: row.screenshot_path as string,
          file_name: "Legacy screenshot",
          content_type: null,
          file_size: null,
          created_at: row.created_at,
        }));

      const signedAttachments = await Promise.all(
        [...attachmentRows, ...legacyAttachments].map(async (attachment) => {
          const { data: signed } = await supabase.storage
            .from("feedback-screenshots")
            .createSignedUrl(attachment.storage_path, 60 * 60);

          return {
            ...attachment,
            signedUrl: signed?.signedUrl || "",
          };
        })
      );

      signedAttachments.forEach((attachment) => {
        if (!attachment.signedUrl) return;
        attachmentMap[attachment.feedback_id] = [...(attachmentMap[attachment.feedback_id] || []), attachment];
      });
    }

    setFeedbackRows(rowsWithNames);
    setFeedbackAttachments(attachmentMap);
    setDrafts(
      rowsWithNames.reduce<Record<string, { status: FeedbackStatus; admin_notes: string }>>((acc, row) => {
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

  const escapeCsvValue = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const handleDownloadCsv = () => {
    const headers = [
      "Submitted",
      "Submitted by",
      "User ID",
      "Page",
      "Feedback",
      "Status",
      "Dealt with",
      "Archived",
      "Admin notes/actions",
      "Photo files",
      "Photo links",
    ];

    const rows = feedbackRows.map((row) => {
      const attachments = feedbackAttachments[row.id] || [];
      return [
        formatDate(row.created_at),
        row.submitter_name || "Unknown user",
        row.user_id,
        row.page_path || "",
        row.message,
        STATUS_LABELS[row.status],
        row.status === "CLOSED" ? "Yes" : row.status === "REVIEWED" ? "In progress" : "No",
        row.status === "CLOSED" ? "Yes" : "No",
        row.admin_notes || "",
        attachments.map((attachment) => attachment.file_name || attachment.storage_path).join("\n"),
        attachments.map((attachment) => attachment.signedUrl || "").filter(Boolean).join("\n"),
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sportstack-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} aria-label="Back to Admin Dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Feedback Responses</h1>
            <p className="text-muted-foreground">Review feedback, add admin notes, and track completion.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={feedbackRows.length === 0} className="text-foreground hover:bg-primary hover:text-primary-foreground">
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchFeedback} className="text-foreground hover:bg-primary hover:text-primary-foreground">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
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
            <h2 className="font-display text-2xl font-semibold leading-none tracking-wide">Submitted Feedback</h2>
            <CardDescription>{feedbackRows.length} item(s), newest first</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="When" sortKey="createdAt" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} className="whitespace-nowrap" />
                  <SortableTableHead label="Feedback" sortKey="message" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} />
                  <SortableTableHead label="Status" sortKey="status" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} className="w-44" />
                  <SortableTableHead label="Admin notes" sortKey="adminNotes" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} className="min-w-64" />
                  <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedFeedbackRows.map((row) => {
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
                            <p>Submitted by: {row.submitter_name}</p>
                            <p className="break-all">User ID: {row.user_id}</p>
                          </div>
                          {(feedbackAttachments[row.id] || []).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {(feedbackAttachments[row.id] || []).map((attachment, index) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.signedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Photo {index + 1}
                                </a>
                              ))}
                            </div>
                          )}
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
                          <SelectTrigger className="w-full min-w-0 overflow-hidden" aria-label={`Status for feedback from ${row.submitter_name || "Unknown user"}`}>
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
