import type { DepositRequest } from "@/types/finance";

export type { DepositRequest, DepositStatus } from "@/types/finance";

const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const formatDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

const parseDepositRequestedDate = (
  request: Pick<DepositRequest, "createdAtMs" | "requestedAt">
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

  const matchedParts = rawRequestedAt.match(/^(\d{2}):(\d{2}), (\d{2})\/(\d{2})\/(\d{4})$/);

  if (!matchedParts) {
    return new Date();
  }

  const [, hour, minute, day, month, year] = matchedParts;

  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
};

export const formatDepositRequestedFull = (
  request: Pick<DepositRequest, "createdAtMs" | "requestedAt">
) => {
  const date = parseDepositRequestedDate(request);

  return `${formatTime(date)}, ${formatDate(date)}`;
};

export const formatDepositSuccessCode = (requestId: string) => {
  const numericPart = requestId.replace(/\D/g, "").slice(-6).padStart(6, "0");

  return `NPT-${numericPart}`;
};
