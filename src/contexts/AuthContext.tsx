import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { applyPendingSignup } from "@/lib/applyPendingSignup";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/lib/logError";
import { getSafeAppPath } from "@/lib/authRedirect";
import { clearPlayerExplorerSessionState } from "@/lib/playerExplorerSession";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectPath?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const claimPlaceholderProfile = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("claim-placeholder-profile", {
      body: {},
    });

    if (error) {
      await logError({
        context: "claimPlaceholderProfile",
        message: "Failed to check for a placeholder profile claim",
        error,
      });
      return;
    }

    const result = data as { status?: string; reason?: string } | null;

    if (result?.status === "merged") {
      toast({
        title: "Player profile linked",
        description: "We linked your existing placeholder player record to this account.",
      });
    }

    if (result?.status === "ambiguous") {
      toast({
        title: "Profile needs admin review",
        description: "We found more than one possible placeholder profile. An admin needs to review this before linking your account.",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true") {
      const mockUser = { id: "00000000-0000-0000-0000-000000000000", email: "dev@local.test" } as User;
      setUser(mockUser);
      setSession({ user: mockUser, access_token: "mock", refresh_token: "mock" } as unknown as Session);
      setLoading(false);
      return;
    }
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") clearPlayerExplorerSessionState();
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // On a fresh sign-in (e.g. clicking the email confirmation link,
        // or a normal login), check whether this user has pending signup
        // details (name + chosen association/club/team) waiting to be
        // applied. Safe to call every time - it does nothing if there is
        // nothing pending.
        if (event === "SIGNED_IN" && session?.user) {
          applyPendingSignup(session.user.id);
          claimPlaceholderProfile();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [claimPlaceholderProfile]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signInWithGoogle = async (redirectPath?: string) => {
    const safeRedirectPath = getSafeAppPath(redirectPath, "/login");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${safeRedirectPath}`,
      },
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearPlayerExplorerSessionState();
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
