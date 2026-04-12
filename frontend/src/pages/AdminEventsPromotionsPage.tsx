import AdminShell from "@/components/admin/AdminShell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminService } from "@/services/adminService";
import type { AdminCampaignCategory, AdminCampaignRow, AdminCampaignStatus } from "@/types/admin";
import axios from "axios";
import {
  CalendarDays,
  Gift,
  Megaphone,
  Pencil,
  Percent,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface CampaignFormState {
  title: string;
  status: AdminCampaignStatus;
  audience: string;
  benefit: string;
  summary: string;
  startAt: string;
  endAt: string;
  highlighted: boolean;
}

const createEmptyFormState = (): CampaignFormState => ({
  title: "",
  status: "draft",
  audience: "",
  benefit: "",
  summary: "",
  startAt: "",
  endAt: "",
  highlighted: false,
});

const statusOptions: ReadonlyArray<{ value: AdminCampaignStatus; label: string }> = [
  { value: "draft", label: "Nháp" },
  { value: "scheduled", label: "Đã lên lịch" },
  { value: "running", label: "Đang chạy" },
  { value: "paused", label: "Tạm dừng" },
  { value: "completed", label: "Kết thúc" },
];

const statusMeta: Record<AdminCampaignStatus, { label: string; className: string }> = {
  draft: { label: "Nháp", className: "bg-[#fff7ea] text-[#c97a12]" },
  scheduled: { label: "Đã lên lịch", className: "bg-[#eef1ff] text-[#5868ff]" },
  running: { label: "Đang chạy", className: "bg-[#eefbf4] text-[#00a46f]" },
  paused: { label: "Tạm dừng", className: "bg-[#f4f1fa] text-[#707786]" },
  completed: { label: "Kết thúc", className: "bg-[#f3edff] text-[#7b19d8]" },
};

const categoryMeta: Record<AdminCampaignCategory, { label: string; icon: typeof CalendarDays; iconClassName: string }> = {
  event: { label: "Sự kiện", icon: CalendarDays, iconClassName: "bg-[#eef1ff] text-[#5868ff]" },
  promotion: { label: "Ưu đãi", icon: Percent, iconClassName: "bg-[#fff0f5] text-[#d4525d]" },
};

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "Chưa chốt lịch";

const formatPeriod = (campaign: AdminCampaignRow) => {
  if (!campaign.startAt && !campaign.endAt) {
    return "Chưa chốt lịch";
  }

  if (campaign.startAt && campaign.endAt) {
    return `${formatDateTime(campaign.startAt)} - ${formatDateTime(campaign.endAt)}`;
  }

  return campaign.startAt
    ? `Bắt đầu: ${formatDateTime(campaign.startAt)}`
    : `Kết thúc: ${formatDateTime(campaign.endAt)}`;
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

export default function AdminEventsPromotionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [campaigns, setCampaigns] = useState<AdminCampaignRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | AdminCampaignStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CampaignFormState>(createEmptyFormState());
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  const syncCampaigns = async () => {
    try {
      setLoadingCampaigns(true);
      const res = await adminService.getCampaigns();
      setCampaigns(res.campaigns);
    } catch (error) {
      console.error("Không tải được danh sách chiến dịch", error);
      toast.error(getErrorMessage(error, "Không tải được danh sách chiến dịch."));
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    void syncCampaigns();
  }, []);

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        if (campaign.category !== "event") {
          return false;
        }

        const matchesSearch =
          !deferredSearchTerm ||
          [campaign.title, campaign.audience, campaign.benefit, campaign.summary]
            .join(" ")
            .toLowerCase()
            .includes(deferredSearchTerm);
        const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;

        return matchesSearch && matchesStatus;
      }),
    [campaigns, deferredSearchTerm, statusFilter]
  );

  const summary = useMemo(
    () => ({
      total: filteredCampaigns.length,
      running: filteredCampaigns.filter((campaign) => campaign.status === "running").length,
      scheduled: filteredCampaigns.filter((campaign) => campaign.status === "scheduled").length,
      completed: filteredCampaigns.filter((campaign) => campaign.status === "completed").length,
      highlighted: filteredCampaigns.filter((campaign) => campaign.highlighted).length,
    }),
    [filteredCampaigns]
  );

  const handleOpenCreate = () => {
    setEditingCampaignId(null);
    setFormState(createEmptyFormState());
    setFormOpen(true);
  };

  const handleOpenEdit = (campaign: AdminCampaignRow) => {
    setEditingCampaignId(campaign.id);
    setFormState({
      title: campaign.title,
      status: campaign.status,
      audience: campaign.audience,
      benefit: campaign.benefit,
      summary: campaign.summary,
      startAt: toDateTimeLocalValue(campaign.startAt),
      endAt: toDateTimeLocalValue(campaign.endAt),
      highlighted: campaign.highlighted,
    });
    setFormOpen(true);
  };

  const handleSaveCampaign = async () => {
    const title = formState.title.trim();
    const audience = formState.audience.trim();
    const benefit = formState.benefit.trim();
    const summaryValue = formState.summary.trim();

    if (!title || !audience || !benefit || !summaryValue) {
      toast.error("Vui lòng nhập đủ tiêu đề, nhóm áp dụng, quyền lợi và mô tả.");
      return;
    }

    const payload = {
      title,
      category: "event" as const,
      status: formState.status,
      audience,
      benefit,
      summary: summaryValue,
      startAt: formState.startAt ? new Date(formState.startAt).toISOString() : null,
      endAt: formState.endAt ? new Date(formState.endAt).toISOString() : null,
      highlighted: formState.highlighted,
    };

    try {
      setSavingCampaign(true);

      if (editingCampaignId) {
        const res = await adminService.updateCampaign(editingCampaignId, payload);
        toast.success(res.message || "Đã cập nhật chiến dịch.");
      } else {
        const res = await adminService.createCampaign(payload);
        toast.success(res.message || "Đã tạo chiến dịch mới.");
      }

      await syncCampaigns();
      setFormOpen(false);
    } catch (error) {
      console.error("Không lưu được chiến dịch", error);
      toast.error(getErrorMessage(error, "Không lưu được chiến dịch."));
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleStatusChange = async (campaignId: string, status: AdminCampaignStatus) => {
    try {
      const res = await adminService.updateCampaignStatus(campaignId, { status });
      setCampaigns((current) => current.map((campaign) => (campaign.id === campaignId ? res.campaign : campaign)));
      toast.success(res.message || "Đã cập nhật trạng thái chiến dịch.");
    } catch (error) {
      console.error("Không cập nhật được trạng thái chiến dịch", error);
      toast.error(getErrorMessage(error, "Không cập nhật được trạng thái chiến dịch."));
    }
  };

  const handleDeleteCampaign = async (campaign: AdminCampaignRow) => {
    if (!window.confirm(`Xoá chiến dịch "${campaign.title}"?`)) {
      return;
    }

    try {
      const res = await adminService.deleteCampaign(campaign.id);
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      toast.success(res.message || "Đã xoá chiến dịch.");
    } catch (error) {
      console.error("Không xoá được chiến dịch", error);
      toast.error(getErrorMessage(error, "Không xoá được chiến dịch."));
    }
  };

  return (
    <>
      <AdminShell
        title="Quản lý sự kiện"
        subtitle="Quản trị các sự kiện vận hành đang hiển thị trong hệ thống."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm kiếm sự kiện đang chạy..."
        sidebarActionLabel="Tạo sự kiện"
        onSidebarActionClick={handleOpenCreate}
        action={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="auth-premium-gradient auth-soft-shadow inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <Plus className="size-4.5" />
            Tạo sự kiện
          </button>
        }
      >
        <section className="grid gap-5 xl:grid-cols-4">
          {[
            { label: "Chiến dịch hiển thị", value: formatNumber(summary.total), icon: Megaphone, iconClassName: "bg-[#f2ebff] text-[#7b19d8]" },
            { label: "Đang chạy", value: formatNumber(summary.running), icon: Gift, iconClassName: "bg-[#fff0f5] text-[#d4525d]" },
            { label: "Đã lên lịch", value: formatNumber(summary.scheduled), icon: CalendarDays, iconClassName: "bg-[#eef1ff] text-[#5868ff]" },
            { label: "Đã kết thúc", value: formatNumber(summary.completed), icon: Sparkles, iconClassName: "bg-[#fff7ea] text-[#c97a12]" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
                <div className={`flex size-12 items-center justify-center rounded-2xl ${card.iconClassName}`}>
                  <Icon className="size-5" />
                </div>
                <p className="mt-5 text-sm font-medium text-[#6d7282]">{card.label}</p>
                <p className="mt-1 font-auth-headline text-[2rem] font-extrabold tracking-[-0.04em] text-[#2d2f32]">{card.value}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-[1.8rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8f96a4]">
            Trạng thái module
          </p>
          <h2 className="mt-3 font-auth-headline text-2xl font-bold text-[#2d2f32]">
            Chỉ còn quản lý sự kiện vận hành
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7b8190]">
            Các module khuyến mãi đã được ẩn khỏi giao diện admin. Khu vực này hiện chỉ dùng để tạo, cập nhật và theo dõi các sự kiện vận hành thật sự cần thiết.
          </p>
        </section>

        <section className="flex justify-end">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | AdminCampaignStatus)}
            className="h-11 rounded-2xl border-none bg-white px-4 text-sm font-semibold text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20"
          >
            <option value="all">Tất cả trạng thái</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-[1.7rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Danh sách sự kiện</h2>
              <p className="mt-1 text-sm text-[#7b8190]">Chỉ hiển thị các sự kiện vận hành đang được quản trị trong hệ thống.</p>
            </div>
            <span className="rounded-full bg-[#f3edff] px-3 py-1 text-xs font-bold text-[#7b19d8]">
              {summary.total ? `${formatNumber(summary.highlighted)}/${formatNumber(summary.total)} nổi bật` : "Chưa có dữ liệu"}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {loadingCampaigns ? (
              <div className="rounded-[1.4rem] bg-[#faf8ff] px-6 py-12 text-center text-sm font-medium text-[#6c7281]">
                Đang tải danh sách chiến dịch...
              </div>
            ) : filteredCampaigns.length ? (
              filteredCampaigns.map((campaign) => {
                const category = categoryMeta[campaign.category];
                const status = statusMeta[campaign.status];
                const Icon = category.icon;

                return (
                  <div key={campaign.id} className="rounded-[1.4rem] border border-[#f0ebf8] bg-[#fcfbff] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex size-11 items-center justify-center rounded-2xl ${category.iconClassName}`}>
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-[#2d2f32]">{campaign.title}</h3>
                            {campaign.highlighted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7ea] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#c97a12]">
                                <Star className="size-3" />
                                Nổi bật
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-[#7b8190]">{campaign.summary}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${status.className}`}>
                          {status.label}
                        </span>
                        <select
                          value={campaign.status}
                          onChange={(event) => void handleStatusChange(campaign.id, event.target.value as AdminCampaignStatus)}
                          className="h-9 rounded-xl border-none bg-white px-3 text-xs font-bold uppercase tracking-[0.12em] text-[#4f5665] outline-none ring-1 ring-[#ece5f7] transition-all focus:ring-[#7b19d8]/30"
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Loại</p>
                        <p className="mt-2 text-sm font-bold text-[#2d2f32]">{category.label}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Thời gian</p>
                        <p className="mt-2 text-sm font-bold text-[#2d2f32]">{formatPeriod(campaign)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Quyền lợi</p>
                        <p className="mt-2 text-sm font-bold text-[#2d2f32]">{campaign.benefit}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Nhóm áp dụng</p>
                      <p className="mt-2 text-sm font-medium text-[#4f5665]">{campaign.audience}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(campaign)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#f3edff] px-4 py-2.5 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#ebdefd]"
                      >
                        <Pencil className="size-4" />
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCampaign(campaign)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#fff0f5] px-4 py-2.5 text-sm font-bold text-[#d4525d] transition-colors hover:bg-[#ffe6ef]"
                      >
                        <Trash2 className="size-4" />
                        Xoá
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.4rem] bg-[#faf8ff] px-6 py-12 text-center text-sm font-medium text-[#6c7281]">
                Chưa có chiến dịch nào khớp bộ lọc hiện tại.
              </div>
            )}
          </div>
        </section>
      </AdminShell>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-none bg-white sm:max-w-2xl">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
              {editingCampaignId ? "Cập nhật sự kiện" : "Tạo sự kiện mới"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#7b8190]">
              Thiết lập lịch chạy, nhóm áp dụng và quyền lợi cho sự kiện vận hành trong cùng một form.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="campaign-title">Tên sự kiện</Label>
              <Input id="campaign-title" value={formState.title} onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))} placeholder="Ví dụ: Chuỗi nhiệm vụ cuối tuần" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-status">Trạng thái sự kiện</Label>
              <select id="campaign-status" value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as AdminCampaignStatus }))} className="h-10 w-full rounded-md border border-[#e5dbf5] bg-white px-3 text-sm outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20">
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-start">Bắt đầu</Label>
              <Input id="campaign-start" type="datetime-local" value={formState.startAt} onChange={(event) => setFormState((current) => ({ ...current, startAt: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-end">Kết thúc</Label>
              <Input id="campaign-end" type="datetime-local" value={formState.endAt} onChange={(event) => setFormState((current) => ({ ...current, endAt: event.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="campaign-audience">Nhóm áp dụng</Label>
              <Input id="campaign-audience" value={formState.audience} onChange={(event) => setFormState((current) => ({ ...current, audience: event.target.value }))} placeholder="Ví dụ: User hoạt động 7 ngày gần nhất" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="campaign-benefit">Quyền lợi</Label>
              <Input id="campaign-benefit" value={formState.benefit} onChange={(event) => setFormState((current) => ({ ...current, benefit: event.target.value }))} placeholder="Ví dụ: Tăng thưởng nhiệm vụ trong 48 giờ" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="campaign-summary">Mô tả vận hành</Label>
              <Textarea id="campaign-summary" value={formState.summary} onChange={(event) => setFormState((current) => ({ ...current, summary: event.target.value }))} className="min-h-28" placeholder="Mục tiêu, cách áp dụng và điểm cần lưu ý." />
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-[#faf8ff] px-4 py-3 md:col-span-2">
              <input type="checkbox" checked={formState.highlighted} onChange={(event) => setFormState((current) => ({ ...current, highlighted: event.target.checked }))} className="size-4 rounded border-[#d9cfee] text-[#7b19d8] focus:ring-[#7b19d8]/20" />
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Đánh dấu nổi bật</p>
                <p className="text-xs text-[#7b8190]">Ưu tiên theo dõi và hiển thị các sự kiện này.</p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#f3edff] px-5 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#ebdefd]">
              Đóng
            </button>
            <button type="button" onClick={() => void handleSaveCampaign()} disabled={savingCampaign} className="auth-premium-gradient inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70">
              {savingCampaign ? "Đang lưu..." : editingCampaignId ? "Lưu thay đổi" : "Tạo sự kiện"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
