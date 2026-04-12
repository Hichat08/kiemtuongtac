import AdminShell from "@/components/admin/AdminShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatNumber,
  formatRelativeTime,
  getConversationTimestamp,
  getMessageBody,
  getParticipantInitial,
  isCommunityConversation,
  isSuspiciousMessage,
} from "@/lib/admin-community";
import {
  getCommunityReportCategoryMeta,
  getCommunityReportStatusMeta,
} from "@/lib/community-reports";
import { cn } from "@/lib/utils";
import { adminService } from "@/services/adminService";
import { chatService } from "@/services/chatService";
import { useSocketStore } from "@/stores/useSocketStore";
import type { Conversation, Message } from "@/types/chat";
import type {
  CommunityUserReportRow,
  CommunityUserReportStatus,
} from "@/types/community-report";
import axios from "axios";
import {
  ArrowRight,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users2,
  WalletCards,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const cardClassName =
  "rounded-[1.6rem] bg-white shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)]";
const REFRESH_INTERVAL_MS = 20_000;

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

const mergeMessages = (current: Message[], incoming: Message[]) => {
  const registry = new Map(current.map((message) => [message._id, message]));
  incoming.forEach((message) => registry.set(message._id, message));
  return [...registry.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
};

const getReportFilterText = (report: CommunityUserReportRow) =>
  [
    report.targetUser.displayName,
    report.targetUser.accountId,
    report.reporter.displayName,
    report.reporter.accountId,
    report.latestMessageExcerpt,
    report.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const getStatusUpdateSuccessMessage = (status: CommunityUserReportStatus) => {
  switch (status) {
    case "in_review":
      return "Đã chuyển tố cáo sang trạng thái đang xem.";
    case "resolved":
      return "Đã đánh dấu tố cáo là đã xử lý.";
    case "dismissed":
      return "Đã bỏ qua tố cáo này.";
    default:
      return "Đã cập nhật trạng thái tố cáo.";
  }
};

const buildCommunityChatActionNote = (
  report: CommunityUserReportRow,
  action: "lock" | "unlock"
) => {
  if (action === "unlock") {
    return "Mở lại chat cộng đồng từ khu admin tố cáo.";
  }

  const categoryLabel = getCommunityReportCategoryMeta(report.category).label;
  const detailText =
    report.description.trim() || report.latestMessageExcerpt.trim() || "Có tố cáo vi phạm cộng đồng.";

  return `Khóa chat cộng đồng do tố cáo ${categoryLabel.toLowerCase()}: ${detailText}`.slice(
    0,
    500
  );
};

export default function AdminCommunityPage() {
  const navigate = useNavigate();
  const { onlineUsers } = useSocketStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [communityConversation, setCommunityConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reports, setReports] = useState<CommunityUserReportRow[]>([]);
  const [reportActionKey, setReportActionKey] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  useEffect(() => {
    let active = true;

    const syncCommunitySnapshot = async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [conversationRes, reportRes] = await Promise.all([
          chatService.fetchConversations(),
          adminService.getCommunityReports(),
        ]);
        const targetConversation =
          [...conversationRes.conversations]
            .filter((conversation) => isCommunityConversation(conversation))
            .sort(
              (left, right) =>
                getConversationTimestamp(right) - getConversationTimestamp(left)
            )[0] ?? null;

        if (!active) {
          return;
        }

        setReports(reportRes.reports);

        if (!targetConversation) {
          setCommunityConversation(null);
          setMessages([]);
          return;
        }

        setCommunityConversation(targetConversation);

        const messageRes = await chatService.fetchMessages(targetConversation._id);

        if (!active) {
          return;
        }

        setMessages((current) => mergeMessages(current, messageRes.messages));
      } catch (error) {
        console.error("Không tải được dữ liệu cộng đồng", error);
        if (active && !silent) {
          toast.error(getErrorMessage(error, "Không tải được dữ liệu cộng đồng."));
        }
      } finally {
        if (active) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    };

    void syncCommunitySnapshot();
    const intervalId = window.setInterval(() => void syncCommunitySnapshot(true), REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const filteredMessages = useMemo(
    () =>
      messages.filter((message) => {
        if (!deferredSearchTerm) {
          return true;
        }

        const joinedText = [
          message.sender?.displayName,
          message.communityGift?.title,
          getMessageBody(message),
          message.communityGift?.senderDisplayName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return joinedText.includes(deferredSearchTerm);
      }),
    [deferredSearchTerm, messages]
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((report) =>
        deferredSearchTerm ? getReportFilterText(report).includes(deferredSearchTerm) : true
      ),
    [deferredSearchTerm, reports]
  );

  const visibleMessages = useMemo(() => filteredMessages.slice(0, 5), [filteredMessages]);
  const visibleReports = useMemo(() => filteredReports.slice(0, 4), [filteredReports]);
  const hiddenMessagesCount = Math.max(filteredMessages.length - visibleMessages.length, 0);
  const hiddenReportsCount = Math.max(filteredReports.length - visibleReports.length, 0);
  const suspiciousMessages = useMemo(
    () => messages.filter((message) => isSuspiciousMessage(message)),
    [messages]
  );
  const pendingReportsCount = useMemo(
    () => reports.filter((report) => report.status === "pending").length,
    [reports]
  );
  const inReviewReportsCount = useMemo(
    () => reports.filter((report) => report.status === "in_review").length,
    [reports]
  );
  const resolvedReportsCount = useMemo(
    () => reports.filter((report) => report.status === "resolved").length,
    [reports]
  );
  const onlineCommunityCount = (communityConversation?.participants ?? []).filter((participant) =>
    onlineUsers.includes(participant._id)
  ).length;

  const handleUpdateReportStatus = async (
    reportId: string,
    status: Extract<CommunityUserReportStatus, "in_review" | "resolved" | "dismissed">
  ) => {
    const actionKey = `${reportId}:${status}`;
    setReportActionKey(actionKey);

    try {
      const response = await adminService.updateCommunityReportStatus(reportId, { status });
      setReports((current) =>
        current.map((report) => (report.id === reportId ? response.report : report))
      );
      toast.success(getStatusUpdateSuccessMessage(status));
    } catch (error) {
      console.error("Không cập nhật được trạng thái tố cáo", error);
      toast.error(getErrorMessage(error, "Không cập nhật được trạng thái tố cáo."));
    } finally {
      setReportActionKey("");
    }
  };

  const handleUpdateCommunityChat = async (
    report: CommunityUserReportRow,
    action: "lock" | "unlock"
  ) => {
    const actionKey = `${report.id}:community-chat:${action}`;
    setReportActionKey(actionKey);

    try {
      const response = await adminService.updateUserCommunityChat(report.targetUser.id, {
        action,
        note: buildCommunityChatActionNote(report, action),
      });

      setReports((current) =>
        current.map((item) =>
          item.targetUser.id === report.targetUser.id
            ? {
                ...item,
                targetUser: {
                  ...item.targetUser,
                  communityChatStatus: response.user.communityChatStatus ?? "active",
                  communityChatLockedAt: response.user.communityChatLockedAt ?? null,
                },
              }
            : item
        )
      );

      toast.success(response.message);
    } catch (error) {
      console.error("Không cập nhật được quyền chat cộng đồng", error);
      toast.error(getErrorMessage(error, "Không cập nhật được quyền chat cộng đồng."));
    } finally {
      setReportActionKey("");
    }
  };

  const summaryCards = [
    {
      label: "Tin nhắn gần đây",
      value: formatNumber(messages.length),
      helper: "Tải từ phòng cộng đồng hiện tại",
      icon: MessageCircleMore,
      iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      badge: refreshing ? "Đang đồng bộ" : "Live",
      badgeClassName: refreshing ? "text-[#d4525d]" : "text-[#00a46f]",
    },
    {
      label: "Thành viên online",
      value: formatNumber(onlineCommunityCount),
      helper: `${formatNumber(
        communityConversation?.participants.length ?? 0
      )} thành viên trong phòng`,
      icon: Users2,
      iconClassName: "bg-[#f3edff] text-[#7b19d8]",
      badge: "Realtime",
      badgeClassName: "text-[#7b19d8]",
    },
    {
      label: "Tin nhắn cần rà soát",
      value: formatNumber(suspiciousMessages.length),
      helper: "Đánh dấu theo từ khóa liên kết hoặc spam",
      icon: TriangleAlert,
      iconClassName: "bg-[#fff3f1] text-[#d4525d]",
      badge: suspiciousMessages.length > 0 ? "Ưu tiên" : "Ổn định",
      badgeClassName:
        suspiciousMessages.length > 0 ? "text-[#d4525d]" : "text-[#00a46f]",
    },
    {
      label: "Tố cáo đang chờ",
      value: formatNumber(pendingReportsCount),
      helper: `${formatNumber(inReviewReportsCount)} tố cáo đang được admin xem`,
      icon: ShieldCheck,
      iconClassName: "bg-[#eefbf4] text-[#00a46f]",
      badge: reports.length > 0 ? "Report" : "Sạch",
      badgeClassName: reports.length > 0 ? "text-[#00a46f]" : "text-[#7b19d8]",
    },
  ] as const;

  return (
    <AdminShell
      title="Quản lý tố cáo"
      subtitle="Theo dõi phòng cộng đồng, tiếp nhận tố cáo user và xử lý vi phạm ngay trong admin."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm tố cáo, user hoặc nội dung chat..."
      showSidebarAction={false}
    >
      {loading ? (
        <div className="rounded-[1.5rem] bg-white px-6 py-12 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.16)]">
          Đang tải dữ liệu cộng đồng...
        </div>
      ) : !communityConversation ? (
        <div className="rounded-[1.6rem] bg-white px-6 py-12 text-center shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
            <MessageCircleMore className="size-6" />
          </div>
          <h2 className="mt-5 font-auth-headline text-2xl font-bold text-[#2d2f32]">
            Chưa tìm thấy phòng cộng đồng
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6c7281]">
            Hệ thống chưa trả về conversation có `systemKey` cộng đồng. Bạn có thể
            vào chat để kiểm tra hoặc tải lại dữ liệu.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="rounded-full bg-[#f3edff] px-5 py-3 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#ece3ff]"
            >
              Mở chat
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-[#eefbf4] px-5 py-3 text-sm font-bold text-[#00a46f] transition-colors hover:bg-[#e6f8ee]"
            >
              Tải lại
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="rounded-[1.35rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex size-12 items-center justify-center rounded-2xl ${card.iconClassName}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span className={`text-xs font-bold ${card.badgeClassName}`}>
                      {card.badge}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-medium text-[#6d7282]">{card.label}</p>
                    <p className="mt-1 font-auth-headline text-[2rem] font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                      {card.value}
                    </p>
                    <p className="mt-2 text-xs font-medium text-[#8b92a1]">
                      {card.helper}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="grid gap-8 xl:grid-cols-[minmax(0,1.85fr)_380px]">
            <div className={`${cardClassName} overflow-hidden`}>
              <div className="flex flex-col gap-4 bg-[#faf8ff] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex size-2.5 rounded-full bg-[#00a46f]" />
                    <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                      Luồng chat cộng đồng
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-[#7a8190]">
                    Phòng: {communityConversation.group?.name || "Cộng đồng"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/chat")}
                    className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#5868ff] shadow-[0_14px_28px_-24px_rgba(45,47,50,0.25)]"
                  >
                    Xem tất cả trong chat
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#7b19d8] shadow-[0_14px_28px_-24px_rgba(45,47,50,0.25)]"
                  >
                    <RefreshCw className={cn("size-3.5", refreshing ? "animate-spin" : "")} />
                    Làm mới
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-4 sm:p-6">
                {visibleMessages.length > 0 ? (
                  visibleMessages.map((message) => {
                    const flagged = isSuspiciousMessage(message);
                    const isGift = Boolean(message.communityGift);
                    const senderName =
                      message.sender?.displayName ??
                      message.communityGift?.senderDisplayName ??
                      "Thành viên cộng đồng";

                    return (
                      <article
                        key={message._id}
                        className={cn(
                          "rounded-[1.4rem] p-5 transition-colors",
                          flagged
                            ? "bg-[#fff4f1]"
                            : isGift
                              ? "bg-[#effaf3]"
                              : "bg-[#faf8ff]"
                        )}
                      >
                        <div className="flex gap-4">
                          <Avatar className="size-12 rounded-[1rem]">
                            <AvatarImage
                              src={message.sender?.avatarUrl ?? undefined}
                              alt={senderName}
                            />
                            <AvatarFallback className="bg-[#f3edff] text-sm font-bold text-[#7b19d8]">
                              {getParticipantInitial(senderName)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="truncate text-sm font-bold text-[#2d2f32]">
                                    {senderName}
                                  </h3>
                                  {flagged ? (
                                    <span className="rounded-full bg-[#ffd8cf] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d4525d]">
                                      Cần rà soát
                                    </span>
                                  ) : null}
                                  {isGift ? (
                                    <span className="rounded-full bg-[#dff8e8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#00a46f]">
                                      Lì xì
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-3 text-sm leading-6 text-[#3f4955]">
                                  {getMessageBody(message)}
                                </p>
                              </div>

                              <div className="shrink-0 text-xs font-medium text-[#8a91a0]">
                                {formatRelativeTime(message.createdAt)}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => navigate("/admin/users")}
                                className="rounded-full bg-white px-3.5 py-2 text-[11px] font-bold text-[#5868ff] shadow-[0_14px_28px_-24px_rgba(45,47,50,0.2)]"
                              >
                                Mở quản lý user
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate("/chat")}
                                className="rounded-full bg-white px-3.5 py-2 text-[11px] font-bold text-[#7b19d8] shadow-[0_14px_28px_-24px_rgba(45,47,50,0.2)]"
                              >
                                Xem trong chat
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-[1.4rem] bg-[#faf8ff] px-6 py-10 text-center text-sm text-[#7a8190]">
                    Không có tin nhắn nào khớp với bộ lọc hiện tại.
                  </div>
                )}
              </div>

              <div className="border-t border-[#efe9fa] bg-[#fcfbff] px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#7a8190]">
                    {hiddenMessagesCount > 0
                      ? `Đang hiển thị 5 tin nhắn mới nhất. Còn ${formatNumber(
                          hiddenMessagesCount
                        )} tin nhắn khác được rút gọn khỏi màn hình admin.`
                      : "Đang hiển thị 5 tin nhắn mới nhất của phòng cộng đồng."}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/chat")}
                    className="inline-flex items-center justify-center rounded-full bg-[#eefbf4] px-5 py-3 text-sm font-bold text-[#00a46f] transition-colors hover:bg-[#e5f8ec]"
                  >
                    Xem tất cả trong chat
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <section className={`${cardClassName} p-6`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                      Quản lý tố cáo
                    </h2>
                    <p className="mt-1 text-sm text-[#7a8190]">
                      Danh sách tố cáo user mới nhất được gửi từ cộng đồng.
                    </p>
                  </div>
                  <TriangleAlert className="size-5 text-[#d4525d]" />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-[1rem] bg-[#fff1ec] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#d4525d]">
                      Chờ xử lý
                    </p>
                    <p className="mt-1 font-auth-headline text-xl font-extrabold text-[#2d2f32]">
                      {formatNumber(pendingReportsCount)}
                    </p>
                  </div>
                  <div className="rounded-[1rem] bg-[#eef1ff] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5868ff]">
                      Đang xem
                    </p>
                    <p className="mt-1 font-auth-headline text-xl font-extrabold text-[#2d2f32]">
                      {formatNumber(inReviewReportsCount)}
                    </p>
                  </div>
                  <div className="rounded-[1rem] bg-[#eefbf4] px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#00a46f]">
                      Đã xử lý
                    </p>
                    <p className="mt-1 font-auth-headline text-xl font-extrabold text-[#2d2f32]">
                      {formatNumber(resolvedReportsCount)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {visibleReports.length > 0 ? (
                    visibleReports.map((report) => {
                      const categoryMeta = getCommunityReportCategoryMeta(report.category);
                      const statusMeta = getCommunityReportStatusMeta(report.status);
                      const actionInReview = `${report.id}:in_review`;
                      const actionResolved = `${report.id}:resolved`;
                      const actionDismissed = `${report.id}:dismissed`;
                      const actionLockCommunityChat = `${report.id}:community-chat:lock`;
                      const actionUnlockCommunityChat = `${report.id}:community-chat:unlock`;
                      const detailText =
                        report.description.trim() || report.latestMessageExcerpt.trim();
                      const communityChatLocked =
                        report.targetUser.communityChatStatus === "locked";

                      return (
                        <article
                          key={report.id}
                          className="rounded-[1.2rem] bg-[#faf8ff] p-4"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="size-11 rounded-[1rem]">
                              <AvatarImage
                                src={report.targetUser.avatarUrl ?? undefined}
                                alt={report.targetUser.displayName}
                              />
                              <AvatarFallback className="bg-[#fff1ec] text-sm font-bold text-[#d4525d]">
                                {getParticipantInitial(report.targetUser.displayName)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-[#2d2f32]">
                                    {report.targetUser.displayName}
                                  </p>
                                  <p className="mt-1 text-[11px] text-[#7a8190]">
                                    Bị tố cáo bởi {report.reporter.displayName} •{" "}
                                    {formatRelativeTime(report.createdAt)}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusMeta.className}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${categoryMeta.className}`}
                                >
                                  {categoryMeta.label}
                                </span>
                                {report.targetUser.accountId ? (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5868ff]">
                                    ID {report.targetUser.accountId}
                                  </span>
                                ) : null}
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                                    communityChatLocked
                                      ? "bg-[#fff1ec] text-[#d4525d]"
                                      : "bg-[#eefbf4] text-[#00a46f]"
                                  )}
                                >
                                  {communityChatLocked ? "Chat bị khóa" : "Chat đang mở"}
                                </span>
                              </div>

                              <p className="mt-3 text-sm leading-6 text-[#49505f]">
                                {detailText || "Người dùng không để lại mô tả thêm."}
                              </p>

                              {report.latestMessageExcerpt && report.description.trim() ? (
                                <p className="mt-2 text-[11px] leading-5 text-[#8b92a1]">
                                  Ngữ cảnh: "{report.latestMessageExcerpt}"
                                </p>
                              ) : null}

                              <div className="mt-4 flex flex-wrap gap-2">
                                {communityChatLocked ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateCommunityChat(report, "unlock")
                                    }
                                    disabled={reportActionKey === actionUnlockCommunityChat}
                                    className="rounded-full bg-[#eefbf4] px-3.5 py-2 text-[11px] font-bold text-[#00a46f] transition-colors hover:bg-[#e4f7ec] disabled:opacity-60"
                                  >
                                    {reportActionKey === actionUnlockCommunityChat
                                      ? "Đang mở..."
                                      : "Mở chat cộng đồng"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateCommunityChat(report, "lock")
                                    }
                                    disabled={reportActionKey === actionLockCommunityChat}
                                    className="rounded-full bg-[#fff1ec] px-3.5 py-2 text-[11px] font-bold text-[#d4525d] transition-colors hover:bg-[#ffe8e0] disabled:opacity-60"
                                  >
                                    {reportActionKey === actionLockCommunityChat
                                      ? "Đang khóa..."
                                      : "Khóa chat cộng đồng"}
                                  </button>
                                )}

                                {report.status === "pending" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateReportStatus(report.id, "in_review")
                                    }
                                    disabled={reportActionKey === actionInReview}
                                    className="rounded-full bg-[#eef1ff] px-3.5 py-2 text-[11px] font-bold text-[#5868ff] transition-colors hover:bg-[#e3e8ff] disabled:opacity-60"
                                  >
                                    {reportActionKey === actionInReview
                                      ? "Đang nhận..."
                                      : "Nhận xử lý"}
                                  </button>
                                ) : null}

                                {report.status !== "resolved" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateReportStatus(report.id, "resolved")
                                    }
                                    disabled={reportActionKey === actionResolved}
                                    className="rounded-full bg-[#eefbf4] px-3.5 py-2 text-[11px] font-bold text-[#00a46f] transition-colors hover:bg-[#e4f7ec] disabled:opacity-60"
                                  >
                                    {reportActionKey === actionResolved
                                      ? "Đang cập nhật..."
                                      : "Đã xử lý"}
                                  </button>
                                ) : null}

                                {report.status !== "dismissed" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateReportStatus(report.id, "dismissed")
                                    }
                                    disabled={reportActionKey === actionDismissed}
                                    className="rounded-full bg-white px-3.5 py-2 text-[11px] font-bold text-[#7b19d8] shadow-[0_14px_28px_-24px_rgba(45,47,50,0.2)] disabled:opacity-60"
                                  >
                                    {reportActionKey === actionDismissed
                                      ? "Đang bỏ qua..."
                                      : "Bỏ qua"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-[1.2rem] bg-[#faf8ff] px-4 py-6 text-center text-sm text-[#7a8190]">
                      {deferredSearchTerm
                        ? "Không có tố cáo nào khớp với từ khóa hiện tại."
                        : "Chưa có tố cáo nào được gửi từ cộng đồng."}
                    </div>
                  )}
                </div>

                {hiddenReportsCount > 0 ? (
                  <p className="mt-4 text-center text-xs font-medium text-[#8b92a1]">
                    Còn {formatNumber(hiddenReportsCount)} tố cáo khác đang được ẩn bớt khỏi khung này.
                  </p>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-[1.6rem] bg-[radial-gradient(circle_at_top,#0f8d62_0%,#006945_52%,#014931_100%)] p-6 text-white shadow-[0_24px_55px_-28px_rgba(0,105,69,0.5)]">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/14">
                  <ShieldCheck className="size-6" />
                </div>

                <h2 className="mt-5 font-auth-headline text-2xl font-bold tracking-[-0.04em]">
                  Điều phối nhanh
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/78">
                  Theo dõi luồng chat, gom tố cáo và mở quản lý user ngay khi có dấu
                  hiệu vi phạm trong cộng đồng.
                </p>

                <div className="mt-6 space-y-3">
                  <div className="rounded-[1.2rem] bg-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Người đang online</span>
                      <span className="text-sm font-bold">
                        {formatNumber(onlineCommunityCount)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] bg-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Tin nhắn cần rà soát</span>
                      <span className="text-sm font-bold">
                        {formatNumber(suspiciousMessages.length)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] bg-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Tố cáo chờ xử lý</span>
                      <span className="text-sm font-bold">
                        {formatNumber(pendingReportsCount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate("/chat")}
                    className="flex w-full items-center justify-between rounded-full bg-white px-5 py-3 text-sm font-bold text-[#006945] transition-transform active:scale-[0.985]"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-4.5" />
                      Vào phòng cộng đồng
                    </span>
                    <ArrowRight className="size-4.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/users")}
                    className="flex w-full items-center justify-between rounded-full bg-white/14 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/18"
                  >
                    <span className="flex items-center gap-2">
                      <WalletCards className="size-4.5" />
                      Rà soát user liên quan
                    </span>
                    <ArrowRight className="size-4.5" />
                  </button>
                </div>
              </section>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
