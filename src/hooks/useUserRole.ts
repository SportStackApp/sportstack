import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTestRole } from "@/contexts/TestRoleContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Role hierarchy from highest to lowest
const ROLE_HIERARCHY: AppRole[] = [
  "SUPER_ADMIN",
  "ASSOCIATION_ADMIN",
  "CLUB_ADMIN",
  "TEAM_MANAGER",
  "COACH",
  "PLAYER",
  "UMPIRE",
  "VOTER",
];

interface UseUserRoleReturn {
  roles: AppRole[];
  highestRole: AppRole | null;
  loading: boolean;
  error: Error | null;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  refetch: () => Promise<void>;
}

export function useUserRole(): UseUserRoleReturn {
  const { user } = useAuth();
  const { testRole } = useTestRole();
  const [dbRoles, setDbRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRoles = async () => {
    if (!user) {
      setDbRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (queryError) {
        throw queryError;
      }

      const userRoles = data?.map((r) => r.role) || [];
      setDbRoles(userRoles);
    } catch (err) {
      console.error("Error fetching user roles:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch roles"));
      setDbRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [user?.id]);

  const roles = useMemo(() => {
    const isTesting = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
    return isTesting ? Array.from(new Set([testRole as AppRole, ...dbRoles])) : dbRoles;
  }, [testRole, dbRoles]);

  // Get the highest role based on hierarchy
  const highestRole = roles.length > 0
    ? ROLE_HIERARCHY.find((role) => roles.includes(role)) || null
    : null;

  // Check if user has a specific role
  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  // Check if user is any kind of admin
  const isAdmin = (): boolean => {
    return (
      roles.includes("SUPER_ADMIN") ||
      roles.includes("ASSOCIATION_ADMIN") ||
      roles.includes("CLUB_ADMIN")
    );
  };

  // Check if user is super admin
  const isSuperAdmin = (): boolean => {
    return roles.includes("SUPER_ADMIN");
  };

  return {
    roles,
    highestRole,
    loading,
    error,
    hasRole,
    isAdmin,
    isSuperAdmin,
    refetch: fetchRoles,
  };
}

// Role display utilities
export const getRoleDisplayName = (role: AppRole): string => {
  const names: Record<AppRole, string> = {
    PLAYER: "Player",
    COACH: "Coach",
    TEAM_MANAGER: "Team Manager",
    CLUB_ADMIN: "Club Admin",
    ASSOCIATION_ADMIN: "Association Admin",
    SUPER_ADMIN: "Super Admin",
    UMPIRE: "Umpire",
    VOTER: "Voter",
  };
  return names[role];
};

export const getRoleEmoji = (role: AppRole): string => {
  const emojis: Record<AppRole, string> = {
    PLAYER: "🏃",
    COACH: "📋",
    TEAM_MANAGER: "📊",
    CLUB_ADMIN: "🏢",
    ASSOCIATION_ADMIN: "🏛️",
    SUPER_ADMIN: "👑",
    UMPIRE: "🏳️",
    VOTER: "🗳️",
  };
  return emojis[role];
};

export const getRoleBadgeColor = (role: AppRole): string => {
  const colors: Record<AppRole, string> = {
    PLAYER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    COACH: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    TEAM_MANAGER: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    CLUB_ADMIN: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    ASSOCIATION_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    SUPER_ADMIN: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    UMPIRE: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
    VOTER: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  };
  return colors[role];
};
