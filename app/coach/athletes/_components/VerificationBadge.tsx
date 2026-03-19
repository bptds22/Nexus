/* ─────────────────────────────────────────────────────────────────
   Verification Badge — Shows verification status + method
   - Auto (≥60%): blue circle-check + "Auto-vérifié"
   - Manual coach: blue circle-check + "Vérifié (coach)"
   - Manual director: blue circle-check + "Vérifié (directeur)"
   - Not verified: gray circle + "Non vérifié"
───────────────────────────────────────────────────────────────── */

import type { AthleteVerification } from "../../../../lib/types/models";

interface VerificationBadgeProps {
  isVerified: boolean;
  verification?: AthleteVerification;
  /** Show verification method label (default: true) */
  showMethod?: boolean;
  /** Badge size: "sm" (12px icon), "md" (14px icon, default), "lg" (18px icon) */
  size?: "sm" | "md" | "lg";
  /** Compact layout (narrower min-width) */
  compact?: boolean;
  /** Show only the icon, no text label */
  iconOnly?: boolean;
}

const ICON_SIZES = { sm: 12, md: 14, lg: 18 } as const;
const TEXT_SIZES = { sm: "text-[11px]", md: "text-[12px]", lg: "text-[13px]" } as const;

function getLabel(verification?: AthleteVerification, isVerified?: boolean, showMethod = true): string {
  if (!verification) return isVerified ? "Vérifié" : "Non vérifié";
  if (!verification.isVerified) return "Non vérifié";
  if (!showMethod) return "Vérifié";
  switch (verification.method) {
    case "auto": return "Auto-vérifié";
    case "manual_coach": return "Vérifié (coach)";
    case "manual_director": return "Vérifié (dir.)";
    default: return "Vérifié";
  }
}

function getTooltip(verification?: AthleteVerification): string | undefined {
  if (!verification?.isVerified) return undefined;
  const parts: string[] = [];
  if (verification.verifiedByName) parts.push(`Par: ${verification.verifiedByName}`);
  if (verification.verifiedAt) {
    const d = new Date(verification.verifiedAt);
    parts.push(`Le: ${d.toLocaleDateString("fr-CA")}`);
  }
  if (verification.profilePercentAtVerification != null) {
    parts.push(`Profil: ${verification.profilePercentAtVerification}%`);
  }
  if (verification.manualOverrideActive) {
    parts.push("⚠ Vérification manuelle (profil < 60%)");
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export default function VerificationBadge({
  isVerified,
  verification,
  showMethod = true,
  size = "md",
  compact,
  iconOnly,
}: VerificationBadgeProps) {
  const label = getLabel(verification, isVerified, showMethod);
  const tooltip = getTooltip(verification);
  const iconSize = ICON_SIZES[size];
  const textSize = TEXT_SIZES[size];

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "min-w-[80px]" : ""}`}
      title={tooltip}
    >
      {isVerified ? (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      ) : (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )}
      {!iconOnly && (
        <span className={`${textSize} font-bold ${isVerified ? "text-[#3B82F6]" : "text-[#6B7280]"}`}>
          {label}
        </span>
      )}
    </div>
  );
}
