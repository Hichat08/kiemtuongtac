import type { DepositMethodId } from "@/lib/deposit-checkout";

export type DepositStatus = "pending" | "approved" | "rejected";
export type WithdrawalStatus = "pending" | "approved" | "rejected";
export type WithdrawalType = "bank" | "internal";
export type FinanceProcessingMode = "instant" | "standard" | "manual";
export type WalletAdjustmentDirection = "credit" | "debit";
export type WalletAdjustmentReasonCode =
  | "fraud_balance_clear"
  | "task_submission_reward"
  | "community_gift_send"
  | "community_gift_claim"
  | "internal_transfer_in";

export interface FinanceSettings {
  minDepositAmount: number;
  minWithdrawalAmount: number;
  depositBonusPercent: number;
  depositBonusEnabled: boolean;
  depositBonusEligible?: boolean;
  withdrawalFeePercent: number;
  processingMode: FinanceProcessingMode;
  processingModeLabel: string;
  updatedAt?: string | null;
}

export interface FinanceSettingsResponse {
  settings: FinanceSettings;
}

export interface DepositRequest {
  id: string;
  userName: string;
  userId: string;
  amount: number;
  bonusAmount: number;
  totalAmount: number;
  methodId: DepositMethodId;
  methodTitle: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferCode: string;
  requestedAt: string;
  status: DepositStatus;
  note?: string;
  createdAtMs?: number;
  processedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

export interface WithdrawalRequest {
  id: string;
  userName: string;
  userId: string;
  withdrawalType?: WithdrawalType;
  bankName: string;
  bankCode: string;
  bankAccount: string;
  accountHolder: string;
  branch: string;
  amount: number;
  feePercent?: number;
  feeAmount?: number;
  receivableAmount?: number;
  processingMode?: FinanceProcessingMode;
  processingModeLabel?: string;
  requestedAt: string;
  status: WithdrawalStatus;
  confirmationCode?: string;
  note?: string;
  internalRecipientUserId?: string;
  internalRecipientAccountId?: string;
  internalRecipientDisplayName?: string;
  createdAtMs?: number;
  processedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

export interface UserFinancialSummary {
  currentBalance: number;
  withdrawableBalance: number;
  pendingTotal: number;
  settledTotal: number;
  approvedDepositTotal: number;
  approvedWithdrawalTotal: number;
  approvedAdjustmentCreditTotal?: number;
  approvedAdjustmentDebitTotal?: number;
  adjustmentCount?: number;
  todayNetChange: number;
}

export interface UserWalletAdjustment {
  id: string;
  userId: string;
  userAccountId: string;
  userDisplayName: string;
  direction: WalletAdjustmentDirection;
  reasonCode: WalletAdjustmentReasonCode;
  reasonLabel: string;
  amount: number;
  note?: string;
  effectiveAt: string;
  createdAtMs: number;
  createdAt: string;
}

export interface UserFinancialOverviewResponse {
  summary: UserFinancialSummary;
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  adjustments: UserWalletAdjustment[];
}

export interface UserHomeDailySeriesPoint {
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  topUpAmount: number;
  earningAmount: number;
  spendingAmount: number;
  depositAmount: number;
  withdrawalAmount: number;
  netAmount: number;
}

export type UserHomeLeaderboardPeriod = "daily" | "weekly" | "monthly";

export interface UserHomeLeaderboardEntry {
  rank: number;
  userId: string;
  accountId: string;
  displayName: string;
  avatarUrl?: string;
  currentBalance: number;
  periodNetChange: number;
  isCurrentUser: boolean;
}

export interface UserHomeLeaderboardCollection {
  daily: UserHomeLeaderboardEntry[];
  weekly: UserHomeLeaderboardEntry[];
  monthly: UserHomeLeaderboardEntry[];
}

export interface UserHomeLeaderboardRankCollection {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
}

export interface UserHomeLeaderboardEntryCollection {
  daily: UserHomeLeaderboardEntry | null;
  weekly: UserHomeLeaderboardEntry | null;
  monthly: UserHomeLeaderboardEntry | null;
}

export interface UserHomeOverviewResponse {
  summary: UserFinancialSummary;
  approvedRequestCount: number;
  pendingRequestCount: number;
  dailySeries: UserHomeDailySeriesPoint[];
  weeklyNetChange: number;
  previousWeeklyNetChange: number;
  weeklyGrowthRate: number;
  weeklyLeaderboard: UserHomeLeaderboardEntry[];
  currentUserWeeklyRank: number | null;
  leaderboards: UserHomeLeaderboardCollection;
  currentUserLeaderboardRanks: UserHomeLeaderboardRankCollection;
  currentUserLeaderboardEntries: UserHomeLeaderboardEntryCollection;
}

export interface AdminDepositRequestsResponse {
  summary: {
    totalAmount: number;
    totalBonus: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  requests: DepositRequest[];
}

export interface AdminWithdrawalRequestsResponse {
  summary: {
    totalAmount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  requests: WithdrawalRequest[];
}
