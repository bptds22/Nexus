/* ═══════════════════════════════════════════════════════════════
   components/aide/AideBlocks.tsx — renderer du centre d'aide

   Renderer DÉDIÉ, fidèle au design system Nexus :
   fond #111317, surfaces #1A1D24, bordures #2D3748.

   ⚠ NE PAS remplacer par components/legal/BlockRenderer.tsx et ne
   jamais modifier celui-ci. Le renderer légal est verrouillé sur un
   rendu byte-identique pour scripts/generate-legal-pdfs.mjs, et il
   peint la palette légale (#0A1428 / #1E2D4A). Les deux renderers
   consomment le même type `Block` et divergent uniquement sur
   l'habillage — c'est voulu.

   Le rouge #E63946 est RÉSERVÉ aux titres de question (voir
   AideArticleCard). Ici il n'apparaît que dans le callout de ton
   « red », qui est un choix explicite de l'auteur du contenu.

   Composant purement présentationnel, sans état : utilisable en
   composant serveur comme en composant client (le futur sheet
   mobile le réutilisera tel quel).
═══════════════════════════════════════════════════════════════ */

import { type ReactNode } from "react";
import type { AideBlock } from "@/content/aide/types";

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/**
 * Rend le gras en ligne écrit `**comme ceci**` dans le contenu.
 *
 * Le document source est du markdown et son auteur n'est pas
 * développeur : lui demander d'ouvrir des balises JSX pour mettre
 * deux mots en gras rendrait content/aide/sections.ts illisible.
 * Il écrit donc les astérisques, et c'est le renderer qui traduit.
 *
 * Découpage sur des paires d'astérisques uniquement — un astérisque
 * isolé reste du texte, il n'y a rien à échapper.
 */
function renderInline(text: string): ReactNode {
  // [\s\S] plutôt que `.` avec le drapeau `s` : la cible du projet est
  // ES2017, où ce drapeau n'existe pas encore (tsconfig.json).
  const parts = text.split(/\*\*([\s\S]+?)\*\*/g);
  // split() avec un groupe capturant alterne : texte, gras, texte…
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold text-white">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

export function renderAideBlocks(blocks: AideBlock[]): ReactNode {
  return blocks.map((block, i) => {
    switch (block.type) {
      case "p":
        return (
          <p
            key={i}
            className={`font-sans text-[15px] text-[#C4CDD8] leading-relaxed ${
              block.trailing ? "mt-4" : "mb-4 last:mb-0"
            }`}
          >
            {renderInline(block.text)}
          </p>
        );

      case "bullets":
        return (
          <ul key={i} className="flex flex-col gap-2.5 my-5 pl-1 list-none">
            {block.items.map((item, bi) => (
              <li key={bi} className="flex items-start gap-3">
                {/* Marqueur neutre — le rouge reste au titre de question. */}
                <span
                  className="w-4 h-px bg-white/25 mt-[11px] flex-shrink-0"
                  aria-hidden
                />
                <span className="font-sans text-[15px] text-[#9CA3AF] leading-relaxed">
                  {renderInline(item)}
                </span>
              </li>
            ))}
          </ul>
        );

      case "steps":
        // Liste ORDONNÉE : dans ORPH-03 l'ordre porte du sens (« du
        // plus simple au plus large »), une puce l'effacerait.
        return (
          <ol key={i} className="flex flex-col gap-3 my-5 pl-1 list-none">
            {block.items.map((item, si) => (
              <li key={si} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] border border-[#2D3748] flex items-center justify-center font-head text-[11px] font-black text-[#9CA3AF]"
                  aria-hidden
                >
                  {si + 1}
                </span>
                <span className="font-sans text-[15px] text-[#9CA3AF] leading-relaxed pt-0.5">
                  {renderInline(item)}
                </span>
              </li>
            ))}
          </ol>
        );

      case "note": {
        // Encadré du centre d'aide. Ton NEUTRE par défaut : la
        // plupart des encadrés du document sont informatifs, et les
        // peindre en jaune d'avertissement serait un contresens.
        // Pas de bleu : c'est le signal du badge « vérifié », et
        // cette page parle justement de vérification (PROF-02).
        const tones = {
          neutral: { border: "border-l-[#4a4d56]", bg: "bg-white/[0.03]", text: "text-[#9CA3AF]" },
          red: { border: "border-l-[#E63946]", bg: "bg-[#E63946]/10", text: "text-[#E63946]" },
          yellow: { border: "border-l-[#F59E0B]", bg: "bg-[#F59E0B]/10", text: "text-[#F59E0B]" },
          green: { border: "border-l-[#22C55E]", bg: "bg-[#22C55E]/10", text: "text-[#22C55E]" },
        }[block.tone ?? "neutral"];
        return (
          <div
            key={i}
            className={`my-5 border-l-4 ${tones.border} ${tones.bg} px-5 py-4 rounded-r`}
          >
            {block.title && <div className={`${label} ${tones.text} mb-2`}>{block.title}</div>}
            <p className="font-sans text-[15px] text-[#E5E7EB] leading-relaxed">
              {renderInline(block.text)}
            </p>
          </div>
        );
      }

      case "table":
        // Le tableau déborde sur téléphone : il défile DANS son
        // conteneur (overflow-x-auto), la page ne défile jamais
        // horizontalement.
        return (
          <div key={i} className="my-6 -mx-1 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="bg-[#111317] border-b-2 border-[#2D3748]">
                  {block.headers.map((h, hi) => (
                    <th key={hi} className={`${label} text-white px-3 py-3 align-top`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={`border-b border-[#2D3748] last:border-b-0 ${
                      ri % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"
                    }`}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="font-sans text-[13px] text-[#C4CDD8] leading-relaxed px-3 py-3 align-top"
                      >
                        {renderInline(cell)}
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
          red: { border: "border-l-[#E63946]", bg: "bg-[#E63946]/10", text: "text-[#E63946]" },
          yellow: { border: "border-l-[#F59E0B]", bg: "bg-[#F59E0B]/10", text: "text-[#F59E0B]" },
          green: { border: "border-l-[#22C55E]", bg: "bg-[#22C55E]/10", text: "text-[#22C55E]" },
          blue: { border: "border-l-[#3B82F6]", bg: "bg-[#3B82F6]/10", text: "text-[#3B82F6]" },
        }[block.tone];
        return (
          <div
            key={i}
            className={`my-5 border-l-4 ${tones.border} ${tones.bg} px-5 py-4 rounded-r`}
          >
            {block.title && <div className={`${label} ${tones.text} mb-2`}>{block.title}</div>}
            <p className="font-sans text-[15px] text-[#E5E7EB] leading-relaxed">{block.text}</p>
          </div>
        );
      }

      case "definitions":
        return (
          <dl key={i} className="my-5 flex flex-col gap-4">
            {block.items.map((d, di) => (
              <div key={di} className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-1 md:gap-4">
                <dt className="font-head font-black text-sm text-white">{d.term}</dt>
                <dd className="font-sans text-[15px] text-[#9CA3AF] leading-relaxed">{d.def}</dd>
              </div>
            ))}
          </dl>
        );

      case "contact-card":
        return (
          <div key={i} className="my-5 bg-[#111317] border border-[#2D3748] rounded-lg p-5">
            <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-3 gap-x-4">
              {block.rows.map((r, ri) => (
                <div key={ri} className="contents">
                  <dt className={`${label} text-[#6b7280] pt-0.5`}>{r.label}</dt>
                  <dd className="font-sans text-[15px] text-[#E5E7EB] leading-relaxed break-words">
                    {r.href ? (
                      <a href={r.href} className="hover:text-[#E63946] transition-colors">
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

      case "ref":
        // Renvoi conditionnel. S'il arrive jusqu'ici, c'est que
        // l'article cité est publié — le tri est fait en amont par
        // visibleSections(), pas ici.
        return (
          <p key={i} className="font-sans text-[14px] text-[#9CA3AF] leading-relaxed mb-4 last:mb-0">
            {renderInline(block.text)}
          </p>
        );

      case "subsection":
        return (
          <section
            key={i}
            id={block.id}
            className="mt-7 pt-4 border-t border-[#2D3748]/70 scroll-mt-28"
          >
            <h4 className="font-head font-black text-[15px] text-white uppercase tracking-tight mb-3">
              {block.title}
            </h4>
            {renderAideBlocks(block.blocks)}
          </section>
        );

      default:
        return null;
    }
  });
}

/** Wrapper JSX-friendly, équivalent à `renderAideBlocks(blocks)`. */
export default function AideBlocks({ blocks }: { blocks: AideBlock[] }) {
  return <>{renderAideBlocks(blocks)}</>;
}
