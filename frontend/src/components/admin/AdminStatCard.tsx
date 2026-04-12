import type { LucideIcon } from "lucide-react";

interface AdminStatCardProps {
  label: string;
  value: string;
  helper?: string;
  helperClassName?: string;
  icon: LucideIcon;
  iconClassName: string;
  badge?: string;
  badgeClassName?: string;
  valueClassName?: string;
  className?: string;
}

export default function AdminStatCard({
  label,
  value,
  helper,
  helperClassName,
  icon: Icon,
  iconClassName,
  badge,
  badgeClassName,
  valueClassName,
  className = "",
}: AdminStatCardProps) {
  return (
    <div
      className={`rounded-[1.55rem] border border-white/70 bg-white/92 p-6 shadow-[0_24px_55px_-38px_rgba(45,47,50,0.16)] backdrop-blur-sm ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex size-12 items-center justify-center rounded-2xl ${iconClassName}`}>
          <Icon className="size-5" />
        </div>
        {badge ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
              badgeClassName ?? "bg-[#f3edff] text-[#7b19d8]"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-[#6d7282]">{label}</p>
        <p
          className={`mt-1 font-auth-headline text-[2rem] font-extrabold tracking-[-0.04em] ${
            valueClassName ?? "text-[#2d2f32]"
          }`}
        >
          {value}
        </p>
        {helper ? (
          <p className={`mt-2 text-xs font-medium ${helperClassName ?? "text-[#8b92a1]"}`}>{helper}</p>
        ) : null}
      </div>
    </div>
  );
}
