import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, Eye, EyeOff, Gift, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { persistLockedAccountSnapshot } from "@/lib/account-lock";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

const signUpSchema = z
  .object({
    fullName: z.string().min(2, "Vui lòng nhập họ và tên"),
    email: z.string().email("Email không hợp lệ"),
    username: z
      .string()
      .trim()
      .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
      .regex(
        /^[a-zA-Z0-9._]+$/,
        "Tên đăng nhập chỉ được chứa chữ, số, dấu chấm hoặc gạch dưới"
      ),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string().min(6, "Vui lòng nhập lại mật khẩu"),
    referralCode: z.string().optional(),
    acceptTerms: z.boolean().refine((value) => value, {
      message: "Bạn cần đồng ý với điều khoản và chính sách để tiếp tục",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp",
  });

type SignUpFormValues = z.infer<typeof signUpSchema>;

const inputClassName =
  "w-full h-14 rounded-[1.75rem] border-0 bg-white px-5 text-[15px] text-[#2f2441] ring-1 ring-black/[0.06] shadow-[0_12px_30px_-20px_rgba(123,25,216,0.28)] outline-none transition-all placeholder:text-[#b9b0c9] focus:ring-[2.5px] focus:ring-[#7b19d8]/18";

export function SignupForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, loading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const referralCodeFromQuery = searchParams.get("ref")?.trim() ?? "";
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    defaultValues: {
      referralCode: referralCodeFromQuery,
    },
    resolver: zodResolver(signUpSchema),
  });

  useEffect(() => {
    if (!referralCodeFromQuery) {
      return;
    }

    setValue("referralCode", referralCodeFromQuery);
  }, [referralCodeFromQuery, setValue]);

  useEffect(() => {
    const googleError = searchParams.get("google_error");

    if (!googleError) {
      return;
    }

    if (googleError === "account_locked") {
      persistLockedAccountSnapshot({
        message:
          "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ để được kiểm tra.",
      });
      navigate("/account-locked", { replace: true });
      return;
    }

    if (googleError === "invalid_referral") {
      toast.error("Mã giới thiệu không hợp lệ. Vui lòng kiểm tra lại người mời.");
      return;
    }

    toast.error("Đăng ký Google không thành công. Vui lòng thử lại.");
  }, [navigate, searchParams]);

  const onSubmit = async ({
    fullName,
    email,
    username,
    password,
    referralCode,
  }: SignUpFormValues) => {
    const isSuccess = await signUp({
      fullName: fullName.trim(),
      email: email.trim(),
      username: username.trim(),
      password,
      referralCode: referralCode?.trim() || undefined,
    });

    if (isSuccess) {
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    }
  };

  const isBusy = isSubmitting || loading;
  const currentReferralCode = watch("referralCode");

  return (
    <div className="space-y-10">
      <div className="text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#7b19d8]/6 px-3 py-1 text-[#7b19d8]">
          <ShieldCheck className="size-4" />
          <span className="text-xs font-bold uppercase tracking-[0.18em]">
            Cơ hội kết nối không giới hạn
          </span>
        </div>

        <h3 className="mt-4 font-auth-headline text-4xl font-extrabold tracking-[-0.05em] text-[#2f2441] sm:text-5xl">
          Tạo tài khoản
        </h3>
        <p className="mt-3 text-lg leading-8 text-[#726a83]">
          Bắt đầu hành trình làm chủ kết nối và tương tác của bạn ngay hôm nay.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="fullName"
            className="ml-1 block text-sm font-semibold text-[#5f576f]"
          >
            Họ và tên
          </label>
          <input
            id="fullName"
            type="text"
            placeholder="Nhập tên đầy đủ của bạn"
            aria-invalid={Boolean(errors.fullName)}
            className={cn(
              inputClassName,
              errors.fullName &&
                "bg-[#fff7fb] ring-[1.5px] ring-[#efbfd7] focus:ring-[#d8589f]/18"
            )}
            {...register("fullName")}
          />
          {errors.fullName && (
            <p className="auth-field-error">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="ml-1 block text-sm font-semibold text-[#5f576f]"
          >
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              placeholder="email@vi-du.com"
              aria-invalid={Boolean(errors.email)}
              className={cn(
                inputClassName,
                "pr-14",
                errors.email &&
                  "bg-[#fff7fb] ring-[1.5px] ring-[#efbfd7] focus:ring-[#d8589f]/18"
              )}
              {...register("email")}
            />
            <Mail className="pointer-events-none absolute right-5 top-1/2 size-5 -translate-y-1/2 text-[#c0b7cf]" />
          </div>
          {errors.email && <p className="auth-field-error">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="ml-1 block text-sm font-semibold text-[#5f576f]"
          >
            Tên đăng nhập
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              placeholder="kiemtuongtac_user"
              aria-invalid={Boolean(errors.username)}
              className={cn(
                inputClassName,
                "pr-14",
                errors.username &&
                  "bg-[#fff7fb] ring-[1.5px] ring-[#efbfd7] focus:ring-[#d8589f]/18"
              )}
              {...register("username")}
            />
            <AtSign className="pointer-events-none absolute right-5 top-1/2 size-5 -translate-y-1/2 text-[#c0b7cf]" />
          </div>
          {errors.username && (
            <p className="auth-field-error">{errors.username.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="ml-1 block text-sm font-semibold text-[#5f576f]"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                aria-invalid={Boolean(errors.password)}
                className={cn(
                  inputClassName,
                  "pr-14",
                  errors.password &&
                    "bg-[#fff7fb] ring-[1.5px] ring-[#efbfd7] focus:ring-[#d8589f]/18"
                )}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b5aec1] transition-colors hover:text-[#7b19d8]"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="auth-field-error">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirmPassword"
              className="ml-1 block text-sm font-semibold text-[#5f576f]"
            >
              Nhập lại mật khẩu
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                aria-invalid={Boolean(errors.confirmPassword)}
                className={cn(
                  inputClassName,
                  "pr-14",
                  errors.confirmPassword &&
                    "bg-[#fff7fb] ring-[1.5px] ring-[#efbfd7] focus:ring-[#d8589f]/18"
                )}
                {...register("confirmPassword")}
              />
              <LockKeyhole className="pointer-events-none absolute right-5 top-1/2 size-5 -translate-y-1/2 text-[#c0b7cf]" />
            </div>
            {errors.confirmPassword && (
              <p className="auth-field-error">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <label
            htmlFor="referralCode"
            className="ml-1 block text-sm font-semibold text-[#5f576f]"
          >
            ID người mời (không bắt buộc)
          </label>
          <div className="relative">
            <input
              id="referralCode"
              type="text"
              placeholder="Ví dụ: 12345678"
              className={cn(inputClassName, "pr-14")}
              {...register("referralCode")}
            />
            <Gift className="pointer-events-none absolute right-5 top-1/2 size-5 -translate-y-1/2 text-[#d2a7f0]" />
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-[#726a83]">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 rounded-full border-[#d5cde3] text-[#7b19d8] accent-[#7b19d8] focus:ring-[#7b19d8]/20"
              {...register("acceptTerms")}
            />
            <span className="leading-6">
              Tôi đồng ý với <span className="font-semibold text-[#7b19d8]">Điều khoản dịch vụ</span> và{" "}
              <span className="font-semibold text-[#7b19d8]">Chính sách quyền riêng tư</span>.
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="auth-field-error">{errors.acceptTerms.message}</p>
          )}
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={isBusy}
            className="auth-premium-gradient auth-soft-shadow w-full rounded-[1.6rem] py-5 font-auth-headline text-lg font-bold text-white transition-all duration-300 hover:-translate-y-1 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBusy ? "Đang tạo tài khoản..." : "Đăng ký ngay"}
          </button>
        </div>
      </form>

      <div className="space-y-5">
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e8e0f3]"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-[0.22em]">
            <span className="bg-[#fbf9ff] px-4 font-semibold text-[#a89fb9]">
              Hoặc tiếp tục với
            </span>
          </div>
        </div>

        <GoogleAuthButton
          disabled={isBusy}
          label="Đăng ký với Google"
          referralCode={currentReferralCode?.trim() || undefined}
        />
      </div>

      <div className="border-t border-[#ebe4f5] pt-5 text-center">
        <p className="text-[#726a83]">
          Bạn đã có tài khoản?
          <Link
            to="/signin"
            className="ml-1 font-bold text-[#7b19d8] transition-all hover:underline hover:underline-offset-4"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
