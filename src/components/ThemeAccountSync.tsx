import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/** Loads the signed-in account theme before showing protected content. */
export function ThemeAccountSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!user) {
      document.body.style.visibility = "";
      return;
    }

    let active = true;
    document.body.style.visibility = "hidden";

    const loadAccountTheme = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      const preference = data?.theme_preference === "dark" || data?.theme_preference === "light"
        ? data.theme_preference
        : localStorage.getItem("theme") === "dark" ? "dark" : "light";
      setTheme(preference);
      requestAnimationFrame(() => {
        if (active) document.body.style.visibility = "";
      });
    };

    void loadAccountTheme();
    return () => {
      active = false;
      document.body.style.visibility = "";
    };
  }, [setTheme, user]);

  return null;
}
