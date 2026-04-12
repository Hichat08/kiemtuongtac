import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router";

export function ResetPasswordSuccess() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[#f7f4ff] font-auth-body text-[#2f2441]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.14),_transparent_58%)]" />
      <div className="pointer-events-none absolute left-[-4rem] top-52 h-48 w-48 rounded-full bg-[#d8cbff]/70 blur-3xl" />
      <div className="pointer-events-none absolute right-[-4rem] top-24 h-52 w-52 rounded-full bg-[#ffd3f2]/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-6 right-[-2rem] h-40 w-40 rounded-full bg-[#c7e5ff]/45 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center px-5 pt-5">
        <Link
          to="/signin"
          className="inline-flex size-10 items-center justify-center rounded-full bg-white/78 text-[#2f2441] shadow-[0_12px_30px_-24px_rgba(123,25,216,0.35)] backdrop-blur-xl transition-transform duration-200 active:scale-95"
          aria-label="Quay lại đăng nhập"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md flex-col justify-center px-7 py-12 text-center">
        <div className="mx-auto flex size-36 items-center justify-center rounded-full bg-[#efe5ff]/70 shadow-[0_24px_60px_-36px_rgba(123,25,216,0.32)]">
          <div className="flex size-28 items-center justify-center rounded-full border border-white/65 bg-[#f7efff]/70">
            <div className="flex size-20 items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_22px_46px_-24px_rgba(123,25,216,0.52)]">
              <Check className="size-10 stroke-[3]" />
            </div>
          </div>
        </div>

        <h1 className="mt-10 font-auth-headline text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.05em] text-[#2f2441]">
          Đổi mật khẩu thành công!
        </h1>

        <p className="mt-5 text-base leading-8 text-[#746c85]">
          Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập lại để
          tiếp tục sử dụng dịch vụ.
        </p>

        <div className="mt-16 space-y-4">
          <Link
            to="/signin"
            className="auth-premium-gradient auth-soft-shadow flex h-15 w-full items-center justify-center rounded-full px-5 font-auth-headline text-lg font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
          >
            Đăng nhập ngay
          </Link>

          <Link
            to="/"
            className="inline-flex justify-center text-base font-semibold text-[#7b19d8] transition-colors hover:text-[#5f22af]"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </main>
    </div>
  );
}
