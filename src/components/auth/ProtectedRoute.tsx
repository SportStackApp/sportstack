import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isProfileReviewRequired } from "@/lib/profileCompletion";
import { buildLoginPath } from "@/lib/authRedirect";
import { useDisciplineAccess } from "@/features/discipline/useDisciplineAccess";
import {
  hasAssignedAccountAccess,
  hasDisciplineRouteAccess,
  isAccountEntryPath,
} from "@/lib/accountAccess";
import { applyPendingSignup } from "@/lib/applyPendingSignup";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [needsProfileReview, setNeedsProfileReview] = useState(false);
  const [checkingAccountAccess, setCheckingAccountAccess] = useState(true);
  const [hasAccountAccess, setHasAccountAccess] = useState(false);
  const [accountAccessError, setAccountAccessError] = useState(false);
  const {
    context: disciplineContext,
    loading: checkingDiscipline,
    error: disciplineAccessError,
  } = useDisciplineAccess();

  useEffect(() => {
    let cancelled = false;

    const checkProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        setNeedsProfileReview(false);
        return;
      }

      setCheckingProfile(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone, date_of_birth, gender")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Error checking profile completion:", error);
        setNeedsProfileReview(false);
      } else {
        setNeedsProfileReview(isProfileReviewRequired(data));
      }

      setCheckingProfile(false);
    };

    checkProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const checkAccountAccess = async () => {
      if (!user) {
        setCheckingAccountAccess(false);
        setHasAccountAccess(false);
        setAccountAccessError(false);
        return;
      }

      setCheckingAccountAccess(true);
      setAccountAccessError(false);

      // Finish any signup hand-off before deciding whether the account is
      // assigned or waiting for an administrator.
      await applyPendingSignup(user.id);

      const [rolesResult, membershipsResult] = await Promise.all([
        supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("team_memberships")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "ACTIVE"),
      ]);

      if (cancelled) return;

      if (rolesResult.error || membershipsResult.error) {
        console.error(
          "Error checking account assignment:",
          rolesResult.error || membershipsResult.error,
        );
        setHasAccountAccess(false);
        setAccountAccessError(true);
      } else {
        setHasAccountAccess(hasAssignedAccountAccess({
          roleCount: rolesResult.count || 0,
          activeMembershipCount: membershipsResult.count || 0,
        }));
      }

      setCheckingAccountAccess(false);
    };

    void checkAccountAccess();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, user]);

  useEffect(() => {
    const clearProfileReview = () => setNeedsProfileReview(false);

    window.addEventListener("sportstack:profile-review-completed", clearProfileReview);

    return () => {
      window.removeEventListener("sportstack:profile-review-completed", clearProfileReview);
    };
  }, []);

  if (loading || checkingProfile || checkingDiscipline || checkingAccountAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildLoginPath(returnTo)} replace />;
  }

  if (disciplineAccessError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Access check unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            SportStack could not safely confirm your portal access. Please refresh and try again.
          </p>
        </div>
      </div>
    );
  }

  const isDisciplinePath =
    location.pathname === "/discipline" || location.pathname.startsWith("/discipline/");
  const disciplineRouteAllowed = hasDisciplineRouteAccess(
    location.pathname,
    Boolean(disciplineContext?.allowed),
  );
  const profilePath = disciplineContext?.discipline_only ? "/discipline/profile" : "/profile";

  if (needsProfileReview && location.pathname !== profilePath) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`${profilePath}?review=1&returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (disciplineContext?.discipline_only && !isDisciplinePath) {
    return <Navigate to="/discipline" replace />;
  }

  const accountEntryPath = isAccountEntryPath(location.pathname, profilePath);

  if (accountAccessError && !accountEntryPath && !disciplineRouteAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Account check unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            SportStack could not safely confirm your account access. Please refresh and try again.
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccountAccess && !accountEntryPath && !disciplineRouteAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
