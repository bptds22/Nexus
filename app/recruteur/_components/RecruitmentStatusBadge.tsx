import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig } from "@/lib/config/recruitmentStatuses";

/* ─────────────────────────────────────────────────────────────────
   RecruitmentStatusBadge
   Discovery = white text/border, Commitment = red, Exit = gray.
   "none" renders nothing.
───────────────────────────────────────────────────────────────── */

/* ── SVG Icons ───────────────────────────────────────────────── */

function StatusIcon({ icon, color, size }: { icon: string; color: string; size: number }) {
  const s = size;
  switch (icon) {
    case "eye":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "send":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      );
    case "message-circle":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      );
    case "calendar":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
        </svg>
      );
    case "handshake":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "pen-tool":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
        </svg>
      );
    case "x-circle":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6" /><path d="M9 9l6 6" />
        </svg>
      );
    default:
      return null;
  }
}

interface Props {
  status: RecruitmentStatus;
  size?: "sm" | "md";
}

export default function RecruitmentStatusBadge({ status, size = "sm" }: Props) {
  if (status === "none") return null;

  const cfg = getStatusConfig(status);
  const iconSize = size === "sm" ? 11 : 13;
  const textSize = size === "sm" ? "text-[10px]" : "text-[12px]";
  const px = size === "sm" ? "px-2.5 py-0.5" : "px-3.5 py-1.5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${textSize} font-bold tracking-wider uppercase rounded-full ${px}`}
      style={{ backgroundColor: cfg.bgColor, borderWidth: 1, borderStyle: "solid", borderColor: cfg.borderColor, color: cfg.color }}
    >
      <StatusIcon icon={cfg.icon} color={cfg.color} size={iconSize} />
      {cfg.shortLabel}
    </span>
  );
}

export { StatusIcon };
