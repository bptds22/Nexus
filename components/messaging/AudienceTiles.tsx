"use client";

/* ═══════════════════════════════════════════════════════════════
   AudienceTiles — "À qui veux-tu écrire?" step-1 selector (coach/director).
   Final tile set :
     • Entraîneur / Directeur sportif → COACH_COACH (P4)
     • Recruteurs                     → RECRUTEUR_COACH (OPEN : CÉGEP browser,
       no favoris precondition — coach outbound "sell my athletes")
     • Groupe                         → diffusion (broadcast)
     • Parent                         → PARENT_COACH (P2) : visible, DISABLED "Bientôt"
   No "École" tile ("toute l'école" lives under Groupe → tous les entraîneurs).
═══════════════════════════════════════════════════════════════ */

export type CoachAudience = "coach" | "directeur" | "recruteurs" | "groupe";

const WHISTLE = (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 00-6-6H8a2 2 0 000 4h4" /><circle cx="7" cy="15" r="6" /></svg>);
const STAR = (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>);
const CEGEP = (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>);
const GROUP = (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>);
const PARENT = (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);

const TILES = [
  { key: "coach" as const, label: "Entraîneur", sub: "Un collègue de ton école", hue: "#14B8A6", icon: WHISTLE, disabled: false, soon: false },
  { key: "directeur" as const, label: "Directeur sportif", sub: "Direction sportive", hue: "#14B8A6", icon: STAR, disabled: false, soon: false },
  { key: "recruteurs" as const, label: "Recruteurs", sub: "Contacter un recruteur CÉGEP", hue: "#E63946", icon: CEGEP, disabled: false, soon: false },
  { key: "groupe" as const, label: "Groupe", sub: "Diffusion à plusieurs destinataires", hue: "#8B5CF6", icon: GROUP, disabled: false, soon: false },
  { key: "parent" as const, label: "Parent", sub: "Bientôt", hue: "#6B7280", icon: PARENT, disabled: true, soon: true },
];

export default function AudienceTiles({ onPick }: { onPick: (a: CoachAudience) => void }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-3">À qui veux-tu écrire&nbsp;?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={t.disabled}
            onClick={() => !t.disabled && onPick(t.key as CoachAudience)}
            style={{ "--hue": t.hue } as React.CSSProperties}
            className={`text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border transition-colors ${
              t.disabled ? "border-[#2D3748] opacity-60 cursor-not-allowed" : "border-[#2D3748] hover:border-[var(--hue)]"
            }`}
          >
            <span className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${t.hue}22`, color: t.hue }}>{t.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-white truncate">{t.label}</span>
                {t.soon && <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#6B7280]/20 text-[#9CA3AF]">Bientôt</span>}
              </span>
              <span className="block text-[12px] text-[#6b7280] truncate mt-0.5">{t.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
