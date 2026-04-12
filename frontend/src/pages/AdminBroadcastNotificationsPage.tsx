import AdminShell from "@/components/admin/AdminShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminService } from "@/services/adminService";
import type {
  AdminBroadcastAudience,
  AdminBroadcastNotificationsResponse,
  AdminBroadcastStatus,
  AdminBroadcastType,
} from "@/types/admin";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Megaphone,
  RefreshCcw,
  Send,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface BroadcastFormState {
  title: string;
  content: string;
  type: AdminBroadcastType;
  audience: AdminBroadcastAudience;
  imageUrl: string;
  scheduledAt: string;
}

const createEmptyFormState = (): BroadcastFormState => ({
  title: "",
  content: "",
  type: "system",
  audience: "all",
  imageUrl: "",
  scheduledAt: "",
});

const emptySummary: AdminBroadcastNotificationsResponse["summary"] = {
  total: 0,
  sent: 0,
  scheduled: 0,
  system: 0,
  promotion: 0,
  warning: 0,
  task: 0,
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
    : "Chưa thiết lập";

const typeMeta: Record<
  AdminBroadcastType,
  {
    label: string;
    icon: typeof Megaphone;
    cardClassName: string;
    badgeClassName: string;
    previewClassName: string;
  }
> = {
  system: {
    label: "Hệ thống",
    icon: Megaphone,
    cardClassName: "bg-[#fff2e2] text-[#d97706]",
    badgeClassName: "bg-[#fff2e2] text-[#d97706]",
    previewClassName: "bg-[#fff2e2] text-[#d97706]",
  },
  promotion: {
    label: "Khuyến mãi",
    icon: Sparkles,
    cardClassName: "bg-[#fff0f5] text-[#d4525d]",
    badgeClassName: "bg-[#fff0f5] text-[#d4525d]",
    previewClassName: "bg-[#fff0f5] text-[#d4525d]",
  },
  warning: {
    label: "Cảnh báo",
    icon: TriangleAlert,
    cardClassName: "bg-[#fff0f2] text-[#b31b25]",
    badgeClassName: "bg-[#fff0f2] text-[#b31b25]",
    previewClassName: "bg-[#fff0f2] text-[#b31b25]",
  },
  task: {
    label: "Nhiệm vụ",
    icon: BellRing,
    cardClassName: "bg-[#f3edff] text-[#7b19d8]",
    badgeClassName: "bg-[#f3edff] text-[#7b19d8]",
    previewClassName: "bg-[#f3edff] text-[#7b19d8]",
  },
};

const audienceMeta: Record<
  AdminBroadcastAudience,
  {
    label: string;
    helper: string;
  }
> = {
  all: {
    label: "Tất cả user",
    helper: "Mọi tài khoản người dùng trong hệ thống",
  },
  verified: {
    label: "User đã xác minh",
    helper: "Chỉ gửi cho tài khoản đã xác minh email",
  },
  new_7d: {
    label: "User mới 7 ngày",
    helper: "Tập user vừa tạo tài khoản trong 7 ngày gần nhất",
  },
};

const statusMeta: Record<
  AdminBroadcastStatus,
  {
    label: string;
    className: string;
  }
> = {
  sent: {
    label: "Đã gửi",
    className: "bg-[#eefbf4] text-[#00a46f]",
  },
  scheduled: {
    label: "Đã lên lịch",
    className: "bg-[#eef1ff] text-[#5868ff]",
  },
};

export default function AdminBroadcastNotificationsPage() {
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [response, setResponse] = useState<AdminBroadcastNotificationsResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formState, setFormState] = useState<BroadcastFormState>(createEmptyFormState());
  const [loading, setLoading] = useState(true);
  const [submittingStatus, setSubmittingStatus] = useState<AdminBroadcastStatus | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  const syncBroadcastNotifications = async () => {
    try {
      setLoading(true);
      const data = await adminService.getBroadcastNotifications();
      setResponse(data);
    } catch (error) {
      console.error("Không tải được lịch sử broadcast notification", error);
      toast.error("Không tải được danh sách thông báo toàn user.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void syncBroadcastNotifications();
  }, []);

  const notifications = response?.notifications ?? [];
  const summary = response?.summary ?? emptySummary;

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (!deferredSearchTerm) {
          return true;
        }

        return [notification.title, notification.content, typeMeta[notification.type].label]
          .join(" ")
          .toLowerCase()
          .includes(deferredSearchTerm);
      }),
    [deferredSearchTerm, notifications]
  );

  const totalRecipients = useMemo(
    () => notifications.reduce((total, notification) => total + notification.recipientCount, 0),
    [notifications]
  );

  const scrollToComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (status: AdminBroadcastStatus) => {
    const title = formState.title.trim();
    const content = formState.content.trim();
    const imageUrl = formState.imageUrl.trim();

    if (!title || !content) {
      toast.error("Vui lòng nhập tiêu đề và nội dung thông báo.");
      return;
    }

    if (status === "scheduled" && !formState.scheduledAt) {
      toast.error("Vui lòng chọn thời gian gửi cho thông báo đã lên lịch.");
      return;
    }

    try {
      setSubmittingStatus(status);

      const scheduledAt =
        status === "scheduled" && formState.scheduledAt
          ? new Date(formState.scheduledAt).toISOString()
          : null;

      const res = await adminService.createBroadcastNotification({
        title,
        content,
        type: formState.type,
        audience: formState.audience,
        status,
        imageUrl: imageUrl || undefined,
        scheduledAt,
      });

      toast.success(res.message || "Đã lưu thông báo toàn user.");
      setFormState(createEmptyFormState());
      await syncBroadcastNotifications();
    } catch (error) {
      console.error("Không gửi được broadcast notification", error);
      toast.error("Không gửi được thông báo toàn user.");
    } finally {
      setSubmittingStatus(null);
    }
  };

  const previewType = typeMeta[formState.type];
  const PreviewIcon = previewType.icon;
  const previewTimestamp = formState.scheduledAt
    ? formatDateTime(new Date(formState.scheduledAt).toISOString())
    : "Ngay khi bấm gửi";

  return (
    <AdminShell
      title="Thông báo Toàn User"
      subtitle="Soạn, gửi ngay hoặc lên lịch thông báo hệ thống đến toàn bộ nhóm người dùng đã chọn."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm theo tiêu đề hoặc nội dung thông báo..."
      sidebarActionLabel="Soạn thông báo"
      onSidebarActionClick={scrollToComposer}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void syncBroadcastNotifications()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#5d6474] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.16)] transition-colors hover:text-[#7b19d8]"
          >
            <RefreshCcw className="size-4.5" />
            Làm mới
          </button>
          <button
            type="button"
            onClick={scrollToComposer}
            className="auth-premium-gradient auth-soft-shadow inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <BellRing className="size-4.5" />
            Soạn thông báo
          </button>
        </div>
      }
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Tổng thông báo",
            value: formatNumber(summary.total),
            helper: "Toàn bộ lịch sử gửi trong admin",
            icon: BellRing,
            iconClassName: "bg-[#f3edff] text-[#7b19d8]",
          },
          {
            label: "Đã gửi",
            value: formatNumber(summary.sent),
            helper: "Thông báo đã phát hành tới user",
            icon: CheckCircle2,
            iconClassName: "bg-[#eefbf4] text-[#00a46f]",
          },
          {
            label: "Đang lên lịch",
            value: formatNumber(summary.scheduled),
            helper: "Sẽ tự gửi khi đến thời gian cài đặt",
            icon: CalendarClock,
            iconClassName: "bg-[#eef1ff] text-[#5868ff]",
          },
          {
            label: "Tổng lượt tiếp cận",
            value: formatNumber(totalRecipients),
            helper: "Cộng dồn quy mô nhóm nhận của từng lần gửi",
            icon: Users,
            iconClassName: "bg-[#fff2e2] text-[#d97706]",
          },
        ].map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]"
            >
              <div className={`flex size-12 items-center justify-center rounded-2xl ${card.iconClassName}`}>
                <Icon className="size-5" />
              </div>
              <p className="mt-5 text-sm font-medium text-[#6d7282]">{card.label}</p>
              <p className="mt-1 font-auth-headline text-[2rem] font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                {card.value}
              </p>
              <p className="mt-2 text-xs font-medium text-[#8b92a1]">{card.helper}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div
          ref={composerRef}
          className="rounded-[1.7rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)] sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-gradient-primary" />
            <div>
              <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Soạn nội dung</h2>
              <p className="mt-1 text-sm text-[#7b8190]">
                Hỗ trợ gửi ngay hoặc lên lịch, kèm ảnh minh họa bằng URL nếu cần.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="broadcast-title"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]"
              >
                Tiêu đề thông báo
              </label>
              <Input
                id="broadcast-title"
                value={formState.title}
                onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ví dụ: Bảo trì hệ thống lúc 23:00"
                className="h-14 rounded-2xl border-none bg-[#f6f1ff] px-4 text-base text-[#2d2f32] shadow-none focus-visible:ring-[3px] focus-visible:ring-[#7b19d8]/15"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="broadcast-content"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]"
              >
                Nội dung thông báo
              </label>
              <Textarea
                id="broadcast-content"
                value={formState.content}
                onChange={(event) => setFormState((current) => ({ ...current, content: event.target.value }))}
                placeholder="Mô tả ngắn gọn, rõ ràng điều user cần biết hoặc cần làm."
                className="min-h-36 rounded-[1.4rem] border-none bg-[#f6f1ff] px-4 py-4 text-sm leading-7 text-[#2d2f32] shadow-none focus-visible:ring-[3px] focus-visible:ring-[#7b19d8]/15"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="broadcast-type"
                  className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]"
                >
                  Loại thông báo
                </label>
                <select
                  id="broadcast-type"
                  value={formState.type}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      type: event.target.value as AdminBroadcastType,
                    }))
                  }
                  className="h-14 w-full rounded-2xl border-none bg-[#f6f1ff] px-4 text-sm font-semibold text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20"
                >
                  {Object.entries(typeMeta).map(([key, meta]) => (
                    <option
                      key={key}
                      value={key}
                    >
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="broadcast-audience"
                  className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]"
                >
                  Đối tượng nhận
                </label>
                <select
                  id="broadcast-audience"
                  value={formState.audience}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      audience: event.target.value as AdminBroadcastAudience,
                    }))
                  }
                  className="h-14 w-full rounded-2xl border-none bg-[#f6f1ff] px-4 text-sm font-semibold text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20"
                >
                  {Object.entries(audienceMeta).map(([key, meta]) => (
                    <option
                      key={key}
                      value={key}
                    >
                      {meta.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#8b92a1]">{audienceMeta[formState.audience].helper}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <label
                  htmlFor="broadcast-image-url"
                  className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]"
                >
                  Ảnh minh họa
                </label>
                <Input
                  id="broadcast-image-url"
                  value={formState.imageUrl}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      imageUrl: event.target.value,
                    }))
                  }
                  placeholder="Dán URL ảnh để hiện ở phần preview"
                  className="h-14 rounded-2xl border-none bg-[#f6f1ff] px-4 text-sm text-[#2d2f32] shadow-none focus-visible:ring-[3px] focus-visible:ring-[#7b19d8]/15"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="broadcast-scheduled-at"
                  className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]"
                >
                  Hẹn giờ gửi
                </label>
                <Input
                  id="broadcast-scheduled-at"
                  type="datetime-local"
                  value={formState.scheduledAt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      scheduledAt: event.target.value,
                    }))
                  }
                  className="h-14 rounded-2xl border-none bg-[#f6f1ff] px-4 text-sm text-[#2d2f32] shadow-none focus-visible:ring-[3px] focus-visible:ring-[#7b19d8]/15"
                />
              </div>
            </div>

            <div className="rounded-[1.45rem] bg-[#faf7ff] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#7b19d8] shadow-[0_18px_35px_-28px_rgba(123,25,216,0.34)]">
                  <ImagePlus className="size-4.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2d2f32]">Lưu ý vận hành</p>
                  <p className="mt-1 text-sm leading-6 text-[#7b8190]">
                    Thông báo đã lên lịch sẽ tự chuyển sang trạng thái gửi khi tới đúng thời gian cài đặt.
                    Nếu để trống ảnh minh họa, hệ thống chỉ gửi phần tiêu đề và nội dung.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void handleSubmit("scheduled")}
                disabled={submittingStatus !== null}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#f1ecfb] px-6 text-sm font-bold text-[#6951a8] transition-colors hover:bg-[#ebe2fb] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Clock3 className="size-4.5" />
                {submittingStatus === "scheduled" ? "Đang lên lịch..." : "Lên lịch gửi"}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit("sent")}
                disabled={submittingStatus !== null}
                className="auth-premium-gradient auth-soft-shadow inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Send className="size-4.5" />
                {submittingStatus === "sent" ? "Đang gửi..." : "Gửi ngay"}
              </button>
            </div>
          </div>
        </div>

        <aside className="xl:sticky xl:top-28 xl:self-start">
          <div className="rounded-[1.7rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">
                  Xem trước thông báo
                </p>
                <h2 className="mt-1 font-auth-headline text-lg font-bold text-[#2d2f32]">Realtime Preview</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${previewType.badgeClassName}`}>
                {previewType.label}
              </span>
            </div>

            <div className="mt-6 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.2),_rgba(18,18,36,0.98)_55%)] p-4 shadow-[0_28px_70px_-42px_rgba(25,16,76,0.55)]">
              <div className="mx-auto max-w-[280px] rounded-[2.4rem] border-[10px] border-[#11111d] px-4 pb-6 pt-3 text-white">
                <div className="mx-auto h-5 w-28 rounded-full bg-black/55" />

                <div className="mt-6 rounded-[1.45rem] bg-white/12 p-3 backdrop-blur-lg">
                  <div className="flex items-start gap-3">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${previewType.previewClassName}`}>
                      <PreviewIcon className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                        App Notification
                      </p>
                      <p className="mt-1 text-sm font-bold leading-5 text-white">
                        {formState.title.trim() || "Tiêu đề sẽ hiển thị ở đây"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/72">
                        {formState.content.trim() || "Nội dung thông báo sẽ được mô phỏng tại đây để admin rà trước khi gửi."}
                      </p>
                    </div>
                  </div>

                  {formState.imageUrl.trim() ? (
                    <img
                      src={formState.imageUrl}
                      alt="Preview"
                      className="mt-3 h-28 w-full rounded-[1.15rem] object-cover"
                    />
                  ) : null}
                </div>

                <div className="mt-12 text-center">
                  <p className="font-auth-headline text-5xl font-extrabold tracking-[-0.06em]">09:41</p>
                  <p className="mt-2 text-sm text-white/58">{previewTimestamp}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-[1.45rem] bg-[#faf7ff] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Loại</span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${previewType.badgeClassName}`}>
                  {previewType.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Nhóm nhận</span>
                <span className="text-sm font-bold text-[#2d2f32]">{audienceMeta[formState.audience].label}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Chế độ</span>
                <span className="text-sm font-bold text-[#2d2f32]">
                  {formState.scheduledAt ? "Lên lịch sẵn" : "Sẵn sàng gửi ngay"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-[1.7rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Lịch sử phát hành</h2>
            <p className="mt-1 text-sm text-[#7b8190]">
              Theo dõi các đợt gửi gần đây, trạng thái và quy mô nhóm người nhận.
            </p>
          </div>
          <span className="rounded-full bg-[#f3edff] px-3 py-1 text-xs font-bold text-[#7b19d8]">
            {formatNumber(filteredNotifications.length)} bản ghi hiển thị
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="rounded-[1.45rem] bg-[#faf8ff] px-6 py-12 text-center text-sm font-medium text-[#6c7281]">
              Đang tải lịch sử thông báo...
            </div>
          ) : filteredNotifications.length ? (
            filteredNotifications.map((notification) => {
              const meta = typeMeta[notification.type];
              const Icon = meta.icon;
              const status = statusMeta[notification.status];

              return (
                <article
                  key={notification.id}
                  className="rounded-[1.45rem] border border-[#f0ebf8] bg-[#fcfbff] p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${meta.cardClassName}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-[#2d2f32]">{notification.title}</h3>
                          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${meta.badgeClassName}`}>
                            {meta.label}
                          </span>
                          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[#646c7d]">{notification.content}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-[0_16px_35px_-30px_rgba(123,25,216,0.18)]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Lượt nhận</p>
                      <p className="mt-1 text-lg font-extrabold text-[#2d2f32]">
                        {formatNumber(notification.recipientCount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Đối tượng</p>
                      <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                        {audienceMeta[notification.audience].label}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Thời điểm gửi</p>
                      <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                        {formatDateTime(notification.sentAt ?? notification.scheduledAt)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Người tạo</p>
                      <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                        {notification.createdByName || "Admin"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">Thiết lập</p>
                      <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                        {notification.imageUrl ? "Có ảnh minh họa" : "Chỉ text"}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[1.45rem] bg-[#faf8ff] px-6 py-12 text-center text-sm font-medium text-[#6c7281]">
              Chưa có thông báo nào khớp với từ khóa tìm kiếm hiện tại.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
