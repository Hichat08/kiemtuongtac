import FriendRequestDialog from "@/components/friendRequest/FriendRequestDialog";
import {
  useUserNotificationSummary,
  type UserNotificationItem,
} from "@/hooks/useUserNotificationSummary";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNotificationCenterStore } from "@/stores/useNotificationCenterStore";
import {
  ArrowLeft,
  CheckCheck,
  Gift,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface NotificationCenterDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const RECENT_NOTIFICATIONS_PREVIEW_LIMIT = 3;
const EARLIER_NOTIFICATIONS_PREVIEW_LIMIT = 4;

const NotificationCenterDialog = ({
  open,
  setOpen,
}: NotificationCenterDialogProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [friendRequestOpen, setFriendRequestOpen] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllEarlier, setShowAllEarlier] = useState(false);
  const {
    scopeKey,
    notificationItems,
    recentNotifications,
    earlierNotifications,
    unreadCount,
    recentUnreadCount,
  } = useUserNotificationSummary();
  const markAllAsRead = useNotificationCenterStore((state) => state.markAllAsRead);
  const latestUnreadTimestamp = useMemo(() => {
    const maxUnreadCreatedAtMs = notificationItems.reduce(
      (latestTimestamp, item) =>
        item.isUnread ? Math.max(latestTimestamp, item.createdAtMs) : latestTimestamp,
      0
    );

    return Math.max(Date.now(), maxUnreadCreatedAtMs);
  }, [notificationItems]);

  useEffect(() => {
    if (!open || user?.role !== "admin") {
      return;
    }

    setOpen(false);
    navigate("/admin");
  }, [navigate, open, setOpen, user?.role]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setShowAllRecent(false);
    setShowAllEarlier(false);
  }, [open]);

  useEffect(() => {
    if (!open || unreadCount <= 0) {
      return;
    }

    markAllAsRead(scopeKey, latestUnreadTimestamp);
  }, [latestUnreadTimestamp, markAllAsRead, open, scopeKey, unreadCount]);

  if (user?.role === "admin") {
    return null;
  }

  const visibleRecentNotifications = showAllRecent
    ? recentNotifications
    : recentNotifications.slice(0, RECENT_NOTIFICATIONS_PREVIEW_LIMIT);
  const visibleEarlierNotifications = showAllEarlier
    ? earlierNotifications
    : earlierNotifications.slice(0, EARLIER_NOTIFICATIONS_PREVIEW_LIMIT);

  const handleNotificationAction = (item: UserNotificationItem) => {
    if (item.action === "wallet") {
      setOpen(false);
      navigate("/wallet");
      return;
    }

    if (item.action === "tasks") {
      setOpen(false);
      navigate("/tasks");
      return;
    }

    if (item.action === "friend_requests") {
      setFriendRequestOpen(true);
      return;
    }

    if (item.action === "support") {
      setOpen(false);
      navigate("/chat/support");
    }
  };

  const handleShareInvite = async () => {
    const inviteCode =
      user?.accountId?.trim() || user?.username?.toUpperCase() || "KTT-REF";
    const inviteUrl =
      typeof window === "undefined"
        ? `/signup?ref=${encodeURIComponent(inviteCode)}`
        : `${window.location.origin}/signup?ref=${encodeURIComponent(inviteCode)}`;
    const inviteMessage = `Tham gia Kiếm Tương Tác cùng mình với ID mời ${inviteCode}: ${inviteUrl}`;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Mời bạn bè tới Kiếm Tương Tác",
          text: inviteMessage,
          url: inviteUrl,
        });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Không chia sẻ được lời mời", error);
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteMessage);
        toast.success("Đã sao chép lời mời giới thiệu.");
        return;
      }
    } catch (error) {
      console.error("Không sao chép được lời mời", error);
    }

    toast.info(inviteMessage);
  };

  const renderNotificationCard = (item: UserNotificationItem) => {
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNotificationAction(item)}
        className={`relative flex w-full gap-4 overflow-hidden rounded-[1rem] bg-white p-4 text-left shadow-[0_18px_42px_-34px_rgba(123,25,216,0.12)] transition-colors active:scale-[0.99] ${
          item.action !== "none" ? "hover:bg-[#fcfcff]" : ""
        } ${item.isUnread ? "" : "opacity-[0.94]"}`}
      >
        {item.showAccent ? (
          <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-[#7b19d8]" />
        ) : null}

        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-[0.95rem] ${item.iconWrapClassName}`}
        >
          <Icon className={`size-5 ${item.iconClassName}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-auth-headline text-[1.05rem] font-bold tracking-[-0.03em] text-[#2d2f32]">
              {item.title}
            </h3>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-[#8b8e94]">
              {item.timeLabel}
            </span>
          </div>

          <p className="mt-1 text-sm leading-6 text-[#5a5b5f]">{item.description}</p>

          {item.detailText ? (
            <div className="mt-3 rounded-[0.9rem] bg-[#faf7ff] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f96a4]">
                {item.detailLabel ?? "Chi tiết"}
              </p>
              <p className="mt-1 text-[13px] leading-5 font-medium text-[#2d2f32]">
                {item.detailText}
              </p>
            </div>
          ) : null}

          {item.priorityLabel ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="size-2 rounded-full bg-current text-[#0846ed]" />
              <span
                className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
                  item.priorityClassName ?? "text-[#0846ed]"
                }`}
              >
                {item.priorityLabel}
              </span>
            </div>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent
          showCloseButton={false}
          className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[radial-gradient(circle_at_top_right,rgba(255,157,196,0.22),transparent_30%),radial-gradient(circle_at_top_left,rgba(123,25,216,0.16),transparent_28%),#f6f6fa] p-0 shadow-none sm:max-w-none"
        >
          <DialogTitle className="sr-only">Thông báo</DialogTitle>

          <div className="relative min-h-dvh overflow-x-hidden bg-[linear-gradient(180deg,#fcf7ff_0%,#f8f1ff_34%,#f6f6fa_100%)] font-auth-body text-[#2d2f32]">
            <div className="pointer-events-none absolute -top-16 left-[-3rem] size-44 rounded-full bg-[#7b19d8]/10 blur-3xl" />
            <div className="pointer-events-none absolute right-[-4rem] top-10 size-56 rounded-full bg-[#ff9dc4]/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-24 left-[-2rem] size-40 rounded-full bg-[#dca8ff]/12 blur-3xl" />

            <header className="sticky top-0 z-20 bg-[#faf4ff]/84 backdrop-blur-xl">
              <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex size-9 items-center justify-center rounded-full text-[#7b19d8] transition-colors hover:bg-[#f3edff] active:scale-95"
                    aria-label="Quay lại"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <h1 className="font-auth-headline text-[1.15rem] font-bold tracking-tight text-[#7b19d8]">
                    Thông báo
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    markAllAsRead(scopeKey, latestUnreadTimestamp);
                    toast.success("Đã đánh dấu tất cả thông báo là đã đọc.");
                  }}
                  disabled={unreadCount === 0}
                  className={`flex size-10 items-center justify-center rounded-full transition-colors ${
                    unreadCount > 0
                      ? "bg-[#f3edff] text-[#7b19d8] hover:bg-[#eadbfd]"
                      : "bg-[#f0f0f5]/60 text-[#b5b7bd]"
                  }`}
                  aria-label="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="size-5" />
                </button>
              </div>
            </header>

            <main className="mobile-page-shell pb-12 pt-6">
              <section className="mb-9">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-auth-headline text-[1.45rem] font-bold tracking-tight text-[#2d2f32]">
                    Hôm nay
                  </h2>
                  {recentUnreadCount > 0 ? (
                    <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[11px] font-bold text-[#7b19d8]">
                      {recentUnreadCount} Mới
                    </span>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {recentNotifications.length > 0 ? (
                    visibleRecentNotifications.map(renderNotificationCard)
                  ) : (
                    <div className="rounded-[1rem] bg-white px-4 py-6 text-center shadow-[0_18px_42px_-34px_rgba(123,25,216,0.12)]">
                      <p className="font-semibold text-[#2d2f32]">
                        Chưa có thông báo mới trong 8 giờ gần đây
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#6b6d71]">
                        Các cập nhật giao dịch và lời mời kết bạn mới sẽ xuất hiện tại đây.
                      </p>
                    </div>
                  )}
                </div>
                {recentNotifications.length > RECENT_NOTIFICATIONS_PREVIEW_LIMIT ? (
                  <button
                    type="button"
                    onClick={() => setShowAllRecent((current) => !current)}
                    className="mt-4 inline-flex items-center rounded-full bg-[#f3edff] px-4 py-2 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#eadbfd]"
                  >
                    {showAllRecent
                      ? "Thu gọn"
                      : `Xem tất cả (${recentNotifications.length})`}
                  </button>
                ) : null}
              </section>

              <section className="mb-10">
                <h2 className="mb-5 font-auth-headline text-[1.35rem] font-bold tracking-tight text-[#2d2f32]/60">
                  Trước đó
                </h2>

                <div className="space-y-4">
                  {earlierNotifications.length > 0 ? (
                    visibleEarlierNotifications.map(renderNotificationCard)
                  ) : (
                    <div className="rounded-[1rem] bg-white px-4 py-6 text-center shadow-[0_18px_42px_-34px_rgba(123,25,216,0.12)]">
                      <p className="font-semibold text-[#2d2f32]">Không có thông báo cũ hơn</p>
                    </div>
                  )}
                </div>
                {earlierNotifications.length > EARLIER_NOTIFICATIONS_PREVIEW_LIMIT ? (
                  <button
                    type="button"
                    onClick={() => setShowAllEarlier((current) => !current)}
                    className="mt-4 inline-flex items-center rounded-full bg-[#f3edff] px-4 py-2 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#eadbfd]"
                  >
                    {showAllEarlier
                      ? "Thu gọn"
                      : `Xem tất cả (${earlierNotifications.length})`}
                  </button>
                ) : null}
              </section>

              <section className="relative overflow-hidden rounded-[1.5rem] bg-gradient-primary px-5 py-6 text-white shadow-[0_24px_56px_-28px_rgba(123,25,216,0.4)]">
                <div className="relative z-10 max-w-[15rem]">
                  <h3 className="font-auth-headline text-[1.45rem] font-extrabold tracking-[-0.04em]">
                    Mời bạn bè, nhận quà lớn
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/86">
                    Mỗi lượt giới thiệu thành công, bạn có thể nhận thêm thưởng từ hệ thống.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleShareInvite()}
                    className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#7b19d8] transition-transform active:scale-[0.98]"
                  >
                    Chia sẻ ngay
                  </button>
                </div>

                <div className="pointer-events-none absolute -bottom-4 -right-4 size-24 rounded-full bg-white/12" />
                <div className="pointer-events-none absolute bottom-2 right-10 size-10 rounded-full bg-[#ff9dc4]/18" />
                <Gift className="pointer-events-none absolute -bottom-4 -right-4 size-28 text-white/10" />
              </section>
            </main>
          </div>
        </DialogContent>
      </Dialog>

      <FriendRequestDialog
        open={friendRequestOpen}
        setOpen={setFriendRequestOpen}
      />
    </>
  );
};

export default NotificationCenterDialog;
