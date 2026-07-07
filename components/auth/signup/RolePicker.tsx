"use client";

/* ═══════════════════════════════════════════════════════════════
   RolePicker (web) — écran 0 du signup unifié. 4 cartes.
   Port web du RolePicker natif (SignupMobile.tsx). Présentationnel :
   remonte le choix via onPick(role) ; aucun état interne.
═══════════════════════════════════════════════════════════════ */

import type { SignupRole } from "./usePartialSignup";

interface RoleCard {
  role: SignupRole;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const CARDS: RoleCard[] = [
  {
    role: "athlete",
    title: "Athlète",
    subtitle: "Tu es un athlète du secondaire et tu veux te faire recruter.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" /><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
  {
    role: "coach_school",
    title: "Entraîneur d'école secondaire",
    subtitle: "Crée des profils pour tes athlètes et donne-leur de la visibilité auprès des recruteurs.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    role: "coach_civil",
    title: "Coach ligue ou club sportif",
    subtitle: "Tu coaches dans une ligue ou un club hors scolaire (ligue civile).",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" /><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" /><path d="M6 3h12v6a6 6 0 01-12 0V3z" /><path d="M12 15v3M8 21h8" />
      </svg>
    ),
  },
  {
    role: "recruiter",
    title: "Recruteur CÉGEP",
    subtitle: "Tu recrutes pour un programme sportif collégial.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
];

export function RolePicker({ onPick }: { onPick: (role: SignupRole) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {CARDS.map((c) => (
        <button
          key={c.role}
          type="button"
          onClick={() => onPick(c.role)}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-[#111317] hover:border-[#E63946] hover:bg-[rgba(230,57,70,0.06)] transition-all text-left"
        >
          <span className="shrink-0 mt-0.5 text-[#E63946]">{c.icon}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-white">{c.title}</span>
            <span className="block text-[12px] text-[#9CA3AF] mt-0.5 leading-snug">{c.subtitle}</span>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round" className="shrink-0 mt-1">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}
