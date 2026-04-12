import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import NotificationCenterDialog from "@/components/profile/NotificationCenterDialog";
import { useUserNotificationSummary } from "@/hooks/useUserNotificationSummary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserHomeOverview } from "@/hooks/useUserHomeOverview";
import { getRoleAccountPath } from "@/lib/role-routing";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { UserHomeLeaderboardEntry, UserHomeLeaderboardPeriod } from "@/types/finance";
import type { TaskCatalogItem } from "@/types/task";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock3,
  Crown,
  ListTodo,
  Minus,
  Share2,
  Trophy,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";

const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const formatSignedCurrency = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatCurrency(Math.abs(value))}`;

const formatCompactCurrency = (value: number) => {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000) {
    return `${value < 0 ? "-" : ""}${(absoluteValue / 1_000_000_000).toFixed(
      absoluteValue >= 10_000_000_000 ? 0 : 1
    )}B`;
  }

  if (absoluteValue >= 1_000_000) {
    return `${value < 0 ? "-" : ""}${(absoluteValue / 1_000_000).toFixed(
      absoluteValue >= 10_000_000 ? 0 : 1
    )}M`;
  }

  if (absoluteValue >= 1_000) {
    return `${value < 0 ? "-" : ""}${(absoluteValue / 1_000).toFixed(
      absoluteValue >= 10_000 ? 0 : 1
    )}k`;
  }

  return `${value < 0 ? "-" : ""}${formatCurrency(absoluteValue)}`;
};

const formatSignedCompactCurrency = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatCompactCurrency(Math.abs(value))}`;

const getChangeTone = (value: number) => {
  if (value > 0) {
    return {
      icon: ArrowUpRight,
      valueClassName: "text-[#00c88b]",
      pillClassName: "bg-[#e7fbf2] text-[#00a46f] dark:bg-[#00c88b]/12 dark:text-[#72f0bc]",
    };
  }

  if (value < 0) {
    return {
      icon: ArrowDownRight,
      valueClassName: "text-[#ff5f7a]",
      pillClassName: "bg-[#fff0f3] text-[#d94d68] dark:bg-[#ff5f7a]/12 dark:text-[#ff9eae]",
    };
  }

  return {
    icon: Minus,
    valueClassName: "text-[#7b19d8] dark:text-[#ff84d1]",
    pillClassName: "bg-[#f3edff] text-[#7b19d8] dark:bg-white/10 dark:text-[#ffb3e5]",
  };
};

const getInitials = (value?: string) => value?.trim().charAt(0).toUpperCase() || "K";

const FEATURED_TASK_LIMIT = 3;
const FEATURED_TASK_REFRESH_TTL_MS = 60_000;

const getTaskPresentation = (platform: TaskCatalogItem["platform"]) => {
  switch (platform) {
    case "facebook":
      return {
        categoryLabel: "Facebook",
        iconClassName: "bg-[#eaf2ff] text-[#1b5fd5]",
        badgeClassName: "bg-[#eaf2ff] text-[#1b5fd5]",
      };
    case "tiktok":
      return {
        categoryLabel: "TikTok",
        iconClassName: "bg-[#fff0f5] text-[#d8589f]",
        badgeClassName: "bg-[#fff0f5] text-[#d8589f]",
      };
    case "youtube":
      return {
        categoryLabel: "YouTube",
        iconClassName: "bg-[#fff1f4] text-[#d4525d]",
        badgeClassName: "bg-[#fff1f4] text-[#d4525d]",
      };
    case "other":
    default:
      return {
        categoryLabel: "Khác",
        iconClassName: "bg-[#f3edff] text-[#7b19d8]",
        badgeClassName: "bg-[#f3edff] text-[#7b19d8]",
      };
  }
};

const getSubmissionMeta = (status?: TaskCatalogItem["submissionStatus"]) => {
  switch (status) {
    case "pending":
      return {
        label: "Chờ duyệt",
        badgeClassName: "bg-[#eefbf4] text-[#006945]",
        buttonClassName: "bg-[#ecfff4] text-[#006945]",
      };
    case "approved":
      return {
        label: "Đã duyệt",
        badgeClassName: "bg-[#f3edff] text-[#7b19d8]",
        buttonClassName: "bg-[#f3edff] text-[#7b19d8]",
      };
    case "rejected":
      return {
        label: "Bị từ chối",
        badgeClassName: "bg-[#fff0f1] text-[#b31b25]",
        buttonClassName: "bg-[#fff0f1] text-[#b31b25]",
      };
    default:
      return null;
  }
};

const getTaskActionLabel = (task: TaskCatalogItem) => {
  const taskStillAcceptingSubmissions = task.status === "running" && task.availableSlots > 0;

  if (task.submissionStatus === "pending") {
    return "Chờ duyệt";
  }

  if (task.submissionStatus === "approved") {
    return "Xem kết quả";
  }

  if (task.submissionStatus === "rejected" && taskStillAcceptingSubmissions) {
    return "Nộp lại";
  }

  if (task.submissionStatus === "rejected") {
    return "Xem chi tiết";
  }

  return task.actionLabel;
};

const getFeaturedTaskPriority = (task: TaskCatalogItem) => {
  let score = 0;

  if (task.submissionStatus) {
    score += 120;
  }

  if (task.hot) {
    score += 90;
  }

  if (task.status === "running") {
    score += 50;
  }

  if (task.availableSlots > 0) {
    score += 25;
  }

  return score;
};

const buildPodiumOrder = (entries: UserHomeLeaderboardEntry[]) => {
  const topEntries = entries.slice(0, 3);
  const rankMap = new Map(topEntries.map((entry) => [entry.rank, entry]));

  return [rankMap.get(2), rankMap.get(1), rankMap.get(3)].filter(
    (entry): entry is UserHomeLeaderboardEntry => Boolean(entry)
  );
};

const LEADERBOARD_PERIOD_OPTIONS: Array<{
  value: UserHomeLeaderboardPeriod;
  label: string;
  summaryLabel: string;
  title: string;
}> = [
  { value: "monthly", label: "Hàng Tháng", summaryLabel: "Tháng này", title: "Bảng xếp hạng tháng" },
  { value: "weekly", label: "Hàng tuần", summaryLabel: "Tuần này", title: "Bảng xếp hạng tuần" },
  { value: "daily", label: "Hàng ngày", summaryLabel: "Hôm nay", title: "Bảng xếp hạng ngày" },
];

const getPodiumAvatarFrame = (rank: number) => {
  if (rank === 1) {
    return {
      haloClassName: "bg-[#ffd659]/24",
      outerFrameClassName:
        "border-[4px] border-[#ffc61b] bg-[#fff5c9] p-[4px] shadow-[0_22px_44px_-24px_rgba(255,198,27,0.7)]",
      innerFrameClassName: "bg-white p-[4px]",
      avatarClassName: "size-20 sm:size-[5.5rem]",
      fallbackClassName: "bg-[#fff7d9] text-base text-[#946f00]",
      iconWrapClassName: "-top-8 size-9 text-[#f0b400]",
      iconClassName: "size-7",
      rankBadgeClassName:
        "size-7 bg-[#ffc61b] text-[13px] text-[#8f6a00] ring-4 ring-white shadow-[0_12px_24px_-18px_rgba(255,198,27,0.9)]",
      cardClassName: "w-32 sm:w-36",
      nameClassName: "text-[1.05rem] font-extrabold text-[#38156f] dark:text-white",
      valueClassName: "mt-1 text-sm font-extrabold text-[#7b19d8] dark:text-[#ff9be1]",
      metaClassName: "mt-1 text-[10px] font-medium text-[#8e72bb] dark:text-white/55",
    };
  }

  if (rank === 2) {
    return {
      haloClassName: "bg-[#d6dfeb]/35",
      outerFrameClassName:
        "border-[3px] border-[#c5cfdb] bg-[#edf2f8] p-[4px] shadow-[0_20px_40px_-28px_rgba(115,134,160,0.6)]",
      innerFrameClassName: "bg-white p-[3px]",
      avatarClassName: "size-14 sm:size-[4.25rem]",
      fallbackClassName: "bg-[#eff3fa] text-sm text-[#5f7089]",
      iconWrapClassName: "-top-6 size-7 text-[#a9b4c5]",
      iconClassName: "size-5",
      rankBadgeClassName:
        "size-6 bg-[#dde4ee] text-[11px] text-[#60718b] ring-4 ring-white shadow-[0_10px_22px_-18px_rgba(96,113,139,0.8)]",
      cardClassName: "w-24 sm:w-28",
      nameClassName: "text-sm font-extrabold text-[#45246f] dark:text-white/95",
      valueClassName: "mt-1 text-[12px] font-bold text-[#7b19d8] dark:text-[#ff9be1]",
      metaClassName: "mt-1 text-[10px] text-[#9f86c6] dark:text-white/50",
    };
  }

  return {
    haloClassName: "bg-[#ffd7bb]/28",
    outerFrameClassName:
      "border-[3px] border-[#ff9147] bg-[#fff1e7] p-[4px] shadow-[0_20px_40px_-28px_rgba(255,145,71,0.65)]",
    innerFrameClassName: "bg-white p-[3px]",
    avatarClassName: "size-14 sm:size-[4.25rem]",
    fallbackClassName: "bg-[#fff4eb] text-sm text-[#bc6d34]",
    iconWrapClassName: "-top-6 size-7 text-[#ff7a21]",
    iconClassName: "size-5",
    rankBadgeClassName:
      "size-6 bg-[#ff9147] text-[11px] text-white ring-4 ring-white shadow-[0_10px_22px_-18px_rgba(255,145,71,0.9)]",
    cardClassName: "w-24 sm:w-28",
    nameClassName: "text-sm font-extrabold text-[#45246f] dark:text-white/95",
    valueClassName: "mt-1 text-[12px] font-bold text-[#7b19d8] dark:text-[#ff9be1]",
    metaClassName: "mt-1 text-[10px] text-[#9f86c6] dark:text-white/50",
  };
};

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { unreadCount } = useUserNotificationSummary();
  const [tasks, setTasks] = useState<TaskCatalogItem[]>([]);
  const [loadingFeaturedTasks, setLoadingFeaturedTasks] = useState(true);
  const [taskLoadFailed, setTaskLoadFailed] = useState(false);
  const featuredTasksLastSyncedAtRef = useRef(0);
  const featuredTasksRequestRef = useRef<Promise<void> | null>(null);
  const {
    summary,
    approvedRequestCount,
    pendingRequestCount,
    dailySeries,
    leaderboards,
    currentUserLeaderboardEntries,
  } = useUserHomeOverview(user?.accountId);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<UserHomeLeaderboardPeriod>("weekly");
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  useEffect(() => {
    if (!user?.accountId) {
      setTasks([]);
      setLoadingFeaturedTasks(false);
      setTaskLoadFailed(false);
      featuredTasksLastSyncedAtRef.current = 0;
      featuredTasksRequestRef.current = null;
      return;
    }

    let active = true;
    featuredTasksLastSyncedAtRef.current = 0;
    featuredTasksRequestRef.current = null;

    const syncTasks = async (force = false) => {
      const isFresh =
        featuredTasksLastSyncedAtRef.current > 0 &&
        Date.now() - featuredTasksLastSyncedAtRef.current < FEATURED_TASK_REFRESH_TTL_MS;

      if (!force && isFresh) {
        return;
      }

      if (featuredTasksRequestRef.current) {
        return featuredTasksRequestRef.current;
      }

      const shouldShowLoading = featuredTasksLastSyncedAtRef.current === 0;

      if (active && shouldShowLoading) {
        setLoadingFeaturedTasks(true);
        setTaskLoadFailed(false);
      }

      featuredTasksRequestRef.current = (async () => {
        try {
          const response = await userService.getTasks();

          if (!active) {
            return;
          }

          featuredTasksLastSyncedAtRef.current = Date.now();
          setTasks(response.tasks);
          setTaskLoadFailed(false);
        } catch (error) {
          console.error("Không tải được nhiệm vụ nổi bật cho trang chủ", error);

          if (!active) {
            return;
          }

          if (featuredTasksLastSyncedAtRef.current === 0) {
            setTasks([]);
          }

          setTaskLoadFailed(true);
        } finally {
          featuredTasksRequestRef.current = null;

          if (active && shouldShowLoading) {
            setLoadingFeaturedTasks(false);
          }
        }
      })();

      return featuredTasksRequestRef.current;
    };

    void syncTasks(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncTasks();
      }
    };

    const handleWindowFocus = () => {
      void syncTasks();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.accountId]);

  const chartSeries = dailySeries;
  const changeTone = getChangeTone(summary.todayNetChange);
  const hasCashflowActivity = useMemo(
    () =>
      chartSeries.some(
        (point) =>
          Number(point.topUpAmount ?? 0) > 0 ||
          Number(point.earningAmount ?? 0) > 0 ||
          Number(point.spendingAmount ?? 0) > 0
      ),
    [chartSeries]
  );
  const maxCashflowMagnitude = useMemo(
    () =>
      Math.max(
        ...chartSeries.flatMap((point) => [
          Number(point.topUpAmount ?? 0),
          Number(point.earningAmount ?? 0),
          Number(point.spendingAmount ?? 0),
        ]),
        1
      ),
    [chartSeries]
  );
  const highlightedChartIndex = chartSeries.length ? chartSeries.length - 1 : -1;
  const activeLeaderboard = useMemo(
    () => leaderboards?.[leaderboardPeriod] ?? [],
    [leaderboardPeriod, leaderboards]
  );
  const activeLeaderboardSummaryLabel = useMemo(
    () =>
      LEADERBOARD_PERIOD_OPTIONS.find((option) => option.value === leaderboardPeriod)?.summaryLabel ??
      "Tuần này",
    [leaderboardPeriod]
  );
  const activeLeaderboardTitle = useMemo(
    () =>
      LEADERBOARD_PERIOD_OPTIONS.find((option) => option.value === leaderboardPeriod)?.title ??
      "Bảng xếp hạng tuần",
    [leaderboardPeriod]
  );
  const podiumEntries = useMemo(() => buildPodiumOrder(activeLeaderboard), [activeLeaderboard]);
  const leaderboardRows = useMemo(
    () => activeLeaderboard.filter((entry) => entry.rank > 3).slice(0, 4),
    [activeLeaderboard]
  );
  const currentUserLeaderboardEntry = useMemo(
    () => currentUserLeaderboardEntries?.[leaderboardPeriod] ?? null,
    [currentUserLeaderboardEntries, leaderboardPeriod]
  );
  const featuredTasks = useMemo(
    () =>
      tasks
        .filter((task) =>
          task.submissionStatus ? true : task.status === "running" && task.availableSlots > 0
        )
        .sort((left, right) => {
          const priorityGap = getFeaturedTaskPriority(right) - getFeaturedTaskPriority(left);

          if (priorityGap !== 0) {
            return priorityGap;
          }

          if (right.reward !== left.reward) {
            return right.reward - left.reward;
          }

          return right.availableSlots - left.availableSlots;
        })
        .slice(0, FEATURED_TASK_LIMIT),
    [tasks]
  );

  if (user?.role === "admin") {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  return (
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.18),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
        <div className="pointer-events-none absolute right-[-6rem] top-28 h-56 w-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/35" />
        <div className="pointer-events-none absolute left-[-5rem] top-60 h-48 w-48 rounded-full bg-[#d8cbff]/85 blur-3xl dark:bg-[#ff66c7]/15" />

        <header className="sticky top-0 z-30">
          <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white text-[#7b19d8] shadow-[0_18px_35px_-24px_rgba(123,25,216,0.55)] dark:bg-white/10 dark:text-[#ff8fd6]">
                <Wallet className="size-4.5" />
              </div>
              <div>
                <p className="font-auth-headline text-lg font-extrabold tracking-tight text-[#2d1459] dark:text-white">
                  Kiếm Tương Tác
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9b79cb] dark:text-[#d9b7ff]">
                  {user?.displayName ?? "Người dùng"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotificationCenterOpen(true)}
                className="relative flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] backdrop-blur-xl transition-transform duration-200 active:scale-95 dark:bg-white/10 dark:text-slate-100"
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

              <button
                type="button"
                onClick={() => navigate(getRoleAccountPath(user?.role))}
                className="rounded-full ring-2 ring-white/70 transition-transform duration-200 active:scale-95"
                aria-label="Mở hồ sơ"
              >
                <Avatar className="size-10 shadow-[0_16px_34px_-20px_rgba(123,25,216,0.5)]">
                  <AvatarImage
                    src={user?.avatarUrl}
                    alt={user?.displayName}
                  />
                  <AvatarFallback className="bg-gradient-primary text-sm font-bold text-white">
                    {getInitials(user?.displayName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>
        </header>

        <main className="mobile-page-shell flex min-h-screen flex-col pb-32 pt-2 sm:pb-40 sm:pt-3">
          <section className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold tracking-wide text-[#8d7baf] dark:text-[#baa2de]">
                Số dư hiện tại
              </p>
              <h1 className="mobile-fluid-display font-auth-headline font-extrabold tracking-tight text-slate-900 dark:text-white">
                {formatCurrency(summary.currentBalance)}{" "}
                <span className="text-xl text-[#00c88b] sm:text-2xl">VND</span>
              </h1>
            </div>

            <div className="rounded-[1.55rem] bg-white/88 p-4 shadow-[0_24px_60px_-38px_rgba(123,25,216,0.42)] backdrop-blur-2xl dark:bg-white/8 sm:rounded-[1.8rem] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#7b19d8] dark:text-[#ff84d1]">
                    Dòng tiền 7 ngày
                  </p>
                  <p className="text-[12px] leading-5 text-[#7e73a0] dark:text-[#c8b5e8]">
                    Biểu đồ giữ 7 ngày gần nhất, chip bên phải là biến động của hôm nay.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-[11px] ${changeTone.pillClassName}`}
                >
                  <changeTone.icon className="size-3.5 sm:size-4" />
                  Hôm nay {formatSignedCompactCurrency(summary.todayNetChange)}
                </span>
              </div>

              {hasCashflowActivity ? (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[#8d7baf] dark:text-[#baa2de]">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfff4] px-2.5 py-1 text-[#008c5d]">
                      <span className="size-1.5 rounded-full bg-[#00b67d]" />
                      Kiếm hoặc nhận
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-2.5 py-1 text-[#1b5fd5]">
                      <span className="size-1.5 rounded-full bg-[#4f8dff]" />
                      Nạp thêm
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0f3] px-2.5 py-1 text-[#d94d68]">
                      <span className="size-1.5 rounded-full bg-[#ff5f7a]" />
                      Chi ra
                    </span>
                  </div>

                  <div className="relative mt-4 h-32">
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#ece6fb] dark:bg-white/10" />

                    <div className="grid h-full grid-cols-7 gap-1.5">
                      {chartSeries.map((point, index) => {
                        const topUpAmount = Number(point.topUpAmount ?? 0);
                        const earningAmount = Number(point.earningAmount ?? 0);
                        const spendingAmount = Number(point.spendingAmount ?? 0);
                        const hasDayActivity =
                          topUpAmount > 0 || earningAmount > 0 || spendingAmount > 0;
                        const topUpHeight =
                          topUpAmount > 0
                            ? Math.max(10, Math.round((topUpAmount / maxCashflowMagnitude) * 52))
                            : 0;
                        const earningHeight =
                          earningAmount > 0
                            ? Math.max(10, Math.round((earningAmount / maxCashflowMagnitude) * 52))
                            : 0;
                        const spendingHeight =
                          spendingAmount > 0
                            ? Math.max(10, Math.round((spendingAmount / maxCashflowMagnitude) * 52))
                            : 0;
                        const isHighlighted = index === highlightedChartIndex;
                        const netLabelClassName =
                          point.netAmount > 0
                            ? "top-0 -translate-y-1/2 bg-[#e7fbf2] text-[#008c5d]"
                            : point.netAmount < 0
                              ? "bottom-0 translate-y-1/2 bg-[#fff0f3] text-[#d94d68]"
                              : "top-0 -translate-y-1/2 bg-[#f3edff] text-[#7b19d8]";

                        return (
                          <div
                            key={point.dateKey}
                            className="flex min-w-0 flex-col items-center justify-end gap-2"
                          >
                            <div className="relative h-24 w-full">
                              {isHighlighted && hasDayActivity ? (
                                <span
                                  className={`absolute left-1/2 z-10 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)] ${netLabelClassName}`}
                                >
                                  {formatSignedCompactCurrency(point.netAmount)}
                                </span>
                              ) : null}

                              <div className="absolute inset-x-0 top-0 flex h-[calc(50%-3px)] items-end justify-center gap-1">
                                {earningHeight > 0 ? (
                                  <div
                                    className={`w-[30%] rounded-t-[0.8rem] ${
                                      isHighlighted
                                        ? "bg-gradient-to-t from-[#00b67d] to-[#7cf0be]"
                                        : "bg-gradient-to-t from-[#8de6bf] to-[#dff9ee] dark:from-[#00c88b]/36 dark:to-[#72f0bc]/10"
                                    }`}
                                    style={{ height: `${earningHeight}px` }}
                                  />
                                ) : null}

                                {topUpHeight > 0 ? (
                                  <div
                                    className={`w-[30%] rounded-t-[0.8rem] ${
                                      isHighlighted
                                        ? "bg-gradient-to-t from-[#2f6bff] to-[#8db5ff]"
                                        : "bg-gradient-to-t from-[#a9c8ff] to-[#e7f0ff] dark:from-[#4f8dff]/38 dark:to-[#9fbfff]/10"
                                    }`}
                                    style={{ height: `${topUpHeight}px` }}
                                  />
                                ) : null}

                                {!hasDayActivity ? (
                                  <div className="mb-1 h-1.5 w-[72%] rounded-full bg-[#ece6fb] dark:bg-white/10" />
                                ) : null}
                              </div>

                              <div className="absolute inset-x-0 bottom-0 flex h-[calc(50%-3px)] items-start justify-center">
                                {spendingHeight > 0 ? (
                                  <div
                                    className={`w-[68%] rounded-b-[0.8rem] ${
                                      isHighlighted
                                        ? "bg-gradient-to-b from-[#ff5f7a] to-[#ffc4cf]"
                                        : "bg-gradient-to-b from-[#ffc4cf] to-[#ffe8ed] dark:from-[#ff5f7a]/28 dark:to-[#ff9eae]/10"
                                    }`}
                                    style={{ height: `${spendingHeight}px` }}
                                  />
                                ) : null}
                              </div>
                            </div>

                            <div className="space-y-0.5 text-center">
                              <p className="text-[10px] font-semibold text-[#7e73a0] dark:text-[#c8b5e8]">
                                {point.shortLabel}
                              </p>
                              <p className="text-[9px] text-[#aa9bc7] dark:text-[#9e89c4]">
                                {point.fullLabel}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="mt-4 rounded-[1.1rem] bg-[#f7f3ff] px-4 py-5 text-center text-sm leading-6 text-[#8d7baf] dark:bg-white/6 dark:text-[#baa2de]">
                  Chưa có dòng tiền nào trong 7 ngày gần nhất để dựng biểu đồ kiếm, nạp và chi tiêu.
                </div>
              )}
            </div>
          </section>

          <section className="mt-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:mt-8 sm:gap-4">
            <div className="min-[360px]:col-span-2 flex items-center justify-between rounded-[1.7rem] bg-white/88 p-4 shadow-[0_24px_60px_-38px_rgba(123,25,216,0.42)] backdrop-blur-2xl dark:bg-white/8 sm:rounded-[2rem] sm:p-5">
              <div className="space-y-1">
                <p className="text-sm text-[#8d7baf] dark:text-[#baa2de]">Biến động hôm nay</p>
                <p
                  className={`text-2xl font-extrabold tracking-tight sm:text-3xl ${changeTone.valueClassName}`}
                >
                  {formatSignedCurrency(summary.todayNetChange)} VND
                </p>
              </div>
              <div
                className={`flex size-10 items-center justify-center rounded-xl sm:size-12 sm:rounded-2xl ${changeTone.pillClassName}`}
              >
                <changeTone.icon className="size-4.5 sm:size-5" />
              </div>
            </div>

            <div className="space-y-2.5 rounded-[1.6rem] bg-[#f2effa] p-4 dark:bg-white/6 sm:rounded-[2rem] sm:p-5">
              <CheckCircle2 className="size-4.5 text-[#49a7ff] sm:size-5" />
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {approvedRequestCount}
                </p>
                <p className="text-xs font-semibold text-[#8d7baf] dark:text-[#baa2de]">
                  Giao dịch đã duyệt
                </p>
              </div>
            </div>

            <div className="space-y-2.5 rounded-[1.6rem] bg-[#f2effa] p-4 dark:bg-white/6 sm:rounded-[2rem] sm:p-5">
              <Clock3 className="size-4.5 text-[#7b19d8] dark:text-[#ff84d1] sm:size-5" />
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {pendingRequestCount}
                </p>
                <p className="text-xs font-semibold text-[#8d7baf] dark:text-[#baa2de]">
                  Yêu cầu chờ duyệt
                </p>
                <p className="mt-1 text-[11px] text-[#9c8bbd] dark:text-[#bfa8e4]">
                  {formatCompactCurrency(summary.pendingTotal)} VND đang chờ
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 space-y-4 sm:mt-10 sm:space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-auth-headline text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Nhiệm vụ nổi bật
              </h2>
              <Link
                to="/tasks"
                className="text-sm font-bold text-[#7b19d8] dark:text-[#ff84d1]"
              >
                Xem tất cả
              </Link>
            </div>

            {loadingFeaturedTasks ? (
              <div className="rounded-[1.6rem] bg-white/88 px-5 py-8 text-center text-sm font-medium text-[#8d7baf] shadow-[0_20px_55px_-40px_rgba(123,25,216,0.42)] dark:bg-white/8 dark:text-[#baa2de]">
                Đang tải nhiệm vụ nổi bật...
              </div>
            ) : featuredTasks.length ? (
              <div className="space-y-3 sm:space-y-4">
                {featuredTasks.map((task) => {
                  const presentation = getTaskPresentation(task.platform);
                  const submissionMeta = getSubmissionMeta(task.submissionStatus);
                  const actionLabel = getTaskActionLabel(task);

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                      className="relative w-full overflow-hidden rounded-[1.6rem] bg-white/88 p-4 text-left shadow-[0_20px_55px_-40px_rgba(123,25,216,0.42)] backdrop-blur-2xl transition-transform duration-200 active:scale-[0.99] dark:bg-white/8 sm:p-5"
                    >
                      {task.hot ? (
                        <div className="absolute right-0 top-0 rounded-bl-2xl bg-[#ffe8f0] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d63252] dark:bg-[#ff4a90]/18 dark:text-[#ff9cc5]">
                          Hot Task
                        </div>
                      ) : null}

                      <div className="flex items-start gap-3">
                        <div
                          className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${presentation.iconClassName}`}
                        >
                          <Share2 className="size-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-[#9b92ac] dark:text-[#cbb9e7]">
                                {task.brand}
                              </p>
                              <h3 className="mt-1 line-clamp-2 font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                                {task.title}
                              </h3>
                            </div>

                            <div className="shrink-0 rounded-full bg-[#f3edff] px-3 py-1 text-xs font-bold text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]">
                              {formatCurrency(task.reward)}đ
                            </div>
                          </div>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#7f7692] dark:text-[#cbb9e7]">
                            {task.description}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${presentation.badgeClassName}`}
                            >
                              {presentation.categoryLabel}
                            </span>
                            {submissionMeta ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${submissionMeta.badgeClassName}`}
                              >
                                {submissionMeta.label}
                              </span>
                            ) : null}
                            <span className="text-xs font-medium text-[#8d84a1] dark:text-[#bdaaD6]">
                              Còn {task.availableSlots} slot
                            </span>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-[#9b92ac] dark:text-[#cbb9e7]">
                              <ListTodo className="size-4" />
                              <span>
                                {task.current}/{task.target} lượt hoàn thành
                              </span>
                            </div>

                            <span
                              className={`rounded-full px-4 py-2 text-[13px] font-bold ${
                                submissionMeta
                                  ? submissionMeta.buttonClassName
                                  : "bg-gradient-primary text-white shadow-[0_16px_30px_-20px_rgba(123,25,216,0.6)]"
                              }`}
                            >
                              {actionLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1.6rem] bg-white/88 px-5 py-8 text-center shadow-[0_20px_55px_-40px_rgba(123,25,216,0.42)] dark:bg-white/8">
                <h3 className="font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                  {taskLoadFailed ? "Không tải được nhiệm vụ" : "Chưa có nhiệm vụ khả dụng"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#8d7baf] dark:text-[#baa2de]">
                  {taskLoadFailed
                    ? "Dữ liệu nhiệm vụ tạm thời chưa đồng bộ. Bạn có thể mở trang nhiệm vụ để thử tải lại."
                    : "Hiện chưa có task nào đang chạy hoặc còn slot phù hợp để hiển thị trên trang chủ."}
                </p>
              </div>
            )}
          </section>
          <section className="relative mt-8 overflow-hidden rounded-[1.9rem] border border-[#efe1ff] bg-[linear-gradient(180deg,#ffffff_0%,#fcf8ff_100%)] px-4 py-5 text-slate-900 shadow-[0_28px_70px_-42px_rgba(123,25,216,0.24)] sm:mt-10 sm:rounded-[2.2rem] sm:px-5 sm:py-6 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(35,16,61,0.96)_0%,rgba(21,14,36,0.98)_100%)] dark:text-white">
            <div className="absolute right-[-1.5rem] top-[-1.75rem] h-32 w-32 rounded-full bg-[#f4d4ff] blur-3xl dark:bg-[#7b19d8]/28" />
            <div className="absolute left-[-2rem] bottom-[-2rem] h-32 w-32 rounded-full bg-[#ffe0f4] blur-3xl dark:bg-[#ff66c7]/18" />
            <div className="relative z-10">
              <div className="text-center">
                <h2 className="font-auth-headline text-xl font-extrabold text-[#38156f] sm:text-2xl dark:text-white">
                  {activeLeaderboardTitle}
                </h2>
                <p className="mt-1.5 text-sm text-[#8d7baf] dark:text-white/70">
                  Những tài khoản kiếm tốt nhất trong {activeLeaderboardSummaryLabel.toLowerCase()}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold">
                  {LEADERBOARD_PERIOD_OPTIONS.map((option) => {
                    const isActive = option.value === leaderboardPeriod;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setLeaderboardPeriod(option.value)}
                        className={`rounded-full px-3 py-1.5 transition-colors ${
                          isActive
                            ? "bg-[#f3edff] text-[#7b19d8] dark:bg-white/12 dark:text-[#ffb3e5]"
                            : "bg-[#fff0fa] text-[#c15ba8] dark:bg-white/8 dark:text-white/55"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeLeaderboard.length ? (
                <>
                  <div className="mt-7 flex items-end justify-center gap-3 sm:gap-4">
                    {podiumEntries.map((entry) => {
                      const isChampion = entry.rank === 1;
                      const avatarFrame = getPodiumAvatarFrame(entry.rank);
                      const TopIcon = isChampion ? Crown : Trophy;

                      return (
                        <div
                          key={entry.userId}
                          className={`flex flex-col items-center text-center ${
                            isChampion ? "" : "pt-5"
                          }`}
                        >
                          <div className="relative">
                            <div
                              className={`absolute inset-[-0.45rem] rounded-full blur-md ${avatarFrame.haloClassName}`}
                            />
                            <div
                              className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center justify-center ${avatarFrame.iconWrapClassName}`}
                            >
                              <TopIcon className={avatarFrame.iconClassName} strokeWidth={2.2} />
                            </div>
                            <div
                              className={`relative rounded-full ${avatarFrame.outerFrameClassName}`}
                            >
                              <div
                                className={`rounded-full ${avatarFrame.innerFrameClassName}`}
                              >
                                <Avatar className={avatarFrame.avatarClassName}>
                                  <AvatarImage
                                    src={entry.avatarUrl}
                                    alt={entry.displayName}
                                  />
                                  <AvatarFallback
                                    className={`font-bold ${avatarFrame.fallbackClassName}`}
                                  >
                                    {getInitials(entry.displayName)}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            </div>

                            <div
                              className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-auth-headline font-extrabold ${avatarFrame.rankBadgeClassName}`}
                            >
                              {entry.rank}
                            </div>
                          </div>

                          <div className={`mt-3 ${avatarFrame.cardClassName}`}>
                            <p className={`truncate ${avatarFrame.nameClassName}`}>
                              {entry.displayName}
                            </p>
                            <p className={avatarFrame.valueClassName}>
                              {formatSignedCompactCurrency(entry.periodNetChange)}
                            </p>
                            <p className={`truncate ${avatarFrame.metaClassName}`}>
                              {entry.accountId ? `ID ${entry.accountId}` : activeLeaderboardSummaryLabel}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {leaderboardRows.length ? (
                    <div className="mt-7 overflow-hidden rounded-[1.45rem] border border-[#f0e4ff] bg-white shadow-[0_22px_60px_-38px_rgba(123,25,216,0.18)] dark:border-white/10 dark:bg-white/5">
                      <div className="grid grid-cols-[28px_minmax(0,1.7fr)_92px_92px] items-center gap-2 px-4 py-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#baa2de] dark:text-white/45">
                        <span className="text-center">#</span>
                        <span>Tài khoản</span>
                        <span className="text-center">{activeLeaderboardSummaryLabel}</span>
                        <span className="text-right">Số dư</span>
                      </div>

                      {leaderboardRows.map((entry) => {
                        return (
                          <div
                            key={entry.userId}
                            className="grid grid-cols-[28px_minmax(0,1.7fr)_92px_92px] items-center gap-2 border-t border-[#f7efff] px-4 py-3.5 dark:border-white/8"
                          >
                            <span className="text-center text-base font-extrabold text-[#7b19d8] dark:text-[#ffb3e5]">
                              {entry.rank}
                            </span>

                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="size-10 border border-[#efe1ff] bg-[#fcf6ff] dark:border-white/10 dark:bg-white/8">
                                <AvatarImage src={entry.avatarUrl} alt={entry.displayName} />
                                <AvatarFallback className="bg-[#f3edff] text-sm font-bold text-[#7b19d8] dark:bg-white/12 dark:text-[#ffb3e5]">
                                  {getInitials(entry.displayName)}
                                </AvatarFallback>
                              </Avatar>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-extrabold text-[#3c1c6c] dark:text-white">
                                  {entry.displayName}
                                </p>
                                <p className="truncate text-[11px] text-[#9b86c1] dark:text-white/55">
                                  {entry.accountId ? `ID ${entry.accountId}` : "Tài khoản hệ thống"}
                                </p>
                              </div>
                            </div>

                            <div className="text-center">
                              <span className="inline-flex rounded-full bg-[#f3edff] px-2.5 py-1 text-[11px] font-bold text-[#7b19d8] dark:bg-white/10 dark:text-[#ffb3e5]">
                                {formatSignedCompactCurrency(entry.periodNetChange)}
                              </span>
                            </div>

                            <div className="text-right text-sm font-extrabold text-[#3c1c6c] dark:text-white">
                              {formatCompactCurrency(entry.currentBalance)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {currentUserLeaderboardEntry ? (
                    <div className="mt-5 flex items-center gap-3 rounded-[1.3rem] bg-gradient-primary px-4 py-3.5 text-white shadow-[0_20px_48px_-28px_rgba(123,25,216,0.52)]">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[0.95rem] bg-white/16">
                        <span className="text-[10px] font-bold tracking-[0.12em] text-white/80">
                          HẠNG
                        </span>
                        <span className="font-auth-headline text-2xl font-extrabold leading-none">
                          {currentUserLeaderboardEntry.rank}
                        </span>
                      </div>

                      <Avatar className="size-10 shrink-0 border-2 border-white/35">
                        <AvatarImage
                          src={currentUserLeaderboardEntry.avatarUrl}
                          alt={currentUserLeaderboardEntry.displayName}
                        />
                        <AvatarFallback className="bg-white/20 text-sm font-bold text-white">
                          {getInitials(currentUserLeaderboardEntry.displayName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">
                          {currentUserLeaderboardEntry.isCurrentUser
                            ? `Bạn (${currentUserLeaderboardEntry.displayName})`
                            : currentUserLeaderboardEntry.displayName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/80">
                          <span>
                            {currentUserLeaderboardEntry.accountId
                              ? `ID ${currentUserLeaderboardEntry.accountId}`
                              : "Tài khoản của bạn"}
                          </span>
                          <span>
                            {activeLeaderboardSummaryLabel}{" "}
                            {formatSignedCompactCurrency(currentUserLeaderboardEntry.periodNetChange)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-bold">
                        {formatSignedCompactCurrency(currentUserLeaderboardEntry.periodNetChange)}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-5 rounded-[1.4rem] bg-[#f7f1ff] px-4 py-6 text-center text-sm leading-6 text-[#8d7baf] dark:bg-white/6 dark:text-white/72 sm:mt-7">
                  Chưa có tài khoản nào kiếm được tiền trong {activeLeaderboardSummaryLabel.toLowerCase()}.
                </div>
              )}
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
    </>
  );
};

export default HomePage;
