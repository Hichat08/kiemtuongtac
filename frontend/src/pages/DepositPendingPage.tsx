import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import { formatDepositRequestedFull } from "@/lib/deposit-requests";
import { useDepositRequest } from "@/hooks/useDepositRequest";
import { formatDepositCurrency } from "@/lib/deposit-checkout";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  ArrowLeft,
  Clock3,
  Hash,
  Hourglass,
  Info,
  Landmark,
  Wallet,
  X,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";

const DEPOSIT_REJECTION_FALLBACK =
  "Nội dung chuyển khoản không chính xác hoặc sai số tiền";

const getInitials = (displayName?: string | null) => {
  const words = (displayName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "ST";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
};

export default function DepositPendingPage() {
  const navigate = useNavigate();
  const { requestId = "" } = useParams();
  const { user } = useAuthStore();
  const { request, loading } = useDepositRequest(requestId);

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
        to="/wallet/deposit"
        replace
      />
    );
  }

  if (request.status === "approved") {
    return (
      <Navigate
        to={`/wallet/deposit/success/${request.id}`}
        replace
      />
    );
  }

  if (request.status === "rejected") {
    const rejectionReason =
      request.note?.trim() || DEPOSIT_REJECTION_FALLBACK;
    const requestedTime = formatDepositRequestedFull(request).replace(", ", " - ");
    const rejectedDetails = [
      {
        label: "Số tiền",
        value: `${formatDepositCurrency(request.amount)}đ`,
        icon: Wallet,
        iconWrapClassName: "bg-[#f3edff] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]",
      },
      {
        label: "Mã giao dịch",
        value: `#${request.id}`,
        icon: Hash,
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

        <main className="mobile-page-shell pb-72 pt-8">
          <section className="flex flex-col items-center text-center">
            <span className="inline-flex rounded-full bg-[#fff0f5] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4525d] dark:bg-[#5a2132] dark:text-[#ffb0bf]">
              Yêu cầu bị từ chối
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

            <h1 className="mt-8 max-w-xs font-auth-headline text-[2.1rem] font-extrabold tracking-[-0.05em] text-[#2f2441] dark:text-white">
              Giao dịch nạp tiền bị từ chối
            </h1>
            <p className="mt-3 max-w-[17rem] text-sm leading-7 text-[#7e7691] dark:text-[#c8b5e8]">
              Yêu cầu của bạn chưa thể được hệ thống xác nhận ở lần kiểm tra này.
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
            <div className="flex items-start justify-between gap-3 border-b border-[#efe6f7] pb-4 dark:border-white/10">
              <div>
                <h2 className="font-auth-headline text-lg font-bold text-[#2f2441] dark:text-white">
                  Chi tiết giao dịch
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#8d84a1] dark:text-[#baa2de]">
                  Kiểm tra lại thông tin trước khi tạo yêu cầu mới.
                </p>
              </div>
              <span className="rounded-full bg-[#fff0f5] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d4525d] dark:bg-[#5a2132] dark:text-[#ffb0bf]">
                Bị từ chối
              </span>
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

            <div className="mt-4 rounded-[1.2rem] bg-[#f5f1ff] px-4 py-4 dark:bg-white/6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#7b19d8] shadow-[0_10px_24px_-16px_rgba(123,25,216,0.35)] dark:bg-white/10 dark:text-[#ff84d1]">
                  <Info className="size-4.5" />
                </div>
                <p className="text-sm leading-6 text-[#6f6586] dark:text-[#d7c7ed]">
                  Vui lòng kiểm tra lại nội dung chuyển khoản và số tiền. Nếu cần,
                  đội ngũ hỗ trợ có thể giúp bạn đối soát lại giao dịch.
                </p>
              </div>
            </div>
          </section>

          <section className="relative mt-8 overflow-hidden rounded-[1.9rem] bg-gradient-primary px-6 py-6 text-white shadow-[0_26px_58px_-32px_rgba(123,25,216,0.4)]">
            <div className="pointer-events-none absolute -right-10 top-0 size-32 rounded-full bg-white/12 blur-2xl" />
            <div className="pointer-events-none absolute bottom-[-2rem] right-5 size-24 rounded-[1.8rem] bg-white/10 blur-sm" />
            <div className="relative z-10 max-w-[14rem]">
              <p className="font-auth-headline text-lg font-bold leading-tight">
                Cần hỗ trợ ngay?
              </p>
              <p className="mt-2 text-sm leading-6 text-white/86">
                Liên hệ đội ngũ kỹ thuật để kiểm tra lại giao dịch nạp và hướng dẫn thao
                tác chính xác hơn ở lần sau.
              </p>
            </div>
          </section>
        </main>

        <div className="fixed inset-x-0 bottom-[4.9rem] z-40 bg-[linear-gradient(180deg,rgba(248,245,255,0),rgba(248,245,255,0.92)_18%,rgba(248,245,255,0.98)_100%)] pb-4 pt-6 backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(18,8,29,0),rgba(18,8,29,0.92)_18%,rgba(18,8,29,0.98)_100%)]">
          <div className="mobile-page-shell space-y-3">
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
              Quay lại trang chủ
            </button>
          </div>
        </div>

        <AppMobileNav />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.14),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.16),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-5rem] top-20 size-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />
      <div className="pointer-events-none absolute left-[-4rem] top-64 size-48 rounded-full bg-[#cbe8ff]/34 blur-3xl dark:bg-[#2b385f]/28" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/84 backdrop-blur-xl dark:bg-[#12081d]/82">
        <div className="mobile-page-shell flex items-center justify-between gap-3 pb-3 pt-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] transition-colors hover:bg-white active:scale-95 dark:bg-white/10 dark:text-slate-100"
              aria-label="Quay lại"
            >
              <ArrowLeft className="size-5" />
            </button>

            <div>
              <p className="font-auth-headline text-[1.2rem] font-extrabold tracking-[-0.04em] text-[#2d1459] dark:text-white">
                Trạng thái giao dịch
              </p>
            </div>
          </div>

          <div className="flex size-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-white shadow-[0_18px_35px_-24px_rgba(123,25,216,0.45)]">
            {getInitials(user?.displayName)}
          </div>
        </div>
      </header>

      <main className="mobile-page-shell pb-72 pt-5">
        <section className="flex flex-col items-center text-center">
          <div className="relative flex size-28 items-center justify-center rounded-full bg-white/82 shadow-[0_30px_60px_-35px_rgba(123,25,216,0.25)] ring-1 ring-[#d9b7ff] backdrop-blur-xl dark:bg-white/8 dark:ring-white/10">
            <div className="absolute inset-3 rounded-full border border-[#d9b7ff] dark:border-white/10" />
            <Hourglass className="relative z-10 size-11 text-[#7b19d8] dark:text-[#ff84d1]" />
          </div>

          <h1 className="mt-8 font-auth-headline text-[2.15rem] font-extrabold tracking-[-0.06em] text-[#2f2441] dark:text-white">
            Đang chờ Admin duyệt
          </h1>
          <p className="mt-3 max-w-[16rem] text-base leading-7 text-[#7f7592] dark:text-[#c9badf]">
            Yêu cầu của bạn đang được hệ thống xử lý, vui lòng đợi trong giây lát.
          </p>
        </section>

        <section className="mt-8 rounded-[1.75rem] bg-white/90 p-5 shadow-[0_28px_70px_-42px_rgba(123,25,216,0.3)] backdrop-blur-2xl dark:bg-white/8">
          <div className="flex items-center justify-between gap-3 border-b border-[#efe6f7] pb-4 dark:border-white/10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
                Mã giao dịch
              </p>
              <p className="mt-2 font-auth-headline text-lg font-bold text-[#2f2441] dark:text-white">
                #{request.id}
              </p>
            </div>
            <span className="rounded-full bg-[#f3eef9] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]">
              #{request.id}
            </span>
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3 dark:bg-white/6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3eef9] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]">
                  <Wallet className="size-4.5" />
                </div>
                <p className="font-semibold text-[#6f6586] dark:text-[#c9badf]">Số tiền</p>
              </div>
              <p className="font-auth-headline text-lg font-bold text-[#2f2441] dark:text-white">
                {formatDepositCurrency(request.amount)} VND
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3 dark:bg-white/6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f3eef9] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]">
                  <Landmark className="size-4.5" />
                </div>
                <p className="font-semibold text-[#6f6586] dark:text-[#c9badf]">Phương thức</p>
              </div>
              <p className="font-auth-headline text-lg font-bold text-[#2f2441] dark:text-white">
                {request.methodTitle}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3 dark:bg-white/6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-[#5868ff] dark:bg-white/10 dark:text-[#a9b4ff]">
                  <Clock3 className="size-4.5" />
                </div>
                <p className="font-semibold text-[#6f6586] dark:text-[#c9badf]">Thời gian</p>
              </div>
              <p className="font-auth-headline text-lg font-bold text-[#2f2441] dark:text-white">
                {formatDepositRequestedFull(request)}
              </p>
            </div>

            <div className="rounded-[1rem] bg-[#f8f5ff] px-4 py-3 dark:bg-white/6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b8190] dark:text-[#bdaaD6]">
                NỘI DUNG
              </p>
              <p className="mt-1 font-auth-headline text-base font-bold text-[#5868ff] dark:text-[#a9b4ff]">
                {request.transferCode}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[1.45rem] bg-[#eef5fb] px-4 py-4 text-sm leading-6 text-[#55748f] shadow-[0_20px_50px_-42px_rgba(51,164,216,0.42)] dark:bg-[#112334] dark:text-[#b8d6ef]">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dff5ff] text-[#1e8bb9] dark:bg-[#0f3f56] dark:text-[#8ed9ff]">
              <Info className="size-4.5" />
            </div>
            <p>
              Các giao dịch thường được duyệt trong vòng 15-30 phút làm việc. Nếu quá 24h
              chưa nhận được kết quả, vui lòng liên hệ hỗ trợ.
            </p>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-[4.9rem] z-40 bg-[linear-gradient(180deg,rgba(248,245,255,0),rgba(248,245,255,0.92)_18%,rgba(248,245,255,0.98)_100%)] pb-4 pt-6 backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(18,8,29,0),rgba(18,8,29,0.92)_18%,rgba(18,8,29,0.98)_100%)]">
        <div className="mobile-page-shell space-y-3">
          <button
            type="button"
            onClick={() => navigate("/wallet")}
            className="flex w-full items-center justify-center rounded-full bg-gradient-primary px-6 py-4 font-auth-headline text-base font-bold text-white shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)] transition-transform duration-200 active:scale-[0.99]"
          >
            Xem lịch sử giao dịch
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex w-full items-center justify-center rounded-full bg-white/88 px-6 py-4 font-auth-headline text-base font-bold text-[#6e6584] shadow-[0_18px_36px_-30px_rgba(123,25,216,0.24)] ring-1 ring-black/[0.04] transition-transform duration-200 active:scale-[0.99] dark:bg-white/8 dark:text-[#d7c7ed]"
          >
            Về trang chủ
          </button>
        </div>
      </div>

      <AppMobileNav />
    </div>
  );
}
