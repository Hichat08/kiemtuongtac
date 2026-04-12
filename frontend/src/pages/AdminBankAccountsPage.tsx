import AdminActionReasonDialog from "@/components/admin/AdminActionReasonDialog";
import AdminShell from "@/components/admin/AdminShell";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { buildBankQrSrc as buildSharedBankQrSrc } from "@/lib/bank-catalog";
import { buildAdminCsvFileName, downloadAdminCsv } from "@/lib/admin-tools";
import { adminService } from "@/services/adminService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Copy,
  Download,
  Eye,
  Landmark,
  Lock,
  LockOpen,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import type { AdminBankAccountAction, AdminBankAccountRow } from "@/types/admin";
import axios from "axios";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type BankAccountStatus = "verified" | "pending" | "locked";

interface CustomerBankAccount {
  id: string;
  customerName: string;
  customerCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  linkedAt: string;
  status: BankAccountStatus;
  primary: boolean;
  restoreStatus: Exclude<BankAccountStatus, "locked">;
  linkedPhone: string;
  identityNumber: string;
  bankCode: string;
  swiftCode: string;
  province: string;
  address: string;
  note?: string;
  submittedAt: string;
  updatedAt: string;
  verificationNote: string;
}

const bankAccounts: CustomerBankAccount[] = [];
type BankAccountActionDialogState = {
  accountId: string;
  action: AdminBankAccountAction;
  note: string;
};

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatDateOnly = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "Chưa có";
const formatDateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "Chưa có";
const formatCustomerCode = (value?: string) => {
  const normalizedValue = `${value ?? ""}`.trim();

  if (!normalizedValue) {
    return "Chưa có";
  }

  return normalizedValue.startsWith("#") ? normalizedValue : `#${normalizedValue}`;
};

const mapBankAccount = (account: AdminBankAccountRow): CustomerBankAccount => ({
  id: account.id,
  customerName: account.customerName || "Chưa cập nhật",
  customerCode: formatCustomerCode(account.customerCode),
  bankName: account.bankName,
  accountNumber: account.accountNumber,
  accountHolder: account.accountHolder,
  branch: account.branch,
  linkedAt: formatDateOnly(account.linkedAt),
  status: account.status,
  primary: account.primary,
  restoreStatus: account.restoreStatus,
  linkedPhone: account.linkedPhone || "Chưa cập nhật",
  identityNumber: account.identityNumber || "Chưa cập nhật",
  bankCode: account.bankCode,
  swiftCode: account.swiftCode || "Chưa cập nhật",
  province: account.province || "Chưa cập nhật",
  address: account.address || "Chưa cập nhật",
  note: account.note || "",
  submittedAt: formatDateTime(account.submittedAt),
  updatedAt: formatDateTime(account.updatedAt),
  verificationNote: account.verificationNote || "Chưa có ghi chú xác minh.",
});

const maskAccountNumber = (accountNumber: string) =>
  `${accountNumber.slice(0, 3)}******${accountNumber.slice(-3)}`;

const buildQrFallbackPayload = (account: CustomerBankAccount) =>
  [
    `NGAN HANG: ${account.bankName}`,
    `SO TAI KHOAN: ${account.accountNumber}`,
    `CHU TAI KHOAN: ${account.accountHolder}`,
    `CHI NHANH: ${account.branch}`,
    `MA KHACH HANG: ${account.customerCode}`,
  ].join("\n");

const buildQrFallbackSrc = (account: CustomerBankAccount) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    buildQrFallbackPayload(account)
  )}`;

const buildBankQrSrc = (account: CustomerBankAccount) =>
  buildSharedBankQrSrc({
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountHolder: account.accountHolder,
    addInfo: `TK ${account.customerCode}`,
    fallbackLines: buildQrFallbackPayload(account).split("\n"),
    size: 280,
  });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

const getBankActionDraft = (action: AdminBankAccountAction) => {
  switch (action) {
    case "verify":
      return {
        title: "Xác minh tài khoản ngân hàng",
        description: "Ghi chú này sẽ được lưu cùng lịch sử xác minh để đội vận hành có thể đối chiếu lại sau.",
        confirmLabel: "Xác nhận tài khoản",
        confirmClassName: "bg-gradient-primary hover:opacity-95",
        loadingLabel: "Đang xác nhận...",
        defaultNote: "Đã kiểm tra thông tin chủ tài khoản và xác nhận tài khoản ngân hàng hợp lệ.",
        presets: [
          "Đã đối chiếu thông tin chủ tài khoản và xác nhận tài khoản hợp lệ.",
          "Hồ sơ ngân hàng đầy đủ, cho phép dùng để nhận/rút tiền.",
        ],
      };
    case "reject":
      return {
        title: "Từ chối tài khoản ngân hàng",
        description: "Trạng thái xác minh sẽ bị từ chối, nên lý do cần nêu rõ điểm không đạt để tiện xử lý lại.",
        confirmLabel: "Xác nhận từ chối",
        confirmClassName: "bg-[#d4525d] hover:bg-[#c84954]",
        loadingLabel: "Đang từ chối...",
        defaultNote: "Từ chối xác minh vì thông tin tài khoản ngân hàng chưa hợp lệ hoặc chưa đủ căn cứ đối chiếu.",
        presets: [
          "Tên chủ tài khoản không khớp với hồ sơ người dùng, từ chối xác minh.",
          "Thiếu căn cứ đối chiếu tài khoản ngân hàng, yêu cầu người dùng bổ sung lại.",
        ],
      };
    case "lock":
      return {
        title: "Khóa tài khoản ngân hàng",
        description: "Tài khoản này sẽ bị khóa tạm khỏi luồng rút tiền, vì vậy cần lưu lý do kiểm soát rõ ràng.",
        confirmLabel: "Xác nhận khóa",
        confirmClassName: "bg-[#d4525d] hover:bg-[#c84954]",
        loadingLabel: "Đang khóa...",
        defaultNote: "Khóa tạm tài khoản ngân hàng để rà soát dấu hiệu bất thường hoặc rủi ro vận hành.",
        presets: [
          "Khóa tạm để kiểm tra dấu hiệu bất thường trên tài khoản nhận tiền này.",
          "Khóa tạm do phát hiện rủi ro xác minh hoặc sử dụng sai mục đích.",
        ],
      };
    case "unlock":
      return {
        title: "Mở khóa tài khoản ngân hàng",
        description: "Ghi chú nên nêu rõ căn cứ mở khóa để tránh mất dấu lịch sử xử lý nội bộ.",
        confirmLabel: "Xác nhận mở khóa",
        confirmClassName: "bg-[#00a46f] hover:bg-[#009767]",
        loadingLabel: "Đang mở khóa...",
        defaultNote: "Mở khóa tài khoản ngân hàng sau khi đã rà soát và xác nhận có thể sử dụng lại.",
        presets: [
          "Đã hoàn tất rà soát và cho phép tài khoản ngân hàng hoạt động lại.",
          "Mở khóa sau khi xác minh lại thông tin và không còn rủi ro vận hành.",
        ],
      };
  }
};

const getStatusMeta = (status: BankAccountStatus) => {
  switch (status) {
    case "verified":
      return {
        label: "Đã xác minh",
        className: "bg-[#f3edff] text-[#7b19d8]",
      };
    case "pending":
      return {
        label: "Chờ duyệt",
        className: "bg-[#eef1ff] text-[#5868ff]",
      };
    case "locked":
      return {
        label: "Tạm khóa",
        className: "bg-[#fff0f5] text-[#d4525d]",
      };
  }
};

const detailCardClassName =
  "rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]";

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#faf8ff] px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">{label}</p>
      <p className={`mt-2 text-sm font-bold text-[#2d2f32] ${mono ? "font-mono tracking-[0.08em]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export default function AdminBankAccountsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [accounts, setAccounts] = useState(bankAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | BankAccountStatus>("all");
  const [submittingAction, setSubmittingAction] = useState<AdminBankAccountAction | null>(null);
  const [actionDialog, setActionDialog] = useState<BankAccountActionDialogState | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  const syncAccounts = async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const data = await adminService.getBankAccounts();
      setAccounts(data.accounts.map(mapBankAccount));
    } catch (error) {
      console.error("Không tải được danh sách tài khoản ngân hàng admin", error);
      toast.error(getErrorMessage(error, "Không tải được danh sách tài khoản ngân hàng."));
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void syncAccounts(true);
  }, []);

  useEffect(() => {
    if (selectedAccountId && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(null);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (actionDialog && !accounts.some((account) => account.id === actionDialog.accountId)) {
      setActionDialog(null);
    }
  }, [accounts, actionDialog]);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        (statusFilter === "all" || account.status === statusFilter) &&
        (!deferredSearchTerm ||
          [
              account.customerName,
              account.customerCode,
              account.bankName,
              account.accountNumber,
              account.accountHolder,
            ]
              .join(" ")
              .toLowerCase()
              .includes(deferredSearchTerm))
      ),
    [accounts, deferredSearchTerm, statusFilter]
  );

  const summary = useMemo(() => {
    const verified = accounts.filter((account) => account.status === "verified").length;
    const pending = accounts.filter((account) => account.status === "pending").length;
    const locked = accounts.filter((account) => account.status === "locked").length;
    const primary = accounts.filter((account) => account.primary).length;

    return {
      total: accounts.length,
      verified,
      pending,
      locked,
      primary,
    };
  }, [accounts]);

  const statusChips: Array<{ value: "all" | BankAccountStatus; label: string; count: number }> = [
    { value: "all", label: "Tất cả", count: accounts.length },
    { value: "verified", label: "Đã xác minh", count: summary.verified },
    { value: "pending", label: "Chờ duyệt", count: summary.pending },
    { value: "locked", label: "Tạm khóa", count: summary.locked },
  ];

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );
  const actionDialogDraft = actionDialog ? getBankActionDraft(actionDialog.action) : null;

  const handleCopy = async (accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      toast.success("Đã sao chép số tài khoản.");
    } catch (error) {
      console.error("Không sao chép được số tài khoản", error);
      toast.error("Không sao chép được số tài khoản.");
    }
  };

  const handleAccountStatusAction = async (
    accountId: string,
    action: AdminBankAccountAction,
    successMessage: string,
    verificationNote: string
  ) => {
    const target = accounts.find((account) => account.id === accountId);
    if (!target) {
      return false;
    }

    const trimmedNote = verificationNote.trim();

    if (!trimmedNote) {
      toast.error("Cần nhập lý do trước khi cập nhật trạng thái tài khoản ngân hàng.");
      return false;
    }

    try {
      setSubmittingAction(action);
      const res = await adminService.updateBankAccountStatus(accountId, { action, verificationNote: trimmedNote });
      const nextAccount = mapBankAccount(res.account);

      setAccounts((current) =>
        current.map((account) => (account.id === accountId ? nextAccount : account))
      );
      setSelectedAccountId(accountId);
      toast.success(successMessage);
      return true;
    } catch (error) {
      console.error("Không cập nhật được trạng thái tài khoản ngân hàng", error);
      toast.error(getErrorMessage(error, "Không cập nhật được trạng thái tài khoản ngân hàng."));
      return false;
    } finally {
      setSubmittingAction(null);
    }
  };

  const openAccountActionDialog = (accountId: string, action: AdminBankAccountAction) => {
    const target = accounts.find((account) => account.id === accountId);
    if (!target) {
      return;
    }

    const resolvedAction =
      action === "lock" || action === "unlock" ? (target.status === "locked" ? "unlock" : "lock") : action;
    const draft = getBankActionDraft(resolvedAction);

    setSelectedAccountId(accountId);
    setActionDialog({
      accountId,
      action: resolvedAction,
      note: draft.defaultNote,
    });
  };

  const handleVerifyAccount = (accountId: string) => {
    const target = accounts.find((account) => account.id === accountId);
    if (!target) {
      return;
    }

    openAccountActionDialog(accountId, "verify");
  };

  const handleRejectAccount = (accountId: string) => {
    const target = accounts.find((account) => account.id === accountId);
    if (!target) {
      return;
    }

    openAccountActionDialog(accountId, "reject");
  };

  const handleToggleLock = (accountId: string) => {
    const target = accounts.find((account) => account.id === accountId);
    if (!target) {
      return;
    }

    openAccountActionDialog(accountId, target.status === "locked" ? "unlock" : "lock");
  };

  const handleConfirmAccountAction = async () => {
    if (!actionDialog) {
      return;
    }

    const target = accounts.find((account) => account.id === actionDialog.accountId);
    if (!target) {
      toast.error("Không tìm thấy tài khoản ngân hàng để xử lý.");
      return;
    }

    const successMessageMap: Record<AdminBankAccountAction, string> = {
      verify: `Đã xác nhận tài khoản ngân hàng của ${target.customerName}.`,
      reject: `Đã từ chối tài khoản ngân hàng của ${target.customerName}.`,
      lock: `Đã khóa tài khoản ngân hàng của ${target.customerName}.`,
      unlock: `Đã mở khóa tài khoản ngân hàng của ${target.customerName}.`,
    };

    const submitted = await handleAccountStatusAction(
      actionDialog.accountId,
      actionDialog.action,
      successMessageMap[actionDialog.action],
      actionDialog.note
    );

    if (submitted) {
      setActionDialog(null);
    }
  };

  const handleRefreshAccounts = async () => {
    try {
      setRefreshing(true);
      await syncAccounts();
      toast.success("Đã làm mới danh sách tài khoản ngân hàng.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportAccounts = async () => {
    try {
      setExporting(true);

      if (filteredAccounts.length === 0) {
        toast.info("Không có tài khoản ngân hàng phù hợp để xuất.");
        return;
      }

      downloadAdminCsv(buildAdminCsvFileName("admin-user-bank-accounts"), filteredAccounts, [
        { header: "Khách hàng", value: (account) => account.customerName },
        { header: "Mã khách hàng", value: (account) => account.customerCode },
        { header: "Ngân hàng", value: (account) => account.bankName },
        { header: "Số tài khoản", value: (account) => account.accountNumber },
        { header: "Chủ tài khoản", value: (account) => account.accountHolder },
        { header: "Chi nhánh", value: (account) => account.branch },
        { header: "Trạng thái", value: (account) => getStatusMeta(account.status).label },
        { header: "Tài khoản chính", value: (account) => (account.primary ? "Có" : "Không") },
        { header: "Liên kết lúc", value: (account) => account.linkedAt },
        { header: "Cập nhật", value: (account) => account.updatedAt },
      ]);
      toast.success(`Đã xuất ${filteredAccounts.length} tài khoản ngân hàng.`);
    } catch (error) {
      console.error("Không xuất được danh sách tài khoản ngân hàng", error);
      toast.error("Không xuất được danh sách tài khoản ngân hàng.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminShell
      title="Quản lý Tài khoản Ngân hàng"
      subtitle="Theo dõi, rà soát và xác minh tài khoản ngân hàng của khách hàng trên hệ thống."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm theo khách hàng, ngân hàng, số tài khoản..."
      showSidebarAction={false}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleRefreshAccounts()}
            disabled={refreshing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#4d5565] shadow-[0_18px_40px_-30px_rgba(123,25,216,0.18)] transition-colors hover:text-[#7b19d8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Đang làm mới" : "Làm mới"}
          </button>
          <button
            type="button"
            onClick={() => void handleExportAccounts()}
            disabled={exporting}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#f3edff] px-5 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#eadbfd] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="size-4" />
            {exporting ? "Đang xuất" : "Xuất CSV"}
          </button>
        </div>
      }
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Tổng tài khoản"
          value={formatNumber(summary.total)}
          helper={`${formatNumber(filteredAccounts.length)} tài khoản đang hiển thị`}
          icon={WalletCards}
          iconClassName="bg-[#f3edff] text-[#7b19d8]"
        />
        <AdminStatCard
          label="Đã xác minh"
          value={formatNumber(summary.verified)}
          helper="Sẵn sàng dùng cho rút tiền và đối soát"
          icon={ShieldCheck}
          iconClassName="bg-[#f3edff] text-[#7b19d8]"
          valueClassName="text-[#7b19d8]"
        />
        <AdminStatCard
          label="Tài khoản chính"
          value={formatNumber(summary.primary)}
          helper="Các tài khoản được ưu tiên trong hồ sơ người dùng"
          icon={Landmark}
          iconClassName="bg-[#eef1ff] text-[#5868ff]"
          valueClassName="text-[#5868ff]"
        />
        <AdminStatCard
          label="Chờ hoặc khóa"
          value={formatNumber(summary.pending + summary.locked)}
          helper="Nhóm cần admin rà soát thêm trước khi sử dụng"
          icon={TriangleAlert}
          iconClassName="bg-[#fff0f5] text-[#d4525d]"
          valueClassName="text-[#d4525d]"
        />
      </section>

      <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
        <div className="border-b border-[#efe7f8] px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                Danh sách tài khoản ngân hàng
              </h2>
              <p className="mt-1 text-sm text-[#7b8190]">
                Lọc theo trạng thái để ưu tiên duyệt nhanh các hồ sơ chờ hoặc phát hiện tài khoản đang bị khóa.
              </p>
            </div>
            <div className="rounded-2xl bg-[#faf7ff] px-4 py-3 text-sm font-medium text-[#6a7080]">
              {formatNumber(filteredAccounts.length)} / {formatNumber(accounts.length)} tài khoản phù hợp
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#f1ecfb] p-1.5">
              {statusChips.map((chip) => {
                const active = chip.value === statusFilter;

                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setStatusFilter(chip.value)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-white text-[#2d2f32] shadow-[0_16px_35px_-28px_rgba(123,25,216,0.32)]"
                        : "text-[#7a8190] hover:text-[#7b19d8]"
                    }`}
                  >
                    <span>{chip.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        active ? "bg-[#f3edff] text-[#7b19d8]" : "bg-white/70 text-[#8b92a1]"
                      }`}
                    >
                      {formatNumber(chip.count)}
                    </span>
                  </button>
                );
              })}
            </div>

            {statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#faf7ff] px-4 text-sm font-semibold text-[#7b19d8] transition-colors hover:bg-[#f3edff]"
              >
                Bỏ lọc trạng thái
              </button>
            ) : (
              <p className="text-sm font-medium text-[#7b8190]">
                Nhấn vào biểu tượng mắt để xem chi tiết hồ sơ khách hàng.
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm font-medium text-[#6c7281]">
            Đang tải dữ liệu tài khoản ngân hàng...
          </div>
        ) : filteredAccounts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f4f1fa]">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                    Khách hàng
                  </th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                    Ngân hàng
                  </th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                    Số tài khoản
                  </th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                    Chi nhánh
                  </th>
                  <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                    Trạng thái
                  </th>
                  <th className="px-6 py-5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => {
                  const statusMeta = getStatusMeta(account.status);
                  const locked = account.status === "locked";

                  return (
                    <tr
                      key={account.id}
                      className="border-t border-[#f0ebf8] transition-colors hover:bg-[#fcfbff]"
                    >
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-[#2d2f32]">{account.customerName}</p>
                          <p className="text-xs text-[#7b8190]">
                            {account.customerCode} • Liên kết {account.linkedAt}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[#2d2f32]">{account.bankName}</p>
                          <p className="text-xs text-[#7b8190]">{account.accountHolder}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#2d2f32]">
                            {maskAccountNumber(account.accountNumber)}
                          </span>
                          {account.primary ? (
                            <span className="rounded-full bg-[#eef1ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5868ff]">
                              Chính
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-[#7b8190]">{account.branch}</td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedAccountId(account.id)}
                            className="flex size-9 items-center justify-center rounded-xl text-[#7b19d8] transition-colors hover:bg-[#f3edff]"
                            title="Xem chi tiết"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopy(account.accountNumber)}
                            className="flex size-9 items-center justify-center rounded-xl text-[#d4525d] transition-colors hover:bg-[#fff0f5]"
                            title="Sao chép số tài khoản"
                          >
                            <Copy className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleLock(account.id)}
                            className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                              locked
                                ? "text-[#00a46f] hover:bg-[#eefbf4]"
                                : "text-[#d4525d] hover:bg-[#fff0f5]"
                            }`}
                            title={locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                          >
                            {locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center text-sm font-medium text-[#6c7281]">
            Không có tài khoản ngân hàng phù hợp với từ khóa tìm kiếm.
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(selectedAccount)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAccountId(null);
          }
        }}
      >
        <DialogContent className="left-0 top-0 h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-none bg-[#fcfbff] p-0 shadow-none sm:max-w-none">
          {selectedAccount ? (
            <div className="h-full space-y-6 overflow-y-auto p-8">
              <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#2f134f_0%,#6d1fe6_58%,#ff77b7_100%)] p-6 text-white shadow-[0_28px_70px_-36px_rgba(123,25,216,0.52)]">
                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
                  <div className="space-y-6">
                    <DialogHeader className="space-y-3 text-left">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
                          {selectedAccount.id}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                            selectedAccount.status === "locked"
                              ? "bg-white/90 text-[#d4525d]"
                              : selectedAccount.status === "pending"
                                ? "bg-white/90 text-[#5868ff]"
                                : "bg-white/90 text-[#7b19d8]"
                          }`}
                        >
                          {getStatusMeta(selectedAccount.status).label}
                        </span>
                        {selectedAccount.primary ? (
                          <span className="rounded-full bg-white/14 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                            Tài khoản chính
                          </span>
                        ) : null}
                      </div>
                      <DialogTitle className="font-auth-headline text-3xl font-extrabold tracking-[-0.05em] text-white">
                        {selectedAccount.customerName}
                      </DialogTitle>
                      <DialogDescription className="max-w-2xl text-sm leading-7 text-white/78">
                        Hồ sơ chi tiết tài khoản ngân hàng khách hàng, gồm dữ liệu khai báo, thông tin
                        định danh và trạng thái rà soát hiện tại.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-[1.55rem] border border-white/18 bg-white/10 p-5 backdrop-blur-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/68">
                            Tài khoản nhận tiền
                          </p>
                          <p className="mt-3 text-2xl font-black tracking-[0.06em] text-white">
                            {selectedAccount.accountNumber}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white/82">
                            {selectedAccount.bankName} • {selectedAccount.branch}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopy(selectedAccount.accountNumber)}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2d1459] transition-transform active:scale-[0.98]"
                        >
                          <Copy className="size-4" />
                          Sao chép
                        </button>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/82">
                        <span>Chủ TK: {selectedAccount.accountHolder}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        <span>Mã NH: {selectedAccount.bankCode}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        <span>SWIFT: {selectedAccount.swiftCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">
                        Mã khách hàng
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">{selectedAccount.customerCode}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">
                        Điện thoại
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">{selectedAccount.linkedPhone}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">
                        Gửi lúc
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">{selectedAccount.submittedAt}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">
                        Cập nhật cuối
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">{selectedAccount.updatedAt}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className={detailCardClassName}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                        Hồ sơ định danh
                      </h3>
                      <p className="mt-1 text-sm text-[#7b8190]">
                        Thông tin người dùng dùng để đối chiếu trước khi duyệt giao dịch.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b19d8]">
                      Nhóm khách hàng
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <DetailField
                      label="Họ và tên"
                      value={selectedAccount.customerName}
                    />
                    <DetailField
                      label="Điện thoại liên kết"
                      value={selectedAccount.linkedPhone}
                    />
                    <DetailField
                      label="CCCD/CMND"
                      value={selectedAccount.identityNumber}
                      mono
                    />
                    <DetailField
                      label="Tỉnh/Thành phố"
                      value={selectedAccount.province}
                    />
                    <div className="rounded-2xl bg-[#faf8ff] px-4 py-3.5 md:col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                        Địa chỉ liên kết
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#2d2f32]">{selectedAccount.address}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className={detailCardClassName}>
                    <div>
                      <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                        Thông tin ngân hàng
                      </h3>
                      <p className="mt-1 text-sm text-[#7b8190]">
                        Dữ liệu ngân hàng mà khách hàng đã nhập trên biểu mẫu liên kết.
                      </p>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <DetailField
                        label="Ngân hàng"
                        value={selectedAccount.bankName}
                      />
                      <DetailField
                        label="Mã ngân hàng"
                        value={selectedAccount.bankCode}
                      />
                      <DetailField
                        label="Số tài khoản"
                        value={selectedAccount.accountNumber}
                        mono
                      />
                      <DetailField
                        label="Chủ tài khoản"
                        value={selectedAccount.accountHolder}
                      />
                      <DetailField
                        label="Chi nhánh"
                        value={selectedAccount.branch}
                      />
                      <DetailField
                        label="SWIFT Code"
                        value={selectedAccount.swiftCode}
                      />
                      <DetailField
                        label="Ngày liên kết"
                        value={selectedAccount.linkedAt}
                      />
                      <DetailField
                        label="Loại tài khoản"
                        value={selectedAccount.primary ? "Tài khoản chính" : "Tài khoản phụ"}
                      />
                    </div>
                  </div>

                  <div className={detailCardClassName}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                          Mã QR để quét
                        </h3>
                        <p className="mt-1 text-sm text-[#7b8190]">
                          Dùng để quét nhanh thông tin tài khoản. Nếu ngân hàng hỗ trợ VietQR thì mã sẽ ra trực tiếp theo chuẩn chuyển khoản.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b19d8]">
                        QR
                      </span>
                    </div>

                    <div className="mt-6 flex flex-col items-center gap-4 rounded-[1.7rem] border border-[#efe7ff] bg-[linear-gradient(180deg,#fcfbff_0%,#f6f2ff_100%)] p-5">
                      <div className="overflow-hidden rounded-[1.45rem] bg-white p-3 shadow-[0_22px_45px_-34px_rgba(123,25,216,0.22)] ring-1 ring-black/[0.04]">
                        <img
                          src={buildBankQrSrc(selectedAccount)}
                          alt={`QR tài khoản ${selectedAccount.bankName} ${selectedAccount.accountNumber}`}
                          className="size-60 rounded-[1rem] object-contain bg-white"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            const target = event.currentTarget;

                            if (target.dataset.fallbackApplied === "true") {
                              return;
                            }

                            target.dataset.fallbackApplied = "true";
                            target.src = buildQrFallbackSrc(selectedAccount);
                          }}
                        />
                      </div>

                      <div className="w-full rounded-2xl bg-white/88 px-4 py-3 text-center ring-1 ring-black/[0.04]">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8f96a4]">
                          Nội dung quét
                        </p>
                        <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                          {selectedAccount.bankName} • {selectedAccount.accountNumber}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#7b8190]">
                          Chủ tài khoản: {selectedAccount.accountHolder}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className={detailCardClassName}>
                  <div>
                    <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                      Ghi chú & kiểm duyệt
                    </h3>
                    <p className="mt-1 text-sm text-[#7b8190]">
                      Ghi chú do người dùng cung cấp và đánh giá nội bộ từ admin.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-2xl bg-[#faf8ff] p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                        Người dùng ghi chú
                      </p>
                      <p className="mt-3 text-sm leading-7 font-medium text-[#2d2f32]">
                        {selectedAccount.note ?? "Không có ghi chú bổ sung."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#ffd7e5] bg-[#fff8fb] p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#d4525d]">
                        Ghi chú xác minh nội bộ
                      </p>
                      <p className="mt-3 text-sm leading-7 font-medium text-[#2d2f32]">
                        {selectedAccount.verificationNote}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[1.55rem] bg-[#f3edff] p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.14)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7b19d8]">
                      Thao tác quản trị
                    </p>
                    <div className="mt-4 grid gap-3">
                      <button
                        type="button"
                        onClick={() => void handleCopy(selectedAccount.accountNumber)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#2d2f32] transition-colors hover:text-[#7b19d8]"
                      >
                        <Copy className="size-4" />
                        Sao chép số tài khoản đầy đủ
                      </button>
                      {selectedAccount.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleVerifyAccount(selectedAccount.id)}
                            disabled={submittingAction !== null}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-bold text-white shadow-[0_18px_36px_-24px_rgba(123,25,216,0.45)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ShieldCheck className="size-4" />
                            {submittingAction === "verify"
                              ? "Đang xác nhận..."
                              : "Xác nhận tài khoản"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRejectAccount(selectedAccount.id)}
                            disabled={submittingAction !== null}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#fff0f5] px-4 py-3 text-sm font-bold text-[#d4525d] transition-colors hover:bg-[#ffe6ee] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <TriangleAlert className="size-4" />
                            {submittingAction === "reject" ? "Đang từ chối..." : "Từ chối"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleToggleLock(selectedAccount.id)}
                          disabled={submittingAction !== null}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            selectedAccount.status === "locked"
                              ? "bg-[#eefbf4] text-[#00a46f]"
                              : "bg-[#fff0f5] text-[#d4525d]"
                          }`}
                        >
                          {selectedAccount.status === "locked" ? (
                            <LockOpen className="size-4" />
                          ) : (
                            <Lock className="size-4" />
                          )}
                          {submittingAction === "unlock"
                            ? "Đang mở khóa..."
                            : submittingAction === "lock"
                              ? "Đang khóa..."
                              : selectedAccount.status === "locked"
                                ? "Mở khóa tài khoản"
                                : "Khóa tài khoản"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={detailCardClassName}>
                    <h3 className="font-auth-headline text-lg font-bold text-[#2d2f32]">
                      Ghi chú vận hành
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#6f7283]">
                      Mọi thao tác xác minh, từ chối, khóa hoặc mở khóa giờ đều mở popup nhập lý do trước khi xác nhận.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {actionDialog && actionDialogDraft ? (
        <AdminActionReasonDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setActionDialog(null);
            }
          }}
          title={actionDialogDraft.title}
          description={actionDialogDraft.description}
          value={actionDialog.note}
          onValueChange={(note) => setActionDialog((current) => (current ? { ...current, note } : current))}
          onConfirm={() => void handleConfirmAccountAction()}
          confirmLabel={actionDialogDraft.confirmLabel}
          confirmClassName={actionDialogDraft.confirmClassName}
          loading={submittingAction === actionDialog.action}
          loadingLabel={actionDialogDraft.loadingLabel}
          presets={actionDialogDraft.presets}
          placeholder="Nhập lý do xử lý để lưu vào lịch sử xác minh nội bộ..."
          required
        />
      ) : null}
    </AdminShell>
  );
}
