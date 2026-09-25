/* ═══════════════════════════════════════════════════════════════
   triTableau — le tri PAR EN-TÊTE de la vue tableau de « Mon processus »
   (décision BP 2026-09-24), « comme dans Excel ».

   · Toutes les colonnes se trient. Un clic : croissant ; un second :
     décroissant ; et ainsi de suite. Une flèche marque l'en-tête actif.
   · Côté client, sur le jeu complet affiché (la page ne pagine pas).
   · Les cases VIDES (pas de relance, pas de division, pas de cote…) vont
     TOUJOURS à la fin, dans les deux sens — comme Excel. Un tri décroissant
     des relances ne doit pas remonter les athlètes sans relance en tête.
   · À égalité : dernière activité d'abord (même repli que sortPipelineCards).

   SYNCHRONISATION avec le menu « Trier : … » : quand un mode du menu
   correspond à une colonne et un sens, les deux restent un seul état
   (MODE_VERS_TRI / triVersMode). Les autres tris (#, Position, École,
   Division, Taille, Poids, Étape, Visite, Faits saillants, Note) sont des
   tris de tableau seulement.

   Pur : rend un NOUVEAU tableau (une carte du cache TanStack triée en place
   muterait le cache — même précaution que sortPipelineCards).
═══════════════════════════════════════════════════════════════ */

import { gradeRank, type Grade } from "@/lib/config/grades";
import type { PipelineSortMode } from "@/lib/pipeline/sortPipelineCards";

export type SensTri = "asc" | "desc";
export interface TriTableau { cle: string; sens: SensTri }

/** Ce que le tri lit d'une carte (tous optionnels, comme sortPipelineCards). */
export interface CarteTriable {
  full_name?: string;
  jersey?: string;
  position?: string;
  graduation_year?: number;
  school?: string;
  noTeam?: boolean;
  division_equipe?: string | null;
  taille_pieds?: number | null;
  taille_pouces?: number | null;
  poids_lbs?: number | null;
  coach_rating?: number;
  grade?: Grade | null;
  status?: string;
  next_action_at?: string | null;
  visit_at?: string | null;
  has_video?: boolean;
  derniere_note?: { created_at: string } | null;
  moved_at?: string | null;
}

const ORDRE_ETAPE: Record<string, number> = {
  identifie: 1, contacte: 2, en_discussion: 3, visite_planifiee: 4, engage: 5, lettre_signee: 6, retire: 7,
};

const texte = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const temps = (v: string | null | undefined) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

/** La valeur de tri d'une colonne ; `null` = case vide (toujours à la fin). */
export function valeurTri(cle: string, c: CarteTriable): string | number | null {
  switch (cle) {
    case "nom": return texte(c.full_name);
    case "numero": {
      const n = parseInt(c.jersey ?? "", 10);
      return Number.isFinite(n) ? n : null;
    }
    case "position": return texte(c.position);
    case "promotion": return c.graduation_year && c.graduation_year > 0 ? c.graduation_year : null;
    case "ecole": return c.noTeam ? "Ligue civile" : texte(c.school);
    case "division": return texte(c.division_equipe);
    case "taille": return c.taille_pieds ? c.taille_pieds * 12 + (c.taille_pouces ?? 0) : null;
    case "poids": return c.poids_lbs ? c.poids_lbs : null;
    case "cote": return c.coach_rating && c.coach_rating > 0 ? c.coach_rating : null;
    // gradeRank : 0 = meilleur. Inversé pour que « croissant » monte du plus
    // faible au meilleur, comme une échelle.
    case "grade": return c.grade ? -gradeRank(c.grade) : null;
    case "etape": return c.status ? ORDRE_ETAPE[c.status] ?? null : null;
    case "relance": return temps(c.next_action_at);
    case "visite": return temps(c.visit_at);
    case "video": return c.has_video ? 1 : null;
    case "note": return temps(c.derniere_note?.created_at);
    default: return null;
  }
}

const COLLATOR = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

function comparerValeurs(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return COLLATOR.compare(String(a), String(b));
}

function repliActivite(a: CarteTriable, b: CarteTriable): number {
  return (temps(b.moved_at) ?? 0) - (temps(a.moved_at) ?? 0);
}

/** Trie par une colonne. Rend un nouveau tableau. */
export function trierTableau<T extends CarteTriable>(cartes: T[], tri: TriTableau): T[] {
  const signe = tri.sens === "asc" ? 1 : -1;
  return cartes.slice().sort((a, b) => {
    const va = valeurTri(tri.cle, a);
    const vb = valeurTri(tri.cle, b);
    if (va === null && vb === null) return repliActivite(a, b);
    if (va === null) return 1;          // vide : toujours à la fin
    if (vb === null) return -1;
    const d = comparerValeurs(va, vb) * signe;
    return d !== 0 ? d : repliActivite(a, b);
  });
}

/** Le clic sur un en-tête : croissant, puis décroissant, puis croissant… */
export function triApresClic(actuel: TriTableau | null, cle: string): TriTableau {
  if (actuel && actuel.cle === cle) return { cle, sens: actuel.sens === "asc" ? "desc" : "asc" };
  return { cle, sens: "asc" };
}

/** Modes du menu « Trier » qui ont leur colonne. « Dernière activité » n'en
 *  a pas : c'est le tri par défaut, sans flèche. */
export const MODE_VERS_TRI: Partial<Record<PipelineSortMode, TriTableau>> = {
  name_asc: { cle: "nom", sens: "asc" },
  rating_desc: { cle: "cote", sens: "desc" },
  grade_desc: { cle: "grade", sens: "desc" },
  next_action_asc: { cle: "relance", sens: "asc" },
  graduation_asc: { cle: "promotion", sens: "asc" },
};

/** Le mode du menu qui correspond à un tri d'en-tête, s'il existe. */
export function triVersMode(tri: TriTableau | null): PipelineSortMode | null {
  if (!tri) return null;
  for (const [mode, t] of Object.entries(MODE_VERS_TRI) as [PipelineSortMode, TriTableau][]) {
    if (t.cle === tri.cle && t.sens === tri.sens) return mode;
  }
  return null;
}
