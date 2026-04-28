import { useGetMe } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useViewMode } from "@/contexts/view-mode";

export function useAgencyUser() {
  const { isSignedIn } = useAuth();
  const { data: agencyUser, isLoading, error } = useGetMe({
    query: { enabled: !!isSignedIn },
  });
  const { isViewingAsAgent } = useViewMode();

  const actuallyAdmin = agencyUser?.role === "admin";

  return {
    agencyUser,
    isLoading,
    isAdmin: actuallyAdmin && !isViewingAsAgent,
    isAgent: !actuallyAdmin || isViewingAsAgent,
    isActualAdmin: actuallyAdmin,
    isSignedIn,
    error,
  };
}
