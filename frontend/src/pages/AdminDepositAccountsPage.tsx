import AdminShell from "@/components/admin/AdminShell";
import AdminStatCard from "@/components/admin/AdminStatCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildAdminCsvFileName, downloadAdminCsv } from "@/lib/admin-tools";
import {
  buildAdminDepositAccountQrSrc,
  maskAdminDepositAccountNumber,
  type AdminDepositAccount,
} from "@/lib/admin-deposit-accounts";
import { findSupportedBank, supportedBanks } from "@/lib/bank-catalog";
import { adminService } from "@/services/adminService";
import axios from "axios";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Landmark,
  Plus,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface FormState {
  label: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  note: string;
}

const detailCardClassName =
  "rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]";

const createEmptyFormState = (): FormState => ({
  label: "",
  bankCode: supportedBanks[0]?.code ?? "VCB",
  accountNumber: "",
  accountHolder: "",
  branch: "",
  note: "",
});

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

const getStatusMeta = (status: AdminDepositAccount["status"]) => {
  switch (status) {
    case "active":
      return {
        label: "Đang hoạt động",
        className: "bg-[#eefbf4] text-[#00a46f]",
      };
    case "paused":
      return {
        label: "Tạm ngưng",
        className: "bg-[#fff0f5] text-[#d4525d]",
      };
  }
};

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
      <p className={`mt-2 text-sm font-bold text-[#2d2f32] ${mono ? "font-mono tracking-[0.04em]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export default function AdminDepositAccountsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [accounts, setAccounts] = useState<AdminDepositAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createEmptyFormState());
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | AdminDepositAccount["status"]>("all");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  const syncAccounts = async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoadingAccounts(true);
      }
      const res = await adminService.getDepositAccounts();
      setAccounts(res.accounts);
      return res.accounts;
    } catch (error) {
      console.error("Không tải được danh sách tài khoản nhận tiền", error);
      toast.error(getErrorMessage(error, "Không tải được danh sách tài khoản nhận tiền."));
      return [] as AdminDepositAccount[];
    } finally {
      if (showLoader) {
        setLoadingAccounts(false);
      }
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncAccounts();
      }
    };

    void syncAccounts(true);

    const handleFocus = () => {
      void syncAccounts();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        (statusFilter === "all" || account.status === statusFilter) &&
        (!deferredSearchTerm
          ? true
          : [
              account.label,
              account.bankName,
              account.bankCode,
              account.accountNumber,
              account.accountHolder,
              account.branch,
            ]
              .join(" ")
              .toLowerCase()
              .includes(deferredSearchTerm))
      ),
    [accounts, deferredSearchTerm, statusFilter]
  );

  const selectedAccount = useMemo(
    () =>
      filteredAccounts.find((account) => account.id === selectedAccountId) ??
      filteredAccounts[0] ??
      accounts.find((account) => account.id === selectedAccountId) ??
      accounts[0] ??
      null,
    [accounts, filteredAccounts, selectedAccountId]
  );

  useEffect(() => {
    if (!selectedAccountId && filteredAccounts[0]) {
      setSelectedAccountId(filteredAccounts[0].id);
      return;
    }

    if (selectedAccountId && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(filteredAccounts[0]?.id ?? accounts[0]?.id ?? null);
    }
  }, [accounts, filteredAccounts, selectedAccountId]);

  const summary = useMemo(() => {
    const activeCount = accounts.filter((account) => account.status === "active").length;
    const pausedCount = accounts.filter((account) => account.status === "paused").length;
    const primaryAccount = accounts.find((account) => account.isPrimary) ?? null;

    return {
      total: accounts.length,
      activeCount,
      pausedCount,
      primaryLabel: primaryAccount?.label ?? "Chưa có",
    };
  }, [accounts]);

  const statusChips: Array<{ value: "all" | AdminDepositAccount["status"]; label: string; count: number }> = [
    { value: "all", label: "Tất cả", count: accounts.length },
    { value: "active", label: "Đang hoạt động", count: summary.activeCount },
    { value: "paused", label: "Tạm ngưng", count: summary.pausedCount },
  ];

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${label.toLowerCase()}.`);
    } catch {
      toast.error(`Không thể sao chép ${label.toLowerCase()}.`);
    }
  };

  const handleRefreshAccounts = async () => {
    try {
      setRefreshing(true);
      await syncAccounts();
      toast.success("Đã làm mới danh sách tài khoản nhận tiền.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportAccounts = async () => {
    try {
      setExporting(true);

      if (filteredAccounts.length === 0) {
        toast.info("Không có tài khoản nhận tiền phù hợp để xuất.");
        return;
      }

      downloadAdminCsv(buildAdminCsvFileName("admin-deposit-accounts"), filteredAccounts, [
        { header: "Tên hiển thị", value: (account) => account.label },
        { header: "Ngân hàng", value: (account) => account.bankName },
        { header: "Mã ngân hàng", value: (account) => account.bankCode },
        { header: "Số tài khoản", value: (account) => account.accountNumber },
        { header: "Chủ tài khoản", value: (account) => account.accountHolder },
        { header: "Chi nhánh", value: (account) => account.branch },
        { header: "Trạng thái", value: (account) => getStatusMeta(account.status).label },
        { header: "Tài khoản chính", value: (account) => (account.isPrimary ? "Có" : "Không") },
        { header: "Ngày tạo", value: (account) => formatDateTime(account.createdAt) },
        { header: "Cập nhật", value: (account) => formatDateTime(account.updatedAt) },
        { header: "Ghi chú", value: (account) => account.note ?? "" },
      ]);
      toast.success(`Đã xuất ${filteredAccounts.length} tài khoản nhận tiền.`);
    } catch (error) {
      console.error("Không xuất được danh sách tài khoản nhận tiền", error);
      toast.error("Không xuất được danh sách tài khoản nhận tiền.");
    } finally {
      setExporting(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingAccountId(null);
    setFormState(createEmptyFormState());
    setFormOpen(true);
  };

  const handleOpenEdit = (account: AdminDepositAccount) => {
    setEditingAccountId(account.id);
    setFormState({
      label: account.label,
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      branch: account.branch,
      note: account.note ?? "",
    });
    setFormOpen(true);
  };

  const handleSaveAccount = async () => {
    const label = formState.label.trim();
    const bank = findSupportedBank({ bankCode: formState.bankCode });
    const accountNumber = formState.accountNumber.replace(/\s+/g, "");
    const accountHolder = formState.accountHolder.trim().toUpperCase();
    const branch = formState.branch.trim();
    const note = formState.note.trim();

    if (!label || !accountNumber || !accountHolder || !branch) {
      toast.error("Vui lòng nhập đầy đủ tên hiển thị, số tài khoản, chủ tài khoản và chi nhánh.");
      return;
    }

    if (!bank) {
      toast.error("Ngân hàng chưa được hỗ trợ trong danh mục hiện tại.");
      return;
    }

    try {
      setSavingAccount(true);

      if (editingAccountId) {
        const res = await adminService.updateDepositAccount(editingAccountId, {
          label,
          bankCode: bank.code,
          bankName: bank.name,
          accountNumber,
          accountHolder,
          branch,
          note,
        });

        await syncAccounts();
        setSelectedAccountId(editingAccountId);
        setFormOpen(false);
        toast.success(res.message || "Đã cập nhật tài khoản nhận tiền.");
        return;
      }

      const res = await adminService.createDepositAccount({
        label,
        bankCode: bank.code,
        bankName: bank.name,
        accountNumber,
        accountHolder,
        branch,
        note,
      });

      await syncAccounts();
      setSelectedAccountId(res.account.id);
      setFormOpen(false);
      toast.success(res.message || "Đã thêm tài khoản nhận tiền mới.");
    } catch (error) {
      console.error("Không lưu được tài khoản nhận tiền", error);
      toast.error(getErrorMessage(error, "Không lưu được tài khoản nhận tiền."));
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    const targetAccount = accounts.find((account) => account.id === accountId);

    if (!targetAccount) {
      toast.error("Không tìm thấy tài khoản nhận tiền.");
      return;
    }

    try {
      const res = await adminService.setPrimaryDepositAccount(accountId);

      await syncAccounts();
      setSelectedAccountId(accountId);
      toast.success(res.message || `Đã chuyển ${targetAccount.label.toLowerCase()} thành tài khoản chính.`);
    } catch (error) {
      console.error("Không cập nhật được tài khoản nhận tiền chính", error);
      toast.error(getErrorMessage(error, "Không cập nhật được tài khoản nhận tiền chính."));
    }
  };

  const handleToggleStatus = async (account: AdminDepositAccount) => {
    const nextStatus = account.status === "active" ? "paused" : "active";

    try {
      const res = await adminService.updateDepositAccountStatus(account.id, {
        status: nextStatus,
      });

      await syncAccounts();

      toast.success(
        res.message ||
          (nextStatus === "active"
            ? `Đã kích hoạt lại ${account.label.toLowerCase()}.`
            : `Đã tạm ngưng ${account.label.toLowerCase()}.`)
      );
    } catch (error) {
      console.error("Không cập nhật được trạng thái tài khoản nhận tiền", error);
      toast.error(getErrorMessage(error, "Không cập nhật được trạng thái tài khoản nhận tiền."));
    }
  };

  return (
    <>
      <AdminShell
        title="Tài khoản nhận tiền nạp"
        subtitle="Quản lý các tài khoản ngân hàng của admin dùng để user chuyển khoản khi nạp tiền."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm theo tên hiển thị, ngân hàng, số tài khoản..."
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
            <button
              type="button"
              onClick={handleOpenCreate}
              className="auth-premium-gradient auth-soft-shadow inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-transform active:scale-95"
            >
              <Plus className="size-4.5" />
              Thêm tài khoản nhận tiền
            </button>
          </div>
        }
        showSidebarAction={false}
      >
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Tổng tài khoản nhận tiền"
            value={`${summary.total}`}
            helper={`${filteredAccounts.length} tài khoản đang hiển thị`}
            icon={WalletCards}
            iconClassName="bg-[#f3edff] text-[#7b19d8]"
          />
          <AdminStatCard
            label="Đang hoạt động"
            value={`${summary.activeCount}`}
            helper="Nhóm tài khoản sẵn sàng hiển thị ở luồng nạp"
            icon={CheckCircle2}
            iconClassName="bg-[#eefbf4] text-[#00a46f]"
            valueClassName="text-[#00a46f]"
          />
          <AdminStatCard
            label="Tạm ngưng"
            value={`${summary.pausedCount}`}
            helper="Đã tắt khỏi luồng nạp mới của người dùng"
            icon={Clock3}
            iconClassName="bg-[#fff0f5] text-[#d4525d]"
            valueClassName="text-[#d4525d]"
          />
          <AdminStatCard
            label="Tài khoản chính"
            value={summary.primaryLabel === "Chưa có" ? "Chưa có" : "Đã thiết lập"}
            helper={
              summary.primaryLabel === "Chưa có"
                ? "Cần chọn một tài khoản mặc định cho QR nạp"
                : summary.primaryLabel
            }
            icon={ShieldCheck}
            iconClassName="bg-[#eef1ff] text-[#5868ff]"
            valueClassName="text-[#5868ff]"
          />
        </section>
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_430px]">
          <div className={detailCardClassName}>
            <div className="flex items-center justify-between gap-3 border-b border-[#efe7f8] pb-5">
              <div>
                <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                  Danh sách tài khoản nhận tiền
                </h2>
                <p className="mt-1 text-sm text-[#7c8090]">
                  Tài khoản chính đang hoạt động sẽ được dùng ở màn QR nạp của user.
                </p>
              </div>
              <span className="rounded-full bg-[#f4effd] px-3 py-1 text-xs font-bold text-[#7b19d8]">
                {filteredAccounts.length} tài khoản
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                        {chip.count}
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
                  Chọn một tài khoản để xem QR, đối soát và thao tác nhanh ở cột phải.
                </p>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {loadingAccounts ? (
                <div className="rounded-[1.35rem] border border-dashed border-[#e2d8f4] bg-[#fbf9ff] px-6 py-12 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                    <Clock3 className="size-6" />
                  </div>
                  <h2 className="mt-4 font-auth-headline text-xl font-bold text-[#2d2f32]">
                    Đang tải tài khoản nhận tiền
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#7c8090]">
                    Hệ thống đang đồng bộ dữ liệu tài khoản nhận tiền từ backend.
                  </p>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="rounded-[1.35rem] border border-dashed border-[#e2d8f4] bg-[#fbf9ff] px-6 py-12 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                    <TriangleAlert className="size-6" />
                  </div>
                  <h2 className="mt-4 font-auth-headline text-xl font-bold text-[#2d2f32]">
                    Không có tài khoản phù hợp
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#7c8090]">
                    Thử đổi từ khóa tìm kiếm hoặc thêm một tài khoản nhận tiền mới cho admin.
                  </p>
                </div>
              ) : (
                filteredAccounts.map((account) => {
                  const statusMeta = getStatusMeta(account.status);
                  const isSelected = selectedAccount?.id === account.id;

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setSelectedAccountId(account.id)}
                      className={`w-full rounded-[1.45rem] border p-5 text-left transition-all ${
                        isSelected
                          ? "border-[#d9c8f5] bg-[#faf7ff] shadow-[0_20px_48px_-40px_rgba(123,25,216,0.24)]"
                          : "border-transparent bg-[#fcfbff] hover:border-[#ece3fa]"
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-auth-headline text-lg font-bold text-[#2d2f32]">
                              {account.label}
                            </p>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                            {account.isPrimary ? (
                              <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-bold text-[#5868ff]">
                                Tài khoản chính
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#5d6370]">
                            {account.bankName} • {maskAdminDepositAccountNumber(account.accountNumber)}
                          </p>
                          <p className="mt-1 text-sm text-[#8b92a1]">
                            {account.accountHolder} • {account.branch}
                          </p>
                        </div>

                        <div className="text-left lg:text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9aa1af]">
                            Cập nhật gần nhất
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#525866]">
                            {formatDateTime(account.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {!account.isPrimary ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSetPrimary(account.id);
                            }}
                            className="rounded-full bg-[#eef1ff] px-4 py-2 text-sm font-semibold text-[#5868ff]"
                          >
                            Đặt làm chính
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleStatus(account);
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            account.status === "active"
                              ? "bg-[#fff0f5] text-[#d4525d]"
                              : "bg-[#eefbf4] text-[#00a46f]"
                          }`}
                        >
                          {account.status === "active" ? "Tạm ngưng" : "Kích hoạt"}
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEdit(account);
                          }}
                          className="rounded-full bg-[#f3edff] px-4 py-2 text-sm font-semibold text-[#7b19d8]"
                        >
                          Chỉnh sửa
                        </button>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className={`${detailCardClassName} sticky top-28 h-fit`}>
            {selectedAccount ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9aa1af]">
                      Tài khoản đang chọn
                    </p>
                    <h2 className="mt-2 font-auth-headline text-2xl font-bold text-[#2d2f32]">
                      {selectedAccount.label}
                    </h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      getStatusMeta(selectedAccount.status).className
                    }`}
                  >
                    {getStatusMeta(selectedAccount.status).label}
                  </span>
                </div>

                <div className="mt-5 overflow-hidden rounded-[1.45rem] bg-[#faf7ff] p-4">
                  <img
                    src={buildAdminDepositAccountQrSrc(selectedAccount, {
                      size: 320,
                    })}
                    alt={`QR ${selectedAccount.label}`}
                    className="mx-auto block w-full max-w-[18rem] rounded-[1rem] bg-white p-2 shadow-[0_20px_50px_-38px_rgba(16,38,51,0.38)]"
                  />
                  <p className="mt-3 text-center text-xs font-medium leading-5 text-[#7d8291]">
                    QR xem trước theo tài khoản đang chọn.
                  </p>
                </div>

                <div className="mt-6 grid gap-3">
                  <DetailField label="Ngân hàng" value={selectedAccount.bankName} />
                  <DetailField label="Mã ngân hàng" value={selectedAccount.bankCode} mono />
                  <DetailField label="Số tài khoản" value={selectedAccount.accountNumber} mono />
                  <DetailField label="Chủ tài khoản" value={selectedAccount.accountHolder} />
                  <DetailField label="Chi nhánh" value={selectedAccount.branch} />
                  <DetailField label="Ngày tạo" value={formatDateTime(selectedAccount.createdAt)} />
                  <DetailField label="Cập nhật" value={formatDateTime(selectedAccount.updatedAt)} />
                  <DetailField
                    label="Ghi chú"
                    value={selectedAccount.note || "Không có ghi chú bổ sung."}
                  />
                </div>

                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy("số tài khoản", selectedAccount.accountNumber)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#eef1ff] px-4 py-3 text-sm font-semibold text-[#5868ff]"
                  >
                    <Copy className="size-4" />
                    Sao chép số tài khoản
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy("tên chủ tài khoản", selectedAccount.accountHolder)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f3edff] px-4 py-3 text-sm font-semibold text-[#7b19d8]"
                  >
                    <Copy className="size-4" />
                    Sao chép chủ tài khoản
                  </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(selectedAccount.id)}
                    disabled={selectedAccount.isPrimary}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2d2f32] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ShieldCheck className="size-4" />
                    {selectedAccount.isPrimary ? "Đang là tài khoản chính" : "Đặt làm chính"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(selectedAccount)}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold ${
                      selectedAccount.status === "active"
                        ? "bg-[#fff0f5] text-[#d4525d]"
                        : "bg-[#eefbf4] text-[#00a46f]"
                    }`}
                  >
                    {selectedAccount.status === "active" ? "Tạm ngưng" : "Kích hoạt"}
                  </button>
                </div>

                <div className="mt-6 rounded-[1.25rem] bg-[#f8f5ff] px-4 py-4 text-sm leading-6 text-[#746d86]">
                  {selectedAccount.isPrimary && selectedAccount.status === "active"
                    ? "Tài khoản này hiện đang được dùng mặc định ở màn nạp tiền của user."
                    : "Chỉ tài khoản chính đang hoạt động mới được dùng để tạo QR và nội dung chuyển khoản cho user."}
                </div>
              </>
            ) : (
              <div className="rounded-[1.35rem] bg-[#fbf9ff] px-6 py-12 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                  <Landmark className="size-6" />
                </div>
                <h2 className="mt-4 font-auth-headline text-xl font-bold text-[#2d2f32]">
                  Chưa có tài khoản nào
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#7c8090]">
                  Thêm một tài khoản nhận tiền để user có thể quét QR và chuyển khoản khi nạp.
                </p>
              </div>
            )}
          </div>
        </section>
      </AdminShell>

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
      >
        <DialogContent className="flex max-h-[calc(100vh-1rem)] max-w-xl flex-col overflow-hidden rounded-[1.6rem] border-none bg-white p-0 shadow-[0_30px_80px_-45px_rgba(123,25,216,0.28)] sm:max-h-[calc(100vh-3rem)]">
          <DialogHeader className="shrink-0 border-b border-[#efe7f8] px-6 py-5">
            <DialogTitle className="font-auth-headline text-2xl font-bold text-[#2d2f32]">
              {editingAccountId ? "Cập nhật tài khoản nhận tiền" : "Thêm tài khoản nhận tiền"}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#7c8090]">
              Các thay đổi tại đây sẽ được dùng ngay cho luồng nạp tiền mới của user.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-6">
            <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[#4f5665]">Tên hiển thị</span>
              <input
                value={formState.label}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="Ví dụ: Tài khoản đối soát miền Bắc"
                className="h-12 rounded-2xl border border-[#e8def7] bg-[#faf7ff] px-4 text-sm outline-none transition-colors focus:border-[#c9b7ef]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#4f5665]">Ngân hàng</span>
                <select
                  value={formState.bankCode}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      bankCode: event.target.value,
                    }))
                  }
                  className="h-12 rounded-2xl border border-[#e8def7] bg-[#faf7ff] px-4 text-sm outline-none transition-colors focus:border-[#c9b7ef]"
                >
                  {supportedBanks.map((bank) => (
                    <option
                      key={bank.code}
                      value={bank.code}
                    >
                      {bank.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#4f5665]">Chi nhánh</span>
                <input
                  value={formState.branch}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      branch: event.target.value,
                    }))
                  }
                  placeholder="Ví dụ: CN Hà Nội"
                  className="h-12 rounded-2xl border border-[#e8def7] bg-[#faf7ff] px-4 text-sm outline-none transition-colors focus:border-[#c9b7ef]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#4f5665]">Số tài khoản</span>
                <input
                  value={formState.accountNumber}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      accountNumber: event.target.value,
                    }))
                  }
                  placeholder="Nhập số tài khoản"
                  className="h-12 rounded-2xl border border-[#e8def7] bg-[#faf7ff] px-4 text-sm outline-none transition-colors focus:border-[#c9b7ef]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#4f5665]">Chủ tài khoản</span>
                <input
                  value={formState.accountHolder}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      accountHolder: event.target.value,
                    }))
                  }
                  placeholder="Ví dụ: CONG TY SOCIAL TASKS"
                  className="h-12 rounded-2xl border border-[#e8def7] bg-[#faf7ff] px-4 text-sm outline-none transition-colors focus:border-[#c9b7ef]"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[#4f5665]">Ghi chú nội bộ</span>
              <textarea
                value={formState.note}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Mô tả mục đích sử dụng hoặc lưu ý đối soát..."
                className="min-h-28 rounded-2xl border border-[#e8def7] bg-[#faf7ff] px-4 py-3 text-sm outline-none transition-colors focus:border-[#c9b7ef]"
              />
            </label>
            </div>
          </div>

          <div className="shrink-0 flex flex-col-reverse gap-3 border-t border-[#efe7f8] px-6 py-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-full bg-[#f3eef9] px-5 py-3 text-sm font-semibold text-[#6b6480]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveAccount}
              disabled={savingAccount}
              className="rounded-full bg-[#2d2f32] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingAccount
                ? "Đang lưu..."
                : editingAccountId
                  ? "Lưu cập nhật"
                  : "Tạo tài khoản"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
