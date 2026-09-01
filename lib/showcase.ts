/**
 * PROFIL VITRINE (« showcase ») — source de vérité et repli d'intérim.
 *
 * Un unique profil de démonstration est rendu ENTIÈREMENT visible aux
 * recruteurs non payants (identité comprise), pour montrer ce que le
 * paywall masque d'ordinaire. Il est signalé à l'écran par le ruban
 * « PROFIL DÉMO » (voir components/shared/DemoRibbon.tsx) : personne ne
 * doit croire contacter un vrai athlète.
 *
 * ── LA SOURCE DE VÉRITÉ EST LA BASE ──────────────────────────────────
 * La décision appartient à `athletes.is_showcase`, projeté par les RPC
 * recruteur (recruiter_search_athletes, recruiter_athlete_cards,
 * recruiter_athlete_profile). Le front ne décide RIEN : il lit le
 * booléen que le serveur lui donne.
 *
 * ── ⚠️ REPLI D'INTÉRIM, VOUÉ À MOURIR ────────────────────────────────
 * Tant que la migration du lot (a) n'est pas appliquée, la colonne
 * n'existe pas et les RPC ne projettent rien : `serverFlag` arrive
 * `undefined`. On retombe alors sur la comparaison d'identifiant
 * ci-dessous, qui n'est là que pour laisser le ruban vivre pendant
 * l'intérim.
 *
 * Ce repli DOIT être supprimé après le premier build mobile 1.5, une
 * fois `is_showcase` projeté par les trois RPC. Pour le tuer :
 * supprimer SHOWCASE_ATHLETE_ID et réduire isShowcaseAthlete() à
 * `serverFlag === true`. Aucun appelant n'a besoin de changer.
 *
 * Il ne couvre PAS la Loi 25 et n'a pas à la couvrir : le repli ne
 * pilote QUE l'affichage du ruban, jamais le démasquage d'une
 * identité — celui-ci reste une décision serveur (`identity_visible`).
 */
export const SHOWCASE_ATHLETE_ID = "d4cd6432-1c45-47bc-8498-071075e4ae7c";

/**
 * Cet athlète est-il le profil vitrine ?
 *
 * @param athleteId  identifiant de l'athlète affiché
 * @param serverFlag `is_showcase` tel que projeté par la RPC. `undefined`
 *                   ou `null` = la RPC ne le projette pas encore.
 */
export function isShowcaseAthlete(
  athleteId: string | null | undefined,
  serverFlag?: boolean | null,
): boolean {
  if (typeof serverFlag === "boolean") return serverFlag;
  return !!athleteId && athleteId === SHOWCASE_ATHLETE_ID;
}
