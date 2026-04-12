import type { AdminDepositAccountRow } from "@/types/admin";
import { buildBankQrSrc } from "./bank-catalog";

export type AdminDepositAccount = AdminDepositAccountRow;

export const maskAdminDepositAccountNumber = (accountNumber: string) => {
  if (accountNumber.length <= 6) {
    return accountNumber;
  }

  return `${accountNumber.slice(0, 3)}******${accountNumber.slice(-3)}`;
};

export const buildAdminDepositAccountQrSrc = (
  account: Pick<
    AdminDepositAccount,
    "bankCode" | "bankName" | "accountNumber" | "accountHolder"
  >,
  options?: {
    amount?: number;
    addInfo?: string;
    size?: number;
  }
) => {
  const fallbackLines = [
    `NGAN HANG: ${account.bankName}`,
    `SO TAI KHOAN: ${account.accountNumber}`,
    `CHU TAI KHOAN: ${account.accountHolder}`,
    options?.amount ? `SO TIEN: ${options.amount}` : "",
    options?.addInfo ? `NOI DUNG: ${options.addInfo}` : "",
  ].filter(Boolean);

  return buildBankQrSrc({
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountHolder: account.accountHolder,
    amount: options?.amount,
    addInfo: options?.addInfo,
    fallbackLines,
    size: options?.size ?? 320,
  });
};
