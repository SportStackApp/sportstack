import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useExpenseHubAccess() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    void supabase.rpc("has_expense_hub_access").then(({ data, error: accessError }) => {
      if (!active) return;
      setAllowed(data === true);
      setError(accessError?.message || null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  return { allowed, loading, error };
}
