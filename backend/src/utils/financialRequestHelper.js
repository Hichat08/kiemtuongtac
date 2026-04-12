import DepositRequest from "../models/DepositRequest.js";
import User from "../models/User.js";
import WalletAdjustment from "../models/WalletAdjustment.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import { getFinanceProcessingModeLabel } from "./financeSettingsHelper.js";

const TIMEZONE = "Asia/Saigon";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOME_DASHBOARD_WINDOW_DAYS = 7;
const HOME_LEADERBOARD_LIMIT = 5;
const HOME_LEADERBOARD_PERIODS = ["daily", "weekly", "monthly"];
const ALLOWED_EARNING_ADJUSTMENT_REASON_CODES = new Set([
  "task_submission_reward",
  "community_gift_claim",
  "internal_transfer_in",
]);
const weekdayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  timeZone: TIMEZONE,
});
const dateLabelFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIMEZONE,
});

export const normalizeText = (value) => `${value ?? ""}`.trim();
export const normalizeUpperText = (value) => normalizeText(value).toUpperCase();
export const normalizeCompactText = (value) => normalizeText(value).replace(/\s+/g, "");
export const normalizeDigits = (value) => normalizeText(value).replace(/\D/g, "");

const buildRequestCode = (prefix) => {
  const timestampPart = String(Date.now()).slice(-8);
  const randomPart = String(Math.floor(100 + Math.random() * 900));

  return `${prefix}${timestampPart}${randomPart}`;
};

const resolveUserSnapshot = (request) => ({
  displayName: request.userDisplayName ?? request.userId?.displayName ?? "",
  accountId: request.userAccountId ?? request.userId?.accountId ?? "",
});

const resolveRequestedAt = (request) => {
  const date = request.requestedAt ?? request.createdAt ?? new Date();
  return date instanceof Date ? date : new Date(date);
};

const resolveAppliedNote = (request) => {
  const processedNote = normalizeText(request.processedNote);

  if (processedNote) {
    return processedNote;
  }

  return normalizeText(request.note);
};

const resolveCalendarKey = (date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIMEZONE,
  }).format(date);

const toSafeDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsedDate = new Date(value ?? "");
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const resolveEffectiveApprovedDate = (request) =>
  toSafeDate(request.approvedAt) ??
  toSafeDate(request.processedAt) ??
  toSafeDate(request.requestedAt) ??
  toSafeDate(request.createdAt);

const normalizeWeekdayLabel = (value) => value.replace(/\./g, "").replace(/\s+/g, " ").trim();

const buildRecentDateFrames = (days = HOME_DASHBOARD_WINDOW_DAYS, referenceDate = new Date()) =>
  Array.from({ length: days }, (_, index) => {
    const offset = days - index - 1;
    const date = new Date(referenceDate.getTime() - offset * DAY_MS);

    return {
      dateKey: resolveCalendarKey(date),
      shortLabel: normalizeWeekdayLabel(weekdayFormatter.format(date)),
      fullLabel: dateLabelFormatter.format(date),
    };
  });

const calculateGrowthRate = (currentValue, previousValue) => {
  if (previousValue === 0) {
    if (currentValue === 0) {
      return 0;
    }

    return currentValue > 0 ? 100 : -100;
  }

  return Number((((currentValue - previousValue) / Math.abs(previousValue)) * 100).toFixed(1));
};

const sumSeriesNetAmount = (series) =>
  series.reduce((total, item) => total + Number(item.netAmount ?? 0), 0);
const buildEmptyPeriodNetChangeMap = () =>
  HOME_LEADERBOARD_PERIODS.reduce((result, period) => {
    result[period] = 0;
    return result;
  }, {});
const resolveApprovedDepositAmount = (request) => Number(request.amount ?? 0);
const isAllowedCreditAdjustment = (adjustment) =>
  adjustment.direction === "credit" &&
  ALLOWED_EARNING_ADJUSTMENT_REASON_CODES.has(`${adjustment.reasonCode ?? ""}`);
const buildLeaderboardPeriodMatchers = (referenceDate = new Date()) => {
  const currentDateKey = resolveCalendarKey(referenceDate);
  const activeWeeklyDateKeys = new Set(
    buildRecentDateFrames(HOME_DASHBOARD_WINDOW_DAYS, referenceDate).map((frame) => frame.dateKey)
  );
  const currentMonthKey = currentDateKey.slice(0, 7);

  return {
    daily: (dateKey) => dateKey === currentDateKey,
    weekly: (dateKey) => activeWeeklyDateKeys.has(dateKey),
    monthly: (dateKey) => dateKey.startsWith(currentMonthKey),
  };
};

export const buildDepositRequestCode = () => buildRequestCode("DPT-");
export const buildWithdrawalRequestCode = () => buildRequestCode("WDR-");

export const buildWithdrawalConfirmationCode = (accountId) => {
  const normalizedAccountId = normalizeUpperText(accountId).replace(/^#/, "");
  return `KTTRUT ${normalizedAccountId || "ID00000000"}`;
};

export const serializeDepositRequest = (request) => {
  const requestedAt = resolveRequestedAt(request);
  const snapshot = resolveUserSnapshot(request);

  return {
    id: request.requestCode ?? request._id?.toString?.() ?? "",
    userName: snapshot.displayName,
    userId: snapshot.accountId,
    amount: Number(request.amount ?? 0),
    bonusAmount: 0,
    totalAmount: Number(request.amount ?? 0),
    methodId: request.methodId,
    methodTitle: request.methodTitle,
    bankCode: request.bankCode ?? "",
    bankName: request.bankName,
    accountNumber: request.accountNumber,
    accountHolder: request.accountHolder,
    transferCode: request.transferCode,
    requestedAt,
    status: request.status,
    note: resolveAppliedNote(request),
    createdAtMs: requestedAt.getTime(),
    processedAt: request.processedAt ?? null,
    approvedAt: request.approvedAt ?? null,
    rejectedAt: request.rejectedAt ?? null,
  };
};

export const serializeWithdrawalRequest = (request) => {
  const requestedAt = resolveRequestedAt(request);
  const snapshot = resolveUserSnapshot(request);

  return {
    id: request.requestCode ?? request._id?.toString?.() ?? "",
    userName: snapshot.displayName,
    userId: snapshot.accountId,
    withdrawalType: request.withdrawalType === "internal" ? "internal" : "bank",
    bankName: request.bankName,
    bankCode: request.bankCode ?? "",
    bankAccount: request.bankAccount,
    accountHolder: request.accountHolder,
    branch: request.branch,
    amount: Number(request.amount ?? 0),
    feePercent: Number(request.feePercent ?? 0),
    feeAmount: Number(request.feeAmount ?? 0),
    receivableAmount: Number(request.receivableAmount ?? request.amount ?? 0),
    processingMode: request.processingMode ?? "standard",
    processingModeLabel: getFinanceProcessingModeLabel(request.processingMode ?? "standard"),
    requestedAt,
    status: request.status,
    confirmationCode: request.confirmationCode ?? "",
    note: resolveAppliedNote(request),
    internalRecipientUserId: request.internalRecipientUserId?.toString?.() ?? "",
    internalRecipientAccountId: request.internalRecipientAccountId ?? "",
    internalRecipientDisplayName: request.internalRecipientDisplayName ?? "",
    createdAtMs: requestedAt.getTime(),
    processedAt: request.processedAt ?? null,
    approvedAt: request.approvedAt ?? null,
    rejectedAt: request.rejectedAt ?? null,
  };
};

export const serializeWalletAdjustment = (adjustment) => {
  const effectiveAt =
    toSafeDate(adjustment.effectiveAt) ??
    toSafeDate(adjustment.createdAt) ??
    new Date();

  return {
    id: adjustment._id?.toString?.() ?? "",
    userId: adjustment.userId?.toString?.() ?? "",
    userAccountId: adjustment.userAccountId ?? "",
    userDisplayName: adjustment.userDisplayName ?? "Người dùng",
    direction: adjustment.direction === "credit" ? "credit" : "debit",
    reasonCode: adjustment.reasonCode ?? "fraud_balance_clear",
    reasonLabel: normalizeText(adjustment.reasonLabel),
    amount: Number(adjustment.amount ?? 0),
    note: normalizeText(adjustment.note),
    effectiveAt,
    createdAtMs: effectiveAt.getTime(),
    createdAt: adjustment.createdAt ?? effectiveAt,
  };
};

export const buildFinancialSummary = ({ deposits, withdrawals, adjustments = [] }) => {
  const approvedDepositTotal = deposits.reduce(
    (total, request) => total + (request.status === "approved" ? resolveApprovedDepositAmount(request) : 0),
    0
  );
  const approvedWithdrawalTotal = withdrawals.reduce(
    (total, request) => total + (request.status === "approved" ? Number(request.amount ?? 0) : 0),
    0
  );
  const approvedAdjustmentCreditTotal = adjustments.reduce((total, adjustment) => {
    if (!isAllowedCreditAdjustment(adjustment)) {
      return total;
    }

    return total + Number(adjustment.amount ?? 0);
  }, 0);
  const approvedAdjustmentDebitTotal = adjustments.reduce((total, adjustment) => {
    if (adjustment.direction !== "debit") {
      return total;
    }

    return total + Number(adjustment.amount ?? 0);
  }, 0);
  const pendingWithdrawalTotal = withdrawals.reduce(
    (total, request) => total + (request.status === "pending" ? Number(request.amount ?? 0) : 0),
    0
  );
  const pendingTotal =
    deposits.reduce(
      (total, request) => total + (request.status === "pending" ? Number(request.amount ?? 0) : 0),
      0
    ) +
    pendingWithdrawalTotal;

  const currentBalance = Math.max(
    approvedDepositTotal + approvedAdjustmentCreditTotal - approvedWithdrawalTotal - approvedAdjustmentDebitTotal,
    0
  );
  const withdrawableBalance = Math.max(currentBalance - pendingWithdrawalTotal, 0);
  const settledTotal =
    approvedDepositTotal +
    approvedWithdrawalTotal +
    approvedAdjustmentCreditTotal +
    approvedAdjustmentDebitTotal;
  const todayKey = resolveCalendarKey(new Date());

  const todayApprovedDepositTotal = deposits.reduce((total, request) => {
    if (request.status !== "approved") {
      return total;
    }

    const effectiveDate = request.approvedAt ?? request.processedAt ?? request.requestedAt ?? request.createdAt;

    if (!effectiveDate || resolveCalendarKey(new Date(effectiveDate)) !== todayKey) {
      return total;
    }

    return total + resolveApprovedDepositAmount(request);
  }, 0);

  const todayApprovedWithdrawalTotal = withdrawals.reduce((total, request) => {
    if (request.status !== "approved") {
      return total;
    }

    const effectiveDate = request.approvedAt ?? request.processedAt ?? request.requestedAt ?? request.createdAt;

    if (!effectiveDate || resolveCalendarKey(new Date(effectiveDate)) !== todayKey) {
      return total;
    }

    return total + Number(request.amount ?? 0);
  }, 0);
  const todayAdjustmentNetChange = adjustments.reduce((total, adjustment) => {
    const effectiveDate = adjustment.effectiveAt ?? adjustment.createdAt;

    if (!effectiveDate || resolveCalendarKey(new Date(effectiveDate)) !== todayKey) {
      return total;
    }

    const amount = Number(adjustment.amount ?? 0);
    return total + (adjustment.direction === "credit" ? amount : -amount);
  }, 0);

  return {
    currentBalance,
    withdrawableBalance,
    pendingTotal,
    settledTotal,
    approvedDepositTotal,
    approvedWithdrawalTotal,
    approvedAdjustmentCreditTotal,
    approvedAdjustmentDebitTotal,
    adjustmentCount: adjustments.length,
    todayNetChange: todayApprovedDepositTotal - todayApprovedWithdrawalTotal + todayAdjustmentNetChange,
  };
};

export const buildFinancialRequestCounts = ({ deposits, withdrawals }) => ({
  approvedRequestCount:
    deposits.filter((request) => request.status === "approved").length +
    withdrawals.filter((request) => request.status === "approved").length,
  pendingRequestCount:
    deposits.filter((request) => request.status === "pending").length +
    withdrawals.filter((request) => request.status === "pending").length,
});

export const buildHomeDailySeries = ({
  deposits,
  withdrawals,
  adjustments = [],
  days = HOME_DASHBOARD_WINDOW_DAYS,
  referenceDate = new Date(),
}) => {
  const frames = buildRecentDateFrames(days, referenceDate);
  const seriesMap = new Map(
    frames.map((frame) => [
      frame.dateKey,
      {
        ...frame,
        topUpAmount: 0,
        earningAmount: 0,
        spendingAmount: 0,
        depositAmount: 0,
        withdrawalAmount: 0,
        netAmount: 0,
      },
    ])
  );

  deposits.forEach((request) => {
    if (request.status !== "approved") {
      return;
    }

    const effectiveDate = resolveEffectiveApprovedDate(request);

    if (!effectiveDate) {
      return;
    }

    const bucket = seriesMap.get(resolveCalendarKey(effectiveDate));

    if (!bucket) {
      return;
    }

    const amount = resolveApprovedDepositAmount(request);
    bucket.topUpAmount += amount;
    bucket.depositAmount += amount;
    bucket.netAmount += amount;
  });

  withdrawals.forEach((request) => {
    if (request.status !== "approved") {
      return;
    }

    const effectiveDate = resolveEffectiveApprovedDate(request);

    if (!effectiveDate) {
      return;
    }

    const bucket = seriesMap.get(resolveCalendarKey(effectiveDate));

    if (!bucket) {
      return;
    }

    const amount = Number(request.amount ?? 0);
    bucket.spendingAmount += amount;
    bucket.withdrawalAmount += amount;
    bucket.netAmount -= amount;
  });

  adjustments.forEach((adjustment) => {
    const effectiveDate = toSafeDate(adjustment.effectiveAt) ?? toSafeDate(adjustment.createdAt);

    if (!effectiveDate) {
      return;
    }

    const bucket = seriesMap.get(resolveCalendarKey(effectiveDate));

    if (!bucket) {
      return;
    }

    const amount = Number(adjustment.amount ?? 0);

    if (adjustment.direction === "credit") {
      if (!isAllowedCreditAdjustment(adjustment)) {
        return;
      }

      bucket.earningAmount += amount;
      bucket.depositAmount += amount;
      bucket.netAmount += amount;
      return;
    }

    bucket.spendingAmount += amount;
    bucket.withdrawalAmount += amount;
    bucket.netAmount -= amount;
  });

  return frames.map((frame) => seriesMap.get(frame.dateKey));
};

export const buildHomeGrowthSnapshot = ({
  deposits,
  withdrawals,
  adjustments = [],
  days = HOME_DASHBOARD_WINDOW_DAYS,
  referenceDate = new Date(),
}) => {
  const dailySeries = buildHomeDailySeries({
    deposits,
    withdrawals,
    adjustments,
    days,
    referenceDate,
  });
  const previousDailySeries = buildHomeDailySeries({
    deposits,
    withdrawals,
    adjustments,
    days,
    referenceDate: new Date(referenceDate.getTime() - days * DAY_MS),
  });
  const currentPeriodNetChange = sumSeriesNetAmount(dailySeries);
  const previousPeriodNetChange = sumSeriesNetAmount(previousDailySeries);

  return {
    dailySeries,
    currentPeriodNetChange,
    previousPeriodNetChange,
    weeklyGrowthRate: calculateGrowthRate(currentPeriodNetChange, previousPeriodNetChange),
  };
};

export const buildHomeLeaderboardSnapshots = async ({
  currentUserId,
  referenceDate = new Date(),
  limit = HOME_LEADERBOARD_LIMIT,
}) => {
  const currentUserIdText = currentUserId?.toString?.() ?? `${currentUserId ?? ""}`;
  const periodMatchers = buildLeaderboardPeriodMatchers(referenceDate);

  const [users, approvedDeposits, approvedWithdrawals, approvedAdjustments] = await Promise.all([
    User.find({ role: "user" }).select("_id accountId displayName avatarUrl").lean(),
    DepositRequest.find({ status: "approved" })
      .select("userId userAccountId userDisplayName amount approvedAt processedAt requestedAt createdAt")
      .lean(),
    WithdrawalRequest.find({ status: "approved" })
      .select("userId userAccountId userDisplayName amount approvedAt processedAt requestedAt createdAt")
      .lean(),
    WalletAdjustment.find()
      .select("userId userAccountId userDisplayName amount direction reasonCode effectiveAt createdAt")
      .lean(),
  ]);

  const leaderboardMap = new Map();

  const mergeSnapshot = (entry, snapshot = {}) => {
    if (!entry.accountId && snapshot.accountId) {
      entry.accountId = snapshot.accountId;
    }

    if ((!entry.displayName || entry.displayName === "Người dùng") && snapshot.displayName) {
      entry.displayName = snapshot.displayName;
    }

    if (!entry.avatarUrl && snapshot.avatarUrl) {
      entry.avatarUrl = snapshot.avatarUrl;
    }
  };

  const ensureEntry = (userId, snapshot = {}) => {
    const normalizedUserId = userId?.toString?.() ?? `${userId ?? ""}`;

    if (!normalizedUserId) {
      return null;
    }

    if (!leaderboardMap.has(normalizedUserId)) {
      leaderboardMap.set(normalizedUserId, {
        userId: normalizedUserId,
        accountId: snapshot.accountId ?? "",
        displayName: snapshot.displayName ?? "Người dùng",
        avatarUrl: snapshot.avatarUrl ?? "",
        currentBalance: 0,
        periodNetChangeMap: buildEmptyPeriodNetChangeMap(),
        isCurrentUser: normalizedUserId === currentUserIdText,
      });
    }

    const entry = leaderboardMap.get(normalizedUserId);
    mergeSnapshot(entry, snapshot);
    return entry;
  };
  const applyPeriodNetChange = (entry, effectiveDate, amount) => {
    if (!entry || !effectiveDate) {
      return;
    }

    const activeDateKey = resolveCalendarKey(effectiveDate);
    HOME_LEADERBOARD_PERIODS.forEach((period) => {
      if (periodMatchers[period](activeDateKey)) {
        entry.periodNetChangeMap[period] += amount;
      }
    });
  };

  users.forEach((user) => {
    ensureEntry(user._id, {
      accountId: user.accountId ?? "",
      displayName: user.displayName ?? "Người dùng",
      avatarUrl: user.avatarUrl ?? "",
    });
  });

  approvedDeposits.forEach((request) => {
    const entry = ensureEntry(request.userId, {
      accountId: request.userAccountId ?? "",
      displayName: request.userDisplayName ?? "Người dùng",
    });

    if (!entry) {
      return;
    }

    const amount = resolveApprovedDepositAmount(request);
    entry.currentBalance += amount;
  });

  approvedWithdrawals.forEach((request) => {
    const entry = ensureEntry(request.userId, {
      accountId: request.userAccountId ?? "",
      displayName: request.userDisplayName ?? "Người dùng",
    });

    if (!entry) {
      return;
    }

    const amount = Number(request.amount ?? 0);
    entry.currentBalance -= amount;
  });

  approvedAdjustments.forEach((adjustment) => {
    const entry = ensureEntry(adjustment.userId, {
      accountId: adjustment.userAccountId ?? "",
      displayName: adjustment.userDisplayName ?? "Người dùng",
    });

    if (!entry) {
      return;
    }

    const amount = Number(adjustment.amount ?? 0);

    if (adjustment.direction === "credit") {
      if (!isAllowedCreditAdjustment(adjustment)) {
        return;
      }

      entry.currentBalance += amount;
      const effectiveDate = toSafeDate(adjustment.effectiveAt) ?? toSafeDate(adjustment.createdAt);
      applyPeriodNetChange(entry, effectiveDate, amount);
    } else {
      entry.currentBalance -= amount;
    }
  });

  const rankedEntriesByPeriod = HOME_LEADERBOARD_PERIODS.reduce((result, period) => {
    result[period] = [...leaderboardMap.values()]
      .map((entry) => ({
        userId: entry.userId,
        accountId: entry.accountId,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
        currentBalance: Math.max(entry.currentBalance, 0),
        periodNetChange: Number(entry.periodNetChangeMap?.[period] ?? 0),
        isCurrentUser: entry.isCurrentUser,
      }))
      .filter((entry) => entry.periodNetChange > 0)
      .sort((left, right) => {
        if (right.periodNetChange !== left.periodNetChange) {
          return right.periodNetChange - left.periodNetChange;
        }

        if (right.currentBalance !== left.currentBalance) {
          return right.currentBalance - left.currentBalance;
        }

        return left.displayName.localeCompare(right.displayName, "vi");
      })
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));

    return result;
  }, {});

  return {
    leaderboards: HOME_LEADERBOARD_PERIODS.reduce((result, period) => {
      result[period] = rankedEntriesByPeriod[period].slice(0, limit);
      return result;
    }, {}),
    currentUserLeaderboardRanks: HOME_LEADERBOARD_PERIODS.reduce((result, period) => {
      result[period] =
        rankedEntriesByPeriod[period].find((entry) => entry.userId === currentUserIdText)?.rank ?? null;
      return result;
    }, {}),
    currentUserLeaderboardEntries: HOME_LEADERBOARD_PERIODS.reduce((result, period) => {
      result[period] =
        rankedEntriesByPeriod[period].find((entry) => entry.userId === currentUserIdText) ?? null;
      return result;
    }, {}),
  };
};

export const buildWeeklyLeaderboard = async (options = {}) => {
  const snapshot = await buildHomeLeaderboardSnapshots(options);

  return {
    weeklyLeaderboard: snapshot.leaderboards.weekly,
    currentUserWeeklyRank: snapshot.currentUserLeaderboardRanks.weekly,
    currentUserWeeklyEntry: snapshot.currentUserLeaderboardEntries.weekly,
  };
};

export const getUserFinancialRecords = async (userId) => {
  const [deposits, withdrawals, adjustments] = await Promise.all([
    DepositRequest.find({ userId }).sort({ requestedAt: -1, createdAt: -1 }).lean(),
    WithdrawalRequest.find({ userId }).sort({ requestedAt: -1, createdAt: -1 }).lean(),
    WalletAdjustment.find({ userId }).sort({ effectiveAt: -1, createdAt: -1 }).lean(),
  ]);

  return { deposits, withdrawals, adjustments };
};
