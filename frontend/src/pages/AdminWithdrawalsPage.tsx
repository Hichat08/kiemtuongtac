import AdminShell from "@/components/admin/AdminShell";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { buildBankQrSrc as buildSharedBankQrSrc } from "@/lib/bank-catalog";
import {
  buildWithdrawalTransferContent,
  formatWithdrawalRequestedFull,
  isInternalWithdrawal,
  type WithdrawalRequest,
  type WithdrawalStatus,
} from "@/lib/withdrawal-requests";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  buildAdminCsvFileName,
  downloadAdminCsv,
  isWithinAdminNumberRange,
  matchesAdminSearchTerm,
  parseAdminNumberFilter,
} from "@/lib/admin-tools";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Eye,
  Filter,
  Landmark,
  RefreshCcw,
  X,
  XCircle,
} from "lucide-react";
import { adminService } from "@/services/adminService";
import axios from "axios";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const tabs = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "approved", label: "Đã duyệt" },
  { id: "rejected", label: "Từ chối" },
] as const;

type WithdrawalTab = (typeof tabs)[number]["id"];
type WithdrawalReviewDecision = Exclude<WithdrawalStatus, "pending">;
type WithdrawalTypeFilter = "all" | "bank" | "internal";
type WithdrawalProcessingFilter = "all" | NonNullable<WithdrawalRequest["processingMode"]>;
type WithdrawalSortKey = "newest" | "oldest" | "amount_desc" | "amount_asc";

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

const detailCardClassName =
  "rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

const buildTransferContent = (request: WithdrawalRequest) =>
  request.confirmationCode ?? buildWithdrawalTransferContent(request.userId);

const getDestinationAccount = (request: WithdrawalRequest) =>
  isInternalWithdrawal(request) ? request.internalRecipientAccountId || request.bankAccount : request.bankAccount;

const buildWithdrawalQrFallbackPayload = (request: WithdrawalRequest) =>
  [
    `NGAN HANG: ${request.bankName}`,
    `SO TAI KHOAN: ${request.bankAccount}`,
    `CHU TAI KHOAN: ${request.accountHolder}`,
    `SO TIEN: ${request.amount}`,
    `NOI DUNG: ${buildTransferContent(request)}`,
  ].join("\n");

const buildWithdrawalQrSrc = (request: WithdrawalRequest) => {
  return buildSharedBankQrSrc({
    bankCode: request.bankCode,
    bankName: request.bankName,
    accountNumber: request.bankAccount,
    accountHolder: request.accountHolder,
    amount: request.amount,
    addInfo: buildTransferContent(request),
    fallbackLines: buildWithdrawalQrFallbackPayload(request).split("\n"),
    size: 320,
  });
};

const getStatusMeta = (status: WithdrawalStatus) => {
  switch (status) {
    case "pending":
      return {
        label: "Chờ duyệt",
        className: "bg-[#eef1ff] text-[#5868ff]",
      };
    case "approved":
      return {
        label: "Đã duyệt",
        className: "bg-[#f3edff] text-[#7b19d8]",
      };
    case "rejected":
      return {
        label: "Từ chối",
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

export default function AdminWithdrawalsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<WithdrawalTab>("all");
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<{ requestId: string; status: WithdrawalReviewDecision } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [withdrawalTypeFilter, setWithdrawalTypeFilter] = useState<WithdrawalTypeFilter>("all");
  const [processingModeFilter, setProcessingModeFilter] = useState<WithdrawalProcessingFilter>("all");
  const [bankFilter, setBankFilter] = useState("");
  const [minimumAmountInput, setMinimumAmountInput] = useState("");
  const [maximumAmountInput, setMaximumAmountInput] = useState("");
  const [sortKey, setSortKey] = useState<WithdrawalSortKey>("newest");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());
  const pageSize = 4;

  useEffect(() => {
    setPage(1);
  }, [activeTab, bankFilter, deferredSearchTerm, maximumAmountInput, minimumAmountInput, processingModeFilter, sortKey, withdrawalTypeFilter]);

  useEffect(() => {
    let active = true;

    const syncRequests = async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoadingRequests(true);
        }

        const data = await adminService.getWithdrawalRequests();

        if (!active) {
          return;
        }

        setRequests(data.requests);
      } catch (error) {
        console.error("Không tải được danh sách yêu cầu rút tiền", error);

        if (!active) {
          return;
        }

        setRequests([]);
        toast.error(getErrorMessage(error, "Không tải được danh sách yêu cầu rút tiền."));
      } finally {
        if (active && showLoader) {
          setLoadingRequests(false);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncRequests();
      }
    };

    const handleWindowFocus = () => {
      void syncRequests();
    };

    void syncRequests(true);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleRefreshRequests = async () => {
    try {
      setRefreshing(true);
      const data = await adminService.getWithdrawalRequests();
      setRequests(data.requests);
      toast.success("Đã làm mới danh sách yêu cầu rút.");
    } catch (error) {
      console.error("Không làm mới được danh sách yêu cầu rút tiền", error);
      toast.error(getErrorMessage(error, "Không làm mới được danh sách yêu cầu rút tiền."));
    } finally {
      setRefreshing(false);
    }
  };

  const minimumAmount = parseAdminNumberFilter(minimumAmountInput);
  const maximumAmount = parseAdminNumberFilter(maximumAmountInput);
  const normalizedBankFilter = bankFilter.trim().toLowerCase();

  const filteredRequests = useMemo(
    () => {
      const nextRequests = requests.filter((request) => {
        const matchesSearch =
          !deferredSearchTerm ||
          [request.id, request.userName, request.userId, request.bankName, request.bankAccount]
            .join(" ")
            .toLowerCase()
            .includes(deferredSearchTerm);
        const matchesTab = activeTab === "all" || request.status === activeTab;
        const matchesType =
          withdrawalTypeFilter === "all" ||
          (withdrawalTypeFilter === "internal" ? isInternalWithdrawal(request) : !isInternalWithdrawal(request));
        const matchesProcessingMode =
          processingModeFilter === "all" || request.processingMode === processingModeFilter;
        const matchesBank =
          !normalizedBankFilter ||
          matchesAdminSearchTerm(normalizedBankFilter, [
            request.bankName,
            request.bankCode,
            request.bankAccount,
            request.accountHolder,
          ]);
        const matchesAmount = isWithinAdminNumberRange(request.amount, minimumAmount, maximumAmount);

        return matchesSearch && matchesTab && matchesType && matchesProcessingMode && matchesBank && matchesAmount;
      });

      return [...nextRequests].sort((leftRequest, rightRequest) => {
        switch (sortKey) {
          case "oldest":
            return (leftRequest.createdAtMs ?? 0) - (rightRequest.createdAtMs ?? 0);
          case "amount_desc":
            return rightRequest.amount - leftRequest.amount;
          case "amount_asc":
            return leftRequest.amount - rightRequest.amount;
          case "newest":
          default:
            return (rightRequest.createdAtMs ?? 0) - (leftRequest.createdAtMs ?? 0);
        }
      });
    },
    [
      activeTab,
      deferredSearchTerm,
      maximumAmount,
      minimumAmount,
      normalizedBankFilter,
      processingModeFilter,
      requests,
      sortKey,
      withdrawalTypeFilter,
    ]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  const paginatedRequests = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredRequests.slice(startIndex, startIndex + pageSize);
  }, [filteredRequests, page]);

  const summary = useMemo(() => {
    const activeRequests = requests.filter((item) => item.status !== "rejected");
    const totalAmount = activeRequests.reduce((total, item) => total + item.amount, 0);
    const pendingCount = requests.filter((item) => item.status === "pending").length;
    const approvedCount = requests.filter((item) => item.status === "approved").length;
    const rejectedCount = requests.filter((item) => item.status === "rejected").length;

    return {
      totalAmount,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  }, [requests]);

  const startRow = filteredRequests.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, filteredRequests.length);
  const selectedRequest = useMemo(
    () => filteredRequests.find((request) => request.id === selectedRequestId) ?? null,
    [filteredRequests, selectedRequestId]
  );
  const selectedRequestIsInternal = selectedRequest ? isInternalWithdrawal(selectedRequest) : false;

  const handleTabChange = (tab: WithdrawalTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  useEffect(() => {
    if (selectedRequestId && !filteredRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(null);
    }
  }, [filteredRequests, selectedRequestId]);

  const hasAdvancedFilters =
    withdrawalTypeFilter !== "all" ||
    processingModeFilter !== "all" ||
    Boolean(normalizedBankFilter) ||
    minimumAmount !== null ||
    maximumAmount !== null ||
    sortKey !== "newest";

  const handleResetAdvancedFilters = () => {
    setWithdrawalTypeFilter("all");
    setProcessingModeFilter("all");
    setBankFilter("");
    setMinimumAmountInput("");
    setMaximumAmountInput("");
    setSortKey("newest");
  };

  const openReviewDialog = (request: WithdrawalRequest, status: WithdrawalReviewDecision) => {
    if (request.status !== "pending") {
      toast.info(`Yêu cầu ${request.id} đã xử lý rồi.`);
      return;
    }

    if (isInternalWithdrawal(request)) {
      toast.info(`Yêu cầu ${request.id} là giao dịch nội bộ, hệ thống tự xử lý.`);
      return;
    }

    setSelectedRequestId(request.id);
    setReviewAction({ requestId: request.id, status });
    setReviewNote(
      status === "approved"
        ? "Đã đối soát thông tin thụ hưởng và xác nhận chi trả thành công."
        : "Thông tin thụ hưởng không hợp lệ hoặc chưa đủ điều kiện chi trả."
    );
  };

  const submitReview = async (
    request: WithdrawalRequest,
    status: WithdrawalReviewDecision,
    note?: string
  ) => {
    try {
      setProcessingRequestId(request.id);
      const res = await adminService.updateWithdrawalRequestStatus(request.id, {
        status,
        note: note?.trim() || undefined,
      });

      setRequests((current) =>
        current.map((item) => (item.id === request.id ? res.request : item))
      );
      if (status === "approved") {
        toast.success(`Đã duyệt yêu cầu ${request.id}.`);
      } else {
        toast.info(`Đã từ chối yêu cầu ${request.id}.`);
      }
      return true;
    } catch (error) {
      console.error("Không cập nhật được yêu cầu rút tiền", error);
      toast.error(
        getErrorMessage(
          error,
          status === "approved" ? "Không thể duyệt yêu cầu rút tiền." : "Không thể cập nhật yêu cầu rút tiền."
        )
      );
      return false;
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleConfirmReview = async () => {
    if (!reviewAction) {
      return;
    }

    const request = requests.find((item) => item.id === reviewAction.requestId);

    if (!request) {
      toast.error("Không tìm thấy yêu cầu rút để xử lý.");
      return;
    }

    const reviewSubmitted = await submitReview(request, reviewAction.status, reviewNote);

    if (reviewSubmitted) {
      setReviewAction(null);
    }
  };

  const handleExportRequests = async () => {
    try {
      setExporting(true);

      if (filteredRequests.length === 0) {
        toast.info("Không có yêu cầu rút nào phù hợp để xuất.");
        return;
      }

      downloadAdminCsv(buildAdminCsvFileName("admin-withdrawals"), filteredRequests, [
        { header: "Mã yêu cầu", value: (request) => request.id },
        { header: "Người dùng", value: (request) => request.userName },
        { header: "ID người dùng", value: (request) => request.userId },
        { header: "Hình thức", value: (request) => (isInternalWithdrawal(request) ? "Chuyển nội bộ" : "Ngân hàng") },
        { header: "Trạng thái", value: (request) => getStatusMeta(request.status).label },
        { header: "Ngân hàng", value: (request) => request.bankName },
        { header: "Số tài khoản đích", value: (request) => getDestinationAccount(request) },
        { header: "Người thụ hưởng", value: (request) => request.accountHolder },
        { header: "Số tiền", value: (request) => request.amount },
        { header: "Phí", value: (request) => request.feeAmount ?? 0 },
        { header: "Thực nhận", value: (request) => request.receivableAmount ?? request.amount },
        { header: "Chế độ xử lý", value: (request) => request.processingModeLabel ?? request.processingMode ?? "" },
        { header: "Thời gian yêu cầu", value: (request) => formatWithdrawalRequestedFull(request) },
        { header: "Ghi chú", value: (request) => request.note ?? "" },
      ]);
      toast.success(`Đã xuất ${filteredRequests.length} yêu cầu rút.`);
    } catch (error) {
      console.error("Không xuất được danh sách yêu cầu rút", error);
      toast.error("Không xuất được danh sách yêu cầu rút.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${label}.`);
    } catch (error) {
      console.error(`Không sao chép được ${label}`, error);
      toast.error(`Không sao chép được ${label}.`);
    }
  };

  return (
    <AdminShell
      title="Quản lý Yêu cầu Rút tiền"
      subtitle="Theo dõi và phê duyệt các yêu cầu rút tiền hoặc chuyển nội bộ từ người dùng hệ thống."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm kiếm người dùng, mã giao dịch..."
      showSidebarAction={false}
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Tổng yêu cầu rút"
          value={formatCurrency(summary.totalAmount)}
          helper={`${filteredRequests.length} yêu cầu phù hợp sau khi lọc`}
          icon={CreditCard}
          iconClassName="bg-[#f3edff] text-[#7b19d8]"
        />
        <AdminStatCard
          label="Đang chờ xử lý"
          value={`${summary.pendingCount}`}
          helper="Cần kiểm tra số dư, ngân hàng và chế độ xử lý"
          icon={Clock3}
          iconClassName="bg-[#eef1ff] text-[#5868ff]"
          valueClassName="text-[#5868ff]"
        />
        <AdminStatCard
          label="Đã phê duyệt"
          value={`${summary.approvedCount}`}
          helper="Đã chuyển tiền hoặc xác nhận nội bộ thành công"
          icon={CheckCircle2}
          iconClassName="bg-[#f3edff] text-[#7b19d8]"
        />
        <AdminStatCard
          label="Đã từ chối"
          value={`${summary.rejectedCount}`}
          helper="Nhóm yêu cầu sai thông tin hoặc bị chặn"
          icon={XCircle}
          iconClassName="bg-[#fff0f5] text-[#d4525d]"
          valueClassName="text-[#d4525d]"
        />
      </section>

      <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
        <div className="px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#f1ecfb] p-1.5">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-white text-[#2d2f32] shadow-[0_16px_35px_-28px_rgba(123,25,216,0.32)]"
                        : "text-[#7a8190] hover:text-[#7b19d8]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((currentValue) => !currentValue)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#f1ecfb] px-4 text-sm font-semibold text-[#4c5566] transition-colors hover:text-[#7b19d8]"
              >
                <Filter className="size-4" />
                {filtersOpen ? "Ẩn bộ lọc" : "Lọc nâng cao"}
              </button>
              <button
                type="button"
                onClick={() => void handleRefreshRequests()}
                disabled={refreshing}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#f1ecfb] px-4 text-sm font-semibold text-[#4c5566] transition-colors hover:text-[#7b19d8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Đang làm mới" : "Làm mới"}
              </button>
              <button
                type="button"
                onClick={() => void handleExportRequests()}
                disabled={exporting}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-2xl bg-[#f3edff] px-4 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#eadbfd] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="size-4" />
                {exporting ? "Đang xuất" : "Xuất CSV"}
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div className="mt-5 rounded-[1.45rem] bg-[#faf7ff] p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Hình thức</span>
                  <select
                    value={withdrawalTypeFilter}
                    onChange={(event) => setWithdrawalTypeFilter(event.target.value as WithdrawalTypeFilter)}
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  >
                    <option value="all">Tất cả</option>
                    <option value="bank">Ngân hàng</option>
                    <option value="internal">Chuyển nội bộ</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Chế độ xử lý</span>
                  <select
                    value={processingModeFilter}
                    onChange={(event) => setProcessingModeFilter(event.target.value as WithdrawalProcessingFilter)}
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  >
                    <option value="all">Tất cả</option>
                    <option value="manual">Thủ công</option>
                    <option value="standard">Tiêu chuẩn</option>
                    <option value="instant">Tức thì</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Ngân hàng hoặc TK</span>
                  <input
                    value={bankFilter}
                    onChange={(event) => setBankFilter(event.target.value)}
                    placeholder="VCB, MBB, 1900..."
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Từ số tiền</span>
                  <input
                    inputMode="numeric"
                    value={minimumAmountInput}
                    onChange={(event) => setMinimumAmountInput(event.target.value)}
                    placeholder="0"
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Đến số tiền</span>
                  <input
                    inputMode="numeric"
                    value={maximumAmountInput}
                    onChange={(event) => setMaximumAmountInput(event.target.value)}
                    placeholder="99999999"
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Sắp xếp</span>
                  <select
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as WithdrawalSortKey)}
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="amount_desc">Số tiền cao xuống thấp</option>
                    <option value="amount_asc">Số tiền thấp lên cao</option>
                  </select>
                </label>
              </div>

              {hasAdvancedFilters ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetAdvancedFilters}
                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-[#7b19d8] ring-1 ring-[#e8deff] transition-colors hover:bg-[#f3edff]"
                  >
                    Đặt lại lọc nâng cao
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {loadingRequests ? (
          <div className="px-6 py-16 text-center text-sm font-medium text-[#6c7281]">
            Đang tải danh sách yêu cầu rút tiền...
          </div>
        ) : paginatedRequests.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-[#f4f1fa]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      STT
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Người dùng
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Ngân hàng
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Số tiền
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Thời gian
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.map((request, index) => {
                    const statusMeta = getStatusMeta(request.status);
                    const internalRequest = isInternalWithdrawal(request);
                    const actionable = request.status === "pending" && !internalRequest;

                    return (
                      <tr
                        key={request.id}
                        className="border-t border-[#f0ebf8] transition-colors hover:bg-[#fcfbff]"
                      >
                        <td className="px-6 py-5 text-sm font-semibold text-[#7b8190]">
                          {String(startRow + index).padStart(2, "0")}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-[#f3edff] text-sm font-bold text-[#7b19d8]">
                              {request.userName
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase() ?? "")
                                .join("")}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#2d2f32]">{request.userName}</p>
                              <p className="text-[11px] text-[#7b8190]">ID: {request.userId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-[#f4f1fa] text-[#7b19d8]">
                              <Landmark className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#2d2f32]">{request.bankName}</p>
                              <p className="text-[11px] font-mono text-[#7b8190]">
                                {getDestinationAccount(request)}
                              </p>
                              {internalRequest ? (
                                <span className="mt-1 inline-flex rounded-full bg-[#eefbf4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#00a46f]">
                                  Chuyển nội bộ
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm font-bold text-[#00b884]">
                          {formatCurrency(request.amount)}
                        </td>
                        <td className="px-6 py-5 text-sm text-[#7b8190]">
                          {formatWithdrawalRequestedFull(request)}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedRequestId(request.id)}
                              className="flex size-9 items-center justify-center rounded-xl text-[#5868ff] transition-colors hover:bg-[#eef1ff]"
                              title="Xem chi tiết"
                            >
                              <Eye className="size-4.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openReviewDialog(request, "approved")}
                              className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                                actionable
                                  ? "text-[#7b19d8] hover:bg-[#f3edff]"
                                  : "cursor-not-allowed text-[#c4bbd4]"
                              }`}
                              disabled={!actionable || processingRequestId === request.id}
                              title="Duyệt"
                            >
                              <Check className="size-4.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openReviewDialog(request, "rejected")}
                              className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                                actionable
                                  ? "text-[#d4525d] hover:bg-[#fff0f5]"
                                  : "cursor-not-allowed text-[#d9d0e6]"
                              }`}
                              disabled={!actionable || processingRequestId === request.id}
                              title="Từ chối"
                            >
                              <X className="size-4.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-[#f0ebf8] px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs font-medium text-[#7b8190]">
                Hiển thị {startRow}-{endRow} trong tổng số {filteredRequests.length} yêu cầu
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={page === 1}
                  className="flex size-9 items-center justify-center rounded-xl text-[#7b8190] transition-colors hover:bg-[#f4f1fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`flex size-9 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                      pageNumber === page
                        ? "bg-gradient-primary text-white"
                        : "text-[#4e5667] hover:bg-[#f4f1fa]"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                  disabled={page === totalPages}
                  className="flex size-9 items-center justify-center rounded-xl text-[#7b8190] transition-colors hover:bg-[#f4f1fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 py-16 text-center text-sm font-medium text-[#6c7281]">
            Không có yêu cầu rút tiền phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequestId(null);
          }
        }}
      >
        <DialogContent className="left-0 top-0 h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-none bg-[#fcfbff] p-0 shadow-none sm:max-w-none">
          {selectedRequest ? (
            <div className="h-full space-y-6 overflow-y-auto p-8">
              <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#241046_0%,#6d1fe6_56%,#ff89bb_100%)] p-6 text-white shadow-[0_28px_70px_-36px_rgba(123,25,216,0.52)]">
                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
                  <div className="space-y-6">
                    <DialogHeader className="space-y-3 text-left">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
                          {selectedRequest.id}
                        </span>
                        <span className={`inline-flex rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getStatusMeta(selectedRequest.status).className}`}>
                          {getStatusMeta(selectedRequest.status).label}
                        </span>
                        <span className="rounded-full bg-white/14 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                          {selectedRequest.userId}
                        </span>
                      </div>
                      <DialogTitle className="font-auth-headline text-3xl font-extrabold tracking-[-0.05em] text-white">
                        {selectedRequest.userName}
                      </DialogTitle>
                      <DialogDescription className="max-w-2xl text-sm leading-7 text-white/78">
                        {selectedRequestIsInternal
                          ? "Hồ sơ chi tiết giao dịch chuyển nội bộ, gồm người nhận, ID nội bộ và trạng thái xử lý tức thì."
                          : "Hồ sơ chi tiết yêu cầu rút tiền, gồm thông tin nhận tiền, QR chuyển khoản đã gắn sẵn số tiền và nội dung để đối soát nhanh."}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-[1.55rem] border border-white/18 bg-white/10 p-5 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/68">Số tiền cần chuyển</p>
                      <p className="mt-3 font-auth-headline text-4xl font-black tracking-[-0.05em] text-white">
                        {formatCurrency(selectedRequest.amount)}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/82">
                        <span>{selectedRequestIsInternal ? "Hình thức" : "Ngân hàng"}: {selectedRequest.bankName}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        <span>{selectedRequestIsInternal ? "ID" : "TK"}: {getDestinationAccount(selectedRequest)}</span>
                        {!selectedRequestIsInternal ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                            <span>Nội dung: {buildTransferContent(selectedRequest)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">
                        {selectedRequestIsInternal ? "Người nhận nội bộ" : "Người thụ hưởng"}
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">{selectedRequest.accountHolder}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">
                        {selectedRequestIsInternal ? "Kênh xử lý" : "Chi nhánh"}
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {selectedRequestIsInternal ? "Hệ thống nội bộ" : selectedRequest.branch}
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">Yêu cầu lúc</p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {formatWithdrawalRequestedFull(selectedRequest)}
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">
                        {selectedRequestIsInternal ? "Mã nội bộ" : "Mã ngân hàng"}
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">{selectedRequest.bankCode}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
                <div className="space-y-6">
                  {selectedRequestIsInternal ? (
                    <>
                      <div className={detailCardClassName}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Chuyển nội bộ</h3>
                            <p className="mt-1 text-sm text-[#7b8190]">
                              Lệnh này được hệ thống hạch toán ngay sau khi người dùng xác nhận OTP, không cần admin
                              quét QR hay chuyển khoản thủ công.
                            </p>
                          </div>
                          <span className="rounded-full bg-[#eefbf4] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#00a46f]">
                            AUTO
                          </span>
                        </div>

                        <div className="mt-6 rounded-[1.7rem] border border-[#dff4e8] bg-[linear-gradient(180deg,#fafffc_0%,#eefbf4_100%)] p-5">
                          <div className="grid gap-4 md:grid-cols-2">
                            <DetailField label="Số tiền đã chuyển" value={formatCurrency(selectedRequest.amount)} />
                            <DetailField label="Trạng thái" value={getStatusMeta(selectedRequest.status).label} />
                            <DetailField label="Người nhận nội bộ" value={selectedRequest.accountHolder} />
                            <DetailField
                              label="Số tài khoản nội bộ"
                              value={getDestinationAccount(selectedRequest)}
                              mono
                            />
                          </div>
                          <div className="mt-4 rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-black/[0.04]">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8f96a4]">
                              Mã xác nhận chuyển nội bộ
                            </p>
                            <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                              {buildTransferContent(selectedRequest)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={detailCardClassName}>
                        <h3 className="font-auth-headline text-lg font-bold text-[#2d2f32]">Thông tin giao dịch</h3>
                        <div className="mt-6 grid gap-4">
                          <DetailField label="Hình thức" value={selectedRequest.bankName} />
                          <DetailField
                            label="Số tài khoản nội bộ"
                            value={getDestinationAccount(selectedRequest)}
                            mono
                          />
                          <DetailField label="Người nhận" value={selectedRequest.accountHolder} />
                          <DetailField label="Ghi nhận lúc" value={formatWithdrawalRequestedFull(selectedRequest)} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={detailCardClassName}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">QR chuyển khoản</h3>
                            <p className="mt-1 text-sm text-[#7b8190]">
                              Mã quét đã gắn sẵn đúng số tiền và nội dung để đội kế toán hoặc admin chuyển khoản nhanh.
                            </p>
                          </div>
                          <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7b19d8]">
                            QR
                          </span>
                        </div>

                        <div className="mt-6 flex flex-col items-center gap-4 rounded-[1.7rem] border border-[#efe7ff] bg-[linear-gradient(180deg,#fcfbff_0%,#f6f2ff_100%)] p-5">
                          <div className="overflow-hidden rounded-[1.45rem] bg-white p-3 shadow-[0_22px_45px_-34px_rgba(123,25,216,0.22)] ring-1 ring-black/[0.04]">
                            <img
                              src={buildWithdrawalQrSrc(selectedRequest)}
                              alt={`QR chuyển khoản ${selectedRequest.id}`}
                              className="size-64 rounded-[1rem] object-contain bg-white"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                const target = event.currentTarget;
                                if (target.dataset.fallbackApplied === "true") {
                                  return;
                                }
                                target.dataset.fallbackApplied = "true";
                                target.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
                                  buildWithdrawalQrFallbackPayload(selectedRequest)
                                )}`;
                              }}
                            />
                          </div>
                          <div className="w-full rounded-2xl bg-white/88 px-4 py-3 text-center ring-1 ring-black/[0.04]">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8f96a4]">
                              Nội dung quét
                            </p>
                            <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                              {buildTransferContent(selectedRequest)}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#7b8190]">
                              {selectedRequest.bankName} • {formatCurrency(selectedRequest.amount)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={detailCardClassName}>
                        <h3 className="font-auth-headline text-lg font-bold text-[#2d2f32]">Thông tin chuyển khoản</h3>
                        <div className="mt-6 grid gap-4">
                          <DetailField label="Số tiền" value={formatCurrency(selectedRequest.amount)} />
                          <DetailField label="Nội dung chuyển khoản" value={buildTransferContent(selectedRequest)} mono />
                          <DetailField label="Số tài khoản nhận" value={selectedRequest.bankAccount} mono />
                          <DetailField label="Chủ tài khoản" value={selectedRequest.accountHolder} />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-6">
                  <div className={detailCardClassName}>
                    <div>
                      <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Hồ sơ thụ hưởng</h3>
                      <p className="mt-1 text-sm text-[#7b8190]">
                        {selectedRequestIsInternal
                          ? "Thông tin người nhận nội bộ và số tài khoản đích để đối soát lịch sử cộng tiền."
                          : "Thông tin người nhận tiền và ngân hàng đích để đối soát trước khi chi trả."}
                      </p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <DetailField label={selectedRequestIsInternal ? "Người gửi" : "Người dùng"} value={selectedRequest.userName} />
                      <DetailField
                        label={selectedRequestIsInternal ? "ID người gửi" : "ID người dùng"}
                        value={selectedRequest.userId}
                        mono
                      />
                      <DetailField
                        label={selectedRequestIsInternal ? "Người nhận nội bộ" : "Ngân hàng"}
                        value={selectedRequestIsInternal ? selectedRequest.accountHolder : selectedRequest.bankName}
                      />
                      <DetailField
                        label={selectedRequestIsInternal ? "Số tài khoản nội bộ" : "Chi nhánh"}
                        value={selectedRequestIsInternal ? getDestinationAccount(selectedRequest) : selectedRequest.branch}
                        mono={selectedRequestIsInternal}
                      />
                      <DetailField
                        label={selectedRequestIsInternal ? "Hình thức" : "Mã ngân hàng"}
                        value={selectedRequestIsInternal ? selectedRequest.bankName : selectedRequest.bankCode}
                      />
                      <DetailField label="Trạng thái" value={getStatusMeta(selectedRequest.status).label} />
                    </div>
                  </div>

                  <div className={detailCardClassName}>
                    <div>
                      <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Ghi chú & kiểm tra</h3>
                      <p className="mt-1 text-sm text-[#7b8190]">
                        {selectedRequestIsInternal
                          ? "Khu vực để admin đối soát lịch sử cộng tiền và kiểm tra thông tin người nhận nội bộ."
                          : "Khu vực để admin rà lại nội dung đối soát trước khi bấm duyệt hoặc từ chối."}
                      </p>
                    </div>
                    <div className="mt-6 grid gap-4">
                      <div className="rounded-2xl bg-[#faf8ff] p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Ghi chú nội bộ</p>
                        <p className="mt-3 text-sm leading-7 font-medium text-[#2d2f32]">
                          {selectedRequest.note ?? "Chưa có ghi chú bổ sung cho yêu cầu này."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#e6ddf8] bg-[#fcfbff] p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7b19d8]">Checklist chi trả</p>
                        <div className="mt-3 space-y-2 text-sm font-medium text-[#4e5667]">
                          {selectedRequestIsInternal ? (
                            <>
                              <p>1. Đối chiếu đúng người nhận nội bộ và số tài khoản nội bộ đích.</p>
                              <p>2. Giao dịch này được hệ thống xử lý tức thì, không cần quét QR hay chuyển khoản ngoài.</p>
                              <p>3. Chỉ cần kiểm tra lịch sử giao dịch và xác nhận người nhận đã được cộng tiền.</p>
                            </>
                          ) : (
                            <>
                              <p>1. Đối chiếu đúng tên chủ tài khoản và số tài khoản nhận.</p>
                              <p>2. Quét QR hoặc sao chép đúng nội dung chuyển khoản để tránh lệch đối soát.</p>
                              <p>3. Chỉ bấm duyệt khi trạng thái tài khoản ngân hàng của user đã ổn định.</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.55rem] bg-[#f3edff] p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.14)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7b19d8]">Thao tác quản trị</p>
                    <div className="mt-4 grid gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(
                            getDestinationAccount(selectedRequest),
                            selectedRequestIsInternal ? "số tài khoản nội bộ" : "số tài khoản"
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#2d2f32] transition-colors hover:text-[#7b19d8]"
                      >
                        <Copy className="size-4" />
                        {selectedRequestIsInternal ? "Sao chép số tài khoản nội bộ" : "Sao chép số tài khoản"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy(
                            buildTransferContent(selectedRequest),
                            selectedRequestIsInternal ? "mã xác nhận nội bộ" : "nội dung chuyển khoản"
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#2d2f32] transition-colors hover:text-[#7b19d8]"
                      >
                        <Copy className="size-4" />
                        {selectedRequestIsInternal ? "Sao chép mã xác nhận" : "Sao chép nội dung chuyển khoản"}
                      </button>
                      {selectedRequestIsInternal ? (
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-medium leading-6 text-[#5f6772]">
                          Giao dịch nội bộ không cần admin duyệt. Hệ thống đã tự trừ tiền ở tài khoản gửi và cộng đúng số
                          tiền đó cho tài khoản nhận theo số tài khoản nội bộ.
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openReviewDialog(selectedRequest, "approved")}
                            disabled={
                              selectedRequest.status !== "pending" ||
                              processingRequestId === selectedRequest.id
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f3edff] px-4 py-3 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#eadbfd] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Check className="size-4.5" />
                            Duyệt yêu cầu
                          </button>
                          <button
                            type="button"
                            onClick={() => openReviewDialog(selectedRequest, "rejected")}
                            disabled={
                              selectedRequest.status !== "pending" ||
                              processingRequestId === selectedRequest.id
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#fff0f5] px-4 py-3 text-sm font-bold text-[#d4525d] transition-colors hover:bg-[#ffe4ec] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <X className="size-4.5" />
                            Từ chối yêu cầu
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewAction)}
        onOpenChange={(open) => {
          if (!open) {
            setReviewAction(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-[1.6rem] border-none bg-white p-0 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.35)]">
          <div className="p-6 sm:p-7">
            <DialogHeader className="text-left">
              <DialogTitle className="font-auth-headline text-2xl font-bold text-[#2d2f32]">
                {reviewAction?.status === "approved" ? "Duyệt yêu cầu rút" : "Từ chối yêu cầu rút"}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6 text-[#6f7283]">
                Ghi chú sẽ được lưu vào lịch sử xử lý để đội kế toán hoặc vận hành có thể rà soát lại sau.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 rounded-[1.35rem] bg-[#faf7ff] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Gợi ý ghi chú</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(reviewAction?.status === "approved"
                  ? [
                      "Đã chuyển khoản đúng người thụ hưởng và xác nhận hoàn tất.",
                      "Đã đối soát QR/nội dung và xác nhận chi trả thành công.",
                    ]
                  : [
                      "Thông tin người thụ hưởng không hợp lệ, từ chối chi trả.",
                      "Chưa đủ điều kiện xử lý hoặc cần user cập nhật lại tài khoản nhận.",
                    ]
                ).map((notePreset) => (
                  <button
                    key={notePreset}
                    type="button"
                    onClick={() => setReviewNote(notePreset)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#5868ff] ring-1 ring-[#e8deff] transition-colors hover:bg-[#eef1ff]"
                  >
                    {notePreset}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Nhập ghi chú xử lý để lưu vào log admin..."
              className="mt-5 min-h-36 rounded-[1.35rem] border-[#e8deff] bg-[#fcfbff] px-4 py-3 text-sm text-[#2d2f32] focus-visible:ring-[#d8c5ff]"
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setReviewAction(null)}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#f4f1fa] px-5 text-sm font-semibold text-[#5c6473] transition-colors hover:bg-[#ece7f6]"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmReview()}
                disabled={
                  !reviewAction ||
                  Boolean(processingRequestId) ||
                  (reviewAction.status === "rejected" && !reviewNote.trim())
                }
                className={`inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  reviewAction?.status === "approved" ? "bg-[#7b19d8] hover:bg-[#6a16bb]" : "bg-[#d4525d] hover:bg-[#c84954]"
                }`}
              >
                {processingRequestId
                  ? "Đang xử lý..."
                  : reviewAction?.status === "approved"
                    ? "Xác nhận duyệt"
                    : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
