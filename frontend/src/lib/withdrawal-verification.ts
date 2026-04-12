import type { WithdrawalType } from "@/types/finance";

const WITHDRAWAL_VERIFICATION_DRAFT_KEY = "withdrawal-verification-draft";

export interface WithdrawalVerificationDraft {
  withdrawalType?: WithdrawalType;
  amount: number;
  bankAccountId?: string;
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountHolder?: string;
  recipientUserId?: string;
  recipientAccountId?: string;
  recipientDisplayName?: string;
  resendAvailableAt?: number;
  expiresAt?: number;
}

const isFiniteTimestamp = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const normalizeDraft = (value: unknown): WithdrawalVerificationDraft | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const draft = value as Partial<WithdrawalVerificationDraft>;
  const withdrawalType = draft.withdrawalType === "internal" ? "internal" : "bank";

  if (
    !Number.isFinite(draft.amount) ||
    Number(draft.amount) <= 0 ||
    !`${draft.bankName ?? ""}`.trim() ||
    !`${draft.accountNumber ?? ""}`.trim()
  ) {
    return null;
  }

  if (withdrawalType === "bank" && !`${draft.bankAccountId ?? ""}`.trim()) {
    return null;
  }

  if (
    withdrawalType === "internal" &&
    (!`${draft.recipientAccountId ?? ""}`.trim() || !`${draft.recipientDisplayName ?? ""}`.trim())
  ) {
    return null;
  }

  return {
    withdrawalType,
    amount: Number(draft.amount),
    bankAccountId: `${draft.bankAccountId ?? ""}`.trim() || undefined,
    bankName: `${draft.bankName}`.trim(),
    bankCode: `${draft.bankCode ?? ""}`.trim() || undefined,
    accountNumber: `${draft.accountNumber}`.trim(),
    accountHolder: `${draft.accountHolder ?? ""}`.trim() || undefined,
    recipientUserId: `${draft.recipientUserId ?? ""}`.trim() || undefined,
    recipientAccountId: `${draft.recipientAccountId ?? ""}`.trim() || undefined,
    recipientDisplayName: `${draft.recipientDisplayName ?? ""}`.trim() || undefined,
    resendAvailableAt: isFiniteTimestamp(draft.resendAvailableAt)
      ? draft.resendAvailableAt
      : undefined,
    expiresAt: isFiniteTimestamp(draft.expiresAt) ? draft.expiresAt : undefined,
  };
};

export const buildWithdrawalVerificationDraft = ({
  amount,
  target,
  resendAfter = 0,
  expiresIn = 0,
}: {
  amount: number;
  target: {
    withdrawalType?: WithdrawalType;
    bankAccountId?: string;
    bankName: string;
    bankCode?: string;
    accountNumber: string;
    accountHolder?: string;
    recipientUserId?: string;
    recipientAccountId?: string;
    recipientDisplayName?: string;
  };
  resendAfter?: number;
  expiresIn?: number;
}): WithdrawalVerificationDraft => {
  const now = Date.now();
  const safeResendAfter = Math.max(0, Number(resendAfter) || 0);
  const safeExpiresIn = Math.max(0, Number(expiresIn) || 0);

  return {
    withdrawalType: target.withdrawalType === "internal" ? "internal" : "bank",
    amount,
    bankAccountId: target.bankAccountId,
    bankName: target.bankName,
    bankCode: target.bankCode,
    accountNumber: target.accountNumber,
    accountHolder: target.accountHolder,
    recipientUserId: target.recipientUserId,
    recipientAccountId: target.recipientAccountId,
    recipientDisplayName: target.recipientDisplayName,
    resendAvailableAt: safeResendAfter > 0 ? now + safeResendAfter * 1000 : undefined,
    expiresAt: safeExpiresIn > 0 ? now + safeExpiresIn * 1000 : undefined,
  };
};

export const updateWithdrawalVerificationTimers = (
  draft: WithdrawalVerificationDraft,
  {
    resendAfter = 0,
    expiresIn = 0,
  }: {
    resendAfter?: number;
    expiresIn?: number;
  }
): WithdrawalVerificationDraft => {
  const now = Date.now();
  const safeResendAfter = Math.max(0, Number(resendAfter) || 0);
  const safeExpiresIn = Math.max(0, Number(expiresIn) || 0);

  return {
    ...draft,
    resendAvailableAt: safeResendAfter > 0 ? now + safeResendAfter * 1000 : undefined,
    expiresAt: safeExpiresIn > 0 ? now + safeExpiresIn * 1000 : undefined,
  };
};

export const saveWithdrawalVerificationDraft = (draft: WithdrawalVerificationDraft) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(WITHDRAWAL_VERIFICATION_DRAFT_KEY, JSON.stringify(draft));
};

export const readWithdrawalVerificationDraft = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(WITHDRAWAL_VERIFICATION_DRAFT_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return normalizeDraft(JSON.parse(storedValue));
  } catch (error) {
    console.error("Không đọc được draft xác minh rút tiền", error);
    return null;
  }
};

export const clearWithdrawalVerificationDraft = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(WITHDRAWAL_VERIFICATION_DRAFT_KEY);
};

export const getWithdrawalVerificationCountdown = (targetTime?: number) => {
  if (!isFiniteTimestamp(targetTime)) {
    return 0;
  }

  const safeTargetTime = Number(targetTime);

  return Math.max(0, Math.ceil((safeTargetTime - Date.now()) / 1000));
};
