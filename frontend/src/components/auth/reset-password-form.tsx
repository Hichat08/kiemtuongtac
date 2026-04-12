import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Mật khẩu mới phải có ít nhất 6 ký tự"),
    confirmPassword: z.string().min(6, "Nhập lại mật khẩu mới"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const inputClassName =
  "w-full rounded-2xl border border-black/[0.05] bg-[#f5f2fb] px-5 py-4 text-[15px] text-[#2f2441] shadow-[0_12px_30px_-25px_rgba(123,25,216,0.24)] outline-none transition-all placeholder:text-[#aea6be] focus:border-[#7b19d8]/30 focus:bg-white focus:ring-4 focus:ring-[#7b19d8]/8";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async ({ password }: ResetPasswordValues) => {
    try {
      await authService.resetPassword(token, password);
      navigate("/reset-password/success", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể cập nhật mật khẩu."));
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#f7f4ff] font-auth-body text-[#2f2441]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)]" />
      <div className="pointer-events-none absolute left-[-4rem] top-48 h-44 w-44 rounded-full bg-[#d8cbff]/85 blur-3xl" />
      <div className="pointer-events-none absolute right-[-4rem] top-24 h-52 w-52 rounded-full bg-[#ffd3f2]/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 right-[-3rem] h-40 w-40 rounded-full bg-[#c7e5ff]/50 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <Link
            to="/signin"
            className="inline-flex size-10 items-center justify-center rounded-full bg-white/78 text-[#7b19d8] shadow-[0_12px_30px_-24px_rgba(123,25,216,0.5)] backdrop-blur-xl transition-transform duration-200 active:scale-95"
            aria-label="Quay lại đăng nhập"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <p className="text-lg font-bold tracking-tight text-[#5f22af]">Đặt mật khẩu mới</p>
        </div>
        <p className="font-auth-headline text-sm font-extrabold uppercase tracking-[0.24em] text-[#5f22af]">
          KTT
        </p>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-8 flex size-24 items-center justify-center rounded-full bg-white/90 shadow-[0_20px_50px_-30px_rgba(123,25,216,0.4)]">
            <LockKeyhole className="size-10 text-[#7b19d8]" />
          </div>

          <h1 className="font-auth-headline text-5xl font-extrabold tracking-[-0.05em] text-[#2f2441]">
            Mật khẩu mới
          </h1>
          <p className="mt-4 max-w-sm text-base leading-8 text-[#736b84]">
            Thiết lập mật khẩu mới để bảo vệ tài khoản của bạn và tiếp tục đăng nhập
            vào Kiếm Tương Tác.
          </p>
        </div>

        {token ? (
          <>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6 rounded-[2rem] bg-white/88 p-5 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl"
            >
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 ml-1 block text-sm font-semibold text-[#655d74]"
                >
                  Mật khẩu mới
                </label>
                <div className="group relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tạo mật khẩu mới"
                    aria-invalid={Boolean(errors.password)}
                    className={cn(
                      inputClassName,
                      "pr-12",
                      errors.password &&
                        "border-[#f0bfd8] bg-[#fff7fb] focus:border-[#d8589f]/40 focus:ring-[#d8589f]/10"
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#aea6be] transition-colors hover:text-[#7b19d8]"
                    aria-label={showPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="auth-field-error mt-2">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 ml-1 block text-sm font-semibold text-[#655d74]"
                >
                  Nhập lại mật khẩu
                </label>
                <div className="group relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu mới"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    className={cn(
                      inputClassName,
                      "pr-12",
                      errors.confirmPassword &&
                        "border-[#f0bfd8] bg-[#fff7fb] focus:border-[#d8589f]/40 focus:ring-[#d8589f]/10"
                    )}
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#aea6be] transition-colors hover:text-[#7b19d8]"
                    aria-label={
                      showConfirmPassword
                        ? "Ẩn nhập lại mật khẩu"
                        : "Hiện nhập lại mật khẩu"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="auth-field-error mt-2">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="auth-premium-gradient auth-soft-shadow h-15 w-full rounded-full px-5 font-auth-headline text-lg font-bold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
              </button>

              <Link
                to="/signin"
                className="flex h-15 w-full items-center justify-center rounded-full bg-[#ede8f8] px-5 font-auth-headline text-lg font-bold text-[#5a4e73] transition-all duration-200 hover:bg-[#e6def5]"
              >
                Quay lại đăng nhập
              </Link>
            </form>

            <div className="mt-14 rounded-[1.75rem] bg-white/72 p-6 shadow-[0_24px_54px_-42px_rgba(123,25,216,0.22)] backdrop-blur-md">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7b19d8]/10">
                  <ShieldCheck className="size-5 text-[#7b19d8]" />
                </div>
                <div>
                  <h2 className="font-auth-headline text-sm font-bold text-[#2f2441]">
                    Gợi ý bảo mật
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#726a83]">
                    Nên dùng mật khẩu có chữ hoa, chữ thường, số và ký tự đặc biệt để
                    bảo vệ tài khoản tốt hơn.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-5 rounded-[2rem] bg-white/88 p-5 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl">
            <div className="flex items-center gap-3 rounded-[1.5rem] bg-[#f4efff] px-4 py-3 text-[#6e5f8f]">
              <KeyRound className="size-5 text-[#7b19d8]" />
              <p className="text-sm leading-7">
                Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
              </p>
            </div>

            <Link
              to="/forgot-password"
              className="auth-premium-gradient auth-soft-shadow flex h-15 w-full items-center justify-center rounded-full px-5 font-auth-headline text-lg font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
            >
              Yêu cầu mã mới
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
