/* ═══════════════════════════════════════════════════════════════
   lib/aide/search.ts — recherche du centre d'aide (chantier 5)

   Filtrage EN MÉMOIRE, zéro dépendance. À ~50 articles, une
   librairie de recherche serait du poids pur : l'index complet
   pèse quelques dizaines de kilo-octets et se scanne intégralement
   à chaque frappe sans que ça se voie.

   Trois règles qui font tout le travail utile :

   1. NORMALISATION SANS ACCENTS. Un parent tape « securite »,
      « verifie », « eleve ». Sans dépliage NFD, aucun de ces trois
      mots ne trouve son article. Le motif est celui déjà utilisé
      partout dans le dépôt (lib/queries/cegepSearch/scoring.ts,
      components/ui/SchoolSelect.tsx).

   2. TOUS LES JETONS DOIVENT MATCHER (ET, pas OU). « photo profil »
      doit rendre les articles qui parlent des deux, pas l'union
      bruyante de « photo » et de « profil ».

   3. CLASSEMENT À TROIS NIVEAUX, pas de BM25. Une correspondance
      dans la question vaut plus que dans l'identifiant/les
      synonymes, qui vaut plus que dans le corps.

   Les fonctions sont pures et sans dépendance React — elles sont
   utilisables au rendu serveur (le JSON-LD FAQPage de
   app/aide/layout.tsx passe par flattenBlocks).
═══════════════════════════════════════════════════════════════ */

import type { AideBlock, AideArticle, AideSection } from "@/content/aide/types";

/* ── Normalisation ────────────────────────────────────────────── */

/**
 * Minuscules + dépliage des accents. « Sécurité » → « securite ».
 *
 * `\p{Diacritic}` avec le drapeau `u` plutôt que la plage littérale
 * de combinantes : la source reste en ASCII pur, donc insensible à
 * toute mésaventure d'encodage (le dépôt en a un historique).
 * Même forme que lib/queries/cegepSearch/scoring.ts.
 */
export function normalizeAide(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Ancre URL d'un article : « SECU-04 » → « secu-04 ».
 * Toujours passer par cette fonction — l'identifiant est saisi en
 * majuscules dans le contenu, l'ancre est en minuscules, et les
 * deux doivent rester d'accord entre le sommaire, le titre de
 * l'article et le bouton « copier le lien ».
 */
export function articleAnchor(articleId: string): string {
  return articleId.toLowerCase();
}

/* ── Brouillons ───────────────────────────────────────────────── */

/**
 * Les articles `draft: true` sont rendus en développement (avec un
 * bandeau) et JAMAIS en production. `npm run build` et
 * `npm run build:mobile` tournent tous deux en NODE_ENV=production :
 * un brouillon n'atteint donc aucun artefact publié.
 */
export const SHOW_DRAFTS = process.env.NODE_ENV !== "production";

/**
 * Point de passage UNIQUE vers le contenu publiable.
 *
 * La page, la recherche, le compteur d'articles et le JSON-LD lisent
 * tous le résultat de cette fonction — jamais SECTIONS_AIDE
 * directement. Un seul filtre, donc aucune surface ne peut oublier
 * de l'appliquer et laisser fuir un brouillon.
 *
 * Une section vidée de tous ses articles est conservée si elle porte
 * une introduction, et retirée sinon.
 */
export function visibleSections(sections: AideSection[]): AideSection[] {
  if (SHOW_DRAFTS) return sections;

  const kept = sections.map((s) => ({
    ...s,
    articles: s.articles.filter((a) => !a.draft),
  }));

  // Un bloc `ref` cite un article. Si cet article n'a pas survécu au
  // filtre ci-dessus, le renvoi pointe vers du vide : on le retire.
  // Le jour où le brouillon est levé, le renvoi réapparaît seul —
  // il n'y a aucune retouche manuelle à ne pas oublier.
  const publishedIds = new Set(kept.flatMap((s) => s.articles.map((a) => a.id)));

  // Pas de récursion dans `subsection` : ses blocs sont typés
  // `Block[]` (l'union légale), qui ne contient pas `ref` — TypeScript
  // interdit déjà d'en imbriquer un là.
  const pruneRefs = (blocks: AideBlock[]): AideBlock[] =>
    blocks.filter((b) => b.type !== "ref" || publishedIds.has(b.requires));

  return kept
    .map((s) => ({
      ...s,
      intro: s.intro ? pruneRefs(s.intro) : undefined,
      articles: s.articles.map((a) => ({ ...a, blocks: pruneRefs(a.blocks) })),
    }))
    .filter((s) => s.articles.length > 0 || (s.intro?.length ?? 0) > 0);
}

/* ── Aplatissement des blocs en texte ─────────────────────────── */

/** Retire le gras en ligne (`**mot**`) — ni la recherche ni le
    JSON-LD n'ont à voir les astérisques du balisage source. */
function stripEmphasis(text: string): string {
  return text.replace(/\*\*/g, "");
}

/**
 * Réduit une liste de blocs au texte brut qu'ils contiennent.
 * Sert deux consommateurs : l'index de recherche (corps de
 * l'article) et le JSON-LD FAQPage (réponse en texte plat).
 *
 * Récursif — un bloc `subsection` porte ses propres blocs.
 */
export function flattenBlocks(blocks: AideBlock[]): string {
  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "p":
        out.push(block.text);
        break;
      case "bullets":
      case "steps":
        out.push(...block.items);
        break;
      case "note":
        if (block.title) out.push(block.title);
        out.push(block.text);
        break;
      case "ref":
        out.push(block.text);
        break;
      case "table":
        out.push(...block.headers, ...block.rows.flat());
        break;
      case "callout":
        if (block.title) out.push(block.title);
        out.push(block.text);
        break;
      case "definitions":
        for (const d of block.items) out.push(d.term, d.def);
        break;
      case "contact-card":
        for (const r of block.rows) out.push(r.label, r.value);
        break;
      case "subsection":
        out.push(block.title, flattenBlocks(block.blocks));
        break;
    }
  }

  return stripEmphasis(out.join(" "));
}

/* ── Index ────────────────────────────────────────────────────── */

export type AideIndexEntry = {
  article: AideArticle;
  sectionId: string;
  sectionTitle: string;
  /** Rang d'origine (ordre du document) — sert de départage stable. */
  order: number;
  /** Champs normalisés, calculés une seule fois. */
  haystacks: {
    question: string;
    /** Identifiant + synonymes + titre de section. */
    meta: string;
    body: string;
  };
};

/**
 * Construit l'index une fois pour toutes. À appeler dans un
 * useMemo au montage : le contenu est statique, il n'y a aucune
 * raison de refaire le travail à chaque frappe.
 */
export function buildAideIndex(sections: AideSection[]): AideIndexEntry[] {
  const entries: AideIndexEntry[] = [];
  let order = 0;

  for (const section of sections) {
    for (const article of section.articles) {
      entries.push({
        article,
        sectionId: section.id,
        sectionTitle: section.title,
        order: order++,
        haystacks: {
          question: normalizeAide(article.question),
          meta: normalizeAide(
            [article.id, ...(article.keywords ?? []), section.title].join(" "),
          ),
          body: normalizeAide(flattenBlocks(article.blocks)),
        },
      });
    }
  }

  return entries;
}

/* ── Recherche ────────────────────────────────────────────────── */

const WEIGHT_QUESTION = 3;
const WEIGHT_META = 2;
const WEIGHT_BODY = 1;

/**
 * Filtre + classe. Une requête vide rend l'index intact (l'appelant
 * affiche alors le centre d'aide complet, groupé par section).
 *
 * Un jeton qui ne se trouve nulle part exclut l'article : c'est la
 * règle du ET. Le score additionne, par jeton, le poids du meilleur
 * champ où il apparaît — un article dont la question porte les deux
 * mots passe donc devant un article qui les a éparpillés dans le
 * corps.
 */
export function searchAide(
  index: AideIndexEntry[],
  query: string,
): AideIndexEntry[] {
  const tokens = normalizeAide(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return index;

  const scored: { entry: AideIndexEntry; score: number }[] = [];

  for (const entry of index) {
    let score = 0;
    let matchesAll = true;

    for (const token of tokens) {
      let best = 0;
      if (entry.haystacks.question.includes(token)) best = WEIGHT_QUESTION;
      else if (entry.haystacks.meta.includes(token)) best = WEIGHT_META;
      else if (entry.haystacks.body.includes(token)) best = WEIGHT_BODY;

      if (best === 0) {
        matchesAll = false;
        break;
      }
      score += best;
    }

    if (matchesAll) scored.push({ entry, score });
  }

  // Tri par score décroissant, départagé par l'ordre du document —
  // deux articles également pertinents restent dans l'ordre où
  // l'auteur les a écrits, ce qui rend les résultats stables.
  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.entry.order - b.entry.order,
  );

  return scored.map((s) => s.entry);
}
