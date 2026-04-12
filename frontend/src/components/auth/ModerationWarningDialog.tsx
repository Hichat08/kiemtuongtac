import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/useAuthStore";
import { ShieldAlert, TriangleAlert, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value))
    : "Đang cập nhật";

export default function ModerationWarningDialog() {
  const { accessToken, user } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const warningVersion = useMemo(() => {
    if (!accessToken || !user || user.role === "admin" || user.moderationStatus !== "warned") {
      return "";
    }

    return `${user.lastWarnedAt ?? ""}:${user.warningCount ?? 0}:${user.moderationNote ?? ""}`;
  }, [accessToken, user]);

  useEffect(() => {
    if (!warningVersion) {
      setOpen(false);
      return;
    }

    if (pathname.startsWith("/chat/support") || pathname === "/account-locked") {
      setOpen(false);
      return;
    }

    setOpen(true);
  }, [pathname, warningVersion]);

  if (!warningVersion || !user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[22rem] rounded-[1.15rem] border-none bg-white p-0 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.35)] sm:max-w-md sm:rounded-[1.4rem] lg:max-w-lg">
        <div className="p-3.5 sm:p-5">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-3 pr-8 sm:gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-[#fff7ea] text-[#c97a12] sm:size-11 sm:rounded-[1rem]">
                <TriangleAlert className="size-[1.125rem] sm:size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-auth-headline text-lg leading-tight font-black tracking-[-0.04em] text-[#2d2f32] sm:text-[1.45rem]">
                  Cảnh cáo hệ thống
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] leading-5 text-[#6f7283] sm:text-sm sm:leading-6">
                  Cảnh báo này sẽ tự hiện lại cho tới khi admin gỡ bỏ.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-3.5 rounded-[1rem] bg-[#faf7ff] p-3.5 sm:mt-4 sm:rounded-[1.15rem] sm:p-4">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8] sm:size-9">
                <ShieldAlert className="size-4 sm:size-[1.125rem]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8f96a4] sm:text-[10px]">
                  Nội dung cảnh cáo
                </p>
                <p className="mt-1 text-[13px] leading-5 font-medium text-[#2d2f32] line-clamp-4 sm:mt-1.5 sm:text-sm sm:leading-6 sm:line-clamp-none">
                  {user.moderationNote || "Tài khoản của bạn đang được admin cảnh cáo và theo dõi thêm."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-2.5">
            <div className="rounded-[0.95rem] bg-[#fffaf0] px-3 py-3 sm:rounded-[1rem] sm:px-3.5 sm:py-3.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#c97a12] sm:text-[10px]">
                Số lần cảnh cáo
              </p>
              <p className="mt-1 font-auth-headline text-lg font-black text-[#2d2f32] sm:mt-1.5 sm:text-xl">
                {new Intl.NumberFormat("vi-VN").format(user.warningCount ?? 1)}
              </p>
            </div>
            <div className="rounded-[0.95rem] bg-[#f5f1ff] px-3 py-3 sm:rounded-[1rem] sm:px-3.5 sm:py-3.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7b19d8] sm:text-[10px]">
                Cập nhật gần nhất
              </p>
              <p className="mt-1 text-[12px] font-bold leading-5 text-[#2d2f32] sm:mt-1.5 sm:text-[13px] sm:leading-5">
                {formatDateTime(user.lastWarnedAt)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[0.95rem] bg-[#f4f1fa] px-3 text-[13px] font-semibold text-[#5c6473] transition-colors hover:bg-[#ece7f6] sm:h-11 sm:w-auto sm:rounded-[1rem] sm:px-4"
            >
              <XCircle className="size-3.5 sm:size-4" />
              Đóng cảnh báo
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/chat/support");
              }}
              className="inline-flex h-10 w-full items-center justify-center rounded-[0.95rem] bg-gradient-primary px-3 text-[13px] font-bold text-white transition-opacity hover:opacity-95 sm:h-11 sm:w-auto sm:rounded-[1rem] sm:px-4"
            >
              Liên hệ hỗ trợ
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
