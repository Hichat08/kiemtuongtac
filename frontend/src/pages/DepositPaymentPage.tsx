import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import kiemTuongTacLogo from "@/assets/kiem-tuong-tac-logo.png";
import {
  clearDepositCheckoutDraft,
  createDepositCheckoutDraft,
  DEPOSIT_CHECKOUT_TTL_MS,
  formatDepositCountdown,
  formatDepositCurrency,
  getDepositCheckoutExpiryMs,
  getDepositCheckoutRemainingMs,
  isDepositCheckoutExpired,
  loadDepositCheckoutDraft,
  saveDepositCheckoutDraft,
} from "@/lib/deposit-checkout";
import type { DepositCheckoutDraft } from "@/lib/deposit-checkout";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Copy,
  Landmark,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

export default function DepositPaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const locationState = location.state as { checkout?: DepositCheckoutDraft } | null;
  const [checkout, setCheckout] = useState<DepositCheckoutDraft | null>(
    locationState?.checkout ?? loadDepositCheckoutDraft()
  );
  const [submitting, setSubmitting] = useState(false);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasShownExpiredToastRef = useRef(false);

  useEffect(() => {
    if (!checkout) {
      return undefined;
    }

    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkout?.createdAt]);

  const remainingMs = checkout ? getDepositCheckoutRemainingMs(checkout, nowMs) : 0;
  const isExpired = checkout ? isDepositCheckoutExpired(checkout, nowMs) : true;
  const countdownLabel = formatDepositCountdown(remainingMs);
  const expiryProgress = Math.max(
    0,
    Math.min(100, (remainingMs / DEPOSIT_CHECKOUT_TTL_MS) * 100)
  );
  const expiresAtLabel = useMemo(() => {
    if (!checkout) {
      return "";
    }

    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(getDepositCheckoutExpiryMs(checkout)));
  }, [checkout]);

  useEffect(() => {
    if (!isExpired) {
      hasShownExpiredToastRef.current = false;
      return;
    }

    if (checkout && !hasShownExpiredToastRef.current) {
      toast.info("Mã QR đã hết hạn. Vui lòng tạo mã mới trước khi tiếp tục.");
      hasShownExpiredToastRef.current = true;
    }
  }, [checkout, isExpired]);

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${label.toLowerCase()}.`);
    } catch {
      toast.error("Không thể sao chép. Thử lại sau.");
    }
  };

  const handleCancel = () => {
    clearDepositCheckoutDraft();
    navigate("/wallet/deposit", { replace: true });
  };

  const handleConfirmTransferred = async () => {
    if (!checkout) {
      navigate("/wallet/deposit", { replace: true });
      return;
    }

    if (isExpired) {
      toast.error("Mã QR đã hết hạn. Vui lòng tạo mã mới trước khi gửi yêu cầu.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await userService.createDepositRequest({
        amount: checkout.amount,
        bonusAmount: checkout.bonusAmount,
        totalAmount: checkout.totalAmount,
        methodId: checkout.methodId,
        methodTitle: checkout.methodTitle,
        bankCode: checkout.bankCode,
        bankName: checkout.bankName,
        accountNumber: checkout.accountNumber,
        accountHolder: checkout.accountHolder,
        transferCode: checkout.transferCode,
      });

      clearDepositCheckoutDraft();
      navigate(`/wallet/deposit/pending/${res.request.id}`, {
        replace: true,
      });
    } catch (error) {
      console.error("Không tạo được yêu cầu nạp tiền", error);
      toast.error(getErrorMessage(error, "Không thể tạo yêu cầu nạp tiền."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshQr = async () => {
    if (!checkout) {
      navigate("/wallet/deposit", { replace: true });
      return;
    }

    try {
      setRefreshingQr(true);
      const res = await userService.getDepositReceivingAccount();

      if (!res.account || res.account.status !== "active") {
        toast.error("Admin chưa cấu hình tài khoản nhận tiền để nạp. Vui lòng thử lại sau.");
        return;
      }

      const nextCheckout = createDepositCheckoutDraft({
        amount: checkout.amount,
        bonusAmount: checkout.bonusAmount,
        totalAmount: checkout.totalAmount,
        methodId: checkout.methodId,
        methodTitle: checkout.methodTitle,
        userCode: user?.accountId,
        receivingAccount: res.account,
      });

      if (!nextCheckout) {
        toast.error("Không thể tạo mã QR mới. Vui lòng thử lại sau.");
        return;
      }

      saveDepositCheckoutDraft(nextCheckout);
      setCheckout(nextCheckout);
      setNowMs(Date.now());
      toast.success("Đã tạo mã QR mới.");
    } catch (error) {
      console.error("Không thể tạo mã QR mới", error);
      toast.error(getErrorMessage(error, "Không thể tạo mã QR mới."));
    } finally {
      setRefreshingQr(false);
    }
  };

  if (user?.role === "admin") {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  if (!checkout) {
    return (
      <Navigate
        to="/wallet/deposit"
        replace
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-5rem] top-20 size-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />
      <div className="pointer-events-none absolute left-[-4rem] top-64 size-48 rounded-full bg-[#cbe8ff]/36 blur-3xl dark:bg-[#2b385f]/28" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/84 backdrop-blur-xl dark:bg-[#12081d]/82">
        <div className="mobile-page-shell flex items-center gap-3 pb-3 pt-5">
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
              Nạp tiền
            </p>
            <h1 className="font-auth-headline text-[1.45rem] font-extrabold tracking-[-0.04em] text-[#2d1459] dark:text-white">
              Thanh toán QR
            </h1>
          </div>
        </div>
      </header>

      <main className="mobile-page-shell pb-72 pt-5">
        <section>
          <h2 className="font-auth-headline text-[2.05rem] font-extrabold tracking-[-0.06em] text-[#2f2441] dark:text-white">
            Xác nhận nạp tiền
          </h2>
          <p className="mt-3 max-w-[20rem] text-sm leading-6 text-[#7f7592] dark:text-[#c9badf]">
            Quét mã hoặc sao chép đúng thông tin chuyển khoản bên dưới để hệ thống đối soát nhanh.
          </p>
        </section>

        <section className="mt-6 rounded-[1.75rem] bg-white/9 p-3 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.28)]">
          <div className="overflow-hidden rounded-[1.45rem] bg-white/90 p-4 shadow-[0_22px_52px_-40px_rgba(123,25,216,0.2)] dark:bg-white/8">
            <div className="px-2 pb-4 text-center">
              <p className="font-auth-headline text-lg font-bold text-[#2f2441] dark:text-white">
                Quét mã để thanh toán
              </p>
            </div>

            <div className="relative rounded-[1.3rem] border border-[#ede6f7] bg-[#fbf9ff] p-3 dark:border-white/10 dark:bg-[#160c25]">
              {isExpired ? (
                <div className="absolute inset-3 z-10 flex flex-col items-center justify-center rounded-[1.05rem] bg-white/88 px-5 text-center backdrop-blur-sm dark:bg-[#160c25]/88">
                  <p className="font-auth-headline text-xl font-bold text-[#d4525d] dark:text-[#ff9fb1]">
                    Mã QR đã hết hạn
                  </p>
                  <p className="mt-2 max-w-[15rem] text-sm leading-6 text-[#7f7592] dark:text-[#c9badf]">
                    Tạo lại mã mới để tiếp tục nạp tiền với nội dung chuyển khoản cập nhật.
                  </p>
                </div>
              ) : null}
              <img
                src={checkout.qrSrc}
                alt={`QR chuyển khoản ${checkout.transferCode}`}
                className={`mx-auto block w-full max-w-[22rem] rounded-[1.05rem] object-contain shadow-[0_24px_50px_-40px_rgba(16,38,51,0.45)] ${
                  isExpired ? "opacity-30 grayscale" : ""
                }`}
              />
              <div className="pointer-events-none absolute left-1/2 -top-11 z-[1] w-[10.75rem] -translate-x-1/2">
                <img
                  src={kiemTuongTacLogo}
                  alt="Kiếm Tương Tác"
                  className="mx-auto block h-auto w-full object-contain drop-shadow-[0_10px_20px_rgba(17,24,39,0.18)]"
                />
              </div>
            </div>

            <div className="px-2 pb-1 pt-4 text-center">
              <div className="mt-4 w-full space-y-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Clock3 className="size-3.5 shrink-0 text-[#7b19d8] dark:text-[#ff84d1]" />
                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b19d8]/75 dark:text-[#e8c8ff]/85">
                      Thời gian thanh toán còn lại
                    </span>
                  </div>
                  <span
                    className={`shrink-0 font-auth-headline text-lg font-bold tabular-nums ${
                      isExpired
                        ? "text-[#d4525d] dark:text-[#ff9fb1]"
                        : "text-[#7b19d8] dark:text-[#ff84d1]"
                    }`}
                  >
                    {isExpired ? "00:00" : countdownLabel}
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-[#efe6fb] dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                      isExpired
                        ? "bg-[#d4525d]"
                        : "bg-gradient-primary"
                    }`}
                    style={{ width: `${expiryProgress}%` }}
                  />
                </div>

                {isExpired ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f1ff] px-3 py-3 dark:bg-[#2d183f]">
                    <p className="text-xs leading-5 text-[#7b19d8] dark:text-[#e7c6ff]">
                      Mã QR đã hết hạn lúc {expiresAtLabel}. Tạo mã mới để tiếp tục thanh toán.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleRefreshQr()}
                      disabled={refreshingQr}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-[#7b19d8] shadow-[0_12px_24px_-18px_rgba(123,25,216,0.45)] transition-colors hover:bg-[#fbf7ff] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white/10 dark:text-[#ffb0bf] dark:hover:bg-white/14"
                    >
                      <RefreshCw className={`size-3.5 ${refreshingQr ? "animate-spin" : ""}`} />
                      {refreshingQr ? "Đang tạo..." : "Tạo mã mới"}
                    </button>
                  </div>
                ) : null}
              </div>

              <p className="mt-4 text-sm leading-6 text-[#8d84a1] dark:text-[#bdaaD6]">
                Hỗ trợ tất cả ứng dụng ngân hàng nội địa và ví có hỗ trợ quét QR chuyển khoản.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[1.7rem] bg-white/88 p-4 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.28)] backdrop-blur-2xl dark:bg-white/8">
          <div className="flex items-start justify-between gap-3 border-b border-[#efe6f7] px-1 pb-4 dark:border-white/10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
                  Số tiền cần chuyển
                </p>
                <p className="mt-2 font-auth-headline text-[2rem] font-extrabold tracking-[-0.05em] text-[#2f2441] dark:text-white">
                  {formatDepositCurrency(checkout.amount)}
                <span className="ml-2 text-base text-[#7b19d8] dark:text-[#ff84d1]">VND</span>
              </p>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-[#f3eef9] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]">
              <Landmark className="size-5" />
            </div>
          </div>

          <div className="space-y-3 px-1 pt-4">
            <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3 dark:bg-white/6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
                  Ngân hàng
                </p>
                <p className="mt-1 font-auth-headline text-base font-bold text-[#2f2441] dark:text-white">
                  {checkout.bankName}
                </p>
              </div>
              <Building2 className="size-5 shrink-0 text-[#7b19d8] dark:text-[#ff84d1]" />
            </div>

            <div className="rounded-[1rem] bg-[#f8f5ff] px-4 py-3 dark:bg-white/6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
                Tên tài khoản
              </p>
              <p className="mt-1 font-auth-headline text-base font-bold text-[#2f2441] dark:text-white">
                {checkout.accountHolder}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCopy("số tài khoản", checkout.accountNumber)}
              className="flex w-full items-center justify-between gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3 text-left transition-colors hover:bg-[#f3eef9] dark:bg-white/6 dark:hover:bg-white/10"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
                  Số tài khoản
                </p>
                <p className="mt-1 font-auth-headline text-base font-bold text-[#2f2441] dark:text-white">
                  {checkout.accountNumber}
                </p>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5868ff]">
                <Copy className="size-4.5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleCopy("nội dung chuyển khoản", checkout.transferCode)}
              className="flex w-full items-center justify-between gap-3 rounded-[1rem] bg-[#f8f5ff] px-4 py-3 text-left transition-colors hover:bg-[#f3eef9] dark:bg-white/6 dark:hover:bg-white/10"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b8190] dark:text-[#bdaaD6]">
                  NỘI DUNG
                </p>
                <p className="mt-1 font-auth-headline text-base font-bold text-[#5868ff] dark:text-[#a9b4ff]">
                  {checkout.transferCode}
                </p>
              </div>
              <div className="rounded-full bg-[#eef1ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#5868ff]">
                Sao chép
              </div>
            </button>
          </div>
        </section>

        <section className="mt-5 flex items-start gap-3 rounded-[1.35rem] bg-[#f2effa] px-4 py-4 text-sm leading-6 text-[#7f7592] dark:bg-white/8 dark:text-[#c9badf]">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eefbf4] text-[#00a46f] dark:bg-[#163527] dark:text-[#84f0be]">
            <ShieldCheck className="size-4.5" />
          </div>
          <p>Giao dịch được mã hóa an toàn. Chuyển đúng số tiền và nội dung để hệ thống đối soát nhanh.</p>
        </section>

      </main>

      <div className="fixed inset-x-0 bottom-[4.9rem] z-40 bg-[linear-gradient(180deg,rgba(248,245,255,0),rgba(248,245,255,0.92)_18%,rgba(248,245,255,0.98)_100%)] pb-4 pt-6 backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(18,8,29,0),rgba(18,8,29,0.92)_18%,rgba(18,8,29,0.98)_100%)]">
        <div className="mobile-page-shell space-y-3">
          <button
            type="button"
            onClick={() => (isExpired ? void handleRefreshQr() : void handleConfirmTransferred())}
            disabled={submitting || refreshingQr}
            className={`flex w-full items-center justify-center rounded-full px-6 py-4 font-auth-headline text-base font-bold text-white transition-transform duration-200 active:scale-[0.99] ${
              submitting || refreshingQr
                ? "cursor-not-allowed bg-[#bfaed7] shadow-none"
                : "bg-gradient-primary shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)]"
            }`}
          >
            {refreshingQr
              ? "Đang tạo mã QR..."
              : submitting
                ? "Đang gửi yêu cầu..."
                : isExpired
                  ? "Tạo mã QR mới"
                  : "Tôi đã chuyển khoản"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            className="flex w-full items-center justify-center rounded-full bg-white/88 px-6 py-4 font-auth-headline text-base font-bold text-[#6e6584] shadow-[0_18px_36px_-30px_rgba(123,25,216,0.24)] ring-1 ring-black/[0.04] transition-transform duration-200 active:scale-[0.99] dark:bg-white/8 dark:text-[#d7c7ed]"
          >
            Hủy giao dịch
          </button>
        </div>
      </div>

      <AppMobileNav />
    </div>
  );
}
