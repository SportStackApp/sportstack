import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, ClipboardList, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FilterStatus = "All" | "Pending" | "Approved" | "Declined";

interface PrimaryChangeRequest {
  id: string;
  user_id: string;
  from_team_id: string | null;
  to_team_id: string;
  status: string;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  playerName: string;
  fromTeamName: string;
  toTeamName: string;
  resolvedByName: string;
}

interface AdditionalTeamRequest {
  id: string;
  user_id: string;
  team_id: string;
  membership_type: string;
  status: string;
  created_at: string;
  playerName: string;
  teamName: string;
  clubName: string;
}

export default function Requests() {
  const { user } = useAuth();
  const { scopeLoading, isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds } = useAdminScope();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("Pending");
  
  const [primaryRequests, setPrimaryRequests] = useState<PrimaryChangeRequest[]>([]);
  const [additionalRequests, setAdditionalRequests] = useState<AdditionalTeamRequest[]>([]);

  const loadData = async () => {
    if (!user || scopeLoading) return;
    setLoading(true);

    try {
      // 1. Fetch lookup maps (Teams and Profiles)
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, club_id, clubs(id, name, association_id)");
      
      if (teamsError) throw teamsError;

      const teamLookup = new Map<string, any>(
        (teamsData || []).map((t: any) => [
          t.id,
          {
            id: t.id,
            name: t.name,
            clubId: t.club_id,
            clubName: t.clubs?.name || "",
            associationId: t.clubs?.association_id
          }
        ])
      );

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");

      if (profilesError) throw profilesError;

      const profileLookup = new Map<string, string>(
        (profilesData || []).map((p: any) => [
          p.id,
          `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown"
        ])
      );

      // Access checks helper
      const hasAccessToTeam = (teamId: string | null) => {
        if (isSuperAdmin) return true;
        if (!teamId) return false;
        const t = teamLookup.get(teamId);
        if (!t) return false;
        if (scopedAssociationIds.includes(t.associationId)) return true;
        if (scopedClubIds.includes(t.clubId)) return true;
        if (scopedTeamIds.includes(t.id)) return true;
        return false;
      };

      // 2. Fetch Primary Requests
      const { data: pcrData, error: pcrError } = await supabase
        .from("primary_change_requests")
        .select("*")
        .order("requested_at", { ascending: false });

      if (pcrError) throw pcrError;

      const filteredPcr = (pcrData || [])
        .filter((req: any) => hasAccessToTeam(req.to_team_id))
        .map((req: any) => ({
          ...req,
          playerName: profileLookup.get(req.user_id) || "Unknown User",
          fromTeamName: req.from_team_id ? (teamLookup.get(req.from_team_id)?.name || "Unknown") : "None",
          toTeamName: req.to_team_id ? (teamLookup.get(req.to_team_id)?.name || "Unknown") : "Unknown",
          resolvedByName: req.resolved_by ? (profileLookup.get(req.resolved_by) || "Unknown") : "—"
        }));

      // 3. Fetch Additional Team Requests
      const { data: atrData, error: atrError } = await supabase
        .from("team_memberships")
        .select("id, user_id, team_id, membership_type, status, created_at")
        .neq("membership_type", "PRIMARY")
        .order("created_at", { ascending: false });

      if (atrError) throw atrError;

      const filteredAtr = (atrData || [])
        .filter((req: any) => hasAccessToTeam(req.team_id))
        .map((req: any) => ({
          ...req,
          playerName: profileLookup.get(req.user_id) || "Unknown User",
          teamName: teamLookup.get(req.team_id)?.name || "Unknown",
          clubName: teamLookup.get(req.team_id)?.clubName || "Unknown"
        }));

      setPrimaryRequests(filteredPcr);
      setAdditionalRequests(filteredAtr);

    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error fetching requests",
        description: err.message || "Failed to load requests",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, scopeLoading, isSuperAdmin]);

  // Actions for Primary Team Changes
  const handleAcceptPcr = async (record: PrimaryChangeRequest) => {
    try {
      const { error } = await supabase
        .from("primary_change_requests")
        .update({
          status: "ADMIN_APPROVED",
          resolved_by: user!.id,
          resolved_at: new Date().toISOString()
        })
        .eq("id", record.id);
      
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: record.user_id,
        title: "Primary Team Approved",
        message: `Your request to change your primary team to ${record.toTeamName} has been approved.`,
        type: "team_request_update"
      });

      toast({ title: "Request approved", description: "The primary team change was approved." });
      loadData();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeclinePcr = async (record: PrimaryChangeRequest) => {
    try {
      const { error } = await supabase
        .from("primary_change_requests")
        .update({
          status: "DECLINED",
          resolved_by: user!.id,
          resolved_at: new Date().toISOString()
        })
        .eq("id", record.id);
      
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: record.user_id,
        title: "Primary Team Declined",
        message: `Your request to change your primary team to ${record.toTeamName} was declined.`,
        type: "team_request_update"
      });

      toast({ title: "Request declined", description: "The primary team change was declined." });
      loadData();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  // Actions for Additional Team Requests
  const handleAcceptAtr = async (record: AdditionalTeamRequest) => {
    try {
      const { error } = await supabase
        .from("team_memberships")
        .update({ status: "APPROVED" })
        .eq("id", record.id);
      
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: record.user_id,
        title: "Team Request Approved",
        message: `Your request to join ${record.teamName} has been approved.`,
        type: "team_request_update"
      });

      toast({ title: "Request approved", description: "The team membership was approved." });
      loadData();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeclineAtr = async (record: AdditionalTeamRequest) => {
    try {
      const { error } = await supabase
        .from("team_memberships")
        .update({ status: "DECLINED" })
        .eq("id", record.id);
      
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: record.user_id,
        title: "Team Request Declined",
        message: `Your request to join ${record.teamName} was declined.`,
        type: "team_request_update"
      });

      toast({ title: "Request declined", description: "The team membership was declined." });
      loadData();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  // Filters
  const visiblePcr = primaryRequests.filter((r) => {
    if (statusFilter === "Pending") return r.status === "PENDING";
    if (statusFilter === "Approved") return r.status === "APPROVED" || r.status === "ADMIN_APPROVED";
    if (statusFilter === "Declined") return r.status === "DECLINED" || r.status === "CANCELLED";
    return true; // All
  });

  const visibleAtr = additionalRequests.filter((r) => {
    if (statusFilter === "Pending") return r.status === "PENDING";
    if (statusFilter === "Approved") return r.status === "APPROVED" || r.status === "ADMIN_APPROVED";
    if (statusFilter === "Declined") return r.status === "DECLINED" || r.status === "CANCELLED";
    return true; // All
  });

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
    if (status === "APPROVED" || status === "ADMIN_APPROVED") {
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

  return (
    <div className="space-y-6 container py-6 mx-auto max-w-7xl">
      <div>
        <h1 className="text-3xl font-display text-foreground">Requests</h1>
        <p className="text-muted-foreground mt-1">Manage team membership and primary team change requests</p>
      </div>

      <div className="flex gap-2 pb-2">
        {(["All", "Pending", "Approved", "Declined"] as FilterStatus[]).map((f) => (
          <Button
            key={f}
            variant={statusFilter === f ? "default" : "outline"}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="grid gap-6">
        {/* Primary Team Changes Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
            <CardTitle className="text-xl font-display">Primary Team Changes</CardTitle>
            {!loading && <Badge variant="secondary">{visiblePcr.length} requests</Badge>}
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : visiblePcr.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ClipboardList className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p>No primary team change requests</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left align-middle border-collapse font-sans whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Player</th>
                      <th className="pb-3 pr-4 font-medium">From Team</th>
                      <th className="pb-3 pr-4 font-medium w-8"></th>
                      <th className="pb-3 pr-4 font-medium">To Team</th>
                      <th className="pb-3 pr-4 font-medium">Submitted</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">Resolved By</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePcr.map((record) => (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-medium">{record.playerName}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{record.fromTeamName}</td>
                        <td className="py-3 pr-4 text-muted-foreground"><ArrowRight className="w-4 h-4 opacity-50" /></td>
                        <td className="py-3 pr-4 font-medium">{record.toTeamName}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{formatDate(record.requested_at)}</td>
                        <td className="py-3 pr-4">{renderStatusBadge(record.status)}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{record.resolvedByName}</td>
                        <td className="py-3 text-right">
                          {record.status === "PENDING" && (
                            <div className="flex justify-end gap-2">
                              <Button variant="default" size="sm" onClick={() => handleAcceptPcr(record)}>Accept</Button>
                              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeclinePcr(record)}>Decline</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Team Requests Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
            <CardTitle className="text-xl font-display">Additional Team Requests</CardTitle>
            {!loading && <Badge variant="secondary">{visibleAtr.length} requests</Badge>}
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : visibleAtr.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ClipboardList className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p>No additional team requests</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left align-middle border-collapse font-sans whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Player</th>
                      <th className="pb-3 pr-4 font-medium">Team</th>
                      <th className="pb-3 pr-4 font-medium">Club</th>
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Submitted</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAtr.map((record) => (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-medium">{record.playerName}</td>
                        <td className="py-3 pr-4">{record.teamName}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{record.clubName}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{record.membership_type === "FILL_IN" ? "Fill-in" : "Permanent"}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{formatDate(record.created_at)}</td>
                        <td className="py-3 pr-4">{renderStatusBadge(record.status)}</td>
                        <td className="py-3 text-right">
                          {record.status === "PENDING" && (
                            <div className="flex justify-end gap-2">
                              <Button variant="default" size="sm" onClick={() => handleAcceptAtr(record)}>Accept</Button>
                              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeclineAtr(record)}>Decline</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
