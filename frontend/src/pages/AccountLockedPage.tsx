import {
  clearLockedAccountSnapshot,
  persistLockedAccountSnapshot,
  readLockedAccountSnapshot,
} from "@/lib/account-lock";
import { getRoleHomePath } from "@/lib/role-routing";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_URL } from "@/lib/support";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Headset, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

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

export default function AccountLockedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken, refresh, fetchMe, user, clearState } = useAuthStore();
  const lockedSnapshot = useMemo(() => readLockedAccountSnapshot(), []);
  const [lockInfo, setLockInfo] = useState<{
    note?: string;
    lockedAt?: string | null;
  } | null>(null);
  const [connectingSupport, setConnectingSupport] = useState(false);
  const [restoringAccess, setRestoringAccess] = useState(false);

  useEffect(() => {
    const isLockedFromQuery = searchParams.get("lock");
    if (!isLockedFromQuery) {
      return;
    }

    const note = `${searchParams.get("note") ?? ""}`.trim();
    const lockedAt = searchParams.get("locked_at");
    const message = `${searchParams.get("message") ?? ""}`.trim();

    persistLockedAccountSnapshot({
      message:
        message ||
        "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ để được kiểm tra.",
      note,
      lockedAt: lockedAt || null,
    });
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const loadLockStatus = async () => {
      if (lockedSnapshot?.lockedAt || lockedSnapshot?.note) {
        return;
      }

      if (!user?._id) {
        return;
      }

      try {
        const status = await userService.getLockStatus();
        if (!active) {
          return;
        }

        setLockInfo({
          note: status.note ?? "",
          lockedAt: status.lockedAt ?? null,
        });
      } catch (error) {
        console.error("Không tải được trạng thái khóa", error);
      }
    };

    void loadLockStatus();

    return () => {
      active = false;
    };
  }, [lockedSnapshot?.lockedAt, lockedSnapshot?.note, user?._id]);

  useEffect(() => {
    let active = true;
    let checking = false;

    const restoreAccess = async () => {
      if (!active || checking) {
        return;
      }

      checking = true;
      setRestoringAccess(true);

      try {
        const status = await userService.getLockStatus();

        if (!active || status.status === "locked") {
          return;
        }

        await refresh();
        await fetchMe({ silent: true });

        if (!active) {
          return;
        }

        clearLockedAccountSnapshot();
        const nextRole = useAuthStore.getState().user?.role;
        navigate(getRoleHomePath(nextRole), { replace: true });
        toast.success("Tài khoản đã được mở khóa. Đang đưa bạn trở lại ứng dụng.");
      } catch (error) {
        if (active) {
          console.error("Không thể tự khôi phục quyền truy cập", error);
        }
      } finally {
        checking = false;
        if (active) {
          setRestoringAccess(false);
        }
      }
    };

    void restoreAccess();

    const intervalId = window.setInterval(() => {
      void restoreAccess();
    }, 10000);

    const handleWindowFocus = () => {
      void restoreAccess();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void restoreAccess();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchMe, navigate, refresh]);

  const handleOpenSupportChat = async () => {
    if (connectingSupport) {
      return;
    }

    setConnectingSupport(true);

    try {
      if (!accessToken) {
        await refresh();
      } else {
        await fetchMe({ silent: true });
      }
    } catch (error) {
      console.error("Không làm mới phiên để chat hỗ trợ", error);
      toast.info("Đang thử mở chat hỗ trợ bằng phiên hiện có.");
    } finally {
      setConnectingSupport(false);
    }

    navigate("/chat/support");
  };

  const resolvedNote =
    lockedSnapshot?.note ?? lockInfo?.note ?? user?.moderationNote ?? "";
  const message =
    lockedSnapshot?.message ||
    (resolvedNote
      ? `Tài khoản của bạn hiện đang bị khóa. ${resolvedNote}`
      : "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ để được kiểm tra.");
  const lockedAt = lockedSnapshot?.lockedAt ?? lockInfo?.lockedAt ?? user?.lockedAt ?? null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,157,196,0.2),transparent_28%),radial-gradient(circle_at_top_left,rgba(123,25,216,0.18),transparent_24%),#f7f1ff] px-6 py-10 font-auth-body text-[#2d2f32]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2rem] bg-white/92 p-8 shadow-[0_30px_80px_-42px_rgba(123,25,216,0.3)] backdrop-blur-xl">
          <div className="flex size-16 items-center justify-center rounded-[1.4rem] bg-[#fff1f3] text-[#d4525d] shadow-[0_24px_45px_-32px_rgba(212,82,93,0.45)]">
            <LockKeyhole className="size-8" />
          </div>

          <p className="mt-6 inline-flex rounded-full bg-[#fff1f3] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d4525d]">
            Tài khoản tạm khóa
          </p>
          <h1 className="mt-4 font-auth-headline text-[2.3rem] font-black leading-[1.05] tracking-[-0.06em] text-[#2f2441]">
            Bạn chưa thể tiếp tục sử dụng ứng dụng lúc này
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#6d647f]">{message}</p>

          <div className="mt-6 rounded-[1.5rem] bg-[#faf7ff] p-5">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex size-10 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                <ShieldAlert className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Thời điểm khóa</p>
                <p className="mt-2 text-sm font-bold text-[#2d2f32]">{formatDateTime(lockedAt)}</p>
                <p className="mt-3 text-sm leading-7 text-[#6d647f]">
                  Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ đội ngũ hỗ trợ để được kiểm tra thủ công.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={handleOpenSupportChat}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-4 font-auth-headline text-base font-bold text-white shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)] transition-transform active:scale-[0.99] disabled:opacity-70"
              disabled={connectingSupport}
            >
              <Headset className="size-4.5" />
              {connectingSupport ? "Đang kết nối..." : "Chat trực tiếp với hỗ trợ"}
            </button>
            <a
              href={SUPPORT_MAILTO_URL}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-6 py-4 font-auth-headline text-base font-bold text-white shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)] transition-transform active:scale-[0.99]"
            >
              <Mail className="size-4.5" />
              Liên hệ hỗ trợ qua email
            </a>
            <button
              type="button"
              onClick={() => {
                clearLockedAccountSnapshot();
                clearState();
                navigate("/signin", { replace: true });
              }}
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-4 font-auth-headline text-base font-bold text-[#6e6584] shadow-[0_18px_36px_-30px_rgba(123,25,216,0.24)] ring-1 ring-black/[0.04] transition-transform active:scale-[0.99]"
            >
              Quay lại đăng nhập
            </button>
          </div>

          <p className="mt-5 text-center text-xs leading-6 text-[#8d84a1]">
            Email hỗ trợ hiện tại: <span className="font-semibold text-[#5f5671]">{SUPPORT_EMAIL}</span>
          </p>
          <p className="mt-2 text-center text-xs leading-6 text-[#8d84a1]">
            {restoringAccess
              ? "Đang kiểm tra trạng thái mở khóa..."
              : "Trang này sẽ tự kiểm tra lại sau khi admin mở khóa tài khoản."}
          </p>
        </div>
      </div>
    </div>
  );
}
