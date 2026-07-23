import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users } from "lucide-react";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RosterMember {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: number | null;
  membership_type: string;
  registered_club_id: string | null;
}

const positionGroups: Record<string, string[]> = {
  Strikers: ["Left Wing", "Centre Forward", "Right Wing"],
  Midfielders: ["Left Inside", "Centre Half", "Right Inside"],
  Backs: ["Left Half", "Fullback", "Right Half"],
  Goalkeeper: ["Goalkeeper"],
};

const Roster = () => {
  const { selectedTeamId, selectedTeam, selectedClub } = useTeamContext();
  const { toast } = useToast();
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoster = async () => {
      if (!selectedTeamId) {
        setMembers([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data: membershipData, error: membershipError } = await supabase
        .from("team_memberships")
        .select("user_id, position, jersey_number, membership_type")
        .eq("team_id", selectedTeamId)
        .eq("status", "ACTIVE");

      if (membershipError) {
        toast({
          title: "Roster could not be loaded",
          description: membershipError.message,
          variant: "destructive",
        });
        setMembers([]);
        setLoading(false);
        return;
      }

      if (membershipData && membershipData.length > 0) {
        const userIds = membershipData.map((m) => m.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, registered_club_id")
          .in("id", userIds);

        if (profileError) {
          toast({
            title: "Player names could not be loaded",
            description: profileError.message,
            variant: "destructive",
          });
        }

        const merged: RosterMember[] = membershipData.map((m) => {
          const profile = profiles?.find((p) => p.id === m.user_id);
          const membershipType = profile?.registered_club_id
            ? profile.registered_club_id === selectedTeam?.club_id
              ? "PRIMARY"
              : "SECONDARY"
            : m.membership_type === "PRIMARY"
              ? "PRIMARY"
              : "SECONDARY";
          return {
            user_id: m.user_id,
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
            position: m.position,
            jersey_number: m.jersey_number,
            membership_type: membershipType,
            registered_club_id: profile?.registered_club_id || null,
          };
        });
        setMembers(merged);
      } else {
        setMembers([]);
      }
      setLoading(false);
    };
    fetchRoster();
  }, [selectedTeam?.club_id, selectedTeamId, toast]);

  const filteredMembers = members.filter((m) => {
    const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = selectedPosition ? m.position === selectedPosition : true;
    return matchesSearch && matchesPosition;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">
          TEAM ROSTER
        </h1>
        <p className="text-muted-foreground mt-1">
          {selectedTeam?.name || "Select a team"} {selectedClub ? `• ${selectedClub.name}` : ""} • {members.length} players
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedPosition === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPosition(null)}
          >
            All
          </Button>
          {Object.keys(positionGroups).map((group) => (
            <Button
              key={group}
              variant={
                positionGroups[group].includes(selectedPosition || "")
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => setSelectedPosition(positionGroups[group][0])}
            >
              {group}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member, index) => (
            <Card
              key={member.user_id}
              variant="interactive"
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display text-2xl">
                    {member.jersey_number || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {[member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown Player"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {member.position || "No position"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="player" className="text-xs">
                        {member.membership_type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredMembers.length === 0 && (
        <Card variant="ghost" className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {members.length === 0 ? "No players in this team yet." : "No players found."}
          </p>
        </Card>
      )}
    </div>
  );
};

export default Roster;
