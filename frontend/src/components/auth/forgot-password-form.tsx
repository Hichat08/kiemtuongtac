import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";

const forgotPasswordSchema = z.object({
  email: z.string().email("Nhập địa chỉ email hợp lệ"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const inputClassName =
  "w-full rounded-2xl border border-black/[0.05] bg-[#f5f2fb] py-4 pl-12 pr-4 text-[15px] text-[#2f2441] shadow-[0_12px_30px_-25px_rgba(123,25,216,0.24)] outline-none transition-all placeholder:text-[#aea6be] focus:border-[#7b19d8]/30 focus:bg-white focus:ring-4 focus:ring-[#7b19d8]/8";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const [submittedEmail, setSubmittedEmail] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async ({ email }: ForgotPasswordValues) => {
    try {
      const normalizedEmail = email.trim();
      const response = await authService.requestPasswordReset(normalizedEmail);
      const resendAfter = Number(response?.resendAfter) || 59;
      setSubmittedEmail(normalizedEmail);
      toast.success("Mã OTP đã được gửi. Vui lòng kiểm tra email của bạn.");
      navigate(
        `/forgot-password/verify?email=${encodeURIComponent(normalizedEmail)}&cooldown=${Math.max(
          0,
          resendAfter
        )}`
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể gửi yêu cầu khôi phục mật khẩu.")
      );
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#f7f4ff] font-auth-body text-[#2f2441]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)]" />
      <div className="pointer-events-none absolute left-[-5rem] top-44 h-44 w-44 rounded-full bg-[#d8cbff]/85 blur-3xl" />
      <div className="pointer-events-none absolute right-[-4rem] bottom-16 h-52 w-52 rounded-full bg-[#ffd3f2]/70 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center gap-3 px-5 pt-5">
        <Link
          to="/signin"
          className="inline-flex size-10 items-center justify-center rounded-full bg-white/78 text-[#7b19d8] shadow-[0_12px_30px_-24px_rgba(123,25,216,0.5)] backdrop-blur-xl transition-transform duration-200 active:scale-95"
          aria-label="Quay lại đăng nhập"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <p className="text-lg font-bold tracking-tight text-[#5f22af]">Reset Password</p>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-10">
          <div className="mb-8 flex size-20 items-center justify-center rounded-[2rem] bg-gradient-primary text-white shadow-[0_18px_46px_-22px_rgba(123,25,216,0.45)]">
            <KeyRound className="size-9" />
          </div>

          <h1 className="font-auth-headline text-5xl font-extrabold tracking-[-0.05em] text-[#2f2441]">
            Quên mật khẩu
          </h1>
          <p className="mt-4 text-base leading-8 text-[#736b84]">
            Nhập địa chỉ email liên kết với tài khoản của bạn để nhận hướng dẫn
            khôi phục mật khẩu.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 rounded-[2rem] bg-white/88 p-5 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 ml-1 block text-sm font-semibold text-[#655d74]"
            >
              Địa chỉ Email
            </label>
            <div className="group relative">
              <input
                id="email"
                type="email"
                placeholder="Nhập email của bạn"
                aria-invalid={Boolean(errors.email)}
                className={cn(
                  inputClassName,
                  errors.email &&
                    "border-[#f0bfd8] bg-[#fff7fb] focus:border-[#d8589f]/40 focus:ring-[#d8589f]/10"
                )}
                {...register("email")}
              />
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#aea6be] transition-colors group-focus-within:text-[#7b19d8]" />
            </div>
            {errors.email && (
              <p className="auth-field-error mt-2">{errors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="auth-premium-gradient auth-soft-shadow h-15 w-full rounded-full px-5 font-auth-headline text-lg font-bold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>

          {submittedEmail ? (
            <div className="rounded-[1.5rem] bg-[#f4efff] px-4 py-3 text-sm leading-7 text-[#6e5f8f]">
              Mã OTP khôi phục đã được tạo cho <strong>{submittedEmail}</strong>. App sẽ
              chuyển bạn sang bước xác thực mã ngay sau khi gửi thành công.
            </div>
          ) : null}

          <div className="pt-1 text-center">
            <Link
              to="/signin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#3774ff] transition-all hover:-translate-x-0.5"
            >
              <ArrowLeft className="size-4" />
              Quay lại Đăng nhập
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
