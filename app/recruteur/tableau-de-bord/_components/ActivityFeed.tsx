import Link from "next/link";
import type { RecruiterActivityEvent, RecruiterActivityType } from "../../_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   ACTIVITÉS RÉCENTES — Rich timeline with bold names, action links,
   date section dividers, and right-aligned timestamps.
───────────────────────────────────────────────────────────────── */

const NOW = new Date("2026-03-10T10:00:00");

/* ── Relative time (short) ─────────────────────────────────────── */
function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const diffMs = NOW.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return remMins > 0 ? `Il y a ${hours}h${String(remMins).padStart(2, "0")}` : `Il y a ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) {
    const h = d.getHours();
    const m = d.getMinutes();
    return m > 0 ? `Hier, ${h}h${String(m).padStart(2, "0")}` : `Hier, ${h}h`;
  }
  if (days < 7) {
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return dayNames[d.getDay()];
  }
  return `Il y a ${days} jours`;
}

/* ── Date bucket for section dividers ──────────────────────────── */
function dateBucket(isoStr: string): string {
  const d = new Date(isoStr);
  const today = new Date(NOW);
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(d);
  eventDay.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / 86400000);
  if (diffDays === 0) return "AUJOURD'HUI";
  if (diffDays === 1) return "HIER";
  if (diffDays < 7) return "CETTE SEMAINE";
  return "PLUS ANCIEN";
}

/* ── Event icon config ─────────────────────────────────────────── */
const EVENT_CONFIG: Record<RecruiterActivityType, { color: string; bgColor: string; icon: React.ReactNode }> = {
  reply: {
    color: "#22C55E",
    bgColor: "bg-[#22C55E]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  view: {
    color: "#F59E0B",
    bgColor: "bg-[#F59E0B]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  new_athlete: {
    color: "#F59E0B",
    bgColor: "bg-[#F59E0B]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path d="M20 8v6" /><path d="M23 11h-6" />
      </svg>
    ),
  },
  favorite: {
    color: "#E63946",
    bgColor: "bg-[#E63946]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#E63946" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  message: {
    color: "#E63946",
    bgColor: "bg-[#E63946]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  visit: {
    color: "#F59E0B",
    bgColor: "bg-[#F59E0B]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
      </svg>
    ),
  },
  badge: {
    color: "#F59E0B",
    bgColor: "bg-[#F59E0B]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  verified: {
    color: "#22C55E",
    bgColor: "bg-[#22C55E]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  video: {
    color: "#22C55E",
    bgColor: "bg-[#22C55E]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <path d="M10 8l6 4-6 4V8z" />
      </svg>
    ),
  },
  report: {
    color: "#F59E0B",
    bgColor: "bg-[#F59E0B]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  signed: {
    color: "#E63946",
    bgColor: "bg-[#E63946]/15",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
};

/* ── Component ─────────────────────────────────────────────────── */

export default function ActivityFeed({ events }: { events: RecruiterActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-8 text-center">
        <p className="text-[16px] text-[#9CA3AF] font-semibold">Tout est à jour</p>
        <p className="text-[12px] text-[#6b7280] mt-2">
          Explore les profils d&apos;athlètes pour commencer à recevoir de l&apos;activité
        </p>
      </div>
    );
  }

  /* Group events by date bucket */
  const grouped: { label: string; items: RecruiterActivityEvent[] }[] = [];
  let currentBucket = "";
  for (const ev of events) {
    const bucket = dateBucket(ev.timestamp);
    if (bucket !== currentBucket) {
      currentBucket = bucket;
      grouped.push({ label: bucket, items: [ev] });
    } else {
      grouped[grouped.length - 1].items.push(ev);
    }
  }

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h2 className="font-head font-bold text-[14px] tracking-[0.15em] uppercase text-white">
          Activités récentes
        </h2>
        <p className="text-[12px] text-[#9CA3AF] mt-1">De tes athlètes favoris</p>
      </div>

      {/* Grouped timeline */}
      <div className="px-5 pb-5">
        {grouped.map((group, gi) => (
          <div key={group.label}>
            {/* Section divider (skip for first group) */}
            {gi > 0 && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#2D3748]/60" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-[#2D3748]/60" />
              </div>
            )}

            {/* Events in group */}
            <div className="space-y-0">
              {group.items.map((ev) => {
                const cfg = EVENT_CONFIG[ev.type];
                return (
                  <div
                    key={ev.id}
                    className="flex items-start gap-3 py-3 group hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-full ${cfg.bgColor} flex items-center justify-center shrink-0 mt-0.5 border`}
                      style={{ borderColor: `${cfg.color}30` }}
                    >
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
                        {ev.textBefore}{ev.textBefore ? " " : ""}
                        <span className="font-bold text-white">{ev.highlightName}</span>
                        {ev.textAfter}
                      </p>
                      <Link
                        href={ev.linkHref}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold mt-1 transition-colors"
                        style={{ color: cfg.color }}
                      >
                        {ev.linkLabel}
                        <span className="text-[10px]">→</span>
                      </Link>
                    </div>

                    {/* Timestamp — right-aligned */}
                    <span className="text-[11px] text-[#6b7280] whitespace-nowrap shrink-0 pt-0.5">
                      {relativeTime(ev.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
