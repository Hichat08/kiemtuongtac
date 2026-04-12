const normalizeBankValue = (value = "") =>
  `${value}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const supportedBanks = [
  { code: "VCB", name: "Vietcombank", aliases: ["vcb", "vietcombank"] },
  { code: "MBB", name: "MB Bank", aliases: ["mb", "mb bank", "mbbank", "mbb"] },
  { code: "VPB", name: "VPBank", aliases: ["vpb", "vpbank"] },
  { code: "TCB", name: "Techcombank", aliases: ["tcb", "techcombank"] },
  { code: "BIDV", name: "BIDV", aliases: ["bidv"] },
  { code: "ICB", name: "VietinBank", aliases: ["icb", "vietinbank", "vietin bank"] },
  { code: "VBA", name: "Agribank", aliases: ["vba", "agribank"] },
  { code: "ACB", name: "ACB", aliases: ["acb"] },
  { code: "SHB", name: "SHB", aliases: ["shb"] },
  { code: "HDB", name: "HDBank", aliases: ["hdb", "hdbank", "hd bank"] },
  { code: "VIB", name: "VIB", aliases: ["vib"] },
  { code: "LPB", name: "LPBank", aliases: ["lpb", "lpbank", "lienvietpostbank", "lien viet post bank"] },
  { code: "SEAB", name: "SeABank", aliases: ["seab", "seabank", "sea bank"] },
  { code: "OCB", name: "OCB", aliases: ["ocb"] },
  { code: "TPB", name: "TPBank", aliases: ["tpb", "tpbank", "tp bank"] },
  { code: "MSB", name: "MSB", aliases: ["msb", "maritime bank"] },
  { code: "STB", name: "Sacombank", aliases: ["stb", "sacombank"] },
  { code: "EIB", name: "Eximbank", aliases: ["eib", "eximbank"] },
  { code: "NAB", name: "Nam A Bank", aliases: ["nab", "nam a bank", "namabank"] },
  { code: "SCB", name: "SCB (Sài Gòn)", aliases: ["scb", "scb sai gon", "scb saigon"] },
  { code: "NCB", name: "NCB", aliases: ["ncb"] },
  { code: "ABB", name: "ABBank", aliases: ["abb", "abbank", "ab bank"] },
  { code: "BAB", name: "Bac A Bank", aliases: ["bab", "bac a bank", "bacabank", "bac a"] },
  { code: "PVCB", name: "PVcomBank", aliases: ["pvcb", "pvcombank", "pvcom bank"] },
  { code: "VTB", name: "Vietbank", aliases: ["vtb", "vietbank", "viet bank"] },
  { code: "VAB", name: "VietABank", aliases: ["vab", "vietabank", "viet a bank"] },
  { code: "BVBANK", name: "BVBank (Bản Việt)", aliases: ["bvbank", "ban viet", "ban viet bank", "ban viet commercial"] },
  { code: "PGB", name: "PGBank", aliases: ["pgb", "pgbank", "pg bank"] },
  { code: "KLB", name: "Kienlongbank", aliases: ["klb", "kienlongbank", "kien long bank"] },
  { code: "SGB", name: "Saigonbank", aliases: ["sgb", "saigonbank", "saigon bank"] },
  { code: "BAOVIET", name: "BAOVIET Bank", aliases: ["baoviet", "baoviet bank", "bao viet bank"] },
];

export const findSupportedBank = ({ bankCode, bankName }) => {
  const normalizedCode = normalizeBankValue(bankCode);
  const normalizedName = normalizeBankValue(bankName);

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
