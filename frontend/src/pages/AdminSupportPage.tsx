import AdminShell from "@/components/admin/AdminShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { Conversation } from "@/types/chat";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Headset,
  MessageCircleMore,
  RefreshCcw,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const SUPPORT_SYSTEM_KEY_PREFIX = "support-room:";
const supportCardClassName =
  "rounded-[1.7rem] bg-white p-5 shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)]";

const getInitials = (value?: string | null) =>
  value
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "HT";

const getConversationTimestamp = (conversation: Conversation) =>
  new Date(
    conversation.lastMessageAt ??
      conversation.lastMessage?.createdAt ??
      conversation.updatedAt ??
      conversation.createdAt
  ).getTime();

const getSupportUserId = (conversation: Conversation) => {
  const systemKey = `${conversation.systemKey ?? ""}`.trim();

  if (!systemKey.startsWith(SUPPORT_SYSTEM_KEY_PREFIX)) {
    return "";
  }

  return systemKey.slice(SUPPORT_SYSTEM_KEY_PREFIX.length);
};

const formatRelativeActivity = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "Vừa xong";
  }

  const deltaMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (deltaMinutes < 1) {
    return "Vừa xong";
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes} phút`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);

  if (deltaHours < 24) {
    return `${deltaHours} giờ`;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const resolveSupportErrorMessage = (error: unknown) => {
  if (
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
  ) {
    return error.response.data.message;
  }

  return "Không tải được danh sách hỗ trợ.";
};

export default function AdminSupportPage() {
  const { user } = useAuthStore();
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const {
    conversations,
    messages,
    activeConversationId,
    convoLoading,
    messageLoading,
    fetchConversations,
    fetchMessages,
    sendGroupMessage,
    setActiveConversation,
    markAsSeen,
    resetConversationState,
  } = useChatStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [sending, setSending] = useState(false);
  const [resettingConversationId, setResettingConversationId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{
    conversationId: string;
    customerName: string;
    supportUserId: string;
  } | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;

    const syncSupportRooms = async () => {
      try {
        setLoadingError("");
        await fetchConversations();
      } catch (error) {
        console.error("Không tải được room hỗ trợ cho admin", error);

        if (!active) {
          return;
        }

        setLoadingError(resolveSupportErrorMessage(error));
      }
    };

    void syncSupportRooms();

    return () => {
      active = false;
    };
  }, [fetchConversations]);

  const supportQueue = useMemo(
    () =>
      [...conversations]
        .filter(
          (conversation) =>
            `${conversation.systemKey ?? ""}`.startsWith(SUPPORT_SYSTEM_KEY_PREFIX) &&
            Boolean(conversation.lastMessage)
        )
        .map((conversation) => {
          const supportUserId = getSupportUserId(conversation);
          const customer =
            conversation.participants.find((participant) => participant._id === supportUserId) ??
            conversation.participants.find((participant) => participant._id !== user?._id) ??
            null;
          const unreadCount = Math.max(0, conversation.unreadCounts?.[user?._id ?? ""] ?? 0);
          const timestamp = getConversationTimestamp(conversation);

          return {
            conversation,
            supportUserId,
            customer,
            unreadCount,
            timestamp,
            preview: conversation.lastMessage?.content?.trim() || "Chưa có tin nhắn nào.",
            isOnline: supportUserId ? onlineUsers.includes(supportUserId) : false,
          };
        })
        .sort((left, right) => right.timestamp - left.timestamp),
    [conversations, onlineUsers, user?._id]
  );

  const filteredSupportQueue = useMemo(
    () =>
      supportQueue.filter((item) =>
        [item.customer?.displayName, item.supportUserId, item.preview]
          .join(" ")
          .toLowerCase()
          .includes(deferredSearchTerm)
      ),
    [deferredSearchTerm, supportQueue]
  );

  useEffect(() => {
    if (!supportQueue.length) {
      if (activeConversationId) {
        setActiveConversation(null);
      }
      return;
    }

    const hasSelectedSupportConversation = supportQueue.some(
      (item) => item.conversation._id === activeConversationId
    );

    if (!hasSelectedSupportConversation) {
      setActiveConversation(supportQueue[0].conversation._id);
    }
  }, [activeConversationId, setActiveConversation, supportQueue]);

  const selectedSupportItem = useMemo(
    () =>
      supportQueue.find((item) => item.conversation._id === activeConversationId) ??
      supportQueue[0] ??
      null,
    [activeConversationId, supportQueue]
  );

  useEffect(() => {
    setComposerValue("");
  }, [selectedSupportItem?.conversation._id]);

  useEffect(() => {
    if (!selectedSupportItem) {
      return;
    }

    const activeMessageState = messages[selectedSupportItem.conversation._id];
    if (activeMessageState?.items?.length) {
      return;
    }

    void fetchMessages(selectedSupportItem.conversation._id);
  }, [fetchMessages, messages, selectedSupportItem]);

  const orderedMessages = useMemo(() => {
    if (!selectedSupportItem) {
      return [];
    }

    return [...(messages[selectedSupportItem.conversation._id]?.items ?? [])].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  }, [messages, selectedSupportItem]);

  useEffect(() => {
    if (!selectedSupportItem) {
      return;
    }

    void markAsSeen();
  }, [markAsSeen, orderedMessages.length, selectedSupportItem]);

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
  }, [orderedMessages.length, selectedSupportItem?.conversation._id]);

  const stats = useMemo(() => {
    const totalUnreadMessages = supportQueue.reduce(
      (total, item) => total + item.unreadCount,
      0
    );
    const onlineCustomers = supportQueue.filter((item) => item.isOnline).length;
    const activeRooms = supportQueue.filter(
      (item) => item.timestamp >= Date.now() - 24 * 60 * 60 * 1000
    ).length;

    return [
      {
        label: "Phiên hỗ trợ",
        value: new Intl.NumberFormat("vi-VN").format(supportQueue.length),
        helper: `${filteredSupportQueue.length} phiên khớp bộ lọc hiện tại`,
        icon: Headset,
        iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      },
      {
        label: "Tin chưa đọc",
        value: new Intl.NumberFormat("vi-VN").format(totalUnreadMessages),
        helper: `${supportQueue.filter((item) => item.unreadCount > 0).length} phòng cần xem ngay`,
        icon: MessageCircleMore,
        iconClassName: "bg-[#f3edff] text-[#7b19d8]",
      },
      {
        label: "Khách online",
        value: new Intl.NumberFormat("vi-VN").format(onlineCustomers),
        helper: "Dựa trên socket đang kết nối",
        icon: Users,
        iconClassName: "bg-[#eefbf4] text-[#00a46f]",
      },
      {
        label: "Hoạt động 24h",
        value: new Intl.NumberFormat("vi-VN").format(activeRooms),
        helper: "Các phòng có cập nhật trong ngày",
        icon: Clock3,
        iconClassName: "bg-[#fff4ea] text-[#c97a12]",
      },
    ];
  }, [filteredSupportQueue.length, supportQueue]);

  const handleSendReply = async () => {
    const message = composerValue.trim();

    if (!selectedSupportItem || !message || sending) {
      composerRef.current?.focus();
      return;
    }

    setComposerValue("");
    setSending(true);

    try {
      await sendGroupMessage(selectedSupportItem.conversation._id, message);
      toast.success("Đã gửi phản hồi cho người dùng.");
    } catch (error) {
      console.error("Không gửi được phản hồi hỗ trợ", error);
      setComposerValue(message);
      toast.error("Không gửi được phản hồi. Bạn thử lại giúp mình.");
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  };

  const handleOpenResetDialog = () => {
    if (!selectedSupportItem || resettingConversationId) {
      return;
    }

    setResetTarget({
      conversationId: selectedSupportItem.conversation._id,
      customerName: selectedSupportItem.customer?.displayName ?? "người dùng này",
      supportUserId: selectedSupportItem.supportUserId || "Không rõ",
    });
  };

  const handleResetSupportRoom = async () => {
    const conversationId = resetTarget?.conversationId;

    if (!conversationId || resettingConversationId) {
      return;
    }

    setResettingConversationId(conversationId);

    try {
      const resetConversation = await chatService.resetSupportConversation(conversationId);
      resetConversationState(resetConversation);
      setResetTarget(null);
      toast.success("Đã làm mới phòng hỗ trợ. Lần sau người dùng sẽ bắt đầu từ đoạn chat trống.");
    } catch (error) {
      console.error("Không reset được phòng hỗ trợ", error);
      toast.error("Không thể làm mới phòng hỗ trợ. Bạn thử lại giúp mình.");
    } finally {
      setResettingConversationId(null);
    }
  };

  return (
    <AdminShell
      title="Quản lý hỗ trợ"
      subtitle="Nhận và phản hồi trực tiếp các phòng chat hỗ trợ riêng của người dùng."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm theo tên user, ID hoặc nội dung gần nhất..."
      showSidebarAction={false}
      action={
        <Button
          type="button"
          onClick={() => void fetchConversations()}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-[#5868ff] px-5 text-sm font-bold text-white hover:bg-[#4453d9]"
        >
          <RefreshCcw className="size-4" />
          Làm mới hỗ trợ
        </Button>
      }
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-[1.35rem] bg-white p-4 shadow-[0_20px_46px_-36px_rgba(45,47,50,0.14)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex size-10 items-center justify-center rounded-xl ${card.iconClassName}`}>
                  <Icon className="size-4.5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">
                  Live
                </span>
              </div>

              <div className="mt-4">
                <p className="text-[13px] font-semibold text-[#6f7685]">{card.label}</p>
                <p className="mt-1 font-auth-headline text-[1.55rem] font-extrabold tracking-[-0.05em] text-[#2d2f32]">
                  {card.value}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-[#7f8795]">{card.helper}</p>
              </div>
            </div>
          );
        })}
      </section>

      {loadingError ? (
        <section className={`${supportCardClassName} mt-5`}>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#fff1f3] text-[#d94d68]">
              <AlertCircle className="size-5" />
            </div>
            <h2 className="mt-5 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
              Không tải được phòng hỗ trợ
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f7685]">{loadingError}</p>
          </div>
        </section>
      ) : convoLoading && !supportQueue.length ? (
        <section className={`${supportCardClassName} mt-5`}>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LoadingSpinner />
            <h2 className="mt-5 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
              Đang đồng bộ hỗ trợ
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f7685]">
              Hệ thống đang tải danh sách phòng chat hỗ trợ của người dùng.
            </p>
          </div>
        </section>
      ) : !supportQueue.length ? (
        <section className={`${supportCardClassName} mt-5`}>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Headset className="size-12 text-[#9fa7b7]" />
            <h2 className="mt-5 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
              Chưa có phòng hỗ trợ nào
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f7685]">
              Khi người dùng bấm `Chat trực tuyến`, phòng hỗ trợ riêng sẽ xuất hiện ở đây thay vì chat cộng đồng.
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`${supportCardClassName} p-4`}>
            <div className="px-1">
              <h2 className="font-auth-headline text-lg font-bold text-[#2d2f32]">
                Hàng đợi hỗ trợ
              </h2>
              <p className="mt-1 text-xs font-medium text-[#8b92a1]">
                Các phòng chat riêng của người dùng với admin.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {filteredSupportQueue.length > 0 ? (
                filteredSupportQueue.map((item) => {
                  const isSelected =
                    item.conversation._id === selectedSupportItem?.conversation._id;

                  return (
                    <button
                      key={item.conversation._id}
                      type="button"
                      onClick={() => setActiveConversation(item.conversation._id)}
                      className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                        isSelected
                          ? "border-[#d9cbff] bg-[#f8f4ff] shadow-[0_20px_40px_-34px_rgba(123,25,216,0.28)]"
                          : "border-[#f1edf7] bg-[#fcfbff] hover:border-[#e2d8f6] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="size-11 rounded-[1rem] bg-[#eef1ff]">
                            <AvatarImage src={item.customer?.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-[#eef1ff] font-bold text-[#5868ff]">
                              {getInitials(item.customer?.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-1 -right-1 size-3 rounded-full ring-2 ring-white ${
                              item.isOnline ? "bg-[#16a46f]" : "bg-[#c7ccd6]"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-auth-headline text-base font-bold text-[#2d2f32]">
                                {item.customer?.displayName ?? "Người dùng"}
                              </p>
                              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f96a4]">
                                ID {item.supportUserId || "Không rõ"}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-[11px] font-semibold text-[#8f96a4]">
                                {formatRelativeActivity(item.timestamp)}
                              </p>
                              {item.unreadCount > 0 ? (
                                <span className="mt-1 inline-flex min-w-6 items-center justify-center rounded-full bg-[#ff5f7a] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#657084]">
                            {item.preview}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1.35rem] bg-[#fcfbff] px-4 py-8 text-center">
                  <p className="font-semibold text-[#2d2f32]">Không có kết quả phù hợp</p>
                  <p className="mt-1 text-sm leading-6 text-[#6f7685]">
                    Thử từ khóa khác để tìm phòng hỗ trợ.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <section className="overflow-hidden rounded-[1.7rem] bg-white shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)]">
            {selectedSupportItem ? (
              <>
                <div className="border-b border-[#f1edf7] px-6 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="size-12 rounded-[1rem] bg-[#eef1ff]">
                          <AvatarImage src={selectedSupportItem.customer?.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-[#eef1ff] font-bold text-[#5868ff]">
                            {getInitials(selectedSupportItem.customer?.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-1 -right-1 size-3 rounded-full ring-2 ring-white ${
                            selectedSupportItem.isOnline ? "bg-[#16a46f]" : "bg-[#c7ccd6]"
                          }`}
                        />
                      </div>

                      <div>
                        <h2 className="font-auth-headline text-xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                          {selectedSupportItem.customer?.displayName ?? "Người dùng"}
                        </h2>
                        <p className="mt-1 text-sm font-medium text-[#6f7685]">
                          ID {selectedSupportItem.supportUserId || "Không rõ"} •{" "}
                          {selectedSupportItem.isOnline ? "Đang online" : "Hiện offline"}
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full bg-[#f3edff] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7b19d8]">
                      <CheckCircle2 className="size-4" />
                      Phòng hỗ trợ riêng
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOpenResetDialog}
                      disabled={resettingConversationId === selectedSupportItem.conversation._id}
                      className="inline-flex h-11 items-center gap-2 rounded-full border-[#ffd8df] bg-[#fff5f7] px-4 text-sm font-bold text-[#d84d70] hover:bg-[#ffe9ee] hover:text-[#cb395f]"
                    >
                      <RotateCcw className="size-4" />
                      {resettingConversationId === selectedSupportItem.conversation._id
                        ? "Đang làm mới..."
                        : "Xử lý xong"}
                    </Button>
                  </div>
                </div>

                <div
                  ref={scrollContainerRef}
                  className="h-[540px] overflow-y-auto bg-[#fcfbff] px-6 py-5"
                >
                  {orderedMessages.length > 0 ? (
                    <div className="space-y-4">
                      {orderedMessages.map((message, index) => {
                        const previousMessage = index > 0 ? orderedMessages[index - 1] : undefined;
                        const sender =
                          selectedSupportItem.conversation.participants.find(
                            (participant) => participant._id === message.senderId
                          ) ?? null;
                        const isCustomerMessage =
                          message.senderId === selectedSupportItem.supportUserId;
                        const isAdminMessage = !isCustomerMessage;
                        const showDivider =
                          !previousMessage ||
                          new Date(message.createdAt).getTime() -
                            new Date(previousMessage.createdAt).getTime() >
                            30 * 60 * 1000;
                        const showCustomerAvatar =
                          isCustomerMessage &&
                          (!previousMessage || previousMessage.senderId !== message.senderId);
                        const showAdminLabel =
                          isAdminMessage &&
                          (!previousMessage || previousMessage.senderId !== message.senderId);

                        return (
                          <div key={message._id}>
                            {showDivider ? (
                              <div className="mb-3 mt-1 flex justify-center">
                                <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a91aa]">
                                  {formatMessageTime(new Date(message.createdAt))}
                                </span>
                              </div>
                            ) : null}

                            <div
                              className={`flex gap-3 ${isAdminMessage ? "justify-end" : "justify-start"}`}
                            >
                              {isCustomerMessage ? (
                                <div className="w-10 shrink-0">
                                  {showCustomerAvatar ? (
                                    <Avatar className="size-10 rounded-[1rem] bg-[#eef1ff]">
                                      <AvatarImage src={sender?.avatarUrl ?? undefined} />
                                      <AvatarFallback className="bg-[#eef1ff] font-bold text-[#5868ff]">
                                        {getInitials(sender?.displayName)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ) : null}
                                </div>
                              ) : null}

                              <div
                                className={`max-w-[78%] ${isAdminMessage ? "items-end" : "items-start"} flex flex-col`}
                              >
                                {isCustomerMessage && showCustomerAvatar ? (
                                  <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8f96a4]">
                                    {sender?.displayName ?? "Người dùng"}
                                  </p>
                                ) : null}
                                {isAdminMessage && showAdminLabel ? (
                                  <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8f96a4]">
                                    Admin
                                  </p>
                                ) : null}

                                <div
                                  className={`rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)] ${
                                    isAdminMessage
                                      ? "bg-[#5868ff] text-white"
                                      : "bg-white text-[#2d2f32]"
                                  }`}
                                >
                                  {message.content}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : messageLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageCircleMore className="size-12 text-[#a4adbd]" />
                      <h3 className="mt-4 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                        Chưa có tin nhắn nào
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-[#6f7685]">
                        Người dùng chưa gửi nội dung hoặc dữ liệu tin nhắn chưa đồng bộ xong.
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#f1edf7] bg-[#fcfbff] px-6 py-5">
                  <div className="rounded-[1.4rem] bg-white p-3 shadow-[0_16px_38px_-28px_rgba(45,47,50,0.14)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#f3eef8] px-2 pb-3">
                      <p className="text-xs font-semibold text-[#6f7685]">
                        Phản hồi trực tiếp cho {selectedSupportItem.customer?.displayName ?? "người dùng"}
                      </p>
                      <span className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-[11px] font-bold text-[#5868ff]">
                        ID {selectedSupportItem.supportUserId || "Không rõ"}
                      </span>
                    </div>

                    <div className="relative mt-3">
                      <textarea
                        ref={composerRef}
                        value={composerValue}
                        onChange={(event) => setComposerValue(event.target.value)}
                        rows={3}
                        placeholder="Nhập phản hồi cho người dùng..."
                        className="min-h-28 w-full resize-none rounded-[1.2rem] border-none bg-[#f7f9fc] px-4 py-3 pr-16 text-sm leading-6 text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/18"
                      />

                      <button
                        type="button"
                        onClick={() => void handleSendReply()}
                        disabled={!composerValue.trim() || sending}
                        className="absolute bottom-3 right-3 flex size-11 items-center justify-center rounded-2xl bg-[#5868ff] text-white shadow-[0_16px_28px_-18px_rgba(88,104,255,0.45)] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Gửi phản hồi"
                      >
                        <Send className="size-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center px-6 text-center">
                <Headset className="size-12 text-[#a4adbd]" />
                <h2 className="mt-5 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                  Chọn một phòng hỗ trợ
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f7685]">
                  Hàng đợi bên trái sẽ hiển thị các phòng mà người dùng đã mở từ nút `Chat trực tuyến`.
                </p>
              </div>
            )}
          </section>
        </section>
      )}
      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open && !resettingConversationId) {
            setResetTarget(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={!resettingConversationId}
          className="max-w-md border-none bg-white p-0 shadow-[0_32px_90px_-42px_rgba(123,25,216,0.32)]"
        >
          <DialogHeader className="gap-0 px-6 pb-4 pt-6 text-left">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#fff1f3] text-[#d84d70]">
                <RotateCcw className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-auth-headline text-[1.45rem] font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                  Xử lý xong phiên hỗ trợ?
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-6 text-[#6f7685]">
                  Toàn bộ đoạn chat của{" "}
                  <span className="font-semibold text-[#2d2f32]">
                    {resetTarget?.customerName ?? "người dùng"}
                  </span>{" "}
                  sẽ được làm mới. Lần sau họ nhắn vào, phòng hỗ trợ sẽ bắt đầu lại từ trống.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mx-6 rounded-[1.25rem] bg-[#fcf8ff] px-4 py-3 text-sm leading-6 text-[#6f7685]">
            ID nội bộ:{" "}
            <span className="font-semibold text-[#7b19d8]">
              {resetTarget?.supportUserId ?? "Không rõ"}
            </span>
          </div>

          <DialogFooter className="mt-6 flex-col gap-3 border-t border-[#f3eef8] px-6 py-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetTarget(null)}
              disabled={Boolean(resettingConversationId)}
              className="h-11 rounded-full border-[#e5def3] bg-white px-5 text-sm font-bold text-[#666d7d] hover:bg-[#f8f5ff] hover:text-[#2d2f32]"
            >
              Huỷ
            </Button>
            <Button
              type="button"
              onClick={() => void handleResetSupportRoom()}
              disabled={Boolean(resettingConversationId)}
              className="h-11 rounded-full bg-[#d84d70] px-5 text-sm font-bold text-white hover:bg-[#c63a5f]"
            >
              {resettingConversationId ? "Đang làm mới..." : "Xác nhận xử lý xong"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
