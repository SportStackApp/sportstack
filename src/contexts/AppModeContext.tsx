import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
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
  activeMode: AppMode;
  setMode: (mode: AppMode) => Promise<boolean>;
  availableModes: AppMode[];
  canSwitchMode: boolean;
  modeLabel: string;
  modeLanding: string;
  loading: boolean;
  roles: AppRole[];
  viewingAs: AppMode;
  setViewingAs: (mode: AppMode) => Promise<boolean>;
  isViewingAsOverridden: boolean;
  setIsViewingAsOverridden: (value: boolean) => void;
  modeChanging: boolean;
  modeSyncError: string | null;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const STORAGE_KEY = "app_mode";
const VIEWING_AS_STORAGE_KEY = "app_viewing_as";
const MODE_SYNC_STORAGE_KEY = "app_permission_mode_sync";

const getStorageKey = (userId: string) => `${STORAGE_KEY}:${userId}`;
const getViewingAsStorageKey = (userId: string) => `${VIEWING_AS_STORAGE_KEY}:${userId}`;
const getModeSyncStorageKey = (userId: string) => `${MODE_SYNC_STORAGE_KEY}:${userId}`;

interface ServerPermissionModeState {
  root_mode: AppMode;
  active_mode: AppMode;
  revision: number;
}

const isAppMode = (value: unknown): value is AppMode =>
  typeof value === "string" && MODE_HIERARCHY.includes(value as AppMode);

const parseServerModeState = (value: unknown): ServerPermissionModeState | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ServerPermissionModeState>;
  if (!isAppMode(candidate.root_mode) || !isAppMode(candidate.active_mode)) return null;
  if (!Number.isSafeInteger(candidate.revision) || (candidate.revision || 0) < 1) return null;
  if (candidate.root_mode !== "super_admin" && candidate.active_mode !== candidate.root_mode) return null;
  return candidate as ServerPermissionModeState;
};

const isServerModeAllowed = (
  state: ServerPermissionModeState,
  allowedModes: AppMode[],
) => allowedModes.includes(state.root_mode) && allowedModes.includes(state.active_mode);

const chooseFallbackMode = (
  allowedModes: AppMode[],
  preferredRootMode: AppMode,
  preferredActiveMode: AppMode,
) => {
  // Player is always accepted by the server mode validator, even for a user
  // whose administrative role was removed while this Auth session remained open.
  const rootMode = allowedModes.includes(preferredRootMode)
    ? preferredRootMode
    : allowedModes[0] || "player";
  const activeMode = rootMode === "super_admin"
    && allowedModes.includes(preferredActiveMode)
    ? preferredActiveMode
    : rootMode;

  return { rootMode, activeMode };
};

const haveSameRoles = (left: AppRole[], right: AppRole[]) => {
  const leftRoles = new Set(left);
  const rightRoles = new Set(right);
  return leftRoles.size === rightRoles.size
    && Array.from(leftRoles).every((role) => rightRoles.has(role));
};

const publishModeState = (userId: string, state: ServerPermissionModeState) => {
  localStorage.setItem(getModeSyncStorageKey(userId), JSON.stringify({
    ...state,
    nonce: `${Date.now()}:${Math.random()}`,
  }));
};

const permissionModeClient = supabase as unknown as {
  rpc: (
    functionName: "get_active_permission_mode" | "set_active_permission_mode",
    args?: { p_root_mode: AppMode; p_active_mode: AppMode },
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const { testRole } = useTestRole();
  const [dbRoles, setDbRoles] = useState<AppRole[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [availableModes, setAvailableModes] = useState<AppMode[]>([]);
  const [mode, setModeState] = useState<AppMode>("player");
  const [loading, setLoading] = useState(true);
  const [viewingAs, setViewingAsState] = useState<AppMode>("super_admin");
  const [isViewingAsOverridden, setIsViewingAsOverridden] = useState(false);
  const [rolesLoadedForUser, setRolesLoadedForUser] = useState<string | null>(null);
  const [modeChanging, setModeChanging] = useState(false);
  const [modeSyncError, setModeSyncError] = useState<string | null>(null);
  const lastModeRevisionRef = useRef(0);
  const userId = user?.id;
  const isLocalAuthBypass = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

  // Fetch roles
  useEffect(() => {
    if (!userId) {
      setDbRoles([]);
      setRolesLoadedForUser(null);
      setLoading(false);
      return;
    }

    let active = true;
    const fetchRoles = async () => {
      setLoading(true);
      setRolesLoadedForUser(null);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const userRoles = (data?.map((r) => r.role) || []) as AppRole[];
      if (active) {
        setDbRoles(userRoles);
        setRolesLoadedForUser(userId);
      }
    };

    void fetchRoles();
    return () => {
      active = false;
    };
  }, [userId]);

  const readSessionMode = useCallback(async (): Promise<ServerPermissionModeState | null> => {
    if (!userId || !session) return null;
    const { data, error } = await permissionModeClient.rpc("get_active_permission_mode");
    if (error) throw new Error(error.message || "The current mode could not be checked.");
    if (data === null) return null;
    const parsed = parseServerModeState(data);
    if (!parsed) throw new Error("The current mode response was not valid.");
    return parsed;
  }, [session, userId]);

  const writeSessionMode = useCallback(async (
    rootMode: AppMode,
    activeMode: AppMode,
  ): Promise<ServerPermissionModeState> => {
    if (!userId || !session) throw new Error("The current authentication session is not available.");
    const { data, error } = await permissionModeClient.rpc("set_active_permission_mode", {
      p_root_mode: rootMode,
      p_active_mode: activeMode,
    });
    if (error) throw new Error(error.message || "The selected mode could not be confirmed.");
    const parsed = parseServerModeState(data);
    if (!parsed) throw new Error("The selected mode response was not valid.");
    return parsed;
  }, [session, userId]);

  const adoptServerMode = useCallback((
    state: ServerPermissionModeState,
    allowedModes: AppMode[],
    broadcast: boolean,
  ): boolean => {
    if (!user || state.revision < lastModeRevisionRef.current) return false;
    if (!allowedModes.includes(state.root_mode) || !allowedModes.includes(state.active_mode)) return false;

    lastModeRevisionRef.current = state.revision;
    setModeState(state.root_mode);
    setViewingAsState(state.root_mode === "super_admin" ? state.active_mode : "super_admin");
    setIsViewingAsOverridden(state.root_mode === "super_admin" && state.active_mode !== "super_admin");
    localStorage.setItem(getStorageKey(user.id), state.root_mode);
    localStorage.setItem(
      getViewingAsStorageKey(user.id),
      state.root_mode === "super_admin" ? state.active_mode : "super_admin",
    );
    if (broadcast) publishModeState(user.id, state);
    return true;
  }, [user]);

  const reconcileServerMode = useCallback(async (
    state: ServerPermissionModeState | null,
    allowedModes: AppMode[],
    preferredRootMode: AppMode,
    preferredActiveMode: AppMode,
  ): Promise<ServerPermissionModeState> => {
    let canonical = state;

    // A role may have been revoked after this session mode was stored. Replace
    // that stale server value with the best mode still assigned to the account.
    if (!canonical || !isServerModeAllowed(canonical, allowedModes)) {
      const fallback = chooseFallbackMode(
        allowedModes,
        preferredRootMode,
        preferredActiveMode,
      );
      canonical = await writeSessionMode(fallback.rootMode, fallback.activeMode);
    }

    if (!isServerModeAllowed(canonical, allowedModes)) {
      throw new Error("The current session mode is no longer assigned to this account.");
    }

    return canonical;
  }, [writeSessionMode]);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setAvailableModes([]);
      setModeState("player");
      setViewingAsState("super_admin");
      setIsViewingAsOverridden(false);
      setModeSyncError(null);
      lastModeRevisionRef.current = 0;
      return;
    }

    if (rolesLoadedForUser !== user.id) return;

    let active = true;

    const activeRoles = isLocalAuthBypass ? Array.from(new Set([testRole as AppRole, ...dbRoles])) : dbRoles;
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
    const initialMode = stored && ordered.includes(stored)
      ? stored
      : ordered[0] || "player";
    const rawViewingAs = localStorage.getItem(getViewingAsStorageKey(user.id)) as AppMode | null;
    const initialViewingAs = initialMode === "super_admin"
      && rawViewingAs
      && ordered.includes(rawViewingAs)
      ? rawViewingAs
      : "super_admin";
    const requestedActiveMode = initialMode === "super_admin" ? initialViewingAs : initialMode;

    setLoading(true);
    void (async () => {
      try {
        if (isLocalAuthBypass && !session) {
          throw new Error("Local authentication bypass cannot open protected modules. Sign in with a Dev account.");
        }
        const existing = await readSessionMode();
        const canonical = await reconcileServerMode(
          existing,
          ordered,
          initialMode,
          requestedActiveMode,
        );
        if (!active) return;
        // A newer cross-tab response may already have been adopted locally.
        if (canonical.revision >= lastModeRevisionRef.current
          && !adoptServerMode(canonical, ordered, true)) {
          throw new Error("The current session mode could not be applied.");
        }
        setModeSyncError(null);
      } catch (initialiseError) {
        if (!active) return;
        setModeSyncError(initialiseError instanceof Error
          ? initialiseError.message
          : "The current mode could not be confirmed.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [adoptServerMode, dbRoles, isLocalAuthBypass, readSessionMode, reconcileServerMode, rolesLoadedForUser, session, testRole, user]);

  const setMode = useCallback(async (newMode: AppMode): Promise<boolean> => {
    if (!user || !availableModes.includes(newMode) || modeChanging) return false;

    setModeChanging(true);
    try {
      const canonical = await writeSessionMode(newMode, newMode);
      adoptServerMode(canonical, availableModes, true);
      const changed = canonical.root_mode === newMode && canonical.active_mode === newMode;
      setModeSyncError(changed ? null : "The mode was changed in another browser tab.");
      return changed;
    } catch (changeError) {
      setModeSyncError(changeError instanceof Error ? changeError.message : "The selected mode could not be confirmed.");
      return false;
    } finally {
      setModeChanging(false);
    }
  }, [adoptServerMode, availableModes, modeChanging, user, writeSessionMode]);

  const setViewingAs = useCallback(async (newMode: AppMode): Promise<boolean> => {
    if (!user || mode !== "super_admin" || !availableModes.includes(newMode) || modeChanging) return false;

    setModeChanging(true);
    try {
      const canonical = await writeSessionMode("super_admin", newMode);
      adoptServerMode(canonical, availableModes, true);
      const changed = canonical.root_mode === "super_admin" && canonical.active_mode === newMode;
      setModeSyncError(changed ? null : "The mode was changed in another browser tab.");
      return changed;
    } catch (changeError) {
      setModeSyncError(changeError instanceof Error ? changeError.message : "The selected mode could not be confirmed.");
      return false;
    } finally {
      setModeChanging(false);
    }
  }, [adoptServerMode, availableModes, mode, modeChanging, user, writeSessionMode]);

  // Tabs using the same browser Auth session share one server-side mode row.
  // A storage event only prompts a server read; local storage is never treated
  // as an authorisation decision. Server revisions discard delayed responses.
  useEffect(() => {
    if (!user || !session || isLocalAuthBypass) return;

    let active = true;
    let refreshInFlight = false;
    const refreshCanonicalMode = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;

      void (async () => {
        const { data: refreshedRoleRows, error: refreshedRolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (refreshedRolesError) {
          throw new Error(refreshedRolesError.message || "The assigned roles could not be checked.");
        }

        const refreshedRoles = (refreshedRoleRows?.map((roleRow) => roleRow.role) || []) as AppRole[];
        if (!haveSameRoles(dbRoles, refreshedRoles)) {
          if (active) setDbRoles(refreshedRoles);
          // The role-driven initialisation effect will calculate the new allowed
          // modes and replace any revoked server mode with its valid fallback.
          return;
        }

        const canonical = await readSessionMode();
        if (!active) return;
        const preferredActiveMode = mode === "super_admin" ? viewingAs : mode;
        const reconciled = await reconcileServerMode(
          canonical,
          availableModes,
          mode,
          preferredActiveMode,
        );
        if (!active) return;
        // Ignore a delayed read when another tab has already supplied a newer
        // revision. Otherwise the reconciled state must be adopted successfully.
        if (reconciled.revision >= lastModeRevisionRef.current
          && !adoptServerMode(reconciled, availableModes, true)) {
          throw new Error("The current session mode could not be applied.");
        }
        setModeSyncError(null);
      })()
        .catch((refreshError: unknown) => {
          if (!active) return;
          setModeSyncError(refreshError instanceof Error
            ? refreshError.message
            : "The current mode could not be checked.");
        })
        .finally(() => {
          refreshInFlight = false;
        });
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== getModeSyncStorageKey(user.id) || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as { revision?: number };
        if (!Number.isSafeInteger(payload.revision) || (payload.revision || 0) <= lastModeRevisionRef.current) return;
        refreshCanonicalMode();
      } catch {
        // Ignore malformed cross-tab notifications.
      }
    };
    const handleFocus = () => refreshCanonicalMode();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshCanonicalMode();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [adoptServerMode, availableModes, dbRoles, isLocalAuthBypass, mode, readSessionMode, reconcileServerMode, session, user, viewingAs]);

  // A Super Admin can deliberately preview a lower role through Viewing as.
  // Every runtime permission check must use this value rather than the
  // account's highest stored role.
  const activeMode = mode === "super_admin" ? viewingAs : mode;

  return (
    <AppModeContext.Provider
      value={{
        mode,
        activeMode,
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
        modeChanging,
        modeSyncError,
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
