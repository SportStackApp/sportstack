import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useModuleAvailability, type SportStackModuleKey } from "@/hooks/useModuleAvailability";

export function ModuleGate({
  moduleKey,
  moduleLabel,
  children,
}: {
  moduleKey: SportStackModuleKey;
  moduleLabel: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { enabled, loading } = useModuleAvailability([moduleKey]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (enabled[moduleKey]) return <>{children}</>;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          {moduleLabel} is not enabled here
        </CardTitle>
        <CardDescription>
          An administrator has disabled this module for the selected organisation scope.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </CardContent>
    </Card>
  );
}
