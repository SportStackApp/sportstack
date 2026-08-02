import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, FlaskConical, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { APP_ENVIRONMENT } from "@/lib/appVersion";

type TestRole = "ASSOCIATION_ADMIN" | "CLUB_ADMIN" | "TEAM_MANAGER" | "COACH" | "PLAYER" | "UMPIRE" | "VOTER";

interface AssociationOption { id: string; name: string }
interface ClubOption { id: string; name: string; association_id: string }
interface DivisionOption { id: string; name: string }
interface TeamOption { id: string; name: string; club_id: string; division_id: string | null }

const DEV_PROJECT_URL = "https://icqegnpjbizccjebjfhb.supabase.co";
const ROLE_OPTIONS: Array<{ value: TestRole; label: string; slug: string }> = [
  { value: "ASSOCIATION_ADMIN", label: "Association Admin", slug: "association-admin" },
  { value: "CLUB_ADMIN", label: "Club Admin", slug: "club-admin" },
  { value: "TEAM_MANAGER", label: "Team Manager", slug: "team-manager" },
  { value: "COACH", label: "Coach", slug: "coach" },
  { value: "PLAYER", label: "Player", slug: "player" },
  { value: "UMPIRE", label: "Umpire", slug: "umpire" },
  { value: "VOTER", label: "Voter", slug: "voter" },
];

const createTemporaryPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `Ss!${body}9`;
};

const errorMessage = async (error: unknown) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        // Fall back to the normal client error below.
      }
    }
  }
  return error instanceof Error ? error.message : "The Dev test account could not be provisioned.";
};

export function DevTestAccountProvisioner() {
  const { toast } = useToast();
  const { actualIsSuperAdmin, actorMode } = useAdminScope();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [associations, setAssociations] = useState<AssociationOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [role, setRole] = useState<TestRole>("ASSOCIATION_ADMIN");
  const [associationId, setAssociationId] = useState("");
  const [clubId, setClubId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState(createTemporaryPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [provisioned, setProvisioned] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exactDevProject = APP_ENVIRONMENT === "DEV"
    && import.meta.env.VITE_SUPABASE_URL === DEV_PROJECT_URL;
  const allowed = exactDevProject && actualIsSuperAdmin && actorMode === "super_admin";

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const loadOptions = async () => {
      setLoading(true);
      const [associationResult, clubResult, divisionResult, teamResult] = await Promise.all([
        supabase.from("associations").select("id, name").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("divisions").select("id, name").order("name"),
        supabase.from("teams").select("id, name, club_id, division_id").order("name"),
      ]);
      if (cancelled) return;
      const failure = [associationResult, clubResult, divisionResult, teamResult].find((result) => result.error)?.error;
      if (failure) {
        toast({ title: "Test account options could not load", description: failure.message, variant: "destructive" });
      } else {
        setAssociations(associationResult.data || []);
        setClubs(clubResult.data || []);
        setDivisions(divisionResult.data || []);
        setTeams(teamResult.data || []);
      }
      setLoading(false);
    };
    void loadOptions();
    return () => { cancelled = true; };
  }, [allowed, toast]);

  const availableClubs = useMemo(
    () => clubs.filter((club) => club.association_id === associationId),
    [associationId, clubs],
  );
  const availableClubIds = useMemo(() => new Set(availableClubs.map((club) => club.id)), [availableClubs]);
  const availableTeams = useMemo(
    () => teams.filter((team) => availableClubIds.has(team.club_id) && (!clubId || team.club_id === clubId)),
    [availableClubIds, clubId, teams],
  );

  useEffect(() => {
    if (!associations.some((association) => association.id === associationId)) setAssociationId(associations[0]?.id || "");
  }, [associationId, associations]);
  useEffect(() => {
    if (!availableClubs.some((club) => club.id === clubId)) setClubId(availableClubs[0]?.id || "");
  }, [availableClubs, clubId]);
  useEffect(() => {
    if (!availableTeams.some((team) => team.id === teamId)) setTeamId(availableTeams[0]?.id || "");
  }, [availableTeams, teamId]);

  const roleOption = ROLE_OPTIONS.find((option) => option.value === role) || ROLE_OPTIONS[0];
  const email = `codex.${roleOption.slug}.dev@sportstackapp.com.au`;
  const needsAssociation = role === "ASSOCIATION_ADMIN";
  const needsClub = role === "CLUB_ADMIN";
  const needsTeam = ["TEAM_MANAGER", "COACH", "PLAYER"].includes(role);
  const scopeReady = (!needsAssociation || Boolean(associationId))
    && (!needsClub || Boolean(clubId))
    && (!needsTeam || Boolean(teamId));
  const selectedAssociationName = associations.find((association) => association.id === associationId)?.name;
  const selectedClubName = clubs.find((club) => club.id === clubId)?.name;
  const selectedTeam = teams.find((team) => team.id === teamId);
  const selectedDivisionName = divisions.find((division) => division.id === selectedTeam?.division_id)?.name;
  const scopeSummary = needsTeam
    ? [selectedAssociationName, selectedClubName, selectedDivisionName, selectedTeam?.name].filter(Boolean).join(" / ")
    : needsClub
      ? [selectedAssociationName, selectedClubName].filter(Boolean).join(" / ")
      : needsAssociation
        ? selectedAssociationName || "No association selected"
        : "All permitted Dev scope";

  const resetPassword = () => {
    setPassword(createTemporaryPassword());
    setProvisioned(false);
  };

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
      toast({ title: "Credentials copied", description: "These disposable Dev credentials were copied to your clipboard." });
    } catch {
      toast({
        title: "Credentials could not be copied",
        description: "Use the visible email and password fields instead.",
        variant: "destructive",
      });
    }
  };

  const provisionAccount = async () => {
    if (!scopeReady) return;
    setSaving(true);
    setProvisioned(false);
    const { data, error } = await supabase.functions.invoke("provision-dev-test-account", {
      body: {
        email,
        password,
        role,
        association_id: needsAssociation || needsClub || needsTeam ? associationId : null,
        club_id: needsClub || needsTeam ? clubId : null,
        team_id: needsTeam ? teamId : null,
      },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({
        title: "Test account could not be provisioned",
        description: data?.error || await errorMessage(error),
        variant: "destructive",
      });
      return;
    }
    setConfirmOpen(false);
    setProvisioned(true);
    toast({
      title: "Dev test account created",
      description: `${roleOption.label} is ready for actual-role testing.`,
    });
  };

  if (!allowed) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Dev test accounts
        </CardTitle>
        <CardDescription>
          Create one disposable account with one real role. Each reserved role account is created once in SportStack Dev by an actual Super Admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading organisation scopes...</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Actual role</Label>
                <Select value={role} onValueChange={(value) => {
                  setRole(value as TestRole);
                  setPassword(createTemporaryPassword());
                  setProvisioned(false);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(needsAssociation || needsClub || needsTeam) && (
                <div className="space-y-2">
                  <Label>Association</Label>
                  <Select value={associationId} onValueChange={(value) => { setAssociationId(value); setClubId(""); setTeamId(""); setProvisioned(false); }}>
                    <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select association" /></SelectTrigger>
                    <SelectContent>{associations.map((association) => <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {(needsClub || needsTeam) && (
                <div className="space-y-2">
                  <Label>Club</Label>
                  <Select value={clubId} onValueChange={(value) => { setClubId(value); setTeamId(""); setProvisioned(false); }}>
                    <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select club" /></SelectTrigger>
                    <SelectContent>{availableClubs.map((club) => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {needsTeam && (
                <div className="space-y-2">
                  <Label>Team</Label>
                  <Select value={teamId} onValueChange={(value) => { setTeamId(value); setProvisioned(false); }}>
                    <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select team" /></SelectTrigger>
                    <SelectContent>{availableTeams.map((team) => {
                      const division = divisions.find((item) => item.id === team.division_id)?.name;
                      return <SelectItem key={team.id} value={team.id}>{division ? `${division} - ${team.name}` : team.name}</SelectItem>;
                    })}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Reserved Dev email</Label>
                <Input value={email} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Temporary password</Label>
                <div className="flex gap-2">
                  <Input value={password} readOnly type={showPassword ? "text" : "password"} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide temporary password" : "Show temporary password"}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={resetPassword} aria-label="Generate a new temporary password">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {provisioned && (
              <Alert>
                <UserPlus className="h-4 w-4" />
                <AlertTitle>Account ready</AlertTitle>
                <AlertDescription>Copy the credentials now. Existing test identities are never re-scoped or password-reset automatically.</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={copyCredentials} disabled={!provisioned}>
                <Copy className="mr-2 h-4 w-4" /> Copy credentials
              </Button>
              <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!scopeReady || saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {saving ? "Provisioning..." : "Create account"}
              </Button>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Create this Dev test account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This creates the reserved {roleOption.label} account once. Existing identities are rejected without changing their password or scope. Selected scope: {scopeSummary}. This never targets a normal user or Production.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void provisionAccount()}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
