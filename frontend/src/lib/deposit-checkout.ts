import { buildBankQrSrc } from "@/lib/bank-catalog";
import type { DepositReceivingAccount } from "@/types/user";

export type DepositMethodId = "bank" | "momo" | "zalopay" | "phone-card";
export const DEPOSIT_CHECKOUT_TTL_MS = 15 * 60 * 1000;

export interface DepositCheckoutDraft {
  amount: number;
  bonusAmount: number;
  totalAmount: number;
  methodId: DepositMethodId;
  methodTitle: string;
  transferCode: string;
  bankCode: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  qrSrc: string;
  createdAt: string;
}

const DEPOSIT_CHECKOUT_STORAGE_KEY = "social-tasks-deposit-checkout";

export const formatDepositCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

const buildTransferNonce = (createdAt: Date) =>
  createdAt.getTime().toString(36).slice(-6).toUpperCase();

const parseCheckoutCreatedAt = (draft?: Pick<DepositCheckoutDraft, "createdAt"> | null) => {
  const parsedMs = Date.parse(`${draft?.createdAt ?? ""}`);

  if (Number.isFinite(parsedMs)) {
    return parsedMs;
  }

  return Date.now();
};

export const createDepositTransferCode = (_userCode?: string, createdAt = new Date()) =>
  `KTTNAP ${buildTransferNonce(createdAt)}`;

const buildDepositQrSrc = ({
  bankCode,
  bankName,
  accountNumber,
  accountHolder,
  amount,
  transferCode,
}: {
  bankCode?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  transferCode: string;
}) =>
  buildBankQrSrc({
    bankCode,
    bankName,
    accountNumber,
    accountHolder,
    addInfo: transferCode,
    amount,
    fallbackLines: [
      `NGAN HANG: ${bankName}`,
      `SO TAI KHOAN: ${accountNumber}`,
      `CHU TAI KHOAN: ${accountHolder}`,
      `SO TIEN: ${formatDepositCurrency(amount)} VND`,
      `NOI DUNG: ${transferCode}`,
    ],
  });

export const getDepositCheckoutExpiryMs = (draft: Pick<DepositCheckoutDraft, "createdAt">) =>
  parseCheckoutCreatedAt(draft) + DEPOSIT_CHECKOUT_TTL_MS;

export const getDepositCheckoutRemainingMs = (
  draft: Pick<DepositCheckoutDraft, "createdAt">,
  nowMs = Date.now()
) => Math.max(0, getDepositCheckoutExpiryMs(draft) - nowMs);

export const isDepositCheckoutExpired = (
  draft: Pick<DepositCheckoutDraft, "createdAt">,
  nowMs = Date.now()
) => getDepositCheckoutRemainingMs(draft, nowMs) <= 0;

export const formatDepositCountdown = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const createDepositCheckoutDraft = ({
  amount,
  bonusAmount,
  totalAmount,
  methodId,
  methodTitle,
  userCode,
  receivingAccount,
}: {
  amount: number;
  bonusAmount: number;
  totalAmount: number;
  methodId: DepositMethodId;
  methodTitle: string;
  userCode?: string;
  receivingAccount: Pick<
    DepositReceivingAccount,
    "bankCode" | "bankName" | "accountHolder" | "accountNumber"
  >;
}): DepositCheckoutDraft | null => {
  if (!receivingAccount) {
    return null;
  }

  const createdAt = new Date();
  const transferCode = createDepositTransferCode(userCode, createdAt);

  return {
    amount,
    bonusAmount,
    totalAmount,
    methodId,
    methodTitle,
    transferCode,
    ...receivingAccount,
    qrSrc: buildDepositQrSrc({
      bankCode: receivingAccount.bankCode,
      bankName: receivingAccount.bankName,
      accountNumber: receivingAccount.accountNumber,
      accountHolder: receivingAccount.accountHolder,
      amount,
      transferCode,
    }),
    createdAt: createdAt.toISOString(),
  };
};

export const saveDepositCheckoutDraft = (draft: DepositCheckoutDraft) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEPOSIT_CHECKOUT_STORAGE_KEY, JSON.stringify(draft));
};

export const loadDepositCheckoutDraft = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(DEPOSIT_CHECKOUT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as DepositCheckoutDraft;

    if (
      typeof parsedValue?.amount !== "number" ||
      typeof parsedValue?.transferCode !== "string" ||
      typeof parsedValue?.accountNumber !== "string"
    ) {
      return null;
    }

    const createdAt =
      typeof parsedValue.createdAt === "string" && parsedValue.createdAt.trim()
        ? parsedValue.createdAt
        : new Date().toISOString();
    const normalizedTransferCode = createDepositTransferCode(undefined, new Date(createdAt));

    return {
      ...parsedValue,
      createdAt,
      transferCode: normalizedTransferCode,
      qrSrc: buildDepositQrSrc({
        bankCode: parsedValue.bankCode,
        bankName: parsedValue.bankName,
        accountNumber: parsedValue.accountNumber,
        accountHolder: parsedValue.accountHolder,
        amount: parsedValue.amount,
        transferCode: normalizedTransferCode,
      }),
    };
  } catch {
    return null;
  }
};

export const clearDepositCheckoutDraft = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DEPOSIT_CHECKOUT_STORAGE_KEY);
};
