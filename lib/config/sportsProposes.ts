/* ═══════════════════════════════════════════════════════════════
   Sports proposés à la saisie (onboarding coach et recruteur, profil
   recruteur) — lot A, 2026-09-24.

   Chaque libellé DOIT exister tel quel dans `public.sports.nom` : le
   trigger `trg_users_sport_id` déduit `users.sport_id` du texte, par nom
   (casse et espaces de bord ignorés). Un libellé absent de la table
   laisserait le recruteur sans unité (sport_id NULL), sans erreur.

   L'ancienne liste du profil recruteur proposait six sports inexistants en
   base (Danse, Escrime, Gymnastique, Karaté, Softball, Tennis de table) et
   omettait Handball. Elle lit désormais celle-ci.

   « Autre » et « Soccer intérieur » existent en base mais ne sont pas
   proposés ici (inchangé par rapport à l'onboarding).
═══════════════════════════════════════════════════════════════ */

export const SPORTS_PROPOSES = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Golf", "Tennis",
  "Ski alpin", "Ski de fond", "Judo", "Handball", "Water-polo",
] as const;

/** Tri alphabétique français, pour les menus où l'ordre de popularité
 *  n'a pas de sens (profil). */
export const SPORTS_PROPOSES_ALPHA: readonly string[] =
  [...SPORTS_PROPOSES].sort((a, b) => a.localeCompare(b, "fr"));
