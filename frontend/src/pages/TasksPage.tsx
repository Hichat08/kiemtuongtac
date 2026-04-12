import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import NotificationCenterDialog from "@/components/profile/NotificationCenterDialog";
import { useUserNotificationSummary } from "@/hooks/useUserNotificationSummary";
import ProfileDialog from "@/components/profile/ProfileDialog";
import { userService } from "@/services/userService";
import { Bell, CheckCircle2, ListTodo, Share2 } from "lucide-react";
import type { TaskCatalogItem } from "@/types/task";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type TaskCategory = "all" | "facebook" | "tiktok" | "youtube" | "other";

const taskCategories = [
  { id: "all", label: "Tất cả" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "other", label: "Khác" },
] as const satisfies ReadonlyArray<{ id: TaskCategory; label: string }>;

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)}đ`;

const getTaskPresentation = (platform: TaskCatalogItem["platform"]) => {
  switch (platform) {
    case "facebook":
      return {
        categoryLabel: "Facebook",
        iconClassName: "bg-[#eaf2ff] text-[#1b5fd5]",
        badgeClassName: "bg-[#eaf2ff] text-[#1b5fd5]",
      };
    case "tiktok":
      return {
        categoryLabel: "TikTok",
        iconClassName: "bg-[#fff0f5] text-[#d8589f]",
        badgeClassName: "bg-[#fff0f5] text-[#d8589f]",
      };
    case "youtube":
      return {
        categoryLabel: "YouTube",
        iconClassName: "bg-[#fff1f4] text-[#d4525d]",
        badgeClassName: "bg-[#fff1f4] text-[#d4525d]",
      };
    case "other":
      return {
        categoryLabel: "Khác",
        iconClassName: "bg-[#f3edff] text-[#7b19d8]",
        badgeClassName: "bg-[#f3edff] text-[#7b19d8]",
      };
  }
};

const getSubmissionMeta = (status?: TaskCatalogItem["submissionStatus"]) => {
  switch (status) {
    case "pending":
      return {
        label: "Chờ duyệt",
        badgeClassName: "bg-[#eefbf4] text-[#006945]",
        buttonClassName: "bg-[#ecfff4] text-[#006945]",
      };
    case "approved":
      return {
        label: "Đã duyệt",
        badgeClassName: "bg-[#f3edff] text-[#7b19d8]",
        buttonClassName: "bg-[#f3edff] text-[#7b19d8]",
      };
    case "rejected":
      return {
        label: "Bị từ chối",
        badgeClassName: "bg-[#fff0f1] text-[#b31b25]",
        buttonClassName: "bg-[#fff0f1] text-[#b31b25]",
      };
    default:
      return null;
  }
};

const TasksPage = () => {
  const navigate = useNavigate();
  const { unreadCount } = useUserNotificationSummary();
  const [activeCategory, setActiveCategory] = useState<TaskCategory>("all");
  const [tasks, setTasks] = useState<TaskCatalogItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const syncTasks = async () => {
      try {
        setLoadingTasks(true);
        const data = await userService.getTasks();
        setTasks(data.tasks);
      } catch (error) {
        console.error("Không tải được danh sách nhiệm vụ user", error);
        toast.error("Không tải được danh sách nhiệm vụ.");
      } finally {
        setLoadingTasks(false);
      }
    };

    void syncTasks();
  }, []);

  const filteredTasks =
    activeCategory === "all"
      ? tasks
      : tasks.filter((task) => task.platform === activeCategory);
  const approvedReward = useMemo(
    () =>
      tasks
        .filter((task) => task.submissionStatus === "approved")
        .reduce((total, task) => total + task.reward, 0),
    [tasks]
  );
  const pendingSubmissions = useMemo(
    () => tasks.filter((task) => task.submissionStatus === "pending").length,
    [tasks]
  );
  const approvedTasks = useMemo(
    () => tasks.filter((task) => task.submissionStatus === "approved").length,
    [tasks]
  );
  const rejectedTasks = useMemo(
    () => tasks.filter((task) => task.submissionStatus === "rejected").length,
    [tasks]
  );
  const progressWidth = `${tasks.length ? Math.min(100, Math.round((approvedTasks / tasks.length) * 100)) : 0}%`;

  const handleOpenTask = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  return (
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
        <div className="pointer-events-none absolute right-[-5rem] top-28 h-52 w-52 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />

        <header className="sticky top-0 z-30">
          <div className="mobile-page-shell flex items-center justify-between pt-5 pb-3 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white text-[#7b19d8] shadow-[0_18px_35px_-24px_rgba(123,25,216,0.55)] dark:bg-white/10 dark:text-[#ff8fd6]">
                <ListTodo className="size-4.5" />
              </div>
              <div>
                <p className="font-auth-headline text-lg font-extrabold tracking-tight text-[#2d1459] dark:text-white">
                  Danh sách nhiệm vụ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNotificationCenterOpen(true)}
              className="relative flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] backdrop-blur-xl transition-transform duration-200 active:scale-95 dark:bg-white/10 dark:text-slate-100"
              aria-label="Mở thông báo"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <>
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff4a90] ring-2 ring-[#f8f5ff] dark:ring-[#12081d]" />
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[#ff4a90] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </>
              ) : null}
            </button>
          </div>
        </header>

        <main className="mobile-page-shell pb-32 pt-3 sm:pb-36 sm:pt-4">
          <section className="mb-7 sm:mb-10">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#7b19d8] dark:text-[#ff84d1]">
              Social Tasks Hub
            </p>
            <h1 className="mobile-fluid-hero max-w-[24rem] font-auth-headline font-extrabold tracking-[-0.05em] text-slate-900 dark:text-white">
              Kiếm thêm thu nhập từ các tác vụ mạng xã hội.
            </h1>
          </section>

          <nav className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 sm:mb-6 sm:pb-2">
            {taskCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200 sm:px-5 sm:py-2.5 sm:text-sm ${
                  activeCategory === category.id
                    ? "bg-gradient-primary text-white shadow-[0_16px_30px_-20px_rgba(123,25,216,0.6)]"
                    : "bg-[#f1edf8] text-[#7c7390] hover:bg-[#e8e1f6] dark:bg-white/8 dark:text-[#d5c5ec]"
                }`}
              >
                {category.label}
              </button>
            ))}
          </nav>

          <div className="space-y-4 sm:space-y-5">
            {loadingTasks ? (
              <div className="rounded-[1.5rem] bg-white/88 px-5 py-10 text-center text-sm font-medium text-[#7f7692] shadow-[0_24px_60px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl dark:bg-white/8 dark:text-[#cbb9e7] sm:rounded-[1.75rem]">
                Đang tải danh sách nhiệm vụ...
              </div>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                const Icon = Share2;
                const presentation = getTaskPresentation(task.platform);
                const submissionMeta = getSubmissionMeta(task.submissionStatus);
                const taskStillAcceptingSubmissions =
                  task.status === "running" && task.availableSlots > 0;
                const actionLabel =
                  task.submissionStatus === "pending"
                    ? "Chờ duyệt"
                    : task.submissionStatus === "approved"
                    ? "Xem kết quả"
                    : task.submissionStatus === "rejected" && taskStillAcceptingSubmissions
                    ? "Nộp lại"
                    : task.submissionStatus === "rejected"
                    ? "Xem chi tiết"
                    : task.actionLabel;

                return (
                  <div
                    key={task.id}
                    className="relative overflow-hidden rounded-[1.5rem] bg-white/88 p-4 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl dark:bg-white/8 sm:rounded-[1.75rem] sm:p-5"
                  >
                    {task.hot ? (
                      <div className="absolute right-0 top-0 rounded-bl-2xl bg-[#ffe8f0] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d63252] dark:bg-[#ff4a90]/18 dark:text-[#ff9cc5] sm:px-3 sm:py-2">
                        Hot Task
                      </div>
                    ) : null}

                    <div className="flex items-start gap-3 sm:gap-4">
                      <div
                        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${presentation.iconClassName} sm:size-15 sm:rounded-2xl`}
                      >
                        <Icon className="size-6 sm:size-7" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="font-auth-headline text-[1.2rem] font-bold leading-tight text-slate-900 dark:text-white sm:text-[1.4rem]">
                          {task.title}
                        </h2>
                        <p className="mt-2 text-[13px] leading-5 text-[#7f7692] dark:text-[#cbb9e7] sm:text-sm sm:leading-6">
                          {task.description}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3 sm:gap-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${presentation.badgeClassName}`}
                          >
                            {presentation.categoryLabel}
                          </span>
                          {submissionMeta ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${submissionMeta.badgeClassName}`}
                            >
                              {submissionMeta.label}
                            </span>
                          ) : null}
                          <span className="text-xs font-medium text-[#8d84a1] dark:text-[#bdaaD6]">
                            Còn {task.availableSlots} slot
                          </span>
                        </div>
                        {task.submissionStatus === "rejected" && task.latestReviewNote ? (
                          <p className="mt-2 text-xs font-medium text-[#b31b25]">
                            Lý do từ chối: {task.latestReviewNote}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3 sm:mt-5 sm:gap-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#9b92ac]">
                          Tiền thưởng
                        </p>
                        <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#00c88b] sm:text-3xl">
                          {formatCurrency(task.reward)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenTask(task.id)}
                        className={`rounded-full px-5 py-2.5 text-[13px] font-bold transition-all duration-200 active:scale-95 sm:px-6 sm:py-3 sm:text-sm ${
                          submissionMeta
                            ? submissionMeta.buttonClassName
                            : "bg-gradient-primary text-white shadow-[0_16px_30px_-20px_rgba(123,25,216,0.6)] hover:opacity-92"
                        }`}
                      >
                        {actionLabel}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] bg-white/88 px-5 py-10 text-center text-sm font-medium text-[#7f7692] shadow-[0_24px_60px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl dark:bg-white/8 dark:text-[#cbb9e7] sm:rounded-[1.75rem]">
                Chưa có nhiệm vụ khả dụng.
              </div>
            )}
          </div>

          <section className="mt-8 grid gap-4 sm:mt-12 sm:gap-5">
            <div className="relative overflow-hidden rounded-[1.7rem] bg-gradient-primary p-5 text-white shadow-[0_30px_80px_-35px_rgba(123,25,216,0.62)] sm:rounded-[2rem] sm:p-6">
              <div className="absolute right-[-1rem] top-[-1rem] h-28 w-28 rounded-full bg-white/12 blur-3xl" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">
                Thu nhập đã duyệt
              </p>
              <p className="mt-3 font-auth-headline text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">
                {formatCurrency(approvedReward)}
              </p>
            </div>

            <div className="rounded-[1.7rem] bg-[#f2effa] p-5 dark:bg-white/8 sm:rounded-[2rem] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#9b92ac]">
                    Bằng chứng chờ duyệt
                  </p>
                  <p className="mt-2 font-auth-headline text-4xl font-extrabold tracking-[-0.06em] text-slate-900 dark:text-white sm:text-5xl">
                    {pendingSubmissions}
                  </p>
                  <p className="mt-3 text-sm font-medium text-[#7f7692] dark:text-[#cbb9e7]">
                    Đã duyệt {approvedTasks} nhiệm vụ, từ chối {rejectedTasks}.
                  </p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-full bg-white text-[#7b19d8] shadow-[0_12px_30px_-24px_rgba(123,25,216,0.4)] dark:bg-white/10 dark:text-[#ff84d1] sm:size-12">
                  <CheckCircle2 className="size-4 sm:size-5" />
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-[#ddd6eb] dark:bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-primary"
                  style={{ width: progressWidth }}
                />
              </div>
            </div>
          </section>
        </main>

        <AppMobileNav />
      </div>

      {notificationCenterOpen ? (
        <NotificationCenterDialog
          open={notificationCenterOpen}
          setOpen={setNotificationCenterOpen}
        />
      ) : null}

      <ProfileDialog
        open={profileOpen}
        setOpen={setProfileOpen}
      />
    </>
  );
};

export default TasksPage;
