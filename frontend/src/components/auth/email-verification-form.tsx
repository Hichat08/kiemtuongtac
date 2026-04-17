import { ArrowLeft, ShieldCheck } from "lucide-react";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { getRoleHomePath } from "@/lib/role-routing";
import { useAuthStore } from "@/stores/useAuthStore";

const OTP_LENGTH = 6;

const createEmptyOtp = () => Array.from({ length: OTP_LENGTH }, () => "");

const maskEmail = (email: string) => {
  const [name = "", domain = ""] = email.split("@");

  if (!name || !domain) {
    return email;
  }

  const visibleName =
    name.length <= 2 ? `${name[0] ?? ""}*` : `${name.slice(0, 2)}***`;
  return `${visibleName}@${domain}`;
};

export function EmailVerificationForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { requestSignUpCode, verifyEmail, loading } = useAuthStore();
  const email = searchParams.get("email")?.trim() ?? "";
  const [otpValues, setOtpValues] = useState<string[]>(createEmptyOtp);
  const [countdown, setCountdown] = useState(59);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) {
      navigate("/signin", { replace: true });
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

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
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
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

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
    if (!email || countdown > 0) {
      return;
    }

    const isSuccess = await requestSignUpCode(email);

    if (isSuccess) {
      setCountdown(59);
      setOtpValues(createEmptyOtp());
      focusInput(0);
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

    const isSuccess = await verifyEmail(email, otpCode);

    if (isSuccess) {
      navigate(getRoleHomePath(useAuthStore.getState().user?.role), {
        replace: true,
      });
    }
  };

  return (
    <div className="font-auth-body relative min-h-svh overflow-hidden bg-[#f7f4ff] text-[#2f2441]">
      <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full bg-[#7b19d8]/14 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[#ff66c7]/12 blur-[110px]" />

      <header className="relative z-10 flex items-center px-6 py-5">
        <Link
          to="/signin"
          className="inline-flex items-center gap-3 text-[#7b19d8] transition-opacity hover:opacity-80"
        >
          <ArrowLeft className="size-5" />
          <span className="font-auth-headline text-xl font-bold tracking-[-0.03em]">
            Kiếm Tương Tác
          </span>
        </Link>
      </header>

      <main className="relative z-10 flex min-h-[calc(100svh-88px)] items-center justify-center px-6 pb-10 pt-6">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h1 className="font-auth-headline text-4xl font-extrabold tracking-[-0.05em] text-[#2f2441]">
              Xác thực tài khoản
            </h1>
            <p className="mt-4 text-[15px] font-medium leading-7 text-[#726a83]">
              Nhập mã PIN 6 chữ số mà bạn nhận được khi đăng ký để kích hoạt tài
              khoản.
            </p>
            {email ? (
              <p className="mt-2 text-sm font-semibold text-[#7b19d8]">
                {maskEmail(email)}
              </p>
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
                  className="h-18 w-12 rounded-xl border-none bg-white text-center font-auth-headline text-2xl font-bold text-[#7b19d8] shadow-[0_18px_32px_-24px_rgba(123,25,216,0.28)] outline-none ring-1 ring-black/[0.04] transition-all placeholder:text-[#b5aec1] focus:ring-2 focus:ring-[#7b19d8]/28 sm:h-20 sm:w-14"
                  placeholder="·"
                />
              ))}
            </div>

            <div className="space-y-6">
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading}
                className="auth-premium-gradient auth-soft-shadow w-full rounded-full px-6 py-4 font-auth-headline text-lg font-bold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Đang xác nhận..." : "Xác nhận ngay"}
              </button>

              <div className="text-center text-sm font-medium text-[#726a83]">
                Quên mã PIN?
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading || countdown > 0}
                  className="ml-1 font-semibold text-[#7b19d8] transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {countdown > 0
                    ? `Tạo mã mới sau ${countdown}s`
                    : "Tạo mã mới"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-16 rounded-[1.75rem] bg-white/70 p-6 shadow-[0_24px_54px_-42px_rgba(123,25,216,0.22)] backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7b19d8]/10">
                <ShieldCheck className="size-5 text-[#7b19d8]" />
              </div>
              <div>
                <h2 className="font-auth-headline text-sm font-bold text-[#2f2441]">
                  Bảo mật tài khoản
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#726a83]">
                  Mã PIN giúp bảo vệ tài khoản của bạn khỏi những truy cập trái
                  phép.
                </p>
              </div>
            </div>
          </div>

          <footer className="pt-14 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 shadow-[0_12px_30px_-24px_rgba(123,25,216,0.26)] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#7b19d8]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#8b82a0]">
                Editorial Intelligence System
              </span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
