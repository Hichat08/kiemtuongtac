import { Link } from "react-router";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  alt?: string;
  className?: string;
  imageClassName?: string;
  to?: string;
}

export function BrandLogo({
  alt = "Kiếm Tương Tác logo",
  className,
  imageClassName,
  to,
}: BrandLogoProps) {
  const image = (
    <img
      src="/logo-kiem-tuong-tac.png"
      alt={alt}
      className={cn("w-auto object-contain", imageClassName)}
    />
  );

  if (!to) {
    return <div className={className}>{image}</div>;
  }

  return (
    <Link
      to={to}
      className={className}
    >
      {image}
    </Link>
  );
}
