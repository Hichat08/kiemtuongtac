import {
  ensureFinanceSettings,
  serializeFinanceSettings,
} from "../utils/financeSettingsHelper.js";

const parseMoneyAmount = (value, fallbackValue) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.max(0, Math.round(parsedValue));
};

const parsePercentValue = (value, fallbackValue) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.min(100, Math.max(0, Number(parsedValue.toFixed(2))));
};

const parseBooleanValue = (value, fallbackValue) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = `${value ?? ""}`.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return fallbackValue;
};

const parseProcessingMode = (value, fallbackValue) => {
  const normalizedValue = `${value ?? ""}`.trim().toLowerCase();

  if (["instant", "standard", "manual"].includes(normalizedValue)) {
    return normalizedValue;
  }

  return fallbackValue;
};

export const getAdminFinanceSettings = async (_req, res) => {
  try {
    const settings = await ensureFinanceSettings();

    return res.status(200).json({
      settings: serializeFinanceSettings(settings),
    });
  } catch (error) {
    console.error("Lỗi khi tải cấu hình tài chính admin", error);
    return res.status(500).json({ message: "Không tải được cấu hình tài chính." });
  }
};

export const updateAdminFinanceSettings = async (req, res) => {
  try {
    const settings = await ensureFinanceSettings();
    const minDepositAmount = parseMoneyAmount(req.body?.minDepositAmount, settings.minDepositAmount);
    const minWithdrawalAmount = parseMoneyAmount(
      req.body?.minWithdrawalAmount,
      settings.minWithdrawalAmount
    );
    const withdrawalFeePercent = parsePercentValue(
      req.body?.withdrawalFeePercent,
      settings.withdrawalFeePercent
    );
    const processingMode = parseProcessingMode(req.body?.processingMode, settings.processingMode);

    if (minDepositAmount <= 0 || minWithdrawalAmount <= 0) {
      return res.status(400).json({
        message: "Hạn mức nạp và rút tối thiểu phải lớn hơn 0.",
      });
    }

    settings.minDepositAmount = minDepositAmount;
    settings.minWithdrawalAmount = minWithdrawalAmount;
    settings.depositBonusPercent = 0;
    settings.depositBonusEnabled = false;
    settings.withdrawalFeePercent = withdrawalFeePercent;
    settings.processingMode = processingMode;

    await settings.save();

    return res.status(200).json({
      message: "Đã cập nhật cấu hình tài chính.",
      settings: serializeFinanceSettings(settings),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật cấu hình tài chính admin", error);
    return res.status(500).json({ message: "Không cập nhật được cấu hình tài chính." });
  }
};

export const getUserFinanceSettings = async (req, res) => {
  try {
    const settings = await ensureFinanceSettings();

    return res.status(200).json({
      settings: {
        ...serializeFinanceSettings(settings),
        depositBonusEligible: false,
      },
    });
  } catch (error) {
    console.error("Lỗi khi tải cấu hình tài chính user", error);
    return res.status(500).json({ message: "Không tải được cấu hình tài chính." });
  }
};
