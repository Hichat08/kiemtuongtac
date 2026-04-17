import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { getRoleHomePath } from "@/lib/role-routing";
import { useAuthStore } from "@/stores/useAuthStore";

const REMEMBERED_CREDENTIAL_KEY = "kiem-tuong-tac-remembered-credential";

const getRememberedCredential = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(REMEMBERED_CREDENTIAL_KEY) ?? "";
};

const signInSchema = z.object({
  credential: z.string().min(3, "Nhập email hoặc tên đăng nhập hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  rememberMe: z.boolean().optional(),
});

type SignInFormValues = z.infer<typeof signInSchema>;

const inputClassName =
  "w-full rounded-xl border border-black/[0.06] bg-white px-5 py-4 text-[15px] text-[#2f2441] shadow-[0_12px_30px_-22px_rgba(123,25,216,0.28)] outline-none transition-all placeholder:text-[#b9b0c9] focus:border-[#7b19d8]/30 focus:ring-4 focus:ring-[#7b19d8]/8";

export function SigninForm() {
  const navigate = useNavigate();
  const { signIn, loading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const rememberedCredential = getRememberedCredential();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      credential: rememberedCredential,
      password: "",
      rememberMe: Boolean(rememberedCredential),
    },
  });

  const onSubmit = async ({
    credential,
    password,
    rememberMe,
  }: SignInFormValues) => {
    const normalizedCredential = credential.trim();

    if (rememberMe) {
      localStorage.setItem(REMEMBERED_CREDENTIAL_KEY, normalizedCredential);
    } else {
      localStorage.removeItem(REMEMBERED_CREDENTIAL_KEY);
    }

    const isSuccess = await signIn(normalizedCredential, password);

    if (isSuccess) {
      navigate(getRoleHomePath(useAuthStore.getState().user?.role), {
        replace: true,
      });
    }
  };

  const isBusy = isSubmitting || loading;

  return (
    <div className="space-y-8">
      <div className="text-center md:text-left">
        <h2 className="font-auth-headline text-4xl font-extrabold tracking-[-0.05em] text-[#2f2441] sm:text-5xl">
          Chào mừng trở lại
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-[#726a83] sm:text-lg">
          Tiếp tục hành trình của bạn cùng Kiếm Tương Tác.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label
            htmlFor="credential"
            className="mb-2 ml-1 block text-sm font-semibold text-[#655d74]"
          >
            Email hoặc Tên đăng nhập
          </label>
          <div className="group relative">
            <input
              id="credential"
              type="text"
              placeholder="alex@kiemtuongtac.app"
              aria-invalid={Boolean(errors.credential)}
              className={cn(
                inputClassName,
                errors.credential &&
                  "border-[#f0bfd8] bg-[#fff7fb] focus:border-[#d8589f]/40 focus:ring-[#d8589f]/10",
              )}
              {...register("credential")}
            />
            <Mail className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#b5aec1] transition-colors group-focus-within:text-[#7b19d8]" />
          </div>
          {errors.credential && (
            <p className="auth-field-error mt-2">{errors.credential.message}</p>
          )}
        </div>

        <div>
          <div className="mb-2 ml-1 flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[#655d74]"
            >
              Mật khẩu
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-[#7b19d8] transition-colors hover:text-[#5c13a5]"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="group relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              className={cn(
                inputClassName,
                "pr-12",
                errors.password &&
                  "border-[#f0bfd8] bg-[#fff7fb] focus:border-[#d8589f]/40 focus:ring-[#d8589f]/10",
              )}
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b5aec1] transition-colors hover:text-[#7b19d8]"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
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

        <div className="flex items-center justify-between px-1">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-[#726a83]">
            <input
              type="checkbox"
              className="size-5 rounded-full border-[#d5cde3] text-[#7b19d8] accent-[#7b19d8] focus:ring-[#7b19d8]/20"
              {...register("rememberMe")}
            />
            Ghi nhớ đăng nhập
          </label>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isBusy}
            className="auth-premium-gradient auth-soft-shadow h-15 w-full rounded-full px-5 font-auth-headline text-lg font-bold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBusy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </div>
      </form>

      <div className="pt-2 text-center">
        <p className="text-[#726a83]">
          Chưa có tài khoản?
          <Link
            to="/signup"
            className="ml-1 font-bold text-[#7b19d8] transition-all hover:underline hover:underline-offset-4"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
