import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTestRole } from "@/contexts/TestRoleContext";
import { useTeamContext, type TeamScopeSelection } from "@/contexts/TeamContext";
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
  contextConfirmed: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const STORAGE_KEY = "app_mode";
const VIEWING_AS_STORAGE_KEY = "app_viewing_as";
const MODE_SYNC_STORAGE_KEY = "app_permission_mode_sync";

const getStorageKey = (userId: string) => `${STORAGE_KEY}:${userId}`;
const getViewingAsStorageKey = (userId: string) => `${VIEWING_AS_STORAGE_KEY}:${userId}`;
const getModeSyncStorageKey = (userId: string) => `${MODE_SYNC_STORAGE_KEY}:${userId}`;

interface ServerPermissionContextState {
  root_mode: AppMode;
  active_mode: AppMode;
  association_id: string | null;
  club_id: string | null;
  division_id: string | null;
  team_id: string | null;
  revision: number;
}

const EMPTY_SCOPE: TeamScopeSelection = {
  associationId: "",
  clubId: "",
  divisionId: "",
  teamId: "",
};

const isAppMode = (value: unknown): value is AppMode =>
  typeof value === "string" && MODE_HIERARCHY.includes(value as AppMode);

const isNullableId = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const parseServerContextState = (value: unknown): ServerPermissionContextState | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ServerPermissionContextState>;
  if (!isAppMode(candidate.root_mode) || !isAppMode(candidate.active_mode)) return null;
  if (!isNullableId(candidate.association_id)
    || !isNullableId(candidate.club_id)
    || !isNullableId(candidate.division_id)
    || !isNullableId(candidate.team_id)) return null;
  if (!Number.isSafeInteger(candidate.revision) || (candidate.revision || 0) < 1) return null;
  if (candidate.root_mode !== "super_admin" && candidate.active_mode !== candidate.root_mode) return null;
  return candidate as ServerPermissionContextState;
};

const isServerContextAllowed = (
  state: ServerPermissionContextState,
  allowedModes: AppMode[],
) => allowedModes.includes(state.root_mode)
  && allowedModes.includes(state.active_mode)
  && (
    (state.root_mode === "super_admin" && state.active_mode === "super_admin")
    || (state.active_mode === "association" && Boolean(state.association_id))
    || (state.active_mode === "club" && Boolean(state.club_id))
    || (["team_manager", "coach", "player"].includes(state.active_mode) && Boolean(state.team_id))
  );

const scopeFromServerState = (state: ServerPermissionContextState): TeamScopeSelection => ({
  associationId: state.association_id || "",
  clubId: state.club_id || "",
  divisionId: state.division_id || "",
  teamId: state.team_id || "",
});

const haveSameScope = (left: TeamScopeSelection, right: TeamScopeSelection) =>
  left.associationId === right.associationId
  && left.clubId === right.clubId
  && left.divisionId === right.divisionId
  && left.teamId === right.teamId;

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

const publishContextState = (userId: string, state: ServerPermissionContextState) => {
  localStorage.setItem(getModeSyncStorageKey(userId), JSON.stringify({
    ...state,
    nonce: `${Date.now()}:${Math.random()}`,
  }));
};

const permissionModeClient = supabase as unknown as {
  rpc: (
    functionName: "get_active_permission_mode" | "set_active_permission_context",
    args?: {
      p_root_mode: AppMode;
      p_active_mode: AppMode;
      p_association_id: string | null;
      p_club_id: string | null;
      p_division_id: string | null;
      p_team_id: string | null;
    },
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const { testRole } = useTestRole();
  const {
    selectedAssociationId,
    selectedClubId,
    selectedDivision,
    selectedTeamId,
    setSelectedScope,
    selectionHydrated,
  } = useTeamContext();
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
  const [contextConfirmed, setContextConfirmed] = useState(false);
  const [contextInitialisedForUser, setContextInitialisedForUser] = useState<string | null>(null);
  const lastModeRevisionRef = useRef(0);
  const lastCanonicalContextRef = useRef<ServerPermissionContextState | null>(null);
  const selectedScopeRef = useRef<TeamScopeSelection>(EMPTY_SCOPE);
  const contextWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const userId = user?.id;
  const isLocalAuthBypass = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

  const selectedScope = useMemo<TeamScopeSelection>(() => ({
    associationId: selectedAssociationId,
    clubId: selectedClubId,
    divisionId: selectedDivision,
    teamId: selectedTeamId,
  }), [selectedAssociationId, selectedClubId, selectedDivision, selectedTeamId]);
  selectedScopeRef.current = selectedScope;
  // A Super Admin can deliberately preview a lower role through Viewing as.
  // Every runtime permission check must use this value rather than the
  // account's highest stored role.
  const activeMode = mode === "super_admin" ? viewingAs : mode;

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

  const readSessionContext = useCallback(async (): Promise<ServerPermissionContextState | null> => {
    if (!userId || !session) return null;
    const { data, error } = await permissionModeClient.rpc("get_active_permission_mode");
    if (error) throw new Error(error.message || "The current mode and scope could not be checked.");
    if (data === null) return null;
    const parsed = parseServerContextState(data);
    if (!parsed) throw new Error("The current mode and scope response was not valid.");
    return parsed;
  }, [session, userId]);

  const writeSessionContext = useCallback(async (
    rootMode: AppMode,
    activeMode: AppMode,
    scope: TeamScopeSelection,
  ): Promise<ServerPermissionContextState> => {
    if (!userId || !session) throw new Error("The current authentication session is not available.");
    const { data, error } = await permissionModeClient.rpc("set_active_permission_context", {
      p_root_mode: rootMode,
      p_active_mode: activeMode,
      p_association_id: scope.associationId || null,
      p_club_id: scope.clubId || null,
      p_division_id: scope.divisionId || null,
      p_team_id: scope.teamId || null,
    });
    if (error) throw new Error(error.message || "The selected mode and scope could not be confirmed.");
    const parsed = parseServerContextState(data);
    if (!parsed) throw new Error("The selected mode and scope response was not valid.");
    return parsed;
  }, [session, userId]);

  const adoptServerContext = useCallback((
    state: ServerPermissionContextState,
    allowedModes: AppMode[],
    broadcast: boolean,
  ): boolean => {
    if (!user || state.revision < lastModeRevisionRef.current) return false;
    if (!isServerContextAllowed(state, allowedModes)) return false;

    lastModeRevisionRef.current = state.revision;
    lastCanonicalContextRef.current = state;
    setModeState(state.root_mode);
    setViewingAsState(state.root_mode === "super_admin" ? state.active_mode : "super_admin");
    // The server-confirmed selection is authoritative for a Super Admin,
    // including an explicit choice to remain in Super Admin mode while a
    // lower-level cascade scope is selected.
    setIsViewingAsOverridden(state.root_mode === "super_admin");
    localStorage.setItem(getStorageKey(user.id), state.root_mode);
    localStorage.setItem(
      getViewingAsStorageKey(user.id),
      state.root_mode === "super_admin" ? state.active_mode : "super_admin",
    );
    const serverScope = scopeFromServerState(state);
    if (!haveSameScope(selectedScopeRef.current, serverScope)) {
      selectedScopeRef.current = serverScope;
      setSelectedScope(serverScope);
    }
    setContextConfirmed(true);
    if (broadcast) publishContextState(user.id, state);
    return true;
  }, [setSelectedScope, user]);

  const reconcileServerContext = useCallback(async (
    state: ServerPermissionContextState | null,
    allowedModes: AppMode[],
    preferredRootMode: AppMode,
    preferredActiveMode: AppMode,
    preferredScope: TeamScopeSelection,
  ): Promise<ServerPermissionContextState> => {
    let canonical = state;

    // A role may have been revoked after this session mode was stored. Replace
    // that stale server value with the best mode still assigned to the account.
    if (!canonical || !isServerContextAllowed(canonical, allowedModes)) {
      const fallback = chooseFallbackMode(
        allowedModes,
        preferredRootMode,
        preferredActiveMode,
      );
      canonical = await writeSessionContext(
        fallback.rootMode,
        fallback.activeMode,
        canonical ? EMPTY_SCOPE : preferredScope,
      );
    }

    if (!isServerContextAllowed(canonical, allowedModes)) {
      throw new Error("The current session mode is no longer assigned to this account.");
    }

    return canonical;
  }, [writeSessionContext]);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setAvailableModes([]);
      setModeState("player");
      setViewingAsState("super_admin");
      setIsViewingAsOverridden(false);
      setModeSyncError(null);
      setContextConfirmed(false);
      setContextInitialisedForUser(null);
      lastModeRevisionRef.current = 0;
      lastCanonicalContextRef.current = null;
      contextWriteChainRef.current = Promise.resolve();
      return;
    }

    if (rolesLoadedForUser !== user.id || !selectionHydrated) return;

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
    setContextConfirmed(false);
    setContextInitialisedForUser(null);
    void (async () => {
      try {
        if (isLocalAuthBypass && !session) {
          throw new Error("Local authentication bypass cannot open protected modules. Sign in with a Dev account.");
        }
        const existing = await readSessionContext();
        const canonical = await reconcileServerContext(
          existing,
          ordered,
          initialMode,
          requestedActiveMode,
          selectedScopeRef.current,
        );
        if (!active) return;
        // A newer cross-tab response may already have been adopted locally.
        if (canonical.revision >= lastModeRevisionRef.current
          && !adoptServerContext(canonical, ordered, true)) {
          throw new Error("The current session mode and scope could not be applied.");
        }
        setContextInitialisedForUser(user.id);
        setModeSyncError(null);
      } catch (initialiseError) {
        if (!active) return;
        setModeSyncError(initialiseError instanceof Error
          ? initialiseError.message
          : "The current mode and scope could not be confirmed.");
        setContextConfirmed(false);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    adoptServerContext,
    dbRoles,
    isLocalAuthBypass,
    readSessionContext,
    reconcileServerContext,
    rolesLoadedForUser,
    selectionHydrated,
    session,
    testRole,
    user,
  ]);

  const setMode = useCallback(async (newMode: AppMode): Promise<boolean> => {
    if (!user || !availableModes.includes(newMode) || modeChanging) return false;

    setModeChanging(true);
    setContextConfirmed(false);
    try {
      await contextWriteChainRef.current;
      const canonical = await writeSessionContext(newMode, newMode, selectedScopeRef.current);
      const adopted = adoptServerContext(canonical, availableModes, true);
      const changed = adopted
        && canonical.root_mode === newMode
        && canonical.active_mode === newMode;
      setModeSyncError(changed ? null : "The mode was changed in another browser tab.");
      return changed;
    } catch (changeError) {
      setContextConfirmed(false);
      setModeSyncError(changeError instanceof Error ? changeError.message : "The selected mode and scope could not be confirmed.");
      return false;
    } finally {
      setModeChanging(false);
    }
  }, [adoptServerContext, availableModes, modeChanging, user, writeSessionContext]);

  const setViewingAs = useCallback(async (newMode: AppMode): Promise<boolean> => {
    if (!user || mode !== "super_admin" || !availableModes.includes(newMode) || modeChanging) return false;

    setModeChanging(true);
    setContextConfirmed(false);
    try {
      await contextWriteChainRef.current;
      const canonical = await writeSessionContext("super_admin", newMode, selectedScopeRef.current);
      const adopted = adoptServerContext(canonical, availableModes, true);
      const changed = adopted
        && canonical.root_mode === "super_admin"
        && canonical.active_mode === newMode;
      setModeSyncError(changed ? null : "The mode was changed in another browser tab.");
      return changed;
    } catch (changeError) {
      setContextConfirmed(false);
      setModeSyncError(changeError instanceof Error ? changeError.message : "The selected mode and scope could not be confirmed.");
      return false;
    } finally {
      setModeChanging(false);
    }
  }, [adoptServerContext, availableModes, mode, modeChanging, user, writeSessionContext]);

  // Cascade changes and mode changes are stored as one server-side context.
  // Writes are serialised so a slower, older selection cannot overwrite the
  // last selection made in this tab. Until the server response is adopted,
  // protected module controls remain closed.
  useEffect(() => {
    if (!user || !session || isLocalAuthBypass
      || contextInitialisedForUser !== user.id || loading || modeChanging) return;

    const canonical = lastCanonicalContextRef.current;
    if (canonical
      && canonical.root_mode === mode
      && canonical.active_mode === activeMode
      && haveSameScope(scopeFromServerState(canonical), selectedScope)) {
      setContextConfirmed(true);
      return;
    }

    let cancelled = false;
    setContextConfirmed(false);
    const queuedWrite = contextWriteChainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (cancelled) return;
        const desiredScope = selectedScopeRef.current;
        const result = await writeSessionContext(mode, activeMode, desiredScope);
        if (cancelled) return;
        if (!adoptServerContext(result, availableModes, true)) {
          throw new Error("The current session mode and scope could not be applied.");
        }
        setModeSyncError(null);
      })
      .catch((scopeError: unknown) => {
        if (cancelled) return;
        setContextConfirmed(false);
        setModeSyncError(scopeError instanceof Error
          ? scopeError.message
          : "The selected scope could not be confirmed.");
      });
    contextWriteChainRef.current = queuedWrite;

    return () => {
      cancelled = true;
    };
  }, [
    activeMode,
    adoptServerContext,
    availableModes,
    contextInitialisedForUser,
    isLocalAuthBypass,
    loading,
    mode,
    modeChanging,
    selectedScope,
    session,
    user,
    writeSessionContext,
  ]);

  // Tabs using the same browser Auth session share one server-side context row.
  // A storage event only prompts a server read; local storage is never treated
  // as an authorisation decision. Server revisions discard delayed responses.
  useEffect(() => {
    if (!user || !session || isLocalAuthBypass) return;

    let active = true;
    let refreshInFlight = false;
    const refreshCanonicalContext = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      setContextConfirmed(false);

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

        const canonical = await readSessionContext();
        if (!active) return;
        const preferredActiveMode = mode === "super_admin" ? viewingAs : mode;
        const reconciled = await reconcileServerContext(
          canonical,
          availableModes,
          mode,
          preferredActiveMode,
          selectedScopeRef.current,
        );
        if (!active) return;
        // Ignore a delayed read when another tab has already supplied a newer
        // revision. Otherwise the reconciled state must be adopted successfully.
        if (reconciled.revision >= lastModeRevisionRef.current
          && !adoptServerContext(reconciled, availableModes, true)) {
          throw new Error("The current session mode and scope could not be applied.");
        }
        setModeSyncError(null);
      })()
        .catch((refreshError: unknown) => {
          if (!active) return;
          setModeSyncError(refreshError instanceof Error
            ? refreshError.message
            : "The current mode and scope could not be checked.");
          setContextConfirmed(false);
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
        refreshCanonicalContext();
      } catch {
        // Ignore malformed cross-tab notifications.
      }
    };
    const handleFocus = () => refreshCanonicalContext();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshCanonicalContext();
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
  }, [
    adoptServerContext,
    availableModes,
    dbRoles,
    isLocalAuthBypass,
    mode,
    readSessionContext,
    reconcileServerContext,
    session,
    user,
    viewingAs,
  ]);

  const canonicalContext = lastCanonicalContextRef.current;
  const confirmedContext = contextConfirmed
    && canonicalContext !== null
    && isServerContextAllowed(canonicalContext, availableModes)
    && canonicalContext.root_mode === mode
    && canonicalContext.active_mode === activeMode
    && haveSameScope(scopeFromServerState(canonicalContext), selectedScope);

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
        contextConfirmed: confirmedContext,
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
