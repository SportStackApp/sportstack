import { Fragment, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Category = "AVAILABILITY_REMINDERS" | "BROADCASTS" | "MENTIONS";
type Channel = "in_app_enabled" | "email_enabled";

interface Preference {
  category: Category;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

const CATEGORIES: Array<{
  key: Category;
  label: string;
  description: string;
  channels: Channel[];
}> = [
  {
    key: "AVAILABILITY_REMINDERS",
    label: "Availability reminders",
    description: "Reminders when you have not answered, or you are still unsure.",
    channels: ["in_app_enabled", "email_enabled"],
  },
  {
    key: "BROADCASTS",
    label: "Official updates",
    description: "Email copies of club and association broadcasts. In-app alerts always remain on.",
    channels: ["email_enabled"],
  },
  {
    key: "MENTIONS",
    label: "Team mentions",
    description: "An in-app alert when someone mentions you in Team Chat.",
    channels: ["in_app_enabled"],
  },
];

const defaultPreference = (category: Category): Preference => ({
  category,
  in_app_enabled: true,
  email_enabled: true,
});

export function NotificationPreferencesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPreferences = async () => {
      setLoading(true);
      // Regenerated Supabase types will replace this after the approved migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("notification_category_preferences")
        .select("category, in_app_enabled, email_enabled")
        .eq("user_id", user.id);

      if (error) {
        console.error("Unable to load notification preferences", error);
      }
      const saved = (data || []) as Preference[];
      setPreferences(
        CATEGORIES.map(
          ({ key }) => saved.find((preference) => preference.category === key) || defaultPreference(key),
        ),
      );
      setLoading(false);
    };
    void fetchPreferences();
  }, [user]);

  const togglePreference = async (category: Category, channel: Channel) => {
    if (!user) return;
    const current = preferences.find((preference) => preference.category === category) || defaultPreference(category);
    const next = { ...current, [channel]: !current[channel] };

    setPreferences((items) => items.map((item) => (item.category === category ? next : item)));
    // Regenerated Supabase types will replace this after the approved migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("notification_category_preferences")
      .upsert(
        {
          user_id: user.id,
          category,
          in_app_enabled: next.in_app_enabled,
          email_enabled: next.email_enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,category" },
      );

    if (error) {
      setPreferences((items) => items.map((item) => (item.category === category ? current : item)));
      toast({
        title: "Preference not saved",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Notification preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-5 gap-y-4">
          <div />
          <Label className="text-center text-xs text-muted-foreground">In-app</Label>
          <Label className="text-center text-xs text-muted-foreground">Email</Label>
          {CATEGORIES.map((category) => {
            const preference =
              preferences.find((item) => item.category === category.key) || defaultPreference(category.key);
            return (
              <Fragment key={category.key}>
                <div className="min-w-0">
                  <Label className="text-sm font-medium">{category.label}</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p>
                </div>
                {(["in_app_enabled", "email_enabled"] as Channel[]).map((channel) => (
                  <div key={channel} className="flex justify-center">
                    {category.channels.includes(channel) ? (
                      <Switch
                        checked={preference[channel]}
                        aria-label={`${category.label} ${channel === "in_app_enabled" ? "in-app" : "email"}`}
                        onCheckedChange={() => void togglePreference(category.key, channel)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
