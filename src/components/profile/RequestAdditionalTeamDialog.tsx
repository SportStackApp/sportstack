import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface RequestAdditionalTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTeamIds: string[];
  onSuccess: () => void;
}

interface AssociationOption {
  id: string;
  name: string;
}

interface ClubOption {
  id: string;
  name: string;
  association_id: string;
}

interface TeamOption {
  id: string;
  name: string;
  club_id: string;
  division: string | null;
}

export const RequestAdditionalTeamDialog = ({
  open,
  onOpenChange,
  existingTeamIds,
  onSuccess,
}: RequestAdditionalTeamDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [associations, setAssociations] = useState<AssociationOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);

  const [selectedAssociation, setSelectedAssociation] = useState<string>("");
  const [selectedClub, setSelectedClub] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchAssociations = async () => {
      const { data } = await supabase.from("associations").select("id, name").order("name");
      setAssociations(data || []);
    };
    fetchAssociations();
  }, [open]);

  useEffect(() => {
    if (!selectedAssociation) {
      setClubs([]);
      setSelectedClub("");
      return;
    }
    const fetchClubs = async () => {
      const { data } = await supabase
        .from("clubs")
        .select("id, name, association_id")
        .eq("association_id", selectedAssociation)
        .order("name");
      setClubs(data || []);
      setSelectedClub("");
      setSelectedTeam("");
    };
    fetchClubs();
  }, [selectedAssociation]);

  useEffect(() => {
    if (!selectedClub) {
      setTeams([]);
      setSelectedTeam("");
      return;
    }
    const fetchTeams = async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, club_id, division")
        .eq("club_id", selectedClub)
        .order("name");
      // Filter out teams user is already a member of
      const filtered = (data || []).filter((t) => !existingTeamIds.includes(t.id));
      setTeams(filtered);
      setSelectedTeam("");
    };
    fetchTeams();
  }, [selectedClub, existingTeamIds]);

  const handleSubmit = async () => {
    if (!user || !selectedTeam) return;
    setIsLoading(true);

    try {
      // Insert pending membership
      const { error: membershipError } = await supabase.from("team_memberships").insert({
        user_id: user.id,
        team_id: selectedTeam,
        membership_type: "SECONDARY",
        status: "PENDING",
        is_player: true,
      });

      if (membershipError) throw membershipError;

      // Find the team's club to notify admins
      const team = teams.find((t) => t.id === selectedTeam);
      if (team) {
        // Get club and association admins
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .or(
            `and(role.eq.CLUB_ADMIN,club_id.eq.${selectedClub}),and(role.eq.ASSOCIATION_ADMIN,association_id.eq.${selectedAssociation})`
          );

        if (adminRoles && adminRoles.length > 0) {
          const notifications = adminRoles.map((r) => ({
            user_id: r.user_id,
            type: "team_request",
            title: "New Team Membership Request",
            message: `A player has requested to join ${team.name}.`,
            team_id: selectedTeam,
          }));
          await supabase.from("notifications").insert(notifications);
        }
      }

      toast({
        title: "Request Submitted",
        description: "Your team membership request has been sent for approval.",
      });
      onSuccess();
      handleClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAssociation("");
    setSelectedClub("");
    setSelectedTeam("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Additional Team</DialogTitle>
          <DialogDescription>
            Select a team to request membership. Your request will need to be approved by a club or
            association admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Association</Label>
            <Select value={selectedAssociation} onValueChange={setSelectedAssociation}>
              <SelectTrigger>
                <SelectValue placeholder="Select association" />
              </SelectTrigger>
              <SelectContent>
                {associations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAssociation && (
            <div className="space-y-2">
              <Label>Club</Label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger>
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedClub && (
            <div className="space-y-2">
              <Label>Team</Label>
              {teams.length === 0 ? (
                <div className="py-4 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No available teams in this club
                  </p>
                </div>
              ) : (
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.division && ` (${t.division})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedTeam || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
