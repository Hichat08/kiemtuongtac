import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COMMUNITY_REPORT_CATEGORY_OPTIONS } from "@/lib/community-reports";
import { useUserFinancialData } from "@/hooks/useUserFinancialData";
import { getRoleHomePath } from "@/lib/role-routing";
import { cn, formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type {
  CommunityGift,
  CommunityGiftClaim,
  Conversation,
  Message,
  Participant,
} from "@/types/chat";
import type { CommunityUserReportCategory } from "@/types/community-report";
import {
  ArrowLeft,
  BadgeCheck,
  Frown,
  Gift,
  ImageIcon,
  MessageCircleMore,
  PartyPopper,
  Quote,
  SendHorizontal,
  Sparkles,
  TriangleAlert,
  Users2,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const COMMUNITY_SYSTEM_KEY = "global-community";
const COMMUNITY_NAME_MATCHER = /community|comm|cộng đồng|toàn user|toan user/i;
const GIFT_TITLE_MAX_LENGTH = 60;
const GIFT_MESSAGE_MAX_LENGTH = 50;
const COMMUNITY_GIFT_OPEN_OPTIONS = [5, 10] as const;
const MAX_GIFT_OPEN_COUNT = 999;
const MAX_GIFT_AMOUNT_DIGITS = 9;
const DEFAULT_GIFT_TITLE = "Lì xì may mắn!";
const DEFAULT_GIFT_MESSAGE = "Chúc anh em làm nhiệm vụ vui vẻ!";
const DEFAULT_REPORT_CATEGORY: CommunityUserReportCategory = "spam";

interface CommunityGiftPack {
  amount: number;
  label: string;
  caption: string;
  Icon: LucideIcon;
  featured?: boolean;
}

type ActiveGiftDialog =
  | {
      type: "opened";
      gift: CommunityGift;
      claim: CommunityGiftClaim;
    }
  | {
      type: "sold-out";
      gift: CommunityGift;
    }
  | null;

type CommunityReportDialogState = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  messageId?: string;
  excerpt?: string;
  isOnline: boolean;
} | null;

const COMMUNITY_GIFT_PACKS: CommunityGiftPack[] = [
  { amount: 10_000, label: "Gói Khởi Đầu", caption: "Khởi động vui vẻ", Icon: Gift },
  {
    amount: 20_000,
    label: "Phổ Biến Nhất",
    caption: "Tặng nhanh trong nhóm",
    Icon: Gift,
    featured: true,
  },
  { amount: 50_000, label: "Gói Chia Sẻ", caption: "Lan tỏa động lực", Icon: Sparkles },
  { amount: 100_000, label: "Gói Thịnh Vượng", caption: "Niềm vui tài chính", Icon: PartyPopper },
];

const formatOnlineCount = (count: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.max(0, count));

const formatBubbleClock = (value: string) =>
  new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatVnd = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
const formatGiftDialogAmount = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const getParticipantInitial = (name?: string | null) =>
  (name?.trim().charAt(0) ?? "C").toUpperCase();

const getReportableMessageExcerpt = (message: Message) => {
  if (message.communityGift) {
    return (
      message.communityGift.note?.trim() ||
      message.communityGift.title?.trim() ||
      "Đã gửi một gói quà cộng đồng."
    );
  }

  return message.content?.trim() || "Tin nhắn không có nội dung.";
};

const isStaffParticipant = (participant?: Participant | null) =>
  /admin|support|staff/i.test(participant?.displayName ?? "");

const getConversationTimestamp = (conversation: Conversation) =>
  new Date(
    conversation.lastMessageAt ??
      conversation.lastMessage?.createdAt ??
      conversation.updatedAt ??
      conversation.createdAt
  ).getTime();

const getConversationTitle = (conversation: Conversation, userId?: string) => {
  if (conversation.type === "group") {
    return conversation.group?.name?.trim() || "Cộng đồng";
  }

  const otherUser = conversation.participants.find((item) => item._id !== userId);
  return otherUser?.displayName?.trim() || "Tin nhắn riêng";
};

const isCommunityConversation = (conversation: Conversation) =>
  conversation.systemKey === COMMUNITY_SYSTEM_KEY ||
  (conversation.type === "group" &&
    COMMUNITY_NAME_MATCHER.test(getConversationTitle(conversation)));

function CommunityPresenceAvatar({
  name,
  avatarUrl,
  isOnline,
  className,
  onClick,
}: {
  name: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const avatarNode = (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className="size-10 rounded-[1.1rem] bg-white shadow-[0_16px_34px_-26px_rgba(15,23,42,0.45)]">
        <AvatarImage
          src={avatarUrl ?? undefined}
          alt={name}
          className="object-cover"
        />
        <AvatarFallback className="bg-[#f3edff] font-auth-headline text-sm font-bold text-[#7b19d8]">
          {getParticipantInitial(name)}
        </AvatarFallback>
      </Avatar>
      {isOnline ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#16a46f] ring-2 ring-[#f8f5ff]">
          <span className="size-1.5 rounded-full bg-white" />
        </span>
      ) : null}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-[1.2rem] transition-transform duration-200 active:scale-95"
        aria-label={`Tùy chọn cho ${name}`}
      >
        {avatarNode}
      </button>
    );
  }

  return (
    avatarNode
  );
}

function CommunityGiftBubble({
  gift,
  isOwn,
  currentUserId,
  onOpen,
}: {
  gift: CommunityGift;
  isOwn: boolean;
  currentUserId?: string;
  onOpen: () => void;
}) {
  const claimants = gift.claims ?? [];
  const openedCount = claimants.length;
  const exhausted = gift.status === "exhausted" || openedCount >= gift.recipientLimit;
  const claimedByCurrentUser = claimants.some(
    (claimant) => claimant.userId === currentUserId
  );
  const ownGift = isOwn || gift.senderId === currentUserId;
  const giftTitle = gift.title?.trim() || DEFAULT_GIFT_TITLE;
  const visibleClaimants = claimants.slice(0, 4);
  const extraClaimants = Math.max(claimants.length - visibleClaimants.length, 0);

  return (
    <div className={cn("w-full max-w-[18.5rem]", isOwn ? "ml-auto" : "")}>
      <button
        type="button"
        onClick={onOpen}
        disabled={ownGift}
        className="w-full text-left transition-transform duration-200 active:scale-[0.985]"
      >
        <div className="overflow-hidden rounded-[2rem] rounded-br-[0.8rem] bg-[radial-gradient(circle_at_top,#ff7868_0%,#d82828_48%,#a81818_100%)] shadow-[0_28px_52px_-28px_rgba(127,0,0,0.55)]">
          <div className="relative px-5 pb-4 pt-5 text-center">
            <div className="absolute -left-8 -top-10 size-24 rounded-full bg-white/8 blur-2xl" />
            <div className="absolute bottom-8 right-4 size-10 rounded-full bg-white/8 blur-xl" />

            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[linear-gradient(145deg,#ffd54f_0%,#ffbe0b_100%)] shadow-[inset_0_2px_8px_rgba(255,255,255,0.45)]">
              <Gift className="size-8 text-white" />
            </div>

            <h3 className="mt-4 px-2 font-auth-headline text-[1.65rem] font-extrabold tracking-[-0.04em] text-white">
              {giftTitle}
            </h3>
            <p className="mt-2 px-2 text-sm italic leading-6 text-[#ffe2c1]">
              "{gift.note || DEFAULT_GIFT_MESSAGE}"
            </p>

            <div className="mt-4 inline-flex items-center justify-center rounded-full bg-white/14 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
              Tổng quà {formatVnd(gift.totalAmount)}
            </div>

            <div
              className={cn(
                "mt-5 rounded-[1.2rem] px-4 py-3 text-center font-auth-headline text-sm font-extrabold uppercase tracking-[0.18em]",
                exhausted
                  ? "bg-white/18 text-white"
                  : ownGift
                    ? "bg-white/16 text-white"
                  : claimedByCurrentUser
                    ? "bg-[#ffe8a3] text-[#8b3000]"
                    : "bg-[#ffd43b] text-[#8b3000]"
              )}
            >
              {exhausted
                ? "Đã hết quà"
                : ownGift
                  ? "Chờ người nhận"
                : claimedByCurrentUser
                  ? "Đã nhận"
                  : "Mở ngay"}
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#a51919] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f7c2c2]">
            <span>Ví cộng đồng</span>
            <WalletCards className="size-3.5" />
          </div>
        </div>
      </button>

      <div
        className={cn(
          "mt-2 flex items-center gap-2 text-[11px] text-[#7d8b97]",
          isOwn ? "justify-end" : "justify-start"
        )}
      >
        <BadgeCheck className="size-3.5 text-[#7b19d8]" />
        <span className="font-medium italic">
          {openedCount > 0
            ? `Đã có ${openedCount}/${gift.recipientLimit} người nhận quà`
            : `Chờ ${gift.recipientLimit} người mở quà`}
        </span>
      </div>

      {claimants.length > 0 ? (
        <div
          className={cn(
            "mt-2 flex items-center gap-2",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          <div className="flex -space-x-2">
            {visibleClaimants.map((claimant) => (
              <Avatar
                key={`${gift._id}_${claimant.userId}`}
                className="size-7 border-2 border-[#f8f5ff] bg-white"
              >
                <AvatarImage
                  src={claimant.avatarUrl ?? undefined}
                  alt={claimant.displayName}
                  className="object-cover"
                />
                <AvatarFallback className="bg-[#f3edff] text-[10px] font-bold text-[#7b19d8]">
                  {getParticipantInitial(claimant.displayName)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>

          {extraClaimants > 0 ? (
            <span className="rounded-full bg-[#f3edff] px-2.5 py-1 text-[10px] font-bold text-[#7b19d8]">
              +{extraClaimants}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CommunityGiftOpenedDialog({
  state,
  onClose,
}: {
  state: Extract<ActiveGiftDialog, { type: "opened" }>;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Đóng hộp quà"
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-[#24313d]/48 backdrop-blur-md"
      />

      <div className="mobile-overlay-shell fixed inset-x-0 top-1/2 z-[80] -translate-y-1/2">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_70px_-28px_rgba(123,25,216,0.28)]">
          <div className="relative flex items-center justify-center overflow-hidden px-6 pt-8">
            <div className="absolute left-10 top-7 size-3 rotate-12 rounded-sm bg-[#f3edff]" />
            <div className="absolute right-16 top-14 size-3 rotate-45 rounded-sm bg-[#c7cfff]" />
            <div className="absolute bottom-7 left-1/4 size-2 rounded-full bg-[#ff84d1]" />
            <div className="absolute bottom-10 right-1/4 size-2.5 rounded-full bg-[#84a7ff]" />

            <div className="relative flex size-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#7b19d8]/12 blur-2xl" />
              <div className="relative flex size-20 items-center justify-center rounded-[1.8rem] bg-gradient-primary shadow-[0_20px_44px_-20px_rgba(123,25,216,0.45)]">
                <Gift className="size-10 text-white" />
              </div>
            </div>
          </div>

          <div className="px-7 pb-7 pt-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7d8b97]">
              Chúc mừng! Bạn đã nhận được
            </p>
            <p className="mt-3 font-auth-headline text-xl font-bold text-[#2d2f32]">
              {state.gift.title?.trim() || DEFAULT_GIFT_TITLE}
            </p>
            <h3 className="mt-2 font-auth-headline text-[clamp(2.8rem,12vw,3.4rem)] font-black tracking-[-0.07em] text-[#7b19d8]">
              {formatGiftDialogAmount(state.claim.amount)}
              <span className="ml-1 text-[1.9rem] font-extrabold">đ</span>
            </h3>

            <div className="relative mt-5 rounded-[1.4rem] bg-[#faf7ff] px-5 py-5 text-[#2d2f32]">
              <Quote className="absolute left-4 top-4 size-5 text-[#7b19d8]" />
              <p className="px-4 text-xl font-medium italic leading-8">
                "{state.gift.note || DEFAULT_GIFT_MESSAGE}"
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-14 w-full items-center justify-center rounded-full bg-gradient-primary font-auth-headline text-lg font-extrabold text-white shadow-[0_18px_36px_-18px_rgba(123,25,216,0.35)] transition-transform duration-200 active:scale-[0.985]"
              >
                Xem chi tiết
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-14 w-full items-center justify-center rounded-full bg-[#eceaf2] font-auth-headline text-lg font-bold text-[#5a4e73] transition-transform duration-200 active:scale-[0.985]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CommunityGiftSoldOutDialog({
  state,
  onClose,
}: {
  state: Extract<ActiveGiftDialog, { type: "sold-out" }>;
  onClose: () => void;
}) {
  const visibleClaimants = state.gift.claims.slice(0, 4);
  const extraClaimants = Math.max(state.gift.claims.length - visibleClaimants.length, 0);

  return (
    <>
      <button
        type="button"
        aria-label="Đóng trạng thái quà"
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-[#24313d]/44 backdrop-blur-md"
      />

      <div className="mobile-overlay-shell fixed inset-x-0 top-1/2 z-[80] -translate-y-1/2">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#fcfbff] shadow-[0_28px_70px_-28px_rgba(123,25,216,0.2)]">
          <div className="px-7 pb-8 pt-7 text-center">
            <button
              type="button"
              onClick={onClose}
              className="absolute left-10 top-9 flex size-9 items-center justify-center rounded-full bg-white/82 text-[#7b19d8] shadow-[0_14px_28px_-20px_rgba(123,25,216,0.22)]"
              aria-label="Đóng"
            >
              <X className="size-4.5" />
            </button>

            <p className="font-auth-headline text-lg font-bold text-[#2d2f32]">
              {state.gift.title?.trim() || DEFAULT_GIFT_TITLE}
            </p>

            <div className="relative mx-auto mt-7 flex h-48 w-48 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#f3edff] blur-3xl" />
              <div className="relative flex size-40 items-center justify-center rounded-[2rem] bg-white shadow-[0_18px_40px_-28px_rgba(123,25,216,0.16)]">
                <Gift className="size-16 text-[#b1b5bf]" />
                <div className="absolute -right-3 -top-3 flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8] shadow-[0_16px_28px_-22px_rgba(123,25,216,0.2)]">
                  <Frown className="size-7" />
                </div>
              </div>
            </div>

            <h3 className="mobile-fluid-title mt-6 font-auth-headline font-extrabold tracking-[-0.05em] text-[#2d2f32]">
              Tiếc quá, hết quà rồi!
            </h3>
            <p className="mx-auto mt-4 max-w-[18rem] text-base leading-7 text-[#6f7886]">
              Món quà này đã được những người bạn may mắn khác nhận hết mất rồi.
              Hãy nhanh tay hơn ở lần sau nhé!
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#f3edff] px-4 py-2">
              <Users2 className="size-4 text-[#7b19d8]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7886]">
                Đã có {state.gift.claims.length}/{state.gift.recipientLimit} người nhận quà
              </span>
            </div>

            <div className="mt-7 grid grid-cols-5 gap-2 rounded-[1.5rem] bg-[#f5f1fb]/90 p-2">
              {visibleClaimants.map((claimant) => (
                <div
                  key={`${state.gift._id}_${claimant.userId}`}
                  className="aspect-square overflow-hidden rounded-[1rem] bg-white"
                >
                  <Avatar className="size-full rounded-[1rem] opacity-60 grayscale">
                    <AvatarImage
                      src={claimant.avatarUrl ?? undefined}
                      alt={claimant.displayName}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-[#f3edff] text-sm font-bold text-[#7b19d8]">
                      {getParticipantInitial(claimant.displayName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ))}

              {extraClaimants > 0 ? (
                <div className="flex aspect-square items-center justify-center rounded-[1rem] bg-[#eceaf2] text-xs font-bold text-[#7b19d8]">
                  +{extraClaimants}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-8 flex h-14 w-full items-center justify-center rounded-full bg-[#eceaf2] font-auth-headline text-lg font-bold text-[#5a4e73] transition-transform duration-200 active:scale-[0.985]"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function CommunityMessageCard({
  message,
  previousMessage,
  conversation,
  userId,
  currentUserName,
  currentUserAvatar,
  onlineUsers,
  onOpenGift,
  onReportUser,
}: {
  message: Message;
  previousMessage?: Message;
  conversation: Conversation;
  userId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onlineUsers: string[];
  onOpenGift?: (gift: CommunityGift) => void;
  onReportUser?: (target: NonNullable<CommunityReportDialogState>) => void;
}) {
  const gift = message.communityGift ?? null;
  const isOwn = message.isOwn ?? message.senderId === userId;
  const participant = conversation.participants.find(
    (item) => item._id.toString() === message.senderId.toString()
  );
  const resolvedSender = message.sender;
  const displayName = isOwn
    ? currentUserName || "Bạn"
    : resolvedSender?.displayName || participant?.displayName || "Thành viên";
  const avatarUrl = isOwn
    ? currentUserAvatar
    : resolvedSender?.avatarUrl ?? participant?.avatarUrl;
  const isStaff =
    !isOwn &&
    (/admin|support|staff/i.test(resolvedSender?.displayName ?? "") ||
      isStaffParticipant(participant));
  const showIdentity =
    !previousMessage ||
    previousMessage.senderId !== message.senderId ||
    new Date(message.createdAt).getTime() -
      new Date(previousMessage.createdAt).getTime() >
      300000;

  return (
    <div className="space-y-2">
      {showIdentity ? (
        <div
          className={cn(
            "flex items-center gap-2 text-[11px]",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          {!isOwn ? (
            <span className="font-auth-headline text-sm font-bold text-[#2d1459]">
              {displayName}
            </span>
          ) : null}
          <span className="text-[#9a91aa]">{formatBubbleClock(message.createdAt)}</span>
          {isOwn ? (
            <span className="font-auth-headline text-sm font-bold text-[#2d1459]">
              {displayName}
            </span>
          ) : null}
          {isStaff ? (
            <span className="rounded-full bg-[#f3edff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7b19d8]">
              Staff
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-end gap-3",
          isOwn ? "justify-end" : "justify-start"
        )}
      >
        {!isOwn ? (
          showIdentity ? (
            <CommunityPresenceAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              isOnline={onlineUsers.includes(message.senderId)}
              onClick={() =>
                onReportUser?.({
                  userId: message.senderId,
                  displayName,
                  avatarUrl,
                  messageId: message._id,
                  excerpt: getReportableMessageExcerpt(message),
                  isOnline: onlineUsers.includes(message.senderId),
                })
              }
            />
          ) : (
            <div className="w-10 shrink-0" />
          )
        ) : null}

        <div className={cn("max-w-[78%] space-y-2", isOwn ? "items-end" : "items-start")}>
          {gift ? (
            <CommunityGiftBubble
              gift={gift}
              isOwn={isOwn}
              currentUserId={userId}
              onOpen={() => onOpenGift?.(gift)}
            />
          ) : message.content ? (
            <div
              className={cn(
                "rounded-[1.35rem] px-4 py-3 text-[15px] leading-7 shadow-[0_22px_48px_-34px_rgba(15,23,42,0.4)]",
                isOwn
                  ? "rounded-br-[0.7rem] bg-gradient-primary text-white"
                  : isStaff
                    ? "rounded-tl-[0.7rem] bg-[#f3edff] text-[#5f3ca8]"
                    : "rounded-tl-[0.7rem] bg-white text-[#2f2441]"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          ) : null}

          {message.imgUrl ? (
            <div
              className={cn(
                "overflow-hidden rounded-[1.4rem] bg-white shadow-[0_22px_48px_-32px_rgba(15,23,42,0.38)]",
                isOwn ? "ml-auto" : ""
              )}
            >
              <img
                src={message.imgUrl}
                alt="Hình ảnh trong cuộc trò chuyện"
                className="h-44 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {isOwn ? (
          showIdentity ? (
            <CommunityPresenceAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              isOnline
            />
          ) : (
            <div className="w-10 shrink-0" />
          )
        ) : null}
      </div>
    </div>
  );
}

function CommunityUserReportDialog({
  open,
  target,
  category,
  description,
  submitting,
  onOpenChange,
  onChangeCategory,
  onChangeDescription,
  onSubmit,
}: {
  open: boolean;
  target: CommunityReportDialogState;
  category: CommunityUserReportCategory;
  description: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeCategory: (category: CommunityUserReportCategory) => void;
  onChangeDescription: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="flex max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[22rem] flex-col gap-0 overflow-hidden rounded-[1.1rem] border-none bg-white p-0 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.35)] sm:max-h-[min(90dvh,42rem)] sm:max-w-[25rem]">
        <div className="shrink-0 border-b border-[#f1ebf8] px-4 py-4 sm:px-5 sm:py-5">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-[1.05rem] bg-[#fff1ec] text-[#d4525d] sm:size-11 sm:rounded-2xl">
                <TriangleAlert className="size-4.5 sm:size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-auth-headline text-lg font-extrabold tracking-[-0.04em] text-[#2d2f32] sm:text-xl">
                  Tố cáo người dùng
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] leading-5 text-[#6f7283] sm:text-sm sm:leading-6">
                  Báo cho admin biết nếu thành viên này có dấu hiệu spam, lừa đảo hoặc vi phạm cộng đồng.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
          {target ? (
            <div className="rounded-[1rem] bg-[#faf7ff] p-3 sm:rounded-[1.15rem] sm:p-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="scale-90 sm:scale-100">
                  <CommunityPresenceAvatar
                    name={target.displayName}
                    avatarUrl={target.avatarUrl}
                    isOnline={target.isOnline}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#2d2f32]">
                    {target.displayName}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-[#7a8190]">
                    {target.isOnline ? "Đang online trong cộng đồng" : "Đã offline"}
                  </p>
                </div>
              </div>

              {target.excerpt ? (
                <p className="mt-2.5 text-[12px] leading-5 text-[#5e6574] sm:mt-3">
                  Ngữ cảnh gần nhất: "{target.excerpt}"
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7b19d8]">
              Lý do tố cáo
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3">
              {COMMUNITY_REPORT_CATEGORY_OPTIONS.map((option) => {
                const active = option.value === category;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChangeCategory(option.value)}
                    className={cn(
                      "rounded-[0.95rem] border px-2.5 py-2.5 text-left transition-colors sm:rounded-[1rem] sm:px-3 sm:py-3",
                      active
                        ? "border-[#d8c2ff] bg-[#f6efff]"
                        : "border-[#efe7f8] bg-white hover:border-[#e5d7ff] hover:bg-[#faf7ff]"
                    )}
                  >
                    <p className="text-[13px] font-bold text-[#2d2f32] sm:text-sm">
                      {option.label}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-[#7a8190] sm:text-[11px] sm:leading-5">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7b19d8]">
              Mô tả thêm
            </p>
            <Textarea
              value={description}
              onChange={(event) => onChangeDescription(event.target.value.slice(0, 500))}
              placeholder="Ví dụ: user gửi link lạ, dụ chuyển tiền, spam nhiều lần..."
              className="mt-2.5 min-h-24 rounded-[1rem] border-[#efe7f8] bg-[#fcfbff] px-3 py-2.5 text-sm leading-5 text-[#2d2f32] focus-visible:ring-[#7b19d8]/20 sm:mt-3 sm:min-h-28 sm:leading-6"
            />
            <p className="mt-2 text-right text-[11px] text-[#8f96a4]">
              {description.length}/500
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#f1ebf8] bg-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#f0edf5] text-sm font-bold text-[#5b506f] transition-colors hover:bg-[#ebe5f3] sm:h-12"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-white shadow-[0_18px_36px_-18px_rgba(123,25,216,0.35)] disabled:opacity-60 sm:h-12"
            >
              {submitting ? "Đang gửi..." : "Gửi tố cáo"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommunityGiftSheet({
  open,
  currentBalance,
  walletLabel,
  giftTitle,
  selectedAmount,
  amountDraft,
  giftMessage,
  recipientCount,
  recipientCountDraft,
  customRecipientCount,
  submitting,
  onClose,
  onChangeTitle,
  onSelectAmount,
  onChangeAmountDraft,
  onNormalizeAmount,
  onChangeMessage,
  onSelectRecipientCount,
  onEnableCustomRecipientCount,
  onChangeRecipientCountDraft,
  onNormalizeRecipientCount,
  onSubmit,
}: {
  open: boolean;
  currentBalance: number;
  walletLabel: string;
  giftTitle: string;
  selectedAmount: number;
  amountDraft: string;
  giftMessage: string;
  recipientCount: number;
  recipientCountDraft: string;
  customRecipientCount: boolean;
  submitting: boolean;
  onClose: () => void;
  onChangeTitle: (title: string) => void;
  onSelectAmount: (amount: number) => void;
  onChangeAmountDraft: (value: string) => void;
  onNormalizeAmount: () => void;
  onChangeMessage: (message: string) => void;
  onSelectRecipientCount: (count: number) => void;
  onEnableCustomRecipientCount: () => void;
  onChangeRecipientCountDraft: (value: string) => void;
  onNormalizeRecipientCount: () => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return null;
  }

  const balanceEnough = currentBalance >= selectedAmount;
  const validSplitAmount = selectedAmount >= recipientCount;

  return (
    <>
      <button
        type="button"
        aria-label="Đóng tặng quà"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[#2d2f32]/30 backdrop-blur-sm"
      />

      <div className="mobile-sheet-shell fixed inset-x-0 bottom-0 z-[60] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[2rem] bg-[#f8f5ff] shadow-[0_-20px_48px_rgba(123,25,216,0.16)]">
        <div className="flex justify-center py-3">
          <div className="h-1.5 w-12 rounded-full bg-[#d9cbed]" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="sticky top-0 z-10 flex items-start justify-between bg-[#f8f5ff] pb-4 pt-1">
            <div>
              <h2 className="font-auth-headline text-[1.9rem] font-extrabold tracking-[-0.04em] text-[#2d1459]">
                Tặng quà Cộng đồng
              </h2>
              <p className="mt-1 text-sm text-[#8d84a1]">
                Gửi gắm niềm vui tài chính đến bạn bè
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/82 text-[#7b19d8] shadow-[0_14px_28px_-22px_rgba(123,25,216,0.18)] transition-transform duration-200 active:scale-95"
              aria-label="Đóng"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="space-y-7">
            <section>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a95a3]">
                Lựa chọn gói quà
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3.5">
                {COMMUNITY_GIFT_PACKS.map((giftPack) => {
                  const selected = giftPack.amount === selectedAmount;

                  return (
                    <button
                      key={giftPack.amount}
                      type="button"
                      onClick={() => onSelectAmount(giftPack.amount)}
                      className={cn(
                        "relative overflow-hidden rounded-[1.4rem] bg-white px-4 py-4 text-left shadow-[0_14px_28px_-22px_rgba(15,23,42,0.2)] ring-1 transition-transform duration-200 active:scale-[0.985]",
                        selected
                          ? "ring-2 ring-[#7b19d8] shadow-[0_18px_34px_-18px_rgba(123,25,216,0.24)]"
                          : "ring-[#f1ebfa]"
                      )}
                    >
                      <giftPack.Icon className="mb-3 size-5 text-[#7b19d8]" />
                      <giftPack.Icon className="absolute -right-2 -top-2 size-14 text-[#7b19d8]/12" />
                      <p className="font-auth-headline text-[1.45rem] font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                        {formatVnd(giftPack.amount)}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs font-semibold",
                          selected && giftPack.featured ? "text-[#7b19d8]" : "text-[#7d8b97]"
                        )}
                      >
                        {giftPack.label}
                      </p>
                      {!selected ? (
                        <p className="mt-0.5 text-[11px] text-[#a0a8b3]">{giftPack.caption}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[1.25rem] bg-white px-4 py-3 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.2)]">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-[#f3edff] text-[#7b19d8]">
                    <WalletCards className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#2d2f32]">Nhập số tiền muốn tặng</p>
                    <p className="mt-0.5 text-[11px] text-[#7d8b97]">
                      Bạn có thể nhập số tiền riêng thay cho gói có sẵn.
                    </p>
                  </div>

                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={amountDraft}
                    onChange={(event) => onChangeAmountDraft(event.target.value)}
                    onBlur={onNormalizeAmount}
                    placeholder="20000"
                    className="h-11 w-32 rounded-full border-0 bg-[#f3edff] px-3 text-center text-sm font-bold text-[#2d2f32] shadow-none focus-visible:ring-2 focus-visible:ring-[#7b19d8]/25"
                  />
                </div>
              </div>
            </section>

            <section>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a95a3]">
                Tiêu đề gói quà
              </p>
              <div className="mt-4">
                <Input
                  value={giftTitle}
                  onChange={(event) =>
                    onChangeTitle(event.target.value.slice(0, GIFT_TITLE_MAX_LENGTH))
                  }
                  placeholder={DEFAULT_GIFT_TITLE}
                  className="h-12 rounded-[1.1rem] border-0 bg-[#f3edff] px-4 text-sm font-semibold text-[#2d2f32] shadow-none focus-visible:ring-2 focus-visible:ring-[#7b19d8]/25"
                />
              </div>
            </section>

            <section>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a95a3]">
                Lời nhắn gửi
              </p>
              <div className="relative mt-4">
                <Textarea
                  value={giftMessage}
                  onChange={(event) =>
                    onChangeMessage(event.target.value.slice(0, GIFT_MESSAGE_MAX_LENGTH))
                  }
                  placeholder="Chúc anh em làm nhiệm vụ vui vẻ!"
                  className="min-h-[96px] resize-none rounded-[1.1rem] border-0 bg-[#f3edff] px-4 py-3 text-sm leading-6 text-[#2d2f32] shadow-none focus-visible:ring-2 focus-visible:ring-[#7b19d8]/25"
                />
                <span className="absolute bottom-3 right-4 text-[10px] font-bold uppercase tracking-[0.08em] text-[#a0a8b3]">
                  MAX {GIFT_MESSAGE_MAX_LENGTH}
                </span>
              </div>
            </section>

            <section>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a95a3]">
                Số lượng người có thể mở
              </p>

              <div className="mt-4 rounded-[1.4rem] bg-[#f3edff] p-1">
                <div className="grid grid-cols-3 gap-1.5">
                  {COMMUNITY_GIFT_OPEN_OPTIONS.map((count) => {
                    const selected = !customRecipientCount && recipientCount === count;

                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onSelectRecipientCount(count)}
                        className={cn(
                          "rounded-full px-3 py-2.5 text-center text-sm font-semibold transition-transform duration-200 active:scale-[0.985]",
                          selected ? "bg-gradient-primary text-white shadow-[0_14px_28px_-18px_rgba(123,25,216,0.24)]" : "text-[#6f7886]"
                        )}
                      >
                        {count} người
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={onEnableCustomRecipientCount}
                    className={cn(
                      "rounded-full px-3 py-2.5 text-center text-sm font-semibold transition-transform duration-200 active:scale-[0.985]",
                      customRecipientCount ? "bg-gradient-primary text-white shadow-[0_14px_28px_-18px_rgba(123,25,216,0.24)]" : "text-[#6f7886]"
                    )}
                  >
                    Tùy chỉnh
                  </button>
                </div>
              </div>

              {customRecipientCount ? (
                <div className="mt-3 rounded-[1.25rem] bg-white px-4 py-3 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.2)]">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-[#f3edff] text-[#7b19d8]">
                      <Users2 className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#2d2f32]">Nhập số người mở quà</p>
                      <p className="mt-0.5 text-[11px] text-[#7d8b97]">
                        Tối đa {MAX_GIFT_OPEN_COUNT} người cho một lượt gửi.
                      </p>
                    </div>

                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={recipientCountDraft}
                      onChange={(event) => onChangeRecipientCountDraft(event.target.value)}
                      onBlur={onNormalizeRecipientCount}
                      placeholder="5"
                      className="h-11 w-24 rounded-full border-0 bg-[#f3edff] px-3 text-center text-sm font-bold text-[#2d2f32] shadow-none focus-visible:ring-2 focus-visible:ring-[#7b19d8]/25"
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-xs text-[#7d8b97]">
                  <Users2 className="size-4 text-[#7b19d8]" />
                  {recipientCount} người đầu tiên có thể mở gói quà này.
                </p>
              )}
            </section>

            {!balanceEnough ? (
              <div className="rounded-[1.2rem] bg-[#fff1f0] px-4 py-3 text-sm text-[#b31b25]">
                Số dư ví hiện tại chưa đủ cho gói quà này.
              </div>
            ) : null}

            {!validSplitAmount ? (
              <div className="rounded-[1.2rem] bg-[#fff7ea] px-4 py-3 text-sm text-[#c97a12]">
                Tổng số tiền phải lớn hơn hoặc bằng số người nhận.
              </div>
            ) : null}
          </div>
        </div>

        <section className="border-t border-[#e6e9ee] px-5 py-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a95a3]">
                Tổng thanh toán
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6f7886]">
                <WalletCards className="size-3.5" />
                {walletLabel}
              </p>
            </div>

            <p className="mobile-fluid-title font-auth-headline font-black tracking-[-0.05em] text-[#7b19d8]">
              {formatVnd(selectedAmount)}
            </p>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!balanceEnough || !validSplitAmount || submitting}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-gradient-primary font-auth-headline text-lg font-extrabold text-white shadow-[0_16px_32px_-16px_rgba(123,25,216,0.45)] transition-transform duration-200 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SendHorizontal className="size-5 fill-current" />
            {submitting ? "Đang gửi quà..." : "Gửi quà ngay"}
          </button>

          <p className="mt-3 text-center text-[10px] leading-4 text-[#a0a8b3]">
            Bằng cách gửi quà, bạn đồng ý với Điều khoản cộng đồng của Kiếm Tương Tác.
          </p>
        </section>
      </div>
    </>
  );
}

const ChatAppPage = () => {
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();
  const { currentBalance, refresh: refreshFinancialData } = useUserFinancialData(
    user?.accountId
  );
  const {
    conversations,
    messages,
    activeConversationId,
    convoLoading,
    messageLoading,
    setActiveConversation,
    fetchConversations,
    fetchMessages,
    sendGroupMessage,
    markAsSeen,
    updateMessage,
  } = useChatStore();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [selectedGiftAmount, setSelectedGiftAmount] = useState(20_000);
  const [giftAmountDraft, setGiftAmountDraft] = useState("20000");
  const [giftTitle, setGiftTitle] = useState(DEFAULT_GIFT_TITLE);
  const [giftMessage, setGiftMessage] = useState(DEFAULT_GIFT_MESSAGE);
  const [giftRecipientCount, setGiftRecipientCount] = useState(5);
  const [giftRecipientCountDraft, setGiftRecipientCountDraft] = useState("5");
  const [customGiftRecipientCount, setCustomGiftRecipientCount] = useState(false);
  const [activeGiftDialog, setActiveGiftDialog] = useState<ActiveGiftDialog>(null);
  const [reportDialogState, setReportDialogState] =
    useState<CommunityReportDialogState>(null);
  const [reportCategory, setReportCategory] =
    useState<CommunityUserReportCategory>(DEFAULT_REPORT_CATEGORY);
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const orderedCommunityConversations = useMemo(
    () =>
      [...conversations]
        .filter((conversation) => isCommunityConversation(conversation))
        .sort((left, right) => getConversationTimestamp(right) - getConversationTimestamp(left)),
    [conversations]
  );

  const communityConversation = orderedCommunityConversations[0] ?? null;

  useEffect(() => {
    if (!communityConversation || initializedRef.current) {
      return;
    }

    setActiveConversation(communityConversation._id);
    initializedRef.current = true;
  }, [communityConversation, setActiveConversation]);

  const selectedConversation = useMemo(
    () =>
      orderedCommunityConversations.find(
        (conversation) => conversation._id === activeConversationId
      ) ?? communityConversation,
    [activeConversationId, communityConversation, orderedCommunityConversations]
  );

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    const activeMessageState = messages[selectedConversation._id];
    if (activeMessageState?.items?.length) {
      return;
    }

    void fetchMessages(selectedConversation._id);
  }, [fetchMessages, messages, selectedConversation]);

  const orderedMessages = useMemo(() => {
    if (!selectedConversation) {
      return [];
    }

    return [...(messages[selectedConversation._id]?.items ?? [])].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  }, [messages, selectedConversation]);

  const hasMore = selectedConversation
    ? (messages[selectedConversation._id]?.hasMore ?? false)
    : false;

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    void markAsSeen();
  }, [markAsSeen, orderedMessages.length, selectedConversation]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: orderedMessages.length > 0 ? "smooth" : "auto",
      });
    });
  }, [orderedMessages.length, selectedConversation?._id]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const onlineCount = onlineUsers.length;
  const isCommunityChatLocked =
    user?.role !== "admin" && user?.communityChatStatus === "locked";
  const homePath = getRoleHomePath(user?.role);
  const walletLabel = useMemo(() => {
    const accountCode = `${user?.accountId ?? ""}`.trim();

    if (!accountCode) {
      return "Ví chính";
    }

    return `Ví chính (***${accountCode.slice(-3)})`;
  }, [user?.accountId]);
  const focusComposer = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!isCommunityChatLocked) {
      return;
    }

    setGiftSheetOpen(false);
    setActiveGiftDialog(null);
    setReportDialogState(null);
  }, [isCommunityChatLocked]);

  const handleSendMessage = async () => {
    if (isCommunityChatLocked) {
      toast.error(
        user?.communityChatModerationNote ||
          "Bạn đang bị khóa chat cộng đồng. Vui lòng liên hệ admin nếu cần hỗ trợ."
      );
      return;
    }

    if (!selectedConversation || !user || !draft.trim() || sending) {
      focusComposer();
      return;
    }

    const content = draft.trim();
    setDraft("");
    setSending(true);

    try {
      await sendGroupMessage(selectedConversation._id, content);
    } catch (error) {
      console.error("Không gửi được tin nhắn trong community chat", error);
      setDraft(content);
      toast.error("Không gửi được tin nhắn. Bạn thử lại giúp mình.");
    } finally {
      setSending(false);
      focusComposer();
    }
  };

  const handleImageFeatureClick = () => {
    if (isCommunityChatLocked) {
      toast.error(
        user?.communityChatModerationNote ||
          "Bạn đang bị khóa chat cộng đồng. Vui lòng liên hệ admin nếu cần hỗ trợ."
      );
      return;
    }

    toast.info("Bản /chat mới đang giữ luồng gửi chữ. Gửi ảnh sẽ nối tiếp ở bước sau.");
  };

  const handleGiftFeatureClick = () => {
    if (isCommunityChatLocked) {
      toast.error(
        user?.communityChatModerationNote ||
          "Bạn đang bị khóa chat cộng đồng. Vui lòng liên hệ admin nếu cần hỗ trợ."
      );
      return;
    }

    if (!selectedConversation) {
      toast.info("Phòng cộng đồng đang được chuẩn bị. Bạn thử lại sau vài giây nhé.");
      return;
    }

    setGiftSheetOpen(true);
  };

  const handleSelectGiftAmount = (amount: number) => {
    setSelectedGiftAmount(amount);
    setGiftAmountDraft(String(amount));
  };

  const handleChangeGiftAmountDraft = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, MAX_GIFT_AMOUNT_DIGITS);

    setGiftAmountDraft(digitsOnly);

    if (!digitsOnly) {
      return;
    }

    const parsedAmount = Number.parseInt(digitsOnly, 10);

    if (!Number.isNaN(parsedAmount)) {
      setSelectedGiftAmount(Math.max(parsedAmount, 1));
    }
  };

  const handleNormalizeGiftAmount = () => {
    if (!giftAmountDraft.trim()) {
      setGiftAmountDraft(String(selectedGiftAmount));
      return;
    }

    const normalizedAmount = Math.max(
      Number.parseInt(giftAmountDraft, 10) || selectedGiftAmount,
      1
    );

    setSelectedGiftAmount(normalizedAmount);
    setGiftAmountDraft(String(normalizedAmount));
  };

  const handleSelectGiftRecipientCount = (count: number) => {
    setGiftRecipientCount(count);
    setGiftRecipientCountDraft(String(count));
    setCustomGiftRecipientCount(false);
  };

  const handleEnableCustomGiftRecipientCount = () => {
    setCustomGiftRecipientCount(true);
    if (!giftRecipientCountDraft.trim()) {
      setGiftRecipientCountDraft(String(giftRecipientCount));
    }
  };

  const handleChangeGiftRecipientCountDraft = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 3);

    setGiftRecipientCountDraft(digitsOnly);

    if (!digitsOnly) {
      return;
    }

    const parsedCount = Number.parseInt(digitsOnly, 10);
    if (!Number.isNaN(parsedCount)) {
      setGiftRecipientCount(Math.min(Math.max(parsedCount, 1), MAX_GIFT_OPEN_COUNT));
    }
  };

  const handleNormalizeGiftRecipientCount = () => {
    if (!giftRecipientCountDraft.trim()) {
      setGiftRecipientCountDraft(String(giftRecipientCount));
      return;
    }

    const normalizedCount = Math.min(
      Math.max(Number.parseInt(giftRecipientCountDraft, 10) || giftRecipientCount, 1),
      MAX_GIFT_OPEN_COUNT
    );

    setGiftRecipientCount(normalizedCount);
    setGiftRecipientCountDraft(String(normalizedCount));
  };

  const handleOpenGift = async (gift: CommunityGift) => {
    if (isCommunityChatLocked) {
      toast.error(
        user?.communityChatModerationNote ||
          "Bạn đang bị khóa chat cộng đồng. Vui lòng liên hệ admin nếu cần hỗ trợ."
      );
      return;
    }

    if (!user?._id) {
      toast.error("Bạn cần đăng nhập lại để mở quà.");
      return;
    }

    if (gift.senderId === user._id) {
      toast.error("Bạn không thể tự mở món quà mình vừa gửi.");
      return;
    }

    try {
      const result = await chatService.openCommunityGift(gift._id);

      await refreshFinancialData();

      if (result.gift && selectedConversation) {
        updateMessage(selectedConversation._id, gift.messageId, (message) => ({
          ...message,
          communityGift: result.gift,
          communityGiftId: result.gift?._id ?? null,
        }));
      }

      if ((result.status === "claimed" || result.status === "already_claimed") && result.gift && result.claim) {
        setActiveGiftDialog({
          type: "opened",
          gift: result.gift,
          claim: result.claim,
        });
        return;
      }

      if (result.status === "sold_out" && result.gift) {
        setActiveGiftDialog({
          type: "sold-out",
          gift: result.gift,
        });
      }
    } catch (error) {
      console.error("Không mở được quà cộng đồng", error);

      const errorMessage =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Không thể mở quà lúc này. Bạn thử lại giúp mình.";

      toast.error(errorMessage);
    }
  };

  const handleOpenReportDialog = (target: NonNullable<CommunityReportDialogState>) => {
    if (isCommunityChatLocked) {
      toast.error(
        user?.communityChatModerationNote ||
          "Bạn đang bị khóa chat cộng đồng. Vui lòng liên hệ admin nếu cần hỗ trợ."
      );
      return;
    }

    if (!selectedConversation) {
      toast.info("Phòng cộng đồng đang được chuẩn bị. Bạn thử lại sau vài giây nhé.");
      return;
    }

    setReportDialogState(target);
    setReportCategory(DEFAULT_REPORT_CATEGORY);
    setReportDescription("");
  };

  const handleReportDialogChange = (open: boolean) => {
    if (open) {
      return;
    }

    if (reportSubmitting) {
      return;
    }

    setReportDialogState(null);
    setReportCategory(DEFAULT_REPORT_CATEGORY);
    setReportDescription("");
  };

  const handleSubmitUserReport = async () => {
    if (!selectedConversation || !reportDialogState || reportSubmitting) {
      return;
    }

    if (reportCategory === "other" && !reportDescription.trim()) {
      toast.error("Bạn thêm mô tả cụ thể giúp mình để admin xử lý chính xác hơn.");
      return;
    }

    setReportSubmitting(true);

    try {
      const response = await chatService.submitCommunityUserReport({
        targetUserId: reportDialogState.userId,
        conversationId: selectedConversation._id,
        messageId: reportDialogState.messageId,
        category: reportCategory,
        description: reportDescription.trim(),
      });

      toast.success(response.message || "Đã gửi tố cáo tới admin.");
      setReportDialogState(null);
      setReportCategory(DEFAULT_REPORT_CATEGORY);
      setReportDescription("");
    } catch (error) {
      console.error("Không gửi được tố cáo user cộng đồng", error);

      const errorMessage =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Không gửi được tố cáo lúc này. Bạn thử lại giúp mình.";

      toast.error(errorMessage);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSubmitGift = async () => {
    if (isCommunityChatLocked) {
      toast.error(
        user?.communityChatModerationNote ||
          "Bạn đang bị khóa chat cộng đồng. Vui lòng liên hệ admin nếu cần hỗ trợ."
      );
      return;
    }

    if (!selectedConversation || !user || giftSubmitting) {
      return;
    }

    if (selectedGiftAmount <= 0) {
      toast.error("Bạn cần nhập số tiền hợp lệ để gửi quà.");
      return;
    }

    if (selectedGiftAmount < giftRecipientCount) {
      toast.error("Tổng số tiền phải lớn hơn hoặc bằng số người nhận.");
      return;
    }

    if (currentBalance < selectedGiftAmount) {
      toast.error("Số dư ví hiện tại không đủ để gửi gói quà này.");
      return;
    }

    setGiftSubmitting(true);

    try {
      await sendGroupMessage(selectedConversation._id, "", undefined, {
        amount: selectedGiftAmount,
        recipientCount: giftRecipientCount,
        title: giftTitle.trim() || DEFAULT_GIFT_TITLE,
        message: giftMessage.trim() || DEFAULT_GIFT_MESSAGE,
      });

      setGiftSheetOpen(false);
      setGiftTitle(DEFAULT_GIFT_TITLE);
      handleSelectGiftAmount(20_000);
      setGiftMessage(DEFAULT_GIFT_MESSAGE);
      handleSelectGiftRecipientCount(5);
      await refreshFinancialData();
      toast.success("Đã gửi quà vào phòng cộng đồng.");
    } catch (error) {
      console.error("Không gửi được quà vào community chat", error);
      const errorMessage =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "Không gửi được quà. Bạn thử lại giúp mình.";

      toast.error(errorMessage);
    } finally {
      setGiftSubmitting(false);
      focusComposer();
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f8f5ff] text-[#2d2f32]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 size-72 rounded-full bg-[#f3edff] blur-3xl" />
        <div className="absolute -right-24 top-40 size-64 rounded-full bg-[#e6ecff] blur-3xl" />
        <div className="absolute bottom-24 left-1/3 size-56 rounded-full bg-[#ffd3f2]/50 blur-3xl" />
      </div>

      <div className="mobile-frame relative flex h-full flex-col overflow-hidden">
        <header className="sticky top-0 z-30 px-4 pt-4">
          <div className="flex items-center justify-between rounded-[1.6rem] bg-[#f8f5ff]/78 px-4 py-3 backdrop-blur-2xl">
            <div className="flex items-center gap-2.5">
              <Link
                to={homePath}
                className="flex size-10 items-center justify-center rounded-full bg-white/76 text-[#7b19d8] shadow-[0_16px_32px_-24px_rgba(123,25,216,0.24)] transition-transform duration-200 active:scale-95"
                aria-label="Về trang chủ"
              >
                <ArrowLeft className="size-5" />
              </Link>

              <div className="flex size-10 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                <Users2 className="size-5" />
              </div>
              <div>
                <p className="font-auth-headline text-lg font-extrabold tracking-tight text-[#2d1459]">
                  Cộng đồng
                </p>
                <p className="text-[11px] text-[#8d84a1]">Kiếm Tương Tác</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-[#f3edff] px-3 py-1.5 text-[#7b19d8] shadow-[0_18px_34px_-28px_rgba(123,25,216,0.22)]">
              <span className="size-2 rounded-full bg-[#16a46f]" />
              <span className="text-[11px] font-semibold">
                {onlineCount > 0
                  ? `${formatOnlineCount(onlineCount)} Online`
                  : "Đang đồng bộ"}
              </span>
            </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col px-4 pb-[7.5rem] pt-5">
          <section className="flex min-h-0 flex-1 flex-col">
            {convoLoading && !orderedCommunityConversations.length ? (
              <div className="space-y-4">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      index % 2 === 0 ? "justify-start" : "justify-end"
                    )}
                  >
                    <div className="h-24 w-[72%] animate-pulse rounded-[1.6rem] bg-white/70" />
                  </div>
                ))}
              </div>
            ) : isCommunityChatLocked ? (
              <div className="rounded-[1.8rem] bg-white px-5 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)]">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#fff1ec] text-[#d4525d]">
                  <TriangleAlert className="size-7" />
                </div>
                <p className="mt-4 font-auth-headline text-xl font-bold text-[#2d1459]">
                  Chat cộng đồng đang bị khóa
                </p>
                <p className="mt-2 text-sm leading-6 text-[#8d84a1]">
                  {user?.communityChatModerationNote ||
                    "Admin đã tạm khóa quyền chat cộng đồng của bạn. Nếu cần hỗ trợ, bạn có thể liên hệ qua phòng hỗ trợ."}
                </p>
              </div>
            ) : !selectedConversation ? (
              <div className="rounded-[1.8rem] bg-white px-5 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)]">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                  <MessageCircleMore className="size-7" />
                </div>
                <p className="mt-4 font-auth-headline text-xl font-bold text-[#2d1459]">
                  Đang chuẩn bị phòng cộng đồng
                </p>
                <p className="mt-2 text-sm leading-6 text-[#8d84a1]">
                  Vào lại sau vài giây hoặc làm mới trang nếu phòng `Cộng đồng` chưa hiện.
                </p>
              </div>
            ) : (
              <div
                ref={scrollContainerRef}
                className="min-h-0 flex-1 overflow-y-auto pr-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <div className="space-y-5 pb-2">
                {hasMore ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => void fetchMessages(selectedConversation._id)}
                      className="rounded-full bg-[#f3edff] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b19d8]"
                    >
                      Tải thêm tin cũ
                    </button>
                  </div>
                ) : null}

                {orderedMessages.length > 0 ? (
                  orderedMessages.map((message, index) => {
                    const previousMessage = index > 0 ? orderedMessages[index - 1] : undefined;
                    const showDivider =
                      !previousMessage ||
                      new Date(message.createdAt).getTime() -
                        new Date(previousMessage.createdAt).getTime() >
                        1800000;

                    return (
                      <div key={message._id}>
                        {showDivider ? (
                          <div className="mb-4 mt-2 flex justify-center">
                            <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a91aa]">
                              {formatMessageTime(new Date(message.createdAt))}
                            </span>
                          </div>
                        ) : null}

                        <CommunityMessageCard
                          message={message}
                          previousMessage={previousMessage}
                          conversation={selectedConversation}
                          userId={user?._id}
                          currentUserName={user?.displayName}
                          currentUserAvatar={user?.avatarUrl}
                          onlineUsers={onlineUsers}
                          onOpenGift={handleOpenGift}
                          onReportUser={handleOpenReportDialog}
                        />
                      </div>
                    );
                  })
                ) : messageLoading ? (
                  <div className="rounded-[1.8rem] bg-white px-5 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)]">
                    <p className="font-auth-headline text-lg font-bold text-[#2d1459]">
                      Đang tải cuộc trò chuyện...
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[1.8rem] bg-white px-5 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)]">
                    <p className="font-auth-headline text-lg font-bold text-[#2d1459]">
                      Chưa có tin nhắn nào
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#8d84a1]">
                      Bạn có thể bắt đầu cuộc trò chuyện bằng cách gửi lời nhắn đầu tiên.
                    </p>
                  </div>
                )}
                </div>
              </div>
            )}
          </section>
        </main>

        <div className="mobile-floating-shell fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
          <div className="rounded-[2rem] bg-[#f8f5ff]/84 p-2 shadow-[0_22px_48px_-28px_rgba(123,25,216,0.2)] backdrop-blur-2xl">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full bg-[#f3edff] text-[#7b19d8] shadow-[0_16px_32px_-24px_rgba(123,25,216,0.24)] hover:bg-white"
                onClick={handleGiftFeatureClick}
                disabled={isCommunityChatLocked}
              >
                <Gift className="size-4.5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full bg-[#f3edff] text-[#7b19d8] shadow-[0_16px_32px_-24px_rgba(123,25,216,0.24)] hover:bg-white"
                onClick={handleImageFeatureClick}
                disabled={isCommunityChatLocked}
              >
                <ImageIcon className="size-4.5" />
              </Button>

              <div className="flex-1 rounded-full bg-white px-4 py-2.5 shadow-[0_18px_34px_-28px_rgba(123,25,216,0.16)]">
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder={
                    isCommunityChatLocked
                      ? "Chat cộng đồng đang bị khóa"
                      : "Nhập tin nhắn..."
                  }
                  disabled={!selectedConversation || sending || isCommunityChatLocked}
                  className="h-auto border-0 bg-transparent p-0 text-sm text-[#2d2f32] shadow-none focus-visible:ring-0"
                />
              </div>

              <Button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  focusComposer();
                }}
                onClick={() => void handleSendMessage()}
                disabled={
                  !selectedConversation || !draft.trim() || sending || isCommunityChatLocked
                }
                className="size-11 rounded-full border-0 bg-gradient-primary text-white shadow-[0_22px_42px_-22px_rgba(123,25,216,0.42)] hover:opacity-95"
              >
                <SendHorizontal className="size-4.5" />
              </Button>
            </div>
          </div>
        </div>

        <CommunityUserReportDialog
          open={Boolean(reportDialogState)}
          target={reportDialogState}
          category={reportCategory}
          description={reportDescription}
          submitting={reportSubmitting}
          onOpenChange={handleReportDialogChange}
          onChangeCategory={setReportCategory}
          onChangeDescription={setReportDescription}
          onSubmit={handleSubmitUserReport}
        />

        <CommunityGiftSheet
          open={giftSheetOpen}
          currentBalance={currentBalance}
          walletLabel={walletLabel}
          giftTitle={giftTitle}
          selectedAmount={selectedGiftAmount}
          amountDraft={giftAmountDraft}
          giftMessage={giftMessage}
          recipientCount={giftRecipientCount}
          recipientCountDraft={giftRecipientCountDraft}
          customRecipientCount={customGiftRecipientCount}
          submitting={giftSubmitting}
          onClose={() => setGiftSheetOpen(false)}
          onChangeTitle={setGiftTitle}
          onSelectAmount={handleSelectGiftAmount}
          onChangeAmountDraft={handleChangeGiftAmountDraft}
          onNormalizeAmount={handleNormalizeGiftAmount}
          onChangeMessage={setGiftMessage}
          onSelectRecipientCount={handleSelectGiftRecipientCount}
          onEnableCustomRecipientCount={handleEnableCustomGiftRecipientCount}
          onChangeRecipientCountDraft={handleChangeGiftRecipientCountDraft}
          onNormalizeRecipientCount={handleNormalizeGiftRecipientCount}
          onSubmit={handleSubmitGift}
        />

        {activeGiftDialog?.type === "opened" ? (
          <CommunityGiftOpenedDialog
            state={activeGiftDialog}
            onClose={() => setActiveGiftDialog(null)}
          />
        ) : null}

        {activeGiftDialog?.type === "sold-out" ? (
          <CommunityGiftSoldOutDialog
            state={activeGiftDialog}
            onClose={() => setActiveGiftDialog(null)}
          />
        ) : null}
      </div>
    </div>
  );
};

export default ChatAppPage;
