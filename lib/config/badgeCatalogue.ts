/* ═══════════════════════════════════════════════════════════════
   Catalogue des 22 badges — chargement et résolution.

   Calqué sur lib/evaluations/grilles.ts : lecture MÉMORISÉE au niveau
   module, donc N pickers montés simultanément ne déclenchent qu'un seul
   aller-retour. Aucune dépendance framework ici — la résolution est pure,
   donc testable en Node sans React ni base. Le hook vit dans le composant.

   SOURCE DE VÉRITÉ : la table public.badges et sa table de liaison
   public.badge_sports, elles-mêmes alignées sur badges-catalogue-final.json.
   Rien n'est câblé en dur ici : ni les libellés, ni les familles, ni les
   rattachements de sport, ni la forme du contexte.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BadgeFamille = "universel" | "sport" | "honneur";
export type ContexteForme = "stat_annee" | "annee" | "libre";

/** Une entrée telle que le picker la manipule. `contexte` est UNE chaîne —
 *  c'est déjà le format de athlete_badges.contexte, et le picker la compose. */
export interface BadgeEntry {
  code: string;
  contexte?: string | null;
}

export interface BadgeCatalogueEntry {
  code: string;
  libelle: string;
  famille: BadgeFamille;
  ordre: number;
  actif: boolean;
  requiertContexte: boolean;
  contexteForme: ContexteForme | null;
  /** Vide pour universel et honneur : ils valent pour tous les sports. */
  sportIds: readonly string[];
}

export interface BadgeCatalogue {
  ok: boolean;
  all: readonly BadgeCatalogueEntry[];
  byCode: ReadonlyMap<string, BadgeCatalogueEntry>;
}

export const EMPTY_BADGE_CATALOGUE: BadgeCatalogue = Object.freeze({
  ok: false, all: [], byCode: new Map<string, BadgeCatalogueEntry>(),
});

/** Plafond des familles plafonnées (universel + sport). Les HONNEURS en sont
 *  exempts — même règle que le trigger badge_plafond en base. Les deux
 *  doivent rester d'accord : ici c'est du confort d'interface, la base est
 *  ce qui fait autorité. */
export const PLAFOND_PLAFONNES = 5;

/**
 * Plafond d'AFFICHAGE. À ne pas confondre avec PLAFOND_PLAFONNES.
 *
 * MAX_BADGES = 5 servait aux deux : limiter la saisie ET tronquer les
 * surfaces de lecture. Depuis que les honneurs échappent au plafond, un
 * athlète peut légitimement porter 5 plafonnés + plusieurs honneurs — les
 * surfaces en cachaient alors une partie EN SILENCE. Un coach qui attribue
 * un 6e badge et ne le voit pas apparaître conclut que l'attribution a
 * échoué.
 *
 * 10 = les 5 plafonnés + les 5 types d'honneur. Couvre tout cas non
 * pathologique ; au-delà (mêmes honneurs répétés sur plusieurs millésimes)
 * la troncature redevient un choix d'affichage assumé, pas un accident.
 */
export const MAX_BADGES_AFFICHES = 10;


export const TITRE_SECTION: Readonly<Record<BadgeFamille, string>> = Object.freeze({
  universel: "Universels",
  sport: "Spécifiques au sport",
  honneur: "Honneurs",
});

/** Ordre d'affichage des sections. Les honneurs en dernier : ils réclament
 *  un contexte, donc de la saisie, et c'est la section qui porte la mention
 *  « hors plafond ». */
export const ORDRE_SECTIONS: readonly BadgeFamille[] = Object.freeze([
  "universel", "sport", "honneur",
]);

export function estPlafonnee(famille: BadgeFamille): boolean {
  return famille !== "honneur";
}

/* ── Chargement ─────────────────────────────────────────────── */

let cache: Promise<BadgeCatalogue> | null = null;
let dejaSignale = false;

function signalerIndisponible(raison: string): void {
  if (dejaSignale) return;
  dejaSignale = true;
  console.warn(
    `NEXUS: catalogue de badges indisponible (${raison}). ` +
    `Le picker n'affichera aucun badge — il ne DEVINE pas de liste de repli, ` +
    `proposer un badge qui n'existe pas au catalogue serait pire que n'en proposer aucun.`,
  );
}

interface BadgeRow {
  id: string; code: string; libelle: string; famille: BadgeFamille;
  ordre: number; actif: boolean;
  requiert_contexte: boolean; contexte_forme: ContexteForme | null;
}

export function loadBadgeCatalogue(client?: SupabaseClient): Promise<BadgeCatalogue> {
  if (cache) return cache;

  const supabase = client ?? createClient();

  cache = (async (): Promise<BadgeCatalogue> => {
    const [badgesRes, liaisonRes] = await Promise.all([
      supabase.from("badges")
        .select("id, code, libelle, famille, ordre, actif, requiert_contexte, contexte_forme")
        .order("ordre"),
      supabase.from("badge_sports").select("badge_id, sport_id"),
    ]);

    const rows = (badgesRes.data ?? []) as unknown as BadgeRow[];
    if (badgesRes.error || rows.length === 0) {
      signalerIndisponible(badgesRes.error ? badgesRes.error.message : "0 badge");
      return EMPTY_BADGE_CATALOGUE;
    }

    /* Si la liaison est illisible, les badges de SPORT se retrouvent sans
       rattachement, donc filtrés pour tous les sports. C'est la dégradation
       voulue : mieux vaut n'en proposer aucun que d'en proposer un mauvais à
       un joueur de hockey. */
    const sportsParBadge = new Map<string, string[]>();
    for (const l of (liaisonRes.data ?? []) as { badge_id: string; sport_id: string }[]) {
      const liste = sportsParBadge.get(l.badge_id);
      if (liste) liste.push(l.sport_id);
      else sportsParBadge.set(l.badge_id, [l.sport_id]);
    }
    if (liaisonRes.error) {
      signalerIndisponible(`badge_sports illisible (${liaisonRes.error.message})`);
    }

    const all: BadgeCatalogueEntry[] = rows.map((r) => ({
      code: r.code,
      libelle: r.libelle,
      famille: r.famille,
      ordre: r.ordre,
      actif: r.actif,
      requiertContexte: r.requiert_contexte,
      contexteForme: r.contexte_forme,
      sportIds: sportsParBadge.get(r.id) ?? [],
    }));

    return {
      ok: true,
      all,
      byCode: new Map(all.map((b) => [b.code, b])),
    };
  })().catch((e: unknown) => {
    signalerIndisponible(e instanceof Error ? e.message : String(e));
    cache = null; // un échec ne se mémorise pas : le prochain montage réessaie
    return EMPTY_BADGE_CATALOGUE;
  });

  return cache;
}

/** Vide le cache module. Tests seulement. */
export function __resetBadgeCatalogueCache(): void {
  cache = null;
  dejaSignale = false;
}

/* ── Filtrage par sport ─────────────────────────────────────── */

/**
 * Les badges proposables pour un sport donné.
 *
 * DÉGRADATION VOULUE : sportId null, inconnu, ou sport « Autre » →
 * universels + honneurs SEULEMENT, jamais le catalogue entier. Sans cette
 * règle, un athlète de judo se verrait proposer « Bloqueur ».
 */
export function badgesPourSport(
  cat: BadgeCatalogue, sportId: string | null,
): BadgeCatalogueEntry[] {
  return cat.all.filter((b) =>
    b.actif && (b.famille !== "sport" || (!!sportId && b.sportIds.includes(sportId))),
  );
}

export interface SectionBadges {
  famille: BadgeFamille;
  titre: string;
  badges: BadgeCatalogueEntry[];
}

/** Les sections non vides, dans l'ordre universels → sport → honneurs. */
export function sectionsPourSport(
  cat: BadgeCatalogue, sportId: string | null,
): SectionBadges[] {
  const dispo = badgesPourSport(cat, sportId);
  return ORDRE_SECTIONS
    .map((famille) => ({
      famille,
      titre: TITRE_SECTION[famille],
      badges: dispo.filter((b) => b.famille === famille).sort((a, b) => a.ordre - b.ordre),
    }))
    .filter((s) => s.badges.length > 0);
}

/* ── Plafond ────────────────────────────────────────────────── */

export interface ComptesBadges {
  /** Universels + sport. Soumis à PLAFOND_PLAFONNES. */
  plafonnes: number;
  /** Honneurs. Non plafonnés. */
  honneurs: number;
}

export function compter(value: readonly BadgeEntry[], cat: BadgeCatalogue): ComptesBadges {
  let plafonnes = 0, honneurs = 0;
  for (const e of value) {
    const b = cat.byCode.get(e.code);
    if (!b) continue; // code hors catalogue : ne compte pour rien
    if (estPlafonnee(b.famille)) plafonnes++; else honneurs++;
  }
  return { plafonnes, honneurs };
}

/** Un badge NON sélectionné peut-il encore être ajouté ? */
export function peutAjouter(
  famille: BadgeFamille, comptes: ComptesBadges,
): boolean {
  return !estPlafonnee(famille) || comptes.plafonnes < PLAFOND_PLAFONNES;
}

/* ── Contexte : UNE chaîne libre ─────────────────────────────── */

/**
 * Séparateur des contextes HÉRITÉS (« Plaqués · 2025 »).
 *
 * Il n'est plus PRODUIT par la saisie — le coach écrit ce qu'il veut — mais
 * il reste dans les données déjà écrites, et rien ne les réécrit. Conservé
 * pour que ces contextes restent lisibles tels quels.
 */
export const SEP_CONTEXTE = " · ";

/**
 * Le placeholder du champ de contexte, choisi par contexte_forme.
 *
 * C'EST DÉSORMAIS LE SEUL RÔLE DE contexte_forme côté saisie. La colonne
 * reste en base et garde sa valeur ; elle ne CONTRAINT plus rien. Un
 * placeholder SUGGÈRE une convention, il ne l'impose pas : « saison 2026 »,
 * « 26 » et « 2026 » sont tous acceptés.
 *
 * POURQUOI ON A RENONCÉ À CONTRAINDRE
 * Les selects statistique + millésime existaient pour rendre les contextes
 * comparables — trier les meneurs d'une ligue par millésime, par exemple.
 * Ce tri n'est pas au programme, et ces badges servent à mettre en valeur,
 * pas à classer. Le coût du formulaire contraint était réel : trois champs
 * là où une phrase suffit, une statistique absente de SPORT_STATS
 * impossible à saisir proprement, et un millésime borné qui refuse
 * « 2025-26 ». Le contexte reste OBLIGATOIRE quand le badge l'exige ; c'est
 * sa FORME qui ne l'est plus.
 */
export const PLACEHOLDER_CONTEXTE: Readonly<Record<ContexteForme, string>> = Object.freeze({
  stat_annee: "ex. Plaqués · 2026",
  annee: "ex. 2026",
  libre: "Titre de la distinction",
});

export function placeholderContexte(forme: ContexteForme | null): string {
  return forme ? PLACEHOLDER_CONTEXTE[forme] : PLACEHOLDER_CONTEXTE.libre;
}

/**
 * Le contexte d'une entrée est-il suffisant pour être enregistré ?
 *
 * Reflète le trigger badge_contexte_requis, qui n'exige le contexte que pour
 * origine='saisie' — c'est-à-dire précisément ce que produit ce picker, le
 * seul chemin qui PEUT le demander. Le test est désormais « non vide », rien
 * de plus : aucune forme n'est vérifiée, ni ici ni en base.
 */
export function contexteComplet(
  b: BadgeCatalogueEntry, contexte: string | null | undefined,
): boolean {
  if (!b.requiertContexte) return true;
  return (contexte ?? "").trim().length > 0;
}

/** Les entrées dont le contexte manque — ce que l'appelant doit bloquer
 *  avant d'enregistrer, et ce que le picker signale à l'écran. */
export function entreesIncompletes(
  value: readonly BadgeEntry[], cat: BadgeCatalogue,
): BadgeEntry[] {
  return value.filter((e) => {
    const b = cat.byCode.get(e.code);
    return !!b && !contexteComplet(b, e.contexte);
  });
}

