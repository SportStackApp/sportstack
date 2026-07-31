import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface RolePermissionSummary {
  role: AppRole;
  label: string;
  scope: string;
  canSee: string[];
  canEdit: string[];
  cannotDo: string[];
}

export const ROLE_PERMISSION_SUMMARIES: RolePermissionSummary[] = [
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    scope: "Whole SportStack system.",
    canSee: ["All admin areas", "Both voting modules, committees, Safety Hub, feedback, and logs"],
    canEdit: ["System data across all associations", "User roles", "Module overrides at every organisation level"],
    cannotDo: ["Bypass Production approval or destructive-data safeguards"],
  },
  {
    role: "ASSOCIATION_ADMIN",
    label: "Association Admin",
    scope: "Assigned association.",
    canSee: ["Clubs, teams, users, fixtures, requests, both voting modules, committees and Safety Hub inside their association"],
    canEdit: ["Association-scoped data", "Module overrides at association, club, division and team level"],
    cannotDo: ["Manage unrelated associations", "Read error logs", "Act as a super admin"],
  },
  {
    role: "CLUB_ADMIN",
    label: "Club Admin",
    scope: "Assigned club.",
    canSee: ["Their club, teams, users, fixtures, requests, committee and enabled modules"],
    canEdit: ["Their club branding and teams", "Module overrides at their club and team levels"],
    cannotDo: ["Manage other clubs", "Manage association-wide settings", "Read system logs"],
  },
  {
    role: "TEAM_MANAGER",
    label: "Team Manager",
    scope: "Assigned team.",
    canSee: ["Their team dashboard, fixtures, roster, availability, and line-ups"],
    canEdit: ["Their team line-ups and team-level player details"],
    cannotDo: ["Manage club settings", "Manage unrelated teams", "Access broad admin tools"],
  },
  {
    role: "COACH",
    label: "Coach",
    scope: "Assigned team.",
    canSee: ["Their team dashboard, coaching tools, roster, availability, and line-ups"],
    canEdit: ["Their team line-ups", "Coaching notes and position assessments"],
    cannotDo: ["Manage club settings", "Manage unrelated teams", "Access broad admin tools"],
  },
  {
    role: "PLAYER",
    label: "Player",
    scope: "Teams they are a member of.",
    canSee: ["Their dashboard, fixtures, roster, team availability, and allowed line-ups"],
    canEdit: ["Their own availability and profile details"],
    cannotDo: ["Edit line-ups", "Access admin tools", "View unrelated team details"],
  },
  {
    role: "VOTER",
    label: "Voter",
    scope: "Voting links or assigned voting access.",
    canSee: ["Player MVP Voting screens they are eligible for"],
    canEdit: ["Their own Player MVP ballot while the session is open"],
    cannotDo: ["Administer Player MVP sessions", "View Player MVP results unless separately authorised"],
  },
  {
    role: "UMPIRE",
    label: "Umpire",
    scope: "Assigned umpire access.",
    canSee: ["Umpire Match Voting and its completed-fixture context"],
    canEdit: ["Their own authorised Umpire Match Voting ballot"],
    cannotDo: ["Manage team line-ups", "Access club or association admin tools"],
  },
];
