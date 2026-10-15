/* Texte d'invitation coach → joueur (décisions BP du 2026-10-15).

   RÈGLE RSEQ : aucun recruteur, aucun cégep, aucun coach d'équipe collégiale
   n'est nommé. Le texte dit ce qui est VRAI : le nombre de recruteurs de cégep
   qui suivent déjà la fiche (recruteurs_suivant_athlete, en base — favoris,
   pipeline, cartes fusionnées), jamais qui.

   Le coach du SECONDAIRE ou du CIVIL peut être nommé (correction BP) : la base
   ne transmet son nom que dans ce cas (coach_nommable). Sans nom transmis,
   aucune phrase de coach.

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

/** Échappe un texte pour l'insérer dans du HTML (noms saisis par des personnes). */
export function echapperHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** « {Coach} ({École}) a préparé ton profil sur Nexus. » — seulement si la base a transmis le nom
 *  (coach du secondaire ou du civil). Nom absent ou vide → null : aucune phrase de coach. */
export function phraseCoach(nom: unknown, ecole: unknown): string | null {
  const n = typeof nom === "string" ? nom.trim() : "";
  if (!n) return null;
  const e = typeof ecole === "string" ? ecole.trim() : "";
  return `${n}${e ? ` (${e})` : ""} a préparé ton profil sur Nexus.`;
}
