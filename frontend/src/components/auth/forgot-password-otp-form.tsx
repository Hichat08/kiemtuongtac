import axios from "axios";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { authService } from "@/services/authService";

const OTP_LENGTH = 6;

const createEmptyOtp = () => Array.from({ length: OTP_LENGTH }, () => "");

const maskEmail = (email: string) => {
  const [name = "", domain = ""] = email.split("@");

  if (!name || !domain) {
    return email;
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

export function ForgotPasswordOtpForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const cooldownFromQuery = Number(searchParams.get("cooldown") ?? "59");
  const [otpValues, setOtpValues] = useState<string[]>(createEmptyOtp);
  const [countdown, setCountdown] = useState(
    Number.isFinite(cooldownFromQuery) ? Math.max(0, cooldownFromQuery) : 59
  );
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  const otpCode = otpValues.join("");

  const updateOtpAt = (index: number, value: string) => {
    setOtpValues((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const focusInput = (index: number) => {
    const target = inputRefs.current[index];
    target?.focus();
    target?.select();
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

  const handleResendCode = async () => {
    if (!email || countdown > 0 || loading) {
      return;
    }

    try {
      setLoading(true);
      const response = await authService.requestPasswordReset(email);
      setCountdown(Math.max(0, Number(response?.resendAfter) || 59));
      setOtpValues(createEmptyOtp());
      focusInput(0);
      toast.success("Mã OTP mới đã được gửi tới email của bạn.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể gửi lại mã OTP."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!email) {
      return;
    }

    if (otpCode.length !== OTP_LENGTH) {
      toast.error("Vui lòng nhập đủ 6 chữ số OTP.");
      return;
    }

    try {
      setLoading(true);
      const response = await authService.verifyPasswordResetCode(email, otpCode);
      const resetToken = response?.resetToken;

      if (!resetToken) {
        toast.error("Không lấy được phiên đặt lại mật khẩu.");
        return;
      }

      toast.success("Xác thực OTP thành công.");
      navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xác thực mã OTP."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#f7f4ff] font-auth-body text-[#2f2441]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)]" />
      <div className="pointer-events-none absolute left-[-5rem] bottom-6 h-48 w-48 rounded-full bg-[#d8cbff]/75 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5rem] top-24 h-56 w-56 rounded-full bg-[#ffd3f2]/65 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <Link
            to="/forgot-password"
            className="inline-flex size-10 items-center justify-center rounded-full bg-white/78 text-[#7b19d8] shadow-[0_12px_30px_-24px_rgba(123,25,216,0.5)] backdrop-blur-xl transition-transform duration-200 active:scale-95"
            aria-label="Quay lại quên mật khẩu"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <p className="text-lg font-bold tracking-tight text-[#5f22af]">Xác thực OTP</p>
        </div>
        <p className="font-auth-headline text-sm font-extrabold uppercase tracking-[0.24em] text-[#5f22af]">
          KTT
        </p>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-8 flex size-24 items-center justify-center rounded-full bg-white/90 shadow-[0_20px_50px_-30px_rgba(123,25,216,0.4)]">
            <KeyRound className="size-10 text-[#7b19d8]" />
          </div>

          <h1 className="font-auth-headline text-5xl font-extrabold tracking-[-0.05em] text-[#2f2441]">
            Mã xác nhận
          </h1>
          <p className="mt-4 max-w-sm text-base leading-8 text-[#736b84]">
            Vui lòng nhập mã xác nhận gồm <strong>6 chữ số</strong> đã được gửi tới email
            của bạn.
          </p>
          {email ? (
            <p className="mt-2 text-sm font-semibold text-[#7b19d8]">{maskEmail(email)}</p>
          ) : null}
        </div>

        <div className="space-y-8">
          <div className="flex justify-between gap-2 sm:gap-3">
            {otpValues.map((value, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                value={value}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                inputMode="numeric"
                maxLength={1}
                className="h-18 w-12 rounded-2xl border-none bg-white text-center font-auth-headline text-2xl font-bold text-[#7b19d8] shadow-[0_20px_38px_-26px_rgba(123,25,216,0.3)] outline-none ring-1 ring-black/[0.04] transition-all placeholder:text-[#b5aec1] focus:ring-2 focus:ring-[#7b19d8]/28 sm:h-20 sm:w-14"
                placeholder="·"
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2.5 text-center">
            <p className="text-sm font-medium text-[#726a83]">Không nhận được mã?</p>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading || countdown > 0}
              className="text-sm font-semibold text-[#3774ff] transition-opacity disabled:cursor-not-allowed disabled:opacity-55 sm:text-base"
            >
              {countdown > 0 ? `Gửi lại sau ${countdown}s` : "Gửi lại mã"}
            </button>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <button
            type="button"
            onClick={handleVerify}
            disabled={loading}
            className="auth-premium-gradient auth-soft-shadow h-15 w-full rounded-full px-6 font-auth-headline text-lg font-bold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Đang xác nhận..." : "Xác nhận"}
          </button>

          <Link
            to="/forgot-password"
            className="flex h-15 w-full items-center justify-center rounded-full bg-[#ede8f8] px-6 font-auth-headline text-lg font-bold text-[#5a4e73] transition-all duration-200 hover:bg-[#e6def5]"
          >
            Quay lại
          </Link>
        </div>

        <div className="mt-14 rounded-[1.75rem] bg-white/72 p-6 shadow-[0_24px_54px_-42px_rgba(123,25,216,0.22)] backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7b19d8]/10">
              <ShieldCheck className="size-5 text-[#7b19d8]" />
            </div>
            <div>
              <h2 className="font-auth-headline text-sm font-bold text-[#2f2441]">
                Bảo mật xác minh
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#726a83]">
                Chỉ sau khi OTP chính xác, bạn mới có thể tạo mật khẩu mới cho tài khoản.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
