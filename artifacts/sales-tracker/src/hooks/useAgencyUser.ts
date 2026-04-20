import { useGetMe } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";

export function useAgencyUser() {
  const { isSignedIn } = useAuth();
  const { data: agencyUser, isLoading, error } = useGetMe({
    query: { enabled: !!isSignedIn },
  });

  return {
    agencyUser,
    isLoading,
    isAdmin: agencyUser?.role === "admin",
    isAgent: agencyUser?.role === "agent",
    error,
  };
}
