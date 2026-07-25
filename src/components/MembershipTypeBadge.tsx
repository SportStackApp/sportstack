import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DisplayMembershipType = "PRIMARY" | "SECONDARY" | "FILL_IN" | "PERMANENT" | string;

const MEMBERSHIP_STYLES: Record<"PRIMARY" | "SECONDARY" | "FILL_IN", string> = {
  PRIMARY: "border-emerald-500 bg-emerald-100 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100",
  SECONDARY: "border-violet-500 bg-violet-100 text-violet-950 dark:border-violet-500 dark:bg-violet-950 dark:text-violet-100",
  FILL_IN: "border-amber-500 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100",
};

const normaliseMembershipType = (membershipType: DisplayMembershipType) => {
  if (membershipType === "PRIMARY") return "PRIMARY" as const;
  if (membershipType === "FILL_IN") return "FILL_IN" as const;
  return "SECONDARY" as const;
};

interface MembershipTypeBadgeProps {
  membershipType: DisplayMembershipType;
  className?: string;
  compact?: boolean;
}

export function MembershipTypeBadge({
  membershipType,
  className,
  compact = false,
}: MembershipTypeBadgeProps) {
  const normalised = normaliseMembershipType(membershipType);
  const label = normalised === "FILL_IN" ? "Fill-in" : normalised === "PRIMARY" ? "Primary" : "Secondary";

  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap font-medium", compact && "px-1.5 py-0 text-[10px]", MEMBERSHIP_STYLES[normalised], className)}
    >
      {label}
    </Badge>
  );
}
