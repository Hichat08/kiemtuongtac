import type { WithdrawalRequest } from "@/lib/withdrawal-requests";
import { userService } from "@/services/userService";
import { useEffect, useState } from "react";

export function useWithdrawalRequest(requestId?: string) {
  const [request, setRequest] = useState<WithdrawalRequest | null>(null);
  const [loading, setLoading] = useState(Boolean(requestId));

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    let active = true;

    const syncRequest = async () => {
      try {
        setLoading(true);
        const data = await userService.getWithdrawalRequest(requestId);

        if (!active) {
          return;
        }

        setRequest(data.request);
      } catch (error) {
        console.error("Không tải được yêu cầu rút tiền", error);

        if (!active) {
          return;
        }

        setRequest(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void syncRequest();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncRequest();
      }
    };

    const handleWindowFocus = () => {
      void syncRequest();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestId]);

  return { request, loading };
}
