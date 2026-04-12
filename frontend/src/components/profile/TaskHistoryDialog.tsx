import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { TaskSubmissionRow, UserTaskHistoryResponse } from "@/types/task";
import {
  ArrowLeft,
  BadgeCheck,
  Facebook,
  ListTodo,
  Loader2,
  MessageSquareText,
  PlayCircle,
  Users,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface TaskHistoryDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const EMPTY_SUMMARY: UserTaskHistoryResponse["summary"] = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  totalEarned: 0,
};

const historyFilters = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Đang duyệt" },
  { id: "approved", label: "Thành công" },
  { id: "rejected", label: "Thất bại" },
] as const;

const statusMeta: Record<
  TaskSubmissionRow["status"],
  {
    label: string;
    badgeClassName: string;
    amountClassName: string;
  }
> = {
  approved: {
    label: "Thành công",
    badgeClassName: "bg-[#006945]/10 text-[#006945]",
    amountClassName: "text-[#006945]",
  },
  pending: {
    label: "Đang duyệt",
    badgeClassName: "bg-amber-500/10 text-amber-600",
    amountClassName: "text-[#7a7d84]",
  },
  rejected: {
    label: "Thất bại",
    badgeClassName: "bg-[#b31b25]/10 text-[#b31b25]",
    amountClassName: "text-[#fb5151]",
  },
};

const platformMeta: Record<
  TaskSubmissionRow["platform"],
  {
    icon: typeof Facebook;
    iconWrapClassName: string;
    iconClassName: string;
  }
> = {
  facebook: {
    icon: Facebook,
    iconWrapClassName: "bg-[#1877F2]/10",
    iconClassName: "text-[#1877F2]",
  },
  tiktok: {
    icon: MessageSquareText,
    iconWrapClassName: "bg-black/5",
    iconClassName: "text-[#2d2f32]",
  },
  youtube: {
    icon: PlayCircle,
    iconWrapClassName: "bg-[#FF0000]/10",
    iconClassName: "text-[#FF0000]",
  },
  other: {
    icon: Users,
    iconWrapClassName: "bg-[#f3edff]",
    iconClassName: "text-[#7b19d8]",
  },
};

const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const formatHistoryTime = (submission: TaskSubmissionRow) => {
  const primaryDate =
    submission.status === "approved"
      ? submission.approvedAt ?? submission.reviewedAt ?? submission.submittedAt
      : submission.status === "rejected"
        ? submission.rejectedAt ?? submission.reviewedAt ?? submission.submittedAt
        : submission.submittedAt;

  if (!primaryDate) {
    return "Chưa có thời gian cập nhật";
  }

  const parsedDate = new Date(primaryDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Chưa có thời gian cập nhật";
  }

  const labelPrefix =
    submission.status === "approved"
      ? "Duyệt"
      : submission.status === "rejected"
        ? "Từ chối"
        : "Nộp";

  return `${labelPrefix}: ${new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate)}`;
};

const TaskHistoryDialog = ({ open, setOpen }: TaskHistoryDialogProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<(typeof historyFilters)[number]["id"]>("all");
  const [historySummary, setHistorySummary] =
    useState<UserTaskHistoryResponse["summary"]>(EMPTY_SUMMARY);
  const [historyItems, setHistoryItems] = useState<TaskSubmissionRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open || user?.role !== "admin") {
      return;
    }

    setOpen(false);
    navigate("/admin");
  }, [navigate, open, setOpen, user?.role]);

  useEffect(() => {
    if (!open || user?.role === "admin") {
      return;
    }

    let cancelled = false;

    const syncTaskHistory = async () => {
      try {
        setLoadingHistory(true);
        const data = await userService.getTaskHistory();

        if (cancelled) {
          return;
        }

        setHistorySummary(data.summary);
        setHistoryItems(data.submissions);
      } catch (error) {
        if (!cancelled) {
          console.error("Không tải được lịch sử nhiệm vụ user", error);
          toast.error("Không tải được lịch sử nhiệm vụ.");
          setHistorySummary(EMPTY_SUMMARY);
          setHistoryItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    };

    void syncTaskHistory();

    return () => {
      cancelled = true;
    };
  }, [open, user?.role]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") {
      return historyItems;
    }

    return historyItems.filter((item) => item.status === activeFilter);
  }, [activeFilter, historyItems]);

  if (user?.role === "admin") {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[#f6f6fa] p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Lịch sử nhiệm vụ</DialogTitle>

        <div className="min-h-dvh bg-[#f6f6fa] font-auth-body text-[#2d2f32]">
          <header className="sticky top-0 z-20 bg-[#f6f6fa]/92 backdrop-blur-xl">
            <div className="mobile-page-shell flex items-center pb-3 pt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mr-3 flex size-9 items-center justify-center rounded-full text-[#7b19d8] transition-colors hover:bg-[#f3edff] active:scale-95"
                aria-label="Quay lại"
              >
                <ArrowLeft className="size-5" />
              </button>
              <h1 className="font-auth-headline text-xl font-bold tracking-tight text-[#2d2f32]">
                Lịch sử nhiệm vụ
              </h1>
            </div>
          </header>

          <main className="mobile-page-shell pb-12 pt-5">
            <section className="grid grid-cols-1 gap-4">
              <div className="relative overflow-hidden rounded-[1.15rem] bg-white px-5 py-6 shadow-[0_18px_44px_-34px_rgba(123,25,216,0.18)]">
                <div className="relative z-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b8e94]">
                    Nhiệm vụ đã được duyệt
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-auth-headline text-[2.2rem] font-extrabold tracking-[-0.05em] text-[#7b19d8]">
                      {formatCurrency(historySummary.approved)}
                    </span>
                    <span className="text-sm font-medium text-[#6b6d71]">nhiệm vụ</span>
                  </div>
                </div>

                <div className="pointer-events-none absolute -bottom-5 -right-4 opacity-[0.08]">
                  <BadgeCheck className="size-24 text-[#7b19d8]" />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.15rem] bg-gradient-primary px-5 py-6 shadow-[0_22px_52px_-30px_rgba(123,25,216,0.34)]">
                <div className="relative z-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/76">
                    Tổng tiền đã kiếm được
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-auth-headline text-[2.2rem] font-extrabold tracking-[-0.05em] text-white">
                      {formatCurrency(historySummary.totalEarned)}
                    </span>
                    <span className="text-sm font-bold text-white/80">VND</span>
                  </div>
                </div>

                <div className="pointer-events-none absolute -bottom-4 -right-3 opacity-[0.14]">
                  <BadgeCheck className="size-24 text-white" />
                </div>
              </div>
            </section>

            <section className="mt-6 flex gap-2 overflow-x-auto pb-1">
              {historyFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                    activeFilter === filter.id
                      ? "bg-gradient-primary font-semibold text-white shadow-[0_14px_28px_-18px_rgba(123,25,216,0.42)]"
                      : "bg-[#e1e2e8] font-medium text-[#6b6d71] hover:bg-[#d7d9de]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </section>

            <section className="mt-7">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="font-auth-headline text-lg font-bold text-[#5a5b5f]">
                  Danh sách gần đây
                </h2>
                <span className="text-xs font-medium text-[#7c7e84]">
                  {formatCurrency(historySummary.total)} lượt nộp
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {loadingHistory ? (
                  <div className="flex items-center justify-center gap-3 rounded-[1rem] bg-white px-4 py-6 text-sm font-medium text-[#7c7e84] shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)]">
                    <Loader2 className="size-4 animate-spin text-[#7b19d8]" />
                    Đang tải lịch sử nhiệm vụ...
                  </div>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const platform = platformMeta[item.platform];
                    const status = statusMeta[item.status];
                    const Icon = platform.icon;

                    return (
                      <div
                        key={item.id}
                        className="rounded-[1rem] bg-white px-4 py-4 shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)]"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex size-12 shrink-0 items-center justify-center rounded-[0.95rem] ${platform.iconWrapClassName}`}
                          >
                            <Icon className={`size-6 ${platform.iconClassName}`} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-auth-headline text-[1.02rem] font-bold tracking-[-0.03em] text-[#2d2f32]">
                              {item.taskTitle}
                            </h3>
                            <p className="mt-1 text-[11px] font-medium text-[#7c7e84]">
                              {item.taskBrand} • {formatHistoryTime(item)}
                            </p>
                            {item.reviewNote ? (
                              <p className="mt-2 line-clamp-2 text-[12px] text-[#6c6f75]">
                                {item.reviewNote}
                              </p>
                            ) : null}
                          </div>

                          <div className="shrink-0 text-right">
                            <p
                              className={`font-auth-headline text-lg font-extrabold tracking-[-0.03em] ${
                                item.status === "rejected"
                                  ? "text-[#fb5151]/65 line-through"
                                  : status.amountClassName
                              }`}
                            >
                              +{formatCurrency(item.reward)}đ
                            </p>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${status.badgeClassName}`}
                            >
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1rem] bg-white px-5 py-8 text-center shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)]">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                      <ListTodo className="size-7" />
                    </div>
                    <p className="mt-4 font-auth-headline text-lg font-bold text-[#2d2f32]">
                      {historyItems.length
                        ? "Không có mục nào khớp bộ lọc này"
                        : "Bạn chưa có lịch sử nhiệm vụ"}
                    </p>
                    <p className="mt-2 text-sm text-[#7c7e84]">
                      {historyItems.length
                        ? "Hãy thử chuyển sang bộ lọc khác để xem thêm lượt nộp nhiệm vụ."
                        : "Khi bạn nộp bằng chứng nhiệm vụ, lịch sử thật sẽ xuất hiện tại đây."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskHistoryDialog;
