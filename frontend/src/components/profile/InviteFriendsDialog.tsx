import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { UserReferralInvitee, UserReferralOverviewResponse } from "@/types/user";
import {
  ArrowLeft,
  Copy,
  Facebook,
  Gift,
  Link2,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Music2,
  Shield,
  UserRound,
  Wallet,
  Youtube,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface InviteFriendsDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const EMPTY_REFERRAL_SUMMARY: UserReferralOverviewResponse["summary"] = {
  totalInvited: 0,
  verifiedInvited: 0,
  pendingInvited: 0,
  rewardPerInvite: 10000,
  estimatedRewardTotal: 0,
  estimatedPendingReward: 0,
};

const inviteSteps = [
  {
    id: 1,
    title: "Chia sẻ link hoặc ID",
    description: "Gửi link mời hoặc ID tài khoản của bạn cho bạn bè qua bất kỳ kênh nào.",
  },
  {
    id: 2,
    title: "Bạn bè đăng ký theo cách họ muốn",
    description: "Người được mời có thể đăng ký thường hoặc bằng Google, hệ thống vẫn giữ đúng người mời.",
  },
  {
    id: 3,
    title: "Theo dõi ngay trong danh sách",
    description: "Ngay khi tài khoản được tạo, bạn sẽ thấy người được mời xuất hiện trong danh sách bên dưới.",
  },
] as const;

const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const formatRelativeTime = (value?: string | null) => {
  if (!value) {
    return "Vừa cập nhật";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Vừa cập nhật";
  }

  const diffInHours = Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60)));

  if (diffInHours < 1) {
    return "Vừa xong";
  }

  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }

  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays === 1) {
    return "Hôm qua";
  }

  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
};

const copyTextWithFallback = (value: string) => {
  if (typeof document === "undefined") {
    return false;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.error("Không thể dùng fallback copy", error);
  } finally {
    document.body.removeChild(textArea);
  }

  return copied;
};

const InviteFriendsDialog = ({ open, setOpen }: InviteFriendsDialogProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [referralSummary, setReferralSummary] =
    useState<UserReferralOverviewResponse["summary"]>(EMPTY_REFERRAL_SUMMARY);
  const [invitees, setInvitees] = useState<UserReferralInvitee[]>([]);
  const [loadingInvitees, setLoadingInvitees] = useState(false);

  useEffect(() => {
    if (!open || user?.role !== "admin") {
      return;
    }

    setOpen(false);
    navigate("/admin");
  }, [navigate, open, setOpen, user?.role]);

  useEffect(() => {
    if (!open || user?.role === "admin") {
      return;
    }

    let cancelled = false;

    const syncReferralOverview = async () => {
      try {
        setLoadingInvitees(true);
        const data = await userService.getReferralOverview();

        if (cancelled) {
          return;
        }

        setReferralSummary(data.summary);
        setInvitees(data.invitees);
      } catch (error) {
        if (!cancelled) {
          console.error("Không tải được dữ liệu mời bạn bè", error);
          toast.error("Không tải được danh sách mời bạn bè.");
          setReferralSummary(EMPTY_REFERRAL_SUMMARY);
          setInvitees([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingInvitees(false);
        }
      }
    };

    void syncReferralOverview();

    return () => {
      cancelled = true;
    };
  }, [open, user?.role]);

  const inviteCode = useMemo(() => {
    if (user?.accountId) {
      return user.accountId;
    }

    if (user?.username) {
      return user.username.toUpperCase();
    }

    return "KTT-REF";
  }, [user?.accountId, user?.username]);

  const inviteUrl = useMemo(() => {
    const query = `/signup?ref=${encodeURIComponent(inviteCode)}`;

    if (typeof window === "undefined") {
      return query;
    }

    return `${window.location.origin}${query}`;
  }, [inviteCode]);

  const inviteMessage = useMemo(
    () =>
      `Tham gia Kiếm Tương Tác cùng mình với ID mời ${inviteCode}. ` +
      `Bạn có thể đăng ký nhanh bằng link ${inviteUrl}`,
    [inviteCode, inviteUrl]
  );

  if (user?.role === "admin") {
    return null;
  }

  const copyValue = async (value: string, successMessage: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        toast.success(successMessage);
        return;
      }
    } catch (error) {
      console.error("Không sao chép được nội dung mời bạn bè", error);
    }

    if (copyTextWithFallback(value)) {
      toast.success(successMessage);
      return;
    }

    toast.info(value);
  };

  const shareInvite = async (label?: string) => {
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

    await copyValue(
      inviteMessage,
      label ? `Đã sao chép nội dung chia sẻ cho ${label}.` : "Đã sao chép nội dung mời."
    );
  };

  const handleFacebookShare = async () => {
    if (typeof window !== "undefined") {
      const shareUrl =
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}` +
        `&quote=${encodeURIComponent(inviteMessage)}`;

      window.open(shareUrl, "_blank", "noopener,noreferrer");
      toast.success("Đã mở Facebook để chia sẻ lời mời.");
      return;
    }

    await shareInvite("Facebook");
  };

  const shareActions = [
    {
      id: "facebook",
      label: "Facebook",
      icon: Facebook,
      iconClassName: "size-6",
      buttonClassName: "bg-[#1877F2] text-white",
      onClick: handleFacebookShare,
    },
    {
      id: "tiktok",
      label: "TikTok",
      icon: Music2,
      iconClassName: "size-6",
      buttonClassName: "bg-[#111827] text-white",
      onClick: () => shareInvite("TikTok"),
    },
    {
      id: "youtube",
      label: "YouTube",
      icon: Youtube,
      iconClassName: "size-6",
      buttonClassName: "bg-[#FF0000] text-white",
      onClick: () => shareInvite("YouTube"),
    },
    {
      id: "copy-link",
      label: "Sao chép link",
      icon: Link2,
      iconClassName: "size-5",
      buttonClassName: "bg-[#0846ed] text-white",
      onClick: () => copyValue(inviteUrl, "Đã sao chép link mời."),
    },
    {
      id: "more",
      label: "Thêm",
      icon: MoreHorizontal,
      iconClassName: "size-5",
      buttonClassName: "bg-[#e1e2e8] text-[#5a5b5f]",
      onClick: () => shareInvite(),
    },
  ] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[#f6f6fa] p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Mời bạn bè</DialogTitle>

        <div className="min-h-dvh bg-[#f6f6fa] font-auth-body text-[#2d2f32]">
          <header className="sticky top-0 z-20 bg-[#f6f6fa]/92 backdrop-blur-xl">
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
                  Mời bạn bè
                </h1>
              </div>

              <button
                type="button"
                onClick={() => void shareInvite()}
                className="flex size-9 items-center justify-center rounded-full text-[#7a7d84] transition-colors hover:bg-[#edf1ef] active:scale-95"
                aria-label="Chia sẻ thêm"
              >
                <MoreVertical className="size-4.5" />
              </button>
            </div>
            <div className="h-px bg-[#d7dde0]" />
          </header>

          <main className="mobile-page-shell pb-12 pt-5">
            <section className="relative overflow-hidden rounded-[1.8rem] bg-gradient-primary px-5 py-6 text-white shadow-[0_24px_56px_-28px_rgba(123,25,216,0.4)]">
              <div className="relative z-10 pr-28">
                <h2 className="font-auth-headline text-[2rem] font-extrabold leading-[1.08] tracking-[-0.05em]">
                  Chia sẻ niềm vui, Nhận quà cực khủng
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/88">
                  Mỗi người bạn tham gia, cả hai đều nhận ngay 10,000 VND vào ví.
                </p>
              </div>

              <div className="absolute bottom-5 right-5 flex size-28 items-center justify-center rounded-full bg-white/14 shadow-[0_18px_44px_-24px_rgba(255,255,255,0.45)] backdrop-blur-md">
                <div className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_70%)]" />
                <Gift className="relative z-10 size-12" />
              </div>

              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_40%)]" />
            </section>

            <section className="mt-5 grid gap-4">
              <div className="rounded-[1.3rem] bg-white px-4 py-4 shadow-[0_18px_44px_-34px_rgba(123,25,216,0.16)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8e94]">
                  ID mời của bạn
                </p>

                <div className="mt-3 flex items-center gap-3 rounded-[1rem] bg-[#f0f0f5] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-auth-headline text-[1.45rem] font-extrabold tracking-[0.22em] text-[#7b19d8]">
                      {inviteCode}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void copyValue(inviteCode, "Đã sao chép ID mời.")}
                    className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-primary text-white transition-transform active:scale-95"
                    aria-label="Sao chép ID mời"
                  >
                    <Copy className="size-4.5" />
                  </button>
                </div>

                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8e94]">
                  Link mời của bạn
                </p>
                <div className="mt-3 flex items-center gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#5a5b5f]">{inviteUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyValue(inviteUrl, "Đã sao chép link mời.")}
                    className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-[#7b19d8] text-white transition-transform active:scale-95"
                    aria-label="Sao chép link mời"
                  >
                    <Link2 className="size-4.5" />
                  </button>
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b8e94]">
                    Chia sẻ qua ứng dụng
                  </p>

                  <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                    {shareActions.map((action) => {
                      const Icon = action.icon;

                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => void action.onClick()}
                          className={`flex size-12 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${action.buttonClassName}`}
                          aria-label={action.label}
                        >
                          <Icon className={action.iconClassName} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.3rem] bg-[linear-gradient(180deg,rgba(123,25,216,0.12),rgba(255,102,199,0.08))] px-4 py-5 text-center shadow-[0_18px_44px_-34px_rgba(123,25,216,0.16)]">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                  <Wallet className="size-7" />
                </div>
                <p className="mt-3 text-sm font-medium text-[#5a5b5f]">
                  Thưởng giới thiệu tạm tính
                </p>
                <div className="mt-1 flex items-end justify-center gap-1">
                  <span className="font-auth-headline text-[2.15rem] font-extrabold tracking-[-0.05em] text-[#2d2f32]">
                    {formatCurrency(referralSummary.estimatedRewardTotal)}
                  </span>
                  <span className="pb-1 text-sm font-bold text-[#5a5b5f]">đ</span>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#7b19d8] shadow-sm">
                  <span className="size-2 rounded-full bg-[#7b19d8]" />
                  Đang chờ: {formatCurrency(referralSummary.estimatedPendingReward)}đ
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[1.15rem] bg-white px-3 py-4 text-center shadow-[0_18px_44px_-34px_rgba(123,25,216,0.16)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a94a4]">
                    Đã mời
                  </p>
                  <p className="mt-2 font-auth-headline text-[1.55rem] font-extrabold text-[#2d2f32]">
                    {formatCurrency(referralSummary.totalInvited)}
                  </p>
                </div>
                <div className="rounded-[1.15rem] bg-white px-3 py-4 text-center shadow-[0_18px_44px_-34px_rgba(123,25,216,0.16)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a94a4]">
                    Xác minh
                  </p>
                  <p className="mt-2 font-auth-headline text-[1.55rem] font-extrabold text-[#7b19d8]">
                    {formatCurrency(referralSummary.verifiedInvited)}
                  </p>
                </div>
                <div className="rounded-[1.15rem] bg-white px-3 py-4 text-center shadow-[0_18px_44px_-34px_rgba(123,25,216,0.16)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a94a4]">
                    Chờ
                  </p>
                  <p className="mt-2 font-auth-headline text-[1.55rem] font-extrabold text-[#d8589f]">
                    {formatCurrency(referralSummary.pendingInvited)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="font-auth-headline text-[1.35rem] font-bold tracking-tight text-[#2d2f32]">
                Cách thức hoạt động
              </h3>

              <div className="mt-4 space-y-4">
                {inviteSteps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-[1.2rem] bg-white px-4 py-4 shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-[0.85rem] bg-[#f3edff] text-sm font-bold text-[#7b19d8]">
                        {step.id}
                      </div>

                      <div>
                        <h4 className="font-semibold text-[#2d2f32]">{step.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-[#5a5b5f]">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-auth-headline text-[1.35rem] font-bold tracking-tight text-[#2d2f32]">
                    Bạn đã mời được {formatCurrency(referralSummary.totalInvited)} người
                  </h3>
                  <p className="mt-1 text-sm text-[#6b6d71]">
                    Danh sách dưới đây hiển thị đúng những tài khoản đã đăng ký bằng link hoặc mã của bạn.
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.2rem] bg-[#f0f0f5]">
                {loadingInvitees ? (
                  <div className="flex items-center justify-center gap-3 px-4 py-6 text-sm font-medium text-[#6b6d71]">
                    <Loader2 className="size-4 animate-spin text-[#7b19d8]" />
                    Đang tải danh sách được mời...
                  </div>
                ) : invitees.length > 0 ? (
                  invitees.map((invitee, index) => (
                    <div
                      key={invitee.id}
                      className={`flex items-center justify-between gap-3 px-4 py-4 ${
                        index > 0 ? "border-t border-white/75" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#7b19d8] text-xs font-bold text-white">
                          {index + 1}
                        </div>

                        <Avatar className="size-11">
                          <AvatarImage
                            src={invitee.avatarUrl}
                            alt={invitee.displayName}
                          />
                          <AvatarFallback className="bg-[#dde1e8] text-sm font-bold text-[#2d2f32]">
                            {(invitee.displayName || invitee.username || "K")
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#2d2f32]">
                            {invitee.displayName || invitee.username}
                          </p>
                          <p className="truncate text-xs text-[#6b6d71]">
                            @{invitee.username} • {formatRelativeTime(invitee.invitedAt)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
                          invitee.status === "verified"
                            ? "bg-[#f3edff] text-[#7b19d8]"
                            : "bg-white text-[#7a7d84]"
                        }`}
                      >
                        {invitee.status === "verified" ? "Đã xác minh" : "Chờ xác minh"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-[#7b19d8] shadow-sm">
                      <UserRound className="size-6" />
                    </div>
                    <p className="mt-4 font-semibold text-[#2d2f32]">Chưa có người được mời</p>
                    <p className="mt-1 text-sm leading-6 text-[#6b6d71]">
                      Sao chép link hoặc ID mời ở trên để bắt đầu mời bạn bè tham gia.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-10 flex flex-col items-center gap-3 px-5 text-center opacity-75">
              <Shield className="size-8 text-[#6b6d71]" />
              <p className="text-xs leading-5 text-[#6b6d71]">
                Link và mã mời hiện hoạt động cho cả đăng ký thường lẫn Google. Phần thưởng
                giới thiệu đang được hiển thị theo số tài khoản đã được ghi nhận từ lời mời của bạn.
              </p>
            </section>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteFriendsDialog;
