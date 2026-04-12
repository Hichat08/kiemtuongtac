import { useAuthStore } from "@/stores/useAuthStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle2,
  Facebook,
  Link2,
  Music2,
  Shield,
  Youtube,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface SocialLinksDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

type SocialPlatform = "facebook" | "tiktok" | "youtube";

type SocialAccountCard = {
  id: SocialPlatform;
  label: string;
  status: "linked" | "unlinked";
  icon: typeof Facebook;
  iconWrapClassName: string;
};

const providerMap: Record<SocialPlatform, string[]> = {
  facebook: ["facebook"],
  tiktok: ["tiktok"],
  youtube: ["youtube"],
};

const SocialLinksDialog = ({ open, setOpen }: SocialLinksDialogProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || user?.role !== "admin") {
      return;
    }

    setOpen(false);
    navigate("/admin");
  }, [navigate, open, setOpen, user?.role]);

  const socialCards = useMemo<SocialAccountCard[]>(() => {
    const providers = new Set((user?.authProviders ?? []).map((provider) => provider.toLowerCase()));

    return [
      {
        id: "facebook",
        label: "Facebook",
        status: providerMap.facebook.some((provider) => providers.has(provider)) ? "linked" : "unlinked",
        icon: Facebook,
        iconWrapClassName: "bg-[#e9f3ff] text-[#1877F2]",
      },
      {
        id: "tiktok",
        label: "TikTok",
        status: providerMap.tiktok.some((provider) => providers.has(provider)) ? "linked" : "unlinked",
        icon: Music2,
        iconWrapClassName: "bg-[#111827] text-white",
      },
      {
        id: "youtube",
        label: "YouTube",
        status: providerMap.youtube.some((provider) => providers.has(provider)) ? "linked" : "unlinked",
        icon: Youtube,
        iconWrapClassName: "bg-[#fff1f1] text-[#FF0000]",
      },
    ];
  }, [user?.authProviders]);

  if (user?.role === "admin") {
    return null;
  }

  const handleProviderAction = (card: SocialAccountCard) => {
    toast.info(
      card.status === "linked"
        ? `Luồng ngắt kết nối ${card.label} sẽ được bổ sung khi backend social account hoàn thiện.`
        : `Luồng kết nối ${card.label} sẽ được bổ sung khi backend social account hoàn thiện.`
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[#f6f6fa] p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Liên kết tài khoản</DialogTitle>

        <div className="min-h-dvh bg-[#f6f6fa] font-auth-body text-[#2d2f32]">
          <header className="sticky top-0 z-20 bg-[#f6f6fa]/90 backdrop-blur-xl">
            <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full text-[#7b19d8] transition-colors hover:bg-[#f3edff] active:scale-95"
                  aria-label="Quay lại"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <h1 className="font-auth-headline text-[1.15rem] font-bold tracking-tight text-[#7b19d8]">
                  Liên kết tài khoản
                </h1>
              </div>

              <Avatar className="size-8 bg-[#e1e2e8]">
                <AvatarImage
                  src={user?.avatarUrl}
                  alt={user?.displayName}
                />
                <AvatarFallback className="bg-[#dfe3e8] text-xs font-bold text-[#2d2f32]">
                  {user?.displayName?.charAt(0)?.toUpperCase() ?? "K"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="h-px bg-[#efe6f7]" />
          </header>

          <main className="mobile-page-shell pb-32 pt-5">
            <section className="mb-10">
              <div className="relative overflow-hidden rounded-[1.6rem] bg-white px-5 py-6 shadow-[0_20px_40px_-18px_rgba(123,25,216,0.12)]">
                <div className="relative z-10 max-w-sm">
                  <h2 className="font-auth-headline text-[2rem] font-extrabold leading-[1.08] tracking-[-0.05em] text-[#2d2f32]">
                    Tăng thu nhập từ{" "}
                    <span className="text-[#7b19d8]">Mạng xã hội</span>
                  </h2>
                  <p className="mt-4 text-[1rem] leading-8 text-[#5a5b5f]">
                    Kết nối tài khoản mạng xã hội để bắt đầu làm nhiệm vụ và nhận thưởng.
                    Chúng tôi cam kết bảo mật thông tin của bạn.
                  </p>
                </div>

                <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-[#ffd3f2]/42 blur-3xl" />
                <div className="pointer-events-none absolute bottom-6 right-6 text-[#7b19d8]/10">
                  <Link2 className="size-16" />
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <h3 className="pl-1 text-[0.82rem] font-semibold uppercase tracking-[0.22em] text-[#6b6d71]">
                Tài khoản khả dụng
              </h3>

              <div className="space-y-4">
                {socialCards.map((card) => {
                  const Icon = card.icon;
                  const linked = card.status === "linked";

                  return (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-[1.25rem] bg-white px-4 py-4 shadow-[0_18px_38px_-18px_rgba(123,25,216,0.12)]"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex size-14 items-center justify-center rounded-[1rem] ${card.iconWrapClassName}`}
                        >
                          <Icon className={card.id === "tiktok" ? "size-7" : "size-8"} />
                        </div>

                        <div>
                          <h4 className="font-auth-headline text-[1.3rem] font-bold tracking-[-0.03em] text-[#2d2f32]">
                            {card.label}
                          </h4>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            {linked ? (
                              <>
                                <CheckCircle2 className="size-4 text-[#7b19d8]" />
                                <span className="text-sm font-medium text-[#7b19d8]">
                                  Đã kết nối
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="size-4 rounded-full border border-[#75777a]" />
                                <span className="text-sm font-medium text-[#5a5b5f]">
                                  Chưa kết nối
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleProviderAction(card)}
                        className={
                          linked
                            ? "h-11 rounded-full bg-[#f3edff] px-5 text-sm font-bold text-[#7b19d8] shadow-none hover:bg-[#eadbfd]"
                            : "h-11 rounded-full bg-gradient-primary px-7 text-sm font-bold text-white shadow-[0_18px_36px_-20px_rgba(123,25,216,0.32)] hover:opacity-95"
                        }
                      >
                        {linked ? "Ngắt kết nối" : "Kết nối"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-12 flex flex-col items-center justify-center space-y-3 px-5 text-center opacity-70">
              <Shield className="size-8 text-[#6b6d71]" />
              <p className="text-xs leading-5 text-[#6b6d71]">
                Mọi thông tin kết nối đều được mã hóa 256-bit. Kiếm Tương Tác không có
                quyền truy cập mật khẩu hoặc đăng bài dưới tên bạn.
              </p>
            </section>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SocialLinksDialog;
