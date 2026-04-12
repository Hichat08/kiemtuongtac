import { findSupportedBank, supportedBanks } from "./bank-catalog";
import type { UserBankAccount, UserBankAccountStatus } from "@/types/user";

export interface WithdrawalBankAccount {
  id: string;
  name: string;
  bankCode?: string;
  accountNumber: string;
  rawAccountNumber?: string;
  logoLabel: string;
  logoClassName: string;
  active: boolean;
  branch?: string;
  accountHolder?: string;
  primary?: boolean;
  status?: UserBankAccountStatus;
  verificationNote?: string;
}

const bankAppearanceByCode: Record<
  string,
  Pick<WithdrawalBankAccount, "logoLabel" | "logoClassName">
> = {
  VCB: {
    logoLabel: "VCB",
    logoClassName: "bg-[#123c46] text-[#7af4bb]",
  },
  TCB: {
    logoLabel: "TCB",
    logoClassName: "bg-[#31465c] text-[#8ce1ff]",
  },
  MBB: {
    logoLabel: "MB",
    logoClassName: "bg-[#eff4ff] text-[#2b61d9]",
  },
  BIDV: {
    logoLabel: "BIDV",
    logoClassName: "bg-[#eef1ff] text-[#5868ff]",
  },
  ACB: {
    logoLabel: "ACB",
    logoClassName: "bg-[#fff3e8] text-[#d47a2c]",
  },
  INTERNAL: {
    logoLabel: "ID",
    logoClassName: "bg-[#f3edff] text-[#7b19d8]",
  },
};

const defaultBankAppearance = {
  logoLabel: "BANK",
  logoClassName: "bg-[#f3eef9] text-[#7b19d8]",
};

export const featuredWithdrawalBanks = ["VCB", "MBB", "TCB"]
  .map((code) => supportedBanks.find((bank) => bank.code === code))
  .filter((bank): bank is (typeof supportedBanks)[number] => Boolean(bank));

export const additionalWithdrawalBanks = supportedBanks.filter(
  (bank) => !featuredWithdrawalBanks.some((featuredBank) => featuredBank.code === bank.code)
);

export const getWithdrawalBankAppearance = ({
  bankCode,
  bankName,
}: {
  bankCode?: string;
  bankName?: string;
}) => {
  const normalizedBankCode = `${bankCode ?? ""}`.trim().toUpperCase();

  if (normalizedBankCode === "INTERNAL") {
    return bankAppearanceByCode.INTERNAL;
  }

  const supportedBank = findSupportedBank({ bankCode, bankName });

  if (!supportedBank) {
    return defaultBankAppearance;
  }

  return bankAppearanceByCode[supportedBank.code] ?? {
    logoLabel: supportedBank.code,
    logoClassName: "bg-[#f3eef9] text-[#7b19d8]",
  };
};

export const maskWithdrawalAccountNumber = (accountNumber: string) => {
  const digitsOnly = accountNumber.replace(/\D/g, "");

  if (digitsOnly.length <= 4) {
    return digitsOnly;
  }

  return `**** **** ${digitsOnly.slice(-4)}`;
};

export const mapUserBankAccountToWithdrawalBankAccount = (
  account: UserBankAccount
): WithdrawalBankAccount => ({
  id: account.id,
  name: account.bankName,
  bankCode: account.bankCode,
  accountNumber: maskWithdrawalAccountNumber(account.accountNumber),
  rawAccountNumber: account.accountNumber.replace(/\D/g, ""),
  ...getWithdrawalBankAppearance({
    bankCode: account.bankCode,
    bankName: account.bankName,
  }),
  active: account.status === "verified",
  branch: account.branch,
  accountHolder: account.accountHolder,
  primary: account.primary,
  status: account.status,
  verificationNote: account.verificationNote,
});
