import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const isDark = resolvedTheme === "dark";

  const handleThemeChange = async (checked: boolean) => {
    const preference = checked ? "dark" : "light";
    setTheme(preference);
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: preference })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Theme saved on this device only",
        description: "Your account preference could not be updated yet.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
        <Label htmlFor="theme-toggle" className="cursor-pointer">
          {isDark ? "Dark Mode" : "Light Mode"}
        </Label>
      </div>
      <Switch
        id="theme-toggle"
        checked={isDark}
        onCheckedChange={(checked) => void handleThemeChange(checked)}
      />
    </div>
  );
}
