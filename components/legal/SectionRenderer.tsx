"use client";

/* ═══════════════════════════════════════════════════════════════
   components/legal/SectionRenderer.tsx — iter 7.50-a-bis (legal-1)

   Rend une liste de `Section` du modèle unifié. Génère :
   - Le wrapper <article> par section avec id ancre + scroll-mt
   - Le numéro de section (01, 02, ...) en grand chiffre fantôme
   - Le titre H2 en uppercase
   - Le bord ambre latéral si `emphasized=true`
   - Les blocs internes via BlockRenderer
   - Le séparateur de fin de section (border-b)

   Extrait verbatim du rendu inline de app/{confidentialite, conditions,
   collecte-donnees}/page.tsx. Le HTML résultant DOIT rester
   byte-identique pour préserver le script PDF.

   Le composant n'inclut PAS le wrapper de page (max-w, grid TOC, hero,
   CTA strip). Ces éléments restent dans la page web pour préserver
   le layout marketing existant. Le tracking actif (IntersectionObserver
   du TOC) reste au niveau page également — ce composant est purement
   présentationnel.
═══════════════════════════════════════════════════════════════ */

import type { Section } from "@/content/legal/types";
import { renderBlocks } from "./BlockRenderer";

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

interface SectionRendererProps {
  sections: Section[];
}

export default function SectionRenderer({ sections }: SectionRendererProps) {
  return (
    <div className="flex flex-col gap-0">
      {sections.map((section, i) => (
        <article
          key={section.id}
          id={section.id}
          className={`nx-policy-section scroll-mt-24 pb-12 mb-12 border-b border-[#1E2D4A] last:border-b-0 last:mb-0 last:pb-0 ${
            section.emphasized ? "border-l-4 border-l-[#F59E0B] pl-6" : ""
          }`}
        >
          {/* Section number + title */}
          <div className="flex items-center gap-4 mb-6">
            <span className="nx-step-num nx-display text-5xl font-black text-white/[0.08] leading-none select-none" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="nx-display text-2xl font-black text-white uppercase tracking-tight leading-tight">
              {section.title}
            </h2>
          </div>

          {renderBlocks(section.blocks)}
        </article>
      ))}
    </div>
  );
}

/** Sidebar TOC desktop (cachée < lg). */
export function LegalTocDesktop({
  sections, activeId,
}: { sections: Section[]; activeId: string }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24">
        <div className={`${label} text-wl-red mb-5`}>Table des matières</div>
        <nav className="flex flex-col gap-1">
          {sections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`group flex items-center gap-3 py-2 transition-colors duration-300 border-l-2 pl-3 -ml-3 ${
                activeId === s.id
                  ? "text-wl-red border-wl-red"
                  : "text-[#9AA3B2] hover:text-white border-transparent"
              }`}
            >
              <span className={`${label} w-6 flex-shrink-0 ${
                activeId === s.id ? "text-wl-red" : "text-[#475569] group-hover:text-[#9AA3B2]"
              } transition-colors`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-sans text-sm leading-tight">
                {s.title}
              </span>
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

/** TOC accordéon mobile (≥ lg cachée). */
export function LegalTocMobile({ sections }: { sections: Section[] }) {
  return (
    <div className="lg:hidden nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 mb-4">
      <div className={`${label} text-wl-red mb-4`}>Table des matières</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {sections.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-3 py-1.5 text-[#9AA3B2] hover:text-white transition-colors"
          >
            <span className={`${label} text-[#475569] w-5 flex-shrink-0`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-sans text-sm">{s.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
