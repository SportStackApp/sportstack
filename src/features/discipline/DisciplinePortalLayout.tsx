import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  FilePlus2,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useDisciplineAccess } from "./useDisciplineAccess";

export function DisciplinePortalLayout() {
  const { signOut } = useAuth();
  const { context } = useDisciplineAccess();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const links = [
    { to: "/discipline", label: "Cases", icon: ClipboardList, end: true },
    ...(context?.can_create_cases
      ? [
          {
            to: "/discipline/new",
            label: "New case",
            icon: FilePlus2,
            end: false,
          },
        ]
      : []),
    {
      to: "/discipline/profile",
      label: "Profile",
      icon: UserRound,
      end: false,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-lg bg-primary p-2 text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-semibold">
                Incident &amp; Discipline
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Private Hockey Ballarat case portal
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <nav
          className="mb-6 flex gap-2 overflow-x-auto rounded-lg border bg-card p-2"
          aria-label="Incident and Discipline portal"
        >
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
