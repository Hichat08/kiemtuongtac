import crypto from "crypto";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import { findSupportedBank } from "../constants/supportedBanks.js";
import AdminDepositAccount from "../models/AdminDepositAccount.js";
import BankAccount from "../models/BankAccount.js";
import User from "../models/User.js";
import { serializeReferralInvitee } from "../utils/referralHelper.js";

const normalizeText = (value) => `${value ?? ""}`.trim();
const normalizeUpperText = (value) => normalizeText(value).toUpperCase();
const normalizeAccountId = (value) => normalizeText(value).replace(/\D/g, "");
const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, "");
const PROFILE_PHONE_REGEX = /^[0-9+().-]{8,20}$/;
const REFERRAL_REWARD = 10000;
const NOTIFICATION_ACTIVITY_KEYS = [
  "newTasks",
  "reviewStatus",
  "balanceChanges",
];
const NOTIFICATION_SYSTEM_KEYS = ["adminMessages", "promotions"];

const buildDefaultNotificationPreferences = () => ({
  activity: {
    newTasks: true,
    reviewStatus: true,
    balanceChanges: true,
  },
  system: {
    adminMessages: true,
    promotions: false,
  },
  emailDigest: false,
  pushEnabled: false,
});

const serializeNotificationPreferences = (user) => {
  const defaults = buildDefaultNotificationPreferences();
  const preferences = user?.notificationPreferences ?? {};

  return {
    activity: {
      newTasks: preferences.activity?.newTasks ?? defaults.activity.newTasks,
      reviewStatus:
        preferences.activity?.reviewStatus ?? defaults.activity.reviewStatus,
      balanceChanges:
        preferences.activity?.balanceChanges ??
        defaults.activity.balanceChanges,
    },
    system: {
      adminMessages:
        preferences.system?.adminMessages ?? defaults.system.adminMessages,
      promotions: preferences.system?.promotions ?? defaults.system.promotions,
    },
    emailDigest: preferences.emailDigest ?? defaults.emailDigest,
    pushEnabled: preferences.pushEnabled ?? defaults.pushEnabled,
  };
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeNotificationPreferencesUpdate = (payload, currentSettings) => {
  if (!isPlainObject(payload)) {
    return {
      error: "Dữ liệu cài đặt thông báo không hợp lệ.",
      settings: currentSettings,
    };
  }

  const nextSettings = {
    activity: { ...currentSettings.activity },
    system: { ...currentSettings.system },
    emailDigest: currentSettings.emailDigest,
    pushEnabled: currentSettings.pushEnabled,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "activity")) {
    if (!isPlainObject(payload.activity)) {
      return {
        error: "Cấu hình thông báo hoạt động không hợp lệ.",
        settings: currentSettings,
      };
    }

    for (const [key, value] of Object.entries(payload.activity)) {
      if (!NOTIFICATION_ACTIVITY_KEYS.includes(key)) {
        return {
          error: "Có tuỳ chọn thông báo hoạt động không được hỗ trợ.",
          settings: currentSettings,
        };
      }

      if (typeof value !== "boolean") {
        return {
          error: "Giá trị thông báo hoạt động phải là true hoặc false.",
          settings: currentSettings,
        };
      }

      nextSettings.activity[key] = value;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "system")) {
    if (!isPlainObject(payload.system)) {
      return {
        error: "Cấu hình thông báo hệ thống không hợp lệ.",
        settings: currentSettings,
      };
    }

    for (const [key, value] of Object.entries(payload.system)) {
      if (!NOTIFICATION_SYSTEM_KEYS.includes(key)) {
        return {
          error: "Có tuỳ chọn thông báo hệ thống không được hỗ trợ.",
          settings: currentSettings,
        };
      }

      if (typeof value !== "boolean") {
        return {
          error: "Giá trị thông báo hệ thống phải là true hoặc false.",
          settings: currentSettings,
        };
      }

      nextSettings.system[key] = value;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "emailDigest")) {
    if (typeof payload.emailDigest !== "boolean") {
      return {
        error: "Thiết lập email thông báo phải là true hoặc false.",
        settings: currentSettings,
      };
    }

    nextSettings.emailDigest = payload.emailDigest;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "pushEnabled")) {
    if (typeof payload.pushEnabled !== "boolean") {
      return {
        error: "Thiết lập thông báo đẩy phải là true hoặc false.",
        settings: currentSettings,
      };
    }

    nextSettings.pushEnabled = payload.pushEnabled;
  }

  return { error: null, settings: nextSettings };
};

const serializeBankAccount = (account, user) => ({
  id: account._id.toString(),
  userId: user?._id?.toString() ?? account.userId?.toString?.() ?? "",
  customerName: user?.displayName ?? "",
  customerEmail: user?.email ?? "",
  customerCode: user?.accountId ?? "",
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

const reconcileAdminDepositAccounts = async () => {
  const accounts = await AdminDepositAccount.find().sort({
    createdAt: 1,
    updatedAt: -1,
  });

  if (!accounts.length) {
    return [];
  }

  let activeAccount =
    accounts.find((account) => account.status === "active") ?? null;

  if (!activeAccount) {
    accounts[0].status = "active";
    activeAccount = accounts[0];
  }

  const primaryAccount =
    accounts.find(
      (account) => account.status === "active" && account.isPrimary,
    ) ?? activeAccount;

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
    }),
  );

  return accounts.map((account) => account.toObject());
};

export const authMe = async (req, res) => {
  try {
    const user = req.user; // lấy từ authMiddleware

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Lỗi khi gọi authMe", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getLockStatus = async (req, res) => {
  try {
    const user = req.user;

    return res.status(200).json({
      status: user?.moderationStatus ?? "active",
      note: user?.moderationNote ?? "",
      lockedAt: user?.lockedAt ?? null,
      lastWarnedAt: user?.lastWarnedAt ?? null,
      warningCount: user?.warningCount ?? 0,
      communityChatStatus: user?.communityChatStatus ?? "active",
      communityChatNote: user?.communityChatModerationNote ?? "",
      communityChatLockedAt: user?.communityChatLockedAt ?? null,
    });
  } catch (error) {
    console.error("Lỗi khi gọi getLockStatus", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const searchUserByUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim() === "") {
      return res
        .status(400)
        .json({ message: "Cần cung cấp username trong query." });
    }

    const user = await User.findOne({ username }).select(
      "_id accountId displayName username avatarUrl",
    );

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi xảy ra khi searchUserByUsername", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getInternalTransferRecipient = async (req, res) => {
  try {
    const accountId = normalizeAccountId(req.query?.accountId);

    if (!accountId) {
      return res
        .status(400)
        .json({ message: "Cần cung cấp số tài khoản nội bộ của người nhận." });
    }

    if (!/^\d{8}$/.test(accountId)) {
      return res.status(400).json({
        message: "Số tài khoản nội bộ phải là ID người dùng gồm đúng 8 chữ số.",
      });
    }

    const recipient = await User.findOne({
      accountId,
      role: "user",
      moderationStatus: { $ne: "locked" },
      _id: { $ne: req.user._id },
    }).select("_id accountId displayName username avatarUrl");

    if (!recipient) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy người nhận nội bộ." });
    }

    return res.status(200).json({
      user: recipient,
    });
  } catch (error) {
    console.error("Lỗi khi tra cứu người nhận chuyển nội bộ", error);
    return res
      .status(500)
      .json({ message: "Không thể tra cứu người nhận nội bộ." });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await uploadImageFromBuffer(file.buffer);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        avatarUrl: result.secure_url,
        avatarId: result.public_id,
      },
      {
        new: true,
      },
    ).select("avatarUrl");

    if (!updatedUser.avatarUrl) {
      return res.status(400).json({ message: "Avatar trả về null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Lỗi xảy ra khi upload avatar", error);
    return res.status(500).json({ message: "Upload failed" });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const payload = {
      displayName: normalizeText(req.body?.displayName),
      phone: normalizePhone(req.body?.phone),
      bio: normalizeText(req.body?.bio),
    };

    if (!payload.displayName) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập họ và tên hiển thị." });
    }

    if (payload.displayName.length > 100) {
      return res
        .status(400)
        .json({ message: "Họ và tên không được vượt quá 100 ký tự." });
    }

    if (payload.phone && !PROFILE_PHONE_REGEX.test(payload.phone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.",
      });
    }

    if (payload.bio.length > 500) {
      return res
        .status(400)
        .json({ message: "Giới thiệu không được vượt quá 500 ký tự." });
    }

    const update = {
      $set: {
        displayName: payload.displayName,
        bio: payload.bio,
      },
    };

    if (payload.phone) {
      update.$set.phone = payload.phone;
    } else {
      update.$unset = { phone: 1 };
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
      runValidators: true,
    }).select("-hashedPassword");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tài khoản để cập nhật." });
    }

    return res.status(200).json({
      message: "Đã cập nhật thông tin tài khoản.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin tài khoản", error);
    return res
      .status(500)
      .json({ message: "Không thể cập nhật thông tin tài khoản." });
  }
};

export const getMyNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "notificationPreferences role",
    );

    if (!user || user.role === "admin") {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tài khoản người dùng." });
    }

    return res.status(200).json({
      settings: serializeNotificationPreferences(user),
    });
  } catch (error) {
    console.error("Lỗi khi lấy cài đặt thông báo của user", error);
    return res
      .status(500)
      .json({ message: "Không thể tải cài đặt thông báo." });
  }
};

export const updateMyNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "notificationPreferences role",
    );

    if (!user || user.role === "admin") {
      return res
        .status(404)
        .json({ message: "Không tìm thấy tài khoản người dùng." });
    }

    const currentSettings = serializeNotificationPreferences(user);
    const { error, settings } = normalizeNotificationPreferencesUpdate(
      req.body,
      currentSettings,
    );

    if (error) {
      return res.status(400).json({ message: error });
    }

    user.notificationPreferences = settings;
    await user.save();

    return res.status(200).json({
      message: "Đã cập nhật cài đặt thông báo.",
      settings: serializeNotificationPreferences(user),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật cài đặt thông báo của user", error);
    return res
      .status(500)
      .json({ message: "Không thể cập nhật cài đặt thông báo." });
  }
};

export const getMyBankAccounts = async (req, res) => {
  try {
    const accounts = await BankAccount.find({ userId: req.user._id })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      accounts: accounts.map((account) =>
        serializeBankAccount(account, req.user),
      ),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tài khoản ngân hàng của user", error);
    return res
      .status(500)
      .json({ message: "Không thể tải danh sách tài khoản ngân hàng." });
  }
};

export const getDepositReceivingAccount = async (req, res) => {
  try {
    const accounts = await reconcileAdminDepositAccounts();
    const account =
      accounts.find((item) => item.isPrimary && item.status === "active") ??
      accounts.find((item) => item.status === "active") ??
      null;

    return res.status(200).json({
      account: account ? serializeAdminDepositAccount(account) : null,
    });
  } catch (error) {
    console.error("Lỗi khi lấy tài khoản nhận tiền nạp của admin", error);
    return res
      .status(500)
      .json({ message: "Không thể tải tài khoản nhận tiền nạp." });
  }
};

export const getMyReferralOverview = async (req, res) => {
  try {
    const invitees = await User.find({
      referredBy: req.user._id,
      role: { $ne: "admin" },
    })
      .sort({ createdAt: -1, updatedAt: -1 })
      .select(
        "_id displayName username avatarUrl emailVerified createdAt updatedAt",
      )
      .lean();

    const verifiedInvited = invitees.filter(
      (invitee) => invitee.emailVerified,
    ).length;
    const pendingInvited = invitees.length - verifiedInvited;

    return res.status(200).json({
      summary: {
        totalInvited: invitees.length,
        verifiedInvited,
        pendingInvited,
        rewardPerInvite: REFERRAL_REWARD,
        estimatedRewardTotal: invitees.length * REFERRAL_REWARD,
        estimatedPendingReward: pendingInvited * REFERRAL_REWARD,
      },
      invitees: invitees.map(serializeReferralInvitee),
    });
  } catch (error) {
    console.error("Lỗi khi tải tổng quan mời bạn bè", error);
    return res
      .status(500)
      .json({ message: "Không thể tải danh sách mời bạn bè." });
  }
};

export const submitBankAccountVerificationRequest = async (req, res) => {
  try {
    const payload = {
      bankName: normalizeText(req.body?.bankName),
      bankCode: normalizeUpperText(req.body?.bankCode),
      accountNumber: normalizeText(req.body?.accountNumber).replace(/\s+/g, ""),
      accountHolder: normalizeUpperText(req.body?.accountHolder),
      branch: normalizeText(req.body?.branch),
      swiftCode: normalizeUpperText(req.body?.swiftCode),
      note: normalizeText(req.body?.note),
      primary: Boolean(req.body?.primary),
    };

    if (
      !payload.bankName ||
      !payload.accountNumber ||
      !payload.accountHolder ||
      !payload.branch
    ) {
      return res.status(400).json({
        message:
          "Thiếu thông tin bắt buộc để gửi yêu cầu xác minh tài khoản ngân hàng.",
      });
    }

    const supportedBank = findSupportedBank({
      bankCode: payload.bankCode,
      bankName: payload.bankName,
    });

    if (!supportedBank) {
      return res.status(400).json({
        message:
          "Ứng dụng hiện chỉ hỗ trợ 31 ngân hàng trong danh mục cấu hình.",
      });
    }

    let account = await BankAccount.findOne({
      userId: req.user._id,
      accountNumber: payload.accountNumber,
    });

    if (!account) {
      account = new BankAccount({
        userId: req.user._id,
      });
    }

    account.bankName = supportedBank.name;
    account.bankCode = supportedBank.code;
    account.accountNumber = payload.accountNumber;
    account.accountHolder = payload.accountHolder;
    account.branch = payload.branch;
    account.linkedPhone = "";
    account.identityNumber = "";
    account.swiftCode = payload.swiftCode;
    account.province = "";
    account.address = "";
    account.note = payload.note;
    account.primary = payload.primary;
    account.status = "pending";
    account.restoreStatus = "pending";
    account.submittedAt = new Date();
    account.verifiedAt = null;
    account.lockedAt = null;
    account.verificationNote = "Yêu cầu xác minh đang chờ admin xử lý.";

    await account.save();

    if (payload.primary) {
      await BankAccount.updateMany(
        {
          userId: req.user._id,
          _id: { $ne: account._id },
        },
        {
          $set: { primary: false },
        },
      );
    }

    const refreshedAccount = await BankAccount.findById(account._id).lean();

    return res.status(201).json({
      message: "Đã gửi yêu cầu xác minh tài khoản ngân hàng.",
      account: serializeBankAccount(refreshedAccount, req.user),
    });
  } catch (error) {
    console.error("Lỗi khi gửi yêu cầu xác minh tài khoản ngân hàng", error);
    return res
      .status(500)
      .json({ message: "Không thể gửi yêu cầu xác minh tài khoản ngân hàng." });
  }
};

export const regenerateRegistrationPin = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    }

    // Generate new 6-digit PIN
    const newPin = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.registrationPin = newPin;
    user.registrationPinExpiresAt = expiresAt;
    await user.save();

    return res.status(200).json({
      message: "Mã PIN mới đã được tạo.",
      pin: newPin,
      expiresIn: Math.round((expiresAt.getTime() - Date.now()) / 1000),
    });
  } catch (error) {
    console.error("Lỗi khi tạo lại mã PIN", error);
    return res.status(500).json({ message: "Không thể tạo lại mã PIN." });
  }
};
