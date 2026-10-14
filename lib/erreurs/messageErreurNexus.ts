/* Message d'erreur lisible pour l'utilisateur, à partir d'une erreur de la base.

   Les gardes SQL de Nexus lèvent leurs refus métier sous la forme
   « NEXUS: <phrase en minuscules> » (RAISE EXCEPTION). Ce préfixe est un
   marqueur pour nous, pas un texte pour le coach : l'assistant le montrait tel
   quel dans un alert() natif — « Erreur lors de la sauvegarde: NEXUS: cet
   athlète a déjà le badge « Vitesse » (attribué par … ) ».

   - erreur NEXUS     → la phrase, sans préfixe, avec majuscule et point final ;
   - autre erreur     → null : l'appelant affiche son message générique (le
                        détail technique ne dit rien au coach).

   Module PUR, partagé web / mobile (le mobile le branchera au lot mobile). */

const PREFIXE = /^\s*NEXUS:\s*/;

/* « cet athlète a déjà le badge « Vitesse » (attribué par L'Esprit Sportif) »
   → « Cet athlète a déjà le badge Vitesse, attribué par L'Esprit Sportif. »
   Couvre les trois formes levées par la base : sans auteur, « par <partenaire> »,
   « par son coach ». */
const BADGE_DEJA = /^cet athlète a déjà le badge « (.+?) »(?: \(attribué par (.+)\))?\.?$/;

export function messageErreurNexus(message: string | null | undefined): string | null {
  if (!message || !PREFIXE.test(message)) return null;
  const phrase = message.replace(PREFIXE, "").trim();
  if (!phrase) return null;

  const badge = BADGE_DEJA.exec(phrase);
  if (badge) {
    const [, libelle, auteur] = badge;
    return auteur
      ? `Cet athlète a déjà le badge ${libelle}, attribué par ${auteur}.`
      : `Cet athlète a déjà le badge ${libelle}.`;
  }

  const majuscule = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return /[.!?…]$/.test(majuscule) ? majuscule : `${majuscule}.`;
}
