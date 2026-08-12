import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isProfileReviewRequired } from "@/lib/profileCompletion";
import { buildLoginPath } from "@/lib/authRedirect";
import { useDisciplineAccess } from "@/features/discipline/useDisciplineAccess";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [needsProfileReview, setNeedsProfileReview] = useState(false);
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
    const clearProfileReview = () => setNeedsProfileReview(false);

    window.addEventListener("sportstack:profile-review-completed", clearProfileReview);

    return () => {
      window.removeEventListener("sportstack:profile-review-completed", clearProfileReview);
    };
  }, []);

  if (loading || checkingProfile || checkingDiscipline) {
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
  const profilePath = disciplineContext?.discipline_only ? "/discipline/profile" : "/profile";

  if (needsProfileReview && location.pathname !== profilePath) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`${profilePath}?review=1&returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (disciplineContext?.discipline_only && !isDisciplinePath) {
    return <Navigate to="/discipline" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
