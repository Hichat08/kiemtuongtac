import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { userService } from "@/services/userService";
import { ArrowLeft, Copy, RotateCcw, ShieldCheck } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { toast } from "sonner";

interface PinSettingsDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

export function PinSettingsDialog({ open, setOpen }: PinSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  const handleRegeneratePin = async () => {
    try {
      setLoading(true);
      const response = await userService.regenerateRegistrationPin();
      if (response?.pin) {
        setPin(response.pin);
        setExpiresIn(response.expiresIn);
        toast.success("Mã PIN mới đã được tạo thành công.");
      }
    } catch (error) {
      console.error("Lỗi khi tạo mã PIN mới:", error);
      toast.error("Không thể tạo mã PIN mới. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPin = async () => {
    if (!pin) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(pin);
        toast.success("Đã sao chép mã PIN.");
        return;
      }
    } catch (error) {
      console.error("Lỗi khi sao chép mã PIN:", error);
    }

    toast.info(`Mã PIN: ${pin}`);
  };

  const handleClose = () => {
    setOpen(false);
    setPin(null);
    setExpiresIn(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-40px)] max-w-md rounded-2xl border border-black/[0.08] bg-white p-6 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.34)] dark:border-white/[0.08] dark:bg-[#1a1028]">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-[#7b19d8] transition-opacity hover:opacity-80"
          >
            <ArrowLeft className="size-5" />
            <span className="font-semibold">Quay lại</span>
          </button>
        </div>

        <DialogTitle className="sr-only">Quản lý mã PIN</DialogTitle>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Quản lý mã PIN
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tạo một mã PIN mới để xác minh tài khoản của bạn. Giữ mã PIN này ở
              nơi an toàn.
            </p>
          </div>

          {pin ? (
            <div className="rounded-xl bg-[#f3edff] p-4 dark:bg-[#2a1a3d]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#7b19d8] uppercase tracking-widest">
                  Mã PIN mới
                </p>
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7b19d8] transition-opacity hover:opacity-80"
                >
                  <Copy className="size-3.5" />
                  Sao chép
                </button>
              </div>
              <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white tracking-[0.2em]">
                {pin}
              </p>
              {expiresIn && (
                <p className="mt-3 text-xs text-[#6f6591] dark:text-[#b7a5cc]">
                  Hết hạn sau {Math.floor(expiresIn / 60)} phút {expiresIn % 60}{" "}
                  giây
                </p>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleRegeneratePin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7b19d8] to-[#c73866] px-5 py-3 font-semibold text-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <RotateCcw className="size-4" />
            {loading ? "Đang tạo..." : "Tạo mã PIN mới"}
          </button>

          <div className="rounded-xl bg-[#eef1ff] p-4 dark:bg-[#1f1a3d]">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#5868ff]/20">
                <ShieldCheck className="size-4 text-[#5868ff]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  Lưu ý bảo mật
                </h3>
                <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                  Mã PIN này sẽ hết hạn sau 10 phút. Không chia sẻ mã PIN này
                  với bất kỳ ai.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
