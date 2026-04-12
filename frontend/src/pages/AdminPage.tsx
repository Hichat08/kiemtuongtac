import AdminShell from "@/components/admin/AdminShell";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { adminService } from "@/services/adminService";
import type { AdminOverviewResponse, AdminUserRow } from "@/types/admin";
import {
  Activity,
  Bell,
  CircleHelp,
  CreditCard,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatCompact = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
const formatCompactCurrency = (value: number) =>
  value >= 1_000_000 ? `${formatCompact(value)}đ` : `${formatNumber(value)}đ`;
const formatDateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(value))
    : "Chưa có";
const formatDisplayId = (value?: string | null) => value?.replace(/^#/, "").trim() ?? "";

const getInitials = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const avatarPalettes = [
  "bg-[#f1e7ff] text-[#7b19d8]",
  "bg-[#ffe7f5] text-[#d8589f]",
  "bg-[#eaf0ff] text-[#5868ff]",
  "bg-[#efeaff] text-[#6f56db]",
];
type GrowthView = "day" | "week";

export default function AdminPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [growthView, setGrowthView] = useState<GrowthView>("day");

  const loadOverview = async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const data = await adminService.getOverview();
      setOverview(data);
    } catch (error) {
      console.error("Không tải được dữ liệu admin", error);
      toast.error("Không tải được dữ liệu admin.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadOverview(true);
  }, []);
  useEffect(() => {
    const refreshOverview = () => {
      void loadOverview();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshOverview();
      }
    };
    const intervalId = window.setInterval(refreshOverview, 5 * 60 * 1000);

    window.addEventListener("focus", refreshOverview);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOverview);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleRefreshOverview = async () => {
    try {
      setRefreshing(true);
      await loadOverview();
      toast.success("Đã làm mới tổng quan hệ thống.");
    } finally {
      setRefreshing(false);
    }
  };

  const matchesSearch = (entry: Partial<AdminUserRow>) =>
    [entry.displayName, entry.email, entry.username, entry.accountId]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(deferredSearchTerm));

  const filteredRecentUsers = overview?.recentUsers.filter((entry) => {
    if (!deferredSearchTerm) {
      return true;
    }

    return matchesSearch(entry);
  });

  const filteredLatestSignIns = overview?.latestSignIns.filter((entry) => {
    if (!deferredSearchTerm) {
      return true;
    }

    return matchesSearch(entry);
  });

  const growthSeries = useMemo(() => {
    if (!overview) {
      return [];
    }

    if (growthView === "week") {
      return overview.growthWeekly;
    }

    return overview.growthDaily?.length ? overview.growthDaily : overview.growth;
  }, [growthView, overview]);
  const growthTitle = growthView === "day" ? "Thống kê 7 ngày gần nhất" : "Thống kê 4 tuần gần nhất";
  const growthMax = Math.max(...(growthSeries.map((point) => point.count) ?? [1]), 1);
  const currentGrowthDate = growthSeries.at(-1)?.date ?? "";

  const statCards = overview
    ? [
        {
          label: "Tổng Người Dùng",
          value: formatNumber(overview.summary.totalUsers),
          helper: `+${formatNumber(overview.summary.newUsersToday)} hôm nay`,
          icon: UserPlus,
          iconClassName: "bg-[#f3edff] text-[#7b19d8]",
          badge: `+${formatCompact(overview.summary.newUsersToday)}`,
          badgeClassName: "text-[#7b19d8]",
        },
        {
          label: "Tổng nạp",
          value: formatCompactCurrency(overview.summary.totalDepositAmount),
          helper: `${formatNumber(overview.summary.approvedDepositRequests)} giao dịch đã duyệt`,
          icon: CreditCard,
          iconClassName: "bg-[#ffeef6] text-[#ff4a90]",
          badge: `${formatNumber(overview.summary.pendingDepositRequests)} chờ`,
          badgeClassName: "rounded-full bg-[#fff0f6] px-2.5 py-1 text-[#d8589f]",
        },
        {
          label: "Tổng rút",
          value: formatCompactCurrency(overview.summary.totalWithdrawalAmount),
          helper: `${formatNumber(overview.summary.approvedWithdrawalRequests)} giao dịch đã chi`,
          icon: Activity,
          iconClassName: "bg-[#eef1ff] text-[#5868ff]",
          badge: `${formatNumber(overview.summary.pendingWithdrawalRequests)} chờ`,
          badgeClassName: "rounded-full bg-[#eef1ff] px-2.5 py-1 text-[#5868ff]",
        },
        {
          label: "Tổng tiền đang lưu hành",
          value: formatCompactCurrency(overview.summary.totalCirculatingBalance),
          helper: "Cộng số dư hiện tại của toàn bộ user, đã trừ rút và điều chỉnh hợp lệ",
          icon: WalletCards,
          iconClassName: "bg-[#f6f1ff] text-[#6f56db]",
          badge: "Live",
          badgeClassName: "rounded-full bg-[#f3edff] px-2.5 py-1 text-[#7b19d8]",
        },
      ]
    : [];

  const activityRows = useMemo(() => {
    if (!overview) {
      return [];
    }

    const recentUserRows = (filteredRecentUsers ?? []).slice(0, 3).map((entry) => ({
      key: `recent-${entry._id}`,
      name: entry.displayName,
      email: entry.email,
      action: entry.role === "admin" ? "Được cấp quyền admin" : "Đăng ký tài khoản mới",
      actionAccent:
        entry.role === "admin" ? "text-[#d8589f]" : entry.emailVerified ? "text-[#7b19d8]" : "text-[#5868ff]",
      time: formatDateTime(entry.createdAt),
      status: entry.emailVerified ? "Đã xác minh" : "Chờ xác minh",
      statusClassName: entry.emailVerified
        ? "bg-[#f3edff] text-[#7b19d8]"
        : "bg-[#fff2f4] text-[#d4525d]",
    }));

    const sessionRows = (filteredLatestSignIns ?? []).slice(0, 3).map((entry) => ({
      key: `session-${entry._id}`,
      name: entry.displayName,
      email: entry.email,
      action: formatDisplayId(entry.accountId)
        ? `Đăng nhập gần đây ${formatDisplayId(entry.accountId)}`
        : "Đăng nhập gần đây",
      actionAccent: "text-[#5868ff]",
      time: formatDateTime(entry.lastLoginAt),
      status: entry.role === "admin" ? "Admin" : "Người dùng",
      statusClassName:
        entry.role === "admin" ? "bg-[#ffeef6] text-[#d8589f]" : "bg-[#eef1ff] text-[#5868ff]",
    }));

    return [...recentUserRows, ...sessionRows].slice(0, 6);
  }, [filteredLatestSignIns, filteredRecentUsers, overview]);

  const queueItems = useMemo(() => {
    const recent = filteredRecentUsers ?? [];

    return recent.slice(0, 3).map((entry, index) => ({
      ...entry,
      reward:
        index === 0
          ? `${formatCompact(overview?.summary.newUsersToday ?? 0)} user mới`
          : entry.emailVerified
            ? "Đã xác minh email"
            : "Cần rà soát xác minh",
    }));
  }, [filteredRecentUsers, overview?.summary.newUsersToday]);

  return (
    <AdminShell
      title="Tổng quan Hệ thống"
      subtitle="Chào mừng trở lại, đây là báo cáo quản trị và người dùng hôm nay."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm kiếm dữ liệu hệ thống..."
      showSidebarAction={false}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleRefreshOverview()}
            disabled={refreshing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#4d5565] shadow-[0_18px_40px_-30px_rgba(123,25,216,0.18)] transition-colors hover:text-[#7b19d8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Đang làm mới" : "Làm mới dữ liệu"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/tasks")}
            className="auth-premium-gradient auth-soft-shadow inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <Plus className="size-4.5" />
            Thêm Nhiệm Vụ Mới
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="rounded-[1.5rem] bg-white px-6 py-12 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.16)]">
          Đang tải dữ liệu admin...
        </div>
      ) : overview ? (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => {
              return (
                <AdminStatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  helper={card.helper}
                  icon={card.icon}
                  iconClassName={card.iconClassName}
                  badge={card.badge}
                  badgeClassName={card.badgeClassName}
                />
              );
            })}
          </section>

          <section className="grid gap-8 xl:grid-cols-[minmax(0,1.9fr)_380px]">
            <div className="rounded-[1.55rem] bg-white p-8 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                    Biểu đồ Tăng trưởng Người dùng
                  </h2>
                  <p className="mt-1 text-sm text-[#818899]">{growthTitle}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGrowthView("day")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      growthView === "day"
                        ? "bg-gradient-primary text-white"
                        : "bg-[#f3edff] text-[#7b19d8]"
                    }`}
                  >
                    Ngày
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrowthView("week")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      growthView === "week"
                        ? "bg-gradient-primary text-white"
                        : "bg-[#f3edff] text-[#7b19d8]"
                    }`}
                  >
                    Tuần
                  </button>
                </div>
              </div>

              <div className="mt-10 flex h-64 items-end gap-2">
                {growthSeries.map((point) => {
                  const isCurrentPeriod = point.date === currentGrowthDate;
                  const height = Math.max(18, (point.count / growthMax) * 100);

                  return (
                    <div
                      key={point.date}
                      className="flex flex-1 flex-col items-center gap-4"
                    >
                      <div className="flex h-52 w-full items-end">
                        <div
                          className={`w-full rounded-t-xl ${
                            isCurrentPeriod
                              ? "bg-gradient-primary shadow-[0_18px_36px_-18px_rgba(123,25,216,0.32)]"
                              : "bg-[#e9e1f8]"
                          }`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
                          isCurrentPeriod ? "text-[#7b19d8]" : "text-[#7a8190]"
                        }`}
                      >
                        {point.label}
                      </p>
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${
                          isCurrentPeriod ? "text-[#d8589f]" : "text-transparent"
                        }`}
                      >
                        {growthView === "day" ? "Hôm nay" : "Hiện tại"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.55rem] bg-[#f1ecfb] p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.1)]">
                <h2 className="font-auth-headline text-lg font-bold text-[#2d2f32]">Thao tác Nhanh</h2>

                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate("/admin/broadcast-notifications")}
                    className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left transition-transform active:scale-[0.985]"
                  >
                    <span className="flex items-center gap-3">
                      <Bell className="size-4.5 text-[#5868ff]" />
                      <span className="text-sm font-semibold text-[#2d2f32]">Gửi Thông báo Toàn cục</span>
                    </span>
                    <span className="text-xs font-bold text-[#5868ff]">Mở</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/admin/settings/security")}
                    className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left transition-transform active:scale-[0.985]"
                  >
                    <span className="flex items-center gap-3">
                      <Settings2 className="size-4.5 text-[#ff4a90]" />
                      <span className="text-sm font-semibold text-[#2d2f32]">Kiểm tra bảo mật</span>
                    </span>
                    <span className="text-xs font-bold text-[#ff4a90]">Mở</span>
                  </button>
                </div>
              </div>

              <div className="rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-auth-headline text-lg font-bold text-[#2d2f32]">
                    Người dùng chờ rà soát
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/users")}
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#5868ff]"
                  >
                    Xem tất cả
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {queueItems.map((entry, index) => (
                    <div
                      key={entry._id}
                      className="flex items-center gap-4"
                    >
                      <div
                        className={`flex size-10 items-center justify-center rounded-xl ${avatarPalettes[index % avatarPalettes.length]}`}
                      >
                        <span className="text-xs font-bold">{getInitials(entry.displayName)}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#2d2f32]">{entry.displayName}</p>
                        <p className="text-xs text-[#7b8190]">{entry.reward}</p>
                      </div>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          entry.emailVerified ? "bg-[#f3edff] text-[#7b19d8]" : "bg-[#fff2f4] text-[#d4525d]"
                        }`}
                      >
                        {entry.emailVerified ? "Ổn" : "Chờ"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.55rem] bg-white shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            <div className="flex flex-col gap-4 border-b border-[#efeaf7] bg-[#fcfbff] px-8 py-6 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Hoạt động Gần đây</h2>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#7b19d8] shadow-[0_0_14px_rgba(123,25,216,0.45)]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#818899]">
                  Dữ liệu thời gian thực
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-[#f4f1fa]">
                  <tr>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Người dùng
                    </th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Hành động
                    </th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Thời gian
                    </th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row, index) => (
                    <tr
                      key={row.key}
                      className="border-t border-[#f0ebf8] transition-colors hover:bg-[#fcfbff]"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex size-9 items-center justify-center rounded-full ${avatarPalettes[index % avatarPalettes.length]}`}
                          >
                            <span className="text-[11px] font-bold">{getInitials(row.name)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#2d2f32]">{row.name}</p>
                            <p className="text-xs text-[#7b8190]">{row.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className={`text-sm font-medium ${row.actionAccent ?? "text-[#2d2f32]"}`}>{row.action}</p>
                      </td>
                      <td className="px-8 py-5 text-sm text-[#7b8190]">{row.time}</td>
                      <td className="px-8 py-5 text-right">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${row.statusClassName}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[#f8f5ff] px-8 py-4 text-center">
              <button
                type="button"
                onClick={() => void loadOverview()}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#7f8595] transition-colors hover:text-[#7b19d8]"
              >
                <Sparkles className="size-3.5" />
                TẢI THÊM HOẠT ĐỘNG
              </button>
            </div>
          </section>

        </>
      ) : (
        <div className="rounded-[1.5rem] bg-white px-6 py-12 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.16)]">
          Không tải được dữ liệu admin.
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/chat")}
        className="fixed bottom-8 right-8 z-40 hidden size-14 items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_24px_45px_-24px_rgba(123,25,216,0.45)] transition-transform hover:scale-105 active:scale-95 lg:flex"
        aria-label="Liên hệ kỹ thuật"
      >
        <CircleHelp className="size-5" />
      </button>
    </AdminShell>
  );
}
