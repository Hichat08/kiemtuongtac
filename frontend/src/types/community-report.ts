export type CommunityUserReportCategory =
  | "spam"
  | "scam"
  | "harassment"
  | "impersonation"
  | "abuse"
  | "other";

export type CommunityUserReportStatus =
  | "pending"
  | "in_review"
  | "resolved"
  | "dismissed";

export interface CommunityUserReportUserSummary {
  id: string;
  accountId?: string;
  displayName: string;
  avatarUrl?: string | null;
  role?: "user" | "admin";
  moderationStatus?: "active" | "warned" | "locked";
  communityChatStatus?: "active" | "locked";
  communityChatLockedAt?: string | null;
}

export interface CommunityUserReportRow {
  id: string;
  reporter: CommunityUserReportUserSummary;
  targetUser: CommunityUserReportUserSummary;
  conversationId: string;
  conversationLabel: string;
  messageId?: string | null;
  latestMessageExcerpt: string;
  category: CommunityUserReportCategory;
  description: string;
  status: CommunityUserReportStatus;
  reviewedAt?: string | null;
  reviewedBy?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityUserReportsResponse {
  summary: {
    total: number;
    pending: number;
    inReview: number;
    resolved: number;
    dismissed: number;
  };
  reports: CommunityUserReportRow[];
}
