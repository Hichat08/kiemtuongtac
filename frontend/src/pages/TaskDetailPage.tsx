import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { TaskCatalogItem, TaskSubmissionRow } from "@/types/task";
import axios from "axios";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  ExternalLink,
  ImagePlus,
  Info,
  Loader2,
  MoreVertical,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Navigate, Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const formatCurrency = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

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

const TASK_URL_REGEX = /https?:\/\/[^\s)]+/gi;

type TaskStep = {
  title: string;
  description: string;
  linkHref?: string;
  linkLabel?: string;
};

const extractUrls = (value?: string | null) => {
  const normalizedValue = `${value ?? ""}`.trim();

  if (!normalizedValue) {
    return [] as string[];
  }

  return Array.from(new Set(normalizedValue.match(TASK_URL_REGEX) ?? []));
};

const removeUrlsFromText = (value?: string | null) =>
  `${value ?? ""}`
    .replace(TASK_URL_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const extractTaskLinks = (task: TaskCatalogItem | null) => {
  if (!task) {
    return [] as string[];
  }

  return Array.from(
    new Set([
      ...extractUrls(task.brand),
      ...extractUrls(task.description),
      ...extractUrls(task.title),
    ])
  );
};

const getPlatformMeta = (platform: TaskCatalogItem["platform"]) => {
  switch (platform) {
    case "facebook":
      return {
        label: "Facebook Mission",
        brandLabel: "Facebook Platform",
        toneClassName: "bg-[#eaf2ff] text-[#1b5fd5]",
        iconWrapClassName: "bg-white text-[#1877f2]",
      };
    case "tiktok":
      return {
        label: "TikTok Mission",
        brandLabel: "TikTok Platform",
        toneClassName: "bg-[#fff0f5] text-[#d8589f]",
        iconWrapClassName: "bg-white text-[#111111]",
      };
    case "youtube":
      return {
        label: "YouTube Mission",
        brandLabel: "YouTube Platform",
        toneClassName: "bg-[#fff1f4] text-[#d4525d]",
        iconWrapClassName: "bg-white text-[#ff3b30]",
      };
    case "other":
      return {
        label: "Campaign Mission",
        brandLabel: "Social Platform",
        toneClassName: "bg-[#f3edff] text-[#7b19d8]",
        iconWrapClassName: "bg-white text-[#7b19d8]",
      };
  }
};

const getTaskStatusLabel = (task: TaskCatalogItem | null) => {
  if (!task) {
    return "Đang tải";
  }

  if (task.status === "running") {
    return "Đang diễn ra";
  }

  if (task.status === "pending") {
    return "Chờ mở";
  }

  if (task.status === "paused") {
    return "Tạm dừng";
  }

  return "Đã kết thúc";
};

const getSubmissionMeta = (submission: TaskSubmissionRow | null) => {
  if (!submission) {
    return {
      title: "Chưa gửi bằng chứng",
      description: "Hoàn thành nhiệm vụ rồi gửi link hoặc ảnh chụp màn hình để admin xét duyệt.",
      toneClassName: "bg-[#f0f0f5] text-[#5a5b5f]",
      icon: Info,
    };
  }

  if (submission.status === "pending") {
    return {
      title: "Đang chờ duyệt",
      description: "Bằng chứng đã được gửi. Tiền chỉ được cộng vào ví sau khi admin duyệt.",
      toneClassName: "bg-[#f3edff] text-[#7b19d8]",
      icon: Clock3,
    };
  }

  if (submission.status === "approved") {
    return {
      title: "Đã duyệt và cộng tiền",
      description: "Phần thưởng nhiệm vụ đã được cộng vào ví người dùng.",
      toneClassName: "bg-[#f3edff] text-[#7b19d8]",
      icon: BadgeCheck,
    };
  }

  return {
    title: "Bài nộp bị từ chối",
    description: submission.reviewNote || "Bạn có thể cập nhật lại bằng chứng rõ hơn rồi gửi lại.",
    toneClassName: "bg-[#fff0f1] text-[#b31b25]",
    icon: XCircle,
  };
};

const buildTaskSteps = (task: TaskCatalogItem | null): TaskStep[] => {
  if (!task) {
    return [];
  }

  const primaryStepByPlatform = {
    facebook: "Thực hiện tương tác trên Facebook",
    tiktok: "Thực hiện tương tác trên TikTok",
    youtube: "Thực hiện tương tác trên YouTube",
    other: "Thực hiện theo đúng yêu cầu nhiệm vụ",
  } as const;

  const secondaryStepByPlatform = {
    facebook: "Giữ bài đăng hoặc chia sẻ ở trạng thái công khai để admin dễ đối soát.",
    tiktok: "Đảm bảo nội dung tương tác vẫn còn hiển thị khi bạn gửi bằng chứng.",
    youtube: "Không xoá lượt tương tác hoặc bình luận trước khi admin kiểm tra.",
    other: "Giữ nguyên trạng thái kết quả sau khi hoàn thành cho tới lúc được duyệt.",
  } as const;

  const descriptionLinks = extractUrls(task.description);
  const primaryTaskLink =
    extractUrls(task.brand)[0] ?? descriptionLinks[0] ?? extractUrls(task.title)[0] ?? "";
  const sanitizedDescription =
    removeUrlsFromText(task.description) || "Xem lại đầy đủ mô tả từ admin trước khi bắt đầu thao tác.";
  const sanitizedBrand = removeUrlsFromText(task.brand);
  const executionDescription = sanitizedBrand
    ? `Làm đúng nội dung của nhiệm vụ "${task.title}" cho thương hiệu ${sanitizedBrand}.`
    : `Làm đúng nội dung của nhiệm vụ "${task.title}" theo đúng liên kết và yêu cầu admin cung cấp.`;

  return [
    {
      title: "Đọc kỹ mô tả nhiệm vụ",
      description: sanitizedDescription,
      linkHref: descriptionLinks[0] || undefined,
      linkLabel: descriptionLinks[0] ? "Mở link trong mô tả" : undefined,
    },
    {
      title: primaryStepByPlatform[task.platform],
      description: executionDescription,
      linkHref: primaryTaskLink || undefined,
      linkLabel: primaryTaskLink ? "Mở link làm nhiệm vụ" : undefined,
    },
    {
      title: "Giữ kết quả để đối soát",
      description: secondaryStepByPlatform[task.platform],
    },
    {
      title: "Gửi bằng chứng hoàn thành",
      description:
        "Chụp màn hình rõ ràng, đính kèm link liên quan nếu có và chờ admin duyệt trước khi cộng tiền.",
    },
  ];
};

export default function TaskDetailPage() {
  const navigate = useNavigate();
  const { taskId = "" } = useParams();
  const { user } = useAuthStore();
  const [task, setTask] = useState<TaskCatalogItem | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<TaskSubmissionRow | null>(null);
  const [proofLink, setProofLink] = useState("");
  const [note, setNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [relatedAvailableCount, setRelatedAvailableCount] = useState(0);

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl(null);
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  useEffect(() => {
    let active = true;

    const syncTaskDetail = async () => {
      try {
        setLoading(true);
        const res = await userService.getTaskDetail(taskId);

        if (!active) {
          return;
        }

        setTask(res.task);
        setLatestSubmission(res.latestSubmission);
        setProofLink(res.latestSubmission?.proofLink ?? "");
        setNote(res.latestSubmission?.note ?? "");
        setSelectedFile(null);
        setRelatedAvailableCount(res.relatedAvailableCount);
      } catch (error) {
        console.error("Không tải được chi tiết nhiệm vụ", error);

        if (!active) {
          return;
        }

        toast.error(getErrorMessage(error, "Không tải được chi tiết nhiệm vụ."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (taskId) {
      void syncTaskDetail();
    }

    return () => {
      active = false;
    };
  }, [taskId]);

  const submissionMeta = useMemo(
    () => getSubmissionMeta(latestSubmission),
    [latestSubmission]
  );
  const SubmissionIcon = submissionMeta.icon;
  const platformMeta = useMemo(() => getPlatformMeta(task?.platform ?? "other"), [task?.platform]);
  const taskSteps = useMemo(() => buildTaskSteps(task), [task]);
  const taskLinks = useMemo(() => extractTaskLinks(task), [task]);
  const primaryTaskLink = taskLinks[0] ?? "";
  const screenshotPreviewUrl = localPreviewUrl ?? latestSubmission?.screenshotUrl ?? "";
  const submissionLocked =
    latestSubmission?.status === "pending" || latestSubmission?.status === "approved";
  const taskStillAcceptingSubmissions =
    task?.status === "running" && Number(task?.availableSlots ?? 0) > 0;
  const canSubmit = Boolean(task) && taskStillAcceptingSubmissions && !submissionLocked;
  const submitButtonLabel = submitting
    ? "Đang gửi bằng chứng..."
    : latestSubmission?.status === "pending"
    ? "Đang chờ admin duyệt"
    : latestSubmission?.status === "approved"
    ? "Đã duyệt và cộng tiền"
    : "Gửi bằng chứng hoàn thành";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!task) {
      return;
    }

    if (!canSubmit) {
      toast.info("Nhiệm vụ này hiện không nhận thêm bài nộp mới.");
      return;
    }

    if (!proofLink.trim() && !selectedFile) {
      toast.error("Vui lòng thêm link bằng chứng hoặc ảnh chụp màn hình.");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("proofLink", proofLink.trim());
      formData.append("note", note.trim());

      if (selectedFile) {
        formData.append("screenshot", selectedFile);
      }

      const res = await userService.submitTaskSubmission(task.id, formData);

      setTask(res.task);
      setLatestSubmission(res.submission);
      setProofLink(res.submission.proofLink ?? "");
      setNote(res.submission.note ?? "");
      setSelectedFile(null);
      toast.success(res.message || "Đã gửi bằng chứng và chuyển sang trạng thái chờ duyệt.");
    } catch (error) {
      console.error("Không gửi được bằng chứng nhiệm vụ", error);
      toast.error(getErrorMessage(error, "Không gửi được bằng chứng nhiệm vụ."));
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.role === "admin") {
    return <Navigate to="/admin/tasks" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-[#2d2f32]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)]" />
      <div className="pointer-events-none absolute right-[-6rem] top-20 size-64 rounded-full bg-[#ffd3f2]/38 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-[-4rem] size-52 rounded-full bg-[#c7cfff]/28 blur-3xl" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/84 backdrop-blur-2xl">
        <div className="mobile-page-shell flex items-center gap-3 pb-3 pt-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white text-[#7b19d8] shadow-[0_18px_40px_-28px_rgba(123,25,216,0.3)] transition-transform active:scale-95"
            aria-label="Quay lại"
          >
            <ArrowLeft className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9b79cb]">
              Task Details
            </p>
            <p className="truncate font-auth-headline text-lg font-extrabold tracking-[-0.04em] text-[#2d1459]">
              Chi tiết nhiệm vụ
            </p>
          </div>

          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full bg-white/82 text-[#7b19d8] shadow-[0_16px_36px_-28px_rgba(123,25,216,0.24)]"
            aria-label="Tùy chọn"
          >
            <MoreVertical className="size-5" />
          </button>
        </div>
      </header>

      <main className="mobile-page-shell pb-32 pt-5">
        <section>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${platformMeta.toneClassName}`}
          >
            {platformMeta.label}
          </span>
          <h1 className="mobile-fluid-hero mt-4 font-auth-headline font-extrabold tracking-[-0.06em] text-[#2d2f32]">
            {loading ? "Đang tải nhiệm vụ..." : task?.title ?? "Không tìm thấy nhiệm vụ"}
          </h1>
          <p className="mt-4 text-sm font-medium text-[#7b8190]">Thưởng nhiệm vụ</p>
          <p className="mobile-fluid-title mt-1 font-auth-headline font-extrabold tracking-[-0.05em] text-[#7b19d8]">
            {task ? formatCurrency(task.reward) : "--"}
          </p>
        </section>

        <section className="mt-8 flex items-center justify-between gap-3 rounded-[1.1rem] bg-white px-4 py-3 shadow-[0_18px_45px_-38px_rgba(123,25,216,0.16)]">
          <p className="text-sm font-semibold text-[#7b19d8]">Trạng thái</p>
          <p className="text-sm font-bold text-[#2d2f32]">{getTaskStatusLabel(task)}</p>
        </section>

        <section className="mt-4 rounded-[1.7rem] bg-[#f5f1fb] p-4 shadow-[0_26px_55px_-42px_rgba(123,25,216,0.18)]">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-12 items-center justify-center rounded-[1.1rem] ${platformMeta.iconWrapClassName}`}
            >
              <Share2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#2d2f32]">{platformMeta.brandLabel}</p>
              <p className="truncate text-xs text-[#5a5b5f]">
                {task?.brand ?? "Social Engagement Task"}
              </p>
            </div>
          </div>

          {primaryTaskLink ? (
            <a
              href={primaryTaskLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-4 font-auth-headline text-base font-bold text-white shadow-[0_24px_55px_-30px_rgba(123,25,216,0.38)] transition-transform active:scale-[0.99]"
            >
              <span>Mở link làm nhiệm vụ</span>
              <ExternalLink className="size-5" />
            </a>
          ) : null}
        </section>

        <section className="mt-8">
          <h2 className="border-l-4 border-[#7b19d8] pl-3 font-auth-headline text-xl font-bold text-[#2d2f32]">
            Hướng dẫn thực hiện
          </h2>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="rounded-[1.5rem] bg-white px-5 py-8 text-center text-sm font-medium text-[#5a5b5f] shadow-[0_24px_55px_-40px_rgba(123,25,216,0.18)]">
                Đang tải các bước thực hiện...
              </div>
            ) : (
              taskSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-[1.4rem] bg-white p-5 shadow-[0_18px_45px_-38px_rgba(123,25,216,0.16)]"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f3edff] font-auth-headline text-sm font-bold text-[#7b19d8]">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#2d2f32]">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5a5b5f]">{step.description}</p>
                    {step.linkHref ? (
                      <a
                        href={step.linkHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#7b19d8] hover:underline"
                      >
                        {step.linkLabel ?? "Mở liên kết"}
                        <ExternalLink className="size-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[1.8rem] bg-white p-5 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.22)]">
          <div className={`rounded-[1.25rem] px-4 py-3 ${submissionMeta.toneClassName}`}>
            <div className="flex items-start gap-3">
              <SubmissionIcon className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-sm font-bold">{submissionMeta.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-90">{submissionMeta.description}</p>
                {latestSubmission?.submittedAt ? (
                  <p className="mt-2 text-xs font-semibold opacity-80">
                    Gửi lúc: {formatDateTime(latestSubmission.submittedAt)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#5a5b5f]">
                Link bằng chứng hoặc bài viết
              </label>
              <input
                type="text"
                value={proofLink}
                onChange={(event) => setProofLink(event.target.value)}
                disabled={!canSubmit || submitting}
                placeholder="https://facebook.com/posts/..."
                className="h-12 w-full rounded-[1rem] border-none bg-[#f3edff] px-4 text-sm text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#5a5b5f]">
                Ghi chú thêm
              </label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={!canSubmit || submitting}
                placeholder="Mô tả ngắn cách bạn đã hoàn thành nhiệm vụ..."
                className="min-h-24 w-full rounded-[1rem] border-none bg-[#f3edff] px-4 py-3 text-sm text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:ring-[#7b19d8]/20 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#5a5b5f]">
                Ảnh chụp màn hình
              </label>
              <label className={`group block overflow-hidden rounded-[1.35rem] ${canSubmit ? "cursor-pointer" : "cursor-not-allowed"}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={!canSubmit || submitting}
                  className="hidden"
                />

                {screenshotPreviewUrl ? (
                  <div className="relative overflow-hidden rounded-[1.35rem] bg-[#f3edff]">
                    <img
                      src={screenshotPreviewUrl}
                      alt="Bằng chứng nhiệm vụ"
                      className="h-52 w-full object-cover"
                    />
                    {canSubmit ? (
                      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(12,14,17,0.68))] px-4 py-3 text-sm font-semibold text-white">
                        Chạm để thay ảnh khác
                      </div>
                    ) : null}
                  </div>
                    ) : (
                  <div className="rounded-[1.35rem] border-2 border-dashed border-[#d9cbed] bg-[#f3edff] px-5 py-10 text-center transition-colors group-hover:border-[#7b19d8]/40 group-hover:bg-white">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-white text-[#7b19d8] shadow-[0_16px_40px_-30px_rgba(123,25,216,0.26)]">
                      <ImagePlus className="size-6" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-[#2d2f32]">
                      Tải ảnh lên hoặc chạm để chọn
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#5a5b5f]">
                      JPG, PNG toi da 5MB
                    </p>
                  </div>
                )}
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || submitting}
              className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 font-auth-headline text-base font-bold text-white transition-transform active:scale-[0.99] ${
                !canSubmit || submitting
                  ? "cursor-not-allowed bg-[#bfaed7]"
                  : "bg-gradient-primary shadow-[0_24px_55px_-30px_rgba(123,25,216,0.38)]"
              }`}
            >
              {submitting ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
              <span>{submitButtonLabel}</span>
            </button>
          </div>

          <div className="mt-6 rounded-[1.25rem] bg-[#faf7ff] px-4 py-3">
            <div className="flex items-start gap-3 text-[#5a5b5f]">
              <Info className="mt-0.5 size-4 shrink-0 text-[#7b19d8]" />
              <p className="text-xs leading-6">
                Thời gian xét duyệt trung bình khoảng <span className="font-bold text-[#2d2f32]">24 giờ</span>.
                Hệ thống chỉ cộng {task ? formatCurrency(task.reward) : "phần thưởng"} sau khi admin duyệt bài nộp hợp lệ.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[1.8rem] bg-gradient-primary text-white shadow-[0_30px_70px_-36px_rgba(123,25,216,0.56)]">
          <div className="relative px-5 py-6">
            <div className="pointer-events-none absolute -right-4 -top-4 size-24 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="size-4" />
                Kiếm thêm thu nhập?
              </div>
              <p className="mt-3 max-w-[16rem] text-sm leading-6 text-white/82">
                Còn {relatedAvailableCount} nhiệm vụ khác đang chờ bạn thực hiện và gửi duyệt.
              </p>
              <Link
                to="/tasks"
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white underline underline-offset-4"
              >
                Xem tất cả
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {!loading && task && task.status !== "running" && !latestSubmission ? (
          <section className="mt-6 rounded-[1.5rem] bg-[#fff0f1] px-5 py-4 text-sm text-[#b31b25] shadow-[0_18px_42px_-34px_rgba(179,27,37,0.26)]">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <p>
                Nhiệm vụ này hiện không còn nhận thêm bài nộp mới. Hãy quay lại danh sách để chọn nhiệm vụ khác.
              </p>
            </div>
          </section>
        ) : null}
      </main>

      <AppMobileNav />
    </div>
  );
}
