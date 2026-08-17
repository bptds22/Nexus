import type { Metadata } from "next";
import { SECTIONS_AIDE } from "@/content/aide/sections";
import { flattenBlocks, visibleSections } from "@/lib/aide/search";

/* ═══════════════════════════════════════════════════════════════
   app/aide/layout.tsx — métadonnées du centre d'aide

   La page /aide est cliente (elle porte l'état de recherche) et ne
   peut donc pas exporter `metadata`. Ce layout est le composant
   serveur qui les porte, sur le modèle de app/tarifs/layout.tsx.
   Sans lui, la page n'aurait aucune balise propre — c'est
   exactement l'état actuel de app/guide-recrutement, qui est
   « use client » sans layout.

   Le JSON-LD FAQPage est ce qui permet à Google de faire remonter
   UN article précis avec un lien direct vers son ancre, plutôt que
   la page entière. C'est ce qui rend la page unique préférable à
   14 pages minces : une seule URL accumule l'autorité, et le
   balisage rend quand même chaque question adressable.
═══════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  // Le layout racine applique le gabarit « %s | Nexus » — ne pas
  // répéter la marque ici, sinon le titre sort « … Nexus | Nexus ».
  title: "Centre d'aide — Questions fréquentes",
  description:
    "Réponses aux questions fréquentes des entraîneurs, athlètes et parents sur Nexus : profils, vérification, sécurité des données et recrutement CÉGEP.",
  alternates: {
    canonical: "https://nexussports.ca/aide",
  },
  openGraph: {
    title: "Centre d'aide — Nexus",
    description:
      "Réponses aux questions fréquentes des entraîneurs, athlètes et parents sur Nexus.",
    url: "https://nexussports.ca/aide",
    type: "website",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  // visibleSections, jamais SECTIONS_AIDE : un article en brouillon
  // ne doit pas non plus fuir par le balisage structuré.
  mainEntity: visibleSections(SECTIONS_AIDE).flatMap((section) =>
    section.articles.map((article) => ({
      "@type": "Question",
      name: article.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: flattenBlocks(article.blocks),
      },
    })),
  ),
};

export default function AideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        // Contenu statique issu du dépôt, aucune saisie utilisateur.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
