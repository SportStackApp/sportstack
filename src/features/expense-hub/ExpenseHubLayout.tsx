import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, Building2, CircleDollarSign, FilePlus2, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExpenseHubProvider } from "./ExpenseHubContext";

const LINKS = [
  { to: "/expense-hub", label: "Dashboard", icon: BarChart3, end: true },
  { to: "/expense-hub/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/expense-hub/expenses/new", label: "Add expense", icon: FilePlus2 },
  { to: "/expense-hub/suppliers", label: "Suppliers", icon: Building2 },
  { to: "/expense-hub/reports", label: "Reports", icon: CircleDollarSign },
];

export function ExpenseHubLayout() {
  return (
    <ExpenseHubProvider>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl text-foreground md:text-4xl">EXPENSE HUB</h1>
          <p className="mt-1 text-muted-foreground">Private expense records, documents and tax-time exports.</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto rounded-lg border bg-card p-2" aria-label="Expense Hub">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </ExpenseHubProvider>
  );
}
