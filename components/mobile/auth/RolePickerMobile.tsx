"use client";

/* ═══════════════════════════════════════════════════════════════
   RolePickerMobile — SOURCE UNIQUE du parcours de selection de role.

   EXTRAIT VERBATIM de SignupMobile.tsx (ex-fonction locale `RolePicker`,
   lignes 686-793). Le JSX, les 4 cartes et la signature des callbacks sont
   INCHANGES. Seuls `title` / `subtitle` / `footnote` deviennent optionnels
   pour que le composant puisse etre monte dans un second contexte sans
   dupliquer le parcours.

   Monte a DEUX endroits :
     1. SignupMobile, ecran 0 (signup email natif) — inchange.
     2. RoleGateMobile (/inscription/role) — interstitiel post-OAuth.

   Un seul parcours. Le coach passe par le choix scolaire / ligue civile
   (2 cartes distinctes), le recruteur derive `collegial` sans ecran
   supplementaire (porte par la carte), et l'athlete ne choisit AUCUN
   contexte — il est pose plus tard, a /athlete/onboarding
   (cf. SignupMobile.tsx:415-417 et route.ts:114).
═══════════════════════════════════════════════════════════════ */

import React from "react";

export interface RolePickerMobileProps {
  onPickAthlete: () => void;
  onPickPro: (role: "scolaire" | "collegial" | "ligue_civile") => void;
  /** Defaut : "Tu es ?" (copie SignupMobile). */
  title?: string;
  /** Defaut : copie SignupMobile. */
  subtitle?: string;
  /** Note de bas d'ecran, optionnelle. Aucune par defaut. */
  footnote?: React.ReactNode;
}

interface RoleCard {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onTap: () => void;
}

export function RolePickerMobile({
  onPickAthlete,
  onPickPro,
  title = "Tu es ?",
  subtitle = "Choisis ton rôle pour adapter l'inscription.",
  footnote = null,
}: RolePickerMobileProps) {
  const cards: RoleCard[] = [
    {
      key: "athlete",
      title: "Athlète",
      subtitle: "Tu es un athlète du secondaire et tu veux te faire recruter.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
        </svg>
      ),
      onTap: onPickAthlete,
    },
    {
      key: "scolaire",
      title: "Entraîneur d'école secondaire",
      subtitle: "Tu coaches une équipe scolaire et veux donner de la visibilité à tes athlètes.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22V12h6v10" />
        </svg>
      ),
      onTap: () => onPickPro("scolaire"),
    },
    {
      key: "ligue_civile",
      title: "Coach ligue ou club civil",
      subtitle: "Tu coaches dans une ligue ou un club hors scolaire (ligue civile).",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
          <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
          <path d="M6 3h12v6a6 6 0 0 1-12 0V3z" />
          <path d="M12 15v3M8 21h8" />
        </svg>
      ),
      onTap: () => onPickPro("ligue_civile"),
    },
    {
      key: "collegial",
      title: "Recruteur CÉGEP",
      subtitle: "Tu recrutes pour un programme sportif collégial.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      ),
      onTap: () => onPickPro("collegial"),
    },
  ];

  return (
    <div className="relative z-10 flex-1 px-6 pt-4 overflow-y-auto">
      <h1
        className="font-head font-black text-white uppercase tracking-tight"
        style={{ fontSize: 28, lineHeight: 0.95 }}
      >
        {title}
      </h1>
      <p className="text-[14px] text-[#9CA3AF] mt-2">{subtitle}</p>

      <div className="space-y-3 mt-6">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.onTap}
            className="w-full text-left bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] active:bg-[#22262e] transition-all"
            style={{ minHeight: 72 }}
          >
            <span className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center text-white flex-shrink-0">
              {c.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold text-white">{c.title}</span>
              <span className="block text-[13px] text-white/55 mt-0.5 leading-snug">{c.subtitle}</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      {footnote && (
        <p className="text-[11px] text-white/30 text-center mt-6 mb-4 italic">{footnote}</p>
      )}
    </div>
  );
}
