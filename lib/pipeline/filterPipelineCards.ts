/* ═══════════════════════════════════════════════════════════════
   filterPipelineCards — LES FACETTES du pipeline, pour les deux surfaces
   (Lot 2b). Jumeau pur de sortPipelineCards : aucune dépendance React,
   aucun accès réseau, une entrée décrite par ses champs.

   ── LA COMPOSITION ─────────────────────────────────────────────────────
   OU À L'INTÉRIEUR D'UNE FACETTE, ET ENTRE LES FACETTES. « RB ou WR » ET
   « promo 2027 » ET « Capitale-Nationale ». C'est la seule combinaison qui
   corresponde à la façon dont un recruteur formule sa recherche ; le
   simple-choix par facette l'obligerait à deux passes pour deux positions.

   Une facette sans sélection ne filtre RIEN — ce n'est pas un « tout
   décoché » qui viderait l'écran.

   L'ORDRE DES OPÉRATIONS est fixé ailleurs mais mérite d'être dit ici :
   FILTRER PUIS TRIER. sortPipelineCards s'applique au résultat de cette
   fonction, jamais l'inverse — trier 15 cartes pour n'en garder 2 est du
   travail jeté, et les « flaggués d'abord » doivent s'entendre sur ce qui
   reste visible, pas sur ce qui a été écarté.

   ── « NON RENSEIGNÉ » EST UNE VALEUR, PAS UN TROU ──────────────────────
   Une carte sans école, sans position ou sans promotion porte UNSET_VALUE
   et apparaît dans la liste des choix, avec son compteur, dès qu'au moins
   une carte la porte. Trois raisons, et la troisième est la vraie :
     1. aucune exclusion silencieuse — la carte est sélectionnable, pas
        invisible ;
     2. la somme des options couvre toujours 100 % des cartes, donc le
        compteur « X sur Y » se vérifie à l'oeil ;
     3. ça SE VOIT. « Non renseigné (3) » sur la facette École est un
        signal de données incomplètes. Un filtre qui avale ces cartes en
        silence transforme un défaut de données en défaut de confiance.

   D'où viennent les valeurs absentes (relevé prod, 2026-09-04) :
   `school_id` NULL (ligue civile ou sans attache), `position_id` NULL,
   `annee_diplomation` NULL — et surtout la carte dont l'athlète n'est plus
   `status = 'ACTIF'` : la RPC ne rend AUCUNE ligne pour elle, tous ses
   champs retombent sur "" / 0 dans usePipelineCards, et elle reste pourtant
   affichée. C'est celle-là que « Non renseigné » empêche de disparaître.

   Le masquage d'identité free tier, lui, NE TOUCHE AUCUNE de ces cinq
   facettes : recruiter_athlete_cards ne masque que first_name, last_name,
   photo_url et numero_jersey. École, région, promo, position et sport
   sortent du CASE. Vérifié sur la définition de la RPC avant d'écrire une
   ligne — c'était la condition posée à l'ouverture du lot.
═══════════════════════════════════════════════════════════════ */

export type FacetKey = "sport" | "position" | "graduation_year" | "school" | "region";

/** Sentinelle « Non renseigné ». Encadrée de doubles tirets bas : aucune
 *  valeur venue de la base (nom d'école, position, région) ne prend cette
 *  forme, et elle reste lisible dans un log ou un state React. */
export const UNSET_VALUE = "__NON_RENSEIGNE__";

export const UNSET_LABEL = "Non renseigné";

export interface FacetDef {
  key: FacetKey;
  /** Titre de la facette, en tête de son menu. */
  label: string;
  /** Libellé de la pilule quand rien n'est coché — « Tous les sports ».
   *  Même formulation que la barre de la page Recherche. */
  allLabel: string;
}

/* Le SPORT est une facette comme les autres — il n'a plus son sélecteur
   séparé. Deux mécaniques de filtrage dans la même barre, c'était une de
   trop : le « Réinitialiser » n'en couvrait qu'une moitié dans la tête de
   l'utilisateur, et le compteur n'aurait pas su quoi compter. */
export const FACETS: readonly FacetDef[] = [
  { key: "sport", label: "Sport", allLabel: "Tous les sports" },
  { key: "position", label: "Position", allLabel: "Toutes les positions" },
  { key: "graduation_year", label: "Promotion", allLabel: "Toutes les promotions" },
  { key: "school", label: "École / ligue", allLabel: "Toutes les écoles" },
  { key: "region", label: "Région", allLabel: "Toutes les régions" },
] as const;

/** Les seuls champs que le filtre lit. Tout est optionnel — voir l'en-tête. */
export interface FilterablePipelineCard {
  sport?: string;
  position?: string;
  graduation_year?: number;
  school?: string;
  region?: string;
  /** schools.type — sert au LIBELLÉ, jamais au filtrage : il distingue une
   *  ligue civile d'une école secondaire dans une liste où les deux se
   *  côtoient sous le même nom de facette. */
  school_type?: string | null;
  /* ── Lus par la recherche par nom et les chips rapides ─────────────── */
  full_name?: string;
  flagged?: boolean;
  grade?: string | null;
  coach_rating?: number;
  has_video?: boolean;
  /** `recruiter_pipeline.next_action_at` — une DATE, pas un timestamp (même
   *  remarque que sortPipelineCards) : sert la chip « relance ». */
  next_action_at?: string | null;
}

/* ── LES CHIPS RAPIDES ──────────────────────────────────────────────────
   Des prédicats booléens, pas des facettes : ils ne se déclinent pas en
   valeurs et n'ont donc ni menu ni « Non renseigné ». Cumulables entre eux
   ET avec les facettes, sur le même ET général.

   « PRIORITAIRES » A ÉTÉ RETIRÉE DE LA BARRE (arbitrage BP, 2026-09-04) :
   le GRADE absorbe la priorisation — un athlète prioritaire est un athlète
   bien noté, et deux mécaniques pour dire la même chose en font une de trop.
   La chip est retirée de QUICK_FILTERS, donc de l'écran.

   Le prédicat `flagged` reste défini juste en dessous, VOLONTAIREMENT : le
   sort du reste de la fonctionnalité `flagged` (colonne, tri « flaggués
   d'abord », toggle des panneaux, point rouge des cartes) est en cours
   d'arbitrage. Rien d'autre n'a été retiré. Remettre la chip = remettre une
   ligne dans le tableau ci-dessous. */
export type QuickKey = "flagged" | "graded" | "rating4" | "video" | "relance";

export const QUICK_FILTERS: readonly { key: QuickKey; label: string }[] = [
  { key: "graded", label: "Avec grade" },
  { key: "rating4", label: "4+ étoiles" },
  { key: "video", label: "Avec vidéo" },
  { key: "relance", label: "À relancer" },
] as const;

/** AAAA-MM-JJ du jour, en local — même technique que RelancesDuJour.tsx :
 *  comparaison de CHAÎNES sur `next_action_at` (une DATE), jamais de
 *  re-parsing qui rouvrirait un débat de fuseau horaire. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const QUICK_PREDICATES: Record<QuickKey, (c: FilterablePipelineCard) => boolean> = {
  flagged: (c) => !!c.flagged,
  graded: (c) => !!c.grade,
  rating4: (c) => (c.coach_rating ?? 0) >= 4,
  video: (c) => !!c.has_video,
  /** Due = aujourd'hui ou en retard, même seuil que la carte « Relances
   *  aujourd'hui » du dashboard (`<=`, pas `<`). */
  relance: (c) => !!c.next_action_at && c.next_action_at.slice(0, 10) <= todayKey(),
};

/** Filtres qui ne se rangent pas en facettes. Passés à part pour que la
 *  signature de `filterPipelineCards(cards, filters)` reste valable là où
 *  ces filtres n'existent pas encore. */
export interface ExtraFilters {
  search?: string;
  quick?: readonly QuickKey[];
}

/** Repli de casse ET d'accents : « Léveillé » se trouve en tapant
 *  « leveille ». Sans le dépliage NFD, un recruteur au clavier anglais ne
 *  retrouverait aucun de ses athlètes québécois. */
function normalize(v: string): string {
  return v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function matchesExtra(card: FilterablePipelineCard, extra?: ExtraFilters): boolean {
  if (!extra) return true;
  const needle = extra.search ? normalize(extra.search) : "";
  if (needle && !normalize(card.full_name ?? "").includes(needle)) return false;
  for (const k of extra.quick ?? []) {
    if (!QUICK_PREDICATES[k](card)) return false;
  }
  return true;
}

export type PipelineFilters = Record<FacetKey, string[]>;

export const EMPTY_FILTERS: PipelineFilters = {
  sport: [],
  position: [],
  graduation_year: [],
  school: [],
  region: [],
};

/** Valeur de facette d'une carte. Chaîne vide, 0 et absence donnent tous
 *  UNSET_VALUE : « 0 » n'est pas une promotion, c'est un champ jamais
 *  renseigné que usePipelineCards a replié sur un nombre. */
export function facetValue(card: FilterablePipelineCard, key: FacetKey): string {
  switch (key) {
    case "sport":
      return card.sport?.trim() || UNSET_VALUE;
    case "position":
      return card.position?.trim() || UNSET_VALUE;
    case "graduation_year":
      return card.graduation_year && card.graduation_year > 0
        ? String(card.graduation_year)
        : UNSET_VALUE;
    case "school":
      return card.school?.trim() || UNSET_VALUE;
    case "region":
      return card.region?.trim() || UNSET_VALUE;
  }
}

function facetLabel(card: FilterablePipelineCard, key: FacetKey, value: string): string {
  if (value === UNSET_VALUE) return UNSET_LABEL;
  // Une ligue civile et une école secondaire se ressemblent dans la liste :
  // toutes deux sont une ligne de `schools`. Le suffixe lève l'ambiguïté.
  if (key === "school" && card.school_type === "LIGUE_CIVILE") return `${value} · ligue`;
  return value;
}

function matchesFacet(
  card: FilterablePipelineCard,
  key: FacetKey,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true; // facette inactive = tout passe
  return selected.includes(facetValue(card, key));
}

export function filterPipelineCards<T extends FilterablePipelineCard>(
  cards: T[],
  filters: PipelineFilters,
  extra?: ExtraFilters,
): T[] {
  return cards.filter(
    (card) =>
      FACETS.every((f) => matchesFacet(card, f.key, filters[f.key])) && matchesExtra(card, extra),
  );
}

export function activeFilterCount(filters: PipelineFilters, extra?: ExtraFilters): number {
  const facets = FACETS.reduce((n, f) => n + filters[f.key].length, 0);
  return facets + (extra?.quick?.length ?? 0) + (extra?.search?.trim() ? 1 : 0);
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/* Les compteurs sont calculés sur les cartes filtrées par les AUTRES
   facettes, jamais par celle qu'on compte. Conséquence voulue : cocher
   « RB » ne fait pas tomber les autres positions à zéro — on continue de
   voir combien de WR on ajouterait. Compter sur l'ensemble non filtré
   promettrait des résultats que les autres facettes rendraient vides ;
   compter en incluant la facette elle-même ne montrerait plus que ce qui
   est déjà coché. C'est le compromis des facettes de e-commerce, pour la
   même raison. */
export function facetOptions<T extends FilterablePipelineCard>(
  cards: T[],
  key: FacetKey,
  filters: PipelineFilters,
  extra?: ExtraFilters,
): FacetOption[] {
  /* La recherche par nom et les chips rapides entrent DANS le calcul des
     compteurs : taper « trem » doit ramener les nombres à ce que ce nom
     laisse réellement passer, sinon la barre promet des cartes que l'écran
     ne montre pas. Seule la facette qu'on compte est exclue. */
  const base = cards.filter(
    (card) =>
      FACETS.filter((f) => f.key !== key).every((f) => matchesFacet(card, f.key, filters[f.key])) &&
      matchesExtra(card, extra),
  );

  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const card of base) {
    const v = facetValue(card, key);
    counts.set(v, (counts.get(v) ?? 0) + 1);
    if (!labels.has(v)) labels.set(v, facetLabel(card, key, v));
  }

  /* Une valeur COCHÉE reste affichée même si les autres facettes la
     ramènent à zéro — sinon son chip disparaît et plus personne ne peut la
     décocher : l'utilisateur est enfermé dans un filtre devenu invisible. */
  for (const v of filters[key]) {
    if (!counts.has(v)) {
      counts.set(v, 0);
      labels.set(v, v === UNSET_VALUE ? UNSET_LABEL : v);
    }
  }

  const options: FacetOption[] = Array.from(counts, ([value, count]) => ({
    value,
    count,
    label: labels.get(value) ?? value,
  }));

  options.sort((a, b) => {
    if (a.value === UNSET_VALUE) return 1; // « Non renseigné » toujours en fin
    if (b.value === UNSET_VALUE) return -1;
    if (key === "graduation_year") return Number(a.value) - Number(b.value);
    return a.label.localeCompare(b.label, "fr");
  });

  return options;
}

/** Une facette ne mérite d'être offerte que s'il y a un choix à faire :
 *  une seule valeur possible ne filtre rien, elle occupe de la place.
 *
 *  ⚠ NE PAS APPLIQUER AU RÉSULTAT DE `facetOptions()` POUR DÉCIDER SI LA
 *  PILULE EXISTE — utiliser `isFacetOffered()`. Voir le commentaire là-bas :
 *  cette fonction juge une LISTE, pas une facette, et la liste rétrécit avec
 *  le contexte. */
export function isFacetUseful(options: FacetOption[]): boolean {
  return options.length > 1;
}

/* LE JEU DE PILULES DOIT ÊTRE STABLE — bug relevé le 2026-09-04.
   Décider de l'existence d'une pilule à partir de `facetOptions()` la faisait
   DISPARAÎTRE en cours de filtrage : les options sont comptées sur les cartes
   filtrées par les AUTRES facettes, donc cocher « Basketball » (2 cartes)
   ramenait Promotion et Région à une seule valeur chacune, et leurs pilules
   s'évaporaient de la barre. Vu de l'utilisateur : « quand j'en ajoute un, le
   reste disparaît ».

   Pire que cosmétique : une facette qui disparaît AVEC une sélection active
   continue de filtrer sans plus rien afficher — l'utilisateur est enfermé
   dans un filtre invisible, exactement le piège que `facetOptions` évite déjà
   au niveau des valeurs cochées.

   La pilule existe donc si la facette a plus d'une valeur SUR L'ENSEMBLE des
   cartes — un jugement qui ne dépend d'aucun filtre — ou si elle porte une
   sélection. Ce qui varie avec le contexte, c'est le CONTENU du menu, jamais
   la présence de la pilule. */
export function isFacetOffered<T extends FilterablePipelineCard>(
  cards: T[],
  key: FacetKey,
  filters: PipelineFilters,
): boolean {
  if (filters[key].length > 0) return true;
  const seen = new Set<string>();
  for (const card of cards) {
    seen.add(facetValue(card, key));
    if (seen.size > 1) return true;
  }
  return false;
}

/** Coche / décoche une valeur, sans muter l'état source. */
export function toggleFacetValue(
  filters: PipelineFilters,
  key: FacetKey,
  value: string,
): PipelineFilters {
  const current = filters[key];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return { ...filters, [key]: next };
}
