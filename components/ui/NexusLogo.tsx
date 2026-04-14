import Image from "next/image";
import Link from "next/link";

interface NexusLogoProps {
  variant?: "white" | "black-red" | "black";
  iconOnly?: boolean;
  height?: number;
  href?: string;
  className?: string;
  priority?: boolean;
}

export default function NexusLogo({
  variant = "white",
  iconOnly = false,
  height = 28,
  href,
  className = "",
  priority = false,
}: NexusLogoProps) {
  const srcMap = {
    white: iconOnly ? "/brand/icon-red.png" : "/brand/logo-white-red.png",
    "black-red": iconOnly ? "/brand/icon-red.png" : "/brand/logo-black-red.png",
    black: iconOnly ? "/brand/icon-black.png" : "/brand/logo-black.png",
  } as const;
  const src = srcMap[variant];
  const width = iconOnly ? height : Math.round(height * 2.85);
  const img = (
    <Image
      src={src}
      alt="Nexus"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
  return href ? (
    <Link href={href} aria-label="Nexus" className="inline-flex items-center">
      {img}
    </Link>
  ) : (
    img
  );
}
