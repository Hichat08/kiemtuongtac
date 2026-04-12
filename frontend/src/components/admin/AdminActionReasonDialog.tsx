import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AdminActionReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel: string;
  confirmClassName?: string;
  loading?: boolean;
  loadingLabel?: string;
  presets?: string[];
  placeholder?: string;
  required?: boolean;
}

export default function AdminActionReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onValueChange,
  onConfirm,
  confirmLabel,
  confirmClassName,
  loading = false,
  loadingLabel = "Đang xử lý...",
  presets = [],
  placeholder = "Nhập lý do xử lý để lưu vào log admin...",
  required = false,
}: AdminActionReasonDialogProps) {
  const trimmedValue = value.trim();
  const confirmDisabled = loading || (required && !trimmedValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[1.6rem] border-none bg-white p-0 shadow-[0_28px_70px_-40px_rgba(123,25,216,0.35)]">
        <div className="p-6 sm:p-7">
          <DialogHeader className="text-left">
            <DialogTitle className="font-auth-headline text-2xl font-bold text-[#2d2f32]">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-[#6f7283]">{description}</DialogDescription>
          </DialogHeader>

          {presets.length ? (
            <div className="mt-6 rounded-[1.35rem] bg-[#faf7ff] p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f96a4]">Gợi ý lý do</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onValueChange(preset)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#5868ff] ring-1 ring-[#e8deff] transition-colors hover:bg-[#eef1ff]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <Textarea
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            className="mt-5 min-h-36 rounded-[1.35rem] border-[#e8deff] bg-[#fcfbff] px-4 py-3 text-sm text-[#2d2f32] focus-visible:ring-[#d8c5ff]"
          />

          {required ? (
            <p className="mt-3 text-xs font-medium text-[#8a6f9f]">Lý do là bắt buộc để lưu vào lịch sử xử lý.</p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#f4f1fa] px-5 text-sm font-semibold text-[#5c6473] transition-colors hover:bg-[#ece7f6]"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={confirmDisabled}
              className={cn(
                "inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                confirmClassName
              )}
            >
              {loading ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
