"use client";

/* ═══════════════════════════════════════════════════════════════
   AudienceTiles — "À qui veux-tu écrire?" step-1 selector (coach).
   Tiles are DECLARED here so a future audience (Parent/Équipe) flips
   on by data, not by a rewrite. Coach audiences :
     • Recruteur          → RECRUTEUR_COACH (existing flow)
     • Coach / Directeur / École → COACH_COACH (P4)
     • Parent             → PARENT_COACH (P2) : visible, DISABLED "Bientôt"
   Team/Équipe deferred entirely (not rendered).
═══════════════════════════════════════════════════════════════ */

export type CoachAudience = "recruteur" | "coach" | "directeur" | "ecole";

interface Tile {
  key: CoachAudience | "parent";
  label: string;
  sub: string;
  hue: string; // border/hover accent
  disabled?: boolean;
  soon?: boolean;
  icon: React.ReactNode;
}

const BUILDING = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>
);
const WHISTLE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 00-6-6H8a2 2 0 000 4h4" /><circle cx="7" cy="15" r="6" /></svg>
);
const STAR = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
const SCHOOL = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
);
const PARENT = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
);

const TILES: Tile[] = [
  { key: "recruteur", label: "Recruteur", sub: "Recruteur CÉGEP", hue: "#E63946", icon: BUILDING },
  { key: "coach", label: "Coach", sub: "Un collègue de ton école", hue: "#14B8A6", icon: WHISTLE },
  { key: "directeur", label: "Directeur", sub: "Direction sportive", hue: "#14B8A6", icon: STAR },
  { key: "ecole", label: "École", sub: "N'importe quel membre du personnel", hue: "#14B8A6", icon: SCHOOL },
  { key: "parent", label: "Parent", sub: "Bientôt", hue: "#6B7280", disabled: true, soon: true, icon: PARENT },
];

export default function AudienceTiles({ onPick }: { onPick: (a: CoachAudience) => void }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-3">
        À qui veux-tu écrire&nbsp;?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={t.disabled}
            onClick={() => !t.disabled && onPick(t.key as CoachAudience)}
            style={{ "--hue": t.hue } as React.CSSProperties}
            className={`text-left rounded-xl p-4 flex items-center gap-3 bg-[#1A1D24] border transition-colors ${
              t.disabled
                ? "border-[#2D3748] opacity-60 cursor-not-allowed"
                : "border-[#2D3748] hover:border-[var(--hue)]"
            }`}
          >
            <span
              className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${t.hue}22`, color: t.hue }}
            >
              {t.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-white truncate">{t.label}</span>
                {t.soon && (
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#6B7280]/20 text-[#9CA3AF]">
                    Bientôt
                  </span>
                )}
              </span>
              <span className="block text-[12px] text-[#6b7280] truncate mt-0.5">{t.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
