import crypto from "crypto";

import BankAccount from "../models/BankAccount.js";
import DepositRequest from "../models/DepositRequest.js";
import EmailVerification from "../models/EmailVerification.js";
import User from "../models/User.js";
import WalletAdjustment from "../models/WalletAdjustment.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import {
  buildDepositRequestCode,
  buildFinancialRequestCounts,
  buildFinancialSummary,
  buildHomeLeaderboardSnapshots,
  buildHomeGrowthSnapshot,
  buildWithdrawalConfirmationCode,
  buildWithdrawalRequestCode,
  getUserFinancialRecords,
  normalizeCompactText,
  normalizeText,
  normalizeUpperText,
  serializeDepositRequest,
  serializeWalletAdjustment,
  serializeWithdrawalRequest,
} from "../utils/financialRequestHelper.js";
import { getFinanceSettingsSnapshot } from "../utils/financeSettingsHelper.js";
import { queueFinancialRequestStatusEmail } from "../services/userNotificationService.js";
import {
  buildWithdrawalOtpEmail,
  isMailConfigured,
  sendEmail,
} from "../services/mailService.js";
const ALLOWED_DEPOSIT_METHOD_IDS = new Set(["bank", "momo", "zalopay", "phone-card"]);
const WITHDRAWAL_CODE_TTL_MS = 10 * 60 * 1000;
const WITHDRAWAL_CODE_COOLDOWN_MS = 60 * 1000;
const WITHDRAWAL_CODE_MAX_ATTEMPTS = 5;
const INTERNAL_WITHDRAWAL_BANK_NAME = "Chuyển tiền nội bộ";
const INTERNAL_WITHDRAWAL_BANK_CODE = "INTERNAL";
const INTERNAL_WITHDRAWAL_BRANCH = "Chuyển tiền nội bộ";
const TRANSACTION_VERIFICATION_LABEL = "giao dịch";

const parseMoneyAmount = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return NaN;
  }

  return Math.round(parsedValue);
};

const createVerificationCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
const hashVerificationCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");
const normalizeCredential = (value = "") => normalizeText(value).toLowerCase();
const normalizeAccountId = (value = "") => normalizeCompactText(value).replace(/\D/g, "");
const formatCurrency = (value) => new Intl.NumberFormat("vi-VN").format(Number(value ?? 0));

const buildInternalTransferConfirmationCode = (senderAccountId, recipientAccountId) => {
  const senderId = normalizeAccountId(senderAccountId) || "00000000";
  const recipientId = normalizeAccountId(recipientAccountId) || "00000000";
  return `KTNOIBO ${senderId}-${recipientId}`;
};

const buildDepositRequestsSummary = (requests) => {
  const activeRequests = requests.filter((request) => request.status !== "rejected");

  return {
    totalAmount: activeRequests.reduce((total, request) => total + Number(request.amount ?? 0), 0),
    totalBonus: activeRequests.reduce((total, request) => total + Number(request.bonusAmount ?? 0), 0),
    pendingCount: requests.filter((request) => request.status === "pending").length,
    approvedCount: requests.filter((request) => request.status === "approved").length,
    rejectedCount: requests.filter((request) => request.status === "rejected").length,
  };
};

const buildWithdrawalRequestsSummary = (requests) => {
  const activeRequests = requests.filter((request) => request.status !== "rejected");

  return {
    totalAmount: activeRequests.reduce((total, request) => total + Number(request.amount ?? 0), 0),
    pendingCount: requests.filter((request) => request.status === "pending").length,
    approvedCount: requests.filter((request) => request.status === "approved").length,
    rejectedCount: requests.filter((request) => request.status === "rejected").length,
  };
};

const findMyBankAccountOrFail = async ({ bankAccountId, userId }) => {
  if (!bankAccountId) {
    return null;
  }

  return BankAccount.findOne({
    _id: bankAccountId,
    userId,
  });
};

const findInternalTransferRecipient = async ({ accountId, currentUserId }) => {
  const normalizedAccountId = normalizeAccountId(accountId);

  if (!normalizedAccountId) {
    return {
      error: "Vui lòng nhập số tài khoản nội bộ của người nhận.",
      recipient: null,
    };
  }

  if (!/^\d{8}$/.test(normalizedAccountId)) {
    return {
      error: "Số tài khoản nội bộ phải là ID người dùng gồm đúng 8 chữ số.",
      recipient: null,
    };
  }

  const recipient = await User.findOne({
    accountId: normalizedAccountId,
    role: "user",
    moderationStatus: { $ne: "locked" },
  })
    .select("_id accountId displayName username avatarUrl moderationStatus")
    .lean();

  if (!recipient) {
    return {
      error: "Không tìm thấy người nhận nội bộ theo số tài khoản đã nhập.",
      recipient: null,
    };
  }

  if (recipient._id?.toString?.() === currentUserId?.toString?.()) {
      return {
        error: "Bạn không thể chuyển tiền nội bộ cho chính mình.",
        recipient: null,
      };
  }

  return { error: "", recipient };
};

const sendWithdrawalVerificationCode = async (user) => {
  if (!user?._id || !user?.email) {
    throw new Error(`Tài khoản hiện chưa có email để nhận mã xác minh ${TRANSACTION_VERIFICATION_LABEL}.`);
  }

  if (!user?.emailVerified) {
    throw new Error(`Tài khoản cần xác minh email trước khi thực hiện ${TRANSACTION_VERIFICATION_LABEL}.`);
  }

  if (!isMailConfigured()) {
    throw new Error("Email server chưa được cấu hình. Vui lòng bổ sung SMTP trong backend/.env.");
  }

  const now = new Date();
  const email = normalizeCredential(user.email);
  const existingCode = await EmailVerification.findOne({
    email,
    purpose: "withdrawal",
  });

  if (existingCode?.resendAvailableAt > now) {
    return {
      sent: false,
      resendAfter: Math.ceil((existingCode.resendAvailableAt.getTime() - now.getTime()) / 1000),
      expiresIn: Math.max(1, Math.ceil((existingCode.expiresAt.getTime() - now.getTime()) / 1000)),
    };
  }

  const verificationCode = createVerificationCode();
  const verificationRecord = await EmailVerification.findOneAndUpdate(
    { email, purpose: "withdrawal" },
    {
      userId: user._id,
      email,
      purpose: "withdrawal",
      codeHash: hashVerificationCode(verificationCode),
      expiresAt: new Date(Date.now() + WITHDRAWAL_CODE_TTL_MS),
      resendAvailableAt: new Date(Date.now() + WITHDRAWAL_CODE_COOLDOWN_MS),
      attempts: 0,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  try {
    await sendEmail({
      to: email,
      ...buildWithdrawalOtpEmail({
        displayName: user.displayName ?? "Người dùng",
        code: verificationCode,
        expiresInMinutes: Math.round(WITHDRAWAL_CODE_TTL_MS / 60000),
      }),
    });
  } catch (error) {
    if (verificationRecord) {
      await verificationRecord.deleteOne();
    }

    throw error;
  }

  return {
    sent: true,
    resendAfter: Math.round(WITHDRAWAL_CODE_COOLDOWN_MS / 1000),
    expiresIn: Math.round(WITHDRAWAL_CODE_TTL_MS / 1000),
  };
};

const verifyWithdrawalCodeOrThrow = async ({ user, code }) => {
  const email = normalizeCredential(user?.email);

  if (!email || !user?.emailVerified) {
    return {
      ok: false,
      status: 400,
      message: `Tài khoản cần xác minh email trước khi thực hiện ${TRANSACTION_VERIFICATION_LABEL}.`,
    };
  }

  if (!/^\d{6}$/.test(code)) {
    return {
      ok: false,
      status: 400,
      message: "Vui lòng nhập mã xác minh 6 số từ email.",
    };
  }

  const emailVerification = await EmailVerification.findOne({
    email,
    purpose: "withdrawal",
  });

  if (!emailVerification) {
    return {
      ok: false,
      status: 400,
      message: `Không tìm thấy mã xác minh ${TRANSACTION_VERIFICATION_LABEL} còn hiệu lực. Vui lòng gửi lại mã.`,
    };
  }

  if (emailVerification.expiresAt < new Date()) {
    await emailVerification.deleteOne();
    return {
      ok: false,
      status: 400,
      message: `Mã xác minh ${TRANSACTION_VERIFICATION_LABEL} đã hết hạn.`,
    };
  }

  if (emailVerification.codeHash !== hashVerificationCode(code)) {
    emailVerification.attempts += 1;

    if (emailVerification.attempts >= WITHDRAWAL_CODE_MAX_ATTEMPTS) {
      await emailVerification.deleteOne();
      return {
        ok: false,
        status: 429,
        message: "Bạn nhập sai mã quá nhiều lần. Vui lòng yêu cầu mã mới.",
      };
    }

    await emailVerification.save();
    return {
      ok: false,
      status: 400,
      message: `Mã xác minh ${TRANSACTION_VERIFICATION_LABEL} không chính xác.`,
    };
  }

  await emailVerification.deleteOne();
  return { ok: true };
};

export const getMyFinancialOverview = async (req, res) => {
  try {
    const userRecords = await getUserFinancialRecords(req.user._id);

    return res.status(200).json({
      summary: buildFinancialSummary(userRecords),
      deposits: userRecords.deposits.map(serializeDepositRequest),
      withdrawals: userRecords.withdrawals.map(serializeWithdrawalRequest),
      adjustments: userRecords.adjustments.map(serializeWalletAdjustment),
    });
  } catch (error) {
    console.error("Lỗi khi lấy tổng quan tài chính của user", error);
    return res.status(500).json({ message: "Không thể tải dữ liệu ví hiện tại." });
  }
};

export const getMyHomeOverview = async (req, res) => {
  try {
    const userRecords = await getUserFinancialRecords(req.user._id);
    const summary = buildFinancialSummary(userRecords);
    const requestCounts = buildFinancialRequestCounts(userRecords);
    const growthSnapshot = buildHomeGrowthSnapshot(userRecords);
    const leaderboardSnapshot = await buildHomeLeaderboardSnapshots({
      currentUserId: req.user._id,
    });

    return res.status(200).json({
      summary,
      approvedRequestCount: requestCounts.approvedRequestCount,
      pendingRequestCount: requestCounts.pendingRequestCount,
      dailySeries: growthSnapshot.dailySeries,
      weeklyNetChange: growthSnapshot.currentPeriodNetChange,
      previousWeeklyNetChange: growthSnapshot.previousPeriodNetChange,
      weeklyGrowthRate: growthSnapshot.weeklyGrowthRate,
      weeklyLeaderboard: leaderboardSnapshot.leaderboards.weekly,
      currentUserWeeklyRank: leaderboardSnapshot.currentUserLeaderboardRanks.weekly,
      leaderboards: leaderboardSnapshot.leaderboards,
      currentUserLeaderboardRanks: leaderboardSnapshot.currentUserLeaderboardRanks,
      currentUserLeaderboardEntries: leaderboardSnapshot.currentUserLeaderboardEntries,
    });
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu homepage của user", error);
    return res.status(500).json({ message: "Không thể tải dữ liệu trang chủ hiện tại." });
  }
};

export const createDepositRequest = async (req, res) => {
  try {
    const financeSettings = await getFinanceSettingsSnapshot();
    const payload = {
      amount: parseMoneyAmount(req.body?.amount),
      bonusAmount: parseMoneyAmount(req.body?.bonusAmount),
      totalAmount: parseMoneyAmount(req.body?.totalAmount),
      methodId: normalizeText(req.body?.methodId),
      methodTitle: normalizeText(req.body?.methodTitle),
      bankCode: normalizeUpperText(req.body?.bankCode),
      bankName: normalizeText(req.body?.bankName),
      accountNumber: normalizeCompactText(req.body?.accountNumber),
      accountHolder: normalizeUpperText(req.body?.accountHolder),
      transferCode: normalizeUpperText(req.body?.transferCode),
      note: normalizeText(req.body?.note),
    };

    if (
      Number.isNaN(payload.amount) ||
      Number.isNaN(payload.bonusAmount) ||
      Number.isNaN(payload.totalAmount) ||
      payload.amount < financeSettings.minDepositAmount
    ) {
      return res.status(400).json({
        message: `Số tiền nạp tối thiểu là ${new Intl.NumberFormat("vi-VN").format(
          financeSettings.minDepositAmount
        )} VND.`,
      });
    }

    if (
      !ALLOWED_DEPOSIT_METHOD_IDS.has(payload.methodId) ||
      !payload.methodTitle ||
      !payload.bankName ||
      !payload.accountNumber ||
      !payload.accountHolder ||
      !payload.transferCode
    ) {
      return res.status(400).json({
        message: "Thiếu thông tin cần thiết để tạo yêu cầu nạp tiền.",
      });
    }

    if (payload.bonusAmount !== 0) {
      return res.status(400).json({
        message: "Ưu đãi nạp tự động đã bị tắt. Số dư chỉ tăng theo số tiền nạp thật.",
      });
    }

    if (payload.totalAmount !== payload.amount) {
      return res.status(400).json({
        message: "Tổng tiền nhận phải bằng đúng số tiền nạp.",
      });
    }

    const request = await DepositRequest.create({
      requestCode: buildDepositRequestCode(),
      userId: req.user._id,
      userAccountId: req.user.accountId ?? "",
      userDisplayName: req.user.displayName ?? "Người dùng",
      amount: payload.amount,
      bonusAmount: 0,
      totalAmount: payload.amount,
      methodId: payload.methodId,
      methodTitle: payload.methodTitle,
      bankCode: payload.bankCode,
      bankName: payload.bankName,
      accountNumber: payload.accountNumber,
      accountHolder: payload.accountHolder,
      transferCode: payload.transferCode,
      note: payload.note || "Yêu cầu nạp tiền được tạo từ luồng chuyển khoản của người dùng.",
      requestedAt: new Date(),
    });

    return res.status(201).json({
      message: "Đã ghi nhận yêu cầu nạp tiền, chờ admin đối soát.",
      request: serializeDepositRequest(request.toObject()),
    });
  } catch (error) {
    console.error("Lỗi khi tạo yêu cầu nạp tiền", error);
    return res.status(500).json({ message: "Không thể tạo yêu cầu nạp tiền." });
  }
};

export const getMyDepositRequest = async (req, res) => {
  try {
    const request = await DepositRequest.findOne({
      requestCode: normalizeUpperText(req.params.id),
      userId: req.user._id,
    }).lean();

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu nạp tiền." });
    }

    return res.status(200).json({
      request: serializeDepositRequest(request),
    });
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết yêu cầu nạp tiền", error);
    return res.status(500).json({ message: "Không thể tải chi tiết yêu cầu nạp tiền." });
  }
};

export const requestWithdrawalVerificationCode = async (req, res) => {
  try {
    const result = await sendWithdrawalVerificationCode(req.user);

    return res.status(200).json({
      message: result.sent
        ? `Mã xác minh ${TRANSACTION_VERIFICATION_LABEL} đã được gửi tới email của bạn.`
        : "Mã xác minh vẫn còn hiệu lực. Vui lòng chờ trước khi gửi lại.",
      resendAfter: result.resendAfter,
      expiresIn: result.expiresIn,
      sent: result.sent,
    });
  } catch (error) {
    console.error("Lỗi khi gửi mã xác minh rút tiền", error);
    const message = error.message || `Không thể gửi mã xác minh ${TRANSACTION_VERIFICATION_LABEL}.`;
    const status =
      message.includes("SMTP") || message.includes("Email server chưa được cấu hình")
        ? 503
        : message.includes("xác minh email") || message.includes("chưa có email")
          ? 400
          : 500;

    return res.status(status).json({
      message,
    });
  }
};

export const createWithdrawalRequest = async (req, res) => {
  try {
    const financeSettings = await getFinanceSettingsSnapshot();
    const payload = {
      withdrawalType: normalizeText(req.body?.withdrawalType) === "internal" ? "internal" : "bank",
      bankAccountId: normalizeText(req.body?.bankAccountId),
      recipientAccountId: normalizeAccountId(req.body?.recipientAccountId),
      amount: parseMoneyAmount(req.body?.amount),
      note: normalizeText(req.body?.note),
      verificationCode: normalizeText(req.body?.verificationCode),
    };

    if (
      Number.isNaN(payload.amount) ||
      payload.amount < financeSettings.minWithdrawalAmount
    ) {
      return res.status(400).json({
        message: `Số tiền giao dịch tối thiểu là ${new Intl.NumberFormat("vi-VN").format(
          financeSettings.minWithdrawalAmount
        )} VND.`,
      });
    }

    const userRecords = await getUserFinancialRecords(req.user._id);
    const summary = buildFinancialSummary(userRecords);

    if (payload.amount > summary.withdrawableBalance) {
      return res.status(400).json({
        message: "Số dư khả dụng hiện tại không đủ để thực hiện giao dịch này.",
      });
    }

    const verificationResult = await verifyWithdrawalCodeOrThrow({
      user: req.user,
      code: payload.verificationCode,
    });

    if (!verificationResult.ok) {
      return res.status(verificationResult.status).json({
        message: verificationResult.message,
      });
    }

    if (payload.withdrawalType === "internal") {
      const recipientLookup = await findInternalTransferRecipient({
        accountId: payload.recipientAccountId,
        currentUserId: req.user._id,
      });

      if (!recipientLookup.recipient) {
        return res.status(400).json({
          message: recipientLookup.error || "Không xác định được người nhận nội bộ.",
        });
      }

      const recipient = recipientLookup.recipient;
      const processedAt = new Date();
      const internalRequest = await WithdrawalRequest.create({
        requestCode: buildWithdrawalRequestCode(),
        userId: req.user._id,
        userAccountId: req.user.accountId ?? "",
        userDisplayName: req.user.displayName ?? "Người dùng",
        withdrawalType: "internal",
        bankAccountId: null,
        bankName: INTERNAL_WITHDRAWAL_BANK_NAME,
        bankCode: INTERNAL_WITHDRAWAL_BANK_CODE,
        bankAccount: recipient.accountId ?? payload.recipientAccountId,
        accountHolder: recipient.displayName ?? recipient.username ?? "Người nhận",
        branch: INTERNAL_WITHDRAWAL_BRANCH,
        amount: payload.amount,
        feePercent: 0,
        feeAmount: 0,
        receivableAmount: payload.amount,
        processingMode: "instant",
        status: "approved",
        confirmationCode: buildInternalTransferConfirmationCode(
          req.user.accountId,
          recipient.accountId
        ),
        note:
          payload.note ||
          `Chuyển tiền nội bộ tới ${recipient.displayName ?? "Người nhận"} - ID ${recipient.accountId}.`,
        processedNote: "Hệ thống tự động xử lý giao dịch chuyển tiền nội bộ.",
        requestedAt: processedAt,
        processedAt,
        approvedAt: processedAt,
        internalRecipientUserId: recipient._id,
        internalRecipientAccountId: recipient.accountId ?? "",
        internalRecipientDisplayName: recipient.displayName ?? recipient.username ?? "Người nhận",
      });

      await WalletAdjustment.create({
        userId: recipient._id,
        userAccountId: recipient.accountId ?? "",
        userDisplayName: recipient.displayName ?? recipient.username ?? "Người nhận",
        direction: "credit",
        reasonCode: "internal_transfer_in",
        reasonLabel: "Nhận tiền chuyển tiền nội bộ",
        amount: payload.amount,
        note: `Nhận ${formatCurrency(payload.amount)}đ từ ${
          req.user.displayName ?? "Người dùng"
        } (${req.user.accountId ?? "không rõ ID"}).`,
        effectiveAt: processedAt,
        createdBy: req.user._id,
      });

      return res.status(201).json({
        message: "Chuyển tiền nội bộ thành công.",
        request: serializeWithdrawalRequest(internalRequest.toObject()),
      });
    }

    const bankAccount = await findMyBankAccountOrFail({
      bankAccountId: payload.bankAccountId,
      userId: req.user._id,
    });

    if (!bankAccount) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản ngân hàng nhận tiền." });
    }

    if (bankAccount.status === "locked") {
      return res.status(400).json({
        message: "Tài khoản nhận tiền này đang bị khóa. Vui lòng dùng tài khoản khác.",
      });
    }

    if (bankAccount.status !== "verified") {
      return res.status(400).json({
        message: "Tài khoản nhận tiền này đang chờ admin xác minh.",
      });
    }

    const feePercent = Number(financeSettings.withdrawalFeePercent ?? 0);
    const feeAmount = Math.round((payload.amount * feePercent) / 100);
    const receivableAmount = Math.max(payload.amount - feeAmount, 0);

    const request = await WithdrawalRequest.create({
      requestCode: buildWithdrawalRequestCode(),
      userId: req.user._id,
      userAccountId: req.user.accountId ?? "",
      userDisplayName: req.user.displayName ?? "Người dùng",
      withdrawalType: "bank",
      bankAccountId: bankAccount._id,
      bankName: bankAccount.bankName,
      bankCode: bankAccount.bankCode ?? "",
      bankAccount: bankAccount.accountNumber,
      accountHolder: bankAccount.accountHolder,
      branch: bankAccount.branch,
      amount: payload.amount,
      feePercent,
      feeAmount,
      receivableAmount,
      processingMode: financeSettings.processingMode,
      confirmationCode: buildWithdrawalConfirmationCode(req.user.accountId),
      note: payload.note || "Yêu cầu được tạo từ luồng người dùng trong ví cá nhân.",
      requestedAt: new Date(),
    });

    return res.status(201).json({
      message: "Đã ghi nhận yêu cầu rút tiền, chờ admin thanh toán.",
      request: serializeWithdrawalRequest(request.toObject()),
    });
  } catch (error) {
    console.error("Lỗi khi tạo yêu cầu rút tiền", error);
    return res.status(500).json({ message: "Không thể tạo giao dịch." });
  }
};

export const getMyWithdrawalRequest = async (req, res) => {
  try {
    const request = await WithdrawalRequest.findOne({
      requestCode: normalizeUpperText(req.params.id),
      userId: req.user._id,
    }).lean();

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    return res.status(200).json({
      request: serializeWithdrawalRequest(request),
    });
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết yêu cầu rút tiền", error);
    return res.status(500).json({ message: "Không thể tải chi tiết yêu cầu rút tiền." });
  }
};

export const getAdminDepositRequests = async (req, res) => {
  try {
    const requests = await DepositRequest.find().sort({ requestedAt: -1, createdAt: -1 }).lean();

    return res.status(200).json({
      summary: buildDepositRequestsSummary(requests),
      requests: requests.map(serializeDepositRequest),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách yêu cầu nạp tiền cho admin", error);
    return res.status(500).json({ message: "Không thể tải danh sách yêu cầu nạp tiền." });
  }
};

export const updateAdminDepositRequestStatus = async (req, res) => {
  try {
    const status = normalizeText(req.body?.status);
    const note = normalizeText(req.body?.note);

    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ message: "Trạng thái cập nhật yêu cầu nạp không hợp lệ." });
    }

    if (status === "rejected" && !note) {
      return res.status(400).json({
        message: "Vui lòng nhập lý do từ chối yêu cầu nạp tiền.",
      });
    }

    const request = await DepositRequest.findOne({
      requestCode: normalizeUpperText(req.params.id),
    });

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu nạp tiền." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Yêu cầu nạp này đã được xử lý trước đó." });
    }

    const processedAt = new Date();

    if (status === "approved") {
      request.bonusAmount = 0;
      request.totalAmount = Number(request.amount ?? 0);
    }

    request.status = status;
    request.processedAt = processedAt;
    request.processedBy = req.user._id;
    request.processedNote =
      note ||
      (status === "approved"
        ? "Admin đã duyệt yêu cầu nạp tiền."
        : "Admin đã từ chối yêu cầu nạp tiền.");
    request.approvedAt = status === "approved" ? processedAt : null;
    request.rejectedAt = status === "rejected" ? processedAt : null;

    await request.save();
    queueFinancialRequestStatusEmail({
      requestType: "deposit",
      request,
    });

    return res.status(200).json({
      message:
        status === "approved"
          ? "Đã duyệt yêu cầu nạp tiền."
          : "Đã từ chối yêu cầu nạp tiền.",
      request: serializeDepositRequest(request.toObject()),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái yêu cầu nạp tiền", error);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái yêu cầu nạp tiền." });
  }
};

export const getAdminWithdrawalRequests = async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find()
      .sort({ requestedAt: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      summary: buildWithdrawalRequestsSummary(requests),
      requests: requests.map(serializeWithdrawalRequest),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách yêu cầu rút tiền cho admin", error);
    return res.status(500).json({ message: "Không thể tải danh sách yêu cầu rút tiền." });
  }
};

export const updateAdminWithdrawalRequestStatus = async (req, res) => {
  try {
    const status = normalizeText(req.body?.status);
    const note = normalizeText(req.body?.note);

    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ message: "Trạng thái cập nhật yêu cầu rút không hợp lệ." });
    }

    if (status === "rejected" && !note) {
      return res.status(400).json({
        message: "Vui lòng nhập lý do từ chối yêu cầu rút tiền.",
      });
    }

    const request = await WithdrawalRequest.findOne({
      requestCode: normalizeUpperText(req.params.id),
    });

    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu rút tiền." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Yêu cầu rút này đã được xử lý trước đó." });
    }

    if (status === "approved") {
      const [bankAccount, userRecords] = await Promise.all([
        BankAccount.findOne({
          _id: request.bankAccountId,
          userId: request.userId,
        }).lean(),
        getUserFinancialRecords(request.userId),
      ]);

      if (!bankAccount || bankAccount.status !== "verified") {
        return res.status(400).json({
          message: "Tài khoản nhận tiền hiện không còn ở trạng thái đã xác minh.",
        });
      }

      const summary = buildFinancialSummary(userRecords);

      if (request.amount > summary.currentBalance) {
        return res.status(400).json({
          message: "Số dư hiện tại của user không đủ để duyệt yêu cầu rút tiền này.",
        });
      }
    }

    const processedAt = new Date();

    request.status = status;
    request.processedAt = processedAt;
    request.processedBy = req.user._id;
    request.processedNote =
      note ||
      (status === "approved"
        ? "Admin đã duyệt và tiến hành thanh toán yêu cầu rút tiền."
        : "Admin đã từ chối yêu cầu rút tiền.");
    request.approvedAt = status === "approved" ? processedAt : null;
    request.rejectedAt = status === "rejected" ? processedAt : null;

    await request.save();
    queueFinancialRequestStatusEmail({
      requestType: "withdrawal",
      request,
    });

    return res.status(200).json({
      message:
        status === "approved"
          ? "Đã duyệt yêu cầu rút tiền."
          : "Đã từ chối yêu cầu rút tiền.",
      request: serializeWithdrawalRequest(request.toObject()),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái yêu cầu rút tiền", error);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái yêu cầu rút tiền." });
  }
};
