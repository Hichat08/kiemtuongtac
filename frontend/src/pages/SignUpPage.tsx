import { Gift, ShieldCheck, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router";

import { SignupForm } from "@/components/auth/signup-form";
import { AuthWordmark } from "@/components/auth/auth-wordmark";

const SignUpPage = () => {
  const [searchParams] = useSearchParams();

  return (
    <div className="font-auth-body min-h-svh bg-[#fbf9ff] text-[#2f2441] selection:bg-[#7b19d8]/15">
      <main className="flex min-h-screen flex-col md:flex-row">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#7b19d8_0%,#a93bf0_45%,#ff66c7_100%)] p-12 md:flex md:w-5/12 lg:w-1/2 md:flex-col md:justify-between">
          <div className="relative z-10">
            <AuthWordmark inverted to="/signup" />
          </div>

          <div className="relative z-10 mt-12">
            <h2 className="font-auth-headline text-5xl font-extrabold leading-none tracking-tight text-white lg:text-7xl">
              Nơi kết nối
              <br />
              bắt đầu từ
              <br />
              cá tính.
            </h2>
            <p className="mt-8 max-w-[34rem] text-xl font-medium text-white/80">
              Gia nhập Kiếm Tương Tác để trò chuyện, kết bạn và quản lý toàn bộ
              tương tác trong một không gian nhất quán với màu sắc của app.
            </p>
          </div>

          <div className="relative z-10 flex gap-6">
            <div className="rounded-2xl border border-white/12 bg-white/10 p-5 backdrop-blur-md">
              <p className="font-auth-headline text-2xl font-bold text-white">
                Realtime
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                Đồng bộ tức thì
              </p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/10 p-5 backdrop-blur-md">
              <p className="font-auth-headline text-2xl font-bold text-white">
                Private
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                Riêng tư mặc định
              </p>
            </div>
          </div>

          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_32%)]"></div>
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.12),_transparent_30%)]"></div>
        </section>

        <section className="flex flex-1 items-center justify-center bg-[#fbf9ff] px-4 py-6 min-[380px]:p-6 md:p-12 lg:p-20">
          <div className="w-full max-w-lg">
            <div className="mb-10 flex items-center gap-3 md:hidden">
              <AuthWordmark compact to="/signup" />
            </div>

            <SignupForm
              nextPath={searchParams.get("next")?.trim() ?? undefined}
            />
          </div>
        </section>
      </main>

      <div className="auth-glass fixed bottom-12 left-12 z-20 hidden items-center gap-4 rounded-2xl p-6 shadow-[0_16px_40px_-28px_rgba(123,25,216,0.38)] lg:flex">
        <div className="grid size-12 place-items-center rounded-xl bg-[#f4e6ff] shadow-inner">
          <Gift className="size-6 text-[#7b19d8]" />
        </div>
        <div>
          <p className="font-auth-headline text-sm font-bold text-[#2f2441]">
            Hồ sơ đang chờ kích hoạt
          </p>
          <p className="text-xs text-[#726a83]">
            Hoàn tất đăng ký để bắt đầu kết nối và cá nhân hóa tài khoản.
          </p>
        </div>
      </div>

      <div className="pointer-events-none fixed right-12 top-20 hidden opacity-[0.08] lg:block">
        <Sparkles className="size-56 text-white" />
      </div>
      <div className="pointer-events-none fixed bottom-24 right-10 hidden opacity-[0.07] lg:block">
        <ShieldCheck className="size-64 text-[#7b19d8]" />
      </div>
    </div>
  );
};

export default SignUpPage;
