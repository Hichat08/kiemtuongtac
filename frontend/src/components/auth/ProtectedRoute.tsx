import {
  clearLockedAccountSnapshot,
  readLockedAccountSnapshot,
} from "@/lib/account-lock";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ProtectedRouteProps {
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ requireAdmin = false }: ProtectedRouteProps) => {
  const { accessToken, user, loading, refresh, fetchMe } = useAuthStore();
  const fetchConversations = useChatStore((state) => state.fetchConversations);
  const [starting, setStarting] = useState(true);
  const { pathname } = useLocation();
  const isSupportChatPath = pathname === "/chat/support";
  const lockedSnapshot = readLockedAccountSnapshot();
  const hasLockedSupportAccess = Boolean(isSupportChatPath && lockedSnapshot);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        let nextAccessToken = accessToken;
        let nextUser = user;

        if (!nextAccessToken) {
          await refresh();
          const authState = useAuthStore.getState();
          nextAccessToken = authState.accessToken;
          nextUser = authState.user;
        }

        if (nextAccessToken && !nextUser) {
          await fetchMe();
        }

        if (nextAccessToken) {
          void fetchConversations();
        }
      } finally {
        if (active) {
          setStarting(false);
        }
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, [accessToken, fetchConversations, fetchMe, refresh, user]);

  if (starting || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (lockedSnapshot) {
    if (user?.role === "admin" || requireAdmin) {
      clearLockedAccountSnapshot();
    } else if (!isSupportChatPath) {
      return <Navigate to="/account-locked" replace />;
    }
  }

  if (!accessToken && !hasLockedSupportAccess) {
    return <Navigate to="/signin" replace />;
  }

  if (requireAdmin && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (
    user?.role !== "admin" &&
    user?.moderationStatus === "locked" &&
    !isSupportChatPath
  ) {
    return <Navigate to="/account-locked" replace />;
  }

  return <Outlet></Outlet>;
};

export default ProtectedRoute;
