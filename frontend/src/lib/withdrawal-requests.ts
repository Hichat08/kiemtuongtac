import type { WithdrawalRequest } from "@/types/finance";

export type { WithdrawalRequest, WithdrawalStatus } from "@/types/finance";

const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const formatDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

const formatShortDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseWithdrawalRequestedDate = (
  request: Pick<WithdrawalRequest, "createdAtMs" | "requestedAt">
) => {
  if (typeof request.createdAtMs === "number" && Number.isFinite(request.createdAtMs)) {
    return new Date(request.createdAtMs);
  }

  const rawRequestedAt = `${request.requestedAt ?? ""}`.trim();

  if (rawRequestedAt) {
    const isoDate = new Date(rawRequestedAt);

    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }

  const [timePart, datePart] = rawRequestedAt.split(" - ");
  const [hours = "00", minutes = "00"] = (timePart ?? "").split(":");
  const [day = "01", month = "01", year = "1970"] = (datePart ?? "").split("/");

  return new Date(
    Number(year),
    Math.max(Number(month) - 1, 0),
    Number(day),
    Number(hours),
    Number(minutes)
  );
};

const normalizeTransferIdentity = (value?: string) => {
  const normalizedValue = `${value ?? ""}`.trim().replace(/^#/, "");

  if (!normalizedValue) {
    return "ID00000000";
  }

  return normalizedValue.toUpperCase();
};

export const isInternalWithdrawal = (
  request: Pick<WithdrawalRequest, "withdrawalType" | "bankCode">
) => request.withdrawalType === "internal" || `${request.bankCode ?? ""}`.trim().toUpperCase() === "INTERNAL";

export const buildWithdrawalTransferContent = (userId?: string) =>
  `KTTRUT ${normalizeTransferIdentity(userId)}`;

export const formatWithdrawalRequestedShort = (
  request: Pick<WithdrawalRequest, "createdAtMs" | "requestedAt">
) => {
  const date = parseWithdrawalRequestedDate(request);
  return `${formatTime(date)}, ${formatShortDate(date)}`;
};

export const formatWithdrawalRequestedFull = (
  request: Pick<WithdrawalRequest, "createdAtMs" | "requestedAt">
) => {
  const date = parseWithdrawalRequestedDate(request);
  return `${formatTime(date)}, ${formatDate(date)}`;
};

export const maskWithdrawalRequestAccount = (bankAccount: string) => {
  const digitsOnly = bankAccount.replace(/\D/g, "");

  if (digitsOnly.length <= 4) {
    return digitsOnly;
  }

  return `**** ${digitsOnly.slice(-4)}`;
};

export const formatWithdrawalRequestAccount = (
  request: Pick<WithdrawalRequest, "withdrawalType" | "bankCode" | "bankAccount" | "internalRecipientAccountId">
) => {
  if (isInternalWithdrawal(request)) {
    return `${request.internalRecipientAccountId || request.bankAccount || ""}`.trim();
  }

  return maskWithdrawalRequestAccount(request.bankAccount || "");
};
