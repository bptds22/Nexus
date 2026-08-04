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
