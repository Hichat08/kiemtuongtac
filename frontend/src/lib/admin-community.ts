import type { Conversation, Message } from "@/types/chat";

export const COMMUNITY_SYSTEM_KEY = "global-community";
export const COMMUNITY_NAME_MATCHER = /community|comm|cộng đồng|toàn user|toan user/i;
export const DEFAULT_COMMUNITY_GIFT_MESSAGE = "Chúc anh em làm nhiệm vụ vui vẻ!";
export const COMMUNITY_GIFT_MESSAGE_MAX_LENGTH = 50;
export const COMMUNITY_GIFT_RECIPIENT_MAX = 999;
export const ADMIN_COMMUNITY_GIFT_DRAFT_KEY = "admin-community-gift-draft";

export const COMMUNITY_GIFT_TRACKING_OPTIONS = [
  { value: "24h", label: "24 Giờ" },
  { value: "48h", label: "48 Giờ" },
  { value: "7d", label: "7 Ngày" },
  { value: "manual", label: "Theo dõi thủ công" },
] as const;

export type CommunityGiftTrackingOption =
  (typeof COMMUNITY_GIFT_TRACKING_OPTIONS)[number]["value"];

export const COMMUNITY_GIFT_PRESET_AMOUNTS = [10_000, 20_000, 50_000, 100_000] as const;

const suspiciousPattern =
  /https?:\/\/|bit\.ly|t\.me|telegram|zalo|spam|miễn phí|free|nhận ngay|click/i;

const parseDate = (value?: string | null) => {
  const parsed = new Date(value ?? "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(Number(value) || 0)));

export const formatCurrency = (value: number) => `${formatNumber(value)}đ`;

export const formatCompactDateTime = (value?: string | null) => {
  const parsed = parseDate(value);

  if (!parsed) {
    return "Chưa có dữ liệu";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(parsed);
};

export const formatRelativeTime = (value?: string | null) => {
  const parsed = parseDate(value);

  if (!parsed) {
    return "Vừa xong";
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) {
    return "Vừa xong";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays} ngày trước`;
};

export const getParticipantInitial = (value?: string | null) =>
  (value?.trim().charAt(0) ?? "C").toUpperCase();

const getConversationTitle = (conversation: Conversation) =>
  conversation.type === "group"
    ? conversation.group?.name?.trim() || "Cộng đồng"
    : conversation.participants[0]?.displayName?.trim() || "Tin nhắn";

export const getConversationTimestamp = (conversation: Conversation) =>
  new Date(
    conversation.lastMessageAt ??
      conversation.lastMessage?.createdAt ??
      conversation.updatedAt ??
      conversation.createdAt
  ).getTime();

export const isCommunityConversation = (conversation: Conversation) =>
  conversation.systemKey === COMMUNITY_SYSTEM_KEY ||
  (conversation.type === "group" &&
    COMMUNITY_NAME_MATCHER.test(getConversationTitle(conversation)));

export const isSuspiciousMessage = (message: Message) => {
  const joinedText = `${message.content ?? ""} ${message.communityGift?.note ?? ""}`.trim();
  return suspiciousPattern.test(joinedText);
};

export const getMessageBody = (message: Message) => {
  if (message.type === "community_gift" && message.communityGift) {
    return message.communityGift.note?.trim() || DEFAULT_COMMUNITY_GIFT_MESSAGE;
  }

  return message.content?.trim() || "Không có nội dung.";
};

export const clampPositiveInteger = (
  value: number,
  fallback = 1,
  max = Number.POSITIVE_INFINITY
) => {
  const rounded = Math.round(Number(value));

  if (!Number.isFinite(rounded) || rounded <= 0) {
    return fallback;
  }

  return Math.min(rounded, max);
};
