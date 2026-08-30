import type { Database } from "@/integrations/supabase/types";

export type ProfileRole = Database["public"]["Enums"]["user_role_enum"];

const ROLE_LABELS: Record<ProfileRole, string> = {
  PLAYER: "Player",
  COACH: "Coach",
  TEAM_MANAGER: "Team Manager",
  CLUB_ADMIN: "Club Admin",
  ASSOCIATION_ADMIN: "Association Admin",
  SUPER_ADMIN: "Super Admin",
  UMPIRE: "Umpire",
  UMPIRE_ADMIN: "Legacy Umpire Admin",
  VOTER: "Voter",
};

const ROLE_EMOJIS: Record<ProfileRole, string> = {
  PLAYER: "🏃",
  COACH: "📋",
  TEAM_MANAGER: "📊",
  CLUB_ADMIN: "🏢",
  ASSOCIATION_ADMIN: "🏛️",
  SUPER_ADMIN: "👑",
  UMPIRE: "🏳️",
  UMPIRE_ADMIN: "🏳️",
  VOTER: "🗳️",
};

export const getProfileRoleLabel = (role: ProfileRole): string => ROLE_LABELS[role];
export const getProfileRoleEmoji = (role: ProfileRole): string => ROLE_EMOJIS[role];
