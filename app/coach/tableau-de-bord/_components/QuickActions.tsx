import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────
   Zone 5 — ACTIONS RAPIDES
   One-click entry points for common tasks.
   Ghost/outlined style — secondary navigation helpers.
───────────────────────────────────────────────────────────────── */

const actions = [
  {
    label: "Ajouter un athlète",
    href: "/coach/athletes/create",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
  {
    label: "Voir le roster complet",
    href: "/coach/athletes",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    label: "Gérer les demandes",
    href: "/coach/requests",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="group flex items-center gap-4 rounded-xl border border-dashed border-[#2D3748] px-5 py-4 hover:border-[#6b7280] hover:bg-white/[0.02] transition-all"
        >
          <span className="text-[#6b7280] group-hover:text-white transition-colors">
            {a.icon}
          </span>
          <span className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] group-hover:text-white transition-colors">
            {a.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
