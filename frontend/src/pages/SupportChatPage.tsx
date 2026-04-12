import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { AlertCircle, ArrowLeft, Headset, SendHorizontal, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const resolveErrorMessage = (error: unknown) => {
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

  return "Không thể kết nối phòng hỗ trợ lúc này.";
};

const SupportChatPage = () => {
  const navigate = useNavigate();
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
    addConvo,
    updateConversation,
  } = useChatStore();
  const [supportConversationId, setSupportConversationId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const initializedRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const bootstrapSupportConversation = async () => {
    try {
      setInitializing(true);
      setLoadError("");

      await fetchConversations();

      const conversation = await chatService.ensureSupportConversation();

      addConvo(conversation);
      updateConversation(conversation);
      setSupportConversationId(conversation._id);
      setActiveConversation(conversation._id);
      useSocketStore.getState().socket?.emit("join-conversation", conversation._id);
    } catch (error) {
      console.error("Không chuẩn bị được phòng hỗ trợ", error);
      setLoadError(resolveErrorMessage(error));
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void bootstrapSupportConversation();
  }, []);

  const selectedConversation = useMemo(
    () =>
      supportConversationId
        ? conversations.find((conversation) => conversation._id === supportConversationId) ?? null
        : null,
    [conversations, supportConversationId]
  );

  useEffect(() => {
    if (!selectedConversation || activeConversationId === selectedConversation._id) {
      return;
    }

    setActiveConversation(selectedConversation._id);
  }, [activeConversationId, selectedConversation, setActiveConversation]);

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

  const supportParticipants = useMemo(
    () =>
      (selectedConversation?.participants ?? []).filter(
        (participant) => participant._id !== user?._id
      ),
    [selectedConversation?.participants, user?._id]
  );

  const onlineSupportCount = supportParticipants.filter((participant) =>
    onlineUsers.includes(participant._id)
  ).length;

  const handleSendMessage = async () => {
    if (!selectedConversation || !draft.trim() || sending) {
      inputRef.current?.focus();
      return;
    }

    const content = draft.trim();
    setDraft("");
    setSending(true);

    try {
      await sendGroupMessage(selectedConversation._id, content);
    } catch (error) {
      console.error("Không gửi được tin nhắn hỗ trợ", error);
      setDraft(content);
      toast.error("Không gửi được tin nhắn hỗ trợ. Bạn thử lại giúp mình.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.18),_transparent_60%)]" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/92 backdrop-blur-xl dark:bg-[#12081d]/92">
        <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex size-10 items-center justify-center rounded-full bg-white text-[#7b19d8] shadow-[0_16px_34px_-24px_rgba(123,25,216,0.34)] transition-transform active:scale-95 dark:bg-white/8 dark:text-[#ff84d1]"
              aria-label="Quay lại"
            >
              <ArrowLeft className="size-4.5" />
            </button>

            <div>
              <p className="font-auth-headline text-[1.2rem] font-extrabold tracking-tight text-[#7b19d8] dark:text-[#ff84d1]">
                Chat hỗ trợ
              </p>
              <p className="text-xs font-semibold text-[#7b6993] dark:text-[#dcbaf8]">
                {onlineSupportCount > 0
                  ? `${onlineSupportCount} admin đang online`
                  : "Admin sẽ phản hồi trong phòng này"}
              </p>
            </div>
          </div>

          <div className="flex size-11 items-center justify-center rounded-[1.1rem] bg-gradient-primary text-white shadow-[0_18px_38px_-24px_rgba(123,25,216,0.42)]">
            <Headset className="size-5" />
          </div>
        </div>
      </header>

      <main className="mobile-page-shell flex min-h-screen flex-col pb-32 pt-4">
        <section className="relative overflow-hidden rounded-[1.6rem] bg-gradient-primary p-4 text-white shadow-[0_26px_58px_-32px_rgba(123,25,216,0.42)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/14 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-20 rounded-full bg-[#ffb3e5]/22 blur-2xl" />
          <div className="flex items-center gap-3">
            <div className="relative z-10 flex size-11 items-center justify-center rounded-[1rem] bg-white/14 text-white backdrop-blur-sm">
              <ShieldCheck className="size-5" />
            </div>
            <div className="relative z-10">
              <p className="font-auth-headline text-base font-bold text-white">
                Cần hỗ trợ gì?
              </p>
              <p className="text-sm leading-6 text-[#f6d9ff]">
                Mô tả vấn đề của bạn, admin sẽ phản hồi trong phòng chat riêng này.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 flex min-h-0 flex-1 flex-col">
          {initializing || (convoLoading && !selectedConversation) ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[1.8rem] bg-white/82 px-6 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)] dark:bg-white/6">
              <LoadingSpinner />
              <p className="mt-4 font-auth-headline text-lg font-bold text-[#1f2545] dark:text-white">
                Đang kết nối phòng hỗ trợ...
              </p>
            </div>
          ) : loadError ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[1.8rem] bg-white/82 px-6 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)] dark:bg-white/6">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#fff1f3] text-[#d94d68] dark:bg-[#ff5f7a]/12 dark:text-[#ff9eae]">
                <AlertCircle className="size-5" />
              </div>
              <p className="mt-4 font-auth-headline text-lg font-bold text-[#1f2545] dark:text-white">
                Không mở được chat hỗ trợ
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#72789a] dark:text-[#b7bce0]">
                {loadError}
              </p>
              <Button
                type="button"
                onClick={() => void bootstrapSupportConversation()}
                className="mt-5 rounded-full bg-gradient-primary px-5 text-white shadow-[0_20px_40px_-22px_rgba(123,25,216,0.42)] hover:opacity-95"
              >
                Thử lại
              </Button>
            </div>
          ) : !selectedConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[1.8rem] bg-white/82 px-6 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)] dark:bg-white/6">
              <p className="font-auth-headline text-lg font-bold text-[#1f2545] dark:text-white">
                Chưa tìm thấy phòng hỗ trợ
              </p>
              <p className="mt-2 text-sm leading-6 text-[#72789a] dark:text-[#b7bce0]">
                Bạn thử mở lại phòng chat hỗ trợ một lần nữa.
              </p>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2"
            >
              {orderedMessages.length > 0 ? (
                orderedMessages.map((message, index) => {
                  const previousMessage = index > 0 ? orderedMessages[index - 1] : undefined;
                  const showDivider =
                    !previousMessage ||
                    new Date(message.createdAt).getTime() -
                      new Date(previousMessage.createdAt).getTime() >
                      1800000;
                  const isOwn = message.isOwn ?? message.senderId === user?._id;
                  const showAdminLabel =
                    !isOwn &&
                    (!previousMessage || previousMessage.senderId !== message.senderId);

                  return (
                    <div key={message._id}>
                      {showDivider ? (
                        <div className="mb-3 mt-1 flex justify-center">
                          <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b19d8] dark:bg-white/8 dark:text-[#ff84d1]">
                            {formatMessageTime(new Date(message.createdAt))}
                          </span>
                        </div>
                      ) : null}

                      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[78%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
                        >
                          {!isOwn && showAdminLabel ? (
                            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b84b2] dark:text-[#b7bce0]">
                              Admin
                            </p>
                          ) : null}

                          <div
                            className={`rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.18)] ${
                              isOwn
                                ? "bg-gradient-primary text-white shadow-[0_18px_36px_-24px_rgba(123,25,216,0.42)]"
                                : "bg-white text-[#1f2545] dark:bg-white/8 dark:text-white"
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : messageLoading ? (
                <div className="flex h-full items-center justify-center rounded-[1.8rem] bg-white/82 px-6 py-10 shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)] dark:bg-white/6">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="rounded-[1.8rem] bg-white/82 px-6 py-10 text-center shadow-[0_24px_48px_-34px_rgba(123,25,216,0.18)] dark:bg-white/6">
                  <p className="font-auth-headline text-lg font-bold text-[#1f2545] dark:text-white">
                    Bắt đầu yêu cầu hỗ trợ mới
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#72789a] dark:text-[#b7bce0]">
                    Mô tả vấn đề của bạn. Nếu phiên trước đã được xử lý xong, admin sẽ trả lời lại từ đoạn chat trống này.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <div className="mobile-floating-shell fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
        <div className="rounded-[2rem] bg-[#f8f5ff]/88 p-2 shadow-[0_22px_48px_-28px_rgba(123,25,216,0.24)] backdrop-blur-2xl dark:bg-[#12081d]/88">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-full bg-white px-4 py-2.5 shadow-[0_18px_34px_-28px_rgba(123,25,216,0.18)] dark:bg-white/8">
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
                placeholder="Nhập nội dung cần hỗ trợ..."
                disabled={!selectedConversation || sending || initializing || Boolean(loadError)}
                className="h-auto border-0 bg-transparent p-0 text-sm text-[#1f2545] shadow-none focus-visible:ring-0 dark:text-white"
              />
            </div>

            <Button
              type="button"
              onClick={() => void handleSendMessage()}
              disabled={!selectedConversation || !draft.trim() || sending || initializing}
              className="size-11 rounded-full border-0 bg-gradient-primary text-white shadow-[0_22px_42px_-22px_rgba(123,25,216,0.42)] hover:opacity-95"
            >
              <SendHorizontal className="size-4.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportChatPage;
