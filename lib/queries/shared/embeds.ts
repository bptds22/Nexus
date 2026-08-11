// lib/queries/shared/embeds.ts
// ============================================================================
// Normalisation des embeds PostgREST dont la CARDINALITÉ peut changer.
//
// Contexte. Depuis la migration `team_athletes_single_anchor` (contrainte
// UNIQUE (athlete_id) — ancrage unique strict du transfer portal), PostgREST
// détecte `athletes → team_athletes` comme du one-to-one et ne renvoie plus un
// tableau :
//
//   avant :  "team_athletes": [{ team_id: "…" }]   // [] si aucune équipe
//   après :  "team_athletes": { team_id: "…" }     // null si aucune équipe
//
// Le sens inverse (`teams → team_athletes`) reste un tableau : team_id n'est
// pas unique. Seuls les embeds partant d'`athletes` sont concernés.
//
// Pourquoi un helper et pas trois rustines : la forme dépend d'un détail de
// schéma (l'unicité de la colonne de jointure) qui peut rebasculer — dropper
// UNIQUE (athlete_id) referait des tableaux. Un code qui teste `Array.isArray`
// de façon EXCLUANTE (`? x : []`, `if (!Array.isArray) return null`) ne plante
// pas : il répond « aucune équipe » en silence. C'est précisément le mode de
// panne qu'on ne voit pas passer.
// ============================================================================

/** Normalise un embed PostgREST en tableau, quelle que soit sa cardinalité.
 *
 *  Accepte les trois formes qu'un embed peut prendre — tableau (one-to-many),
 *  objet seul (one-to-one), `null`/`undefined` (aucune ligne liée) — et rend
 *  toujours un tableau. À utiliser sur TOUT embed lu depuis `athletes`. */
export const taRows = <T,>(v: T | T[] | null | undefined): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

/* ── Coach-chef d'une équipe, depuis l'embed team_coaches ──────────────────
 *
 *  Forme attendue de l'embed :
 *    team_coaches(role, users!coach_id(first_name, last_name))
 *
 *  RLS — vérifiée au catalogue, aucun droit à ajouter :
 *    · `team_coaches readable when team is readable` ouvre la lecture à tout
 *      authentifié pour les équipes d'écoles SECONDAIRE / LIGUE_CIVILE, soit
 *      exactement la population des pickers d'équipe ;
 *    · `authenticated read coaches` (users, role = 'COACH') ouvre first_name /
 *      last_name. Un ATHLÈTE peut donc lire les deux — c'est lui qui ouvre le
 *      sheet de sélection d'équipe.
 *
 *  Rend `null` s'il n'y a aucun `head_coach` déclaré, ou si son nom est vide :
 *  l'appelant NE DOIT PAS rendre de ligne dans ce cas (pas de « Coach : » vide).
 *  La table ne compte que 6 lignes en base à ce jour, donc le cas null est
 *  encore la règle et non l'exception.
 *
 *  `taRows` est appliqué DEUX fois : sur l'embed lui-même et sur son embed
 *  imbriqué `users`, dont la cardinalité peut basculer objet/tableau selon
 *  l'unicité détectée par PostgREST. */
type TeamCoachEmbed = {
  role?: string | null;
  users?: { first_name?: string | null; last_name?: string | null }
        | { first_name?: string | null; last_name?: string | null }[]
        | null;
};

export function headCoachName(embed: TeamCoachEmbed | TeamCoachEmbed[] | null | undefined): string | null {
  const chef = taRows(embed).find((c) => (c?.role ?? "").toLowerCase() === "head_coach");
  if (!chef) return null;
  const u = taRows(chef.users)[0];
  const nom = [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
  return nom || null;
}
