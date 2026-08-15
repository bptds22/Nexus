"use client";

/* ═══════════════════════════════════════════════════════════════
   components/aide/AideArticleCard.tsx — carte d'un article d'aide

   Une carte = une question + sa réponse + son ancre stable.

   TOUJOURS DÉPLIÉ, par décision : le centre d'aide est une base de
   connaissances. Un article replié serait invisible au Ctrl+F du
   navigateur, et surtout une arrivée par ancre (/aide#secu-04)
   atterrirait sur un titre fermé — exactement le lien qu'on envoie
   à un entraîneur. Le sommaire et la recherche portent la
   navigation ; le dépliage n'apporterait rien qu'ils ne fassent
   déjà mieux.

   Le rouge #E63946 est réservé au titre de question, ici et nulle
   part ailleurs dans le contenu.
═══════════════════════════════════════════════════════════════ */

import { useState, useCallback } from "react";
import type { AideArticle } from "@/content/aide/types";
import { articleAnchor } from "@/lib/aide/search";
import AideBlocks from "./AideBlocks";

type Props = {
  article: AideArticle;
  /** Affiché en surtitre quand la carte apparaît hors de sa section
      (liste de résultats de recherche). */
  sectionTitle?: string;
};

export default function AideArticleCard({ article, sectionTitle }: Props) {
  const anchor = articleAnchor(article.id);
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    // URL absolue : le lien doit être collable dans un courriel,
    // pas seulement dans l'onglet courant.
    const url = `${window.location.origin}${window.location.pathname}#${anchor}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      // Reflète l'article dans la barre d'adresse sans provoquer de
      // saut de défilement (replaceState, pas location.hash).
      window.history.replaceState(null, "", `#${anchor}`);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission
      // navigateur) : on ne casse rien, le lien reste copiable à la
      // main depuis l'ancre affichée.
      setCopied(false);
    }
  }, [anchor]);

  return (
    <article
      id={anchor}
      // scroll-mt-28 dégage la hauteur du MarketingNav collant :
      // sans ça, une arrivée par ancre place le titre SOUS la barre.
      className="scroll-mt-28 bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 sm:p-6"
    >
      {/* Un brouillon n'atteint jamais la production (filtré par
          visibleSections). S'il s'affiche, c'est qu'on est en
          développement — le bandeau évite de le prendre pour du
          contenu en ligne. */}
      {article.draft && (
        <p className="inline-block mb-3 px-2 py-1 rounded bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[10px] font-bold tracking-[0.2em] uppercase text-[#F59E0B]">
          Brouillon — non publié
        </p>
      )}

      {sectionTitle && (
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-2">
          {sectionTitle}
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-head text-[17px] sm:text-[19px] font-bold text-[#E63946] leading-snug tracking-tight">
          {article.question}
        </h3>

        <button
          type="button"
          onClick={copyLink}
          // 44px de cible tactile — des parents liront ça au doigt.
          className="shrink-0 -mt-1 -mr-1 w-11 h-11 flex items-center justify-center rounded-lg text-[#6b7280] hover:text-white hover:bg-white/[0.06] transition-colors"
          aria-label={`Copier le lien vers « ${article.question} »`}
          title={copied ? "Lien copié" : "Copier le lien"}
        >
          {copied ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          )}
        </button>
      </div>

      {/* Identifiant visible : c'est la référence qu'on cite en
          support (« va voir SECU-04 ») et elle est cherchable. */}
      <a
        href={`#${anchor}`}
        className="inline-block mt-2 mb-4 text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] hover:text-[#9CA3AF] transition-colors"
      >
        {article.id}
      </a>

      <div className="max-w-[70ch]">
        <AideBlocks blocks={article.blocks} />
      </div>

      <span
        aria-live="polite"
        className={`block text-[11px] font-bold uppercase tracking-[0.18em] text-[#22C55E] mt-3 transition-opacity ${
          copied ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
        }`}
      >
        Lien copié
      </span>
    </article>
  );
}
