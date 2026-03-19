"use client";

/* ─────────────────────────────────────────────────────────────────
   SettingsNav — Left sidebar navigation for settings sections
───────────────────────────────────────────────────────────────── */

export type SettingsSection = "profil" | "ecole" | "notifications" | "compte";

interface Props {
  active: SettingsSection;
  onChange: (s: SettingsSection) => void;
}

const SECTIONS: { key: SettingsSection; label: string; icon: React.ReactNode }[] = [
  {
    key: "profil",
    label: "Profil",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: "ecole",
    label: "École & programme",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    key: "compte",
    label: "Compte & sécurité",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
];

export default function SettingsNav({ active, onChange }: Props) {
  return (
    <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
      {SECTIONS.map((s) => {
        const isActive = active === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-bold tracking-[0.08em] uppercase whitespace-nowrap transition-all ${
              isActive
                ? "bg-[#E63946]/12 text-[#E63946]"
                : "text-[#8a8d96] hover:text-white hover:bg-white/5"
            }`}
          >
            <span className={isActive ? "text-[#E63946]" : "text-[#6b7280]"}>{s.icon}</span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
