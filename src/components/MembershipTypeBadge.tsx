import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DisplayMembershipType = "PRIMARY" | "SECONDARY" | "FILL_IN" | "PERMANENT" | string;

const MEMBERSHIP_STYLES: Record<"PRIMARY" | "SECONDARY" | "FILL_IN", string> = {
  PRIMARY: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200",
  SECONDARY: "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200",
  FILL_IN: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
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
