import { formatDepositRequestedFull, type DepositRequest } from "@/lib/deposit-requests";
import {
  formatWithdrawalRequestedFull,
  type WithdrawalRequest,
} from "@/lib/withdrawal-requests";
import { userService } from "@/services/userService";
import type {
  UserFinancialSummary,
  UserWalletAdjustment,
  WalletAdjustmentDirection,
} from "@/types/finance";
import { useEffect, useMemo, useRef, useState } from "react";

type FinancialRequestStatus = "pending" | "approved" | "rejected";
type FinancialRequestKind = "deposit" | "withdrawal" | "adjustment";

export interface UserFinancialTimelineItem {
  id: string;
  kind: FinancialRequestKind;
  status: FinancialRequestStatus;
  amount: number;
  direction: WalletAdjustmentDirection;
  title: string;
  detail: string;
  createdAtMs: number;
  timeLabel: string;
  reasonCode?: UserWalletAdjustment["reasonCode"];
  withdrawalType?: WithdrawalRequest["withdrawalType"];
}

const EMPTY_SUMMARY: UserFinancialSummary = {
  currentBalance: 0,
  withdrawableBalance: 0,
  pendingTotal: 0,
  settledTotal: 0,
  approvedDepositTotal: 0,
  approvedWithdrawalTotal: 0,
  todayNetChange: 0,
};

const FINANCIAL_POLL_INTERVAL_MS = 30_000;
const adjustmentTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const getRequestTimestamp = (request: { createdAtMs?: number; requestedAt?: string }) => {
  if (typeof request.createdAtMs === "number" && Number.isFinite(request.createdAtMs)) {
    return request.createdAtMs;
  }

  const requestedAt = `${request.requestedAt ?? ""}`.trim();

  if (!requestedAt) {
    return 0;
  }

  const parsedDate = new Date(requestedAt);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

const formatAdjustmentTimeLabel = (value?: string | null) => {
  const parsedDate = new Date(value ?? "");

  if (Number.isNaN(parsedDate.getTime())) {
    return "Thời gian không xác định";
  }

  return adjustmentTimeFormatter.format(parsedDate);
};

const resolveAdjustmentTitle = (adjustment: UserWalletAdjustment) => {
  switch (adjustment.reasonCode) {
    case "community_gift_send":
      return "Gửi quà cộng đồng";
    case "community_gift_claim":
      return "Nhận quà cộng đồng";
    case "internal_transfer_in":
      return "Nhận chuyển tiền nội bộ";
    case "task_submission_reward":
      return "Thưởng nhiệm vụ";
    case "fraud_balance_clear":
      return "Điều chỉnh số dư";
    default:
      return adjustment.reasonLabel || "Điều chỉnh ví";
  }
};

const resolveAdjustmentDetail = (adjustment: UserWalletAdjustment) => {
  const note = `${adjustment.note ?? ""}`.trim();
  return note || adjustment.reasonLabel || "Biến động số dư ví đã được ghi nhận.";
};

export function useUserFinancialData(accountId?: string | null) {
  const [summary, setSummary] = useState<UserFinancialSummary>(EMPTY_SUMMARY);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [adjustments, setAdjustments] = useState<UserWalletAdjustment[]>([]);
  const refreshFinancialDataRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!accountId) {
      setSummary(EMPTY_SUMMARY);
      setDepositRequests([]);
      setWithdrawalRequests([]);
      setAdjustments([]);
      refreshFinancialDataRef.current = null;
      return;
    }

    let active = true;

    const syncFinancialData = async () => {
      try {
        const data = await userService.getFinancialOverview();

        if (!active) {
          return;
        }

        setSummary(data.summary);
        setDepositRequests(data.deposits);
        setWithdrawalRequests(data.withdrawals);
        setAdjustments(data.adjustments);
      } catch (error) {
        console.error("Không tải được dữ liệu ví người dùng", error);

        if (!active) {
          return;
        }

        setSummary(EMPTY_SUMMARY);
        setDepositRequests([]);
        setWithdrawalRequests([]);
        setAdjustments([]);
      }
    };

    refreshFinancialDataRef.current = syncFinancialData;

    void syncFinancialData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncFinancialData();
      }
    };

    const handleWindowFocus = () => {
      void syncFinancialData();
    };

    const intervalId = window.setInterval(() => {
      void syncFinancialData();
    }, FINANCIAL_POLL_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      refreshFinancialDataRef.current = null;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accountId, refreshFinancialDataRef]);

  return useMemo(() => {
    if (!accountId) {
      return {
        ...EMPTY_SUMMARY,
        transactions: [] as UserFinancialTimelineItem[],
        refresh: async () => {},
      };
    }

    const transactions: UserFinancialTimelineItem[] = [
      ...depositRequests.map((request) => ({
        id: request.id,
        kind: "deposit" as const,
        status: request.status,
        amount: request.amount,
        direction: "credit" as const,
        title:
          request.status === "approved"
            ? "Nạp tiền thành công"
            : request.status === "rejected"
              ? "Yêu cầu nạp bị từ chối"
              : "Yêu cầu nạp tiền",
        detail:
          request.note?.trim() ||
          `${request.methodTitle || "Nạp tiền"} • ${request.bankName || "Tài khoản nhận"}`,
        createdAtMs: getRequestTimestamp(request),
        timeLabel: formatDepositRequestedFull(request),
      })),
      ...withdrawalRequests.map((request) => ({
        id: request.id,
        kind: "withdrawal" as const,
        status: request.status,
        amount: request.amount,
        direction: "debit" as const,
        title:
          request.status === "approved"
            ? request.withdrawalType === "internal"
              ? "Chuyển tiền nội bộ thành công"
              : "Rút tiền thành công"
            : request.status === "rejected"
              ? request.withdrawalType === "internal"
                ? "Chuyển tiền nội bộ bị từ chối"
                : "Yêu cầu rút bị từ chối"
              : request.withdrawalType === "internal"
                ? "Yêu cầu chuyển tiền nội bộ"
                : "Yêu cầu rút tiền",
        detail:
          request.note?.trim() ||
          `${request.bankName || "Ngân hàng"} • ${
            request.internalRecipientAccountId || request.bankAccount || "Tài khoản nhận"
          }`,
        createdAtMs: getRequestTimestamp(request),
        timeLabel: formatWithdrawalRequestedFull(request),
        withdrawalType: request.withdrawalType,
      })),
      ...adjustments.map((adjustment) => ({
        id: adjustment.id,
        kind: "adjustment" as const,
        status: "approved" as const,
        amount: adjustment.amount,
        direction: adjustment.direction,
        title: resolveAdjustmentTitle(adjustment),
        detail: resolveAdjustmentDetail(adjustment),
        createdAtMs: adjustment.createdAtMs,
        timeLabel: formatAdjustmentTimeLabel(adjustment.effectiveAt),
        reasonCode: adjustment.reasonCode,
      })),
    ].sort((left, right) => right.createdAtMs - left.createdAtMs);

    return {
      ...summary,
      transactions,
      refresh: async () => {
        await refreshFinancialDataRef.current?.();
      },
    };
  }, [accountId, adjustments, depositRequests, refreshFinancialDataRef, summary, withdrawalRequests]);
}
