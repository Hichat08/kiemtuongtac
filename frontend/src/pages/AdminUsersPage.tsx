import AdminActionReasonDialog from "@/components/admin/AdminActionReasonDialog";
import AdminShell from "@/components/admin/AdminShell";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildAdminCsvFileName, downloadAdminCsv } from "@/lib/admin-tools";
import { adminService } from "@/services/adminService";
import type {
  AdminModerationStatus,
  AdminUserDetailResponse,
  AdminUserModerationAction,
  AdminUserRow,
  AdminUserStatusFilter,
  AdminUserWalletSummary,
  AdminUsersResponse,
} from "@/types/admin";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Filter,
  Lock,
  LockOpen,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import axios from "axios";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const detailCardClassName =
  "rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]";

type UserActionDialogState =
  | {
      type: "moderation";
      action: AdminUserModerationAction;
      note: string;
    }
  | {
      type: "wallet_clear";
      note: string;
    };

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatCurrency = (value: number) => `${formatNumber(value)}đ`;
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
        new Date(value)
      )
    : "--/--/----";
const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "--:-- --/--/----";
const formatDisplayId = (value?: string | null) => value?.replace(/^#/, "").trim() ?? "";
const getInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

const getModerationActionDraft = (action: AdminUserModerationAction) => {
  switch (action) {
    case "warn":
      return {
        title: "Gửi cảnh cáo người dùng",
        description: "Lý do này sẽ được lưu cùng hồ sơ moderation để tiện rà soát lại về sau.",
        confirmLabel: "Xác nhận cảnh cáo",
        confirmClassName: "bg-[#c97a12] hover:bg-[#bb7211]",
        loadingLabel: "Đang gửi cảnh cáo...",
        defaultNote: "Cảnh cáo do phát hiện dấu hiệu vi phạm quy định hoặc thao tác bất thường.",
        presets: [
          "Cảnh cáo do phát hiện dấu hiệu spam hoặc thao tác lặp bất thường.",
          "Cảnh cáo do nội dung/tương tác có dấu hiệu vi phạm quy định cộng đồng.",
        ],
      };
    case "lock":
      return {
        title: "Khóa tài khoản",
        description: "Tài khoản sẽ bị khóa ngay sau khi xác nhận, nên lý do cần rõ ràng để phục vụ kiểm soát nội bộ.",
        confirmLabel: "Xác nhận khóa",
        confirmClassName: "bg-[#d4525d] hover:bg-[#c84954]",
        loadingLabel: "Đang khóa...",
        defaultNote: "Khóa tạm tài khoản để rà soát dấu hiệu gian lận hoặc vi phạm điều khoản sử dụng.",
        presets: [
          "Khóa tạm do phát hiện dấu hiệu gian lận tài chính hoặc lợi dụng hệ thống.",
          "Khóa tạm để kiểm tra chuỗi thao tác bất thường trên tài khoản này.",
        ],
      };
    case "unlock":
      return {
        title: "Mở khóa tài khoản",
        description: "Ghi chú nên nêu rõ căn cứ mở khóa để tránh mất dấu lịch sử xử lý sau này.",
        confirmLabel: "Xác nhận mở khóa",
        confirmClassName: "bg-[#00a46f] hover:bg-[#009767]",
        loadingLabel: "Đang mở khóa...",
        defaultNote: "Mở khóa tài khoản sau khi đã rà soát và xác nhận có thể khôi phục hoạt động bình thường.",
        presets: [
          "Đã hoàn tất rà soát và xác nhận tài khoản đủ điều kiện hoạt động lại.",
          "Mở khóa sau khi người dùng bổ sung giải trình và không còn dấu hiệu bất thường.",
        ],
      };
    case "clear":
      return {
        title: "Bỏ cảnh cáo hiện tại",
        description: "Thao tác này gỡ trạng thái cảnh cáo đang hoạt động, vì vậy nên ghi rõ căn cứ để lưu vào hồ sơ moderation.",
        confirmLabel: "Xác nhận bỏ cảnh cáo",
        confirmClassName: "bg-[#5868ff] hover:bg-[#4d5ce8]",
        loadingLabel: "Đang bỏ cảnh cáo...",
        defaultNote: "Gỡ trạng thái cảnh cáo hiện tại sau khi đã rà soát và xác nhận người dùng có thể trở lại trạng thái bình thường.",
        presets: [
          "Đã rà soát xong và gỡ cảnh cáo hiện tại cho tài khoản này.",
          "Gỡ cảnh cáo sau khi người dùng giải trình đầy đủ và không còn vi phạm đang hoạt động.",
        ],
      };
  }
};

const getWalletClearDraft = () => ({
  title: "Xóa số dư ví do gian lận",
  description: "Thao tác này ảnh hưởng trực tiếp đến số dư người dùng, vì vậy bắt buộc phải lưu lý do chi tiết.",
  confirmLabel: "Xác nhận xóa số dư",
  confirmClassName: "bg-[#2d1459] hover:bg-[#231145]",
  loadingLabel: "Đang xóa số dư...",
  defaultNote: "Xóa toàn bộ số dư ví do phát hiện hoặc nghi ngờ hành vi gian lận tài chính.",
  presets: [
    "Xóa số dư do phát hiện dấu hiệu gian lận thưởng/nạp/rút trong hệ thống.",
    "Xóa số dư để khóa nguồn tiền có dấu hiệu không hợp lệ và chuyển sang bước rà soát thủ công.",
  ],
});

const getModerationMeta = (status: AdminModerationStatus = "active") => {
  switch (status) {
    case "locked":
      return { label: "Đã khóa", className: "bg-[#fff0f5] text-[#d4525d]" };
    case "warned":
      return { label: "Cảnh cáo", className: "bg-[#fff7ea] text-[#c97a12]" };
    default:
      return { label: "Bình thường", className: "bg-[#eefbf4] text-[#00a46f]" };
  }
};

const getUserStatusMeta = (user: AdminUserRow) => {
  if (user.role === "admin") return { label: "Admin", className: "bg-[#eef1ff] text-[#5868ff]" };
  if (user.moderationStatus === "locked") return { label: "Đã khóa", className: "bg-[#fff0f5] text-[#d4525d]" };
  if (user.moderationStatus === "warned")
    return { label: `Cảnh cáo ${Math.max(user.warningCount ?? 1, 1)}`, className: "bg-[#fff7ea] text-[#c97a12]" };
  if (!user.emailVerified) return { label: "Chờ xác minh", className: "bg-[#fff0f5] text-[#d4525d]" };
  if (user.lastLoginAt && Date.now() - new Date(user.lastLoginAt).getTime() <= ACTIVE_WINDOW_MS) {
    return { label: "Hoạt động", className: "bg-[#f3edff] text-[#7b19d8]" };
  }
  return { label: "Ít hoạt động", className: "bg-[#f4f1fa] text-[#7c8393]" };
};

const filterChips: Array<{ label: string; value: AdminUserStatusFilter }> = [
  { label: "Tất cả", value: "all" },
  { label: "Hoạt động", value: "active" },
  { label: "Chờ xác minh", value: "pending" },
];

type AdminUserRoleFilter = "all" | AdminUserRow["role"];
type AdminUserModerationFilter = "all" | AdminModerationStatus;
type AdminUserVerificationFilter = "all" | "verified" | "unverified";
type AdminUserSortKey = "newest" | "oldest" | "last_login" | "warning_count";

const getTimestampValue = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const applyAdvancedUserFilters = (
  users: AdminUserRow[],
  filters: {
    role: AdminUserRoleFilter;
    moderation: AdminUserModerationFilter;
    verification: AdminUserVerificationFilter;
    sortKey: AdminUserSortKey;
  }
) => {
  const filteredUsers = users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) {
      return false;
    }

    if (filters.moderation !== "all" && (user.moderationStatus ?? "active") !== filters.moderation) {
      return false;
    }

    if (filters.verification === "verified" && !user.emailVerified) {
      return false;
    }

    if (filters.verification === "unverified" && user.emailVerified) {
      return false;
    }

    return true;
  });

  return [...filteredUsers].sort((leftUser, rightUser) => {
    switch (filters.sortKey) {
      case "oldest":
        return getTimestampValue(leftUser.createdAt) - getTimestampValue(rightUser.createdAt);
      case "last_login":
        return getTimestampValue(rightUser.lastLoginAt) - getTimestampValue(leftUser.lastLoginAt);
      case "warning_count":
        return (rightUser.warningCount ?? 0) - (leftUser.warningCount ?? 0);
      case "newest":
      default:
        return getTimestampValue(rightUser.createdAt) - getTimestampValue(leftUser.createdAt);
    }
  });
};

const EMPTY_WALLET_SUMMARY: AdminUserWalletSummary = {
  currentBalance: 0,
  withdrawableBalance: 0,
  pendingTotal: 0,
  approvedDepositTotal: 0,
  approvedWithdrawalTotal: 0,
  approvedAdjustmentDebitTotal: 0,
  adjustmentCount: 0,
  lastAdjustedAt: null,
};

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#faf8ff] px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">{label}</p>
      <p className={`mt-2 text-sm font-bold text-[#2d2f32] ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<AdminUserRoleFilter>("all");
  const [moderationFilter, setModerationFilter] = useState<AdminUserModerationFilter>("all");
  const [verificationFilter, setVerificationFilter] = useState<AdminUserVerificationFilter>("all");
  const [sortKey, setSortKey] = useState<AdminUserSortKey>("newest");
  const [userResponse, setUserResponse] = useState<AdminUsersResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [moderationLoading, setModerationLoading] = useState<AdminUserModerationAction | null>(null);
  const [walletActionLoading, setWalletActionLoading] = useState(false);
  const [actionDialog, setActionDialog] = useState<UserActionDialogState | null>(null);

  useEffect(() => {
    setPage(1);
  }, [deferredSearchTerm, statusFilter]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const data = await adminService.getUsers({ search: deferredSearchTerm, status: statusFilter, page, limit: 10 });
        setUserResponse(data);
      } catch (error) {
        console.error("Không tải được danh sách người dùng admin", error);
        toast.error("Không tải được danh sách người dùng.");
      } finally {
        setLoading(false);
      }
    };
    void loadUsers();
  }, [deferredSearchTerm, page, statusFilter]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserDetail(null);
      setActionDialog(null);
      return;
    }
    const loadUserDetail = async () => {
      try {
        setDetailLoading(true);
        const data = await adminService.getUserDetail(selectedUserId);
        setSelectedUserDetail(data);
      } catch (error) {
        console.error("Không tải được chi tiết người dùng", error);
        toast.error(getErrorMessage(error, "Không tải được chi tiết người dùng."));
      } finally {
        setDetailLoading(false);
      }
    };
    void loadUserDetail();
  }, [selectedUserId]);

  useEffect(() => {
    setActionDialog(null);
  }, [selectedUserId]);

  const handleRefreshUsers = async () => {
    try {
      setRefreshing(true);
      const data = await adminService.getUsers({ search: deferredSearchTerm, status: statusFilter, page, limit: 10 });
      setUserResponse(data);
      toast.success("Đã làm mới danh sách người dùng.");
    } catch (error) {
      console.error("Không làm mới được danh sách người dùng admin", error);
      toast.error("Không làm mới được danh sách người dùng.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleResetAdvancedFilters = () => {
    setRoleFilter("all");
    setModerationFilter("all");
    setVerificationFilter("all");
    setSortKey("newest");
  };

  const hasAdvancedFilters =
    roleFilter !== "all" ||
    moderationFilter !== "all" ||
    verificationFilter !== "all" ||
    sortKey !== "newest";

  const visibleUsers = useMemo(
    () =>
      applyAdvancedUserFilters(userResponse?.users ?? [], {
        role: roleFilter,
        moderation: moderationFilter,
        verification: verificationFilter,
        sortKey,
      }),
    [moderationFilter, roleFilter, sortKey, userResponse?.users, verificationFilter]
  );

  const handleExportUsers = async () => {
    if (!userResponse) {
      toast.info("Chưa có dữ liệu người dùng để xuất.");
      return;
    }

    try {
      setExporting(true);
      const totalPages = Math.max(userResponse.pagination.totalPages, 1);
      const collectedUsers: AdminUserRow[] = [];

      for (let nextPage = 1; nextPage <= totalPages; nextPage += 1) {
        const response = await adminService.getUsers({
          search: deferredSearchTerm,
          status: statusFilter,
          page: nextPage,
          limit: 20,
        });

        collectedUsers.push(...response.users);
      }

      const exportRows = applyAdvancedUserFilters(collectedUsers, {
        role: roleFilter,
        moderation: moderationFilter,
        verification: verificationFilter,
        sortKey,
      });

      if (exportRows.length === 0) {
        toast.info("Không có người dùng nào phù hợp để xuất.");
        return;
      }

      downloadAdminCsv(buildAdminCsvFileName("admin-users"), exportRows, [
        { header: "ID tài khoản", value: (user) => formatDisplayId(user.accountId) || "--------" },
        { header: "Họ tên", value: (user) => user.displayName },
        { header: "Email", value: (user) => user.email },
        { header: "Username", value: (user) => user.username ? `@${user.username}` : "" },
        { header: "Vai trò", value: (user) => (user.role === "admin" ? "Admin" : "Người dùng") },
        { header: "Trạng thái hiển thị", value: (user) => getUserStatusMeta(user).label },
        { header: "Moderation", value: (user) => getModerationMeta(user.moderationStatus).label },
        { header: "Email xác minh", value: (user) => (user.emailVerified ? "Đã xác minh" : "Chờ xác minh") },
        { header: "Ngày tạo", value: (user) => formatDateTime(user.createdAt) },
        { header: "Đăng nhập gần nhất", value: (user) => formatDateTime(user.lastLoginAt) },
        { header: "Số cảnh cáo", value: (user) => user.warningCount ?? 0 },
      ]);
      toast.success(`Đã xuất ${formatNumber(exportRows.length)} người dùng.`);
    } catch (error) {
      console.error("Không xuất được danh sách người dùng", error);
      toast.error("Không xuất được danh sách người dùng.");
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = useMemo(() => {
    if (!userResponse) return [];
    return [
      {
        label: "Tổng số người dùng",
        value: formatNumber(userResponse.summary.totalUsers),
        helper: "+12% so với tháng trước",
        helperClassName: "text-[#7b19d8]",
        icon: Users,
        iconClassName: "bg-[#f2ebff] text-[#7b19d8]",
      },
      {
        label: "Người dùng mới",
        value: formatNumber(userResponse.summary.newUsersToday),
        helper: "Đăng ký trong hôm nay",
        helperClassName: "text-[#5868ff]",
        icon: UserPlus,
        iconClassName: "bg-[#eef1ff] text-[#5868ff]",
      },
      {
        label: "Đang hoạt động",
        value: formatNumber(userResponse.summary.activeUsers),
        helper: `${formatNumber(userResponse.summary.totalAdmins)} tài khoản admin hệ thống`,
        helperClassName: "text-[#7b19d8]",
        icon: ShieldCheck,
        iconClassName: "bg-[#f3edff] text-[#7b19d8]",
      },
      {
        label: "Chưa xác minh",
        value: formatNumber(userResponse.summary.pendingUsers),
        helper: "Cần rà soát email và phiên truy cập",
        helperClassName: "text-[#d4525d]",
        icon: TriangleAlert,
        iconClassName: "bg-[#fff0f5] text-[#d4525d]",
      },
    ];
  }, [userResponse]);

  const visiblePages = useMemo(() => {
    if (!userResponse) return [];
    const totalPages = userResponse.pagination.totalPages;
    const currentPage = userResponse.pagination.page;
    const start = Math.max(1, currentPage - 1);
    const end = Math.min(totalPages, start + 2);
    const adjustedStart = Math.max(1, end - 2);
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [userResponse]);

  const selectedUserPreview = useMemo(
    () => userResponse?.users.find((user) => user._id === selectedUserId) ?? null,
    [selectedUserId, userResponse]
  );
  const selectedUser = selectedUserDetail?.user ?? selectedUserPreview;
  const selectedWalletSummary = selectedUserDetail?.walletSummary ?? EMPTY_WALLET_SUMMARY;
  const selectedUserStatusMeta = selectedUser ? getUserStatusMeta(selectedUser) : null;
  const selectedModerationMeta = selectedUser ? getModerationMeta(selectedUser.moderationStatus) : null;

  const handleCopyAccountId = async (accountId?: string) => {
    const normalizedAccountId = formatDisplayId(accountId);

    if (!normalizedAccountId) {
      toast.info("Người dùng này chưa có ID 8 số.");
      return;
    }
    try {
      await navigator.clipboard.writeText(normalizedAccountId);
      toast.success("Đã sao chép ID người dùng.");
    } catch (error) {
      console.error("Không thể sao chép ID người dùng", error);
      toast.error("Không sao chép được ID người dùng.");
    }
  };

  const patchUserInList = (nextUser: AdminUserRow) => {
    setUserResponse((current) =>
      current
        ? {
            ...current,
            users: current.users.map((user) => (user._id === nextUser._id ? { ...user, ...nextUser } : user)),
          }
        : current
    );
  };

  const handleModeration = async (action: AdminUserModerationAction, note: string) => {
    if (!selectedUser) return;

    const trimmedNote = note.trim();

    if (!trimmedNote) {
      toast.error("Cần nhập lý do trước khi thực hiện thao tác moderation.");
      return false;
    }

    try {
      setModerationLoading(action);
      const data = await adminService.updateUserModeration(selectedUser._id, {
        action,
        note: trimmedNote,
      });
      setSelectedUserDetail((current) =>
        current
          ? { ...current, user: data.user }
          : {
              user: data.user,
              bankAccountsSummary: { total: 0, verified: 0, pending: 0, locked: 0 },
              walletSummary: EMPTY_WALLET_SUMMARY,
            }
      );
      patchUserInList(data.user);
      if (action === "warn") toast.success(`Đã gửi cảnh cáo cho ${data.user.displayName}.`);
      if (action === "lock") toast.success(`Đã khóa tài khoản ${data.user.displayName}.`);
      if (action === "unlock") toast.success(`Đã mở khóa tài khoản ${data.user.displayName}.`);
      if (action === "clear") toast.success(`Đã gỡ cảnh cáo hiện tại cho ${data.user.displayName}.`);
      return true;
    } catch (error) {
      console.error("Không cập nhật được trạng thái người dùng", error);
      toast.error(getErrorMessage(error, "Không cập nhật được trạng thái người dùng."));
      return false;
    } finally {
      setModerationLoading(null);
    }
  };

  const handleClearWalletBalance = async (note: string) => {
    if (!selectedUser) return;
    const trimmedNote = note.trim();

    if (!trimmedNote) {
      toast.error("Cần nhập lý do xoá số dư để lưu vào lịch sử kiểm soát gian lận.");
      return false;
    }

    try {
      setWalletActionLoading(true);
      const data = await adminService.clearUserWalletBalance(selectedUser._id, { note: trimmedNote });
      setSelectedUserDetail((current) =>
        current
          ? { ...current, walletSummary: data.walletSummary }
          : {
              user: selectedUser,
              bankAccountsSummary: { total: 0, verified: 0, pending: 0, locked: 0 },
              walletSummary: data.walletSummary,
            }
      );
      toast.success(`Đã xoá ${formatCurrency(data.adjustment.amount)} khỏi ví của ${selectedUser.displayName}.`);
      return true;
    } catch (error) {
      console.error("Không xoá được số dư ví người dùng", error);
      toast.error(getErrorMessage(error, "Không xoá được số dư ví người dùng."));
      return false;
    } finally {
      setWalletActionLoading(false);
    }
  };

  const openModerationDialog = (action: AdminUserModerationAction) => {
    if (!selectedUser || moderationDisabled) {
      return;
    }

    const draft = getModerationActionDraft(action);
    setActionDialog({
      type: "moderation",
      action,
      note: draft.defaultNote,
    });
  };

  const openWalletClearDialog = () => {
    if (!selectedUser || walletClearDisabled) {
      return;
    }

    const draft = getWalletClearDraft();
    setActionDialog({
      type: "wallet_clear",
      note: draft.defaultNote,
    });
  };

  const handleConfirmAction = async () => {
    if (!actionDialog) {
      return;
    }

    const submitted =
      actionDialog.type === "moderation"
        ? await handleModeration(actionDialog.action, actionDialog.note)
        : await handleClearWalletBalance(actionDialog.note);

    if (submitted) {
      setActionDialog(null);
    }
  };

  const pagination = userResponse?.pagination;
  const startRow = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endRow = pagination ? Math.min(pagination.page * pagination.limit, pagination.totalItems) : 0;
  const moderationDisabled = selectedUser?.role === "admin";
  const walletClearDisabled =
    moderationDisabled || Boolean(moderationLoading) || walletActionLoading || selectedWalletSummary.currentBalance <= 0;
  const currentPageVisibleCount = visibleUsers.length;
  const actionDialogDraft =
    actionDialog?.type === "moderation"
      ? getModerationActionDraft(actionDialog.action)
      : actionDialog
        ? getWalletClearDraft()
        : null;

  return (
    <AdminShell
      title="Quản lý người dùng"
      subtitle="Duyệt và điều hành cơ sở dữ liệu khách hàng hệ thống."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm kiếm người dùng..."
      showSidebarAction={false}
      action={
        <button
          type="button"
          onClick={() => void handleExportUsers()}
          disabled={exporting || !userResponse}
          className="auth-premium-gradient auth-soft-shadow inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-transform active:scale-95"
        >
          <Download className="size-4.5" />
          {exporting ? "Đang xuất..." : "Xuất người dùng"}
        </button>
      }
    >
      {loading ? (
        <div className="rounded-[1.5rem] bg-white px-6 py-12 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.16)]">
          Đang tải danh sách người dùng...
        </div>
      ) : userResponse ? (
        <>
          <section className="grid gap-5 xl:grid-cols-4">
            {summaryCards.map((card) => {
              return (
                <AdminStatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  helper={card.helper}
                  helperClassName={card.helperClassName}
                  icon={card.icon}
                  iconClassName={card.iconClassName}
                />
              );
            })}
          </section>

          <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 rounded-full bg-[#f1ecfb] p-1.5">
              {filterChips.map((chip) => {
                const active = chip.value === statusFilter;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setStatusFilter(chip.value)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-white text-[#2d2f32] shadow-[0_16px_35px_-28px_rgba(123,25,216,0.32)]"
                        : "text-[#7a8190] hover:text-[#7b19d8]"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((currentValue) => !currentValue)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#4c5566] shadow-[0_18px_40px_-30px_rgba(123,25,216,0.18)] transition-colors hover:text-[#7b19d8]"
              >
                <Filter className="size-4" />
                {filtersOpen ? "Ẩn bộ lọc" : "Lọc nâng cao"}
              </button>
              <button
                type="button"
                onClick={() => void handleRefreshUsers()}
                disabled={refreshing}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#4c5566] shadow-[0_18px_40px_-30px_rgba(123,25,216,0.18)] transition-colors hover:text-[#7b19d8]"
              >
                <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Đang làm mới" : "Làm mới"}
              </button>
              {hasAdvancedFilters ? (
                <button
                  type="button"
                  onClick={handleResetAdvancedFilters}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#f3edff] px-4 text-sm font-semibold text-[#7b19d8] shadow-[0_18px_40px_-30px_rgba(123,25,216,0.18)] transition-colors hover:bg-[#eadbfd]"
                >
                  Đặt lại lọc
                </button>
              ) : null}
            </div>
          </section>

          {filtersOpen ? (
            <section className="rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Bộ lọc nâng cao</h3>
                  <p className="mt-1 text-sm text-[#7b8190]">
                    Áp dụng trên danh sách đang hiển thị ở trang hiện tại, hữu ích khi cần rà soát role, moderation
                    hoặc xác minh email nhanh hơn.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#faf7ff] px-4 py-3 text-sm font-medium text-[#6a7080]">
                  {hasAdvancedFilters
                    ? `Đang còn ${formatNumber(currentPageVisibleCount)} người dùng sau khi lọc nâng cao.`
                    : "Chưa áp dụng bộ lọc cục bộ nào."}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Vai trò</span>
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value as AdminUserRoleFilter)}
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-[#faf8ff] px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  >
                    <option value="all">Tất cả</option>
                    <option value="user">Người dùng</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Moderation</span>
                  <select
                    value={moderationFilter}
                    onChange={(event) => setModerationFilter(event.target.value as AdminUserModerationFilter)}
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-[#faf8ff] px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  >
                    <option value="all">Tất cả</option>
                    <option value="active">Bình thường</option>
                    <option value="warned">Đang cảnh cáo</option>
                    <option value="locked">Đã khóa</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Xác minh email</span>
                  <select
                    value={verificationFilter}
                    onChange={(event) => setVerificationFilter(event.target.value as AdminUserVerificationFilter)}
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-[#faf8ff] px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  >
                    <option value="all">Tất cả</option>
                    <option value="verified">Đã xác minh</option>
                    <option value="unverified">Chưa xác minh</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Sắp xếp</span>
                  <select
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as AdminUserSortKey)}
                    className="h-12 w-full rounded-2xl border border-[#e8deff] bg-[#faf8ff] px-4 text-sm font-medium text-[#2d2f32] outline-none transition-colors focus:border-[#c8b1ff]"
                  >
                    <option value="newest">Mới tạo gần nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="last_login">Đăng nhập gần nhất</option>
                    <option value="warning_count">Cảnh cáo nhiều nhất</option>
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-[#f4f1fa]">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">STT</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Người dùng</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Ngày đăng ký</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">ID người dùng</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Trạng thái</th>
                    <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.length > 0 ? (
                    visibleUsers.map((user, index) => {
                      const statusMeta = getUserStatusMeta(user);
                      return (
                        <tr key={user._id} className="border-t border-[#f0ebf8] transition-colors hover:bg-[#fcfbff]">
                          <td className="px-8 py-5 text-sm font-semibold text-[#7b8190]">{String(startRow + index).padStart(2, "0")}</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <Avatar className="size-11 ring-2 ring-[#f0e7ff]">
                                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                                <AvatarFallback className="bg-[#f3edff] text-sm font-bold text-[#7b19d8]">{getInitials(user.displayName)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#2d2f32]">{user.displayName}</p>
                                <p className="truncate text-xs text-[#7b8190]">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm font-medium text-[#4e5667]">{formatDate(user.createdAt)}</td>
                          <td className="px-6 py-5">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-[#2d2f32]">{formatDisplayId(user.accountId) || "--------"}</p>
                              <p className="text-xs text-[#7b8190]">@{user.username ?? "không có"}</p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedUserId(user._id)}
                                className="flex size-9 items-center justify-center rounded-xl text-[#7b19d8] transition-colors hover:bg-[#f3edff]"
                                title="Xem hồ sơ"
                              >
                                <Eye className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopyAccountId(user.accountId)}
                                className="flex size-9 items-center justify-center rounded-xl text-[#d4525d] transition-colors hover:bg-[#fff0f5]"
                                title="Sao chép ID người dùng"
                              >
                                <Copy className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-8 py-14 text-center text-sm font-medium text-[#7b8190]">
                        Không có người dùng nào khớp với bộ lọc hiện tại trên trang này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-4 border-t border-[#f0ebf8] px-8 py-6 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs font-medium text-[#7b8190]">
                {hasAdvancedFilters
                  ? `Đang hiển thị ${formatNumber(currentPageVisibleCount)} người dùng sau lọc nâng cao ở trang ${pagination?.page ?? 1}.`
                  : `Hiển thị ${startRow}-${endRow} trong số ${formatNumber(pagination?.totalItems ?? 0)} người dùng`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pagination?.hasPrev && setPage((currentPage) => currentPage - 1)}
                  disabled={!pagination?.hasPrev}
                  className="flex size-9 items-center justify-center rounded-xl text-[#7b8190] transition-colors hover:bg-[#f4f1fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                {visiblePages.map((pageNumber) => {
                  const active = pageNumber === pagination?.page;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`flex size-9 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                        active ? "bg-gradient-primary text-white" : "text-[#4e5667] hover:bg-[#f4f1fa]"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                {(pagination?.totalPages ?? 0) > (visiblePages[visiblePages.length - 1] ?? 0) ? (
                  <>
                    <span className="px-1 text-xs font-bold text-[#8b91a0]">...</span>
                    <button
                      type="button"
                      onClick={() => setPage(pagination?.totalPages ?? 1)}
                      className="flex size-9 items-center justify-center rounded-xl text-xs font-bold text-[#4e5667] transition-colors hover:bg-[#f4f1fa]"
                    >
                      {pagination?.totalPages}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => pagination?.hasNext && setPage((currentPage) => currentPage + 1)}
                  disabled={!pagination?.hasNext}
                  className="flex size-9 items-center justify-center rounded-xl text-[#7b8190] transition-colors hover:bg-[#f4f1fa] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-[1.5rem] bg-white px-6 py-12 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.16)]">
          Không tải được danh sách người dùng.
        </div>
      )}

      <Dialog
        open={Boolean(selectedUserId)}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null);
        }}
      >
        <DialogContent className="left-0 top-0 h-screen w-screen max-h-none max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-none bg-[#fcfbff] p-0 shadow-none sm:max-w-none">
          {selectedUser ? (
            <div className="h-full space-y-6 overflow-y-auto p-8">
              <section className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#251045_0%,#6d1fe6_56%,#ff8fb9_100%)] p-6 text-white shadow-[0_28px_70px_-36px_rgba(123,25,216,0.52)]">
                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
                  <div className="space-y-6">
                    <DialogHeader className="space-y-4 text-left">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
                          {formatDisplayId(selectedUser.accountId) || "--------"}
                        </span>
                        {selectedUserStatusMeta ? (
                          <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2d1459]">
                            {selectedUserStatusMeta.label}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-white/14 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                          {selectedUser.emailVerified ? "Email đã xác minh" : "Email chờ xác minh"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Avatar className="size-18 ring-4 ring-white/18">
                          <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.displayName} />
                          <AvatarFallback className="bg-white/16 text-lg font-black text-white">
                            {getInitials(selectedUser.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <DialogTitle className="font-auth-headline text-3xl font-extrabold tracking-[-0.05em] text-white">
                            {selectedUser.displayName}
                          </DialogTitle>
                          <DialogDescription className="mt-2 max-w-2xl text-sm leading-7 text-white/78">
                            Hồ sơ đầy đủ của người dùng, kèm quyền moderation và xử lý số dư ví ngay trong admin.
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="rounded-[1.55rem] border border-white/18 bg-white/10 p-5 backdrop-blur-sm">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/68">Email đăng nhập</p>
                          <p className="mt-2 text-base font-bold text-white">{selectedUser.email}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/68">Tên đăng nhập</p>
                          <p className="mt-2 text-base font-bold text-white">@{selectedUser.username || "chưa thiết lập"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">Cảnh cáo</p>
                      <p className="mt-2 text-2xl font-black text-white">{formatNumber(selectedUser.warningCount ?? 0)}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">Tài khoản NH</p>
                      <p className="mt-2 text-2xl font-black text-white">{formatNumber(selectedUserDetail?.bankAccountsSummary.total ?? 0)}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">Đăng nhập gần nhất</p>
                      <p className="mt-2 text-sm font-bold text-white">{formatDateTime(selectedUser.lastLoginAt)}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/66">Moderation</p>
                      <p className="mt-2 text-sm font-bold text-white">{selectedModerationMeta?.label ?? "Bình thường"}</p>
                    </div>
                  </div>
                </div>
              </section>

              {detailLoading && !selectedUserDetail ? (
                <div className="rounded-[1.55rem] bg-white px-6 py-14 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
                  Đang tải hồ sơ người dùng...
                </div>
              ) : (
                <>
                  <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
                    <div className={detailCardClassName}>
                      <div>
                        <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Thông tin tài khoản</h3>
                        <p className="mt-1 text-sm text-[#7b8190]">Dữ liệu định danh và liên hệ đang được lưu cho người dùng này.</p>
                      </div>
                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <DetailField label="Họ và tên" value={selectedUser.displayName} />
                        <DetailField label="Vai trò" value={selectedUser.role === "admin" ? "Admin" : "Người dùng"} />
                        <DetailField label="Email" value={selectedUser.email} />
                        <DetailField label="Số điện thoại" value={selectedUser.phone || "Chưa cập nhật"} />
                        <DetailField label="Tên đăng nhập" value={selectedUser.username ? `@${selectedUser.username}` : "Chưa cập nhật"} />
                        <DetailField label="Nhà cung cấp đăng nhập" value={selectedUser.authProviders?.length ? selectedUser.authProviders.join(", ") : "local"} />
                        <DetailField label="Ngày tạo" value={formatDateTime(selectedUser.createdAt)} />
                        <DetailField label="Cập nhật cuối" value={formatDateTime(selectedUser.updatedAt)} />
                      </div>
                    </div>
                    <div className={detailCardClassName}>
                      <div>
                        <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Moderation & trạng thái</h3>
                        <p className="mt-1 text-sm text-[#7b8190]">Theo dõi cảnh cáo, khóa tài khoản và các tín hiệu cần rà soát thêm.</p>
                      </div>
                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <DetailField label="Trạng thái moderation" value={selectedModerationMeta?.label ?? "Bình thường"} />
                        <DetailField label="Số lần cảnh cáo" value={formatNumber(selectedUser.warningCount ?? 0)} />
                        <DetailField label="Cảnh cáo gần nhất" value={formatDateTime(selectedUser.lastWarnedAt)} />
                        <DetailField label="Khóa lúc" value={formatDateTime(selectedUser.lockedAt)} />
                        <div className="rounded-2xl border border-[#ffd7e5] bg-[#fff8fb] p-5 md:col-span-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#d4525d]">Ghi chú moderation</p>
                          <p className="mt-3 text-sm leading-7 font-medium text-[#2d2f32]">{selectedUser.moderationNote || "Chưa có ghi chú từ admin."}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
                    <div className="space-y-6">
                      <div className={detailCardClassName}>
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#d4525d]">
                            <WalletCards className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Số dư ví & điều chỉnh</h3>
                            <p className="mt-1 text-sm text-[#7b8190]">Theo dõi số dư hiện tại và tổng giá trị đã bị admin khấu trừ khỏi ví.</p>
                          </div>
                        </div>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                          <DetailField label="Số dư hiện tại" value={formatCurrency(selectedWalletSummary.currentBalance)} />
                          <DetailField label="Số dư khả dụng" value={formatCurrency(selectedWalletSummary.withdrawableBalance)} />
                          <DetailField label="Đang chờ xử lý" value={formatCurrency(selectedWalletSummary.pendingTotal)} />
                          <DetailField label="Tổng đã khấu trừ" value={formatCurrency(selectedWalletSummary.approvedAdjustmentDebitTotal)} />
                          <DetailField label="Tổng nạp đã duyệt" value={formatCurrency(selectedWalletSummary.approvedDepositTotal)} />
                          <DetailField label="Tổng rút đã duyệt" value={formatCurrency(selectedWalletSummary.approvedWithdrawalTotal)} />
                          <DetailField label="Số lần điều chỉnh" value={formatNumber(selectedWalletSummary.adjustmentCount)} />
                          <DetailField label="Điều chỉnh gần nhất" value={formatDateTime(selectedWalletSummary.lastAdjustedAt)} />
                        </div>
                      </div>
                      <div className={detailCardClassName}>
                        <div>
                          <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Hồ sơ cá nhân</h3>
                          <p className="mt-1 text-sm text-[#7b8190]">Nội dung mô tả và thông tin tự khai báo của người dùng.</p>
                        </div>
                        <div className="mt-6 rounded-2xl bg-[#faf8ff] p-5">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Tiểu sử</p>
                          <p className="mt-3 text-sm leading-7 font-medium text-[#2d2f32]">{selectedUser.bio || "Người dùng này chưa cập nhật mô tả cá nhân."}</p>
                        </div>
                      </div>
                      <div className={detailCardClassName}>
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#f3edff] text-[#7b19d8]">
                            <WalletCards className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Tài khoản ngân hàng</h3>
                            <p className="mt-1 text-sm text-[#7b8190]">Tóm tắt các tài khoản ngân hàng mà người dùng đã gửi lên hệ thống.</p>
                          </div>
                        </div>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <DetailField label="Tổng cộng" value={formatNumber(selectedUserDetail?.bankAccountsSummary.total ?? 0)} />
                          <DetailField label="Đã xác minh" value={formatNumber(selectedUserDetail?.bankAccountsSummary.verified ?? 0)} />
                          <DetailField label="Chờ duyệt" value={formatNumber(selectedUserDetail?.bankAccountsSummary.pending ?? 0)} />
                          <DetailField label="Đang khóa" value={formatNumber(selectedUserDetail?.bankAccountsSummary.locked ?? 0)} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="rounded-[1.55rem] bg-[#f3edff] p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.14)]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7b19d8]">Nhật ký moderation</p>
                        <p className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm leading-7 font-medium text-[#2d2f32] shadow-[0_20px_45px_-34px_rgba(123,25,216,0.18)]">
                          {selectedUser.moderationNote || "Chưa có ghi chú moderation nào được lưu cho người dùng này."}
                        </p>
                        <p className="mt-4 text-sm leading-7 text-[#695d88]">
                          Khi bấm thao tác bên dưới, hệ thống sẽ mở popup để nhập hoặc chỉnh lý do trước khi xác nhận.
                        </p>
                      </div>
                      <div className={detailCardClassName}>
                        <h3 className="font-auth-headline text-lg font-bold text-[#2d2f32]">Thao tác quản trị</h3>
                        <p className="mt-2 text-sm leading-7 text-[#6f7283]">Có thể gửi cảnh cáo, bỏ cảnh cáo hiện tại, khóa tạm, mở lại tài khoản hoặc xoá sạch số dư ví khi phát hiện gian lận.</p>
                        {moderationDisabled ? (
                          <div className="mt-5 rounded-2xl border border-[#d9e1ff] bg-[#f5f8ff] px-4 py-3 text-sm font-medium text-[#5868ff]">
                            Đây là tài khoản admin hệ thống, không thể thao tác moderation hoặc xoá số dư từ giao diện này.
                          </div>
                        ) : null}
                        {!moderationDisabled && selectedWalletSummary.currentBalance <= 0 ? (
                          <div className="mt-5 rounded-2xl border border-[#d9f1e6] bg-[#f3fff8] px-4 py-3 text-sm font-medium text-[#0b8f62]">
                            Ví người dùng hiện không còn số dư để xoá.
                          </div>
                        ) : null}
                        <div className="mt-6 grid gap-3">
                          <button
                            type="button"
                            onClick={() => openModerationDialog("warn")}
                            disabled={Boolean(moderationLoading) || moderationDisabled}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#fff7ea] px-4 py-3 text-sm font-bold text-[#c97a12] transition-colors hover:bg-[#fff1d6] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <TriangleAlert className="size-4" />
                            {moderationLoading === "warn" ? "Đang gửi cảnh cáo..." : "Cảnh cáo người dùng"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openModerationDialog("lock")}
                            disabled={Boolean(moderationLoading) || moderationDisabled || selectedUser.moderationStatus === "locked"}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#fff0f5] px-4 py-3 text-sm font-bold text-[#d4525d] transition-colors hover:bg-[#ffe4ec] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Lock className="size-4" />
                            {moderationLoading === "lock" ? "Đang khóa..." : "Khóa tài khoản"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openModerationDialog("unlock")}
                            disabled={Boolean(moderationLoading) || moderationDisabled || selectedUser.moderationStatus !== "locked"}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#eefbf4] px-4 py-3 text-sm font-bold text-[#00a46f] transition-colors hover:bg-[#ddf7eb] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <LockOpen className="size-4" />
                            {moderationLoading === "unlock" ? "Đang mở khóa..." : "Mở khóa tài khoản"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openModerationDialog("clear")}
                            disabled={Boolean(moderationLoading) || moderationDisabled || selectedUser.moderationStatus !== "warned"}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#eef1ff] px-4 py-3 text-sm font-bold text-[#5868ff] transition-colors hover:bg-[#e3e8ff] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RefreshCcw className="size-4" />
                            {moderationLoading === "clear" ? "Đang bỏ cảnh cáo..." : "Bỏ cảnh cáo hiện tại"}
                          </button>
                          <button
                            type="button"
                            onClick={openWalletClearDialog}
                            disabled={walletClearDisabled}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d1459] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#231145] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <WalletCards className="size-4" />
                            {walletActionLoading ? "Đang xoá số dư..." : "Xoá số dư ví do gian lận"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-medium text-[#6c7281]">
              Không tìm thấy hồ sơ người dùng.
            </div>
          )}
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
          onConfirm={() => void handleConfirmAction()}
          confirmLabel={actionDialogDraft.confirmLabel}
          confirmClassName={actionDialogDraft.confirmClassName}
          loading={actionDialog.type === "moderation" ? moderationLoading === actionDialog.action : walletActionLoading}
          loadingLabel={actionDialogDraft.loadingLabel}
          presets={actionDialogDraft.presets}
          placeholder="Nhập lý do chi tiết để lưu vào hồ sơ kiểm soát nội bộ..."
          required
        />
      ) : null}
    </AdminShell>
  );
}
