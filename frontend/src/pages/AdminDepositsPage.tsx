import AdminShell from "@/components/admin/AdminShell";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  buildAdminCsvFileName,
  downloadAdminCsv,
  isWithinAdminNumberRange,
  matchesAdminSearchTerm,
  parseAdminNumberFilter,
} from "@/lib/admin-tools";
import {
  formatDepositRequestedFull,
  type DepositRequest,
  type DepositStatus,
} from "@/lib/deposit-requests";
import { formatDepositCurrency } from "@/lib/deposit-checkout";
import { adminService } from "@/services/adminService";
import axios from "axios";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  Filter,
  Landmark,
  RefreshCcw,
  ReceiptText,
  TriangleAlert,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const tabs = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "approved", label: "Đã duyệt" },
  { id: "rejected", label: "Từ chối" },
] as const;

type DepositTab = (typeof tabs)[number]["id"];
type DepositReviewDecision = Exclude<DepositStatus, "pending">;
type DepositMethodFilter = "all" | DepositRequest["methodId"];
type DepositSortKey = "newest" | "oldest" | "amount_desc" | "amount_asc";

const pageSize = 5;

const detailCardClassName =
  "rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]";

const formatVnd = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

const getStatusMeta = (status: DepositStatus) => {
  switch (status) {
    case "pending":
      return {
        label: "Chờ duyệt",
        className: "bg-[#eef1ff] text-[#5868ff]",
      };
    case "approved":
      return {
        label: "Đã duyệt",
        className: "bg-[#eefbf4] text-[#00a46f]",
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

export default function AdminDepositsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<DepositTab>("all");
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<{ requestId: string; status: DepositReviewDecision } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [methodFilter, setMethodFilter] = useState<DepositMethodFilter>("all");
  const [bankFilter, setBankFilter] = useState("");
  const [minimumAmountInput, setMinimumAmountInput] = useState("");
  const [maximumAmountInput, setMaximumAmountInput] = useState("");
  const [bonusOnly, setBonusOnly] = useState(false);
  const [sortKey, setSortKey] = useState<DepositSortKey>("newest");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  useEffect(() => {
    let active = true;

    const syncRequests = async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoadingRequests(true);
        }

        const data = await adminService.getDepositRequests();

        if (!active) {
          return;
        }

        setRequests(data.requests);
      } catch (error) {
        console.error("Không tải được danh sách yêu cầu nạp tiền", error);

        if (!active) {
          return;
        }

        setRequests([]);
        toast.error(getErrorMessage(error, "Không tải được danh sách yêu cầu nạp tiền."));
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

  useEffect(() => {
    setPage(1);
  }, [activeTab, bankFilter, bonusOnly, deferredSearchTerm, maximumAmountInput, methodFilter, minimumAmountInput, sortKey]);

  const handleRefreshRequests = async () => {
    try {
      setRefreshing(true);
      const data = await adminService.getDepositRequests();
      setRequests(data.requests);
      toast.success("Đã làm mới danh sách yêu cầu nạp.");
    } catch (error) {
      console.error("Không làm mới được danh sách yêu cầu nạp tiền", error);
      toast.error(getErrorMessage(error, "Không làm mới được danh sách yêu cầu nạp tiền."));
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
          [
            request.id,
            request.userName,
            request.userId,
            request.bankName,
            request.accountNumber,
            request.accountHolder,
            request.transferCode,
          ]
            .join(" ")
            .toLowerCase()
            .includes(deferredSearchTerm);

        const matchesTab = activeTab === "all" || request.status === activeTab;
        const matchesMethod = methodFilter === "all" || request.methodId === methodFilter;
        const matchesBank =
          !normalizedBankFilter ||
          matchesAdminSearchTerm(normalizedBankFilter, [request.bankName, request.bankCode, request.accountNumber]);
        const matchesAmount = isWithinAdminNumberRange(request.amount, minimumAmount, maximumAmount);
        const matchesBonus = !bonusOnly || request.bonusAmount > 0;

        return matchesSearch && matchesTab && matchesMethod && matchesBank && matchesAmount && matchesBonus;
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
    [activeTab, bonusOnly, deferredSearchTerm, maximumAmount, methodFilter, minimumAmount, normalizedBankFilter, requests, sortKey]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  const paginatedRequests = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredRequests.slice(startIndex, startIndex + pageSize);
  }, [filteredRequests, page]);

  const selectedRequest = useMemo(
    () =>
      filteredRequests.find((request) => request.id === selectedRequestId) ??
      paginatedRequests[0] ??
      null,
    [filteredRequests, paginatedRequests, selectedRequestId]
  );

  useEffect(() => {
    if (!selectedRequestId && paginatedRequests[0]) {
      setSelectedRequestId(paginatedRequests[0].id);
      return;
    }

    if (selectedRequestId && !filteredRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(paginatedRequests[0]?.id ?? null);
    }
  }, [filteredRequests, paginatedRequests, selectedRequestId]);

  const summary = useMemo(() => {
    const activeRequests = requests.filter((request) => request.status !== "rejected");
    const totalAmount = activeRequests.reduce((total, request) => total + request.amount, 0);
    const pendingCount = requests.filter((request) => request.status === "pending").length;
    const approvedCount = requests.filter((request) => request.status === "approved").length;
    const rejectedCount = requests.filter((request) => request.status === "rejected").length;

    return {
      totalAmount,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  }, [requests]);

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${label.toLowerCase()}.`);
    } catch {
      toast.error(`Không thể sao chép ${label.toLowerCase()}.`);
    }
  };

  const handleResetAdvancedFilters = () => {
    setMethodFilter("all");
    setBankFilter("");
    setMinimumAmountInput("");
    setMaximumAmountInput("");
    setBonusOnly(false);
    setSortKey("newest");
  };

  const hasAdvancedFilters =
    methodFilter !== "all" ||
    Boolean(normalizedBankFilter) ||
    minimumAmount !== null ||
    maximumAmount !== null ||
    bonusOnly ||
    sortKey !== "newest";

  const openReviewDialog = (request: DepositRequest, status: DepositReviewDecision) => {
    if (request.status !== "pending") {
      toast.info(`Yêu cầu ${request.id} đã được xử lý.`);
      return;
    }

    setSelectedRequestId(request.id);
    setReviewAction({ requestId: request.id, status });
    setReviewNote(
      status === "approved"
        ? "Đã đối soát đúng giao dịch và xác nhận cộng tiền cho người dùng."
        : "Không xác minh được giao dịch nạp hoặc nội dung chuyển khoản không khớp."
    );
  };

  const submitReview = async (
    request: DepositRequest,
    status: DepositReviewDecision,
    note?: string
  ) => {
    try {
      setProcessingRequestId(request.id);
      const res = await adminService.updateDepositRequestStatus(request.id, {
        status,
        note: note?.trim() || undefined,
      });

      setRequests((current) =>
        current.map((item) => (item.id === request.id ? res.request : item))
      );
      setSelectedRequestId(request.id);
      if (status === "approved") {
        toast.success(`Đã duyệt yêu cầu nạp ${request.id}.`);
      } else {
        toast.info(`Đã từ chối yêu cầu nạp ${request.id}.`);
      }
      return true;
    } catch (error) {
      console.error("Không cập nhật được yêu cầu nạp tiền", error);
      toast.error(
        getErrorMessage(
          error,
          status === "approved" ? "Không thể duyệt yêu cầu nạp tiền." : "Không thể cập nhật yêu cầu nạp tiền."
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
      toast.error("Không tìm thấy yêu cầu nạp để xử lý.");
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
        toast.info("Không có yêu cầu nạp nào phù hợp để xuất.");
        return;
      }

      downloadAdminCsv(buildAdminCsvFileName("admin-deposits"), filteredRequests, [
        { header: "Mã yêu cầu", value: (request) => request.id },
        { header: "Người dùng", value: (request) => request.userName },
        { header: "ID người dùng", value: (request) => request.userId },
        { header: "Trạng thái", value: (request) => getStatusMeta(request.status).label },
        { header: "Phương thức", value: (request) => request.methodTitle },
        { header: "Ngân hàng", value: (request) => request.bankName },
        { header: "Số tài khoản", value: (request) => request.accountNumber },
        { header: "Chủ tài khoản", value: (request) => request.accountHolder },
        { header: "Số tiền nạp", value: (request) => request.amount },
        { header: "Thưởng", value: (request) => request.bonusAmount },
        { header: "Tổng cộng ví", value: (request) => request.totalAmount },
        { header: "Nội dung chuyển khoản", value: (request) => request.transferCode },
        { header: "Thời gian yêu cầu", value: (request) => formatDepositRequestedFull(request) },
        { header: "Ghi chú", value: (request) => request.note ?? "" },
      ]);
      toast.success(`Đã xuất ${filteredRequests.length} yêu cầu nạp.`);
    } catch (error) {
      console.error("Không xuất được danh sách yêu cầu nạp", error);
      toast.error("Không xuất được danh sách yêu cầu nạp.");
    } finally {
      setExporting(false);
    }
  };

  const startRow = filteredRequests.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, filteredRequests.length);

  return (
    <AdminShell
      title="Quản lý nạp"
      subtitle="Theo dõi yêu cầu nạp tiền của user và cập nhật trạng thái đối soát ngay trong admin."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm mã nạp, user, nội dung chuyển khoản..."
      showSidebarAction={false}
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Tổng tiền chờ/đã nạp"
          value={formatDepositCurrency(summary.totalAmount)}
          helper={`${filteredRequests.length} yêu cầu phù hợp sau khi lọc`}
          icon={Landmark}
          iconClassName="bg-[#f3edff] text-[#7b19d8]"
        />
        <AdminStatCard
          label="Đang chờ duyệt"
          value={`${summary.pendingCount}`}
          helper="Ưu tiên đối soát chứng từ và nội dung chuyển khoản"
          icon={Clock3}
          iconClassName="bg-[#eef1ff] text-[#5868ff]"
          valueClassName="text-[#5868ff]"
        />
        <AdminStatCard
          label="Đã duyệt"
          value={`${summary.approvedCount}`}
          helper="Đã cộng tiền thành công vào ví người dùng"
          icon={CheckCircle2}
          iconClassName="bg-[#eefbf4] text-[#00a46f]"
          valueClassName="text-[#00a46f]"
        />
        <AdminStatCard
          label="Đã từ chối"
          value={`${summary.rejectedCount}`}
          helper="Các giao dịch sai lệch hoặc không đủ điều kiện"
          icon={ReceiptText}
          iconClassName="bg-[#fff3e9] text-[#df7b24]"
          valueClassName="text-[#df7b24]"
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_420px]">
        <div className={detailCardClassName}>
          <div className="border-b border-[#efe7f8] pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2">
                  {tabs.map((tab) => {
                    const active = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-[#2d2f32] text-white"
                            : "bg-[#f5f1fb] text-[#6f7283] hover:bg-[#ece4fb]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((currentValue) => !currentValue)}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#f5f1fb] px-4 text-sm font-semibold text-[#4c5566] transition-colors hover:text-[#7b19d8]"
                >
                  <Filter className="size-4" />
                  {filtersOpen ? "Ẩn bộ lọc" : "Lọc nâng cao"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRefreshRequests()}
                  disabled={refreshing}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#f5f1fb] px-4 text-sm font-semibold text-[#4c5566] transition-colors hover:text-[#7b19d8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Đang làm mới" : "Làm mới"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportRequests()}
                  disabled={exporting}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#f3edff] px-4 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#eadbfd] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="size-4" />
                  {exporting ? "Đang xuất" : "Xuất CSV"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm font-medium text-[#7d8291]">
                Hiển thị {startRow}-{endRow} / {filteredRequests.length} yêu cầu
              </div>
              {hasAdvancedFilters ? (
                <button
                  type="button"
                  onClick={handleResetAdvancedFilters}
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#faf7ff] px-4 text-sm font-semibold text-[#7b19d8] transition-colors hover:bg-[#f3edff]"
                >
                  Đặt lại lọc nâng cao
                </button>
              ) : null}
            </div>

            {filtersOpen ? (
              <div className="mt-6 rounded-[1.45rem] bg-[#faf7ff] p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Phương thức</span>
                    <select
                      value={methodFilter}
                      onChange={(event) => setMethodFilter(event.target.value as DepositMethodFilter)}
                      className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                    >
                      <option value="all">Tất cả</option>
                      <option value="bank">Chuyển khoản ngân hàng</option>
                      <option value="momo">MoMo</option>
                      <option value="zalopay">ZaloPay</option>
                      <option value="phone-card">Thẻ cào</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Ngân hàng</span>
                    <input
                      value={bankFilter}
                      onChange={(event) => setBankFilter(event.target.value)}
                      placeholder="VCB, MBB, 1900..."
                      className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Sắp xếp</span>
                    <select
                      value={sortKey}
                      onChange={(event) => setSortKey(event.target.value as DepositSortKey)}
                      className="h-12 w-full rounded-2xl border border-[#e8deff] bg-white px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                    >
                      <option value="newest">Mới nhất</option>
                      <option value="oldest">Cũ nhất</option>
                      <option value="amount_desc">Số tiền cao xuống thấp</option>
                      <option value="amount_asc">Số tiền thấp lên cao</option>
                    </select>
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

                  <label className="flex items-center gap-3 rounded-2xl border border-[#e8deff] bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={bonusOnly}
                      onChange={(event) => setBonusOnly(event.target.checked)}
                      className="size-4 rounded border-[#d5c5fb] text-[#7b19d8] focus:ring-[#d7c1ff]"
                    />
                    <span className="text-sm font-semibold text-[#2d2f32]">Chỉ giao dịch có thưởng</span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {loadingRequests ? (
              <div className="rounded-[1.35rem] border border-dashed border-[#e2d8f4] bg-[#fbf9ff] px-6 py-12 text-center text-sm font-medium text-[#7c8090]">
                Đang tải danh sách yêu cầu nạp tiền...
              </div>
            ) : paginatedRequests.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-[#e2d8f4] bg-[#fbf9ff] px-6 py-12 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                  <TriangleAlert className="size-6" />
                </div>
                <h2 className="mt-4 font-auth-headline text-xl font-bold text-[#2d2f32]">
                  Chưa có yêu cầu nạp nào
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#7c8090]">
                  Khi user xác nhận đã chuyển khoản ở màn nạp tiền, yêu cầu sẽ xuất hiện tại đây để admin duyệt.
                </p>
              </div>
            ) : (
              paginatedRequests.map((request) => {
                const statusMeta = getStatusMeta(request.status);
                const isSelected = selectedRequest?.id === request.id;
                const actionable = request.status === "pending";
                const processing = processingRequestId === request.id;

                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
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
                            #{request.id}
                          </p>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#5d6370]">{request.userName}</p>
                        <p className="mt-1 text-sm text-[#8b92a1]">
                          {request.userId} • {request.bankName} • {request.accountNumber}
                        </p>
                      </div>

                      <div className="text-left lg:text-right">
                        <p className="font-auth-headline text-[1.5rem] font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                          {formatVnd(request.amount)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#8b92a1]">
                          {formatDepositRequestedFull(request)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#5868ff]">
                        {request.methodTitle}
                      </span>
                      <span className="rounded-full bg-[#f6f1ff] px-3 py-1 text-xs font-semibold text-[#7b19d8]">
                        {request.transferCode}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedRequestId(request.id);
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-[#f3edff] px-4 py-2 text-sm font-semibold text-[#7b19d8]"
                      >
                        <Eye className="size-4" />
                        Chi tiết
                      </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openReviewDialog(request, "approved");
                          }}
                          disabled={!actionable || processing}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                            actionable
                              ? "bg-[#eefbf4] text-[#00a46f] hover:bg-[#ddf7eb]"
                              : "bg-[#eeedf2] text-[#9aa1af] opacity-70"
                          }`}
                        >
                          <Check className="size-4" />
                          {processing && actionable ? "Đang duyệt..." : "Duyệt"}
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openReviewDialog(request, "rejected");
                          }}
                          disabled={!actionable || processing}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                            actionable
                              ? "bg-[#fff0f5] text-[#d4525d] hover:bg-[#ffe4ec]"
                              : "bg-[#eeedf2] text-[#9aa1af] opacity-70"
                          }`}
                        >
                          <X className="size-4" />
                          {processing && actionable ? "Đang từ chối..." : "Từ chối"}
                        </button>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {filteredRequests.length > pageSize ? (
            <div className="mt-6 flex items-center justify-between border-t border-[#efe7f8] pt-5">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-2 rounded-full bg-[#f5f1fb] px-4 py-2 text-sm font-semibold text-[#6f7283] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <ChevronLeft className="size-4" />
                Trang trước
              </button>

              <p className="text-sm font-medium text-[#7d8291]">
                Trang {page} / {totalPages}
              </p>

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-2 rounded-full bg-[#f5f1fb] px-4 py-2 text-sm font-semibold text-[#6f7283] disabled:cursor-not-allowed disabled:opacity-55"
              >
                Trang sau
                <ChevronRight className="size-4" />
              </button>
            </div>
          ) : null}
        </div>

        <div className={`${detailCardClassName} sticky top-28 h-fit`}>
          {selectedRequest ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9aa1af]">
                    Chi tiết yêu cầu nạp
                  </p>
                  <h2 className="mt-2 font-auth-headline text-2xl font-bold text-[#2d2f32]">
                    #{selectedRequest.id}
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    getStatusMeta(selectedRequest.status).className
                  }`}
                >
                  {getStatusMeta(selectedRequest.status).label}
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                <DetailField label="Người dùng" value={selectedRequest.userName} />
                <DetailField label="Mã user" value={selectedRequest.userId} mono />
                <DetailField label="Phương thức" value={selectedRequest.methodTitle} />
                <DetailField
                  label="Số tiền nạp"
                  value={`${formatDepositCurrency(selectedRequest.amount)} VND`}
                />
                <DetailField
                  label="Số dư cộng vào ví"
                  value={`${formatDepositCurrency(selectedRequest.totalAmount)} VND`}
                />
                <DetailField label="Ngân hàng nhận" value={selectedRequest.bankName} />
                <DetailField label="Số tài khoản nhận" value={selectedRequest.accountNumber} mono />
                <DetailField label="Chủ tài khoản nhận" value={selectedRequest.accountHolder} />
                <DetailField
                  label="Nội dung chuyển khoản"
                  value={selectedRequest.transferCode}
                  mono
                />
                <DetailField
                  label="Thời gian tạo"
                  value={formatDepositRequestedFull(selectedRequest)}
                />
                <DetailField
                  label="Ghi chú hệ thống"
                  value={selectedRequest.note || "Không có ghi chú bổ sung."}
                />
              </div>

              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy("nội dung chuyển khoản", selectedRequest.transferCode)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#eef1ff] px-4 py-3 text-sm font-semibold text-[#5868ff]"
                >
                  <Copy className="size-4" />
                  Sao chép nội dung chuyển khoản
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy("số tài khoản nhận", selectedRequest.accountNumber)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f3edff] px-4 py-3 text-sm font-semibold text-[#7b19d8]"
                >
                  <Copy className="size-4" />
                  Sao chép số tài khoản nhận
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openReviewDialog(selectedRequest, "approved")}
                  disabled={selectedRequest.status !== "pending" || processingRequestId === selectedRequest.id}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed ${
                    selectedRequest.status === "pending"
                      ? "bg-[#00a46f] text-white shadow-[0_18px_40px_-30px_rgba(0,164,111,0.45)] hover:bg-[#009a69]"
                      : "bg-[#eeedf2] text-[#9aa1af] shadow-none opacity-70"
                  }`}
                >
                  <Check className="size-4" />
                  {processingRequestId === selectedRequest.id && selectedRequest.status === "pending"
                    ? "Đang duyệt..."
                    : selectedRequest.status === "approved"
                      ? "Đã duyệt"
                      : selectedRequest.status === "rejected"
                        ? "Đã khóa thao tác"
                        : "Duyệt nạp"}
                </button>
                <button
                  type="button"
                  onClick={() => openReviewDialog(selectedRequest, "rejected")}
                  disabled={selectedRequest.status !== "pending" || processingRequestId === selectedRequest.id}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed ${
                    selectedRequest.status === "pending"
                      ? "bg-[#fff0f5] text-[#d4525d] hover:bg-[#ffe4ec]"
                      : "bg-[#eeedf2] text-[#9aa1af] opacity-70"
                  }`}
                >
                  <X className="size-4" />
                  {processingRequestId === selectedRequest.id && selectedRequest.status === "pending"
                    ? "Đang từ chối..."
                    : selectedRequest.status === "rejected"
                      ? "Đã từ chối"
                      : selectedRequest.status === "approved"
                        ? "Đã khóa thao tác"
                        : "Từ chối"}
                </button>
              </div>

              <div className="mt-6 rounded-[1.25rem] bg-[#f8f5ff] px-4 py-4 text-sm leading-6 text-[#746d86]">
                Duyệt giao dịch này sẽ đưa user từ màn chờ sang màn thành công khi họ mở lại tab hoặc quay lại ứng dụng.
              </div>
            </>
          ) : (
            <div className="rounded-[1.35rem] bg-[#fbf9ff] px-6 py-12 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                <ReceiptText className="size-6" />
              </div>
              <h2 className="mt-4 font-auth-headline text-xl font-bold text-[#2d2f32]">
                Chưa có yêu cầu để xem
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7c8090]">
                Chọn một yêu cầu ở danh sách bên trái để xem chi tiết hoặc chờ user phát sinh giao dịch nạp mới.
              </p>
            </div>
          )}
        </div>
      </section>

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
                {reviewAction?.status === "approved" ? "Duyệt yêu cầu nạp" : "Từ chối yêu cầu nạp"}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6 text-[#6f7283]">
                Ghi chú này sẽ được lưu cùng lịch sử xử lý để đội vận hành đối soát lại giao dịch khi cần.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 rounded-[1.35rem] bg-[#faf7ff] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Gợi ý ghi chú</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(reviewAction?.status === "approved"
                  ? [
                      "Đã đối soát giao dịch và cộng tiền thành công.",
                      "Nội dung chuyển khoản khớp, xác nhận duyệt nạp.",
                    ]
                  : [
                      "Không khớp nội dung chuyển khoản, từ chối xử lý.",
                      "Không đủ căn cứ xác minh giao dịch nạp này.",
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
                  reviewAction?.status === "approved" ? "bg-[#00a46f] hover:bg-[#009a69]" : "bg-[#d4525d] hover:bg-[#c84954]"
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
