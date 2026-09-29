/* ═══════════════════════════════════════════════════════════════
   signature — le sujet d'une ligne d'historique (retour BP 2026-09-28).

   Les phrases de geste sont écrites à la 3e personne (« a déplacé le
   dossier… »). Pour l'auteur lui-même, c'est « Tu as déplacé… », jamais
   « Toi a déplacé… » : le sujet ET le verbe changent. Une seule fonction,
   pour l'historique d'un dossier et celui d'une carte prospect.
═══════════════════════════════════════════════════════════════ */

export function ligneSignee(estMoi: boolean, nom: string, phrase: string): { sujet: string; phrase: string } {
  if (!estMoi) return { sujet: nom, phrase };
  return { sujet: "Tu", phrase: phrase.replace(/^a /, "as ") };
}
