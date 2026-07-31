import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleControlsCard } from "@/components/admin/ModuleControlsCard";
import { useAdminScope } from "@/hooks/useAdminScope";
import { ROLE_PERMISSION_SUMMARIES } from "@/lib/rolePermissions";

const RolesPermissions = () => {
  const navigate = useNavigate();
  const { loading, isSuperAdmin, scopedAssociationIds, scopedClubIds } = useAdminScope();
  const canManageModules = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!canManageModules) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Roles & modules</CardTitle>
          <CardDescription>This page is available to Super, Association and Club administrators.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/admin")}>Back to Admin</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles, permissions & modules</h1>
          <p className="text-muted-foreground">Review role boundaries and control modules by organisation scope.</p>
        </div>
      </div>

      <ModuleControlsCard />

      {isSuperAdmin && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Custom role switches
          </CardTitle>
          <CardDescription>
            These broad action switches remain display-only. Live module enable and disable controls are available above.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {["View", "Create", "Edit", "Delete", "Approve", "Export"].map((label) => (
            <div key={label} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">{label}</span>
              <Switch checked disabled />
            </div>
          ))}
        </CardContent>
      </Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        {ROLE_PERMISSION_SUMMARIES.map((role) => (
          <Card key={role.role}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {role.label}
                </CardTitle>
                <Badge variant="outline">{role.role}</Badge>
              </div>
              <CardDescription>{role.scope}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <PermissionList title="Can see" items={role.canSee} />
              <PermissionList title="Can edit" items={role.canEdit} />
              <PermissionList title="Cannot do" items={role.cannotDo} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const PermissionList = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <p className="mb-2 text-sm font-semibold">{title}</p>
    <ul className="space-y-1 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>- {item}</li>
      ))}
    </ul>
  </div>
);

export default RolesPermissions;
