/* Texte d'invitation coach → joueur (décision BP du 2026-10-15).

   AUCUN message ne nomme le coach, ni « ton entraîneur ». Le texte dit ce qui
   est VRAI : le nombre de recruteurs de cégep qui suivent déjà la fiche
   (recruteurs_suivant_athlete, en base — favoris, pipeline, cartes fusionnées),
   jamais qui. Aucun nom de recruteur, de cégep ni de coach.

   Jamais de chiffre inventé ni arrondi vers le haut : une valeur absente,
   négative ou non entière se lit comme ce qu'on SAIT (zéro, ou l'entier
   inférieur).

   ⚠ COPIE EXACTE dans supabase/functions/_shared/messageRecruteurs.ts (les
   fonctions Deno n'importent pas lib/). Le test
   lib/invitations/__tests__/messageRecruteurs.test.ts vérifie que les deux
   fichiers sont identiques. */

/** Nombre sûr : entier ≥ 0, jamais arrondi vers le haut. */
export function nombreSur(n: unknown): number {
  const v = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** La phrase de l'invitation, selon le nombre réel de recruteurs qui suivent la fiche. */
export function phraseRecruteurs(n: unknown): string {
  const k = nombreSur(n);
  if (k === 0) {
    return "Ton profil d'athlète est prêt sur Nexus, là où les recruteurs de cégep cherchent leurs prochains joueurs. Réclame-le gratuitement.";
  }
  if (k === 1) {
    return "1 recruteur de cégep suit déjà ton profil sur Nexus. Réclame-le pour qu'il voie tout ce que tu as à montrer.";
  }
  return `${k} recruteurs de cégep suivent déjà ton profil sur Nexus. Réclame-le pour qu'ils voient tout ce que tu as à montrer.`;
}
