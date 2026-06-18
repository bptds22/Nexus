/* ═══════════════════════════════════════════════════════════════
   components/legal/BlockRenderer.tsx — iter 7.50-a-bis (legal-1)

   Renderer partagé pour un `Block` du modèle unifié (content/legal/
   types.ts). Extrait verbatim des renderers inline de app/{
   confidentialite, conditions, collecte-donnees}/page.tsx. Le rendu
   HTML doit rester BYTE-IDENTIQUE pour préserver le script de
   génération PDF (scripts/generate-legal-pdfs.mjs).

   Particularités :
   - Le bloc "p" supporte un flag `trailing` qui rend mt-4 au lieu de
     mb-4. Utilisé pour les paragraphes en fin de section qui suivent
     des bullets (ex. champs `after` de collecte-donnees) — préserve
     le rendu original sans expanser le bottom margin du dernier p.
   - Le bloc "subsection" récurse via le SectionRenderer enfants — le
     renderer fait le récurse interne.
═══════════════════════════════════════════════════════════════ */

import { type ReactNode } from "react";
import type { Block } from "@/content/legal/types";

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

export function renderBlocks(blocks: Block[]): ReactNode {
  return blocks.map((block, i) => {
    switch (block.type) {
      case "p":
        return (
          <p
            key={i}
            className={`font-sans text-sm text-[#C4CDD8] leading-relaxed ${
              block.trailing ? "mt-4" : "mb-4"
            }`}
          >
            {block.text}
          </p>
        );

      case "bullets":
        return (
          <ul key={i} className="flex flex-col gap-3 my-5 pl-1">
            {block.items.map((b, bi) => (
              <li key={bi} className="flex items-start gap-3">
                <span className="w-5 h-px bg-wl-red mt-2.5 flex-shrink-0" />
                <span className="font-sans text-sm text-[#9AA3B2] leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        );

      case "table":
        return (
          <div key={i} className="my-6 -mx-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="bg-[#0F1A30] border-b-2 border-wl-red/40">
                  {block.headers.map((h, hi) => (
                    <th
                      key={hi}
                      className={`${label} text-white px-3 py-3 align-top`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={`border-b border-[#1E2D4A] ${
                      ri % 2 === 0 ? "bg-[#0A1428]/40" : "bg-transparent"
                    }`}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="font-sans text-[13px] text-[#C4CDD8] leading-relaxed px-3 py-3 align-top"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "callout": {
        const tones = {
          red: { border: "border-l-wl-red", bg: "bg-wl-red/10", text: "text-wl-red" },
          yellow: { border: "border-l-[#F59E0B]", bg: "bg-[#F59E0B]/10", text: "text-[#F59E0B]" },
          green: { border: "border-l-[#22C55E]", bg: "bg-[#22C55E]/10", text: "text-[#22C55E]" },
          blue: { border: "border-l-[#3B82F6]", bg: "bg-[#3B82F6]/10", text: "text-[#3B82F6]" },
        }[block.tone];
        return (
          <div
            key={i}
            className={`my-5 border-l-4 ${tones.border} ${tones.bg} px-5 py-4 rounded-r`}
          >
            {block.title && (
              <div className={`${label} ${tones.text} mb-2`}>{block.title}</div>
            )}
            <p className="font-sans text-sm text-[#E5E7EB] leading-relaxed">
              {block.text}
            </p>
          </div>
        );
      }

      case "definitions":
        return (
          <dl key={i} className="my-5 flex flex-col gap-4">
            {block.items.map((d, di) => (
              <div key={di} className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-1 md:gap-4">
                <dt className="font-head font-black text-sm text-white">{d.term}</dt>
                <dd className="font-sans text-sm text-[#9AA3B2] leading-relaxed">{d.def}</dd>
              </div>
            ))}
          </dl>
        );

      case "contact-card":
        return (
          <div
            key={i}
            className="my-5 bg-[#0A1428] border border-[#1E2D4A] rounded-md p-5"
          >
            <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-3 gap-x-4">
              {block.rows.map((r, ri) => (
                <div key={ri} className="contents">
                  <dt className={`${label} text-[#475569] pt-0.5`}>{r.label}</dt>
                  <dd className="font-sans text-sm text-[#E5E7EB] leading-relaxed">
                    {r.href ? (
                      <a
                        href={r.href}
                        className="hover:text-wl-red transition-colors"
                      >
                        {r.value}
                      </a>
                    ) : (
                      r.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );

      case "subsection":
        return (
          <section
            key={i}
            id={block.id}
            className="mt-8 pt-4 border-t border-[#1E2D4A]/60 scroll-mt-24"
          >
            <h3 className="font-head font-black text-base text-white uppercase tracking-tight mb-4">
              {block.title}
            </h3>
            {renderBlocks(block.blocks)}
          </section>
        );

      default:
        return null;
    }
  });
}

interface BlockRendererProps {
  blocks: Block[];
}

/** Wrapper composant pour rendre une liste de Block.
    Équivalent à `renderBlocks(blocks)` mais sous forme JSX-friendly. */
export default function BlockRenderer({ blocks }: BlockRendererProps) {
  return <>{renderBlocks(blocks)}</>;
}
