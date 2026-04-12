import {
  clearWithdrawalVerificationDraft,
  getWithdrawalVerificationCountdown,
  readWithdrawalVerificationDraft,
  saveWithdrawalVerificationDraft,
  updateWithdrawalVerificationTimers,
  type WithdrawalVerificationDraft,
} from "@/lib/withdrawal-verification";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const OTP_LENGTH = 6;

const createEmptyOtp = () => Array.from({ length: OTP_LENGTH }, () => "");

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)}đ`;

const formatSeconds = (value: number) => `${Math.max(0, value)}s`;

const maskEmail = (email?: string) => {
  const [name = "", domain = ""] = `${email ?? ""}`.trim().split("@");

  if (!name || !domain) {
    return "email của bạn";
  }

  const visibleName = name.length <= 2 ? `${name[0] ?? ""}*` : `${name.slice(0, 2)}***`;
  return `${visibleName}@${domain}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

type WithdrawalVerifyLocationState = {
  draft?: WithdrawalVerificationDraft;
} | null;

export default function WithdrawalVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const locationDraft = (location.state as WithdrawalVerifyLocationState)?.draft ?? null;
  const [draft, setDraft] = useState<WithdrawalVerificationDraft | null>(() =>
    locationDraft ?? readWithdrawalVerificationDraft()
  );
  const [otpValues, setOtpValues] = useState<string[]>(createEmptyOtp);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [clock, setClock] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!locationDraft) {
      return;
    }

    setDraft(locationDraft);
    saveWithdrawalVerificationDraft(locationDraft);
  }, [locationDraft]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    saveWithdrawalVerificationDraft(draft);
  }, [draft]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const resendAfter = getWithdrawalVerificationCountdown(draft?.resendAvailableAt);
  const expiresIn = getWithdrawalVerificationCountdown(draft?.expiresAt);
  const hasExpiry = Boolean(draft?.expiresAt);
  const isExpired = hasExpiry && expiresIn <= 0;
  const otpCode = otpValues.join("");
  const isInternalTransfer = draft?.withdrawalType === "internal";
  const transactionLabel = isInternalTransfer ? "chuyển tiền nội bộ" : "rút tiền";
  const transactionTitle = isInternalTransfer ? "Xác thực chuyển tiền nội bộ" : "Xác thực rút tiền";
  const confirmButtonLabel = isInternalTransfer ? "Xác nhận chuyển tiền" : "Xác nhận rút tiền";

  useEffect(() => {
    if (!draft || (resendAfter <= 0 && expiresIn <= 0)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setClock((current) => current + 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [clock, draft, expiresIn, resendAfter]);

  const focusInput = (index: number) => {
    const target = inputRefs.current[index];
    target?.focus();
    target?.select();
  };

  const updateOtpAt = (index: number, value: string) => {
    setOtpValues((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, "");

    if (!sanitized) {
      updateOtpAt(index, "");
      return;
    }

    if (sanitized.length > 1) {
      const next = createEmptyOtp();
      sanitized
        .slice(0, OTP_LENGTH)
        .split("")
        .forEach((digit, offset) => {
          next[Math.min(index + offset, OTP_LENGTH - 1)] = digit;
        });
      setOtpValues(next);
      focusInput(Math.min(index + sanitized.length, OTP_LENGTH - 1));
      return;
    }

    updateOtpAt(index, sanitized);

    if (index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otpValues[index] && index > 0) {
      focusInput(index - 1);
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);

    if (!pasted) {
      return;
    }

    const next = createEmptyOtp();
    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setOtpValues(next);
    focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  const handleBack = () => {
    if (!draft) {
      navigate("/wallet/withdraw", { replace: true });
      return;
    }

    navigate("/wallet/withdraw", {
      state: { verificationDraft: draft },
    });
  };

  const handleResendCode = async () => {
    if (!draft || resendAfter > 0 || resending || submitting) {
      return;
    }

    try {
      setResending(true);
      const response = await userService.requestWithdrawalVerificationCode();
      const nextDraft = updateWithdrawalVerificationTimers(draft, {
        resendAfter: response.resendAfter,
        expiresIn: response.expiresIn,
      });

      setDraft(nextDraft);
      setClock(0);
      setOtpValues(createEmptyOtp());
      focusInput(0);

      if (response.sent) {
        toast.success(
          isInternalTransfer
            ? "Mã xác minh chuyển tiền nội bộ đã được gửi lại."
            : "Mã xác minh rút tiền đã được gửi lại."
        );
      } else {
        toast.info("Mã xác minh hiện vẫn còn hiệu lực.");
      }
    } catch (error) {
      console.error("Không gửi lại được mã xác minh rút tiền", error);
      toast.error(
        getErrorMessage(
          error,
          isInternalTransfer
            ? "Không thể gửi lại mã xác minh chuyển tiền nội bộ."
            : "Không thể gửi lại mã xác minh rút tiền."
        )
      );
    } finally {
      setResending(false);
    }
  };

  const handleConfirm = async () => {
    if (!draft) {
      return;
    }

    if (isExpired) {
      toast.error("Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.");
      return;
    }

    if (otpCode.length !== OTP_LENGTH) {
      toast.error("Vui lòng nhập đủ 6 chữ số OTP.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await userService.createWithdrawalRequest({
        withdrawalType: draft.withdrawalType === "internal" ? "internal" : "bank",
        bankAccountId: draft.bankAccountId,
        recipientAccountId: draft.recipientAccountId,
        amount: draft.amount,
        verificationCode: otpCode,
      });

      clearWithdrawalVerificationDraft();
      navigate(`/wallet/withdraw/pending/${response.request.id}`, {
        replace: true,
      });
    } catch (error) {
      console.error("Không tạo được yêu cầu rút tiền", error);
      toast.error(
        getErrorMessage(
          error,
          isInternalTransfer
            ? "Không thể xác nhận chuyển tiền nội bộ."
            : "Không thể xác nhận yêu cầu rút tiền."
        )
      );
    } finally {
      setSubmitting(false);
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

  if (!user?.emailVerified || !user?.email) {
    return (
      <Navigate
        to="/wallet/withdraw"
        replace
      />
    );
  }

  if (!draft) {
    return (
      <Navigate
        to="/wallet/withdraw"
        replace
      />
    );
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#f8f5ff] font-auth-body text-[#2f2441] dark:bg-[#12081d] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-5rem] top-16 size-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />
      <div className="pointer-events-none absolute left-[-4rem] bottom-16 size-48 rounded-full bg-[#d8cbff]/55 blur-3xl dark:bg-[#2b385f]/30" />

      <header className="sticky top-0 z-20 bg-[#f8f5ff]/88 backdrop-blur-2xl dark:bg-[#12081d]/88">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-6 pb-4 pt-5">
          <button
            type="button"
            onClick={handleBack}
            className="flex size-10 items-center justify-center rounded-full bg-white/82 text-[#7b19d8] shadow-[0_16px_40px_-26px_rgba(123,25,216,0.38)] transition-transform active:scale-95 dark:bg-white/10 dark:text-[#ff84d1]"
            aria-label={`Quay lại màn ${transactionLabel}`}
          >
            <ArrowLeft className="size-5" />
          </button>

          <h1 className="font-auth-headline text-[1.35rem] font-extrabold tracking-[-0.04em] text-[#5f22af] dark:text-white">
            {transactionTitle}
          </h1>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100svh-4.75rem)] w-full max-w-md flex-col justify-center px-6 pb-10 pt-8">
        <div className="w-full text-center">
          <div className="relative mx-auto flex size-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#ffd3f2] blur-[40px] dark:bg-[#7b19d8]/30" />
            <div className="relative flex size-20 items-center justify-center rounded-full bg-gradient-primary shadow-[0_24px_60px_-30px_rgba(123,25,216,0.48)]">
              <ShieldCheck className="size-9 text-white" />
              <div className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-[#5868ff] text-white ring-4 ring-[#f8f5ff] dark:ring-[#12081d]">
                <Check className="size-3.5 stroke-[3]" />
              </div>
            </div>
          </div>

          <h2 className="mt-10 font-auth-headline text-[2.15rem] font-extrabold tracking-[-0.05em] text-[#2f2441] dark:text-white">
            Nhập mã OTP
          </h2>
          <p className="mt-4 px-2 text-sm leading-7 text-[#7e7691] dark:text-[#c8b5e8]">
            Vui lòng nhập mã OTP 6 số đã được gửi đến <strong>{maskEmail(user.email)}</strong> để
            xác nhận lệnh {transactionLabel}{" "}
            <span className="font-bold text-[#7b19d8] dark:text-[#ff84d1]">{formatCurrency(draft.amount)}</span>
          </p>
          {hasExpiry ? (
            expiresIn > 0 ? (
              <p className="mt-3 text-xs font-medium text-[#7e7691] dark:text-[#c8b5e8]">
                Mã còn hiệu lực <span className="font-semibold text-[#5868ff] dark:text-[#a9b4ff]">{formatSeconds(expiresIn)}</span>
              </p>
            ) : (
              <p className="mt-3 text-xs font-medium text-[#b31b25]">
                Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới.
              </p>
            )
          ) : (
            <p className="mt-3 text-xs font-medium text-[#7e7691] dark:text-[#c8b5e8]">
              Mã xác minh đã được gửi tới email của bạn.
            </p>
          )}
        </div>

        <div className="mt-10 grid grid-cols-6 gap-2">
          {otpValues.map((value, index) => {
            const isFilled = Boolean(value);

            return (
              <input
                key={index}
                ref={(node) => {
                  inputRefs.current[index] = node;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={OTP_LENGTH}
                value={value}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                className={`aspect-square rounded-[1rem] border text-center font-auth-headline text-[1.9rem] font-extrabold outline-none transition-all ${
                  isFilled
                    ? "border-transparent bg-white text-[#7b19d8] shadow-[0_18px_34px_-26px_rgba(123,25,216,0.28)] dark:bg-white/12 dark:text-[#ff84d1]"
                    : "border-[#e3d8f2] bg-[#f3eef9] text-[#2f2441] shadow-none dark:border-white/10 dark:bg-white/6 dark:text-white"
                } focus:border-[#d9b7ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(123,25,216,0.08)] dark:focus:border-[#7b19d8] dark:focus:bg-white/10`}
                aria-label={`Chữ số OTP thứ ${index + 1}`}
              />
            );
          })}
        </div>

        <div className="mt-8 text-center">
          {resendAfter > 0 ? (
            <p className="text-sm font-medium text-[#7e7691] dark:text-[#c8b5e8]">
              Gửi lại mã sau <span className="font-semibold text-[#5868ff] dark:text-[#a9b4ff]">{formatSeconds(resendAfter)}</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={resending || submitting}
              className="text-sm font-semibold text-[#7b19d8] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#ff84d1]"
            >
              {resending ? "Đang gửi lại mã..." : "Gửi lại mã"}
            </button>
          )}
        </div>

        <div className="mt-10 rounded-[1.5rem] bg-white/84 p-4 text-left shadow-[0_24px_60px_-40px_rgba(123,25,216,0.26)] backdrop-blur-xl dark:bg-white/8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d84a1] dark:text-[#c8b5e8]">
            {draft.withdrawalType === "internal" ? "Người nhận nội bộ" : "Tài khoản nhận tiền"}
          </p>
          <p className="mt-2 font-auth-headline text-lg font-bold text-[#2f2441] dark:text-white">
            {draft.bankName}
          </p>
          <p className="mt-1 text-sm text-[#7e7691] dark:text-[#c8b5e8]">
            {draft.accountHolder ? `${draft.accountHolder} • ` : ""}
            {draft.recipientAccountId ?? draft.accountNumber}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting || otpCode.length !== OTP_LENGTH || isExpired}
          className={`mt-10 flex w-full items-center justify-center rounded-full px-6 py-4 font-auth-headline text-lg font-bold text-white transition-transform active:scale-[0.99] ${
            submitting || otpCode.length !== OTP_LENGTH || isExpired
              ? "cursor-not-allowed bg-[#bfaed7] dark:bg-[#46355d]"
              : "bg-gradient-primary shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)]"
          }`}
        >
          {submitting ? "Đang xác nhận..." : confirmButtonLabel}
        </button>
      </main>
    </div>
  );
}
