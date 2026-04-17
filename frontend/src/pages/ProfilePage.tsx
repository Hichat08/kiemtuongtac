import AvatarUploader from "@/components/profile/AvatarUploader";
import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import HelpCenterDialog from "@/components/profile/HelpCenterDialog";
import InviteFriendsDialog from "@/components/profile/InviteFriendsDialog";
import NotificationCenterDialog from "@/components/profile/NotificationCenterDialog";
import NotificationSettingsDialog from "@/components/profile/NotificationSettingsDialog";
import { PinSettingsDialog } from "@/components/profile/PinSettingsDialog";
import ProfileDialog from "@/components/profile/ProfileDialog";
import SocialLinksDialog from "@/components/profile/SocialLinksDialog";
import TaskHistoryDialog from "@/components/profile/TaskHistoryDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserFinancialData } from "@/hooks/useUserFinancialData";
import { useUserNotificationSummary } from "@/hooks/useUserNotificationSummary";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSocketStore } from "@/stores/useSocketStore";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Coins,
  Copy,
  Gift,
  Link2,
  LogOut,
  Settings2,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

interface ProfileOption {
  label: string;
  description: string;
  icon: typeof UserRound;
  iconClassName: string;
  onClick: () => void;
  highlight?: boolean;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { conversations, fetchConversations } = useChatStore();
  const { currentBalance } = useUserFinancialData(user?.accountId);
  const { unreadCount } = useUserNotificationSummary();
  const { friends, getFriends, getAllFriendRequests } = useFriendStore();
  const { onlineUsers } = useSocketStore();
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [socialLinksOpen, setSocialLinksOpen] = useState(false);
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false);
  const [inviteFriendsOpen, setInviteFriendsOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] =
    useState(false);
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [pinSettingsOpen, setPinSettingsOpen] = useState(false);

  useEffect(() => {
    const hydrateProfile = async () => {
      await Promise.allSettled([
        fetchConversations(),
        getFriends(),
        getAllFriendRequests(),
      ]);
    };

    hydrateProfile();
  }, [fetchConversations, getAllFriendRequests, getFriends]);
  const isOnline = user ? onlineUsers.includes(user._id) : false;
  const memberTier = useMemo(() => {
    if (friends.length >= 8 || conversations.length >= 10) {
      return "Thành viên Vàng";
    }

    if (friends.length >= 3 || conversations.length >= 4) {
      return "Thành viên Bạc";
    }

    return "Thành viên Mới";
  }, [conversations.length, friends.length]);

  const handleCopyAccountId = async () => {
    if (!user?.accountId) {
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(user.accountId);
        toast.success("Đã sao chép ID tài khoản.");
        return;
      }
    } catch (error) {
      console.error("Không sao chép được ID tài khoản", error);
    }

    toast.info(`ID tài khoản: ${user.accountId}`);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/signin");
  };

  const profileOptions: ProfileOption[] = [
    {
      label: "Thông tin tài khoản",
      description: "Quản lý hồ sơ, email và thông tin cá nhân",
      icon: UserRound,
      iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      onClick: () => setProfileOpen(true),
    },
    {
      label: "Liên kết mạng xã hội",
      description: "Kết nối thêm tài khoản để tăng độ uy tín",
      icon: Link2,
      iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      onClick: () => setSocialLinksOpen(true),
    },
    {
      label: "Lịch sử làm nhiệm vụ",
      description: "Xem lại các nhiệm vụ bạn đã nhận và hoàn tất",
      icon: ShieldCheck,
      iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      onClick: () => setTaskHistoryOpen(true),
    },
    {
      label: "Mời bạn bè",
      description: "Chia sẻ mã mời để kết nối thêm người dùng vào hệ thống",
      icon: Gift,
      iconClassName: "bg-[#f3edff] text-[#7b19d8]",
      onClick: () => setInviteFriendsOpen(true),
      highlight: true,
    },
    {
      label: "Cài đặt thông báo",
      description: "Kiểm soát nhắc nhở và cập nhật tài khoản",
      icon: Settings2,
      iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      onClick: () => setNotificationSettingsOpen(true),
    },
    {
      label: "Quản lý mã PIN",
      description: "Tạo mã PIN mới để xác minh tài khoản",
      icon: ShieldCheck,
      iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      onClick: () => setPinSettingsOpen(true),
    },
    {
      label: "Trung tâm trợ giúp",
      description: "Trao đổi nhanh với bộ phận hỗ trợ trong chat",
      icon: CircleHelp,
      iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      onClick: () => setHelpCenterOpen(true),
    },
  ];

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
        <div className="pointer-events-none absolute right-[-5rem] top-24 h-52 w-52 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />

        <header className="sticky top-0 z-30">
          <div className="mobile-page-shell flex items-center justify-between pt-5 pb-3 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-primary text-white shadow-[0_18px_35px_-24px_rgba(123,25,216,0.55)] sm:size-10">
                <Coins className="size-4.5" />
              </div>
              <p className="font-auth-headline text-lg font-extrabold tracking-tight text-[#2d1459] dark:text-white sm:text-xl">
                Kiếm Tương Tác
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNotificationCenterOpen(true)}
              className="relative flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] backdrop-blur-xl transition-transform duration-200 active:scale-95 dark:bg-white/10 dark:text-slate-100 sm:size-11"
              aria-label="Mở thông báo"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <>
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff4a90] ring-2 ring-[#f8f5ff] dark:ring-[#12081d]" />
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[#ff4a90] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </>
              ) : null}
            </button>
          </div>
        </header>

        <main className="mobile-page-shell pb-32 pt-3 sm:pb-36 sm:pt-4">
          <section className="rounded-[1.7rem] bg-white/88 p-5 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl dark:bg-white/8 sm:rounded-[2rem] sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4 sm:mb-5">
                <Avatar className="size-24 ring-[3px] ring-[#e6dbf8] shadow-[0_18px_40px_-26px_rgba(123,25,216,0.4)] sm:size-28 sm:ring-4">
                  <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                  <AvatarFallback className="bg-gradient-primary text-2xl font-bold text-white sm:text-3xl">
                    {user?.displayName?.charAt(0) ?? "K"}
                  </AvatarFallback>
                </Avatar>

                <div className="absolute -bottom-1 -right-1">
                  <AvatarUploader />
                </div>

                <span
                  className={`absolute bottom-3 right-1.5 flex size-4 items-center justify-center rounded-full border-2 border-white sm:bottom-4 sm:right-2 sm:size-5 ${
                    isOnline ? "bg-[#00c88b]" : "bg-slate-400"
                  }`}
                />
              </div>

              <h1 className="mobile-fluid-title font-auth-headline font-extrabold tracking-[-0.05em] text-slate-900 dark:text-white">
                {user?.displayName ?? "Kiếm Tương Tác"}
              </h1>

              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:mt-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#f3eef9] px-3.5 py-1 text-[#6f6591] dark:bg-white/10 dark:text-[#d7c7ed] sm:px-4 sm:py-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#00c88b]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-[11px]">
                    {memberTier}
                  </span>
                </div>

                {user?.accountId ? (
                  <button
                    type="button"
                    onClick={handleCopyAccountId}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eef9] px-3.5 py-1 font-mono text-[10px] font-semibold tracking-[0.22em] text-[#6f6591] transition-transform duration-200 active:scale-95 dark:bg-white/10 dark:text-[#d7c7ed] sm:px-4 sm:py-1.5 sm:text-[11px]"
                    aria-label={`Sao chép ID tài khoản ${user.accountId}`}
                  >
                    ID {user.accountId}
                    <Copy className="size-3" />
                  </button>
                ) : null}
              </div>

              <p className="mt-3 max-w-sm text-[13px] leading-6 text-[#7e7691] dark:text-[#c8b5e8] sm:mt-4 sm:text-sm sm:leading-7">
                Kết nối, hoàn thành nhiệm vụ và gia tăng thu nhập của bạn mỗi
                ngày cùng cộng đồng Kiếm Tương Tác.
              </p>
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-[1.7rem] bg-gradient-primary p-5 text-white shadow-[0_30px_80px_-35px_rgba(123,25,216,0.62)] sm:mt-6 sm:rounded-[2rem] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">
                  Số dư ví hiện tại
                </p>
                <div className="mt-3 flex items-end gap-2 sm:gap-3">
                  <p className="mobile-fluid-display font-auth-headline font-extrabold tracking-[-0.06em]">
                    {new Intl.NumberFormat("vi-VN").format(currentBalance)}
                  </p>
                  <p className="pb-1 text-lg font-bold text-white/90 sm:pb-1.5 sm:text-xl">
                    VND
                  </p>
                </div>
              </div>
              <Wallet className="size-8 text-white/45 sm:size-10" />
            </div>

            <div className="mt-5 flex items-center justify-between sm:mt-6">
              <Link
                to="/wallet"
                className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 font-auth-headline text-sm font-bold text-white transition-transform duration-200 active:scale-95 sm:px-5 sm:py-2.5"
              >
                <Coins className="size-4" />
                Nạp tiền
              </Link>
            </div>
          </section>

          <section className="mt-8 sm:mt-10">
            <h2 className="mb-4 font-auth-headline text-lg font-bold text-[#6f6591] dark:text-[#d7c7ed] sm:mb-5">
              Quản lý tài khoản
            </h2>

            <div className="space-y-2.5 sm:space-y-3">
              {profileOptions.map((option) => {
                const Icon = option.icon;

                if (option.label === "Liên kết mạng xã hội") {
                  return (
                    <div
                      key={`${option.label}-group`}
                      className="space-y-2.5 sm:space-y-3"
                    >
                      <Link
                        to="/wallet/withdraw/add-bank"
                        className="flex w-full items-center justify-between rounded-[1.2rem] bg-[#faf7ff] px-4 py-3.5 text-left shadow-[0_18px_40px_-32px_rgba(123,25,216,0.2)] ring-1 ring-[#eadbfd] transition-all duration-200 active:scale-[0.985] dark:bg-white/8 dark:ring-white/10 sm:rounded-[1.4rem] sm:p-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f3edff] text-[#7b19d8] sm:size-12 sm:rounded-2xl">
                            <Wallet className="size-4.5 sm:size-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#2d1459] dark:text-white sm:text-base">
                              Thêm tài khoản rút tiền
                            </p>
                            <p className="text-[11px] leading-5 text-[#8d84a1] dark:text-[#bdaad6] sm:text-xs">
                              Liên kết tài khoản ngân hàng để dùng khi rút tiền
                              từ ví
                            </p>
                          </div>
                        </div>

                        <ChevronRight className="size-4 text-[#b7aec7] dark:text-[#d5c5ec]" />
                      </Link>

                      <button
                        type="button"
                        onClick={option.onClick}
                        className={`flex w-full items-center justify-between rounded-[1.2rem] px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.985] sm:rounded-[1.4rem] sm:p-4 ${
                          option.highlight
                            ? "bg-[#f7f3ff] shadow-[0_20px_50px_-38px_rgba(123,25,216,0.28)]"
                            : "bg-white/88 shadow-[0_18px_48px_-38px_rgba(123,25,216,0.3)] dark:bg-white/8"
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${option.iconClassName} sm:size-12 sm:rounded-2xl`}
                          >
                            <Icon className="size-4.5 sm:size-5" />
                          </div>
                          <div>
                            <p
                              className={`text-sm font-semibold sm:text-base ${
                                option.highlight
                                  ? "text-[#7b19d8]"
                                  : "text-slate-900 dark:text-white"
                              }`}
                            >
                              {option.label}
                            </p>
                            <p
                              className={`text-[11px] leading-5 sm:text-xs ${
                                option.highlight
                                  ? "text-[#8f72bb]"
                                  : "text-[#8d84a1] dark:text-[#bdaaD6]"
                              }`}
                            >
                              {option.description}
                            </p>
                          </div>
                        </div>

                        <ChevronRight
                          className={`size-4 ${
                            option.highlight
                              ? "text-[#7b19d8]"
                              : "text-[#b7aec7] dark:text-[#d5c5ec]"
                          }`}
                        />
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={option.onClick}
                    className={`flex w-full items-center justify-between rounded-[1.2rem] px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.985] sm:rounded-[1.4rem] sm:p-4 ${
                      option.highlight
                        ? "bg-[#f7f3ff] shadow-[0_20px_50px_-38px_rgba(123,25,216,0.28)]"
                        : "bg-white/88 shadow-[0_18px_48px_-38px_rgba(123,25,216,0.3)] dark:bg-white/8"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${option.iconClassName} sm:size-12 sm:rounded-2xl`}
                      >
                        <Icon className="size-4.5 sm:size-5" />
                      </div>
                      <div>
                        <p
                          className={`text-sm font-semibold sm:text-base ${
                            option.highlight
                              ? "text-[#7b19d8]"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {option.label}
                        </p>
                        <p
                          className={`text-[11px] leading-5 sm:text-xs ${
                            option.highlight
                              ? "text-[#8f72bb]"
                              : "text-[#8d84a1] dark:text-[#bdaaD6]"
                          }`}
                        >
                          {option.description}
                        </p>
                      </div>
                    </div>

                    <ChevronRight
                      className={`size-4 ${
                        option.highlight
                          ? "text-[#7b19d8]"
                          : "text-[#b7aec7] dark:text-[#d5c5ec]"
                      }`}
                    />
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleLogout}
                className="mt-5 flex w-full items-center gap-3 rounded-[1.2rem] bg-[#fff1f4] px-4 py-3.5 text-left shadow-[0_18px_48px_-38px_rgba(212,82,93,0.25)] transition-all duration-200 active:scale-[0.985] dark:bg-[#3a1420] sm:mt-6 sm:gap-4 sm:rounded-[1.4rem] sm:p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ffdfe6] text-[#d4525d] dark:bg-[#5a1f31] dark:text-[#ff9fb1] sm:size-12 sm:rounded-2xl">
                  <LogOut className="size-4.5 sm:size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#d4525d] dark:text-[#ff9fb1] sm:text-base">
                    Đăng xuất
                  </p>
                  <p className="text-[11px] leading-5 text-[#c57584] dark:text-[#f0b5c1] sm:text-xs">
                    Kết thúc phiên hiện tại và quay về màn đăng nhập
                  </p>
                </div>
              </button>
            </div>
          </section>
        </main>

        <AppMobileNav />
      </div>

      {notificationCenterOpen ? (
        <NotificationCenterDialog
          open={notificationCenterOpen}
          setOpen={setNotificationCenterOpen}
        />
      ) : null}

      <ProfileDialog open={profileOpen} setOpen={setProfileOpen} />

      <SocialLinksDialog open={socialLinksOpen} setOpen={setSocialLinksOpen} />

      <TaskHistoryDialog open={taskHistoryOpen} setOpen={setTaskHistoryOpen} />

      <InviteFriendsDialog
        open={inviteFriendsOpen}
        setOpen={setInviteFriendsOpen}
      />

      <NotificationSettingsDialog
        open={notificationSettingsOpen}
        setOpen={setNotificationSettingsOpen}
      />

      {pinSettingsOpen ? (
        <PinSettingsDialog
          open={pinSettingsOpen}
          setOpen={setPinSettingsOpen}
        />
      ) : null}

      <HelpCenterDialog open={helpCenterOpen} setOpen={setHelpCenterOpen} />
    </>
  );
};

export default ProfilePage;
