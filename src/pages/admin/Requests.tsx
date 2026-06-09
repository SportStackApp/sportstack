import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface Request {
  id: string;
  request_type: string;
  requester_id: string | null;
  target_user_id: string;
  team_id: string;
  association_id: string | null;
  club_id: string | null;
  membership_type: string;
  status: string;
  cancelled_by: string | null;
  responded_by: string | null;
  created_at: string;
  requester_name: string;
  target_user_name: string;
  team_name: string;
  club_name: string;
  association_name: string;
}

export default function Requests() {
  const { user } = useAuth();
  const { scopeLoading, isSuperAdmin, scopedRoles, scopedAssociationIds, scopedClubIds, scopedTeamIds } = useAdminScope();
  const isAssociationAdmin = scopedRoles.some((r) => r.role === "ASSOCIATION_ADMIN");
  const isClubAdmin = scopedRoles.some((r) => r.role === "CLUB_ADMIN");
  const isTeamManager = scopedRoles.some((r) => r.role === "TEAM_MANAGER");
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const loadData = async () => {
    if (!user || scopeLoading) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.from("requests" as any).select("*").order("created_at", { ascending: false });

      if (error) throw error;

      const allRequests = data || [];

      // Fetch profiles for name lookups
      const { data: profilesData } = await supabase.from("profiles").select("id, first_name, last_name");
      const profileMap = new Map(
        (profilesData || []).map((p: any) => [
          p.id,
          `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
        ])
      );

      // Fetch teams for lookups
      const { data: teamsData } = await supabase.from("teams").select("id, name, club_id, clubs(id, name, association_id, associations(id, name))");
      const teamMap = new Map(
        (teamsData || []).map((t: any) => [
          t.id,
          {
            name: t.name,
            clubId: t.club_id,
            clubName: t.clubs?.name || "",
            associationId: t.clubs?.association_id,
            associationName: t.clubs?.associations?.name || "",
          },
        ])
      );

      // Filter requests based on role
      let filtered = allRequests.map((req: any) => {
        const teamInfo = teamMap.get(req.team_id);
        return {
          ...req,
          requester_name: profileMap.get(req.requester_id) || "Unknown",
          target_user_name: profileMap.get(req.target_user_id) || "Unknown",
          team_name: teamInfo?.name || "Unknown",
          club_name: teamInfo?.clubName || "Unknown",
          association_name: teamInfo?.associationName || "Unknown",
        };
      });

      // Apply role-based filtering
      if (!isSuperAdmin) {
        filtered = filtered.filter((req: any) => {
          if (isAssociationAdmin && scopedAssociationIds.includes(req.association_id)) return true;
          if (isClubAdmin && scopedClubIds.includes(req.club_id)) return true;
          if (isTeamManager && scopedTeamIds.includes(req.team_id)) return true;
          return false;
        });
      }

      setRequests(filtered);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error fetching requests",
        description: err.message || "Failed to load requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, scopeLoading]);

  const handleApprove = async (request: Request) => {
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from("requests" as any)
        .update({
          status: "APPROVED",
          responded_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // Insert into team_memberships with status = ACTIVE
      const { error: insertError } = await supabase.from("team_memberships").insert({
        user_id: request.target_user_id,
        team_id: request.team_id,
        membership_type: request.membership_type as Database["public"]["Enums"]["membership_type"],
        status: "ACTIVE",
      });

      if (insertError) throw insertError;

      toast({ title: "Success", description: "Request approved and membership created." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDecline = async (request: Request) => {
    try {
      const { error } = await supabase
        .from("requests" as any)
        .update({
          status: "DECLINED",
          responded_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast({ title: "Success", description: "Request declined." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async (request: Request) => {
    try {
      const { error } = await supabase
        .from("requests" as any)
        .update({
          status: "CANCELLED",
          cancelled_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast({ title: "Success", description: "Request cancelled." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const visibleRequests = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    return r.status === statusFilter;
  });

  const paginatedRequests = (() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return visibleRequests.slice(startIdx, startIdx + rowsPerPage);
  })();

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const renderStatusBadge = (status: string) => {
    if (status === "PENDING") {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 pointer-events-none">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
    }
    if (status === "APPROVED") {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 pointer-events-none">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    }
    if (status === "DECLINED") {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 pointer-events-none">
          <XCircle className="w-3 h-3 mr-1" /> Declined
        </Badge>
      );
    }
    if (status === "CANCELLED") {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200 pointer-events-none">
          <XCircle className="w-3 h-3 mr-1" /> Cancelled
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const canCancelRequest = (request: Request) => {
    return request.status === "PENDING" && (isSuperAdmin || request.requester_id === user?.id);
  };

  return (
    <div className="space-y-6 container py-6 mx-auto max-w-7xl">
      <div>
        <h1 className="text-3xl font-display text-foreground">Team Requests</h1>
        <p className="text-muted-foreground mt-1">Manage team membership and player requests</p>
      </div>

      <div className="flex gap-2 pb-2">
        {["ALL", "PENDING", "APPROVED", "DECLINED", "CANCELLED"].map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => {
              setStatusFilter(status);
              setCurrentPage(1);
            }}
          >
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
          <CardTitle className="text-lg font-display">Requests</CardTitle>
          {!loading && (
            <div className="flex items-center gap-4">
              <Badge variant="secondary">{visibleRequests.length} requests</Badge>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
                <Select
                  value={String(rowsPerPage)}
                  onValueChange={(val) => {
                    setRowsPerPage(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : visibleRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ClipboardList className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p>No requests found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Club</TableHead>
                      <TableHead>Membership Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(request.created_at)}</TableCell>
                        <TableCell className="text-xs">
                          {request.request_type === "TEAM_INVITE" ? "Team Invite" : "Player Request"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {request.target_user_name}
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">
                            Sent by {request.requester_name}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">{request.team_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{request.club_name}</TableCell>
                        <TableCell className="text-xs">{request.membership_type}</TableCell>
                        <TableCell>{renderStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {request.status === "PENDING" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 border-green-200 hover:bg-green-50 h-7 px-2 text-xs"
                                  onClick={() => handleApprove(request)}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                                  onClick={() => handleDecline(request)}
                                >
                                  <XCircle className="h-3 w-3 mr-1" /> Decline
                                </Button>
                                {canCancelRequest(request) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground h-7 px-2 text-xs"
                                    onClick={() => handleCancel(request)}
                                  >
                                    Cancel
                                  </Button>
                                )}
                              </>
                            )}
                            {request.status === "CANCELLED" && (
                              <Badge variant="outline" className="bg-gray-50 text-xs">Cancelled</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(() => {
                const totalPages = Math.ceil(visibleRequests.length / rowsPerPage);
                if (totalPages <= 1) return null;
                return (
                  <div className="flex items-center justify-between mt-4 py-4 border-t px-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </Button>
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
