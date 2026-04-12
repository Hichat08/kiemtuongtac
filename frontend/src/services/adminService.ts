import api from "@/lib/axios";
import type {
  CommunityUserReportsResponse,
  CommunityUserReportRow,
  CommunityUserReportStatus,
} from "@/types/community-report";
import type {
  AdminDepositRequestsResponse,
  AdminWithdrawalRequestsResponse,
  DepositRequest,
  FinanceSettingsResponse,
  WithdrawalRequest,
} from "@/types/finance";
import type {
  AdminBroadcastNotificationsResponse,
  AdminBroadcastRow,
  AdminBroadcastStatus,
  AdminNavigationIndicatorsResponse,
  AdminBankAccountAction,
  AdminBankAccountsResponse,
  AdminCampaignRow,
  AdminCampaignsResponse,
  AdminCampaignStatus,
  AdminDepositAccountRow,
  AdminDepositAccountsResponse,
  AdminOverviewResponse,
  AdminTaskRow,
  AdminTaskSubmissionRow,
  AdminTaskSubmissionsResponse,
  AdminTasksResponse,
  AdminUserCommunityChatAction,
  AdminTaskStatus,
  AdminUserDetailResponse,
  AdminUserModerationAction,
  AdminUserStatusFilter,
  AdminUsersResponse,
  AdminWalletAdjustmentResult,
} from "@/types/admin";

export const adminService = {
  async getOverview() {
    const res = await api.get<AdminOverviewResponse>("/admin/overview");
    return res.data;
  },
  async getBroadcastNotifications() {
    const res = await api.get<AdminBroadcastNotificationsResponse>("/admin/broadcast-notifications");
    return res.data;
  },
  async createBroadcastNotification(payload: {
    title: string;
    content: string;
    type: AdminBroadcastRow["type"];
    audience: AdminBroadcastRow["audience"];
    status: AdminBroadcastStatus;
    imageUrl?: string;
    scheduledAt?: string | null;
  }) {
    const res = await api.post<{ message: string; notification: AdminBroadcastRow }>(
      "/admin/broadcast-notifications",
      payload
    );
    return res.data;
  },
  async getNavigationIndicators() {
    const res = await api.get<AdminNavigationIndicatorsResponse>("/admin/navigation-indicators");
    return res.data;
  },
  async getFinanceSettings() {
    const res = await api.get<FinanceSettingsResponse>("/admin/settings/finance");
    return res.data;
  },
  async updateFinanceSettings(payload: {
    minDepositAmount: number;
    minWithdrawalAmount: number;
    depositBonusPercent: number;
    depositBonusEnabled?: boolean;
    withdrawalFeePercent: number;
    processingMode: "instant" | "standard" | "manual";
  }) {
    const res = await api.patch<{
      message: string;
      settings: FinanceSettingsResponse["settings"];
    }>("/admin/settings/finance", payload);
    return res.data;
  },
  async getUsers(params?: {
    search?: string;
    status?: AdminUserStatusFilter;
    page?: number;
    limit?: number;
  }) {
    const res = await api.get<AdminUsersResponse>("/admin/users", { params });
    return res.data;
  },
  async getUserDetail(userId: string) {
    const res = await api.get<AdminUserDetailResponse>(`/admin/users/${userId}`);
    return res.data;
  },
  async updateUserModeration(userId: string, payload: { action: AdminUserModerationAction; note?: string }) {
    const res = await api.patch<{ message: string; user: AdminUserDetailResponse["user"] }>(
      `/admin/users/${userId}/moderation`,
      payload
    );
    return res.data;
  },
  async updateUserCommunityChat(
    userId: string,
    payload: { action: AdminUserCommunityChatAction; note?: string }
  ) {
    const res = await api.patch<{ message: string; user: AdminUserDetailResponse["user"] }>(
      `/admin/users/${userId}/community-chat`,
      payload
    );
    return res.data;
  },
  async clearUserWalletBalance(userId: string, payload: { note: string }) {
    const res = await api.post<{
      message: string;
      adjustment: AdminWalletAdjustmentResult;
      walletSummary: AdminUserDetailResponse["walletSummary"];
    }>(`/admin/users/${userId}/wallet/clear-balance`, payload);
    return res.data;
  },
  async getCampaigns() {
    const res = await api.get<AdminCampaignsResponse>("/admin/campaigns");
    return res.data;
  },
  async createCampaign(payload: {
    title: string;
    category: AdminCampaignRow["category"];
    status: AdminCampaignStatus;
    audience: string;
    benefit: string;
    summary: string;
    startAt?: string | null;
    endAt?: string | null;
    highlighted?: boolean;
  }) {
    const res = await api.post<{ message: string; campaign: AdminCampaignRow }>(
      "/admin/campaigns",
      payload
    );
    return res.data;
  },
  async updateCampaign(
    campaignId: string,
    payload: {
      title: string;
      category: AdminCampaignRow["category"];
      status: AdminCampaignStatus;
      audience: string;
      benefit: string;
      summary: string;
      startAt?: string | null;
      endAt?: string | null;
      highlighted?: boolean;
    }
  ) {
    const res = await api.patch<{ message: string; campaign: AdminCampaignRow }>(
      `/admin/campaigns/${campaignId}`,
      payload
    );
    return res.data;
  },
  async updateCampaignStatus(campaignId: string, payload: { status: AdminCampaignStatus }) {
    const res = await api.patch<{ message: string; campaign: AdminCampaignRow }>(
      `/admin/campaigns/${campaignId}/status`,
      payload
    );
    return res.data;
  },
  async deleteCampaign(campaignId: string) {
    const res = await api.delete<{ message: string }>(`/admin/campaigns/${campaignId}`);
    return res.data;
  },
  async getTasks() {
    const res = await api.get<AdminTasksResponse>("/admin/tasks");
    return res.data;
  },
  async getTaskSubmissions() {
    const res = await api.get<AdminTaskSubmissionsResponse>("/admin/task-submissions");
    return res.data;
  },
  async getCommunityReports() {
    const res = await api.get<CommunityUserReportsResponse>("/admin/community-reports");
    return res.data;
  },
  async updateCommunityReportStatus(
    reportId: string,
    payload: { status: CommunityUserReportStatus; reviewNote?: string }
  ) {
    const res = await api.patch<{ message: string; report: CommunityUserReportRow }>(
      `/admin/community-reports/${reportId}/status`,
      payload
    );
    return res.data;
  },
  async reviewTaskSubmission(
    submissionId: string,
    payload: { status: "approved" | "rejected"; reviewNote?: string }
  ) {
    const res = await api.patch<{ message: string; submission: AdminTaskSubmissionRow }>(
      `/admin/task-submissions/${submissionId}/review`,
      payload
    );
    return res.data;
  },
  async createTask(payload: {
    code?: string;
    title: string;
    brand: string;
    platform: AdminTaskRow["platform"];
    reward: number;
    current: number;
    target: number;
    status: AdminTaskStatus;
    description: string;
    actionLabel?: string;
    hot?: boolean;
  }) {
    const res = await api.post<{ message: string; task: AdminTaskRow }>("/admin/tasks", payload);
    return res.data;
  },
  async updateTask(
    taskId: string,
    payload: {
      code: string;
      title: string;
      brand: string;
      platform: AdminTaskRow["platform"];
      reward: number;
      current: number;
      target: number;
      status: AdminTaskStatus;
      description: string;
      actionLabel?: string;
      hot?: boolean;
    }
  ) {
    const res = await api.patch<{ message: string; task: AdminTaskRow }>(
      `/admin/tasks/${taskId}`,
      payload
    );
    return res.data;
  },
  async updateTaskStatus(taskId: string, payload: { status: AdminTaskStatus }) {
    const res = await api.patch<{ message: string; task: AdminTaskRow }>(
      `/admin/tasks/${taskId}/status`,
      payload
    );
    return res.data;
  },
  async deleteTask(taskId: string) {
    const res = await api.delete<{ message: string }>(`/admin/tasks/${taskId}`);
    return res.data;
  },
  async getBankAccounts() {
    const res = await api.get<AdminBankAccountsResponse>("/admin/bank-accounts");
    return res.data;
  },
  async getDepositRequests() {
    const res = await api.get<AdminDepositRequestsResponse>("/admin/deposit-requests");
    return res.data;
  },
  async updateDepositRequestStatus(
    requestId: string,
    payload: { status: DepositRequest["status"]; note?: string }
  ) {
    const res = await api.patch<{ message: string; request: DepositRequest }>(
      `/admin/deposit-requests/${requestId}/status`,
      payload
    );
    return res.data;
  },
  async updateBankAccountStatus(
    accountId: string,
    payload: { action: AdminBankAccountAction; verificationNote?: string }
  ) {
    const res = await api.patch<{ message: string; account: AdminBankAccountsResponse["accounts"][number] }>(
      `/admin/bank-accounts/${accountId}/status`,
      payload
    );
    return res.data;
  },
  async getDepositAccounts() {
    const res = await api.get<AdminDepositAccountsResponse>("/admin/deposit-accounts");
    return res.data;
  },
  async createDepositAccount(payload: {
    label: string;
    bankCode: string;
    bankName?: string;
    accountNumber: string;
    accountHolder: string;
    branch: string;
    note?: string;
  }) {
    const res = await api.post<{ message: string; account: AdminDepositAccountRow }>(
      "/admin/deposit-accounts",
      payload
    );
    return res.data;
  },
  async updateDepositAccount(
    accountId: string,
    payload: {
      label: string;
      bankCode: string;
      bankName?: string;
      accountNumber: string;
      accountHolder: string;
      branch: string;
      note?: string;
    }
  ) {
    const res = await api.patch<{ message: string; account: AdminDepositAccountRow }>(
      `/admin/deposit-accounts/${accountId}`,
      payload
    );
    return res.data;
  },
  async setPrimaryDepositAccount(accountId: string) {
    const res = await api.patch<{ message: string; account: AdminDepositAccountRow }>(
      `/admin/deposit-accounts/${accountId}/primary`
    );
    return res.data;
  },
  async updateDepositAccountStatus(
    accountId: string,
    payload: { status: "active" | "paused" }
  ) {
    const res = await api.patch<{ message: string; account: AdminDepositAccountRow }>(
      `/admin/deposit-accounts/${accountId}/status`,
      payload
    );
    return res.data;
  },
  async getWithdrawalRequests() {
    const res = await api.get<AdminWithdrawalRequestsResponse>("/admin/withdrawal-requests");
    return res.data;
  },
  async updateWithdrawalRequestStatus(
    requestId: string,
    payload: { status: WithdrawalRequest["status"]; note?: string }
  ) {
    const res = await api.patch<{ message: string; request: WithdrawalRequest }>(
      `/admin/withdrawal-requests/${requestId}/status`,
      payload
    );
    return res.data;
  },
};
