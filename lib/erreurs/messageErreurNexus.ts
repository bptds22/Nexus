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

/* Refus « coach → cégep » (lot B1 cégep, trigger porte_coach_cegep) : la base lève
   « NEXUS_COACH_CEGEP: Un compte coach ne peut pas être rattaché à un cégep. La gestion des
   équipes collégiales arrive bientôt. » Son préfixe n'est PAS « NEXUS: » : sans cette règle, il
   tombait dans le message générique, ou s'affichait brut. Lot B4 : le texte lisible, toujours. */
const COACH_CEGEP = /NEXUS_COACH_CEGEP/;
export const MESSAGE_COACH_CEGEP =
  "Un compte coach ne peut pas être rattaché à un cégep. La gestion des équipes collégiales arrive bientôt.";

export function messageCoachCegep(message: string | null | undefined): string | null {
  return message && COACH_CEGEP.test(message) ? MESSAGE_COACH_CEGEP : null;
}

/** Le message à montrer : le refus coach → cégep en clair, sinon le message reçu tel quel. */
export function messageLisible(message: string): string {
  return messageCoachCegep(message) ?? message;
}

/* « cet athlète a déjà le badge « Vitesse » (attribué par L'Esprit Sportif) »
   → « Cet athlète a déjà le badge Vitesse, attribué par L'Esprit Sportif. »
   Couvre les trois formes levées par la base : sans auteur, « par <partenaire> »,
   « par son coach ». */
const BADGE_DEJA = /^cet athlète a déjà le badge « (.+?) »(?: \(attribué par (.+)\))?\.?$/;

export function messageErreurNexus(message: string | null | undefined): string | null {
  const coachCegep = messageCoachCegep(message);
  if (coachCegep) return coachCegep;
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

/* Création d'une fiche athlète refusée par l'unicité du courriel
   (index athletes_email_lower_btrim_uniq, 2026-08-12). La base répond
   « duplicate key value violates unique constraint … » : illisible pour un
   coach, et le message générique ne disait pas quoi faire (D1, 2026-10-15).
   Ne nomme personne : le courriel appartient peut-être à un mineur que ce
   coach ne voit pas. */
export function messageCourrielDejaPris(message: string | null | undefined): string | null {
  if (!message || !message.includes("athletes_email_lower_btrim_uniq")) return null;
  return "Une fiche athlète utilise déjà ce courriel : cet athlète a probablement déjà sa fiche. Vérifie l'adresse, puis invite-le plutôt que d'en créer une seconde.";
}

/* Phrase complète d'un refus d'enregistrement, dans l'ordre du web
   (/coach/athletes/create) : courriel déjà pris, puis refus NEXUS, sinon le
   message générique de l'appelant. Jamais le texte brut de la base. Partagé
   avec l'assistant coach mobile (registre §84). */
export function messageErreurSauvegarde(message: string | null | undefined, generique: string): string {
  return messageCourrielDejaPris(message) ?? messageErreurNexus(message) ?? generique;
}
