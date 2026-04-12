import BankAccount from "../models/BankAccount.js";
import AdminDepositAccount from "../models/AdminDepositAccount.js";
import Conversation from "../models/Conversation.js";
import CommunityUserReport from "../models/CommunityUserReport.js";
import EmailVerification from "../models/EmailVerification.js";
import FriendRequest from "../models/FriendRequest.js";
import Message from "../models/Message.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import DepositRequest from "../models/DepositRequest.js";
import TaskSubmission from "../models/TaskSubmission.js";
import WalletAdjustment from "../models/WalletAdjustment.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import { findSupportedBank } from "../constants/supportedBanks.js";
import {
  queueModerationStatusEmail,
  queueWalletAdjustmentEmail,
} from "../services/userNotificationService.js";
import { buildFinancialSummary, getUserFinancialRecords } from "../utils/financialRequestHelper.js";
import { io } from "../socket/index.js";

const TIMEZONE = "Asia/Saigon";
const ACTIVE_USER_WINDOW_DAYS = 30;
const NON_ADMIN_QUERY = { role: { $ne: "admin" } };
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TIMEZONE_OFFSET_MINUTES = 7 * 60;
const ALLOWED_WALLET_CREDIT_REASON_CODES = [
  "task_submission_reward",
  "community_gift_claim",
  "internal_transfer_in",
];

const formatDayLabel = (date) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    timeZone: TIMEZONE,
  }).format(date);
const formatDateKey = (date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
};
const parseDateKey = (value) => {
  const [year, month, day] = `${value}`.split("-").map((item) => Number.parseInt(item, 10));

  return { year, month, day };
};
const getDateKeyOffset = (dateKey, offsetDays) => {
  const { year, month, day } = parseDateKey(dateKey);
  const shiftedDate = new Date(Date.UTC(year, month - 1, day + offsetDays));

  return shiftedDate.toISOString().slice(0, 10);
};
const getDateFromKey = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);
const getStartOfTodayInTimezone = (date = new Date()) => {
  const { year, month, day } = parseDateKey(formatDateKey(date));

  return new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - TIMEZONE_OFFSET_MINUTES * 60 * 1000
  );
};
const buildGrowthDaily = (growthMap, todayKey) =>
  Array.from({ length: 7 }, (_, index) => {
    const dateKey = getDateKeyOffset(todayKey, index - 6);

    return {
      date: dateKey,
      label: formatDayLabel(getDateFromKey(dateKey)),
      count: growthMap.get(dateKey) ?? 0,
    };
  });
const buildGrowthWeekly = (growthMap, todayKey) =>
  Array.from({ length: 4 }, (_, index) => {
    const startKey = getDateKeyOffset(todayKey, -27 + index * 7);
    const count = Array.from({ length: 7 }, (_, dayOffset) =>
      growthMap.get(getDateKeyOffset(startKey, dayOffset)) ?? 0
    ).reduce((total, value) => total + value, 0);

    return {
      date: startKey,
      label: `Tuần ${index + 1}`,
      count,
    };
  });

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildUserSearchQuery = (search) => {
  if (!search) {
    return null;
  }

  const regex = new RegExp(escapeRegex(search), "i");

  return {
    $or: [{ displayName: regex }, { email: regex }, { username: regex }, { accountId: regex }],
  };
};

const buildAccountScopeQuery = (status) => {
  if (status === "admin") {
    return { role: "admin" };
  }

  return NON_ADMIN_QUERY;
};

const buildUserStatusQuery = (status, activityThreshold) => {
  switch (status) {
    case "active":
      return {
        emailVerified: true,
        lastLoginAt: { $gte: activityThreshold },
      };
    case "pending":
      return {
        emailVerified: false,
      };
    default:
      return null;
  }
};

const sumAmount = async (Model, amountField, match = {}) => {
  const [result] = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: `$${amountField}` },
      },
    },
  ]);

  return result?.total ?? 0;
};

const calculateUserCurrentBalances = async (userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return new Map();
  }

  const [approvedDepositTotals, approvedWithdrawalTotals, adjustmentTotals] = await Promise.all([
    DepositRequest.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$userId",
          total: { $sum: "$amount" },
        },
      },
    ]),
    WithdrawalRequest.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$userId",
          total: { $sum: "$amount" },
        },
      },
    ]),
    WalletAdjustment.aggregate([
      {
        $match: {
          userId: { $in: userIds },
        },
      },
      {
        $group: {
          _id: "$userId",
          creditTotal: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$direction", "credit"] },
                    { $in: ["$reasonCode", ALLOWED_WALLET_CREDIT_REASON_CODES] },
                  ],
                },
                "$amount",
                0,
              ],
            },
          },
          debitTotal: {
            $sum: {
              $cond: [{ $eq: ["$direction", "debit"] }, "$amount", 0],
            },
          },
        },
      },
    ]),
  ]);

  const balanceByUserId = new Map(userIds.map((userId) => [userId.toString(), 0]));

  approvedDepositTotals.forEach((entry) => {
    balanceByUserId.set(
      entry._id.toString(),
      (balanceByUserId.get(entry._id.toString()) ?? 0) + Number(entry.total ?? 0)
    );
  });

  approvedWithdrawalTotals.forEach((entry) => {
    balanceByUserId.set(
      entry._id.toString(),
      (balanceByUserId.get(entry._id.toString()) ?? 0) - Number(entry.total ?? 0)
    );
  });

  adjustmentTotals.forEach((entry) => {
    balanceByUserId.set(
      entry._id.toString(),
      (balanceByUserId.get(entry._id.toString()) ?? 0) +
        Number(entry.creditTotal ?? 0) -
        Number(entry.debitTotal ?? 0)
    );
  });

  return new Map(
    [...balanceByUserId.entries()].map(([userId, balance]) => [userId, Math.max(Number(balance ?? 0), 0)])
  );
};

const calculateTotalCirculatingBalance = async () => {
  const nonAdminUsers = await User.find(NON_ADMIN_QUERY).select("_id").lean();
  const balanceByUserId = await calculateUserCurrentBalances(nonAdminUsers.map((user) => user._id));

  return [...balanceByUserId.values()].reduce((total, balance) => total + balance, 0);
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

const ensureUsersHaveAccountIds = async (users, selectFields = "") => {
  const normalizedUsers = [...users];

  await Promise.all(
    normalizedUsers.map(async (user, index) => {
      if (user?.accountId || !user?._id) {
        return;
      }

      const userDoc = await User.findById(user._id).select(selectFields);

      if (!userDoc) {
        return;
      }

      if (!userDoc.accountId) {
        await userDoc.ensureAccountId();
        await userDoc.save();
      }

      normalizedUsers[index] = userDoc.toObject();
    })
  );

  return normalizedUsers;
};

const serializeUser = (user) => ({
  _id: user._id.toString(),
  accountId: user.accountId ?? "",
  displayName: user.displayName,
  email: user.email,
  username: user.username ?? "",
  role: user.role,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
  avatarUrl: user.avatarUrl ?? "",
  phone: user.phone ?? "",
  bio: user.bio ?? "",
  authProviders: Array.isArray(user.authProviders) ? user.authProviders : [],
  moderationStatus: user.moderationStatus ?? "active",
  restoreModerationStatus: user.restoreModerationStatus ?? "active",
  warningCount: user.warningCount ?? 0,
  moderationNote: user.moderationNote ?? "",
  lastWarnedAt: user.lastWarnedAt,
  lockedAt: user.lockedAt,
  communityChatStatus: user.communityChatStatus ?? "active",
  communityChatModerationNote: user.communityChatModerationNote ?? "",
  communityChatLockedAt: user.communityChatLockedAt ?? null,
});

const serializeReportUserSummary = (user, fallback = {}) => ({
  id: user?._id?.toString?.() ?? fallback.id ?? "",
  accountId: user?.accountId ?? fallback.accountId ?? "",
  displayName: user?.displayName ?? fallback.displayName ?? "Thành viên cộng đồng",
  avatarUrl: user?.avatarUrl ?? null,
  role: user?.role ?? "user",
  moderationStatus: user?.moderationStatus ?? "active",
  communityChatStatus: user?.communityChatStatus ?? "active",
  communityChatLockedAt: user?.communityChatLockedAt ?? null,
});

const serializeCommunityUserReport = (report) => ({
  id: report._id.toString(),
  reporter: serializeReportUserSummary(report.reporterId, {
    accountId: report.reporterAccountId,
    displayName: report.reporterDisplayName,
  }),
  targetUser: serializeReportUserSummary(report.targetUserId, {
    accountId: report.targetAccountId,
    displayName: report.targetDisplayName,
  }),
  conversationId: report.conversationId?.toString?.() ?? "",
  conversationLabel: report.conversationLabel ?? "Cộng đồng",
  messageId: report.messageId?.toString?.() ?? null,
  latestMessageExcerpt: report.latestMessageExcerpt ?? "",
  category: report.category,
  description: report.description ?? "",
  status: report.status ?? "pending",
  reviewedAt: report.reviewedAt ?? null,
  reviewedBy: report.reviewedBy
    ? {
        id: report.reviewedBy._id?.toString?.() ?? "",
        displayName: report.reviewedBy.displayName ?? "Admin",
        avatarUrl: report.reviewedBy.avatarUrl ?? null,
      }
    : null,
  reviewNote: report.reviewNote ?? "",
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
});

const buildCommunityChatStatusPayload = (user) => ({
  userId: user._id.toString(),
  status: user.communityChatStatus ?? "active",
  lockedAt: user.communityChatLockedAt ?? null,
  note: user.communityChatModerationNote ?? "",
});

const serializeBankAccount = (account) => ({
  id: account._id.toString(),
  userId: account.userId?._id?.toString() ?? "",
  customerName: account.userId?.displayName ?? "",
  customerEmail: account.userId?.email ?? "",
  customerCode: account.userId?.accountId ?? "",
  bankName: account.bankName,
  bankCode: account.bankCode ?? "",
  accountNumber: account.accountNumber,
  accountHolder: account.accountHolder,
  branch: account.branch,
  status: account.status,
  restoreStatus: account.restoreStatus,
  primary: account.primary,
  linkedPhone: account.linkedPhone ?? "",
  identityNumber: account.identityNumber ?? "",
  swiftCode: account.swiftCode ?? "",
  province: account.province ?? "",
  address: account.address ?? "",
  note: account.note ?? "",
  verificationNote: account.verificationNote ?? "",
  linkedAt: account.createdAt,
  submittedAt: account.submittedAt ?? account.createdAt,
  updatedAt: account.updatedAt,
});

const normalizeText = (value) => `${value ?? ""}`.trim();
const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const serializeAdminDepositAccount = (account) => ({
  id: account._id.toString(),
  label: account.label,
  bankCode: account.bankCode ?? "",
  bankName: account.bankName,
  accountNumber: account.accountNumber,
  accountHolder: account.accountHolder,
  branch: account.branch,
  status: account.status === "paused" ? "paused" : "active",
  isPrimary: Boolean(account.isPrimary),
  note: account.note ?? "",
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
});

const serializeAdminWalletSummary = ({ deposits, withdrawals, adjustments }) => {
  const summary = buildFinancialSummary({ deposits, withdrawals, adjustments });
  const lastAdjustment = adjustments[0] ?? null;

  return {
    currentBalance: summary.currentBalance,
    withdrawableBalance: summary.withdrawableBalance,
    pendingTotal: summary.pendingTotal,
    approvedDepositTotal: summary.approvedDepositTotal,
    approvedWithdrawalTotal: summary.approvedWithdrawalTotal,
    approvedAdjustmentDebitTotal: summary.approvedAdjustmentDebitTotal,
    adjustmentCount: summary.adjustmentCount,
    lastAdjustedAt: lastAdjustment?.effectiveAt ?? lastAdjustment?.createdAt ?? null,
  };
};

const sortAdminDepositAccounts = (accounts) =>
  [...accounts].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    if (left.status !== right.status) {
      return left.status === "active" ? -1 : 1;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

const buildAdminDepositAccountSummary = (accounts) => {
  const activeCount = accounts.filter((account) => account.status === "active").length;
  const pausedCount = accounts.filter((account) => account.status === "paused").length;
  const primaryAccount = accounts.find(
    (account) => account.isPrimary && account.status === "active"
  );

  return {
    total: accounts.length,
    activeCount,
    pausedCount,
    primaryLabel: primaryAccount?.label ?? "Chưa có",
  };
};

const reconcileAdminDepositAccounts = async () => {
  const accounts = await AdminDepositAccount.find().sort({ createdAt: 1, updatedAt: -1 });

  if (!accounts.length) {
    return [];
  }

  let activeAccount = accounts.find((account) => account.status === "active") ?? null;

  if (!activeAccount) {
    accounts[0].status = "active";
    activeAccount = accounts[0];
  }

  const primaryAccount =
    accounts.find((account) => account.status === "active" && account.isPrimary) ?? activeAccount;

  await Promise.all(
    accounts.map(async (account) => {
      const shouldBePrimary = account._id.equals(primaryAccount._id);

      if (account.isPrimary !== shouldBePrimary) {
        account.isPrimary = shouldBePrimary;
      }

      if (shouldBePrimary && account.status !== "active") {
        account.status = "active";
      }

      if (account.isModified()) {
        await account.save();
      }
    })
  );

  return sortAdminDepositAccounts(accounts.map((account) => account.toObject()));
};

export const getAdminOverview = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = getStartOfTodayInTimezone(now);
    const growthWindowStartDate = new Date(startOfToday.getTime() - 27 * MS_PER_DAY);
    const todayKey = formatDateKey(now);

    const [
      totalUsers,
      totalAdmins,
      verifiedUsers,
      activeSessions,
      pendingEmailVerifications,
      totalConversations,
      totalMessages,
      pendingFriendRequests,
      newUsersToday,
      totalDepositAmount,
      approvedDepositRequests,
      pendingDepositRequests,
      totalWithdrawalAmount,
      approvedWithdrawalRequests,
      pendingWithdrawalRequests,
      totalCirculatingBalance,
      recentUsers,
      latestSignIns,
      growthRows,
    ] = await Promise.all([
      User.countDocuments(NON_ADMIN_QUERY),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ ...NON_ADMIN_QUERY, emailVerified: true }),
      Session.countDocuments({ expiresAt: { $gt: now } }),
      EmailVerification.countDocuments({
        purpose: "signup",
        expiresAt: { $gt: now },
      }),
      Conversation.countDocuments(),
      Message.countDocuments(),
      FriendRequest.countDocuments(),
      User.countDocuments({ ...NON_ADMIN_QUERY, createdAt: { $gte: startOfToday } }),
      sumAmount(DepositRequest, "amount", { status: "approved" }),
      DepositRequest.countDocuments({ status: "approved" }),
      DepositRequest.countDocuments({ status: "pending" }),
      sumAmount(WithdrawalRequest, "amount", { status: "approved" }),
      WithdrawalRequest.countDocuments({ status: "approved" }),
      WithdrawalRequest.countDocuments({ status: "pending" }),
      calculateTotalCirculatingBalance(),
      User.find(NON_ADMIN_QUERY)
        .sort({ createdAt: -1 })
        .limit(8)
        .select(
          "_id accountId displayName email username role emailVerified createdAt avatarUrl"
        )
        .lean(),
      User.find({ ...NON_ADMIN_QUERY, lastLoginAt: { $ne: null } })
        .sort({ lastLoginAt: -1 })
        .limit(6)
        .select("_id accountId displayName email role lastLoginAt avatarUrl")
        .lean(),
      User.aggregate([
        {
          $match: {
            ...NON_ADMIN_QUERY,
            createdAt: { $gte: growthWindowStartDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: TIMEZONE,
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const growthMap = new Map(growthRows.map((row) => [row._id, row.count]));
    const growthDaily = buildGrowthDaily(growthMap, todayKey);
    const growthWeekly = buildGrowthWeekly(growthMap, todayKey);

    return res.status(200).json({
      summary: {
        totalUsers,
        totalAdmins,
        verifiedUsers,
        activeSessions,
        pendingEmailVerifications,
        totalConversations,
        totalMessages,
        pendingFriendRequests,
        newUsersToday,
        totalCirculatingBalance,
        totalDepositAmount,
        approvedDepositRequests,
        pendingDepositRequests,
        totalWithdrawalAmount,
        approvedWithdrawalRequests,
        pendingWithdrawalRequests,
      },
      growth: growthDaily,
      growthDaily,
      growthWeekly,
      recentUsers,
      latestSignIns,
      currentAdmin: {
        _id: req.user._id,
        displayName: req.user.displayName,
        email: req.user.email,
        role: req.user.role,
        accountId: req.user.accountId,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy overview admin", error);
    return res.status(500).json({ message: "Không thể tải dữ liệu admin." });
  }
};

export const getAdminNavigationIndicators = async (req, res) => {
  try {
    const adminUserId = req.user?._id?.toString?.() ?? "";
    const [
      pendingDepositRequests,
      pendingWithdrawalRequests,
      pendingBankAccounts,
      pendingTaskSubmissions,
      pendingCommunityReports,
      supportConversations,
    ] =
      await Promise.all([
        DepositRequest.countDocuments({ status: "pending" }),
        WithdrawalRequest.countDocuments({ status: "pending" }),
        BankAccount.countDocuments({ status: "pending" }),
        TaskSubmission.countDocuments({ status: "pending" }),
        CommunityUserReport.countDocuments({ status: "pending" }),
        Conversation.find({
          systemKey: new RegExp("^support-room:"),
        })
          .select("unreadCounts")
          .lean(),
      ]);

    const supportUnreadCount = supportConversations.reduce((total, conversation) => {
      const unreadCount = Number(conversation?.unreadCounts?.[adminUserId] ?? 0);
      return total + Math.max(0, unreadCount);
    }, 0);

    return res.status(200).json({
      indicators: {
        support: supportUnreadCount,
        tasks: pendingTaskSubmissions,
        community: pendingCommunityReports,
        deposits: pendingDepositRequests,
        withdrawals: pendingWithdrawalRequests,
        bankAccounts: pendingBankAccounts,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy chỉ báo điều hướng admin", error);
    return res.status(500).json({ message: "Không thể tải chỉ báo điều hướng admin." });
  }
};

export const getAdminCommunityReports = async (req, res) => {
  try {
    const reports = await CommunityUserReport.find()
      .sort({ createdAt: -1, updatedAt: -1 })
      .populate({
        path: "reporterId",
        select: "accountId displayName avatarUrl role moderationStatus communityChatStatus communityChatLockedAt",
      })
      .populate({
        path: "targetUserId",
        select: "accountId displayName avatarUrl role moderationStatus communityChatStatus communityChatLockedAt",
      })
      .populate({
        path: "reviewedBy",
        select: "displayName avatarUrl",
      });

    const summary = reports.reduce(
      (totals, report) => {
        totals.total += 1;

        if (report.status === "in_review") {
          totals.inReview += 1;
        } else if (report.status === "resolved") {
          totals.resolved += 1;
        } else if (report.status === "dismissed") {
          totals.dismissed += 1;
        } else {
          totals.pending += 1;
        }

        return totals;
      },
      {
        total: 0,
        pending: 0,
        inReview: 0,
        resolved: 0,
        dismissed: 0,
      }
    );

    return res.status(200).json({
      summary,
      reports: reports.map(serializeCommunityUserReport),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tố cáo cộng đồng", error);
    return res.status(500).json({ message: "Không thể tải danh sách tố cáo cộng đồng." });
  }
};

export const updateAdminCommunityReportStatus = async (req, res) => {
  try {
    const { status, reviewNote } = req.body ?? {};
    const normalizedStatus = `${status ?? ""}`.trim();
    const normalizedReviewNote = `${reviewNote ?? ""}`.trim().slice(0, 500);

    if (!["in_review", "resolved", "dismissed"].includes(normalizedStatus)) {
      return res.status(400).json({ message: "Trạng thái xử lý tố cáo không hợp lệ." });
    }

    const report = await CommunityUserReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: "Không tìm thấy tố cáo cần cập nhật." });
    }

    report.status = normalizedStatus;
    report.reviewNote = normalizedReviewNote;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();

    await report.save();
    await report.populate([
      {
        path: "reporterId",
        select: "accountId displayName avatarUrl role moderationStatus communityChatStatus communityChatLockedAt",
      },
      {
        path: "targetUserId",
        select: "accountId displayName avatarUrl role moderationStatus communityChatStatus communityChatLockedAt",
      },
      {
        path: "reviewedBy",
        select: "displayName avatarUrl",
      },
    ]);

    return res.status(200).json({
      message: "Đã cập nhật trạng thái tố cáo.",
      report: serializeCommunityUserReport(report),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái tố cáo cộng đồng", error);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái tố cáo." });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const activityThreshold = new Date(now);
    activityThreshold.setDate(activityThreshold.getDate() - ACTIVE_USER_WINDOW_DAYS);

    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 10), 20);
    const search = `${req.query.search ?? ""}`.trim();
    const status = ["active", "pending"].includes(req.query.status)
      ? req.query.status
      : "all";

    const scopeQuery = buildAccountScopeQuery(status);
    const searchQuery = buildUserSearchQuery(search);
    const statusQuery = buildUserStatusQuery(status, activityThreshold);
    const conditions = [scopeQuery, searchQuery, statusQuery].filter(Boolean);
    const query = conditions.length > 0 ? { $and: conditions } : {};

    const [totalUsers, newUsersToday, activeUsers, pendingUsers, totalAdmins, totalItems, users] =
      await Promise.all([
        User.countDocuments(NON_ADMIN_QUERY),
        User.countDocuments({ ...NON_ADMIN_QUERY, createdAt: { $gte: startOfToday } }),
        User.countDocuments({
          ...NON_ADMIN_QUERY,
          emailVerified: true,
          lastLoginAt: { $gte: activityThreshold },
        }),
        User.countDocuments({ ...NON_ADMIN_QUERY, emailVerified: false }),
        User.countDocuments({ role: "admin" }),
        User.countDocuments(query),
        User.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select(
            "_id accountId displayName email username role emailVerified createdAt updatedAt lastLoginAt avatarUrl moderationStatus restoreModerationStatus warningCount moderationNote lastWarnedAt lockedAt communityChatStatus communityChatModerationNote communityChatLockedAt"
          )
          .lean(),
      ]);
    const usersWithAccountIds = await ensureUsersHaveAccountIds(
      users,
      "_id accountId displayName email username role emailVerified createdAt updatedAt lastLoginAt avatarUrl moderationStatus restoreModerationStatus warningCount moderationNote lastWarnedAt lockedAt communityChatStatus communityChatModerationNote communityChatLockedAt"
    );

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      summary: {
        totalUsers,
        newUsersToday,
        activeUsers,
        pendingUsers,
        totalAdmins,
      },
      filters: {
        search,
        status,
      },
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      users: usersWithAccountIds.map(serializeUser),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người dùng admin", error);
    return res.status(500).json({ message: "Không thể tải danh sách người dùng." });
  }
};

export const getAdminUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select(
        "_id accountId displayName email username role emailVerified createdAt updatedAt lastLoginAt avatarUrl phone bio authProviders moderationStatus restoreModerationStatus warningCount moderationNote lastWarnedAt lockedAt communityChatStatus communityChatModerationNote communityChatLockedAt"
      )
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const [userWithAccountId] = await ensureUsersHaveAccountIds(
      [user],
      "_id accountId displayName email username role emailVerified createdAt updatedAt lastLoginAt avatarUrl phone bio authProviders moderationStatus restoreModerationStatus warningCount moderationNote lastWarnedAt lockedAt communityChatStatus communityChatModerationNote communityChatLockedAt"
    );

    const [total, verified, pending, locked, walletRecords] = await Promise.all([
      BankAccount.countDocuments({ userId: user._id }),
      BankAccount.countDocuments({ userId: user._id, status: "verified" }),
      BankAccount.countDocuments({ userId: user._id, status: "pending" }),
      BankAccount.countDocuments({ userId: user._id, status: "locked" }),
      getUserFinancialRecords(user._id),
    ]);

    return res.status(200).json({
      user: serializeUser(userWithAccountId),
      bankAccountsSummary: {
        total,
        verified,
        pending,
        locked,
      },
      walletSummary: serializeAdminWalletSummary(walletRecords),
    });
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết người dùng admin", error);
    return res.status(500).json({ message: "Không thể tải chi tiết người dùng." });
  }
};

export const updateAdminUserModeration = async (req, res) => {
  try {
    const { action, note } = req.body ?? {};
    const moderationNote = `${note ?? ""}`.trim();

    if (!moderationNote) {
      return res.status(400).json({
        message: "Vui lòng nhập lý do moderation trước khi cập nhật trạng thái người dùng.",
      });
    }

    const user = await User.findById(req.params.id).select(
      "_id accountId displayName email username role emailVerified createdAt updatedAt lastLoginAt avatarUrl phone bio authProviders moderationStatus restoreModerationStatus warningCount moderationNote lastWarnedAt lockedAt communityChatStatus communityChatModerationNote communityChatLockedAt"
    );

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Không thể cảnh cáo hoặc khóa tài khoản admin." });
    }

    switch (action) {
      case "warn":
        user.warningCount = (user.warningCount ?? 0) + 1;
        user.lastWarnedAt = new Date();
        user.restoreModerationStatus = "warned";
        if (user.moderationStatus !== "locked") {
          user.moderationStatus = "warned";
        }
        user.moderationNote = moderationNote;
        break;
      case "lock":
        if (user.moderationStatus !== "locked") {
          user.restoreModerationStatus = user.moderationStatus === "warned" ? "warned" : "active";
        }
        user.moderationStatus = "locked";
        user.lockedAt = new Date();
        user.moderationNote = moderationNote;
        await Session.deleteMany({ userId: user._id });
        break;
      case "unlock":
        if (user.moderationStatus !== "locked") {
          return res.status(400).json({ message: "Tài khoản này hiện không bị khóa." });
        }
        user.moderationStatus =
          user.restoreModerationStatus ?? (user.warningCount > 0 ? "warned" : "active");
        user.lockedAt = null;
        user.moderationNote = moderationNote;
        break;
      case "clear":
        if (user.moderationStatus !== "warned") {
          return res.status(400).json({ message: "Tài khoản này hiện không ở trạng thái cảnh cáo." });
        }
        user.moderationStatus = "active";
        user.restoreModerationStatus = "active";
        user.moderationNote = moderationNote;
        break;
      default:
        return res.status(400).json({ message: "Hành động moderation không hợp lệ." });
    }

    await user.save();
    queueModerationStatusEmail({
      user: user.toObject(),
      action,
      note: moderationNote,
    });

    return res.status(200).json({
      message: "Đã cập nhật trạng thái người dùng.",
      user: serializeUser(user.toObject()),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái người dùng", error);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái người dùng." });
  }
};

export const updateAdminUserCommunityChat = async (req, res) => {
  try {
    const { action, note } = req.body ?? {};
    const normalizedAction = `${action ?? ""}`.trim();
    const communityChatNote = `${note ?? ""}`.trim().slice(0, 500);

    if (!["lock", "unlock"].includes(normalizedAction)) {
      return res.status(400).json({ message: "Hành động chat cộng đồng không hợp lệ." });
    }

    const user = await User.findById(req.params.id).select(
      "_id accountId displayName email username role emailVerified createdAt updatedAt lastLoginAt avatarUrl phone bio authProviders moderationStatus restoreModerationStatus warningCount moderationNote lastWarnedAt lockedAt communityChatStatus communityChatModerationNote communityChatLockedAt"
    );

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Không thể khóa chat cộng đồng của tài khoản admin." });
    }

    if (normalizedAction === "lock") {
      user.communityChatStatus = "locked";
      user.communityChatLockedAt = new Date();
      user.communityChatModerationNote = communityChatNote;
    } else {
      user.communityChatStatus = "active";
      user.communityChatLockedAt = null;
      user.communityChatModerationNote = communityChatNote;
    }

    await user.save();

    io.to(user._id.toString()).emit(
      "community-chat-status-changed",
      buildCommunityChatStatusPayload(user)
    );

    return res.status(200).json({
      message:
        normalizedAction === "lock"
          ? "Đã khóa chat cộng đồng của người dùng."
          : "Đã mở lại chat cộng đồng cho người dùng.",
      user: serializeUser(user.toObject()),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật quyền chat cộng đồng", error);
    return res.status(500).json({ message: "Không thể cập nhật quyền chat cộng đồng." });
  }
};

export const clearAdminUserWalletBalance = async (req, res) => {
  try {
    const note = normalizeText(req.body?.note);

    if (!note) {
      return res.status(400).json({
        message: "Vui lòng nhập lý do xoá số dư ví để lưu vào lịch sử kiểm soát gian lận.",
      });
    }

    const user = await User.findById(req.params.id).select("_id accountId displayName role");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Không thể xoá số dư ví của tài khoản admin." });
    }

    if (!user.accountId) {
      await user.ensureAccountId();
      await user.save();
    }

    const walletRecords = await getUserFinancialRecords(user._id);
    const walletSummary = buildFinancialSummary(walletRecords);

    if (walletSummary.currentBalance <= 0) {
      return res.status(400).json({ message: "Ví người dùng hiện không còn số dư để xoá." });
    }

    const adjustment = await WalletAdjustment.create({
      userId: user._id,
      userAccountId: user.accountId ?? "",
      userDisplayName: user.displayName ?? "Người dùng",
      direction: "debit",
      reasonCode: "fraud_balance_clear",
      reasonLabel: "Admin xoá số dư ví do nghi ngờ gian lận.",
      amount: walletSummary.currentBalance,
      note,
      effectiveAt: new Date(),
      createdBy: req.user?._id ?? null,
    });
    queueWalletAdjustmentEmail({ adjustment, user });

    const updatedWalletRecords = await getUserFinancialRecords(user._id);

    return res.status(201).json({
      message: "Đã xoá toàn bộ số dư ví của người dùng.",
      adjustment: {
        id: adjustment._id.toString(),
        amount: Number(adjustment.amount ?? 0),
        note: adjustment.note ?? "",
        reasonCode: adjustment.reasonCode,
        reasonLabel: adjustment.reasonLabel,
        effectiveAt: adjustment.effectiveAt ?? adjustment.createdAt,
      },
      walletSummary: serializeAdminWalletSummary(updatedWalletRecords),
    });
  } catch (error) {
    console.error("Lỗi khi xoá số dư ví của người dùng", error);
    return res.status(500).json({ message: "Không thể xoá số dư ví của người dùng." });
  }
};

export const getAdminBankAccounts = async (req, res) => {
  try {
    const [accounts, total, verified, pending, locked, primary] = await Promise.all([
      BankAccount.find()
        .populate("userId", "displayName email accountId")
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
      BankAccount.countDocuments(),
      BankAccount.countDocuments({ status: "verified" }),
      BankAccount.countDocuments({ status: "pending" }),
      BankAccount.countDocuments({ status: "locked" }),
      BankAccount.countDocuments({ primary: true }),
    ]);

    return res.status(200).json({
      summary: {
        total,
        verified,
        pending,
        locked,
        primary,
      },
      accounts: accounts.map(serializeBankAccount),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tài khoản ngân hàng admin", error);
    return res.status(500).json({ message: "Không thể tải danh sách tài khoản ngân hàng." });
  }
};

export const updateAdminBankAccountStatus = async (req, res) => {
  try {
    const { action, verificationNote } = req.body ?? {};
    const normalizedVerificationNote = `${verificationNote ?? ""}`.trim();
    const account = await BankAccount.findById(req.params.id).populate(
      "userId",
      "displayName email accountId"
    );

    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản ngân hàng." });
    }

    if (!normalizedVerificationNote) {
      return res.status(400).json({
        message: "Vui lòng nhập lý do trước khi cập nhật trạng thái tài khoản ngân hàng.",
      });
    }

    switch (action) {
      case "verify":
        account.status = "verified";
        account.restoreStatus = "verified";
        account.verifiedAt = new Date();
        account.lockedAt = null;
        account.verificationNote = normalizedVerificationNote;

        if (account.primary) {
          await BankAccount.updateMany(
            {
              userId: account.userId._id,
              _id: { $ne: account._id },
            },
            {
              $set: { primary: false },
            }
          );
        }
        break;
      case "reject":
        account.status = "locked";
        account.restoreStatus = "pending";
        account.verifiedAt = null;
        account.lockedAt = new Date();
        account.verificationNote = normalizedVerificationNote;
        break;
      case "lock":
        if (account.status !== "locked") {
          account.restoreStatus = account.status === "verified" ? "verified" : "pending";
        }
        account.status = "locked";
        account.lockedAt = new Date();
        account.verificationNote = normalizedVerificationNote;
        break;
      case "unlock":
        if (account.status !== "locked") {
          return res.status(400).json({ message: "Tài khoản này hiện không bị khóa." });
        }
        account.status = account.restoreStatus ?? "pending";
        account.lockedAt = null;
        account.verificationNote = normalizedVerificationNote;
        break;
      default:
        return res.status(400).json({ message: "Hành động cập nhật trạng thái không hợp lệ." });
    }

    await account.save();
    await account.populate("userId", "displayName email accountId");

    return res.status(200).json({
      message: "Đã cập nhật trạng thái tài khoản ngân hàng.",
      account: serializeBankAccount(account.toObject()),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái tài khoản ngân hàng", error);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái tài khoản ngân hàng." });
  }
};

export const getAdminDepositAccounts = async (req, res) => {
  try {
    const accounts = await reconcileAdminDepositAccounts();

    return res.status(200).json({
      summary: buildAdminDepositAccountSummary(accounts),
      accounts: accounts.map(serializeAdminDepositAccount),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tài khoản nhận tiền của admin", error);
    return res.status(500).json({ message: "Không thể tải danh sách tài khoản nhận tiền." });
  }
};

export const createAdminDepositAccount = async (req, res) => {
  try {
    const payload = {
      label: normalizeText(req.body?.label),
      bankCode: normalizeUpperText(req.body?.bankCode),
      bankName: normalizeText(req.body?.bankName),
      accountNumber: normalizeText(req.body?.accountNumber).replace(/\s+/g, ""),
      accountHolder: normalizeUpperText(req.body?.accountHolder),
      branch: normalizeText(req.body?.branch),
      note: normalizeText(req.body?.note),
    };

    if (
      !payload.label ||
      !payload.accountNumber ||
      !payload.accountHolder ||
      !payload.branch
    ) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ tên hiển thị, số tài khoản, chủ tài khoản và chi nhánh.",
      });
    }

    const supportedBank = findSupportedBank({
      bankCode: payload.bankCode,
      bankName: payload.bankName,
    });

    if (!supportedBank) {
      return res.status(400).json({ message: "Ngân hàng chưa được hỗ trợ trong danh mục hiện tại." });
    }

    const totalAccounts = await AdminDepositAccount.countDocuments();
    const account = await AdminDepositAccount.create({
      label: payload.label,
      bankCode: supportedBank.code,
      bankName: supportedBank.name,
      accountNumber: payload.accountNumber,
      accountHolder: payload.accountHolder,
      branch: payload.branch,
      note: payload.note,
      status: "active",
      isPrimary: totalAccounts === 0,
      createdBy: req.user?._id ?? null,
    });

    await reconcileAdminDepositAccounts();

    const refreshedAccount = await AdminDepositAccount.findById(account._id).lean();

    return res.status(201).json({
      message: "Đã thêm tài khoản nhận tiền mới.",
      account: serializeAdminDepositAccount(refreshedAccount),
    });
  } catch (error) {
    console.error("Lỗi khi tạo tài khoản nhận tiền của admin", error);
    return res.status(500).json({ message: "Không thể tạo tài khoản nhận tiền." });
  }
};

export const updateAdminDepositAccount = async (req, res) => {
  try {
    const account = await AdminDepositAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản nhận tiền." });
    }

    const payload = {
      label: normalizeText(req.body?.label),
      bankCode: normalizeUpperText(req.body?.bankCode),
      bankName: normalizeText(req.body?.bankName),
      accountNumber: normalizeText(req.body?.accountNumber).replace(/\s+/g, ""),
      accountHolder: normalizeUpperText(req.body?.accountHolder),
      branch: normalizeText(req.body?.branch),
      note: normalizeText(req.body?.note),
    };

    if (
      !payload.label ||
      !payload.accountNumber ||
      !payload.accountHolder ||
      !payload.branch
    ) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ tên hiển thị, số tài khoản, chủ tài khoản và chi nhánh.",
      });
    }

    const supportedBank = findSupportedBank({
      bankCode: payload.bankCode,
      bankName: payload.bankName,
    });

    if (!supportedBank) {
      return res.status(400).json({ message: "Ngân hàng chưa được hỗ trợ trong danh mục hiện tại." });
    }

    account.label = payload.label;
    account.bankCode = supportedBank.code;
    account.bankName = supportedBank.name;
    account.accountNumber = payload.accountNumber;
    account.accountHolder = payload.accountHolder;
    account.branch = payload.branch;
    account.note = payload.note;

    await account.save();
    await reconcileAdminDepositAccounts();

    const refreshedAccount = await AdminDepositAccount.findById(account._id).lean();

    return res.status(200).json({
      message: "Đã cập nhật tài khoản nhận tiền.",
      account: serializeAdminDepositAccount(refreshedAccount),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật tài khoản nhận tiền của admin", error);
    return res.status(500).json({ message: "Không thể cập nhật tài khoản nhận tiền." });
  }
};

export const setPrimaryAdminDepositAccount = async (req, res) => {
  try {
    const account = await AdminDepositAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản nhận tiền." });
    }

    account.status = "active";
    account.isPrimary = true;
    await account.save();
    await reconcileAdminDepositAccounts();

    const refreshedAccount = await AdminDepositAccount.findById(account._id).lean();

    return res.status(200).json({
      message: "Đã cập nhật tài khoản nhận tiền chính.",
      account: serializeAdminDepositAccount(refreshedAccount),
    });
  } catch (error) {
    console.error("Lỗi khi đặt tài khoản nhận tiền chính", error);
    return res.status(500).json({ message: "Không thể cập nhật tài khoản chính." });
  }
};

export const updateAdminDepositAccountStatus = async (req, res) => {
  try {
    const { status } = req.body ?? {};
    const account = await AdminDepositAccount.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản nhận tiền." });
    }

    if (status !== "active" && status !== "paused") {
      return res.status(400).json({ message: "Trạng thái tài khoản nhận tiền không hợp lệ." });
    }

    if (status === "paused") {
      const activeCount = await AdminDepositAccount.countDocuments({ status: "active" });

      if (account.status === "active" && activeCount <= 1) {
        return res.status(400).json({
          message: "Cần giữ lại ít nhất một tài khoản nhận tiền đang hoạt động.",
        });
      }
    }

    account.status = status;

    if (status === "paused" && account.isPrimary) {
      account.isPrimary = false;
    }

    await account.save();
    await reconcileAdminDepositAccounts();

    const refreshedAccount = await AdminDepositAccount.findById(account._id).lean();

    return res.status(200).json({
      message:
        status === "active"
          ? "Đã kích hoạt tài khoản nhận tiền."
          : "Đã tạm ngưng tài khoản nhận tiền.",
      account: serializeAdminDepositAccount(refreshedAccount),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái tài khoản nhận tiền", error);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái tài khoản nhận tiền." });
  }
};
