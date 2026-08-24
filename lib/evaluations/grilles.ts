/* ═══════════════════════════════════════════════════════════════
   grilles — source de vérité UNIQUE des libellés des 14 critères
   d'évaluation.

   LE MODÈLE
   14 critères, toujours, sur toutes les surfaces. 9 libellés FIXES,
   câblés ici. 5 libellés VARIABLES, fournis par la grille de l'athlète
   (evaluation_grilles), rattachée à sa position (position_grille).

   LA DISTINCTION FIXE / VARIABLE EST INTERNE — elle ne doit JAMAIS
   transparaître à l'écran : pas de séparateur, pas de style à part, pas
   de libellé de groupe qui la trahisse. Les fonctions de ce module
   rendent les 14 critères DÉJÀ FUSIONNÉS et dans l'ordre d'affichage
   historique, précisément pour qu'aucun appelant n'ait à connaître la
   frontière. Elle est d'ailleurs invisible par construction : les 5
   fentes variables ne sont pas contiguës dans l'UI (competitivite /
   esprit_equipe / resilience vivent dans « Caractère », vision_du_jeu /
   sens_tactique dans « Intelligence sportive »).

   RÈGLE DE RÉSOLUTION
     1. evaluations.grille_id non NULL  → cette grille, point.
        C'est la grille FIGÉE au moment de la saisie : une éval passée
        garde ses libellés même si l'athlète change de position depuis.
     2. sinon athletes.position_id → position_grille → grille
     3. sinon (position NULL, ou position non rattachée) → GENERIQUE

   GENERIQUE porte les libellés historiques (Compétitivité, Esprit
   d'équipe, Résilience, Vision du jeu, Sens tactique). 84 des 120
   positions n'ont volontairement pas de rattachement : elles retombent
   dessus, et RIEN ne change pour elles. C'est la règle, pas un trou.

   INDEXATION
   Tout est indexé par NOM DE COLONNE DB (`vision_du_jeu`). Le reste du
   code manipule aussi un espace camelCase hérité du type
   AthleteTraitRatings (`gameVision`) : COLUMN_TO_CAMEL / CAMEL_TO_COLUMN
   et `traitListByCamel` font le pont. Ne pas introduire un 3e espace.

   CHARGEMENT
   Une seule requête pour les 3 tables, mémorisée au niveau module. Les
   3 portent une policy `public read USING (true)` (rôle `public`, donc
   anon ET authenticated), ce qui rend la résolution client-side possible
   sur TOUTES les surfaces — y compris la fiche partenaire, dont la RPC
   partner_athlete_profile ne projette pas position_id. Aucune branche
   par rôle, aucune RPC de plus.

   AUCUN LIBELLÉ VARIABLE N'EST CÂBLÉ ICI — sauf le filet de sécurité
   FALLBACK_*, utilisé uniquement quand le référentiel est INJOIGNABLE,
   et qui journalise bruyamment. Voir « DÉGRADATION » plus bas.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Les 9 critères FIXES ─────────────────────────────────────────
   Identiques sur toutes les grilles, tous les sports, tous les écrans.
   Ces libellés remplacent les 11 constantes locales (TRAIT_GROUPS /
   TRAIT_LIST / TRAIT_CHAMPS / TRAIT_LABELS / CHARACTER_TRAITS) qui
   avaient divergé entre surfaces. Les écarts corrigés au passage, sur
   arbitrage explicite :
     vitesse_explosivite  « Vitesse / Explosivité »  → « Vitesse »
     force_puissance      « Force / Puissance »      → « Puissance »
     endurance_cardio     « Endurance / Cardio » ET « Endurance cardio »
                                                     → « Endurance »
     attitude_mentalite   « Attitude / Mentalité »   → « Disponibilité »
     discipline           « Discipline » (recruteur/athlète) aligné sur
                          « Discipline / Éthique de travail » (coach)
   `resilience` n'est PAS ici : c'est une fente VARIABLE (slot 3). Sa
   variante « Résilience / Gestion de la pression » (create/page.tsx)
   disparaît donc aussi — GENERIQUE dit « Résilience ». */
export const FIXED_TRAIT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  leadership:           "Leadership",
  discipline:           "Discipline / Éthique de travail",
  coachabilite:         "Coachabilité",
  intelligence_jeu:     "Intelligence de jeu",
  attitude_mentalite:   "Disponibilité",
  vitesse_explosivite:  "Vitesse",
  force_puissance:      "Puissance",
  endurance_cardio:     "Endurance",
  agilite_coordination: "Agilité / Coordination",
});

/* ── Ordres d'affichage canoniques ────────────────────────────────
   Repris À L'IDENTIQUE de l'existant pour que le passage aux grilles
   ne déplace RIEN à l'écran. Un changement d'ordre trahirait la
   frontière fixe/variable aussi sûrement qu'un séparateur. */

/** Les 14 colonnes. L'ORDRE fait foi : 4 physiques, 5 fentes, 5 caractère —
 *  le même que le découpage groupé, à plat.
 *
 *  Un athlète ne doit pas voir ses critères dans un ordre sur sa fiche et dans
 *  un autre au formulaire. C'est pourquoi `traitList()` ne lit PAS cette
 *  constante pour ordonner : il aplatit `traitGroups()`, seule autorité. Les
 *  deux ne peuvent donc pas rediverger.
 *
 *  Les 5 fentes apparaissent ici dans l'ordre de repli (GENERIQUE) ; à
 *  l'exécution c'est `set.slotColumns`, lu dans evaluation_slots, qui tranche.
 *  Cette liste sert de RÉFÉRENTIEL D'APPARTENANCE (les 14 colonnes connues),
 *  pas de source d'ordre. */
export const TRAIT_COLUMNS: readonly string[] = Object.freeze([
  "vitesse_explosivite", "force_puissance", "endurance_cardio", "agilite_coordination",
  "competitivite", "esprit_equipe", "resilience", "vision_du_jeu", "sens_tactique",
  "leadership", "discipline", "coachabilite", "intelligence_jeu", "attitude_mentalite",
]);

/** Ordre groupé : DEUX groupes.
 *
 *  L'ancien découpage en trois (« Capacités athlétiques » / « Intelligence
 *  sportive » / « Caractère ») rangeait les 5 fentes variables selon leur
 *  ancien libellé GENERIQUE, pas selon ce qu'elles contiennent une fois la
 *  grille résolue. Résultat à l'écran : « Protection de passe », « Blocage de
 *  zone » et « Blocage individuel » sous « Caractère », « Jeu de pieds » sous
 *  « Intelligence sportive ». Le classement était figé sur des libellés qui
 *  n'existent plus dès qu'une grille de position s'applique.
 *
 *  Deux groupes suppriment le problème à la racine : ce qui se joue sur le
 *  terrain d'un côté, ce qui relève de la personne de l'autre. Les 5 fentes
 *  sont TOUJOURS du terrain, quel que soit leur libellé.
 *
 *  `slotsApres` : les colonnes de `evaluation_slots` sont insérées ICI, dans
 *  l'ordre des fentes, APRÈS les colonnes fixes du groupe. Elles ne sont pas
 *  citées en dur — les figer recréerait la dépendance que ce chantier retire,
 *  et le groupe se désaccorderait silencieusement si la table changeait.
 *
 *  ORDRE IMPOSÉ dans « Sur le terrain » : les 4 physiques d'abord (athlétisme
 *  général), les 5 de grille ensuite (spécifique au poste).
 *
 *  INVISIBILITÉ DE LA FRONTIÈRE : les 5 variables sont noyées dans un groupe
 *  de 9 dont les 4 premières sont fixes. Aucun titre, aucun style, aucun
 *  séparateur ne les isole, et TraitEntry ne porte AUCUN champ de provenance —
 *  un appelant ne peut pas distinguer une fixe d'une variable, même en le
 *  voulant. */
export const TRAIT_GROUP_SPEC: readonly {
  title: string;
  /** Colonnes fixes du groupe, dans l'ordre d'affichage. */
  fixedColumns: readonly string[];
  /** true = les fentes variables s'insèrent après les colonnes fixes. */
  slotsApres: boolean;
}[] = Object.freeze([
  { title: "Sur le terrain", slotsApres: true, fixedColumns: Object.freeze([
    "vitesse_explosivite", "force_puissance", "endurance_cardio", "agilite_coordination",
  ])},
  { title: "Caractère", slotsApres: false, fixedColumns: Object.freeze([
    "leadership", "discipline", "coachabilite", "intelligence_jeu", "attitude_mentalite",
  ])},
]);

/* ── Pont vers l'espace camelCase (type AthleteTraitRatings) ────── */
export const COLUMN_TO_CAMEL: Readonly<Record<string, string>> = Object.freeze({
  leadership:           "leadership",
  discipline:           "discipline",
  coachabilite:         "coachability",
  intelligence_jeu:     "gameIQ",
  competitivite:        "competitiveness",
  esprit_equipe:        "teamwork",
  resilience:           "resilience",
  attitude_mentalite:   "attitude",
  vitesse_explosivite:  "speed",
  force_puissance:      "power",
  endurance_cardio:     "endurance",
  agilite_coordination: "agility",
  vision_du_jeu:        "gameVision",
  sens_tactique:        "tactics",
});

export const CAMEL_TO_COLUMN: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(COLUMN_TO_CAMEL).map(([col, camel]) => [camel, col])),
);

/* ── CHEMIN SUGGESTION : athlete_suggestions.champ ────────────────
   `champ` porte DÉSORMAIS le nom de colonne. La migration
   20260824134148 accepte les deux espaces de clés côté trigger, et ces
   deux tables font la même chose côté client.

   LEGACY_CHAMP_BY_COLUMN reproduit À L'OCTET PRÈS les 14 littéraux du
   CASE de apply_approved_suggestion. Ils servent UNIQUEMENT à RELIRE ce
   que l'app mobile 1.2 en magasin continue d'émettre — jamais à écrire.
   NE PAS les « corriger » vers les nouveaux libellés : ce sont des clés
   de compatibilité, pas du texte affichable. Le texte affiché vient de
   traitLabels(), qui suit la grille.

   Une version distribuée ne se rappelle pas : tant que la 1.2 est en
   magasin, retirer une entrée d'ici casse la saisie de tous ses
   utilisateurs iOS et Android. */
export const LEGACY_CHAMP_BY_COLUMN: Readonly<Record<string, string>> = Object.freeze({
  leadership:           "Leadership",
  discipline:           "Discipline",
  coachabilite:         "Coachabilité",
  intelligence_jeu:     "Intelligence de jeu",
  competitivite:        "Compétitivité",
  esprit_equipe:        "Esprit d'équipe",
  resilience:           "Résilience",
  attitude_mentalite:   "Attitude / Mentalité",
  vitesse_explosivite:  "Vitesse / Explosivité",
  force_puissance:      "Force / Puissance",
  endurance_cardio:     "Endurance cardio",
  agilite_coordination: "Agilité / Coordination",
  vision_du_jeu:        "Vision du jeu",
  sens_tactique:        "Sens tactique",
});

const COLUMN_BY_LEGACY_CHAMP: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(LEGACY_CHAMP_BY_COLUMN).map(([col, lbl]) => [lbl, col])),
);

/** Le champ d'une suggestion de COTE GLOBALE. Pas un trait : pas de grille,
 *  pas de colonne dans evaluations.* — il vise evaluations.cote_globale. */
export const CHAMP_COTE_GLOBALE = "Cote globale";

/** Traduit un `champ` en nom de colonne, quel que soit l'espace de clés.
 *  Accepte le nom de colonne (ce qu'on écrit depuis 2026-08-24) ET le libellé
 *  FR historique (ce que la 1.2 en magasin émet encore). Rend null pour tout
 *  ce qui n'est pas un des 14 traits — 'Cote globale', 'Taille', 'Distinctions'
 *  compris : ce sont des champs valides, mais pas des traits. */
export function champToColumn(champ: string | null | undefined): string | null {
  if (!champ) return null;
  if (TRAIT_COLUMNS.includes(champ)) return champ;
  return COLUMN_BY_LEGACY_CHAMP[champ] ?? null;
}

/** True quand le champ se note sur 5 — les 14 traits ET la cote globale.
 *  Les deux espaces de clés sont acceptés. Remplace les listes qui
 *  s'arrêtaient aux 8 traits d'origine et laissaient les 6 ajoutés en juin
 *  2026 sans étoiles. */
export function isRatingChamp(champ: string | null | undefined): boolean {
  return champ === CHAMP_COTE_GLOBALE || champToColumn(champ) !== null;
}

/* ── DÉGRADATION — filet de sécurité, jamais un chemin normal ─────
   Utilisés SEULEMENT si le référentiel est injoignable (table vide,
   RLS inattendue, réseau, base locale sans les 3 migrations grilles).
   Ce sont les libellés de GENERIQUE : l'écran reste correct pour les
   sports non couverts, et « suffisamment correct » pour les autres.
   Chaque recours est JOURNALISÉ — voir logReferentialUnavailable. */
const FALLBACK_SLOT_COLUMNS: readonly string[] = Object.freeze([
  "competitivite", "esprit_equipe", "resilience", "vision_du_jeu", "sens_tactique",
]);

const FALLBACK_SLOT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  competitivite: "Compétitivité",
  esprit_equipe: "Esprit d'équipe",
  resilience:    "Résilience",
  vision_du_jeu: "Vision du jeu",
  sens_tactique: "Sens tactique",
});

/* ── Types ───────────────────────────────────────────────────────── */

export interface GrilleSlot {
  /** Libellé affiché. Toujours présent. */
  libelle: string;
  /** Infobulle. NULL sur les 14 grilles aujourd'hui — ne rien rendre
   *  tant que c'est null (décision produit, pas d'oubli). */
  definition: string | null;
}

export interface Grille {
  id: string;
  /** Clé stable lisible (FB-QB, GENERIQUE…). C'est elle qu'on cite, jamais l'uuid. */
  code: string;
  libelle: string;
  sportId: string | null;
  /** Index 0..4 = fentes 1..5, dans l'ordre de evaluation_slots. */
  slots: readonly GrilleSlot[];
  ordre: number;
  actif: boolean;
}

export interface GrilleSet {
  /** false = référentiel injoignable ou vide ; les FALLBACK_* sont en jeu. */
  readonly ok: boolean;
  readonly byId: ReadonlyMap<string, Grille>;
  readonly byCode: ReadonlyMap<string, Grille>;
  readonly positionToGrilleId: ReadonlyMap<string, string>;
  /** Index 0..4 → nom de colonne, LU depuis evaluation_slots. */
  readonly slotColumns: readonly string[];
  /** Grille GENERIQUE, ou null si le référentiel est injoignable. */
  readonly generique: Grille | null;
  /* ── Référentiel positions, pour les surfaces qui n'ont qu'un NOM ──
     Clés composites `${sportId}${valeur}` : le sport fait PARTIE
     de la clé, jamais un simple filtre optionnel. Voir resolvePositionId. */
  readonly sportIdByNom: ReadonlyMap<string, string>;
  readonly positionIdBySportAbbr: ReadonlyMap<string, string>;
  readonly positionIdBySportNom: ReadonlyMap<string, string>;
}

/** Un critère prêt à rendre. Rien n'y distingue fixe de variable. */
export interface TraitEntry {
  /** Nom de colonne DB — la clé stable, celle à envoyer en `champ`. */
  column: string;
  /** Clé camelCase héritée (AthleteTraitRatings). */
  camel: string;
  label: string;
  /** Infobulle, ou null. Ne rien rendre quand c'est null. */
  definition: string | null;
}

/** Ce qui identifie la grille d'un athlète, dans l'ordre de priorité. */
export interface GrilleRef {
  /** evaluations.grille_id — la grille FIGÉE à la saisie. Prioritaire. */
  grilleId?: string | null;
  /** athletes.position_id — repli quand grilleId est NULL. */
  positionId?: string | null;
}

/* ── Journalisation ──────────────────────────────────────────────
   Un référentiel vide ne doit JAMAIS passer inaperçu : sans ce bruit,
   tous les athlètes retombent silencieusement sur GENERIQUE et un test
   de fumée passe — c'est exactement le motif de panne muette déjà
   rencontré sur les vues partenaire. Le cas le plus probable est une
   base LOCALE sans les 3 migrations grilles (elles n'ont longtemps
   existé qu'en prod). */
let warnedUnavailable = false;

function logReferentialUnavailable(reason: string): void {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.error(
    `[grilles] NEXUS: référentiel de grilles INDISPONIBLE (${reason}). ` +
    `Les 14 critères retombent sur les libellés GENERIQUE câblés en dur ; ` +
    `aucun libellé de position ne sera affiché, et grille_id ne sera pas écrit. ` +
    `Cause la plus probable : base locale sans les migrations ` +
    `20260823021044 / 021127 / 021159. Vérifier : ` +
    `select count(*) from evaluation_grilles; -- attendu 14`,
  );
}

/** GrilleSet neutre : rend les 14 libellés de repli sans planter.
 *  Exporté pour servir d'état initial aux écrans (voir useGrilles). */
export const EMPTY_GRILLE_SET: GrilleSet = Object.freeze({
  ok: false,
  byId: new Map<string, Grille>(),
  byCode: new Map<string, Grille>(),
  positionToGrilleId: new Map<string, string>(),
  slotColumns: FALLBACK_SLOT_COLUMNS,
  generique: null,
  sportIdByNom: new Map<string, string>(),
  positionIdBySportAbbr: new Map<string, string>(),
  positionIdBySportNom: new Map<string, string>(),
});

/* ── Chargement, mémorisé au niveau module ───────────────────────
   Une seule requête pour la session : ~2 Ko de libellés statiques.
   La promesse elle-même est mémorisée, pas seulement son résultat, pour
   que N composants montés en même temps ne déclenchent qu'un aller-retour.
   Un échec N'EST PAS mémorisé — il vide le cache pour qu'un remontage
   puisse réessayer. */
let cache: Promise<GrilleSet> | null = null;

interface GrilleRow {
  id: string; code: string; libelle: string; sport_id: string | null;
  slot_1_libelle: string; slot_2_libelle: string; slot_3_libelle: string;
  slot_4_libelle: string; slot_5_libelle: string;
  slot_1_definition: string | null; slot_2_definition: string | null;
  slot_3_definition: string | null; slot_4_definition: string | null;
  slot_5_definition: string | null;
  ordre: number; actif: boolean;
}

function toGrille(r: GrilleRow): Grille {
  return {
    id: r.id,
    code: r.code,
    libelle: r.libelle,
    sportId: r.sport_id,
    slots: [
      { libelle: r.slot_1_libelle, definition: r.slot_1_definition },
      { libelle: r.slot_2_libelle, definition: r.slot_2_definition },
      { libelle: r.slot_3_libelle, definition: r.slot_3_definition },
      { libelle: r.slot_4_libelle, definition: r.slot_4_definition },
      { libelle: r.slot_5_libelle, definition: r.slot_5_definition },
    ],
    ordre: r.ordre,
    actif: r.actif,
  };
}

export function loadGrilles(client?: SupabaseClient): Promise<GrilleSet> {
  if (cache) return cache;

  const supabase = client ?? createClient();

  cache = (async (): Promise<GrilleSet> => {
    const [grillesRes, mappingRes, slotsRes, sportsRes, positionsRes] = await Promise.all([
      supabase.from("evaluation_grilles").select(
        "id, code, libelle, sport_id, " +
        "slot_1_libelle, slot_2_libelle, slot_3_libelle, slot_4_libelle, slot_5_libelle, " +
        "slot_1_definition, slot_2_definition, slot_3_definition, slot_4_definition, slot_5_definition, " +
        "ordre, actif",
      ),
      supabase.from("position_grille").select("position_id, grille_id"),
      supabase.from("evaluation_slots").select("slot, colonne").order("slot"),
      /* sports + positions : petits référentiels (12 / 120 lignes), même
         policy `public read USING (true)`. Servent UNIQUEMENT à retrouver
         un position_id quand la surface n'a qu'un nom ou une abréviation
         (formulaires coach : `primaryPosition` est une abréviation issue
         de lib/sports-data ; fiche partenaire : la RPC ne projette que
         position_nom). Voir resolvePositionId. */
      supabase.from("sports").select("id, nom"),
      supabase.from("positions").select("id, nom, abreviation, sport_id"),
    ]);

    const rows = (grillesRes.data ?? []) as unknown as GrilleRow[];
    if (grillesRes.error || rows.length === 0) {
      logReferentialUnavailable(grillesRes.error ? grillesRes.error.message : "0 grille");
      return EMPTY_GRILLE_SET;
    }

    const byId = new Map<string, Grille>();
    const byCode = new Map<string, Grille>();
    for (const row of rows) {
      const g = toGrille(row);
      byId.set(g.id, g);
      byCode.set(g.code, g);
    }

    const positionToGrilleId = new Map<string, string>();
    for (const m of (mappingRes.data ?? []) as { position_id: string; grille_id: string }[]) {
      positionToGrilleId.set(m.position_id, m.grille_id);
    }
    if (mappingRes.error) {
      // Non bloquant : sans mapping, tout le monde tombe sur GENERIQUE —
      // dégradation acceptable, mais qui doit s'entendre.
      logReferentialUnavailable(`position_grille illisible (${mappingRes.error.message})`);
    }

    /* Les 5 fentes sont LUES, jamais figées : figer la correspondance
       fente → colonne recréerait exactement le problème que ce chantier
       corrige. FALLBACK seulement si la table est vide/illisible. */
    const slotRows = (slotsRes.data ?? []) as { slot: number; colonne: string }[];
    let slotColumns: readonly string[];
    if (slotsRes.error || slotRows.length !== 5) {
      logReferentialUnavailable(
        slotsRes.error ? `evaluation_slots illisible (${slotsRes.error.message})`
                       : `${slotRows.length} fente(s) au lieu de 5`,
      );
      slotColumns = FALLBACK_SLOT_COLUMNS;
    } else {
      slotColumns = slotRows.slice().sort((a, b) => a.slot - b.slot).map((s) => s.colonne);
    }

    const generique = byCode.get("GENERIQUE") ?? null;
    if (!generique) logReferentialUnavailable("grille GENERIQUE absente");

    const sportIdByNom = new Map<string, string>();
    for (const s of (sportsRes.data ?? []) as { id: string; nom: string }[]) {
      sportIdByNom.set(s.nom, s.id);
    }
    const positionIdBySportAbbr = new Map<string, string>();
    const positionIdBySportNom = new Map<string, string>();
    for (const p of (positionsRes.data ?? []) as
         { id: string; nom: string; abreviation: string | null; sport_id: string | null }[]) {
      if (!p.sport_id) continue; // sans sport, la clé serait ambiguë : on n'indexe pas
      if (p.abreviation) positionIdBySportAbbr.set(posKey(p.sport_id, p.abreviation), p.id);
      positionIdBySportNom.set(posKey(p.sport_id, p.nom), p.id);
    }
    if (sportsRes.error || positionsRes.error) {
      logReferentialUnavailable(
        `référentiel positions illisible (${sportsRes.error?.message ?? positionsRes.error?.message})`,
      );
    }

    return {
      ok: true, byId, byCode, positionToGrilleId, slotColumns, generique,
      sportIdByNom, positionIdBySportAbbr, positionIdBySportNom,
    };
  })().catch((e: unknown) => {
    logReferentialUnavailable(e instanceof Error ? e.message : String(e));
    cache = null; // un échec ne se mémorise pas : le prochain montage réessaie
    return EMPTY_GRILLE_SET;
  });

  return cache;
}

/** Vide le cache module. Tests seulement. */
export function __resetGrillesCache(): void {
  cache = null;
  warnedUnavailable = false;
}

/* ── Résolution — PURE, sans I/O, donc testable sans base ────────── */

/** Clé composite sport+valeur. `::` ne peut apparaître dans un uuid,
 *  donc aucune collision de concaténation possible. */
function posKey(sportId: string, value: string): string {
  return `${sportId}::${value}`;
}

/** Retrouve un position_id à partir d'un NOM ou d'une ABRÉVIATION.
 *
 *  LE SPORT EST OBLIGATOIRE, et ce n'est pas de la prudence : 18
 *  abréviations sont partagées entre sports (« C » = Centre en
 *  Basketball, Football ET Flag football ; idem QB, S, RB, LB, WR…), et
 *  « Centre », « Maraudeur », « Quart-arrière », « Porteur de ballon »,
 *  « Secondeur » existent chacun dans deux ou trois sports. Sans le
 *  sport, une résolution par nom serait fausse environ une fois sur six
 *  — et silencieusement : elle rendrait un id valide, mais celui d'une
 *  position d'un autre sport, donc la mauvaise grille.
 *
 *  À l'INTÉRIEUR d'un sport, `abreviation` et `nom` sont tous deux
 *  uniques (vérifié : 0 doublon sur les 120 lignes). Le couple est donc
 *  une clé naturelle sûre.
 *
 *  Ordre de tentative — abréviation puis nom — identique à celui de
 *  resolveSportIds (saveAthlete.ts), pour que l'étiquette affichée dans
 *  le formulaire et la grille écrite à la sauvegarde ne divergent pas.
 *
 *  Rend null sans sport, sans valeur, ou sur non-résolution. Ne devine
 *  JAMAIS en ignorant le sport. */
export function resolvePositionId(
  set: GrilleSet,
  sportNom: string | null | undefined,
  positionKey: string | null | undefined,
): string | null {
  if (!sportNom || !positionKey) return null;
  const sportId = set.sportIdByNom.get(sportNom);
  if (!sportId) return null;
  return set.positionIdBySportAbbr.get(posKey(sportId, positionKey))
      ?? set.positionIdBySportNom.get(posKey(sportId, positionKey))
      ?? null;
}

/** Raccourci pour les surfaces qui n'ont qu'un couple (sport, position)
 *  textuel : résout l'id puis la grille, en une fois. */
export function resolveGrilleByName(
  set: GrilleSet,
  sportNom: string | null | undefined,
  positionKey: string | null | undefined,
): Grille | null {
  return resolveGrille(set, { positionId: resolvePositionId(set, sportNom, positionKey) });
}

/** Applique la règle : grille figée > position > GENERIQUE.
 *  Rend null quand le référentiel est injoignable. */
export function resolveGrille(set: GrilleSet, ref: GrilleRef): Grille | null {
  if (ref.grilleId) {
    const frozen = set.byId.get(ref.grilleId);
    if (frozen) return frozen;
    // grille_id pointant sur une grille inconnue (supprimée ?) : on ne
    // devine pas, on retombe sur la position puis GENERIQUE.
  }
  if (ref.positionId) {
    const gid = set.positionToGrilleId.get(ref.positionId);
    const byPos = gid ? set.byId.get(gid) : undefined;
    if (byPos) return byPos;
  }
  return set.generique;
}

/** Les 14 libellés, à plat, DÉJÀ FUSIONNÉS, indexés par colonne DB.
 *  Aucun appelant ne peut distinguer un fixe d'un variable. */
export function traitLabels(set: GrilleSet, ref: GrilleRef): Record<string, string> {
  const grille = resolveGrille(set, ref);
  const out: Record<string, string> = { ...FIXED_TRAIT_LABELS };
  set.slotColumns.forEach((column, i) => {
    out[column] = grille?.slots[i]?.libelle ?? FALLBACK_SLOT_LABELS[column] ?? column;
  });
  return out;
}

/** Idem, avec les infobulles. NULL partout aujourd'hui côté variable ;
 *  les 9 fixes n'en ont pas du tout. Ne rien rendre quand c'est null. */
export function traitDefinitions(set: GrilleSet, ref: GrilleRef): Record<string, string | null> {
  const grille = resolveGrille(set, ref);
  const out: Record<string, string | null> = {};
  for (const column of TRAIT_COLUMNS) out[column] = null;
  set.slotColumns.forEach((column, i) => {
    out[column] = grille?.slots[i]?.definition ?? null;
  });
  return out;
}

/** Table interne colonne -> critère rendu. Ne porte AUCUN ordre : l'ordre est
 *  décidé par TRAIT_GROUP_SPEC + set.slotColumns, en un seul endroit. */
function entriesByColumn(set: GrilleSet, ref: GrilleRef): Map<string, TraitEntry> {
  const labels = traitLabels(set, ref);
  const defs = traitDefinitions(set, ref);
  return new Map(TRAIT_COLUMNS.map((column) => [column, {
    column,
    camel: COLUMN_TO_CAMEL[column],
    label: labels[column],
    definition: defs[column],
  }]));
}

/** Les 14 critères à plat : « Sur le terrain » puis « Caractère », aplatis.
 *  DÉRIVÉ de traitGroups — donc rigoureusement le même ordre que le rendu
 *  groupé. Les surfaces qui affichent une liste et celles qui affichent deux
 *  blocs présentent les critères dans la même séquence. */
export function traitList(set: GrilleSet, ref: GrilleRef): TraitEntry[] {
  return traitGroups(set, ref).flatMap((g) => g.traits);
}

/** Les 14 critères groupés : « Sur le terrain » (9) puis « Caractère » (5).
 *
 *  Les colonnes de fentes viennent de `set.slotColumns` — donc de la table
 *  evaluation_slots — et non d'une liste figée ici. Le groupe suit la
 *  convention publiée en base, pas une copie qui pourrait dériver.
 *
 *  Une colonne inconnue de TRAIT_COLUMNS est ÉCARTÉE et journalisée plutôt
 *  que rendue comme un trou : l'ancien code faisait `byColumn.get(c)!`, une
 *  assertion qui aurait laissé passer un `undefined` jusqu'au JSX. */
export function traitGroups(
  set: GrilleSet,
  ref: GrilleRef,
): { title: string; traits: TraitEntry[] }[] {
  const byColumn = entriesByColumn(set, ref);
  return TRAIT_GROUP_SPEC.map((g) => {
    const columns = g.slotsApres ? [...g.fixedColumns, ...set.slotColumns] : [...g.fixedColumns];
    const traits: TraitEntry[] = [];
    for (const c of columns) {
      const entry = byColumn.get(c);
      if (entry) traits.push(entry);
      else console.error(`[grilles] NEXUS: colonne « ${c} » absente de TRAIT_COLUMNS — critère non rendu dans « ${g.title} ».`);
    }
    return { title: g.title, traits };
  });
}

/** Même liste, indexée par clé camelCase — pour les écrans qui lisent
 *  encore un AthleteTraitRatings. Transition, pas cible. */
export function traitListByCamel(
  set: GrilleSet,
  ref: GrilleRef,
): (TraitEntry & { key: string })[] {
  return traitList(set, ref).map((t) => ({ ...t, key: t.camel }));
}

/* ── Écriture : quelle grille figer dans evaluations.grille_id ─────
   Appelé par buildEvalRecord au moment de la sauvegarde. Rend l'id de
   la grille RÉELLEMENT utilisée pour la saisie — GENERIQUE comprise.

   POURQUOI GENERIQUE EST ÉCRITE EXPLICITEMENT, ET NON LAISSÉE À NULL :
   c'est toute la raison d'être de la colonne. Une éval saisie
   aujourd'hui sur GENERIQUE doit GARDER les libellés GENERIQUE si, dans
   six mois, la position de l'athlète reçoit une grille dédiée. Laisser
   NULL ferait repasser cette vieille éval par la résolution par
   position, donc changerait rétroactivement ses libellés — exactement
   la dérive que grille_id existe pour empêcher.

   ATTENTION — CECI CONTREDIT LE COMMENTAIRE DÉPLOYÉ sur la colonne
   (« NULL = GENERIQUE (repli appliqué par le frontend) »), écrit avant
   que le sens de figeage ne soit tranché. Avec ce module, NULL ne veut
   plus dire « GENERIQUE » mais « éval antérieure aux grilles, jamais
   renseignée » — ce qui est le cas des 5 lignes existantes, qu'on ne
   backfille pas. Le commentaire de colonne est à reprendre dans une
   migration de suite. À ARBITRER avant le câblage des écrans.

   Rend null quand le référentiel est injoignable : mieux vaut ne rien
   figer que figer une valeur devinée. */
export function grilleIdForSave(set: GrilleSet, positionId: string | null | undefined): string | null {
  if (!set.ok) return null;
  return resolveGrille(set, { positionId })?.id ?? null;
}
