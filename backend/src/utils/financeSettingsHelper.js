import DepositRequest from "../models/DepositRequest.js";
import FinanceSettings from "../models/FinanceSettings.js";

export const DEFAULT_FINANCE_SETTINGS = {
  key: "default",
  minDepositAmount: 50000,
  minWithdrawalAmount: 50000,
  depositBonusPercent: 0,
  depositBonusEnabled: false,
  withdrawalFeePercent: 0,
  processingMode: "standard",
};

const ACTIVE_WELCOME_DEPOSIT_STATUSES = ["pending", "approved"];

export const FINANCE_PROCESSING_MODE_OPTIONS = {
  instant: "Tức thì (Dưới 5 phút)",
  standard: "Tiêu chuẩn (2 - 6 giờ)",
  manual: "Thủ công (Trong vòng 24 giờ)",
};

export const getFinanceProcessingModeLabel = (mode) =>
  FINANCE_PROCESSING_MODE_OPTIONS[mode] ?? FINANCE_PROCESSING_MODE_OPTIONS.standard;

export const serializeFinanceSettings = (settings) => ({
  minDepositAmount: Number(settings?.minDepositAmount ?? DEFAULT_FINANCE_SETTINGS.minDepositAmount),
  minWithdrawalAmount: Number(
    settings?.minWithdrawalAmount ?? DEFAULT_FINANCE_SETTINGS.minWithdrawalAmount
  ),
  depositBonusPercent: 0,
  depositBonusEnabled: false,
  withdrawalFeePercent: Number(
    settings?.withdrawalFeePercent ?? DEFAULT_FINANCE_SETTINGS.withdrawalFeePercent
  ),
  processingMode: settings?.processingMode ?? DEFAULT_FINANCE_SETTINGS.processingMode,
  processingModeLabel: getFinanceProcessingModeLabel(
    settings?.processingMode ?? DEFAULT_FINANCE_SETTINGS.processingMode
  ),
  updatedAt: settings?.updatedAt ?? null,
});

export const ensureFinanceSettings = async () => {
  let settings = await FinanceSettings.findOne({ key: DEFAULT_FINANCE_SETTINGS.key });

  if (!settings) {
    settings = await FinanceSettings.create(DEFAULT_FINANCE_SETTINGS);
  }

  return settings;
};

export const getFinanceSettingsSnapshot = async () =>
  serializeFinanceSettings(await ensureFinanceSettings());

export const isUserEligibleForWelcomeDepositBonus = async (userId) => {
  if (!userId) {
    return false;
  }

  const existingActiveDepositRequest = await DepositRequest.exists({
    userId,
    status: { $in: ACTIVE_WELCOME_DEPOSIT_STATUSES },
  });

  return !existingActiveDepositRequest;
};
