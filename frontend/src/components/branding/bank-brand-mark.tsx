import { findSupportedBank } from "@/lib/bank-catalog";
import { cn } from "@/lib/utils";

interface BankBrandMarkProps {
  bankCode?: string;
  bankName?: string;
  className?: string;
  compact?: boolean;
}

const textSizes = {
  title: {
    compact: "text-sm",
    regular: "text-[1.05rem]",
  },
  subtitle: {
    compact: "text-[10px]",
    regular: "text-[11px]",
  },
} as const;

function VietcombankMark({ compact }: { compact: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-3 overflow-hidden rounded-[1.15rem] border border-[#d8f2e5] bg-[linear-gradient(135deg,#ffffff,#ecfff5)] px-4">
      <div className="absolute -right-6 -top-6 size-16 rounded-full bg-[#27c77a]/18 blur-2xl" />
      <div className="absolute -left-5 bottom-0 size-14 rounded-full bg-[#7af4bb]/16 blur-2xl" />

      <svg
        viewBox="0 0 64 64"
        className={cn("shrink-0 drop-shadow-[0_8px_18px_rgba(20,132,82,0.22)]", compact ? "size-9" : "size-10")}
        aria-hidden="true"
      >
        <path
          d="M32 4 60 32 32 60 4 32Z"
          fill="#19b866"
        />
        <path
          d="M18 30 32 17l14 13-14 17Z"
          fill="#ffffff"
          opacity="0.94"
        />
      </svg>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-auth-headline font-extrabold tracking-[-0.03em] text-[#146845]",
            compact ? textSizes.title.compact : textSizes.title.regular
          )}
        >
          Vietcombank
        </p>
        <p
          className={cn(
            "mt-1 font-semibold uppercase tracking-[0.18em] text-[#5d9b7f]",
            compact ? textSizes.subtitle.compact : textSizes.subtitle.regular
          )}
        >
          VCB
        </p>
      </div>
    </div>
  );
}

function MbBankMark({ compact }: { compact: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-3 overflow-hidden rounded-[1.15rem] border border-[#dbe7ff] bg-[linear-gradient(135deg,#ffffff,#eef4ff)] px-4">
      <div className="absolute -right-5 -top-6 size-16 rounded-full bg-[#4173ff]/14 blur-2xl" />
      <div className="absolute -left-4 bottom-0 size-14 rounded-full bg-[#9ec0ff]/18 blur-2xl" />

      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-[1rem] bg-[#0a4ea1] shadow-[0_16px_30px_-20px_rgba(10,78,161,0.5)]",
          compact ? "h-10 w-12" : "h-11 w-14"
        )}
      >
        <svg
          viewBox="0 0 20 20"
          className="absolute left-1.5 top-1.5 size-3"
          aria-hidden="true"
        >
          <path
            d="m10 1.5 1.93 3.91 4.32.63-3.12 3.05.74 4.31L10 11.37 6.13 13.4l.74-4.31-3.12-3.05 4.32-.63Z"
            fill="#ffd451"
          />
        </svg>
        <span className="font-auth-headline text-lg font-extrabold tracking-[-0.05em] text-white">
          MB
        </span>
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-auth-headline font-extrabold tracking-[-0.03em] text-[#174593]",
            compact ? textSizes.title.compact : textSizes.title.regular
          )}
        >
          MB Bank
        </p>
        <p
          className={cn(
            "mt-1 font-semibold uppercase tracking-[0.18em] text-[#5c7fb8]",
            compact ? textSizes.subtitle.compact : textSizes.subtitle.regular
          )}
        >
          MBB
        </p>
      </div>
    </div>
  );
}

function TechcombankMark({ compact }: { compact: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-3 overflow-hidden rounded-[1.15rem] border border-[#ffe1e1] bg-[linear-gradient(135deg,#ffffff,#fff1f1)] px-4">
      <div className="absolute -right-5 -top-5 size-16 rounded-full bg-[#ff7b7b]/12 blur-2xl" />
      <div className="absolute -left-6 bottom-0 size-16 rounded-full bg-[#ffb5b5]/14 blur-2xl" />

      <svg
        viewBox="0 0 72 56"
        className={cn("shrink-0 drop-shadow-[0_10px_24px_rgba(217,53,53,0.18)]", compact ? "h-8 w-10" : "h-9 w-11")}
        aria-hidden="true"
      >
        <path
          d="M20 4 36 20 20 36 4 20Z"
          fill="#d83030"
        />
        <path
          d="M52 20 36 36 52 52 68 36Z"
          fill="#f05050"
        />
      </svg>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-auth-headline font-extrabold tracking-[-0.03em] text-[#7c1f24]",
            compact ? textSizes.title.compact : textSizes.title.regular
          )}
        >
          Techcombank
        </p>
        <p
          className={cn(
            "mt-1 font-semibold uppercase tracking-[0.18em] text-[#b76e74]",
            compact ? textSizes.subtitle.compact : textSizes.subtitle.regular
          )}
        >
          TCB
        </p>
      </div>
    </div>
  );
}

function GenericBankMark({
  bankCode,
  bankName,
  compact,
}: {
  bankCode: string;
  bankName: string;
  compact: boolean;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-3 overflow-hidden rounded-[1.15rem] border border-[#eadff9] bg-[linear-gradient(135deg,#ffffff,#f7f0ff)] px-4">
      <div className="absolute -right-6 -top-5 size-16 rounded-full bg-[#d9b7ff]/22 blur-2xl" />
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[1rem] bg-gradient-primary font-auth-headline font-extrabold tracking-[-0.04em] text-white shadow-[0_16px_32px_-20px_rgba(123,25,216,0.48)]",
          compact ? "h-10 w-12 text-sm" : "h-11 w-14 text-base"
        )}
      >
        {bankCode.slice(0, 4)}
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-auth-headline font-extrabold tracking-[-0.03em] text-[#4b287a]",
            compact ? textSizes.title.compact : textSizes.title.regular
          )}
        >
          {bankName}
        </p>
        <p
          className={cn(
            "mt-1 font-semibold uppercase tracking-[0.18em] text-[#9a7ac7]",
            compact ? textSizes.subtitle.compact : textSizes.subtitle.regular
          )}
        >
          {bankCode}
        </p>
      </div>
    </div>
  );
}

export function BankBrandMark({
  bankCode,
  bankName,
  className,
  compact = false,
}: BankBrandMarkProps) {
  const matchedBank = findSupportedBank({ bankCode, bankName });
  const fallbackCode = `${bankCode ?? "BANK"}`.trim().toUpperCase();
  const fallbackName = `${bankName ?? "Ngan hang"}`.trim();
  const resolvedCode = matchedBank?.code ?? (fallbackCode || "BANK");
  const resolvedName = matchedBank?.name ?? (fallbackName || "Ngân hàng");

  return (
    <div className={cn(compact ? "h-16 w-40" : "h-24 w-full", className)}>
      {resolvedCode === "VCB" ? <VietcombankMark compact={compact} /> : null}
      {resolvedCode === "MBB" ? <MbBankMark compact={compact} /> : null}
      {resolvedCode === "TCB" ? <TechcombankMark compact={compact} /> : null}
      {!["VCB", "MBB", "TCB"].includes(resolvedCode) ? (
        <GenericBankMark
          bankCode={resolvedCode}
          bankName={resolvedName}
          compact={compact}
        />
      ) : null}
    </div>
  );
}
