import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { loadDisciplinePortalContext } from "./api";

export function useDisciplineAccess() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["discipline-portal-context", user?.id],
    queryFn: loadDisciplinePortalContext,
    enabled: Boolean(user),
    staleTime: 30_000,
    retry: 1,
  });

  return {
    user,
    context: query.data,
    loading: authLoading || (Boolean(user) && query.isLoading),
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
  };
}
