import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTestRole } from "@/contexts/TestRoleContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["user_role_enum"];
export type AppMode = "super_admin" | "association" | "club" | "team_manager" | "coach" | "player";

const ROLE_TO_MODE: Record<AppRole, AppMode> = {
  SUPER_ADMIN: "super_admin",
  ASSOCIATION_ADMIN: "association",
  CLUB_ADMIN: "club",
  TEAM_MANAGER: "team_manager",
  COACH: "coach",
  PLAYER: "player",
  UMPIRE: "player",
  VOTER: "player",
  UMPIRE_ADMIN: "player",
};

// Mode hierarchy from highest to lowest
const MODE_HIERARCHY: AppMode[] = ["super_admin", "association", "club", "team_manager", "coach", "player"];

const MODE_LABELS: Record<AppMode, string> = {
  super_admin: "Super Admin",
  association: "Association Admin",
  club: "Club Admin",
  team_manager: "Team Manager",
  coach: "Coach",
  player: "Player",
};

const MODE_LANDING: Record<AppMode, string> = {
  super_admin: "/admin",
  association: "/admin",
  club: "/admin",
  team_manager: "/dashboard",
  coach: "/dashboard",
  player: "/dashboard",
};

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  availableModes: AppMode[];
  canSwitchMode: boolean;
  modeLabel: string;
  modeLanding: string;
  loading: boolean;
  roles: AppRole[];
  viewingAs: AppMode;
  setViewingAs: (mode: AppMode) => void;
  isViewingAsOverridden: boolean;
  setIsViewingAsOverridden: (value: boolean) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const STORAGE_KEY = "app_mode";

const getStorageKey = (userId: string) => `${STORAGE_KEY}:${userId}`;

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { testRole } = useTestRole();
  const [dbRoles, setDbRoles] = useState<AppRole[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [availableModes, setAvailableModes] = useState<AppMode[]>([]);
  const [mode, setModeState] = useState<AppMode>("player");
  const [loading, setLoading] = useState(true);
  const [viewingAs, setViewingAsState] = useState<AppMode>("super_admin");
  const [isViewingAsOverridden, setIsViewingAsOverridden] = useState(false);
  const userId = user?.id;

  // Fetch roles
  useEffect(() => {
    if (!userId) {
      setDbRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const userRoles = (data?.map((r) => r.role) || []) as AppRole[];
      setDbRoles(userRoles);
      setLoading(false);
    };

    fetchRoles();
  }, [userId]);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setAvailableModes([]);
      setModeState("player");
      return;
    }

    const isTesting = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
    const activeRoles = isTesting ? Array.from(new Set([testRole as AppRole, ...dbRoles])) : dbRoles;
    setRoles(activeRoles);

    // Derive available modes (deduplicated, ordered by hierarchy)
    const modesSet = new Set<AppMode>();
    activeRoles.forEach((role) => {
      modesSet.add(ROLE_TO_MODE[role]);
    });
    // Always include player mode
    modesSet.add("player");

    // Super Admin gets access to all modes
    if (modesSet.has("super_admin")) {
      MODE_HIERARCHY.forEach((m) => modesSet.add(m));
    }
    
    const ordered = MODE_HIERARCHY.filter((m) => modesSet.has(m));
    setAvailableModes(ordered);

    // Restore persisted mode per user. A shared key lets one account's mode
    // leak into another account on the same browser.
    const rawStored = localStorage.getItem(getStorageKey(user.id));
    // Older builds stored both Coach and Team Manager as "team". Preserve a
    // sensible landing mode while keeping the two permissions separate now.
    const stored = (rawStored === "team"
      ? activeRoles.includes("TEAM_MANAGER") ? "team_manager" : "coach"
      : rawStored) as AppMode | null;
    if (stored && ordered.includes(stored)) {
      setModeState(stored);
    } else if (ordered.length > 0) {
      setModeState(ordered[0]);
    }
  }, [dbRoles, testRole, user]);

  const setMode = useCallback((newMode: AppMode) => {
    if (!user) return;
    setModeState(newMode);
    localStorage.setItem(getStorageKey(user.id), newMode);
  }, [user]);

  const setViewingAs = useCallback((newMode: AppMode) => {
    setViewingAsState(newMode);
    setIsViewingAsOverridden(true);
  }, []);

  return (
    <AppModeContext.Provider
      value={{
        mode,
        setMode,
        availableModes,
        canSwitchMode: availableModes.length > 1,
        modeLabel: MODE_LABELS[mode],
        modeLanding: MODE_LANDING[mode],
        loading,
        roles,
        viewingAs,
        setViewingAs,
        isViewingAsOverridden,
        setIsViewingAsOverridden,
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error("useAppMode must be used within AppModeProvider");
  }
  return context;
}

export { MODE_LABELS, MODE_LANDING };
