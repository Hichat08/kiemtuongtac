import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import { useDepositRequest } from "@/hooks/useDepositRequest";
import {
  formatDepositRequestedFull,
  formatDepositSuccessCode,
} from "@/lib/deposit-requests";
import { formatDepositCurrency } from "@/lib/deposit-checkout";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  History,
  Home,
  MoreVertical,
  ShieldCheck,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function DepositSuccessPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
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

  if (request.status !== "approved") {
    return (
      <Navigate
        to={`/wallet/deposit/pending/${request.id}`}
        replace
      />
    );
  }

  const successCode = formatDepositSuccessCode(request.id);

  const handleCopyRequestId = async () => {
    try {
      await navigator.clipboard.writeText(successCode);
      toast.success("Đã sao chép mã giao dịch.");
    } catch (error) {
      console.error("Không sao chép được mã giao dịch", error);
      toast.error("Không sao chép được mã giao dịch.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.14),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.16),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-5rem] top-20 size-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />
      <div className="pointer-events-none absolute left-[-4rem] top-56 size-48 rounded-full bg-[#d8cbff]/45 blur-3xl dark:bg-[#2b385f]/30" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/82 backdrop-blur-xl dark:bg-[#12081d]/82">
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9b79cb] dark:text-[#d9b7ff]">
                Ví cá nhân
              </p>
              <h1 className="font-auth-headline text-[1.45rem] font-extrabold tracking-[-0.04em] text-[#2d1459] dark:text-white">
                Giao dịch thành công
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast.info("Chi tiết giao dịch sẽ được mở rộng ở bước tiếp theo.")}
            className="flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] transition-colors hover:bg-white active:scale-95 dark:bg-white/10 dark:text-slate-100"
            aria-label="Tùy chọn"
          >
            <MoreVertical className="size-4.5" />
          </button>
        </div>
      </header>

      <main className="mobile-page-shell pb-36 pt-8">
        <section className="flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-[#ffd3f2] blur-[40px]" />
            <div className="relative flex size-28 items-center justify-center rounded-full bg-gradient-primary shadow-[0_24px_60px_-30px_rgba(123,25,216,0.48)]">
              <CheckCircle2 className="size-14 text-white" />
            </div>
          </div>

          <h1 className="font-auth-headline text-[2.1rem] font-extrabold tracking-[-0.05em] text-[#2f2441] dark:text-white">
            Nạp tiền thành công!
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-7 text-[#7e7691] dark:text-[#c8b5e8]">
            Số tiền đã được cộng vào ví của bạn.
          </p>
        </section>

        <section className="mt-10 rounded-[1.7rem] bg-white/88 p-6 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.26)] backdrop-blur-2xl dark:bg-white/8">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#9a91aa] dark:text-[#bdaaD6]">
              Số tiền nạp
            </p>
            <p className="mt-3 font-auth-headline text-[2.2rem] font-extrabold tracking-[-0.05em] text-[#7b19d8] dark:text-[#ff84d1]">
              {formatDepositCurrency(request.amount)}đ
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[1.7rem] bg-white/88 p-6 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.22)] backdrop-blur-2xl dark:bg-white/8">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-[#8d84a1] dark:text-[#bdaaD6]">
                Mã giao dịch
              </span>
              <button
                type="button"
                onClick={() => void handleCopyRequestId()}
                className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-slate-900 transition-opacity hover:opacity-80 dark:text-white"
              >
                {successCode}
                <Copy className="size-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-[#8d84a1] dark:text-[#bdaaD6]">
                Phương thức
              </span>
              <span className="font-auth-headline text-base font-bold text-slate-900 dark:text-white">
                {request.methodTitle}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-[#8d84a1] dark:text-[#bdaaD6]">
                Thời gian
              </span>
              <span className="font-auth-headline text-sm font-bold text-slate-900 dark:text-white">
                {formatDepositRequestedFull(request)}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-10 space-y-4">
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
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#eceaf2] px-6 py-4 font-auth-headline text-base font-semibold text-[#4b425f] shadow-[0_18px_40px_-32px_rgba(123,25,216,0.16)] transition-transform duration-200 active:scale-[0.99] dark:bg-white/8 dark:text-[#d5c5ec]"
          >
            <History className="size-5" />
            Xem lịch sử giao dịch
          </button>
        </section>

        <section className="mt-8">
          <div className="flex items-start justify-center gap-2 text-center text-sm leading-6 text-[#8d84a1] dark:text-[#bdaaD6]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#8d84a1] dark:text-[#bdaaD6]" />
            <p>Giao dịch bảo mật bởi Social Tasks Pay.</p>
          </div>
        </section>
      </main>

      <AppMobileNav />
    </div>
  );
}
