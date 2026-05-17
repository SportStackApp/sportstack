import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["app_role"];

const DEV_TOOLS_ROLE_KEY = "devToolsRole";
const DEFAULT_ROLE: Role = "PLAYER";
const VALID_ROLES: Role[] = [
  "PLAYER",
  "COACH",
  "TEAM_MANAGER",
  "CLUB_ADMIN",
  "ASSOCIATION_ADMIN",
  "SUPER_ADMIN",
];

interface TestRoleContextType {
  testRole: Role;
  setTestRole: (role: Role) => void;
}

const TestRoleContext = createContext<TestRoleContextType | undefined>(undefined);

export function TestRoleProvider({ children }: { children: ReactNode }) {
  const [testRole, setTestRoleState] = useState<Role>(() => {
    if (typeof window === "undefined") return DEFAULT_ROLE;

    const storedRole = window.localStorage.getItem(DEV_TOOLS_ROLE_KEY);
    return VALID_ROLES.includes(storedRole as Role) ? (storedRole as Role) : DEFAULT_ROLE;
  });

  const setTestRole = useCallback((role: Role) => {
    setTestRoleState(role);
    window.localStorage.setItem(DEV_TOOLS_ROLE_KEY, role);
  }, []);
  
  return (
    <TestRoleContext.Provider value={{ testRole, setTestRole }}>
      {children}
    </TestRoleContext.Provider>
  );
}

export function useTestRole() {
  const context = useContext(TestRoleContext);
  if (!context) {
    throw new Error("useTestRole must be used within TestRoleProvider");
  }
  return context;
}
