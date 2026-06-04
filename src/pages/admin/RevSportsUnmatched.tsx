import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";

interface UnmatchedItem {
  id: string;
  association: string | null;
  competition_name: string | null;
  grade: string | null;
  team: string | null;
  club_name: string | null;
  status: string;
  first_seen_at: string | null;
}

const RevSportsUnmatched = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin } = useAdminScope();

  const [items, setItems] = useState<UnmatchedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("revsports_unmatched_items")
        .select("*")
        .eq("status", "unmatched")
        .order("first_seen_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading unmatched items",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) {
      navigate("/dashboard");
    }
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    if (!scopeLoading && isAnyAdmin) {
      fetchData();
    }
  }, [scopeLoading, isAnyAdmin]);

  const handleIgnore = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("revsports_unmatched_items")
        .update({ status: "ignored" })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Item marked as ignored",
      });

      // Remove from UI state list directly
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error: any) {
      toast({
        title: "Error ignoring item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">RevSports — Unmatched Items</h1>
          <p className="text-muted-foreground">Review teams or grades found by the scraper with no SportStack match yet</p>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-foreground">All items reviewed — nothing unmatched!</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Unmatched Scraper Records</CardTitle>
            <CardDescription>{items.length} item(s) need review</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Association</TableHead>
                  <TableHead>Competition</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.association || "-"}</TableCell>
                    <TableCell>{item.competition_name || "-"}</TableCell>
                    <TableCell>{item.grade || "-"}</TableCell>
                    <TableCell className="font-semibold text-primary">{item.team || "-"}</TableCell>
                    <TableCell>{item.club_name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(item.first_seen_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleIgnore(item.id)}>
                            Mark as ignored
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/admin/teams">Go to admin to add</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RevSportsUnmatched;
