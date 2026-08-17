/* ═══════════════════════════════════════════════════════════════
   content/aide/types.ts — Centre d'aide public (chantier 5)

   Modèle de contenu du centre d'aide. La hiérarchie est
   section → article → blocs, alors que le modèle légal est
   section → blocs. L'article est la couche qui manque.

   ⚠ Le type `Block` est IMPORTÉ de content/legal/types.ts, il n'y
   est jamais modifié. content/legal + components/legal/{Block,
   Section}Renderer alimentent scripts/generate-legal-pdfs.mjs, qui
   exige un rendu byte-identique. Le centre d'aide a son propre
   renderer : components/aide/AideBlocks.tsx.

   Les deux types de blocs ajoutés ci-dessous (`steps` et `note`)
   sont déclarés ICI, pas dans l'union légale — c'est le point
   d'extension prévu, et content/legal n'est pas touché.
═══════════════════════════════════════════════════════════════ */

import type { Block } from "@/content/legal/types";

/**
 * Bloc de contenu d'un article ou d'une introduction de section.
 *
 * Reprend l'union légale (p, bullets, table, callout, definitions,
 * contact-card, subsection) et y ajoute deux formes dont le
 * document source a besoin :
 *
 * - `steps`  : liste NUMÉROTÉE (« 1. » dans le markdown source).
 *              L'union légale n'a que des puces non ordonnées, et
 *              l'ordre porte du sens dans ORPH-03.
 * - `note`   : encadré. Identique au `callout` légal, sauf que le
 *              ton est FACULTATIF et vaut « neutral » par défaut.
 *              La majorité des encadrés du document sont
 *              informatifs (« À savoir », « En clair ») : les
 *              peindre en jaune d'avertissement serait un
 *              contresens, et le bleu est proscrit ici — c'est le
 *              signal du badge « vérifié », et cette page parle
 *              justement de vérification (PROF-02).
 *
 * - `ref`    : RENVOI CONDITIONNEL vers un autre article. Il n'est
 *              rendu que si l'article cité par `requires` est
 *              lui-même publié. C'est ce qui évite un renvoi
 *              orphelin — « Voir SECU-06 » pointant vers un
 *              article en brouillon, donc absent de la page.
 *              Le lien se rétablit tout seul le jour où le
 *              brouillon est levé : aucune retouche à ne pas
 *              oublier.
 *
 * Dans `p`, `bullets`, `steps`, `note` et `ref`, le texte accepte
 * du gras en ligne écrit **entre deux paires d'astérisques**,
 * exactement comme dans le markdown source. Le renderer s'en charge.
 */
export type AideBlock =
  | Block
  | { type: "steps"; items: string[] }
  | {
      type: "note";
      tone?: "neutral" | "red" | "yellow" | "green";
      title?: string;
      text: string;
    }
  | { type: "ref"; requires: string; text: string };

/**
 * Un article = une question et sa réponse.
 *
 * `id` est la CLÉ du système : il vient du document source
 * (BASE-01, SECU-04, ORPH-02, PAR-03), sert d'ancre URL en
 * minuscules (`/aide#secu-04`), et est cherchable tel quel dans la
 * barre de recherche. C'est ce qui permet de dire « va voir
 * SECU-04 » en support.
 *
 * `keywords` porte les synonymes que l'utilisateur tapera mais qui
 * n'apparaissent pas dans le texte (« mot de passe », « rembourser
 * »). C'est ce qui remplace une librairie de recherche floue.
 *
 * `draft` retire l'article de TOUT ce qui est public : la page, la
 * recherche, le JSON-LD et le compteur d'articles. Le filtrage est
 * fait en un seul endroit (`visibleSections` dans lib/aide/search.ts)
 * pour qu'aucune surface ne puisse l'oublier. En développement, un
 * brouillon reste affiché avec un bandeau « BROUILLON » afin de
 * pouvoir le relire ; en production il n'est jamais rendu.
 */
export type AideArticle = {
  id: string;
  question: string;
  keywords?: string[];
  draft?: boolean;
  blocks: AideBlock[];
};

/**
 * Une section = un regroupement thématique d'articles.
 *
 * `id` est un slug stable (« secu », « orph ») utilisé comme ancre
 * de section dans le sommaire. Il reprend le code du document
 * source en minuscules.
 *
 * `intro` porte le texte qui, dans le document source, précède le
 * premier article d'une section. C'est une LISTE DE BLOCS et non
 * une simple phrase, parce que deux de ces introductions sont des
 * tableaux (CONS et VOIR) et non de la prose.
 */
export type AideSection = {
  id: string;
  title: string;
  intro?: AideBlock[];
  articles: AideArticle[];
};
