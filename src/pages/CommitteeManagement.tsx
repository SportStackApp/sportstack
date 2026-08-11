import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CornerDownRight, ExternalLink, FileUp, GitBranch, Loader2, LockKeyhole, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CommitteeActivity } from "@/components/committee/CommitteeActivity";
import { CommitteeChat } from "@/components/committee/CommitteeChat";
import { CommitteeMeetings } from "@/components/committee/CommitteeMeetings";
import { CommitteePolls } from "@/components/committee/CommitteePolls";
import { CommitteeSetupWizard, type CommitteeWizardParent } from "@/components/committee/CommitteeSetupWizard";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

type Committee = Tables<"committees">;
type CommitteePosition = Tables<"committee_positions">;
type CommitteeMember = Tables<"committee_members">;
type CommitteeDocument = Tables<"committee_documents">;
type CommitteeQualification = Tables<"committee_member_qualifications">;

type PermissionKey =
  | "manage_committee"
  | "manage_members"
  | "manage_documents"
  | "manage_polls"
  | "vote"
  | "manage_meetings"
  | "record_minutes"
  | "chat";

const PERMISSIONS: Array<{ key: PermissionKey; label: string }> = [
  { key: "manage_committee", label: "Manage committee setup" },
  { key: "manage_members", label: "Manage members & qualifications" },
  { key: "manage_documents", label: "Manage governance documents" },
  { key: "manage_polls", label: "Create and manage polls" },
  { key: "vote", label: "Vote in committee polls" },
  { key: "manage_meetings", label: "Create templates and meetings" },
  { key: "record_minutes", label: "Record meeting minutes" },
  { key: "chat", label: "Use committee chat" },
];

const emptyPermissionState = () => Object.fromEntries(
  PERMISSIONS.map((permission) => [permission.key, false]),
) as Record<PermissionKey, boolean>;

const profileName = (profile?: { first_name: string | null; last_name: string | null }) =>
  [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unnamed user";

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Australia/Melbourne" })
    .format(new Date(`${value}T00:00:00`))
  : "Current";

const MAX_COMMITTEE_FILE_BYTES = 20 * 1024 * 1024;
const COMMITTEE_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
]);

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";

export default function CommitteeManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    associations,
    clubs,
    selectedAssociationId,
    selectedClubId,
  } = useTeamContext();
  const {
    loading: adminLoading,
    isSuperAdmin,
    scopedAssociationIds,
    scopedClubIds,
  } = useAdminScope();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState("");
  const [positions, setPositions] = useState<CommitteePosition[]>([]);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [documents, setDocuments] = useState<CommitteeDocument[]>([]);
  const [qualifications, setQualifications] = useState<CommitteeQualification[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; first_name: string | null; last_name: string | null }>>([]);
  const [eligibleProfiles, setEligibleProfiles] = useState<Array<{ id: string; first_name: string | null; last_name: string | null }>>([]);
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(emptyPermissionState());
  const [createOpen, setCreateOpen] = useState(false);
  const [createParent, setCreateParent] = useState<CommitteeWizardParent | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [qualificationOpen, setQualificationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [qualificationFile, setQualificationFile] = useState<File | null>(null);
  const [positionForm, setPositionForm] = useState({ id: "", title: "", description: "", isPresident: false, permissions: emptyPermissionState() });
  const [memberForm, setMemberForm] = useState({ userId: "", positionId: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", notes: "" });
  const [documentForm, setDocumentForm] = useState({ title: "", type: "Governance", notes: "" });
  const [qualificationForm, setQualificationForm] = useState({ memberId: "", title: "", issuer: "", obtainedDate: "", expiryDate: "", notes: "" });

  const area = searchParams.get("area") === "admin" ? "admin" : "work";
  const defaultTab = area === "admin" ? "positions" : "calendar";
  const activeTab = searchParams.get("tab") || defaultTab;
  const setWorkspace = (nextArea: "work" | "admin", nextTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("area", nextArea);
    next.set("tab", nextTab);
    if (selectedCommitteeId) next.set("committee", selectedCommitteeId);
    setSearchParams(next, { replace: true });
  };

  const selectedCommittee = committees.find((committee) => committee.id === selectedCommitteeId);
  const selectedParentCommittee = selectedCommittee?.parent_committee_id
    ? committees.find((committee) => committee.id === selectedCommittee.parent_committee_id)
    : undefined;
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const associationById = useMemo(() => new Map(associations.map((association) => [association.id, association])), [associations]);
  const clubById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs]);

  const manageableClubs = useMemo(() => clubs.filter((club) =>
    isSuperAdmin || scopedAssociationIds.includes(club.association_id) || scopedClubIds.includes(club.id),
  ), [clubs, isSuperAdmin, scopedAssociationIds, scopedClubIds]);
  const manageableAssociations = useMemo(() => associations.filter((association) =>
    isSuperAdmin
    || scopedAssociationIds.includes(association.id)
    || manageableClubs.some((club) => club.association_id === association.id),
  ), [associations, isSuperAdmin, manageableClubs, scopedAssociationIds]);
  const canCreateCommittee = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;
  const canCreateAssociationCommittee = isSuperAdmin || scopedAssociationIds.length > 0;
  const rootCommittees = useMemo(() => {
    const accessibleIds = new Set(committees.map((committee) => committee.id));
    return committees.filter((committee) =>
      !committee.parent_committee_id || !accessibleIds.has(committee.parent_committee_id),
    );
  }, [committees]);
  const subcommitteesByParent = useMemo(() => {
    const grouped = new Map<string, Committee[]>();
    committees.filter((committee) => committee.parent_committee_id).forEach((committee) => {
      const parentId = committee.parent_committee_id as string;
      grouped.set(parentId, [...(grouped.get(parentId) || []), committee]);
    });
    return grouped;
  }, [committees]);

  const loadCommittees = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [committeeResult, profileResult] = await Promise.all([
      supabase.from("committees").select("*").order("name"),
      supabase.from("profiles").select("id, first_name, last_name").order("last_name").order("first_name"),
    ]);
    if (committeeResult.error || profileResult.error) {
      setError(committeeResult.error?.message || profileResult.error?.message || "Committee data could not be loaded.");
      setCommittees([]);
      setProfiles([]);
    } else {
      setCommittees(committeeResult.data || []);
      setProfiles(profileResult.data || []);
      setSelectedCommitteeId((current) =>
        (searchParams.get("committee") || current) && committeeResult.data?.some((committee) => committee.id === (searchParams.get("committee") || current))
          ? searchParams.get("committee") || current
          : committeeResult.data?.[0]?.id || "",
      );
    }
    setLoading(false);
  }, [searchParams]);

  const changeCommittee = (committeeId: string) => {
    setSelectedCommitteeId(committeeId);
    const next = new URLSearchParams(searchParams);
    next.set("committee", committeeId);
    setSearchParams(next, { replace: true });
  };

  const loadCommitteeDetail = useCallback(async () => {
    if (!selectedCommitteeId) {
      setPositions([]);
      setMembers([]);
      setDocuments([]);
      setQualifications([]);
      setPermissions(emptyPermissionState());
      return;
    }
    const permissionResults = await Promise.all(PERMISSIONS.map(async (permission) => {
      const { data } = await supabase.rpc("has_committee_permission", {
        p_committee_id: selectedCommitteeId,
        p_permission_key: permission.key,
      });
      return [permission.key, Boolean(data)] as const;
    }));
    const [positionResult, memberResult, documentResult, qualificationResult] = await Promise.all([
      supabase.from("committee_positions").select("*").eq("committee_id", selectedCommitteeId).order("sort_order").order("title"),
      supabase.from("committee_members").select("*").eq("committee_id", selectedCommitteeId).order("start_date", { ascending: false }),
      supabase.from("committee_documents").select("*").eq("committee_id", selectedCommitteeId).order("title"),
      supabase.from("committee_member_qualifications").select("*").order("expiry_date"),
    ]);
    const failure = [positionResult, memberResult, documentResult, qualificationResult].find((result) => result.error)?.error;
    if (failure) {
      toast({ title: "Committee details unavailable", description: failure.message, variant: "destructive" });
      return;
    }
    const loadedMembers = memberResult.data || [];
    const memberIds = new Set(loadedMembers.map((member) => member.id));
    setPositions(positionResult.data || []);
    setMembers(loadedMembers);
    setDocuments(documentResult.data || []);
    setQualifications((qualificationResult.data || []).filter((qualification) => memberIds.has(qualification.committee_member_id)));
    setPermissions(Object.fromEntries(permissionResults) as Record<PermissionKey, boolean>);
  }, [selectedCommitteeId, toast]);

  useEffect(() => {
    if (!adminLoading) void loadCommittees();
  }, [adminLoading, loadCommittees]);

  useEffect(() => {
    void loadCommitteeDetail();
  }, [loadCommitteeDetail]);

  const preferredWizardScope = () => {
    const preferredClub = manageableClubs.find((club) => club.id === selectedClubId);
    const preferredAssociation = manageableAssociations.find((association) => association.id === selectedAssociationId)
      || manageableAssociations[0]
      || associationById.get(preferredClub?.association_id || "");
    return {
      associationId: preferredAssociation?.id || preferredClub?.association_id || "",
      clubId: preferredClub?.id || "",
    };
  };

  const openCreateCommittee = () => {
    setCreateParent(null);
    setCreateOpen(true);
  };

  const openCreateSubcommittee = () => {
    if (!selectedCommittee || selectedCommittee.parent_committee_id) return;
    setCreateParent({
      id: selectedCommittee.id,
      name: selectedCommittee.name,
      associationId: selectedCommittee.association_id,
      associationName: associationById.get(selectedCommittee.association_id)?.name || "Association",
      clubId: selectedCommittee.club_id,
      clubName: selectedCommittee.club_id ? clubById.get(selectedCommittee.club_id)?.name || "Club" : null,
      scopeType: selectedCommittee.scope_type as "ASSOCIATION" | "CLUB",
    });
    setCreateOpen(true);
  };

  const handleCommitteeCreated = async (committeeId: string) => {
    await loadCommittees();
    changeCommittee(committeeId);
  };

  const openMemberDialog = async () => {
    if (!selectedCommittee) return;
    const { data, error: candidateError } = await supabase.rpc("list_committee_candidates", {
      p_association_id: selectedCommittee.association_id,
      ...(selectedCommittee.club_id ? { p_club_id: selectedCommittee.club_id } : {}),
      ...(selectedCommittee.parent_committee_id ? { p_parent_committee_id: selectedCommittee.parent_committee_id } : {}),
    });
    if (candidateError) {
      toast({ title: "Eligible people could not be loaded", description: candidateError.message, variant: "destructive" });
      return;
    }
    setEligibleProfiles((data || []).map((candidate) => ({
      id: candidate.profile_id,
      first_name: candidate.display_name,
      last_name: null,
    })));
    setMemberOpen(true);
  };

  const closeCommittee = async () => {
    if (!selectedCommittee || !user) return;
    setSaving(true);
    const { error: closeError } = await supabase.from("committees").update({
      is_active: false,
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    }).eq("id", selectedCommittee.id);
    if (closeError) {
      toast({ title: "Committee not closed", description: closeError.message, variant: "destructive" });
    } else {
      toast({ title: "Committee closed", description: "Its records have been kept and remain available to authorised administrators." });
      setCloseOpen(false);
      await loadCommittees();
    }
    setSaving(false);
  };

  const openNewPosition = () => {
    setPositionForm({ id: "", title: "", description: "", isPresident: false, permissions: emptyPermissionState() });
    setPositionOpen(true);
  };

  const openEditPosition = (position: CommitteePosition) => {
    const savedPermissions = position.permissions && typeof position.permissions === "object" && !Array.isArray(position.permissions)
      ? position.permissions as Record<string, Json | undefined>
      : {};
    setPositionForm({
      id: position.id,
      title: position.title,
      description: position.description || "",
      isPresident: position.is_president,
      permissions: Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, savedPermissions[permission.key] === true])) as Record<PermissionKey, boolean>,
    });
    setPositionOpen(true);
  };

  const savePosition = async () => {
    if (!selectedCommitteeId || !positionForm.title.trim()) return;
    setSaving(true);
    const payload = {
      committee_id: selectedCommitteeId,
      title: positionForm.title.trim(),
      description: positionForm.description.trim() || null,
      is_president: positionForm.isPresident,
      permissions: positionForm.permissions,
    };
    const result = positionForm.id
      ? await supabase.from("committee_positions").update(payload).eq("id", positionForm.id)
      : await supabase.from("committee_positions").insert(payload);
    if (result.error) {
      toast({ title: "Position not saved", description: result.error.message, variant: "destructive" });
    } else {
      toast({ title: "Position saved" });
      setPositionOpen(false);
      await loadCommitteeDetail();
    }
    setSaving(false);
  };

  const saveMember = async () => {
    if (!user || !selectedCommitteeId || !memberForm.userId || !memberForm.positionId || !memberForm.startDate) return;
    setSaving(true);
    const { error: saveError } = await supabase.from("committee_members").insert({
      committee_id: selectedCommitteeId,
      position_id: memberForm.positionId,
      user_id: memberForm.userId,
      start_date: memberForm.startDate,
      end_date: memberForm.endDate || null,
      appointment_notes: memberForm.notes.trim() || null,
      appointed_by: user.id,
    });
    if (saveError) {
      toast({ title: "Appointment not saved", description: saveError.message, variant: "destructive" });
    } else {
      toast({ title: "Committee member appointed" });
      setMemberOpen(false);
      setMemberForm({ userId: "", positionId: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", notes: "" });
      await loadCommitteeDetail();
    }
    setSaving(false);
  };

  const saveDocument = async () => {
    if (!user || !selectedCommitteeId || !documentForm.title.trim() || !documentFile) return;
    if (documentFile.size > MAX_COMMITTEE_FILE_BYTES || !COMMITTEE_FILE_TYPES.has(documentFile.type)) {
      toast({ title: "File not accepted", description: "Use PDF, Office, JPG or PNG files up to 20 MB.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const storagePath = `${selectedCommitteeId}/documents/${crypto.randomUUID()}-${safeFileName(documentFile.name)}`;
    const { error: uploadError } = await supabase.storage.from("committee-files").upload(storagePath, documentFile, {
      contentType: documentFile.type,
      upsert: false,
    });
    if (uploadError) {
      toast({ title: "Document not uploaded", description: uploadError.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    const { error: saveError } = await supabase.from("committee_documents").insert({
      committee_id: selectedCommitteeId,
      title: documentForm.title.trim(),
      document_type: documentForm.type.trim() || "Governance",
      document_url: `storage:${storagePath}`,
      notes: documentForm.notes.trim() || null,
      created_by: user.id,
    });
    if (saveError) {
      toast({ title: "Document not saved", description: saveError.message, variant: "destructive" });
    } else {
      toast({ title: "Governance document added" });
      setDocumentOpen(false);
      setDocumentForm({ title: "", type: "Governance", notes: "" });
      setDocumentFile(null);
      await loadCommitteeDetail();
    }
    setSaving(false);
  };

  const saveQualification = async () => {
    if (!user || !qualificationForm.memberId || !qualificationForm.title.trim()) return;
    if (qualificationFile && (qualificationFile.size > MAX_COMMITTEE_FILE_BYTES || !COMMITTEE_FILE_TYPES.has(qualificationFile.type))) {
      toast({ title: "File not accepted", description: "Use PDF, Office, JPG or PNG files up to 20 MB.", variant: "destructive" });
      return;
    }
    setSaving(true);
    let storedDocumentUrl: string | null = null;
    if (qualificationFile) {
      const storagePath = `${selectedCommitteeId}/qualifications/${crypto.randomUUID()}-${safeFileName(qualificationFile.name)}`;
      const { error: uploadError } = await supabase.storage.from("committee-files").upload(storagePath, qualificationFile, {
        contentType: qualificationFile.type,
        upsert: false,
      });
      if (uploadError) {
        toast({ title: "Evidence not uploaded", description: uploadError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      storedDocumentUrl = `storage:${storagePath}`;
    }
    const { error: saveError } = await supabase.from("committee_member_qualifications").insert({
      committee_member_id: qualificationForm.memberId,
      title: qualificationForm.title.trim(),
      issuer: qualificationForm.issuer.trim() || null,
      obtained_date: qualificationForm.obtainedDate || null,
      expiry_date: qualificationForm.expiryDate || null,
      document_url: storedDocumentUrl,
      notes: qualificationForm.notes.trim() || null,
      created_by: user.id,
    });
    if (saveError) {
      toast({ title: "Qualification not saved", description: saveError.message, variant: "destructive" });
    } else {
      toast({ title: "Qualification added" });
      setQualificationOpen(false);
      setQualificationForm({ memberId: "", title: "", issuer: "", obtainedDate: "", expiryDate: "", notes: "" });
      setQualificationFile(null);
      await loadCommitteeDetail();
    }
    setSaving(false);
  };

  const openCommitteeFile = async (documentUrl: string | null) => {
    if (!documentUrl) return;
    if (!documentUrl.startsWith("storage:")) {
      window.open(documentUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error: signedUrlError } = await supabase.storage
      .from("committee-files")
      .createSignedUrl(documentUrl.slice("storage:".length), 300);
    if (signedUrlError || !data?.signedUrl) {
      toast({ title: "File could not be opened", description: signedUrlError?.message || "Please try again.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (adminLoading || loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Committee Management</h1>
          <p className="text-muted-foreground">Private association and club committee setup and records.</p>
        </div>
        {canCreateCommittee && <Button onClick={openCreateCommittee}><Plus className="mr-2 h-4 w-4" />Create Committee</Button>}
      </div>

      {error && <Card className="border-destructive"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card>}

      {committees.length === 0 ? (
        <Card>
          <CardHeader><CardTitle>No accessible committees</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {canCreateCommittee ? "Create an association or club committee to begin." : "You are not currently appointed to an active committee."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Your committees</CardTitle>
                <CardDescription>Subcommittees are shown under their parent committee.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {rootCommittees.map((committee) => {
                  const children = subcommitteesByParent.get(committee.id) || [];
                  return (
                    <div key={committee.id} className="space-y-1">
                      <Button
                        variant={selectedCommitteeId === committee.id ? "secondary" : "ghost"}
                        className="h-auto w-full justify-start px-3 py-2 text-left"
                        onClick={() => changeCommittee(committee.id)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{committee.name}</span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">
                            {committee.parent_committee_id
                              ? "Private subcommittee"
                              : committee.scope_type === "CLUB"
                              ? clubById.get(committee.club_id || "")?.name || "Club committee"
                              : associationById.get(committee.association_id)?.name || "Association committee"}
                          </span>
                        </span>
                        {children.length > 0 && <Badge variant="outline">{children.length}</Badge>}
                      </Button>
                      {children.map((child) => (
                        <Button
                          key={child.id}
                          variant={selectedCommitteeId === child.id ? "secondary" : "ghost"}
                          className="h-auto w-[calc(100%-1rem)] justify-start gap-2 py-2 pl-3 pr-2 text-left ml-4"
                          onClick={() => changeCommittee(child.id)}
                        >
                          <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{child.name}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {child.lifecycle_type === "TEMPORARY" ? "Temporary panel" : "Standing subcommittee"}
                            </span>
                          </span>
                          {!child.is_active && <Badge variant="outline">Closed</Badge>}
                        </Button>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {selectedCommittee && (
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      {selectedCommittee.parent_committee_id && selectedParentCommittee && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                          onClick={() => changeCommittee(selectedCommittee.parent_committee_id as string)}
                        >
                          <GitBranch className="h-4 w-4" />
                          {selectedParentCommittee.name}
                        </button>
                      )}
                      {selectedCommittee.parent_committee_id && !selectedParentCommittee && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />Private subcommittee</p>
                      )}
                      <CardTitle>{selectedCommittee.name}</CardTitle>
                      <CardDescription>{selectedCommittee.description || "No purpose description has been added."}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedCommittee.is_active ? "secondary" : "outline"}>{selectedCommittee.is_active ? "Active" : "Closed"}</Badge>
                      {selectedCommittee.parent_committee_id && <Badge variant="outline"><LockKeyhole className="mr-1 h-3 w-3" />Private subcommittee</Badge>}
                      <Badge variant="outline">{selectedCommittee.lifecycle_type === "TEMPORARY" ? "Temporary" : "Standing"}</Badge>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organisation</p>
                      <p className="mt-1 font-medium">
                        {associationById.get(selectedCommittee.association_id)?.name || "Association"}
                        {selectedCommittee.club_id ? ` • ${clubById.get(selectedCommittee.club_id)?.name || "Club"}` : ""}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifecycle</p>
                      <p className="mt-1 font-medium">
                        {selectedCommittee.lifecycle_type === "TEMPORARY"
                          ? `${formatDate(selectedCommittee.starts_on)}${selectedCommittee.target_end_on ? ` to ${formatDate(selectedCommittee.target_end_on)}` : " — no target date"}`
                          : "Standing — ongoing until formally closed"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                {(permissions.manage_committee || permissions.manage_members) && selectedCommittee.is_active && (
                  <CardContent className="flex flex-wrap gap-2 pt-0">
                    {permissions.manage_committee && !selectedCommittee.parent_committee_id && (
                      <Button onClick={openCreateSubcommittee}><GitBranch className="mr-2 h-4 w-4" />Create subcommittee</Button>
                    )}
                    {permissions.manage_committee && (
                      <Button variant="outline" onClick={() => setCloseOpen(true)}><Archive className="mr-2 h-4 w-4" />Close committee</Button>
                    )}
                  </CardContent>
                )}
              </Card>
            )}
          </div>

          <Tabs value={area} onValueChange={(value) => setWorkspace(value as "work" | "admin", value === "admin" ? "positions" : "calendar")}>
            <TabsList className="grid h-auto w-full grid-cols-2">
              <TabsTrigger value="work">Committee Work</TabsTrigger>
              <TabsTrigger value="admin">Committee Administration</TabsTrigger>
            </TabsList>
          </Tabs>

          {area === "admin" ? (
          <Tabs value={activeTab} onValueChange={(value) => setWorkspace("admin", value)} className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-6">
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="qualifications">Qualifications</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="positions">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div><CardTitle>Position titles & permissions</CardTitle><CardDescription>Permissions apply while a person holds the position.</CardDescription></div>
                  {permissions.manage_committee && <Button size="sm" onClick={openNewPosition}><Plus className="mr-2 h-4 w-4" />Position</Button>}
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-2">
                  {positions.length === 0 ? <p className="text-sm text-muted-foreground">No positions created.</p> : positions.map((position) => (
                    <div key={position.id} className="space-y-2 rounded-lg border px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-medium">{position.title}</p><p className="text-sm text-muted-foreground">{position.description || "No description"}</p></div>
                        {position.is_president && <Badge>President</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {PERMISSIONS.filter((permission) => {
                          const saved = position.permissions as Record<string, Json | undefined>;
                          return saved?.[permission.key] === true;
                        }).map((permission) => <Badge key={permission.key} variant="secondary">{permission.label}</Badge>)}
                      </div>
                      {permissions.manage_committee && <Button variant="outline" size="sm" onClick={() => openEditPosition(position)}>Edit</Button>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div><CardTitle>Appointments</CardTitle><CardDescription>Position, start date and optional end date.</CardDescription></div>
                  {permissions.manage_members && positions.length > 0 && <Button size="sm" onClick={() => void openMemberDialog()}><Plus className="mr-2 h-4 w-4" />Member</Button>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.length === 0 ? <p className="text-sm text-muted-foreground">No committee members appointed.</p> : members.map((member) => (
                    <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <div><p className="font-medium">{profileName(profileById.get(member.user_id))}</p><p className="text-sm text-muted-foreground">{positionById.get(member.position_id)?.title || "Unknown position"}</p></div>
                      <div className="text-sm text-muted-foreground">{formatDate(member.start_date)} – {formatDate(member.end_date)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div><CardTitle>Governance documents</CardTitle><CardDescription>Policies, terms of reference and other controlled links.</CardDescription></div>
                  {permissions.manage_documents && <Button size="sm" onClick={() => setDocumentOpen(true)}><Plus className="mr-2 h-4 w-4" />Document</Button>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents recorded.</p> : documents.map((document) => (
                    <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <div><p className="font-medium">{document.title}</p><p className="text-sm text-muted-foreground">{document.document_type}</p></div>
                      <Button variant="outline" size="sm" onClick={() => void openCommitteeFile(document.document_url)}><ExternalLink className="mr-2 h-4 w-4" />Open</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qualifications">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div><CardTitle>Qualification records</CardTitle><CardDescription>Training, checks and expiry dates tied to appointments.</CardDescription></div>
                  {(permissions.manage_members || members.some((member) => member.user_id === user?.id)) && members.length > 0 && <Button size="sm" onClick={() => setQualificationOpen(true)}><Plus className="mr-2 h-4 w-4" />Qualification</Button>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {qualifications.length === 0 ? <p className="text-sm text-muted-foreground">No qualifications recorded.</p> : qualifications.map((qualification) => {
                    const member = memberById.get(qualification.committee_member_id);
                    return (
                      <div key={qualification.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                        <div><p className="font-medium">{qualification.title}</p><p className="text-sm text-muted-foreground">{profileName(profileById.get(member?.user_id || ""))}{qualification.issuer ? ` • ${qualification.issuer}` : ""}</p></div>
                        <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Expires: {formatDate(qualification.expiry_date)}</span>{qualification.document_url && <Button variant="outline" size="sm" onClick={() => void openCommitteeFile(qualification.document_url)}>Open evidence</Button>}</div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates">
              <CommitteeMeetings
                key={`templates-${selectedCommitteeId}`}
                mode="templates"
                committeeId={selectedCommitteeId}
                associationId={selectedCommittee?.association_id || ""}
                clubId={selectedCommittee?.club_id || null}
                canManage={permissions.manage_meetings}
                canRecordMinutes={permissions.record_minutes}
                profiles={profiles}
                memberProfileIds={members.map((member) => member.user_id)}
              />
            </TabsContent>
            <TabsContent value="activity">
              <CommitteeActivity key={`activity-${selectedCommitteeId}`} committeeId={selectedCommitteeId} profiles={profiles} />
            </TabsContent>
          </Tabs>
          ) : (
          <Tabs value={activeTab} onValueChange={(value) => setWorkspace("work", value)} className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="meetings">Meetings</TabsTrigger>
              <TabsTrigger value="polls">Polls</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="minutes">Minutes</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar">
              <CommitteeMeetings
                key={`calendar-${selectedCommitteeId}`}
                mode="calendar"
                committeeId={selectedCommitteeId}
                associationId={selectedCommittee?.association_id || ""}
                clubId={selectedCommittee?.club_id || null}
                canManage={permissions.manage_meetings}
                canRecordMinutes={permissions.record_minutes}
                profiles={profiles}
                memberProfileIds={members.map((member) => member.user_id)}
              />
            </TabsContent>
            <TabsContent value="polls">
              <CommitteePolls
                key={`polls-${selectedCommitteeId}`}
                committeeId={selectedCommitteeId}
                canManage={permissions.manage_polls}
                canVote={permissions.vote}
              />
            </TabsContent>
            <TabsContent value="meetings">
              <CommitteeMeetings
                key={`meetings-${selectedCommitteeId}`}
                mode="meetings"
                committeeId={selectedCommitteeId}
                associationId={selectedCommittee?.association_id || ""}
                clubId={selectedCommittee?.club_id || null}
                canManage={permissions.manage_meetings}
                canRecordMinutes={permissions.record_minutes}
                profiles={profiles}
                memberProfileIds={members.map((member) => member.user_id)}
              />
            </TabsContent>
            <TabsContent value="chat">
              <CommitteeChat
                key={`chat-${selectedCommitteeId}`}
                committeeId={selectedCommitteeId}
                canChat={permissions.chat}
                profiles={profiles}
              />
            </TabsContent>
            <TabsContent value="minutes">
              <CommitteeMeetings
                key={`minutes-${selectedCommitteeId}`}
                mode="minutes"
                committeeId={selectedCommitteeId}
                associationId={selectedCommittee?.association_id || ""}
                clubId={selectedCommittee?.club_id || null}
                canManage={permissions.manage_meetings}
                canRecordMinutes={permissions.record_minutes}
                profiles={profiles}
                memberProfileIds={members.map((member) => member.user_id)}
              />
            </TabsContent>
          </Tabs>
          )}
        </>
      )}

      {user && (
        <CommitteeSetupWizard
          open={createOpen}
          onOpenChange={setCreateOpen}
          userId={user.id}
          associations={manageableAssociations.map((association) => ({ id: association.id, name: association.name }))}
          clubs={manageableClubs.map((club) => ({ id: club.id, name: club.name, association_id: club.association_id }))}
          canCreateAssociationCommittee={canCreateAssociationCommittee}
          initialAssociationId={preferredWizardScope().associationId}
          initialClubId={preferredWizardScope().clubId}
          parent={createParent}
          onCreated={handleCommitteeCreated}
        />
      )}
      <PositionDialog open={positionOpen} onOpenChange={setPositionOpen} form={positionForm} setForm={setPositionForm} saving={saving} onSave={() => void savePosition()} />
      <SimpleDialog open={memberOpen} onOpenChange={setMemberOpen} title="Appoint committee member" description="Assign a user to a position with appointment dates." saving={saving} onSave={() => void saveMember()}>
        <SelectField label="User" value={memberForm.userId} onChange={(userId) => setMemberForm((current) => ({ ...current, userId }))} options={eligibleProfiles.map((profile) => ({ id: profile.id, name: profileName(profile) }))} />
        <SelectField label="Position" value={memberForm.positionId} onChange={(positionId) => setMemberForm((current) => ({ ...current, positionId }))} options={positions.map((position) => ({ id: position.id, name: position.title }))} />
        <div className="grid grid-cols-2 gap-3"><InputField label="Start date" type="date" value={memberForm.startDate} onChange={(startDate) => setMemberForm((current) => ({ ...current, startDate }))} /><InputField label="End date (optional)" type="date" value={memberForm.endDate} onChange={(endDate) => setMemberForm((current) => ({ ...current, endDate }))} /></div>
        <TextAreaField label="Appointment notes" value={memberForm.notes} onChange={(notes) => setMemberForm((current) => ({ ...current, notes }))} />
      </SimpleDialog>
      <SimpleDialog open={documentOpen} onOpenChange={setDocumentOpen} title="Upload governance document" description="Private committee file. PDF, Office, JPG or PNG; maximum 20 MB." saving={saving} onSave={() => void saveDocument()}>
        <InputField label="Title" value={documentForm.title} onChange={(title) => setDocumentForm((current) => ({ ...current, title }))} /><InputField label="Document type" value={documentForm.type} onChange={(type) => setDocumentForm((current) => ({ ...current, type }))} />
        <FileField label="Document file" file={documentFile} onChange={setDocumentFile} />
        <TextAreaField label="Notes" value={documentForm.notes} onChange={(notes) => setDocumentForm((current) => ({ ...current, notes }))} />
      </SimpleDialog>
      <SimpleDialog open={qualificationOpen} onOpenChange={setQualificationOpen} title="Add qualification" description="Attach training or a check to a current appointment. Evidence is stored privately." saving={saving} onSave={() => void saveQualification()}>
        <SelectField label="Committee member" value={qualificationForm.memberId} onChange={(memberId) => setQualificationForm((current) => ({ ...current, memberId }))} options={members.filter((member) => permissions.manage_members || member.user_id === user?.id).map((member) => ({ id: member.id, name: `${profileName(profileById.get(member.user_id))} — ${positionById.get(member.position_id)?.title || "Position"}` }))} />
        <InputField label="Qualification title" value={qualificationForm.title} onChange={(title) => setQualificationForm((current) => ({ ...current, title }))} /><InputField label="Issuer" value={qualificationForm.issuer} onChange={(issuer) => setQualificationForm((current) => ({ ...current, issuer }))} /><div className="grid grid-cols-2 gap-3"><InputField label="Obtained date" type="date" value={qualificationForm.obtainedDate} onChange={(obtainedDate) => setQualificationForm((current) => ({ ...current, obtainedDate }))} /><InputField label="Expiry date" type="date" value={qualificationForm.expiryDate} onChange={(expiryDate) => setQualificationForm((current) => ({ ...current, expiryDate }))} /></div><FileField label="Evidence file (optional)" file={qualificationFile} onChange={setQualificationFile} /><TextAreaField label="Notes" value={qualificationForm.notes} onChange={(notes) => setQualificationForm((current) => ({ ...current, notes }))} />
      </SimpleDialog>
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {selectedCommittee?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing keeps the committee and all of its records. A parent committee cannot be closed while it has active subcommittees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep open</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void closeCommittee(); }} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Close committee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PositionDialog({ open, onOpenChange, form, setForm, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; form: { id: string; title: string; description: string; isPresident: boolean; permissions: Record<PermissionKey, boolean> }; setForm: React.Dispatch<React.SetStateAction<{ id: string; title: string; description: string; isPresident: boolean; permissions: Record<PermissionKey, boolean> }>>; saving: boolean; onSave: () => void }) {
  return <SimpleDialog open={open} onOpenChange={onOpenChange} title={form.id ? "Edit committee position" : "Add committee position"} description="Set the title and exactly what an appointed person can do." saving={saving} onSave={onSave}>
    <InputField label="Position title" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} />
    <TextAreaField label="Position description" value={form.description} onChange={(description) => setForm((current) => ({ ...current, description }))} />
    <label className="flex items-center gap-2 rounded-md border p-3 text-sm"><Checkbox checked={form.isPresident} onCheckedChange={(checked) => setForm((current) => ({ ...current, isPresident: checked === true }))} />Committee President</label>
    <div className="space-y-2"><Label>Permissions</Label>{PERMISSIONS.map((permission) => <label key={permission.key} className="flex items-center gap-2 rounded-md border p-3 text-sm"><Checkbox checked={form.permissions[permission.key]} onCheckedChange={(checked) => setForm((current) => ({ ...current, permissions: { ...current.permissions, [permission.key]: checked === true } }))} />{permission.label}</label>)}</div>
  </SimpleDialog>;
}

function SimpleDialog({ open, onOpenChange, title, description, children, saving, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: React.ReactNode; saving: boolean; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="space-y-4">{children}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button><Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter></DialogContent></Dialog>;
}

function InputField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm hover:bg-muted/40"><FileUp className="h-4 w-4" /><span className="min-w-0 truncate">{file?.name || "Choose a file"}</span><Input className="hidden" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" onChange={(event) => onChange(event.target.files?.[0] || null)} /></label>{file && <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>}</div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }> }) {
  return <div className="space-y-2"><Label>{label}</Label><Select value={value || undefined} onValueChange={onChange}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}
