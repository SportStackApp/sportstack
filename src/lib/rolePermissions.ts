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
    canSee: ["All admin areas", "All associations, clubs, teams, users, feedback, and logs"],
    canEdit: ["System data across all associations", "User roles", "Fixtures, teams, clubs, divisions, and venues"],
    cannotDo: ["Live custom permission switches are not enabled yet"],
  },
  {
    role: "ASSOCIATION_ADMIN",
    label: "Association Admin",
    scope: "Assigned association.",
    canSee: ["Clubs, teams, users, fixtures, requests, and feedback inside their association"],
    canEdit: ["Association-scoped clubs, divisions, teams, venues, fixtures, and user roles"],
    cannotDo: ["Manage unrelated associations", "Read error logs", "Act as a super admin"],
  },
  {
    role: "CLUB_ADMIN",
    label: "Club Admin",
    scope: "Assigned club.",
    canSee: ["Their club, teams, users, fixtures, and requests"],
    canEdit: ["Their club branding", "Their teams and scoped team users"],
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
    canSee: ["MVP vote screens they are eligible for"],
    canEdit: ["Their own vote while voting is open"],
    cannotDo: ["Administer voting sessions", "View admin results unless separately authorised"],
  },
  {
    role: "UMPIRE",
    label: "Umpire",
    scope: "Assigned umpire access.",
    canSee: ["Umpire voting and related fixture context"],
    canEdit: ["Their own umpire vote submission"],
    cannotDo: ["Manage team line-ups", "Access club or association admin tools"],
  },
];
