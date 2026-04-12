import { userService } from "@/services/userService";
import type {
  UserFinancialSummary,
  UserHomeDailySeriesPoint,
  UserHomeLeaderboardCollection,
  UserHomeLeaderboardEntryCollection,
  UserHomeLeaderboardEntry,
  UserHomeLeaderboardRankCollection,
} from "@/types/finance";
import { useEffect, useState } from "react";

const HOME_OVERVIEW_POLL_INTERVAL_MS = 30_000;
const HOME_SERIES_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const APP_TIMEZONE = "Asia/Saigon";

const appDateKeyFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: APP_TIMEZONE,
});
const shortLabelFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  timeZone: APP_TIMEZONE,
});
const fullLabelFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APP_TIMEZONE,
});

const normalizeWeekdayLabel = (value: string) =>
  value.replace(/\./g, "").replace(/\s+/g, " ").trim();

const getAppDateKey = (date = new Date()) => appDateKeyFormatter.format(date);

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((item) => Number.parseInt(item, 10));

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
};

const buildEmptyDailyPoint = (dateKey: string): UserHomeDailySeriesPoint => {
  const parsedDate = parseDateKey(dateKey) ?? new Date();

  return {
    dateKey,
    shortLabel: normalizeWeekdayLabel(shortLabelFormatter.format(parsedDate)),
    fullLabel: fullLabelFormatter.format(parsedDate),
    topUpAmount: 0,
    earningAmount: 0,
    spendingAmount: 0,
    depositAmount: 0,
    withdrawalAmount: 0,
    netAmount: 0,
  };
};

const getMsUntilNextDay = () => {
  const now = Date.now();
  const currentDateKey = getAppDateKey(new Date(now));
  let low = 1_000;
  let high = DAY_MS + 1_000;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const candidateDateKey = getAppDateKey(new Date(now + mid));

    if (candidateDateKey === currentDateKey) {
      low = mid + 1;
      continue;
    }

    high = mid;
  }

  return Math.max(low, 1_000);
};

const EMPTY_SUMMARY: UserFinancialSummary = {
  currentBalance: 0,
  withdrawableBalance: 0,
  pendingTotal: 0,
  settledTotal: 0,
  approvedDepositTotal: 0,
  approvedWithdrawalTotal: 0,
  todayNetChange: 0,
};

const EMPTY_LEADERBOARDS: UserHomeLeaderboardCollection = {
  daily: [],
  weekly: [],
  monthly: [],
};

const EMPTY_LEADERBOARD_RANKS: UserHomeLeaderboardRankCollection = {
  daily: null,
  weekly: null,
  monthly: null,
};

const EMPTY_LEADERBOARD_ENTRIES: UserHomeLeaderboardEntryCollection = {
  daily: null,
  weekly: null,
  monthly: null,
};

const EMPTY_STATE = {
  summary: EMPTY_SUMMARY,
  approvedRequestCount: 0,
  pendingRequestCount: 0,
  dailySeries: [] as UserHomeDailySeriesPoint[],
  weeklyNetChange: 0,
  previousWeeklyNetChange: 0,
  weeklyGrowthRate: 0,
  weeklyLeaderboard: [] as UserHomeLeaderboardEntry[],
  currentUserWeeklyRank: null as number | null,
  leaderboards: EMPTY_LEADERBOARDS,
  currentUserLeaderboardRanks: EMPTY_LEADERBOARD_RANKS,
  currentUserLeaderboardEntries: EMPTY_LEADERBOARD_ENTRIES,
};

const alignHomeOverviewToCurrentDay = (response: typeof EMPTY_STATE) => {
  const currentDateKey = getAppDateKey();
  const sourceSeries = Array.isArray(response.dailySeries) ? response.dailySeries : [];

  if (!sourceSeries.length) {
    return response;
  }

  const normalizedSeries = [...sourceSeries];
  let latestDateKey = normalizedSeries.at(-1)?.dateKey ?? "";
  let safetyCounter = 0;
  let injectedCurrentDayPoint = false;

  while (latestDateKey && latestDateKey < currentDateKey && safetyCounter < HOME_SERIES_DAYS) {
    const latestDate = parseDateKey(latestDateKey);

    if (!latestDate) {
      return response;
    }

    const nextDate = new Date(latestDate.getTime() + DAY_MS);
    const nextDateKey = getAppDateKey(nextDate);

    normalizedSeries.push(buildEmptyDailyPoint(nextDateKey));
    injectedCurrentDayPoint = injectedCurrentDayPoint || nextDateKey === currentDateKey;
    if (normalizedSeries.length > HOME_SERIES_DAYS) {
      normalizedSeries.shift();
    }

    latestDateKey = nextDateKey;
    safetyCounter += 1;
  }

  if (normalizedSeries.at(-1)?.dateKey !== currentDateKey) {
    return response;
  }

  return {
    ...response,
    summary: {
      ...response.summary,
      todayNetChange: injectedCurrentDayPoint ? 0 : response.summary.todayNetChange,
    },
    dailySeries: normalizedSeries,
    weeklyNetChange: normalizedSeries.reduce(
      (total, point) => total + Number(point.netAmount ?? 0),
      0
    ),
  };
};

export function useUserHomeOverview(accountId?: string | null) {
  const [data, setData] = useState(EMPTY_STATE);

  useEffect(() => {
    if (!accountId) {
      setData(EMPTY_STATE);
      return;
    }

    let active = true;
    let nextDayTimeoutId: number | null = null;

    const syncHomeOverview = async () => {
      try {
        const response = await userService.getHomeOverview();

        if (!active) {
          return;
        }

        setData(
          alignHomeOverviewToCurrentDay({
            ...EMPTY_STATE,
            ...response,
            summary: {
              ...EMPTY_SUMMARY,
              ...(response.summary ?? {}),
            },
            weeklyLeaderboard: response.weeklyLeaderboard ?? EMPTY_STATE.weeklyLeaderboard,
            currentUserWeeklyRank:
              response.currentUserWeeklyRank ?? EMPTY_STATE.currentUserWeeklyRank,
            leaderboards: {
              ...EMPTY_LEADERBOARDS,
              ...(response.leaderboards ?? {}),
            },
            currentUserLeaderboardRanks: {
              ...EMPTY_LEADERBOARD_RANKS,
              ...(response.currentUserLeaderboardRanks ?? {}),
            },
            currentUserLeaderboardEntries: {
              ...EMPTY_LEADERBOARD_ENTRIES,
              ...(response.currentUserLeaderboardEntries ?? {}),
            },
          })
        );
      } catch (error) {
        console.error("Không tải được dữ liệu trang chủ người dùng", error);

        if (!active) {
          return;
        }

        setData(EMPTY_STATE);
      }
    };

    const scheduleNextDaySync = () => {
      if (!active) {
        return;
      }

      nextDayTimeoutId = window.setTimeout(() => {
        void syncHomeOverview();
        scheduleNextDaySync();
      }, getMsUntilNextDay());
    };

    void syncHomeOverview();
    scheduleNextDaySync();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncHomeOverview();
      }
    };

    const handleWindowFocus = () => {
      void syncHomeOverview();
    };

    const intervalId = window.setInterval(() => {
      void syncHomeOverview();
    }, HOME_OVERVIEW_POLL_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      if (nextDayTimeoutId !== null) {
        window.clearTimeout(nextDayTimeoutId);
      }
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accountId]);

  return data;
}
