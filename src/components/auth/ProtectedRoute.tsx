import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isProfileReviewRequired } from "@/lib/profileCompletion";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [needsProfileReview, setNeedsProfileReview] = useState(false);

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

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsProfileReview && location.pathname !== "/profile") {
    return <Navigate to="/profile?review=1" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
