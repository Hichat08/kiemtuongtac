import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import {
  buildWithdrawalTransferContent,
  formatWithdrawalRequestAccount,
  formatWithdrawalRequestedFull,
  formatWithdrawalRequestedShort,
  isInternalWithdrawal,
} from "@/lib/withdrawal-requests";
import { useWithdrawalRequest } from "@/hooks/useWithdrawalRequest";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock3,
  Copy,
  Home,
  ShieldCheck,
  Info,
  Landmark,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)}đ`;

const WITHDRAWAL_REJECTION_FALLBACK =
  "Tài khoản ngân hàng không trùng khớp hoặc vi phạm quy tắc hệ thống";

const getWithdrawalDisplayCode = (requestId: string) => {
  const normalizedValue = `${requestId ?? ""}`.trim().replace(/^#/, "").toUpperCase();

  if (!normalizedValue) {
    return "STX-00000000";
  }

  if (normalizedValue.startsWith("STX-")) {
    return normalizedValue;
  }

  return `STX-${normalizedValue.slice(-8).padStart(8, "0")}`;
};

const getStatusMeta = (status: "pending" | "approved" | "rejected", isInternal = false) => {
  switch (status) {
    case "approved":
      return {
        title: isInternal ? "Chuyển tiền nội bộ đã hoàn tất" : "Yêu cầu rút tiền đã được duyệt",
        description: isInternal
          ? "Khoản chuyển tiền nội bộ của bạn đã được hệ thống xử lý ngay và cộng tiền cho người nhận."
          : "Yêu cầu của bạn đã qua kiểm tra. Hệ thống sẽ tiến hành chuyển tiền trong ít phút tới.",
        accent: "text-[#00a46f]",
        accentBg: "bg-[#eefbf4]",
        borderGlow: "border-[#84f0be]",
        haloBg: "bg-[#b8f3da]",
        icon: CheckCircle2,
        eta: isInternal
          ? "Người nhận sẽ thấy biến động số dư trong lịch sử ví và trung tâm thông báo."
          : "Tiền đang được chuyển về tài khoản của bạn.",
      };
    case "rejected":
      return {
        title: isInternal ? "Chuyển tiền nội bộ bị từ chối" : "Yêu cầu rút tiền bị từ chối",
        description: isInternal
          ? "Không thể hoàn tất chuyển tiền nội bộ do thông tin người nhận hoặc trạng thái tài khoản không hợp lệ."
          : "Hệ thống phát hiện cần bổ sung hoặc đối soát lại hồ sơ nhận tiền trước khi chi trả.",
        accent: "text-[#d4525d]",
        accentBg: "bg-[#fff0f5]",
        borderGlow: "border-[#ffb8c6]",
        haloBg: "bg-[#ffd2da]",
        icon: XCircle,
        eta: isInternal
          ? "Vui lòng kiểm tra lại ID người nhận rồi tạo lệnh mới."
          : "Vui lòng kiểm tra lại thông tin ngân hàng và gửi yêu cầu mới.",
      };
    case "pending":
    default:
      return {
        title: isInternal ? "Chuyển tiền nội bộ đang xử lý" : "Yêu cầu rút tiền đang chờ duyệt",
        description: isInternal
          ? "Hệ thống đang hoàn tất lệnh chuyển tiền nội bộ của bạn."
          : "Chúng tôi đã nhận được yêu cầu của bạn và đang tiến hành kiểm tra. Quá trình này thường mất từ 15-30 phút.",
        accent: "text-[#7b19d8]",
        accentBg: "bg-[#f3edff]",
        borderGlow: "border-[#d9b7ff]",
        haloBg: "bg-[#ffd3f2]",
        icon: Clock3,
        eta: isInternal
          ? "Tiền sẽ được ghi nhận cho người nhận ngay sau khi lệnh hoàn tất."
          : "Tiền của bạn luôn được bảo mật và xử lý theo tiêu chuẩn an toàn quốc tế.",
      };
  }
};

export default function WithdrawalPendingPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { user } = useAuthStore();
  const { request, loading } = useWithdrawalRequest(requestId);

  if (user?.role === "admin") {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  if (loading) {
    return null;
  }

  if (!request) {
    return (
      <Navigate
        to="/wallet"
        replace
      />
    );
  }

  if (request.status === "approved") {
    return (
      <Navigate
        to={`/wallet/withdraw/success/${request.id}`}
        replace
      />
    );
  }

  if (request.status === "rejected") {
    const internalTransfer = isInternalWithdrawal(request);
    const transactionAmountLabel = internalTransfer ? "Số tiền chuyển" : "Số tiền rút";
    const rejectionReason =
      request.note?.trim() || WITHDRAWAL_REJECTION_FALLBACK;
    const requestedTime = formatWithdrawalRequestedFull(request).replace(", ", " - ");
    const displayCode = getWithdrawalDisplayCode(request.id);
    const rejectedDetails = [
      {
        label: internalTransfer ? "Hình thức" : "Ngân hàng",
        value: request.bankName,
        icon: Landmark,
        iconWrapClassName: "bg-[#f3edff] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]",
      },
      {
        label: "Mã giao dịch",
        value: displayCode,
        icon: Copy,
        iconWrapClassName: "bg-[#fff0f5] text-[#d4525d] dark:bg-[#5a2132] dark:text-[#ff9fb1]",
      },
      {
        label: "Thời gian",
        value: requestedTime,
        icon: Clock3,
        iconWrapClassName: "bg-[#eef1ff] text-[#5868ff] dark:bg-[#17233f] dark:text-[#a9b4ff]",
      },
    ] as const;

    return (
      <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-[#2d2f32] dark:bg-[#12081d] dark:text-slate-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
        <div className="pointer-events-none absolute right-[-5rem] top-16 size-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />
        <div className="pointer-events-none absolute left-[-4rem] top-72 size-44 rounded-full bg-[#ffd6e4]/70 blur-3xl dark:bg-[#6d2436]/20" />

        <header className="sticky top-0 z-30 bg-[#f8f5ff]/88 backdrop-blur-xl dark:bg-[#12081d]/88">
          <div className="mobile-page-shell flex items-center justify-between gap-3 pb-3 pt-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex size-10 items-center justify-center rounded-full bg-white/82 text-[#7b19d8] shadow-[0_16px_40px_-26px_rgba(123,25,216,0.38)] transition-transform active:scale-95 dark:bg-white/10 dark:text-[#ff84d1]"
                aria-label="Quay lại"
              >
                <ArrowLeft className="size-5" />
              </button>

              <p className="font-auth-headline text-[1.18rem] font-extrabold tracking-[-0.04em] text-[#2d1459] dark:text-white">
                Trạng thái giao dịch
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/chat/support")}
              className="flex size-9 items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_16px_34px_-24px_rgba(123,25,216,0.55)] transition-transform active:scale-95"
              aria-label="Liên hệ hỗ trợ"
            >
              <Info className="size-4.5" />
            </button>
          </div>
        </header>

        <main className="mobile-page-shell pb-32 pt-6">
          <section className="flex flex-col items-center text-center">
            <span className="inline-flex rounded-full bg-[#fff0f5] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4525d] dark:bg-[#5a2132] dark:text-[#ffb0bf]">
              {internalTransfer ? "Chuyển tiền nội bộ thất bại" : "Rút tiền thất bại"}
            </span>

            <div className="relative mt-6 flex size-32 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#ff66c7]/18 blur-[44px] dark:bg-[#ff66c7]/12" />
              <div className="relative flex size-28 items-center justify-center rounded-full bg-white/88 ring-1 ring-[#eadbfd] shadow-[0_28px_60px_-36px_rgba(123,25,216,0.34)] backdrop-blur-xl dark:bg-white/10 dark:ring-white/10">
                <div className="absolute inset-4 rounded-full bg-[linear-gradient(135deg,#fff5fb_0%,#ffedf3_100%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                <div className="relative flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff7b99_0%,#d4525d_100%)] text-white shadow-[0_20px_36px_-18px_rgba(212,82,93,0.65)]">
                  <X className="size-8 stroke-[3]" />
                </div>
              </div>
            </div>

            <h1 className="mt-8 max-w-xs font-auth-headline text-[2.1rem] font-extrabold leading-[1.08] tracking-[-0.05em] text-[#2f2441] dark:text-white">
              {internalTransfer ? "Chuyển tiền nội bộ bị từ chối" : "Yêu cầu rút tiền bị từ chối"}
            </h1>
            <p className="mt-3 max-w-[17rem] text-sm leading-7 text-[#7e7691] dark:text-[#c8b5e8]">
              {internalTransfer
                ? "Thông tin người nhận hoặc trạng thái tài khoản cần được kiểm tra lại trước khi chuyển."
                : "Hồ sơ nhận tiền của bạn cần được kiểm tra hoặc bổ sung trước khi chi trả."}
            </p>
          </section>

          <section className="mt-6 rounded-[1.45rem] bg-white/88 p-5 shadow-[0_20px_54px_-40px_rgba(123,25,216,0.26)] backdrop-blur-2xl dark:bg-white/8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4525d] dark:text-[#ff9fb1]">
              Lý do xử lý
            </p>
            <p className="mt-2 text-sm leading-7 text-[#6f6586] dark:text-[#d7c7ed]">
              {rejectionReason}
            </p>
          </section>

          <section className="mt-6 rounded-[1.85rem] bg-white/88 p-5 shadow-[0_28px_70px_-42px_rgba(123,25,216,0.3)] backdrop-blur-2xl dark:bg-white/8">
            <div className="flex items-end justify-between gap-4 border-b border-[#efe6f7] pb-4 dark:border-white/10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9aa0a6] dark:text-[#b7c7c0]">
                  {transactionAmountLabel}
                </p>
                <p className="mt-1 font-auth-headline text-[2rem] font-extrabold text-[#2f2441] dark:text-white">
                  {formatCurrency(request.amount)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9aa0a6] dark:text-[#b7c7c0]">
                  Trạng thái
                </p>
                <span className="mt-1 inline-flex rounded-full bg-[#ffe3e7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#cc3146] dark:bg-[#5c202a] dark:text-[#ff9dad]">
                  Thất bại
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {rejectedDetails.map((detail) => {
                const Icon = detail.icon;

                return (
                  <div
                    key={detail.label}
                    className="flex items-center justify-between gap-3 rounded-[1.2rem] bg-[#f8f5ff] px-4 py-3 dark:bg-white/6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${detail.iconWrapClassName}`}
                      >
                        <Icon className="size-4.5" />
                      </div>
                      <p className="text-sm font-semibold text-[#6f6586] dark:text-[#c9badf]">
                        {detail.label}
                      </p>
                    </div>

                    <p className="text-right font-auth-headline text-base font-bold text-[#2f2441] dark:text-white">
                      {detail.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-4 rounded-[1.2rem] bg-[#f5f1ff] px-4 py-4 dark:bg-white/6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#7b19d8] shadow-[0_10px_24px_-16px_rgba(123,25,216,0.35)] dark:bg-white/10 dark:text-[#ff84d1]">
                <Info className="size-4.5" />
              </div>
              <p className="text-sm leading-7 text-[#6f6586] dark:text-[#d7c7ed]">
                {internalTransfer
                  ? "Vui lòng kiểm tra lại ID người nhận trong hệ thống hoặc liên hệ đội ngũ hỗ trợ để được kiểm tra nhanh."
                  : "Vui lòng kiểm tra lại thông tin tài khoản ngân hàng hoặc liên hệ đội ngũ hỗ trợ để được xử lý nhanh nhất."}
              </p>
            </div>
          </section>

          <section className="relative mt-6 overflow-hidden rounded-[1.85rem] bg-gradient-primary px-5 py-5 text-white shadow-[0_26px_58px_-32px_rgba(123,25,216,0.4)]">
            <div className="pointer-events-none absolute -right-10 top-0 size-32 rounded-full bg-white/12 blur-2xl" />
            <div className="relative z-10 max-w-[15rem]">
              <p className="font-auth-headline text-lg font-bold leading-tight">
                Cần hỗ trợ kiểm tra lại?
              </p>
              <p className="mt-2 text-sm leading-6 text-white/86">
                {internalTransfer
                  ? "Bộ phận hỗ trợ có thể kiểm tra lại ID người nhận và lịch sử chuyển tiền nội bộ cho bạn."
                  : "Bộ phận hỗ trợ có thể xem lại thông tin tài khoản nhận tiền và hướng dẫn bạn tạo yêu cầu rút đúng chuẩn."}
              </p>
            </div>
          </section>

          <section className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => navigate("/chat/support")}
              className="flex w-full items-center justify-center rounded-full bg-gradient-primary px-6 py-4 font-auth-headline text-base font-bold text-white shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)] transition-transform duration-200 active:scale-[0.99]"
            >
              Liên hệ hỗ trợ
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex w-full items-center justify-center rounded-full bg-white/88 px-6 py-4 font-auth-headline text-base font-bold text-[#6e6584] shadow-[0_18px_36px_-30px_rgba(123,25,216,0.24)] ring-1 ring-black/[0.04] transition-transform duration-200 active:scale-[0.99] dark:bg-white/8 dark:text-[#d7c7ed]"
            >
              Về trang chủ
            </button>
          </section>
        </main>

        <AppMobileNav />
      </div>
    );
  }

  const internalTransfer = isInternalWithdrawal(request);
  const statusMeta = getStatusMeta(request.status, internalTransfer);
  const StatusIcon = statusMeta.icon;
  const confirmationCode =
    request.confirmationCode ?? buildWithdrawalTransferContent(request.userId);
  const transactionAmountLabel = internalTransfer ? "Số tiền chuyển" : "Số tiền rút";
  const transactionContentLabel = internalTransfer ? "Mã chuyển tiền nội bộ" : "Nội dung rút tiền";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-5rem] top-24 size-56 rounded-full bg-[#ffd3f2]/68 blur-3xl dark:bg-[#7b19d8]/30" />
      <div className="pointer-events-none absolute left-[-4rem] top-52 size-48 rounded-full bg-[#cbe8ff]/38 blur-3xl dark:bg-[#3b2d68]/40" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/82 backdrop-blur-xl dark:bg-[#12081d]/82">
        <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_18px_40px_-26px_rgba(123,25,216,0.42)]">
              <span className="font-auth-headline text-sm font-extrabold">
                {user?.displayName?.charAt(0) ?? "K"}
              </span>
            </div>
            <div>
              <p className="font-auth-headline text-base font-extrabold tracking-tight text-[#2d1459] dark:text-white">
                Kiếm Tương Tác
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b79cb] dark:text-[#d9b7ff]">
                {internalTransfer ? "Internal Transfer" : "Withdrawal Flow"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              toast.info(
                internalTransfer
                  ? "Thông báo chuyển tiền nội bộ sẽ được cập nhật tại trung tâm thông báo sau."
                  : "Thông báo rút tiền sẽ được cập nhật tại trung tâm thông báo sau."
              )
            }
            className="flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] transition-colors hover:bg-white active:scale-95 dark:bg-white/10 dark:text-slate-100"
            aria-label="Thông báo"
          >
            <Bell className="size-4.5" />
          </button>
        </div>
      </header>

      <main className="mobile-page-shell pb-36 pt-6">
        <section className="flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className={`absolute inset-0 rounded-full blur-[38px] ${statusMeta.haloBg}`} />
            <div
              className={`relative flex size-24 items-center justify-center rounded-full bg-white shadow-[0_18px_48px_-34px_rgba(123,25,216,0.28)] ring-1 ring-black/[0.03] dark:bg-white/10 dark:ring-white/12`}
            >
              <StatusIcon className={`size-11 ${statusMeta.accent}`} />
              <span
                className={`absolute inset-0 rounded-full border-[3px] border-white/40 ${statusMeta.borderGlow}`}
              />
            </div>
          </div>

          <h1 className="max-w-xs font-auth-headline text-[2rem] font-extrabold leading-[1.08] tracking-[-0.05em] text-[#2f2441] dark:text-white">
            {statusMeta.title}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#7e7691] dark:text-[#c8b5e8]">
            {statusMeta.description}
          </p>
        </section>

        <section className="mt-8 rounded-[1.7rem] bg-white/88 p-5 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.28)] backdrop-blur-2xl dark:bg-white/8">
          <h2 className="font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
            Chi tiết giao dịch
          </h2>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm font-medium text-[#8d84a1] dark:text-[#bdaaD6]">
              {transactionAmountLabel}
            </span>
            <span className="font-auth-headline text-[1.4rem] font-extrabold text-[#00a46f] dark:text-[#84f0be]">
              {formatCurrency(request.amount)}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa] dark:text-[#d7c7ed]">
                {internalTransfer ? "Hình thức" : "Ngân hàng"}
              </p>
              <p className="mt-1.5 font-auth-headline text-sm font-bold text-slate-900 dark:text-white">
                {request.bankName}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa] dark:text-[#d7c7ed]">
                Mã giao dịch
              </p>
              <p className="mt-1.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                {request.id}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa] dark:text-[#d7c7ed]">
                {internalTransfer ? "ID người nhận" : "Số tài khoản"}
              </p>
              <p className="mt-1.5 font-auth-headline text-sm font-bold text-slate-900 dark:text-white">
                {formatWithdrawalRequestAccount(request)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa] dark:text-[#d7c7ed]">
                Thời gian
              </p>
              <p className="mt-1.5 font-auth-headline text-sm font-bold text-slate-900 dark:text-white">
                {formatWithdrawalRequestedShort(request)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(confirmationCode).then(
              () =>
                toast.success(
                  internalTransfer
                    ? "Đã sao chép mã chuyển tiền nội bộ."
                    : "Đã sao chép nội dung rút tiền."
                ),
              () =>
                toast.error(
                  internalTransfer
                    ? "Không thể sao chép mã chuyển tiền nội bộ."
                    : "Không thể sao chép nội dung rút tiền."
                )
            )}
            className="mt-6 flex w-full items-center justify-between gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3 text-left transition-colors hover:bg-[#f3eef9] dark:bg-white/6 dark:hover:bg-white/10"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa] dark:text-[#d7c7ed]">
                {transactionContentLabel}
              </p>
              <p className="mt-1.5 font-auth-headline text-sm font-bold text-[#5868ff] dark:text-[#a9b4ff]">
                {confirmationCode}
              </p>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5868ff]">
              <Copy className="size-4.5" />
            </div>
          </button>

          <div className={`mt-6 flex items-start gap-3 rounded-[1rem] px-4 py-3 ${statusMeta.accentBg} dark:bg-white/10`}>
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 ${statusMeta.accent}`}>
              <ShieldCheck className="size-4.5" />
            </div>
            <p className="text-sm leading-6 text-[#6f6591] dark:text-[#d7c7ed]">
              {statusMeta.eta}
            </p>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-4 font-auth-headline text-base font-bold text-white shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)] transition-transform duration-200 active:scale-[0.99]"
          >
            <Home className="size-5" />
            Về trang chủ
          </button>

          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white/88 px-6 py-4 font-auth-headline text-base font-bold text-[#5a4e73] shadow-[0_18px_40px_-32px_rgba(123,25,216,0.22)] transition-transform duration-200 active:scale-[0.99] dark:bg-white/8 dark:text-[#d5c5ec]"
          >
            <Wallet className="size-5" />
            Xem lịch sử giao dịch
          </button>
        </section>
      </main>

      <AppMobileNav />
    </div>
  );
}
