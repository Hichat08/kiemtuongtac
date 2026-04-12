import AdminShell from "@/components/admin/AdminShell";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminService } from "@/services/adminService";
import type {
  AdminTaskPlatform,
  AdminTaskRow,
  AdminTaskStatus,
  AdminTaskSubmissionRow,
} from "@/types/admin";
import axios from "axios";
import {
  BadgeCheck,
  CheckCheck,
  Clock3,
  ExternalLink,
  Flame,
  ListTodo,
  Pencil,
  Plus,
  SquareCheckBig,
  ThumbsDown,
  ThumbsUp,
  TimerReset,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PlatformFilter = "all" | AdminTaskPlatform;

interface TaskFormState {
  code: string;
  title: string;
  brand: string;
  platform: AdminTaskPlatform;
  reward: string;
  current: string;
  target: string;
  status: AdminTaskStatus;
  description: string;
  actionLabel: string;
  hot: boolean;
}

const platformTabs = [
  { id: "all", label: "Tất cả" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "other", label: "Khác" },
] as const satisfies ReadonlyArray<{ id: PlatformFilter; label: string }>;

const taskStatusOptions: ReadonlyArray<{ value: AdminTaskStatus; label: string }> = [
  { value: "running", label: "Đang chạy" },
  { value: "pending", label: "Chờ mở" },
  { value: "completed", label: "Kết thúc" },
  { value: "paused", label: "Tạm dừng" },
];

const createEmptyFormState = (): TaskFormState => ({
  code: "",
  title: "",
  brand: "",
  platform: "facebook",
  reward: "",
  current: "0",
  target: "",
  status: "pending",
  description: "",
  actionLabel: "Nhận nhiệm vụ",
  hot: false,
});

const formatCurrency = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(value))
    : "Chưa có thời điểm";

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

const getStatusMeta = (status: AdminTaskStatus) => {
  switch (status) {
    case "running":
      return { label: "Đang chạy", className: "bg-[#eefbf4] text-[#00a46f]" };
    case "pending":
      return { label: "Chờ mở", className: "bg-[#eef1ff] text-[#5868ff]" };
    case "completed":
      return { label: "Kết thúc", className: "bg-[#f3edff] text-[#7b19d8]" };
    case "paused":
      return { label: "Tạm dừng", className: "bg-[#f4f1fa] text-[#707786]" };
  }
};

const getPlatformMeta = (platform: AdminTaskPlatform) => {
  switch (platform) {
    case "facebook":
      return { label: "Facebook", dotClassName: "bg-[#1877f2]", cardClassName: "bg-[#eaf2ff] text-[#1b5fd5]" };
    case "tiktok":
      return { label: "TikTok", dotClassName: "bg-[#ff4a90]", cardClassName: "bg-[#fff0f5] text-[#d8589f]" };
    case "youtube":
      return { label: "YouTube", dotClassName: "bg-[#ff4d67]", cardClassName: "bg-[#fff1f4] text-[#d4525d]" };
    case "other":
      return { label: "Khác", dotClassName: "bg-[#7b19d8]", cardClassName: "bg-[#f3edff] text-[#7b19d8]" };
  }
};

const getSubmissionStatusMeta = (status: AdminTaskSubmissionRow["status"]) => {
  switch (status) {
    case "pending":
      return { label: "Chờ duyệt", className: "bg-[#eefbf4] text-[#006945]" };
    case "approved":
      return { label: "Đã duyệt", className: "bg-[#f3edff] text-[#7b19d8]" };
    case "rejected":
      return { label: "Đã từ chối", className: "bg-[#fff0f1] text-[#b31b25]" };
  }
};

export default function AdminTasksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tasks, setTasks] = useState<AdminTaskRow[]>([]);
  const [taskSubmissions, setTaskSubmissions] = useState<AdminTaskSubmissionRow[]>([]);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminTaskStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [submissionDetailOpen, setSubmissionDetailOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<AdminTaskSubmissionRow | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [formState, setFormState] = useState<TaskFormState>(createEmptyFormState());
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingTaskSubmissions, setLoadingTaskSubmissions] = useState(true);
  const [savingTask, setSavingTask] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  const syncTasks = async () => {
    try {
      setLoadingTasks(true);
      const res = await adminService.getTasks();
      setTasks(res.tasks);
    } catch (error) {
      console.error("Không tải được danh sách nhiệm vụ", error);
      toast.error(getErrorMessage(error, "Không tải được danh sách nhiệm vụ."));
    } finally {
      setLoadingTasks(false);
    }
  };

  const syncTaskSubmissions = async () => {
    try {
      setLoadingTaskSubmissions(true);
      const res = await adminService.getTaskSubmissions();
      setTaskSubmissions(res.submissions);
    } catch (error) {
      console.error("Không tải được danh sách bài nộp nhiệm vụ", error);
      toast.error(getErrorMessage(error, "Không tải được danh sách bài nộp nhiệm vụ."));
    } finally {
      setLoadingTaskSubmissions(false);
    }
  };

  useEffect(() => {
    void syncTasks();
    void syncTaskSubmissions();
  }, []);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesSearch =
          !deferredSearchTerm ||
          [task.title, task.brand, task.code, task.description]
            .join(" ")
            .toLowerCase()
            .includes(deferredSearchTerm);
        const matchesPlatform = platformFilter === "all" || task.platform === platformFilter;
        const matchesStatus = statusFilter === "all" || task.status === statusFilter;

        return matchesSearch && matchesPlatform && matchesStatus;
      }),
    [deferredSearchTerm, platformFilter, statusFilter, tasks]
  );

  const summary = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((task) => task.status === "pending").length,
      running: tasks.filter((task) => task.status === "running").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      hot: tasks.filter((task) => task.hot).length,
    }),
    [tasks]
  );

  const submissionSummary = useMemo(
    () => ({
      total: taskSubmissions.length,
      pending: taskSubmissions.filter((submission) => submission.status === "pending").length,
      approved: taskSubmissions.filter((submission) => submission.status === "approved").length,
      rejected: taskSubmissions.filter((submission) => submission.status === "rejected").length,
      pendingRewardTotal: taskSubmissions
        .filter((submission) => submission.status === "pending")
        .reduce((total, submission) => total + submission.reward, 0),
    }),
    [taskSubmissions]
  );

  const pendingTaskSubmissions = useMemo(
    () => taskSubmissions.filter((submission) => submission.status === "pending").slice(0, 4),
    [taskSubmissions]
  );

  const reviewedTaskSubmissions = useMemo(
    () => taskSubmissions.filter((submission) => submission.status !== "pending").slice(0, 4),
    [taskSubmissions]
  );

  const handleOpenCreate = () => {
    setEditingTaskId(null);
    setFormState(createEmptyFormState());
    setFormOpen(true);
  };

  const handleOpenEdit = (task: AdminTaskRow) => {
    setEditingTaskId(task.id);
    setFormState({
      code: task.code,
      title: task.title,
      brand: task.brand,
      platform: task.platform,
      reward: String(task.reward),
      current: String(task.current),
      target: String(task.target),
      status: task.status,
      description: task.description,
      actionLabel: task.actionLabel,
      hot: task.hot,
    });
    setFormOpen(true);
  };

  const handleSaveTask = async () => {
    const title = formState.title.trim();
    const brand = formState.brand.trim();
    const description = formState.description.trim();
    const reward = Number(formState.reward);
    const current = Number(formState.current);
    const target = Number(formState.target);

    if (!title || !brand || !description || !Number.isFinite(reward) || !Number.isFinite(current) || !Number.isFinite(target)) {
      toast.error("Vui lòng nhập đủ dữ liệu nhiệm vụ và các giá trị số hợp lệ.");
      return;
    }

    if (target <= 0 || current < 0 || current > target || reward < 0) {
      toast.error("Phần thưởng, tiến độ và mục tiêu hiện không hợp lệ.");
      return;
    }

    const payload = {
      code: formState.code.trim(),
      title,
      brand,
      platform: formState.platform,
      reward,
      current,
      target,
      status: formState.status,
      description,
      actionLabel: formState.actionLabel.trim() || "Nhận nhiệm vụ",
      hot: formState.hot,
    };

    if (editingTaskId && !payload.code) {
      toast.error("Vui lòng nhập mã nhiệm vụ khi cập nhật.");
      return;
    }

    try {
      setSavingTask(true);

      if (editingTaskId) {
        const res = await adminService.updateTask(editingTaskId, { ...payload, code: payload.code });
        toast.success(res.message || "Đã cập nhật nhiệm vụ.");
      } else {
        const res = await adminService.createTask(payload);
        toast.success(res.message || "Đã tạo nhiệm vụ mới.");
      }

      await syncTasks();
      setFormOpen(false);
    } catch (error) {
      console.error("Không lưu được nhiệm vụ", error);
      toast.error(getErrorMessage(error, "Không lưu được nhiệm vụ."));
    } finally {
      setSavingTask(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: AdminTaskStatus) => {
    try {
      const res = await adminService.updateTaskStatus(taskId, { status });
      setTasks((current) => current.map((task) => (task.id === taskId ? res.task : task)));
      toast.success(res.message || "Đã cập nhật trạng thái nhiệm vụ.");
    } catch (error) {
      console.error("Không cập nhật được trạng thái nhiệm vụ", error);
      toast.error(getErrorMessage(error, "Không cập nhật được trạng thái nhiệm vụ."));
    }
  };

  const handleDeleteTask = async (task: AdminTaskRow) => {
    if (!window.confirm(`Xoá nhiệm vụ "${task.code} - ${task.title}"?`)) {
      return;
    }

    try {
      const res = await adminService.deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      toast.success(res.message || "Đã xoá nhiệm vụ.");
    } catch (error) {
      console.error("Không xoá được nhiệm vụ", error);
      toast.error(getErrorMessage(error, "Không xoá được nhiệm vụ."));
    }
  };

  const handleOpenSubmissionDetail = (submission: AdminTaskSubmissionRow) => {
    setSelectedSubmission(submission);
    setReviewNote(submission.reviewNote ?? "");
    setSubmissionDetailOpen(true);
  };

  const handleReviewTaskSubmission = async (status: "approved" | "rejected") => {
    if (!selectedSubmission) {
      return;
    }

    const trimmedReviewNote = reviewNote.trim();

    if (status === "rejected" && !trimmedReviewNote) {
      toast.error("Vui lòng nhập lý do từ chối bài nộp.");
      return;
    }

    try {
      setReviewingSubmissionId(selectedSubmission.id);
      const res = await adminService.reviewTaskSubmission(selectedSubmission.id, {
        status,
        reviewNote: trimmedReviewNote,
      });

      toast.success(
        res.message ||
          (status === "approved"
            ? "Đã duyệt bài nộp nhiệm vụ."
            : "Đã từ chối bài nộp nhiệm vụ.")
      );

      await Promise.all([syncTasks(), syncTaskSubmissions()]);
      setSubmissionDetailOpen(false);
      setSelectedSubmission(null);
      setReviewNote("");
    } catch (error) {
      console.error("Không xử lý được bài nộp nhiệm vụ", error);
      toast.error(getErrorMessage(error, "Không xử lý được bài nộp nhiệm vụ."));
    } finally {
      setReviewingSubmissionId(null);
    }
  };

  return (
    <>
      <AdminShell
        title="Quản lý Nhiệm vụ"
        subtitle="Quản lý catalog nhiệm vụ và duyệt bài nộp hoàn thành của user ngay trong admin."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Tìm kiếm nhiệm vụ..."
        sidebarActionLabel="Tạo nhiệm vụ mới"
        onSidebarActionClick={handleOpenCreate}
        action={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="auth-premium-gradient auth-soft-shadow inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <Plus className="size-4.5" />
            Nhiệm vụ mới
          </button>
        }
      >
        <section className="grid gap-5 xl:grid-cols-4">
          {[
            { label: "Tổng nhiệm vụ", value: summary.total, icon: ListTodo, iconClassName: "bg-[#f3edff] text-[#7b19d8]" },
            { label: "Chờ mở", value: summary.pending, icon: TimerReset, iconClassName: "bg-[#eef1ff] text-[#5868ff]" },
            { label: "Đang chạy", value: summary.running, icon: SquareCheckBig, iconClassName: "bg-[#eefbf4] text-[#00a46f]" },
            { label: "Nhiệm vụ hot", value: summary.hot, icon: Flame, iconClassName: "bg-[#fff0f5] text-[#d8589f]" },
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

        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#f1ecfb] p-1.5">
            {platformTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPlatformFilter(tab.id)}
                className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${
                  platformFilter === tab.id
                    ? "bg-white text-[#2d2f32] shadow-[0_16px_35px_-28px_rgba(123,25,216,0.32)]"
                    : "text-[#7a8190] hover:text-[#7b19d8]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | AdminTaskStatus)}
            className="h-11 rounded-2xl border-none bg-white px-4 text-sm font-semibold text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20"
          >
            <option value="all">Tất cả trạng thái</option>
            {taskStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>

        {loadingTasks ? (
          <div className="rounded-[1.55rem] bg-white px-6 py-12 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            Đang tải danh sách nhiệm vụ...
          </div>
        ) : filteredTasks.length ? (
          <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-[#f4f1fa]">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Nhiệm vụ</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Nền tảng</th>
                    <th className="px-6 py-5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Phần thưởng</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Tiến độ</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Trạng thái</th>
                    <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b91a0]">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const statusMeta = getStatusMeta(task.status);
                    const platformMeta = getPlatformMeta(task.platform);

                    return (
                      <tr key={task.id} className="border-t border-[#f0ebf8] transition-colors hover:bg-[#fcfbff]">
                        <td className="px-8 py-6">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold text-[#7b19d8]">{task.code}</p>
                              {task.hot ? (
                                <span className="inline-flex rounded-full bg-[#fff0f5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d8589f]">
                                  Hot
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm font-bold text-[#2d2f32]">{task.title}</p>
                            <p className="text-sm text-[#7b8190]">{task.brand}</p>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${platformMeta.cardClassName}`}>
                            <span className={`size-2 rounded-full ${platformMeta.dotClassName}`} />
                            {platformMeta.label}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-right text-sm font-bold text-[#00b884]">{formatCurrency(task.reward)}</td>
                        <td className="px-6 py-6">
                          <div className="w-52">
                            <div className="mb-1 flex items-center justify-between text-xs font-bold text-[#656d7c]">
                              <span>{task.current}/{task.target}</span>
                              <span>{Math.min(100, Math.round((task.current / task.target) * 100))}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#ece6f7]">
                              <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${Math.min(100, Math.round((task.current / task.target) * 100))}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                            <select
                              value={task.status}
                              onChange={(event) => void handleStatusChange(task.id, event.target.value as AdminTaskStatus)}
                              className="h-9 rounded-xl border-none bg-white px-3 text-xs font-bold uppercase tracking-[0.12em] text-[#4f5665] outline-none ring-1 ring-[#ece5f7] transition-all focus:ring-[#7b19d8]/30"
                            >
                              {taskStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => handleOpenEdit(task)} className="inline-flex size-9 items-center justify-center rounded-xl text-[#7b19d8] transition-colors hover:bg-[#f3edff]">
                              <Pencil className="size-4" />
                            </button>
                            <button type="button" onClick={() => void handleDeleteTask(task)} className="inline-flex size-9 items-center justify-center rounded-xl text-[#d8589f] transition-colors hover:bg-[#fff0f5]">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <div className="rounded-[1.55rem] bg-white px-6 py-12 text-center text-sm font-medium text-[#6c7281] shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            Chưa có dữ liệu nhiệm vụ khớp bộ lọc.
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff0f5] text-[#d8589f]">
                <TriangleAlert className="size-5" />
              </div>
              <div>
                <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Nhiệm vụ cần xử lý</h2>
                <p className="text-sm text-[#7b8190]">
                  Bài nộp của user đang chờ admin xem bằng chứng, duyệt hoặc từ chối.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {loadingTaskSubmissions ? (
                <div className="rounded-2xl bg-[#faf8ff] px-4 py-6 text-sm font-medium text-[#6c7281]">
                  Đang tải bài nộp nhiệm vụ...
                </div>
              ) : pendingTaskSubmissions.length ? (
                pendingTaskSubmissions.map((submission) => (
                  <div key={submission.id} className="rounded-2xl bg-[#faf8ff] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b19d8]">
                          {submission.taskCode}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#2d2f32]">
                          {submission.taskTitle}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#7b8190]">
                          {submission.userName} • ID {submission.userId}
                        </p>
                        <p className="mt-2 text-xs text-[#7b8190]">
                          Gửi lúc {formatDateTime(submission.submittedAt)}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-[#00b884]">
                        {formatCurrency(submission.reward)}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#eefbf4] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#006945]">
                        Chờ duyệt
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenSubmissionDetail(submission)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#f3edff] px-4 py-2 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#ebdefd]"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-[#faf8ff] px-4 py-3 text-sm font-medium text-[#6c7281]">
                  Chưa có bài nộp nào đang chờ duyệt.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#f3edff] text-[#7b19d8]">
                <BadgeCheck className="size-5" />
              </div>
              <div>
                <h2 className="font-auth-headline text-xl font-bold text-[#2d2f32]">Lịch sử duyệt gần đây</h2>
                <p className="text-sm text-[#7b8190]">
                  Tổng {submissionSummary.total} bài nộp, còn {submissionSummary.pending} bài đang chờ.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {loadingTaskSubmissions ? (
                <div className="rounded-2xl bg-[#faf8ff] px-4 py-6 text-sm font-medium text-[#6c7281]">
                  Đang tải lịch sử duyệt...
                </div>
              ) : reviewedTaskSubmissions.length ? (
                reviewedTaskSubmissions.map((submission) => {
                  const statusMeta = getSubmissionStatusMeta(submission.status);

                  return (
                    <div key={submission.id} className="rounded-2xl bg-[#faf8ff] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#2d2f32]">{submission.taskTitle}</p>
                          <p className="mt-1 text-xs font-medium text-[#7b8190]">
                            {submission.userName} • {formatDateTime(submission.reviewedAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl bg-[#faf8ff] px-4 py-3 text-sm font-medium text-[#6c7281]">
                  Chưa có bài nộp nào đã xử lý.
                </div>
              )}
            </div>
          </div>
        </section>
      </AdminShell>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-none bg-white sm:max-w-2xl">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
              {editingTaskId ? "Cập nhật nhiệm vụ" : "Tạo nhiệm vụ mới"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#7b8190]">
              Thiết lập mã nhiệm vụ, nền tảng, phần thưởng, slot và trạng thái chạy ngay trong admin.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-code">Mã nhiệm vụ</Label>
              <Input id="task-code" value={formState.code} onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Để trống để hệ thống tự sinh khi tạo mới" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-platform">Nền tảng</Label>
              <select id="task-platform" value={formState.platform} onChange={(event) => setFormState((current) => ({ ...current, platform: event.target.value as AdminTaskPlatform }))} className="h-10 w-full rounded-md border border-[#e5dbf5] bg-white px-3 text-sm outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20">
                {platformTabs.filter((tab) => tab.id !== "all").map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="task-title">Tên nhiệm vụ</Label>
              <Input id="task-title" value={formState.title} onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))} placeholder="Ví dụ: Chia sẻ bài giới thiệu sản phẩm" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="task-brand">Thương hiệu hoặc kênh</Label>
              <Input id="task-brand" value={formState.brand} onChange={(event) => setFormState((current) => ({ ...current, brand: event.target.value }))} placeholder="Ví dụ: Fanpage chính thức" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-reward">Phần thưởng</Label>
              <Input id="task-reward" type="number" min="0" value={formState.reward} onChange={(event) => setFormState((current) => ({ ...current, reward: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-status">Trạng thái</Label>
              <select id="task-status" value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as AdminTaskStatus }))} className="h-10 w-full rounded-md border border-[#e5dbf5] bg-white px-3 text-sm outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20">
                {taskStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-current">Tiến độ hiện tại</Label>
              <Input id="task-current" type="number" min="0" value={formState.current} onChange={(event) => setFormState((current) => ({ ...current, current: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-target">Mục tiêu</Label>
              <Input id="task-target" type="number" min="1" value={formState.target} onChange={(event) => setFormState((current) => ({ ...current, target: event.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="task-action-label">Nhãn nút user</Label>
              <Input id="task-action-label" value={formState.actionLabel} onChange={(event) => setFormState((current) => ({ ...current, actionLabel: event.target.value }))} placeholder="Nhận nhiệm vụ" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="task-description">Mô tả</Label>
              <Textarea id="task-description" value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} className="min-h-28" placeholder="Nêu rõ user cần làm gì và yêu cầu đầu ra." />
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-[#faf8ff] px-4 py-3 md:col-span-2">
              <input type="checkbox" checked={formState.hot} onChange={(event) => setFormState((current) => ({ ...current, hot: event.target.checked }))} className="size-4 rounded border-[#d9cfee] text-[#7b19d8] focus:ring-[#7b19d8]/20" />
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Đánh dấu nhiệm vụ hot</p>
                <p className="text-xs text-[#7b8190]">Hiển thị nhãn nổi bật ở catalog nhiệm vụ phía user.</p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#f3edff] px-5 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#ebdefd]">
              Đóng
            </button>
            <button type="button" onClick={() => void handleSaveTask()} disabled={savingTask} className="auth-premium-gradient inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70">
              {savingTask ? "Đang lưu..." : editingTaskId ? "Lưu thay đổi" : "Tạo nhiệm vụ"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={submissionDetailOpen}
        onOpenChange={(open) => {
          setSubmissionDetailOpen(open);

          if (!open) {
            setSelectedSubmission(null);
            setReviewNote("");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto border-none bg-white sm:max-w-3xl">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
              Duyệt bài nộp nhiệm vụ
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#7b8190]">
              Kiểm tra bằng chứng user gửi và quyết định cộng tiền hoặc từ chối bài nộp này.
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="space-y-5">
                <div className="rounded-[1.5rem] bg-[#faf8ff] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7b19d8]">
                        {selectedSubmission.taskCode}
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-[#2d2f32]">
                        {selectedSubmission.taskTitle}
                      </h3>
                      <p className="mt-1 text-sm text-[#7b8190]">
                        {selectedSubmission.taskBrand}
                      </p>
                    </div>
                    <span className="text-lg font-extrabold text-[#00b884]">
                      {formatCurrency(selectedSubmission.reward)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f95a3]">
                        Người gửi
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                        {selectedSubmission.userName}
                      </p>
                      <p className="mt-1 text-xs text-[#7b8190]">ID {selectedSubmission.userId}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f95a3]">
                        Thời điểm gửi
                      </p>
                      <p className="mt-2 text-sm font-bold text-[#2d2f32]">
                        {formatDateTime(selectedSubmission.submittedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-[#faf8ff] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-auth-headline text-lg font-bold text-[#2d2f32]">
                      Bằng chứng đã gửi
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                        getSubmissionStatusMeta(selectedSubmission.status).className
                      }`}
                    >
                      {getSubmissionStatusMeta(selectedSubmission.status).label}
                    </span>
                  </div>

                  {selectedSubmission.proofLink ? (
                    <a
                      href={selectedSubmission.proofLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0846ed] hover:underline"
                    >
                      Mở link bằng chứng
                      <ExternalLink className="size-4" />
                    </a>
                  ) : (
                    <p className="mt-4 text-sm text-[#7b8190]">User không gửi link bổ sung.</p>
                  )}

                  {selectedSubmission.note ? (
                    <div className="mt-4 rounded-2xl bg-white px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f95a3]">
                        Ghi chú của user
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#4f5665]">
                        {selectedSubmission.note}
                      </p>
                    </div>
                  ) : null}

                  {selectedSubmission.screenshotUrl ? (
                    <div className="mt-4 overflow-hidden rounded-[1.35rem] bg-white">
                      <img
                        src={selectedSubmission.screenshotUrl}
                        alt={`Bằng chứng ${selectedSubmission.taskCode}`}
                        className="max-h-[25rem] w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-[#7b8190]">
                      User chưa đính kèm ảnh chụp màn hình.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[1.5rem] bg-[#fcfbff] p-5 ring-1 ring-[#eee7f8]">
                  <h3 className="font-auth-headline text-lg font-bold text-[#2d2f32]">
                    Ghi chú duyệt
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#7b8190]">
                    Nếu từ chối, hãy ghi rõ lý do để user nộp lại đúng yêu cầu.
                  </p>
                  <Textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    className="mt-4 min-h-32"
                    placeholder="Nhập ghi chú duyệt hoặc lý do từ chối..."
                    disabled={selectedSubmission.status !== "pending" || Boolean(reviewingSubmissionId)}
                  />
                </div>

                {selectedSubmission.status === "pending" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleReviewTaskSubmission("rejected")}
                      disabled={reviewingSubmissionId === selectedSubmission.id}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#fff0f1] text-sm font-bold text-[#b31b25] transition-colors hover:bg-[#ffe2e5] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <ThumbsDown className="size-4" />
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReviewTaskSubmission("approved")}
                      disabled={reviewingSubmissionId === selectedSubmission.id}
                      className="auth-premium-gradient inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {reviewingSubmissionId === selectedSubmission.id ? (
                        <Clock3 className="size-4 animate-pulse" />
                      ) : (
                        <ThumbsUp className="size-4" />
                      )}
                      Duyệt và cộng tiền
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#faf8ff] px-4 py-4 text-sm text-[#6c7281]">
                    Bài nộp này đã được xử lý trước đó vào {formatDateTime(selectedSubmission.reviewedAt)}.
                  </div>
                )}

                <div className="rounded-[1.5rem] bg-white p-5 shadow-[0_24px_55px_-42px_rgba(123,25,216,0.12)]">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eefbf4] text-[#006945]">
                      <CheckCheck className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#2d2f32]">Giá trị chờ duyệt</p>
                      <p className="text-xs text-[#7b8190]">
                        Tổng thưởng đang treo: {formatCurrency(submissionSummary.pendingRewardTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
