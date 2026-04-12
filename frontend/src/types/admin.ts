import type { TaskCatalogItem, TaskPlatform, TaskStatus, TaskSubmissionRow } from "./task";

export type AdminModerationStatus = "active" | "warned" | "locked";
export type AdminUserModerationAction = "warn" | "lock" | "unlock" | "clear";
export type AdminUserCommunityChatAction = "lock" | "unlock";

export interface AdminOverviewSummary {
  totalUsers: number;
  totalAdmins: number;
  verifiedUsers: number;
  activeSessions: number;
  pendingEmailVerifications: number;
  totalConversations: number;
  totalMessages: number;
  pendingFriendRequests: number;
  newUsersToday: number;
  totalCirculatingBalance: number;
  totalDepositAmount: number;
  approvedDepositRequests: number;
  pendingDepositRequests: number;
  totalWithdrawalAmount: number;
  approvedWithdrawalRequests: number;
  pendingWithdrawalRequests: number;
}

export interface AdminGrowthPoint {
  date: string;
  label: string;
  count: number;
}

export interface AdminUserRow {
  _id: string;
  accountId?: string;
  displayName: string;
  email: string;
  username?: string;
  role: "user" | "admin";
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  avatarUrl?: string;
  phone?: string;
  bio?: string;
  authProviders?: string[];
  moderationStatus?: AdminModerationStatus;
  restoreModerationStatus?: Exclude<AdminModerationStatus, "locked">;
  warningCount?: number;
  moderationNote?: string;
  lastWarnedAt?: string | null;
  lockedAt?: string | null;
  communityChatStatus?: "active" | "locked";
  communityChatModerationNote?: string;
  communityChatLockedAt?: string | null;
}

export interface AdminOverviewResponse {
  summary: AdminOverviewSummary;
  growth: AdminGrowthPoint[];
  growthDaily: AdminGrowthPoint[];
  growthWeekly: AdminGrowthPoint[];
  recentUsers: AdminUserRow[];
  latestSignIns: AdminUserRow[];
  currentAdmin: {
    _id: string;
    displayName: string;
    email: string;
    role: "user" | "admin";
    accountId?: string;
  };
}

export interface AdminNavigationIndicators {
  support: number;
  tasks: number;
  community: number;
  deposits: number;
  withdrawals: number;
  bankAccounts: number;
}

export interface AdminNavigationIndicatorsResponse {
  indicators: AdminNavigationIndicators;
}

export type AdminUserStatusFilter = "all" | "active" | "pending";

export interface AdminUsersSummary {
  totalUsers: number;
  newUsersToday: number;
  activeUsers: number;
  pendingUsers: number;
  totalAdmins: number;
}

export interface AdminUsersPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface AdminUsersResponse {
  summary: AdminUsersSummary;
  filters: {
    search: string;
    status: AdminUserStatusFilter;
  };
  pagination: AdminUsersPagination;
  users: AdminUserRow[];
}

export interface AdminUserDetailResponse {
  user: AdminUserRow;
  bankAccountsSummary: {
    total: number;
    verified: number;
    pending: number;
    locked: number;
  };
  walletSummary: AdminUserWalletSummary;
}

export interface AdminUserWalletSummary {
  currentBalance: number;
  withdrawableBalance: number;
  pendingTotal: number;
  approvedDepositTotal: number;
  approvedWithdrawalTotal: number;
  approvedAdjustmentDebitTotal: number;
  adjustmentCount: number;
  lastAdjustedAt?: string | null;
}

export interface AdminWalletAdjustmentResult {
  id: string;
  amount: number;
  note: string;
  reasonCode: "fraud_balance_clear";
  reasonLabel: string;
  effectiveAt?: string | null;
}

export type AdminBankAccountStatus = "verified" | "pending" | "locked";
export type AdminBankAccountAction = "verify" | "reject" | "lock" | "unlock";

export interface AdminBankAccountRow {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerCode: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  status: AdminBankAccountStatus;
  restoreStatus: Exclude<AdminBankAccountStatus, "locked">;
  primary: boolean;
  linkedPhone: string;
  identityNumber: string;
  swiftCode: string;
  province: string;
  address: string;
  note?: string;
  verificationNote?: string;
  linkedAt?: string;
  submittedAt?: string;
  updatedAt?: string;
}

export interface AdminBankAccountsResponse {
  summary: {
    total: number;
    verified: number;
    pending: number;
    locked: number;
    primary: number;
  };
  accounts: AdminBankAccountRow[];
}

export type AdminDepositAccountStatus = "active" | "paused";

export interface AdminDepositAccountRow {
  id: string;
  label: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  status: AdminDepositAccountStatus;
  isPrimary: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDepositAccountsResponse {
  summary: {
    total: number;
    activeCount: number;
    pausedCount: number;
    primaryLabel: string;
  };
  accounts: AdminDepositAccountRow[];
}

export type AdminBroadcastType = "system" | "promotion" | "warning" | "task";
export type AdminBroadcastAudience = "all" | "verified" | "new_7d";
export type AdminBroadcastStatus = "sent" | "scheduled";

export interface AdminBroadcastRow {
  id: string;
  title: string;
  content: string;
  type: AdminBroadcastType;
  audience: AdminBroadcastAudience;
  status: AdminBroadcastStatus;
  imageUrl?: string;
  recipientCount: number;
  createdByName?: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminBroadcastNotificationsResponse {
  summary: {
    total: number;
    sent: number;
    scheduled: number;
    system: number;
    promotion: number;
    warning: number;
    task: number;
  };
  notifications: AdminBroadcastRow[];
}

export type AdminCampaignCategory = "event" | "promotion";
export type AdminCampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed";

export interface AdminCampaignRow {
  id: string;
  title: string;
  category: AdminCampaignCategory;
  status: AdminCampaignStatus;
  audience: string;
  benefit: string;
  summary: string;
  startAt?: string | null;
  endAt?: string | null;
  highlighted: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminCampaignsResponse {
  summary: {
    total: number;
    running: number;
    scheduled: number;
    draft: number;
    paused: number;
    completed: number;
    events: number;
    promotions: number;
    highlighted: number;
  };
  campaigns: AdminCampaignRow[];
}

export type AdminTaskPlatform = TaskPlatform;
export type AdminTaskStatus = TaskStatus;

export interface AdminTaskRow extends TaskCatalogItem {}

export interface AdminTasksResponse {
  summary: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    paused: number;
    hot: number;
    totalTarget: number;
    totalCurrent: number;
  };
  tasks: AdminTaskRow[];
}

export interface AdminTaskSubmissionRow extends TaskSubmissionRow {}

export interface AdminTaskSubmissionsResponse {
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    pendingRewardTotal: number;
  };
  submissions: AdminTaskSubmissionRow[];
}
