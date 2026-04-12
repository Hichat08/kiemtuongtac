export interface SupportedBank {
  code: string;
  name: string;
  vietQrBankId: string;
  aliases: string[];
}

const normalizeBankValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const supportedBanks: SupportedBank[] = [
  { code: "VCB", name: "Vietcombank", vietQrBankId: "vietcombank", aliases: ["vcb", "vietcombank"] },
  { code: "MBB", name: "MB Bank", vietQrBankId: "mbbank", aliases: ["mb", "mb bank", "mbbank", "mbb"] },
  { code: "VPB", name: "VPBank", vietQrBankId: "vpbank", aliases: ["vpb", "vpbank"] },
  { code: "TCB", name: "Techcombank", vietQrBankId: "techcombank", aliases: ["tcb", "techcombank"] },
  { code: "BIDV", name: "BIDV", vietQrBankId: "bidv", aliases: ["bidv"] },
  { code: "ICB", name: "VietinBank", vietQrBankId: "vietinbank", aliases: ["icb", "vietinbank", "vietin bank"] },
  { code: "VBA", name: "Agribank", vietQrBankId: "agribank", aliases: ["vba", "agribank"] },
  { code: "ACB", name: "ACB", vietQrBankId: "acb", aliases: ["acb"] },
  { code: "SHB", name: "SHB", vietQrBankId: "shb", aliases: ["shb"] },
  { code: "HDB", name: "HDBank", vietQrBankId: "hdbank", aliases: ["hdb", "hdbank", "hd bank"] },
  { code: "VIB", name: "VIB", vietQrBankId: "vib", aliases: ["vib"] },
  { code: "LPB", name: "LPBank", vietQrBankId: "lpbank", aliases: ["lpb", "lpbank", "lienvietpostbank", "lien viet post bank"] },
  { code: "SEAB", name: "SeABank", vietQrBankId: "seabank", aliases: ["seab", "seabank", "sea bank"] },
  { code: "OCB", name: "OCB", vietQrBankId: "ocb", aliases: ["ocb"] },
  { code: "TPB", name: "TPBank", vietQrBankId: "tpbank", aliases: ["tpb", "tpbank", "tp bank"] },
  { code: "MSB", name: "MSB", vietQrBankId: "msb", aliases: ["msb", "maritime bank"] },
  { code: "STB", name: "Sacombank", vietQrBankId: "sacombank", aliases: ["stb", "sacombank"] },
  { code: "EIB", name: "Eximbank", vietQrBankId: "eximbank", aliases: ["eib", "eximbank"] },
  { code: "NAB", name: "Nam A Bank", vietQrBankId: "namabank", aliases: ["nab", "nam a bank", "namabank"] },
  { code: "SCB", name: "SCB (Sài Gòn)", vietQrBankId: "scb", aliases: ["scb", "scb sai gon", "scb saigon"] },
  { code: "NCB", name: "NCB", vietQrBankId: "ncb", aliases: ["ncb"] },
  { code: "ABB", name: "ABBank", vietQrBankId: "abbank", aliases: ["abb", "abbank", "ab bank"] },
  { code: "BAB", name: "Bac A Bank", vietQrBankId: "bacabank", aliases: ["bab", "bac a bank", "bacabank", "bac a"] },
  { code: "PVCB", name: "PVcomBank", vietQrBankId: "pvcombank", aliases: ["pvcb", "pvcombank", "pvcom bank"] },
  { code: "VTB", name: "Vietbank", vietQrBankId: "vietbank", aliases: ["vtb", "vietbank", "viet bank"] },
  { code: "VAB", name: "VietABank", vietQrBankId: "vietabank", aliases: ["vab", "vietabank", "viet a bank"] },
  { code: "BVBANK", name: "BVBank (Bản Việt)", vietQrBankId: "bvbank", aliases: ["bvbank", "ban viet", "ban viet bank", "ban viet commercial"] },
  { code: "PGB", name: "PGBank", vietQrBankId: "pgbank", aliases: ["pgb", "pgbank", "pg bank"] },
  { code: "KLB", name: "Kienlongbank", vietQrBankId: "kienlongbank", aliases: ["klb", "kienlongbank", "kien long bank"] },
  { code: "SGB", name: "Saigonbank", vietQrBankId: "saigonbank", aliases: ["sgb", "saigonbank", "saigon bank"] },
  { code: "BAOVIET", name: "BAOVIET Bank", vietQrBankId: "baovietbank", aliases: ["baoviet", "baoviet bank", "bao viet bank"] },
];

export const findSupportedBank = ({
  bankCode,
  bankName,
}: {
  bankCode?: string;
  bankName?: string;
}) => {
  const normalizedCode = normalizeBankValue(bankCode ?? "");
  const normalizedName = normalizeBankValue(bankName ?? "");

  return (
    supportedBanks.find((bank) => {
      const normalizedBankCode = normalizeBankValue(bank.code);
      const normalizedBankName = normalizeBankValue(bank.name);

      if (normalizedCode && normalizedCode === normalizedBankCode) {
        return true;
      }

      if (normalizedName && (normalizedName === normalizedBankName || bank.aliases.some((alias) => normalizedName === normalizeBankValue(alias)))) {
        return true;
      }

      if (normalizedCode && bank.aliases.some((alias) => normalizedCode === normalizeBankValue(alias))) {
        return true;
      }

      return false;
    }) ?? null
  );
};

export const buildBankQrSrc = ({
  bankCode,
  bankName,
  accountNumber,
  accountHolder,
  addInfo,
  amount,
  fallbackLines,
  size = 320,
}: {
  bankCode?: string;
  bankName?: string;
  accountNumber: string;
  accountHolder?: string;
  addInfo?: string;
  amount?: number;
  fallbackLines: string[];
  size?: number;
}) => {
  const bank = findSupportedBank({ bankCode, bankName });

  if (!bank) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
      fallbackLines.join("\n")
    )}`;
  }

  const params = new URLSearchParams();

  if (typeof amount === "number" && amount > 0) {
    params.set("amount", String(Math.round(amount)));
  }

  if ((addInfo ?? "").trim()) {
    params.set("addInfo", addInfo!.trim());
  }

  if ((accountHolder ?? "").trim()) {
    params.set("accountName", accountHolder!.trim());
  }

  return `https://img.vietqr.io/image/${bank.vietQrBankId}-${accountNumber}-compact2.png${
    params.toString() ? `?${params.toString()}` : ""
  }`;
};
