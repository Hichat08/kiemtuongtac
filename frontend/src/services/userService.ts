import api from "@/lib/axios";
import type {
  DepositRequest,
  FinanceSettingsResponse,
  UserFinancialOverviewResponse,
  UserHomeOverviewResponse,
  WithdrawalRequest,
} from "@/types/finance";
import type {
  BankAccountVerificationPayload,
  DepositReceivingAccountResponse,
  InternalTransferRecipientResponse,
  UpdateUserNotificationSettingsPayload,
  UpdateUserNotificationSettingsResponse,
  UpdateUserProfilePayload,
  UpdateUserProfileResponse,
  UserBroadcastNotificationsResponse,
  UserBankAccount,
  UserBankAccountsResponse,
  UserNotificationSettingsResponse,
  UserReferralOverviewResponse,
} from "@/types/user";
import type {
  TaskCatalogItem,
  TaskSubmissionRow,
  UserTaskDetailResponse,
  UserTaskHistoryResponse,
  UserTasksResponse,
} from "@/types/task";

export const userService = {
  async getLockStatus() {
    const res = await api.get<{
      status: string;
      note?: string;
      lockedAt?: string | null;
      lastWarnedAt?: string | null;
      warningCount?: number;
    }>("/users/lock-status");
    return res.data;
  },
  async updateProfile(payload: UpdateUserProfilePayload) {
    const res = await api.patch<UpdateUserProfileResponse>(
      "/users/me",
      payload,
    );
    return res.data;
  },

  async getBankAccounts() {
    const res = await api.get<UserBankAccountsResponse>("/users/bank-accounts");
    return res.data;
  },

  async getNotificationSettings() {
    const res = await api.get<UserNotificationSettingsResponse>(
      "/users/notification-settings",
    );
    return res.data;
  },

  async updateNotificationSettings(
    payload: UpdateUserNotificationSettingsPayload,
  ) {
    const res = await api.patch<UpdateUserNotificationSettingsResponse>(
      "/users/notification-settings",
      payload,
    );
    return res.data;
  },

  async getReferralOverview() {
    const res = await api.get<UserReferralOverviewResponse>("/users/referrals");
    return res.data;
  },

  async submitBankAccountVerificationRequest(
    payload: BankAccountVerificationPayload,
  ) {
    const res = await api.post<{ message: string; account: UserBankAccount }>(
      "/users/bank-accounts/verification-request",
      payload,
    );

    return res.data;
  },

  async getDepositReceivingAccount() {
    const res = await api.get<DepositReceivingAccountResponse>(
      "/users/deposit-account",
    );
    return res.data;
  },

  async getInternalTransferRecipient(accountId: string) {
    const res = await api.get<InternalTransferRecipientResponse>(
      `/users/internal-transfer-recipient?accountId=${encodeURIComponent(accountId)}`,
    );
    return res.data;
  },

  async getFinancialOverview() {
    const res = await api.get<UserFinancialOverviewResponse>(
      "/users/financial-overview",
    );
    return res.data;
  },

  async getHomeOverview() {
    const res = await api.get<UserHomeOverviewResponse>(
      "/users/home-overview",
      {
        params: { at: Date.now() },
      },
    );
    return res.data;
  },

  async getBroadcastNotifications() {
    const res = await api.get<UserBroadcastNotificationsResponse>(
      "/users/broadcast-notifications",
    );
    return res.data;
  },

  async getFinanceSettings() {
    const res = await api.get<FinanceSettingsResponse>(
      "/users/finance-settings",
    );
    return res.data;
  },

  async getTasks() {
    const res = await api.get<UserTasksResponse>("/users/tasks");
    return res.data;
  },

  async getTaskDetail(taskId: string) {
    const res = await api.get<UserTaskDetailResponse>(`/users/tasks/${taskId}`);
    return res.data;
  },

  async getTaskHistory() {
    const res = await api.get<UserTaskHistoryResponse>(
      "/users/task-submissions",
    );
    return res.data;
  },

  async submitTaskSubmission(taskId: string, formData: FormData) {
    const res = await api.post<{
      message: string;
      submission: TaskSubmissionRow;
      task: TaskCatalogItem;
    }>(`/users/tasks/${taskId}/submissions`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async createDepositRequest(payload: {
    amount: number;
    bonusAmount: number;
    totalAmount: number;
    methodId: DepositRequest["methodId"];
    methodTitle: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    transferCode: string;
    note?: string;
  }) {
    const res = await api.post<{ message: string; request: DepositRequest }>(
      "/users/deposit-requests",
      payload,
    );
    return res.data;
  },

  async getDepositRequest(requestId: string) {
    const res = await api.get<{ request: DepositRequest }>(
      `/users/deposit-requests/${requestId}`,
    );
    return res.data;
  },

  async createWithdrawalRequest(payload: {
    withdrawalType?: "bank" | "internal";
    bankAccountId?: string;
    recipientAccountId?: string;
    amount: number;
    verificationCode: string;
    note?: string;
  }) {
    const res = await api.post<{ message: string; request: WithdrawalRequest }>(
      "/users/withdrawal-requests",
      payload,
    );
    return res.data;
  },

  async getWithdrawalRequest(requestId: string) {
    const res = await api.get<{ request: WithdrawalRequest }>(
      `/users/withdrawal-requests/${requestId}`,
    );
    return res.data;
  },

  async requestWithdrawalVerificationCode() {
    const res = await api.post<{
      message: string;
      resendAfter: number;
      expiresIn: number;
      sent: boolean;
    }>("/users/withdrawal-requests/request-code");
    return res.data;
  },

  uploadAvatar: async (formData: FormData) => {
    const res = await api.post("/users/uploadAvatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.status === 400) {
      throw new Error(res.data.message);
    }

    return res.data;
  },

  async regenerateRegistrationPin() {
    const res = await api.post<{
      message: string;
      pin: string;
      expiresIn: number;
    }>("/users/registration-pin/regenerate");
    return res.data;
  },
};
