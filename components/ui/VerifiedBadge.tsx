/* ─────────────────────────────────────────────────────────────────
   Verified check badge — canonical implementation.
   - Blue (#3B82F6) when verified and monthly validation is fresh.
   - Gray (#4a4d56) when not verified OR validation has expired
     (last_profile_validation predates the 1st AND today > 15th).
───────────────────────────────────────────────────────────────── */

"use client";

import { isValidationExpired } from "@/lib/utils/profileValidation";

interface Props {
  verified: boolean | null | undefined;
  lastValidation?: string | Date | null;
  size?: number;
  title?: string;
  className?: string;
}

const BLUE = "#3B82F6";
const GRAY = "#4a4d56";

export default function VerifiedBadge({
  verified,
  lastValidation = null,
  size = 20,
  title,
  className,
}: Props) {
  const expired = isValidationExpired({
    verified: !!verified,
    last_profile_validation: lastValidation ?? null,
  });
  const active = !!verified && !expired;
  const color = active ? BLUE : GRAY;
  const label = title ?? (active ? "Profil vérifié" : expired ? "Badge désactivé — confirmation requise" : "Profil non vérifié");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke="none"
      className={className}
      aria-label={label}
    >
      <title>{label}</title>
      <circle cx="12" cy="12" r="10" />
      <path
        d="M9 12l2 2 4-4"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
