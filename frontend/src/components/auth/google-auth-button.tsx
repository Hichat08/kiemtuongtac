import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="size-5"
    >
      <path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3C33.65 32.66 29.2 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.39-3.92Z"
      />
      <path
        fill="#FF3D00"
        d="M6.31 14.69 12.88 19.5C14.66 15.09 18.98 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4c-7.68 0-14.35 4.34-17.69 10.69Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.16 0 9.86-1.97 13.41-5.19l-6.19-5.24C29.14 35.09 26.67 36 24 36c-5.18 0-9.62-3.32-11.29-7.94l-6.52 5.02C9.5 39.56 16.21 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.61 20.08H42V20H24v8h11.3c-.79 2.24-2.23 4.18-4.09 5.57l.01-.01 6.19 5.24C36.97 39.2 44 34 44 24c0-1.34-.14-2.65-.39-3.92Z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  disabled?: boolean;
  label?: string;
  onAccessToken?: (accessToken: string) => Promise<void> | void;
  referralCode?: string;
}

export function GoogleAuthButton({
  disabled = false,
  label = "Tiếp tục với Google",
  referralCode,
}: GoogleAuthButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const handleClick = () => {
    const apiUrl = import.meta.env.VITE_API_URL?.trim() || "";

    if (!apiUrl) {
      toast.error("Thiếu VITE_API_URL ở frontend env.");
      return;
    }

    setIsPending(true);
    const params = new URLSearchParams();
    const normalizedReferralCode = referralCode?.trim();

    if (normalizedReferralCode) {
      params.set("ref", normalizedReferralCode);
    }

    const startUrl = params.toString()
      ? `${apiUrl}/auth/google/start?${params.toString()}`
      : `${apiUrl}/auth/google/start`;

    window.location.assign(startUrl);
  };

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      className="group relative flex h-15 w-full items-center justify-center rounded-full border border-[#ddd1ef] bg-white px-5 shadow-[0_20px_42px_-30px_rgba(123,25,216,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c7b1eb] hover:shadow-[0_24px_48px_-28px_rgba(123,25,216,0.36)] disabled:cursor-not-allowed disabled:opacity-70"
      onClick={handleClick}
    >
      <span className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#faf5ff] ring-1 ring-[#eadff7]">
          {isPending ? <Loader2 className="size-5 animate-spin text-[#7b19d8]" /> : <GoogleMark />}
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#2f2441]">
          {isPending ? "Đang chuyển sang Google..." : label}
        </span>
      </span>
    </button>
  );
}
