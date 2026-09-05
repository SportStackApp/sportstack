export interface AccountAccessCounts {
  roleCount: number;
  activeMembershipCount: number;
}

export const hasAssignedAccountAccess = ({
  roleCount,
  activeMembershipCount,
}: AccountAccessCounts) => roleCount > 0 || activeMembershipCount > 0;

export const isAccountEntryPath = (pathname: string, profilePath: string) =>
  pathname === "/dashboard" || pathname === profilePath;

export const hasDisciplineRouteAccess = (pathname: string, allowed: boolean) =>
  allowed && (pathname === "/discipline" || pathname.startsWith("/discipline/"));
