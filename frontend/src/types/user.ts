export type UserModerationStatus = "active" | "warned" | "locked";
export type UserCommunityChatStatus = "active" | "locked";

export interface User {
  _id: string;
  accountId?: string;
  role?: "user" | "admin";
  authProviders?: string[];
  username: string;
  email: string;
  displayName: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  moderationStatus?: UserModerationStatus;
  restoreModerationStatus?: Exclude<UserModerationStatus, "locked">;
  warningCount?: number;
  moderationNote?: string;
  lastWarnedAt?: string | null;
  lockedAt?: string | null;
  communityChatStatus?: UserCommunityChatStatus;
  communityChatModerationNote?: string;
  communityChatLockedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternalTransferRecipient {
  _id: string;
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface InternalTransferRecipientResponse {
  user: InternalTransferRecipient | null;
}

export interface UpdateUserProfilePayload {
  displayName: string;
  phone?: string;
  bio?: string;
}

export interface UpdateUserProfileResponse {
  message: string;
  user: User;
}

export interface UserNotificationActivitySettings {
  newTasks: boolean;
  reviewStatus: boolean;
  balanceChanges: boolean;
}

export interface UserNotificationSystemSettings {
  adminMessages: boolean;
  promotions: boolean;
}

export interface UserNotificationSettings {
  activity: UserNotificationActivitySettings;
  system: UserNotificationSystemSettings;
  emailDigest: boolean;
  pushEnabled: boolean;
}

export interface UpdateUserNotificationSettingsPayload {
  activity?: Partial<UserNotificationActivitySettings>;
  system?: Partial<UserNotificationSystemSettings>;
  emailDigest?: boolean;
  pushEnabled?: boolean;
}

export interface UserNotificationSettingsResponse {
  settings: UserNotificationSettings;
}

export interface UpdateUserNotificationSettingsResponse {
  message: string;
  settings: UserNotificationSettings;
}

export type UserReferralInviteeStatus = "verified" | "pending";

export interface UserReferralInvitee {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  invitedAt?: string | null;
  status: UserReferralInviteeStatus;
}

export interface UserReferralOverviewResponse {
  summary: {
    totalInvited: number;
    verifiedInvited: number;
    pendingInvited: number;
    rewardPerInvite: number;
    estimatedRewardTotal: number;
    estimatedPendingReward: number;
  };
  invitees: UserReferralInvitee[];
}

export type UserBankAccountStatus = "pending" | "verified" | "locked";

export interface UserBankAccount {
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
  status: UserBankAccountStatus;
  restoreStatus: Exclude<UserBankAccountStatus, "locked">;
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

export interface UserBankAccountsResponse {
  accounts: UserBankAccount[];
}

export interface BankAccountVerificationPayload {
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  swiftCode?: string;
  note?: string;
  primary?: boolean;
}

export interface DepositReceivingAccount {
  id: string;
  label: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  status: "active" | "paused";
  isPrimary: boolean;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepositReceivingAccountResponse {
  account: DepositReceivingAccount | null;
}

export type UserBroadcastNotificationType = "system" | "promotion" | "warning" | "task";
export type UserBroadcastNotificationAudience = "all" | "verified" | "new_7d";

export interface UserBroadcastNotification {
  id: string;
  title: string;
  content: string;
  type: UserBroadcastNotificationType;
  audience: UserBroadcastNotificationAudience;
  status: "sent" | "scheduled";
  imageUrl?: string;
  recipientCount: number;
  createdByName?: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UserBroadcastNotificationsResponse {
  notifications: UserBroadcastNotification[];
}

export interface Friend {
  _id: string;
  username: string;
  displayName: string;
  role?: "user" | "admin";
  avatarUrl?: string;
}

export interface FriendRequest {
  _id: string;
  from?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  to?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  message: string;
  createdAt: string;
  updatedAt: string;
}
