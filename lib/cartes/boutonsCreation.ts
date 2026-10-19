/* Deux boutons à la création d'une carte prospect (BP 2026-10-18), web et appli :
   « Créer la carte » sans courriel ni téléphone, « Créer et inviter » seulement avec
   l'un des deux. Un seul est actif à la fois. Le courriel n'est plus obligatoire. */
export function boutonsCreation(courriel: string, telephone: string): { creer: boolean; inviter: boolean } {
  const contact = courriel.trim().length > 0 || telephone.trim().length > 0;
  return { creer: !contact, inviter: contact };
}
