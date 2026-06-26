import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";

// One row from the error_logs table
interface ErrorLog {
  id: string;
  created_at: string;
  user_id: string | null;
  context: string | null;
  message: string;
  details: unknown;
  page_url: string | null;
}

const ErrorLogs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  // useAdminScope tells us if the current user is allowed in here.
  // isSuperAdmin = the highest permission level (only they can read error logs).
  const { loading: scopeLoading, isSuperAdmin } = useAdminScope();

  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks which row is "expanded" to show its full technical details
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load the most recent 100 error logs, newest first
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading logs",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If a non-super-admin somehow lands here, send them back to the dashboard
  useEffect(() => {
    if (!scopeLoading && !isSuperAdmin) {
      navigate("/dashboard");
    }
  }, [scopeLoading, isSuperAdmin, navigate]);

  // Load logs once we've confirmed the user is a super admin
  useEffect(() => {
    if (!scopeLoading && isSuperAdmin) {
      fetchLogs();
    }
  }, [scopeLoading, isSuperAdmin]);

  // Turn a timestamp into a readable local date + time
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Show/hide the technical details for a row
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (scopeLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Error Logs</h1>
          <p className="text-muted-foreground">
            Recent application errors, newest first. Click a row to see full details.
          </p>
        </div>
        {/* Refresh button to reload the list */}
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {logs.length === 0 ? (
        // Friendly empty state when there are no errors
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-foreground">No errors logged - all clear!</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Logged Errors</CardTitle>
            <CardDescription>{logs.length} error(s) recorded (showing latest 100)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="whitespace-nowrap">When</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  // React Fragment lets us render two rows per log:
                  // the summary row, and (if expanded) the details row.
                  <ErrorLogRow
                    key={log.id}
                    log={log}
                    expanded={expandedId === log.id}
                    onToggle={() => toggleExpand(log.id)}
                    formatDate={formatDate}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// A single log entry rendered as a clickable summary row plus an
// optional expanded details row underneath it.
interface ErrorLogRowProps {
  log: ErrorLog;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (d: string) => string;
}

const ErrorLogRow = ({ log, expanded, onToggle, formatDate }: ErrorLogRowProps) => {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
          {formatDate(log.created_at)}
        </TableCell>
        <TableCell className="font-medium">{log.context || "-"}</TableCell>
        <TableCell>{log.message}</TableCell>
      </TableRow>

      {/* Expanded details row - only shown when this log is clicked */}
      {expanded && (
        <TableRow>
          <TableCell></TableCell>
          <TableCell colSpan={3}>
            <div className="space-y-2 py-2 text-sm">
              <div>
                <span className="font-semibold">User ID: </span>
                <span className="text-muted-foreground">{log.user_id || "(not logged in)"}</span>
              </div>
              <div>
                <span className="font-semibold">Page: </span>
                <span className="text-muted-foreground break-all">{log.page_url || "-"}</span>
              </div>
              <div>
                <span className="font-semibold">Technical details:</span>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-all">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default ErrorLogs;
