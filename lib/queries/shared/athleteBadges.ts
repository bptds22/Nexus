/* ═══════════════════════════════════════════════════════════════
   Lecture et écriture des badges d'un athlète — partagé par les 7 surfaces.

   Une seule définition du DÉCOUPAGE entre ce qu'un écran peut éditer et ce
   qu'il ne fait que montrer. Le refaire à la main sept fois garantirait
   qu'une surface finisse par diverger, et une divergence ici fait mentir
   l'écran : une case décochée que la base ne retire pas.

   Ce découpage épouse EXACTEMENT la portée de appliquer_badges_saisie, qui
   épouse elle-même la policy UPDATE de athlete_badges. Les trois doivent
   rester d'accord ; si vous en changez un, changez les trois.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeEntry } from "@/lib/config/badgeCatalogue";

export interface BadgesAthlete {
  /** Éditables par l'appelant : origine 'saisie' et attribués par lui
   *  (ou tous ceux de saisie s'il est admin). C'est ce qui part dans
   *  `value` du picker, et EXACTEMENT ce qui part dans la RPC. */
  miens: BadgeEntry[];
  /** Montrés, pas édités : ceux d'un autre coach, ceux issus d'une
   *  suggestion, ceux repris de l'ancien format. Ils comptent au plafond. */
  autres: BadgeEntry[];
}

export const BADGES_VIDES: BadgesAthlete = Object.freeze({ miens: [], autres: [] });

interface LigneBadge {
  contexte: string | null;
  attribue_par: string | null;
  origine: string;
  badges: { code: string } | { code: string }[] | null;
}

/** PostgREST rend l'embed tantôt objet, tantôt tableau selon la version. */
function codeDe(l: LigneBadge): string | null {
  const b = Array.isArray(l.badges) ? l.badges[0] : l.badges;
  return b?.code ?? null;
}

/**
 * Charge les badges VIVANTS d'un athlète, déjà découpés.
 *
 * `moi` : l'utilisateur courant. `estAdmin` : un admin édite tous les badges
 * de saisie, pas seulement les siens — comme la RPC et comme la policy.
 */
export type ModeBadges = "saisie" | "suggestion";

export async function chargerBadgesAthlete(
  supabase: SupabaseClient,
  athleteId: string,
  moi: string | null,
  estAdmin = false,
  mode: ModeBadges = "saisie",
): Promise<BadgesAthlete> {
  const { data, error } = await supabase
    .from("athlete_badges")
    .select("contexte, attribue_par, origine, badges(code)")
    .eq("athlete_id", athleteId)
    .is("retire_le", null);

  if (error) {
    /* On ne rend PAS un objet vide en silence : le picker croirait que
       l'athlète n'a aucun badge, et le premier enregistrement retirerait
       tout ce qu'il ne « voit » pas. Mieux vaut propager. */
    throw new Error(`NEXUS: lecture des badges impossible — ${error.message}`);
  }

  const miens: BadgeEntry[] = [];
  const autres: BadgeEntry[] = [];
  for (const l of (data ?? []) as unknown as LigneBadge[]) {
    const code = codeDe(l);
    if (!code) continue;
    const e: BadgeEntry = { code, contexte: l.contexte };
    /* Le périmètre éditable dépend du CHEMIN, parce que chaque RPC borne le
       sien de la même façon :
         · 'saisie'     → appliquer_badges_saisie ne remplace que les badges
                          de saisie de l'appelant (tous si admin) ;
         · 'suggestion' → appliquer_distinctions_suggerees ne remplace que
                          les badges issus de suggestions. L'athlète n'en est
                          pas l'auteur — c'est l'approbateur — donc aucun
                          test sur attribue_par ici.
       Un badge posé par un coach n'est donc jamais retirable par une
       suggestion, et l'écran ne le laisse pas croire. */
    const editable = mode === "suggestion"
      ? l.origine === "suggestion"
      : l.origine === "saisie" && (estAdmin || l.attribue_par === moi);
    (editable ? miens : autres).push(e);
  }
  return { miens, autres };
}

/**
 * Enregistre le jeu de badges de saisie, EN UNE TRANSACTION.
 *
 * `entrees` ne doit contenir que les badges éditables (le `miens` ci-dessus,
 * tel que le picker l'a modifié). Y ajouter ceux des autres ne les
 * retirerait pas — la RPC borne sa portée — et l'écran mentirait.
 */
export async function enregistrerBadgesSaisie(
  supabase: SupabaseClient,
  athleteId: string,
  entrees: BadgeEntry[],
): Promise<void> {
  const { error } = await supabase.rpc("appliquer_badges_saisie", {
    p_athlete_id: athleteId,
    p_entrees: entrees.map((e) => ({ code: e.code, contexte: e.contexte ?? null })),
  });
  if (error) throw new Error(error.message);
}

/**
 * Sérialise pour le chemin SUGGESTION (surfaces athlète).
 *
 * Ancienne forme `{badge, detail}` avec les NOUVEAUX codes :
 * apply_approved_suggestion → appliquer_distinctions_suggerees passe déjà
 * chaque code par code_badge_catalogue, qui accepte les deux vocabulaires.
 * Aucun SQL à toucher, et une suggestion soumise avant la bascule reste
 * approuvable après.
 */
export function versSuggestion(entrees: BadgeEntry[]): string {
  return JSON.stringify(
    entrees.map((e) => (e.contexte ? { badge: e.code, detail: e.contexte } : { badge: e.code })),
  );
}

/** Relit une suggestion déjà soumise (ou l'état courant) vers la forme du
 *  picker. Tolère les deux vocabulaires de clés. */
export function depuisSuggestion(brut: unknown): BadgeEntry[] {
  if (!brut) return [];
  let arr: unknown = brut;
  if (typeof brut === "string") {
    try { arr = JSON.parse(brut); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x): BadgeEntry | null => {
      if (typeof x === "string") return { code: x, contexte: null };
      if (x && typeof x === "object") {
        const o = x as { code?: string; badge?: string; contexte?: string; detail?: string };
        const code = o.code ?? o.badge;
        if (code) return { code, contexte: o.contexte ?? o.detail ?? null };
      }
      return null;
    })
    .filter((e): e is BadgeEntry => e !== null);
}
