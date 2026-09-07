import React, { useCallback, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, ClipboardList, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  approvePrimaryTeamChange,
  cancelPrimaryTeamChange,
  declinePrimaryTeamChange,
} from "@/lib/primaryTeamChangeRpc";


interface Request {
  source: "membership" | "primary_change";
  id: string;
  request_type: string;
  requester_id: string | null;
  target_user_id: string;
  team_id: string | null;
  from_team_id?: string | null;
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
  from_team_name?: string | null;
  club_name: string;
  association_name: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : fallback;

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
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user || scopeLoading) return;
    setLoading(true);

    try {
      const [{ data, error }, { data: primaryData, error: primaryError }] = await Promise.all([
        supabase.from("requests").select("*").order("created_at", { ascending: false }),
        supabase.from("primary_change_requests").select("*").order("requested_at", { ascending: false }),
      ]);

      if (error) throw error;
      if (primaryError) throw primaryError;

      const allRequests = data || [];
      const allPrimaryRequests = primaryData || [];

      // Fetch profiles for name lookups
      const { data: profilesData } = await supabase.from("profiles").select("id, first_name, last_name");
      const profileMap = new Map(
        (profilesData || []).map((profile) => [
          profile.id,
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown",
        ])
      );

      // Fetch teams for lookups
      const { data: teamsData } = await supabase.from("teams").select("id, name, club_id, clubs(id, name, association_id, associations(id, name))");
      const teamMap = new Map(
        (teamsData || []).map((team) => [
          team.id,
          {
            name: team.name,
            clubId: team.club_id,
            clubName: team.clubs?.name || "",
            associationId: team.clubs?.association_id,
            associationName: team.clubs?.associations?.name || "",
          },
        ])
      );

      const { data: clubsData } = await supabase.from("clubs").select("id, name, association_id, associations(id, name)");
      const clubMap = new Map(
        (clubsData || []).map((club) => [
          club.id,
          {
            name: club.name,
            associationId: club.association_id,
            associationName: club.associations?.name || "",
          },
        ])
      );

      const { data: associationsData } = await supabase.from("associations").select("id, name");
      const associationMap = new Map((associationsData || []).map((association) => [association.id, association.name]));

      // Filter requests based on role
      let filtered: Request[] = allRequests.map((req) => {
        const teamInfo = req.team_id ? teamMap.get(req.team_id) : null;
        const clubInfo = req.club_id ? clubMap.get(req.club_id) : null;
        return {
          source: "membership",
          ...req,
          requester_name: profileMap.get(req.requester_id) || "Unknown",
          target_user_name: profileMap.get(req.target_user_id) || "Unknown",
          team_name: teamInfo?.name || (req.team_id ? "Unknown" : "No team selected"),
          club_name: teamInfo?.clubName || clubInfo?.name || (req.club_id ? "Unknown" : "No club selected"),
          association_name:
            teamInfo?.associationName ||
            clubInfo?.associationName ||
            (req.association_id ? associationMap.get(req.association_id) || "Unknown" : "Unknown"),
        };
      });

      const primaryRequests = allPrimaryRequests.map((req) => {
        const toTeamInfo = teamMap.get(req.to_team_id);
        const fromTeamInfo = req.from_team_id ? teamMap.get(req.from_team_id) : null;
        return {
          source: "primary_change" as const,
          id: req.id,
          request_type: "PRIMARY_CHANGE",
          requester_id: req.user_id,
          target_user_id: req.user_id,
          team_id: req.to_team_id,
          from_team_id: req.from_team_id,
          association_id: toTeamInfo?.associationId || null,
          club_id: toTeamInfo?.clubId || null,
          membership_type: "PRIMARY",
          status: req.status,
          cancelled_by: null,
          responded_by: req.resolved_by || null,
          created_at: req.requested_at,
          requester_name: profileMap.get(req.user_id) || "Unknown",
          target_user_name: profileMap.get(req.user_id) || "Unknown",
          team_name: toTeamInfo?.name || "Unknown",
          from_team_name: fromTeamInfo?.name || null,
          club_name: toTeamInfo?.clubName || "Unknown",
          association_name: toTeamInfo?.associationName || "Unknown",
        } satisfies Request;
      });

      filtered = [...filtered, ...primaryRequests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Apply role-based filtering
      if (!isSuperAdmin) {
        filtered = filtered.filter((req) => {
          if (isAssociationAdmin && scopedAssociationIds.includes(req.association_id)) return true;
          if (isClubAdmin && scopedClubIds.includes(req.club_id)) return true;
          if (isTeamManager && scopedTeamIds.includes(req.team_id)) return true;
          return false;
        });
      }

      setRequests(filtered);
    } catch (error: unknown) {
      console.error(error);
      toast({
        title: "Error fetching requests",
        description: getErrorMessage(error, "Failed to load requests"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [
    isAssociationAdmin,
    isClubAdmin,
    isSuperAdmin,
    isTeamManager,
    scopeLoading,
    scopedAssociationIds,
    scopedClubIds,
    scopedTeamIds,
    toast,
    user,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshRequestViews = () => {
    window.dispatchEvent(new Event("sportstack:requests-changed"));
    void loadData();
  };

  const handleApprove = async (request: Request) => {
    if (processingRequestId) return;

    if (request.source !== "primary_change" && request.team_id && request.membership_type === "PRIMARY") {
      const confirmed = window.confirm(
        `${request.target_user_name} may already have a Primary team in this association. Approving this will make "${request.team_name}" Primary and downgrade only the existing Primary in the same association. Continue?`
      );
      if (!confirmed) return;
    }

    setProcessingRequestId(request.id);
    try {
      if (request.source === "primary_change") {
        const { error: primaryError } = await approvePrimaryTeamChange(request.id);

        if (primaryError) throw primaryError;

        toast({
          title: "Primary team updated",
          description: "The player requested this change, so approval completed it immediately.",
        });
        refreshRequestViews();
        return;
      }

      // The database function locks and validates the request, applies any
      // membership change and approves the request in one transaction.
      const { error } = await supabase.rpc("approve_membership_request", {
        p_request_id: request.id,
        p_assign_team: true,
      });

      if (error) throw error;

      toast({
        title: "Request approved",
        description: request.team_id
          ? "The request and team membership were saved together."
          : "The request was approved without a team assignment.",
      });
      refreshRequestViews();
    } catch (error: unknown) {
      toast({
        title: "Request not approved",
        description: getErrorMessage(error, "The request could not be approved."),
        variant: "destructive",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };


  // Approve a request but WITHOUT creating a team membership - the person
  // is approved into the club (or association) only. Useful for volunteers,
  // committee members, or supporters who shouldn't be assigned to a specific
  // team. Only meaningful when the request actually has a team_id to skip;
  // for association/club-only requests this behaves the same as a normal
  // approval, since there was never a team to assign anyway.
  const handleApproveClubOnly = async (request: Request) => {
    if (processingRequestId) return;

    const confirmed = window.confirm(
      `Approve ${request.target_user_name} for ${request.club_name || request.association_name} WITHOUT assigning them to "${request.team_name}"? They will need to be added to a team separately later.`
    );
    if (!confirmed) return;

    setProcessingRequestId(request.id);
    try {
      const { error } = await supabase.rpc("approve_membership_request", {
        p_request_id: request.id,
        p_assign_team: false,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request approved at club level. No team was assigned.",
      });
      refreshRequestViews();
    } catch (error: unknown) {
      toast({
        title: "Request not approved",
        description: getErrorMessage(error, "The request could not be approved."),
        variant: "destructive",
      });
    } finally {
      setProcessingRequestId(null);
    }
  };
  const handleDecline = async (request: Request) => {
    if (processingRequestId) return;
    setProcessingRequestId(request.id);
    try {
      if (request.source === "primary_change") {
        const { error } = await declinePrimaryTeamChange(request.id);

        if (error) throw error;

        toast({ title: "Success", description: "Request declined." });
        refreshRequestViews();
        return;
      }

      const { error } = await supabase
        .from("requests")
        .update({
          status: "DECLINED",
          responded_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast({ title: "Success", description: "Request declined." });
      refreshRequestViews();
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error, "The request could not be declined."), variant: "destructive" });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleCancel = async (request: Request) => {
    if (processingRequestId) return;
    setProcessingRequestId(request.id);
    try {
      if (request.source === "primary_change") {
        const { error } = await cancelPrimaryTeamChange(request.id);

        if (error) throw error;

        toast({ title: "Success", description: "Request cancelled." });
        refreshRequestViews();
        return;
      }

      const { error } = await supabase
        .from("requests")
        .update({
          status: "CANCELLED",
          cancelled_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      toast({ title: "Success", description: "Request cancelled." });
      refreshRequestViews();
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error, "The request could not be cancelled."), variant: "destructive" });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const visibleRequests = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "PENDING") return ["PENDING", "ADMIN_APPROVED"].includes(r.status);
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
    if (status === "ADMIN_APPROVED") {
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 pointer-events-none">
          <Clock className="w-3 h-3 mr-1" /> Legacy approval
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
            {status === "PENDING" ? "Action required" : status.charAt(0) + status.slice(1).toLowerCase()}
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
                          {request.source === "primary_change"
                            ? "Primary Change"
                            : request.request_type === "TEAM_INVITE"
                              ? "Team Invite"
                              : "Player Request"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {request.target_user_name}
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">
                            Sent by {request.requester_name}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {request.team_name}
                          {request.from_team_name && (
                            <p className="text-xs text-muted-foreground font-normal mt-0.5">
                              From {request.from_team_name}
                            </p>
                          )}
                        </TableCell>
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
                                  disabled={processingRequestId !== null}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                </Button>
                                {request.source !== "primary_change" && request.team_id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50 h-7 px-2 text-xs"
                                    onClick={() => handleApproveClubOnly(request)}
                                    disabled={processingRequestId !== null}
                                  >
                                    <Building2 className="h-3 w-3 mr-1" /> Approve (club only)
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                                  onClick={() => handleDecline(request)}
                                  disabled={processingRequestId !== null}
                                >
                                  <XCircle className="h-3 w-3 mr-1" /> Decline
                                </Button>
                                {canCancelRequest(request) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground h-7 px-2 text-xs"
                                    onClick={() => handleCancel(request)}
                                    disabled={processingRequestId !== null}
                                  >
                                    Cancel
                                  </Button>
                                )}
                              </>
                            )}
                            {request.status === "ADMIN_APPROVED" && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                                Legacy — player can complete
                              </Badge>
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
