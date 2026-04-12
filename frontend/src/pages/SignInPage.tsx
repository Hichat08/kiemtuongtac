import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router";

import { SigninForm } from "@/components/auth/signin-form";
import { AuthWordmark } from "@/components/auth/auth-wordmark";

const SignInPage = () => {
  return (
    <div className="font-auth-body min-h-svh bg-[#f7f4ff] text-[#2f2441] selection:bg-[#7b19d8]/15">
      <header className="auth-glass fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/60 px-6">
        <AuthWordmark compact />
        <div className="hidden items-center gap-6 md:flex">
          <Link
            to="/signup"
            className="text-sm font-medium text-[#7a7189] transition-colors hover:text-[#7b19d8]"
          >
            Tạo tài khoản
          </Link>
          <span className="text-sm font-medium text-[#7a7189]">Bảo mật</span>
        </div>
      </header>

      <main className="flex min-h-svh flex-col items-stretch pt-16 md:flex-row">
        <div className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-[#f1ecf9] px-12 md:flex lg:px-24">
          <div className="relative z-10 max-w-lg">
            <span className="mb-6 inline-block rounded-full border border-[#d9c9f0] bg-[#efe4fb] px-4 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#6a2bc1]">
              Bảo mật tuyệt đối
            </span>
            <h1 className="font-auth-headline text-5xl font-extrabold leading-tight text-[#2f2441] lg:text-7xl">
              Nâng tầm trải nghiệm <span className="text-[#7b19d8] italic">xã hội</span> của bạn.
            </h1>
            <p className="mb-12 mt-8 max-w-[34rem] text-lg leading-relaxed text-[#716a82]">
              Truy cập mọi cuộc trò chuyện, theo dõi kết nối và điều phối tương tác
              của bạn trong một canvas gọn, rõ và sát mẫu hơn.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-xl border border-[#ece5f5] bg-white p-6 shadow-[0_18px_50px_-36px_rgba(123,25,216,0.35)]">
                <ShieldCheck className="mb-3 size-8 text-[#7b19d8]" />
                <h3 className="font-auth-headline font-bold text-[#2f2441]">Mã hóa</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#716a82]">
                  Bảo vệ cấp cao cho đăng nhập, phiên làm việc và dữ liệu tài khoản.
                </p>
              </div>
              <div className="rounded-xl border border-[#ece5f5] bg-white p-6 shadow-[0_18px_50px_-36px_rgba(123,25,216,0.3)]">
                <Zap className="mb-3 size-8 text-[#ff66c7]" />
                <h3 className="font-auth-headline font-bold text-[#2f2441]">Tăng tốc</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#716a82]">
                  Đăng nhập nhanh bằng email hoặc username, không phải nhớ thêm flow khác.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#7b19d8]/12 blur-[100px]"></div>
          <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-[#ff66c7]/10 blur-[80px]"></div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center bg-[#f7f4ff] px-4 py-10 min-[380px]:px-6 min-[380px]:py-12 md:py-0">
          <div className="relative z-10 w-full max-w-[34rem] space-y-8">
            <SigninForm />
          </div>
        </div>
      </main>

      <div className="pointer-events-none fixed right-10 top-24 hidden opacity-[0.05] lg:block">
        <Sparkles className="size-60 text-[#7b19d8]" />
      </div>
      <div className="pointer-events-none fixed bottom-20 left-10 hidden opacity-[0.05] lg:block">
        <ShieldCheck className="size-72 text-[#ff66c7]" />
      </div>
    </div>
  );
};

export default SignInPage;
