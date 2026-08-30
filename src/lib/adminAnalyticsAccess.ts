import type { AppMode } from "@/contexts/AppModeContext";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role_enum"];

export const ANALYTICS_ADMIN_MODES = ["super_admin", "association", "club"] as const satisfies readonly AppMode[];

export function canViewIndividualPlayerMvpVotes(
  isSuperAdmin: boolean,
  highestScopedRole: UserRole | null | undefined,
): boolean {
  return isSuperAdmin || highestScopedRole === "CLUB_ADMIN";
}
