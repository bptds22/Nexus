"use client";

/* ─────────────────────────────────────────────────────────────────
   RecruiterSettingsNav — Left sidebar navigation (click-to-switch)
───────────────────────────────────────────────────────────────── */

export type SectionKey = "compte" | "etablissement" | "recrutement" | "abonnement" | "admin_cegep" | "notifications" | "confidentialite" | "transfert" | "danger";

interface Props {
  active: SectionKey;
  onChange: (s: SectionKey) => void;
}

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode; danger?: boolean }[] = [
  {
    key: "compte",
    label: "Mon compte",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
  {
    key: "etablissement",
    label: "Établissement",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  },
  {
    key: "recrutement",
    label: "Recrutement",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  },
  {
    key: "abonnement",
    label: "Abonnement",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  },
  {
    key: "admin_cegep",
    label: "Gestion CÉGEP",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></svg>,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  },
  {
    key: "confidentialite",
    label: "Confidentialité",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  },
  {
    key: "transfert",
    label: "Transfert CÉGEP",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8L22 12L18 16" /><path d="M2 12h20" /><path d="M6 16L2 12L6 8" /></svg>,
  },
  {
    key: "danger",
    label: "Zone danger",
    danger: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  },
];

export default function RecruiterSettingsNav({ active, onChange }: Props) {
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
                ? s.danger
                  ? "bg-[#E63946]/12 text-[#E63946]"
                  : "bg-[#E63946]/12 text-[#E63946]"
                : s.danger
                  ? "text-[#E63946]/60 hover:text-[#E63946] hover:bg-[#E63946]/5"
                  : "text-[#8a8d96] hover:text-white hover:bg-white/5"
            }`}
          >
            <span className={isActive ? "text-[#E63946]" : s.danger ? "text-[#E63946]/60" : "text-[#6b7280]"}>{s.icon}</span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
