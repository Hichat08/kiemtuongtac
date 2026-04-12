import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { BrandLogo } from "@/components/branding/brand-logo";
import { adminService } from "@/services/adminService";
import {
  ArrowRight,
  Bell,
  BellRing,
  CircleHelp,
  CreditCard,
  Gift,
  LayoutDashboard,
  Landmark,
  ListTodo,
  MessageCircleMore,
  Search,
  Settings2,
  Sparkles,
  TriangleAlert,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import type { AdminNavigationIndicators } from "@/types/admin";

interface AdminShellProps {
  title: string;
  subtitle: string;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  action?: ReactNode;
  sidebarActionLabel?: string;
  onSidebarActionClick?: () => void;
  showSidebarAction?: boolean;
  children: ReactNode;
}

interface AdminNavItemConfig {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  indicatorKey?: keyof AdminNavigationIndicators;
}

const getNavLinkClassName = (isActive: boolean) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-white text-[#7b19d8] shadow-[0_18px_32px_-28px_rgba(123,25,216,0.28)]"
      : "text-[#6f7283] hover:bg-white/70 hover:text-[#7b19d8]"
  }`;

const getQuickLinkClassName = (isActive: boolean) =>
  `group inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
    isActive
      ? "border-[#d6bfff] bg-white text-[#7b19d8] shadow-[0_16px_34px_-28px_rgba(123,25,216,0.3)]"
      : "border-transparent bg-[#f3edff] text-[#666d7a] hover:border-[#e5d7ff] hover:bg-white hover:text-[#7b19d8]"
  }`;

const ADMIN_SIDEBAR_SCROLL_KEY = "admin-sidebar-scroll-top";
const SUPPORT_SYSTEM_KEY_PREFIX = "support-room:";

const adminNavSections: Array<{ label: string; items: AdminNavItemConfig[] }> = [
  {
    label: "Vận hành",
    items: [
      { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/admin/users", label: "Người dùng", icon: Users },
      { href: "/admin/support", label: "Hỗ trợ", icon: MessageCircleMore, indicatorKey: "support" },
    ],
  },
  {
    label: "Tăng trưởng",
    items: [
      { href: "/admin/tasks", label: "Nhiệm vụ", icon: ListTodo, indicatorKey: "tasks" },
      { href: "/admin/community", label: "Tố cáo", icon: TriangleAlert, indicatorKey: "community" },
      { href: "/admin/events-promotions", label: "Sự kiện & ưu đãi", icon: Gift },
      { href: "/admin/broadcast-notifications", label: "Broadcast", icon: BellRing },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { href: "/admin/deposits", label: "Quản lý nạp", icon: WalletCards, indicatorKey: "deposits" },
      { href: "/admin/deposit-accounts", label: "TK nhận tiền nạp", icon: Landmark },
      { href: "/admin/bank-accounts", label: "TK ngân hàng user", icon: Landmark, indicatorKey: "bankAccounts" },
      { href: "/admin/withdrawals", label: "Yêu cầu rút", icon: CreditCard, indicatorKey: "withdrawals" },
    ],
  },
  {
    label: "Hệ thống",
    items: [{ href: "/admin/settings", label: "Cài đặt", icon: Settings2 }],
  },
];

export default function AdminShell({
  title,
  subtitle,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  action,
  sidebarActionLabel = "Tạo báo cáo mới",
  onSidebarActionClick,
  showSidebarAction = true,
  children,
}: AdminShellProps) {
  const { user } = useAuthStore();
  const conversations = useChatStore((state) => state.conversations);
  const fetchConversations = useChatStore((state) => state.fetchConversations);
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarNavRef = useRef<HTMLElement | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [navigationIndicators, setNavigationIndicators] = useState<AdminNavigationIndicators>({
    support: 0,
    tasks: 0,
    community: 0,
    deposits: 0,
    withdrawals: 0,
    bankAccounts: 0,
  });
  const liveSupportIndicator = useMemo(
    () =>
      conversations.reduce((total, conversation) => {
        const systemKey = `${conversation.systemKey ?? ""}`.trim();

        if (!systemKey.startsWith(SUPPORT_SYSTEM_KEY_PREFIX)) {
          return total;
        }

        return total + Math.max(0, conversation.unreadCounts?.[user?._id ?? ""] ?? 0);
      }, 0),
    [conversations, user?._id]
  );
  const supportIndicator = liveSupportIndicator > 0 ? liveSupportIndicator : navigationIndicators.support;
  const totalPendingNotifications =
    supportIndicator +
    navigationIndicators.tasks +
    navigationIndicators.community +
    navigationIndicators.deposits +
    navigationIndicators.withdrawals +
    navigationIndicators.bankAccounts;

  const quickAccessItems = useMemo(
    () => [
      { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/admin/users", label: "Người dùng", icon: Users },
      {
        href: "/admin/support",
        label: "Hỗ trợ",
        icon: MessageCircleMore,
        badge: supportIndicator > 0 ? String(supportIndicator) : undefined,
      },
      {
        href: "/admin/tasks",
        label: "Nhiệm vụ",
        icon: ListTodo,
        badge: navigationIndicators.tasks > 0 ? String(navigationIndicators.tasks) : undefined,
      },
      {
        href: "/admin/community",
        label: "Tố cáo",
        icon: TriangleAlert,
        badge: navigationIndicators.community > 0 ? String(navigationIndicators.community) : undefined,
      },
      {
        href: "/admin/deposits",
        label: "Nạp",
        icon: WalletCards,
        badge: navigationIndicators.deposits > 0 ? String(navigationIndicators.deposits) : undefined,
      },
      {
        href: "/admin/withdrawals",
        label: "Rút",
        icon: CreditCard,
        badge: navigationIndicators.withdrawals > 0 ? String(navigationIndicators.withdrawals) : undefined,
      },
      {
        href: "/admin/bank-accounts",
        label: "Ngân hàng user",
        icon: Landmark,
        badge: navigationIndicators.bankAccounts > 0 ? String(navigationIndicators.bankAccounts) : undefined,
      },
    ],
    [
      navigationIndicators.bankAccounts,
      navigationIndicators.community,
      navigationIndicators.deposits,
      navigationIndicators.tasks,
      navigationIndicators.withdrawals,
      supportIndicator,
    ]
  );

  const adminNotificationItems = useMemo(
    () => [
      {
        key: "support",
        label: "Tin nhắn hỗ trợ mới",
        description:
          supportIndicator > 0
            ? `${supportIndicator} tin nhắn hỗ trợ mới cần phản hồi.`
            : "Không có tin nhắn hỗ trợ mới.",
        href: "/admin/support",
        count: supportIndicator,
        icon: MessageCircleMore,
        iconClassName: "bg-[#f3edff] text-[#7b19d8]",
      },
      {
        key: "tasks",
        label: "Bài nộp nhiệm vụ",
        description:
          navigationIndicators.tasks > 0
            ? `${navigationIndicators.tasks} bài nộp nhiệm vụ mới đang chờ duyệt.`
            : "Không có bài nộp nhiệm vụ nào đang chờ duyệt.",
        href: "/admin/tasks",
        count: navigationIndicators.tasks,
        icon: ListTodo,
        iconClassName: "bg-[#eefbf4] text-[#00a46f]",
      },
      {
        key: "community",
        label: "Tố cáo cộng đồng",
        description:
          navigationIndicators.community > 0
            ? `${navigationIndicators.community} tố cáo user mới đang chờ xử lý.`
            : "Không có tố cáo cộng đồng nào đang chờ.",
        href: "/admin/community",
        count: navigationIndicators.community,
        icon: TriangleAlert,
        iconClassName: "bg-[#fff1ec] text-[#d4525d]",
      },
      {
        key: "deposits",
        label: "Yêu cầu nạp tiền",
        description:
          navigationIndicators.deposits > 0
            ? `${navigationIndicators.deposits} giao dịch đang chờ đối soát.`
            : "Không còn giao dịch nào chờ duyệt.",
        href: "/admin/deposits",
        count: navigationIndicators.deposits,
        icon: WalletCards,
        iconClassName: "bg-[#fff0f5] text-[#d8589f]",
      },
      {
        key: "withdrawals",
        label: "Yêu cầu rút tiền",
        description:
          navigationIndicators.withdrawals > 0
            ? `${navigationIndicators.withdrawals} giao dịch đang chờ thanh toán.`
            : "Không còn yêu cầu rút nào đang treo.",
        href: "/admin/withdrawals",
        count: navigationIndicators.withdrawals,
        icon: CreditCard,
        iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      },
      {
        key: "bank-accounts",
        label: "Xác minh tài khoản ngân hàng",
        description:
          navigationIndicators.bankAccounts > 0
            ? `${navigationIndicators.bankAccounts} tài khoản user đang chờ xác minh.`
            : "Không có tài khoản ngân hàng nào cần rà soát.",
        href: "/admin/bank-accounts",
        count: navigationIndicators.bankAccounts,
        icon: Landmark,
        iconClassName: "bg-[#f3edff] text-[#7b19d8]",
      },
    ],
    [
      navigationIndicators.bankAccounts,
      navigationIndicators.community,
      navigationIndicators.deposits,
      navigationIndicators.tasks,
      navigationIndicators.withdrawals,
      supportIndicator,
    ]
  );

  const persistSidebarScroll = () => {
    if (typeof window === "undefined") {
      return;
    }

    const nextScrollTop = sidebarNavRef.current?.scrollTop;

    if (typeof nextScrollTop !== "number") {
      return;
    }

    window.sessionStorage.setItem(ADMIN_SIDEBAR_SCROLL_KEY, String(nextScrollTop));
  };

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sidebarNav = sidebarNavRef.current;

    if (!sidebarNav) {
      return;
    }

    const savedScrollTop = window.sessionStorage.getItem(ADMIN_SIDEBAR_SCROLL_KEY);
    const parsedScrollTop = Number(savedScrollTop);

    if (savedScrollTop && Number.isFinite(parsedScrollTop)) {
      sidebarNav.scrollTop = parsedScrollTop;
      return;
    }

    const activeLink = sidebarNav.querySelector<HTMLElement>('[aria-current="page"]');
    activeLink?.scrollIntoView({ block: "nearest" });
  }, [location.pathname]);

  useEffect(() => {
    setNotificationsOpen(false);
    setHelpOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }

    void fetchConversations();
  }, [fetchConversations, user?.role]);

  useEffect(() => {
    let active = true;

    const syncNavigationIndicators = async () => {
      try {
        const data = await adminService.getNavigationIndicators();

        if (!active) {
          return;
        }

        setNavigationIndicators(data.indicators);
      } catch (error) {
        console.error("Không tải được chỉ báo điều hướng admin", error);

        if (!active) {
          return;
        }

        setNavigationIndicators({
          support: 0,
          tasks: 0,
          community: 0,
          deposits: 0,
          withdrawals: 0,
          bankAccounts: 0,
        });
      }
    };

    const handleWindowFocus = () => {
      void syncNavigationIndicators();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncNavigationIndicators();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncNavigationIndicators();
    }, 30000);

    void syncNavigationIndicators();

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f5ff] text-[#223042]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-hidden border-r border-white/70 bg-[linear-gradient(180deg,#f6f3fd_0%,#f3effa_100%)] lg:flex lg:flex-col">
        <div className="shrink-0 px-8 py-10">
          <BrandLogo
            to="/admin"
            imageClassName="h-14"
            className="inline-flex"
          />
          <p className="mt-1 text-xs font-semibold text-[#9b79cb]">Hệ thống Intelligence</p>
        </div>

        <nav
          ref={sidebarNavRef}
          onScroll={persistSidebarScroll}
          onClickCapture={persistSidebarScroll}
          className="beautiful-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        >
          <div className="space-y-5">
            {adminNavSections.map((section) => (
              <div key={section.label}>
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#9d8abf]">
                  {section.label}
                </p>
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const indicatorCount = item.indicatorKey ? navigationIndicators[item.indicatorKey] : 0;

                    return (
                      <NavLink
                        key={item.href}
                        end={item.href === "/admin"}
                        to={item.href}
                        className={({ isActive }) => getNavLinkClassName(isActive)}
                      >
                        <Icon className="size-4.5" />
                        <span>{item.label}</span>
                        {indicatorCount > 0 ? (
                          <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff4a90] px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {indicatorCount > 99 ? "99+" : indicatorCount}
                          </span>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="shrink-0 space-y-4 p-6">
          {showSidebarAction && onSidebarActionClick ? (
            <button
              type="button"
              onClick={onSidebarActionClick}
              className="auth-premium-gradient auth-soft-shadow flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-bold text-white transition-transform active:scale-[0.98]"
            >
              {sidebarActionLabel}
            </button>
          ) : null}

          <div className="rounded-[1.4rem] bg-white/90 p-4 shadow-[0_20px_45px_-35px_rgba(123,25,216,0.18)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#4e5667]">
              <Sparkles className="size-4 text-[#7b19d8]" />
              Trạng thái vận hành
            </div>
            <div className="mt-3 space-y-2 text-xs font-medium text-[#747b89]">
              <p>Hỗ trợ chưa đọc: {supportIndicator}</p>
              <p>Admin queue: {totalPendingNotifications} mục chờ</p>
              <p>Bài nộp nhiệm vụ chờ duyệt: {navigationIndicators.tasks}</p>
              <p>Tố cáo cộng đồng chờ xử lý: {navigationIndicators.community}</p>
              <p>Nạp chờ duyệt: {navigationIndicators.deposits}</p>
              <p>Rút chờ xử lý: {navigationIndicators.withdrawals}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-72">
        <header className="sticky top-0 z-30 bg-white/74 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 border-b border-[#ece5f7] px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#9fa3b4]" />
              <input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-12 w-full rounded-2xl border-none bg-[#f3edff] pl-11 pr-12 text-sm text-[#223042] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
              />
              {searchValue ? (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8f96a4] transition-colors hover:bg-white hover:text-[#7b19d8]"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-4 sm:gap-5">
              <div className="flex items-center gap-3 text-[#6f7283] sm:gap-4">
                <Popover
                  open={notificationsOpen}
                  onOpenChange={setNotificationsOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="relative transition-colors hover:text-[#7b19d8]"
                      aria-label="Thông báo"
                    >
                      <Bell className="size-4.5" />
                      {totalPendingNotifications > 0 ? (
                        <>
                          <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-[#ff4a90] ring-2 ring-white" />
                          <span className="absolute -right-3 -top-3 flex min-w-5 items-center justify-center rounded-full bg-[#ff4a90] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                            {totalPendingNotifications > 99 ? "99+" : totalPendingNotifications}
                          </span>
                        </>
                      ) : null}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[22rem] rounded-[1.4rem] border-none bg-white p-0 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.35)]"
                  >
                    <div className="border-b border-[#f0ebf8] px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a82c7]">
                            Admin Alerts
                          </p>
                          <h3 className="mt-1 font-auth-headline text-lg font-extrabold tracking-[-0.03em] text-[#2d2f32]">
                            Chuông thông báo
                          </h3>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                            totalPendingNotifications > 0
                              ? "bg-[#fff0f5] text-[#d4525d]"
                              : "bg-[#eefbf4] text-[#00a46f]"
                          }`}
                        >
                          {totalPendingNotifications > 0
                            ? `${totalPendingNotifications} chờ xử lý`
                            : "Đã sạch"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 px-3 py-3">
                      {adminNotificationItems.some((item) => item.count > 0) ? (
                        adminNotificationItems
                          .filter((item) => item.count > 0)
                          .map((item) => {
                            const Icon = item.icon;

                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => {
                                  setNotificationsOpen(false);
                                  navigate(item.href);
                                }}
                                className="flex w-full items-start gap-3 rounded-[1.1rem] px-3 py-3 text-left transition-colors hover:bg-[#faf7ff]"
                              >
                                <div
                                  className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl ${item.iconClassName}`}
                                >
                                  <Icon className="size-4.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-bold text-[#2d2f32]">{item.label}</p>
                                    <span className="rounded-full bg-[#2d1459] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                                      {item.count}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs leading-6 text-[#72798a]">{item.description}</p>
                                </div>
                                <ArrowRight className="mt-1 size-4 shrink-0 text-[#9da2af]" />
                              </button>
                            );
                          })
                      ) : (
                        <div className="px-3 py-8 text-center">
                          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eefbf4] text-[#00a46f]">
                            <Bell className="size-5" />
                          </div>
                          <p className="mt-4 text-sm font-bold text-[#2d2f32]">Không có thông báo mới</p>
                          <p className="mt-2 text-xs leading-6 text-[#7b8190]">
                            Các mục cần xử lý của admin sẽ xuất hiện tại đây khi có giao dịch hoặc hồ sơ chờ duyệt.
                          </p>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={helpOpen}
                  onOpenChange={setHelpOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="transition-colors hover:text-[#7b19d8]"
                      aria-label="Trợ giúp"
                    >
                      <CircleHelp className="size-4.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[22rem] rounded-[1.4rem] border-none bg-white p-0 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.35)]"
                  >
                    <div className="border-b border-[#f0ebf8] px-5 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a82c7]">
                        Admin Help
                      </p>
                      <h3 className="mt-1 font-auth-headline text-lg font-extrabold tracking-[-0.03em] text-[#2d2f32]">
                        Trợ giúp nhanh
                      </h3>
                      <p className="mt-2 text-xs leading-6 text-[#72798a]">
                        Dùng ô tìm kiếm trên cùng để lọc nhanh dữ liệu trong trang hiện tại, còn chuông thông báo để
                        theo dõi các mục đang chờ xử lý.
                      </p>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      <div className="rounded-[1.15rem] bg-[#faf7ff] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7b19d8]">
                          Trọng tâm hôm nay
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-[#4d5565]">
                          <p>Tin hỗ trợ chưa đọc: {supportIndicator}</p>
                          <p>Bài nộp nhiệm vụ chờ duyệt: {navigationIndicators.tasks}</p>
                          <p>Tố cáo cộng đồng chờ xử lý: {navigationIndicators.community}</p>
                          <p>Yêu cầu nạp chờ duyệt: {navigationIndicators.deposits}</p>
                          <p>Yêu cầu rút chờ xử lý: {navigationIndicators.withdrawals}</p>
                          <p>Tài khoản ngân hàng chờ xác minh: {navigationIndicators.bankAccounts}</p>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        {[
                          { label: "Đi tới hỗ trợ", href: "/admin/support" },
                          { label: "Đi tới nhiệm vụ", href: "/admin/tasks" },
                          { label: "Đi tới tố cáo", href: "/admin/community" },
                          { label: "Đi tới quản lý nạp", href: "/admin/deposits" },
                          { label: "Đi tới yêu cầu rút", href: "/admin/withdrawals" },
                          { label: "Đi tới cài đặt hệ thống", href: "/admin/settings" },
                        ].map((item) => (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => {
                              setHelpOpen(false);
                              navigate(item.href);
                            }}
                            className="flex items-center justify-between rounded-2xl bg-[#f5f1fb] px-4 py-3 text-left text-sm font-semibold text-[#2d2f32] transition-colors hover:bg-[#ece4fb]"
                          >
                            <span>{item.label}</span>
                            <ArrowRight className="size-4 text-[#7b19d8]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="hidden h-6 w-px bg-[#e5ddf1] sm:block" />

              <div className="hidden text-right lg:block">
                <p className="text-sm font-bold text-[#2d2f32]">{user?.displayName ?? "Admin Profile"}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#8f96a4]">
                  {user?.role === "admin" ? "Super Admin" : "Admin"}
                </p>
              </div>

              <Avatar className="size-10 ring-2 ring-[#f1dfff]">
                <AvatarImage
                  src={user?.avatarUrl}
                  alt={user?.displayName}
                />
                <AvatarFallback className="bg-gradient-primary text-sm font-bold text-white">
                  {user?.displayName?.charAt(0) ?? "A"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <div className="space-y-8 px-5 py-8 sm:px-8">
          <section className="overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              {quickAccessItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.href}
                    end={item.href === "/admin"}
                    to={item.href}
                    className={({ isActive }) => getQuickLinkClassName(isActive)}
                  >
                    <Icon className="size-4 text-current" />
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff4a90] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="font-auth-headline text-4xl font-extrabold tracking-[-0.05em] text-[#2d2f32]">
                {title}
              </h1>
              <p className="mt-2 text-sm font-medium text-[#6c7281]">{subtitle}</p>
            </div>

            {action}
          </section>

          {children}
        </div>
      </main>
    </div>
  );
}
