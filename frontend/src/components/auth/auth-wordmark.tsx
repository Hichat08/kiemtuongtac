import { BrandLogo } from "@/components/branding/brand-logo";
import { cn } from "@/lib/utils";

interface AuthWordmarkProps {
  className?: string;
  compact?: boolean;
  inverted?: boolean;
  label?: string;
  to?: string;
}

export function AuthWordmark({
  className,
  compact = false,
  inverted = false,
  label = "Kiếm Tương Tác",
  to = "/signin",
}: AuthWordmarkProps) {
  return (
    <BrandLogo
      to={to}
      alt={`${label} logo`}
      className={cn("inline-flex items-center", className)}
      imageClassName={cn(
        compact ? "h-10 sm:h-11" : "h-14 sm:h-16",
        inverted && "drop-shadow-[0_18px_35px_rgba(35,10,70,0.28)]"
      )}
    />
  );
}
