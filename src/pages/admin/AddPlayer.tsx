import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, UserPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { ScopedTeamSelector } from "@/components/admin/ScopedTeamSelector";
import { supabase } from "@/integrations/supabase/client";

interface AdditionalTeam {
  id: string;
  team_id: string;
  membership_type: "SECONDARY" | "FILL_IN";
}

const AddPlayer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin } = useAdminScope();
  const [submitting, setSubmitting] = useState(false);

  const [primaryTeamId, setPrimaryTeamId] = useState("");
  const [additionalTeams, setAdditionalTeams] = useState<AdditionalTeam[]>([]);

  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    phone: "",
    suburb: "",
    hockey_vic_number: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
  });

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) {
      navigate("/dashboard");
    }
  }, [scopeLoading, isAnyAdmin, navigate]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addAdditionalTeam = () => {
    setAdditionalTeams((prev) => [
      ...prev,
      { id: crypto.randomUUID(), team_id: "", membership_type: "SECONDARY" },
    ]);
  };

  const removeAdditionalTeam = (id: string) => {
    setAdditionalTeams((prev) => prev.filter((t) => t.id !== id));
  };

  const updateAdditionalTeam = (id: string, field: "team_id" | "membership_type", value: string) => {
    setAdditionalTeams((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.first_name || !form.last_name || !primaryTeamId) {
      toast({
        title: "Missing Fields",
        description: "Please fill in email, first name, last name, and select a primary team.",
        variant: "destructive",
      });
      return;
    }

    const teamAssignments = [
      { team_id: primaryTeamId, membership_type: "PRIMARY" as const },
      ...additionalTeams
        .filter((t) => t.team_id)
        .map((t) => ({ team_id: t.team_id, membership_type: t.membership_type })),
    ];

    setSubmitting(true);

    const { data, error } = await supabase.functions.invoke("create-player", {
      body: {
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone || null,
        suburb: form.suburb || null,
        hockey_vic_number: form.hockey_vic_number || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        emergency_contact_relationship: form.emergency_contact_relationship || null,
        team_assignments: teamAssignments,
      },
    });

    setSubmitting(false);

    if (error || data?.error) {
      toast({
        title: "Error",
        description: data?.error || error?.message || "Failed to create player",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Player Invited",
      description: `An invitation email has been sent to ${form.email}.`,
    });
    navigate("/admin/users");
  };

  if (scopeLoading) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Player</h1>
          <p className="text-muted-foreground">Enter player details and assign to teams</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Primary Team */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Primary Team</CardTitle>
          </CardHeader>
          <CardContent>
            <ScopedTeamSelector
              selectedTeamId={primaryTeamId}
              onTeamChange={setPrimaryTeamId}
            />
          </CardContent>
        </Card>

        {/* Additional Teams */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Additional Teams</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addAdditionalTeam}>
              <Plus className="h-4 w-4 mr-1" />
              Add Team
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {additionalTeams.length === 0 && (
              <p className="text-sm text-muted-foreground">No additional teams assigned.</p>
            )}
            {additionalTeams.map((at) => (
              <div key={at.id} className="space-y-3 p-4 border rounded-lg relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => removeAdditionalTeam(at.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <ScopedTeamSelector
                  selectedTeamId={at.team_id}
                  onTeamChange={(id) => updateAdditionalTeam(at.id, "team_id", id)}
                />
                <div className="space-y-2 max-w-xs">
                  <Label>Membership Type</Label>
                  <Select
                    value={at.membership_type}
                    onValueChange={(v) => updateAdditionalTeam(at.id, "membership_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SECONDARY">Secondary</SelectItem>
                      <SelectItem value="FILL_IN">Fill-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => updateField("date_of_birth", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="0400 000 000"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="suburb">Address</Label>
                <Textarea
                  id="suburb"
                  value={form.suburb}
                  onChange={(e) => updateField("suburb", e.target.value)}
                  placeholder="Enter full address"
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hv_number">Hockey Victoria Number</Label>
                <Input
                  id="hv_number"
                  value={form.hockey_vic_number}
                  onChange={(e) => updateField("hockey_vic_number", e.target.value)}
                  placeholder="e.g. HV12345"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ec_name">Name</Label>
              <Input
                id="ec_name"
                value={form.emergency_contact_name}
                onChange={(e) => updateField("emergency_contact_name", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ec_phone">Phone</Label>
                <Input
                  id="ec_phone"
                  value={form.emergency_contact_phone}
                  onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ec_rel">Relationship</Label>
                <Input
                  id="ec_rel"
                  value={form.emergency_contact_relationship}
                  onChange={(e) => updateField("emergency_contact_relationship", e.target.value)}
                  placeholder="e.g. Spouse, Parent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          {submitting ? "Creating Player..." : "Add Player"}
        </Button>
      </form>
    </div>
  );
};

export default AddPlayer;
