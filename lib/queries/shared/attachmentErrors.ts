/* ═══════════════════════════════════════════════════════════════════════════
   attachmentErrors — traduction des sentinelles de rattachement d'équipe.

   POURQUOI CE FICHIER EXISTE SUR dev
   Le cœur du rattachement (_apply_team_attachment_core) et la fonction
   d'invitation lèvent ou retournent des SENTINELLES en majuscules :
   ATHLETE_UNDER_14, TEAM_NOT_FOUND, NOT_YOUR_TEAM… Sans traduction, elles
   remontaient telles quelles dans l'interface. L'écran d'acceptation affichait
   littéralement « Erreur : ATHLETE_UNDER_14 » à un adolescent.

   ⚠ COLLISION VOLONTAIRE AVEC feat/transfer-portal
   Cette branche porte un fichier de MÊME CHEMIN exportant `attachmentSentinel`.
   On reprend chemin ET nom délibérément : le jour où la branche est fusionnée,
   git signalera un conflit à résoudre — ce qui est infiniment préférable à deux
   traducteurs divergents cohabitant en silence. Ne pas renommer pour « éviter
   le conflit » : le conflit EST le mécanisme de rappel.

   ZÉRO PII (Loi 25)
   Aucun message ne révèle l'âge, la date de naissance, le nom ni le courriel de
   qui que ce soit. ATHLETE_UNDER_14 en particulier ne dit jamais « cet athlète
   a 12 ans » — il dit que le rattachement n'est pas possible, point.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Sentinelles connues, côté acceptation (athlète) ET invitation (coach). */
export type AttachmentSentinel =
  | "ATHLETE_UNDER_14"
  | "ATHLETE_NOT_FOUND"
  | "TEAM_NOT_FOUND"
  | "TEAM_INACTIVE"
  | "TRANSFER_REQUIRES_CONFIRMATION"
  | "NOT_AUTHENTICATED"
  | "NOT_COACH"
  | "NOT_YOUR_TEAM"
  | "EMAIL_TOO_SHORT"
  | "NOT_INVITABLE"
  | "ALREADY_YOURS"
  | "ALREADY_PENDING"
  | "OK";

/* Les messages sont écrits pour LEUR destinataire : les premiers s'affichent à
   l'athlète qui accepte, les seconds au coach qui invite. D'où deux tons. */
const MESSAGES: Record<AttachmentSentinel, string> = {
  /* ── vus par l'ATHLÈTE, sur l'écran d'acceptation ──
     Ici le message est EXPLICITE, et il doit l'être : c'est sa propre donnée.
     Le coach, lui, ne verra jamais cette sentinelle — la fonction d'invitation
     la fond dans NOT_INVITABLE avant qu'elle n'atteigne le client. Même
     traducteur, deux publics, deux niveaux de détail assumés. */
  ATHLETE_UNDER_14:
    "Tu dois avoir 14 ans ou plus pour rejoindre une équipe. Parles-en à ton coach.",
  ATHLETE_NOT_FOUND: "Profil introuvable. Recharge la page et réessaie.",
  TEAM_NOT_FOUND: "Cette équipe n'existe plus.",
  TEAM_INACTIVE: "Cette équipe n'est plus active.",
  TRANSFER_REQUIRES_CONFIRMATION:
    "Tu fais déjà partie d'une équipe — confirme le changement pour continuer.",

  // ── vus par le COACH, sur les surfaces de saisie de courriel ──
  NOT_AUTHENTICATED: "Session expirée — reconnecte-toi.",
  NOT_COACH: "Cette action est réservée aux entraîneurs.",
  NOT_YOUR_TEAM: "Tu n'encadres pas cette équipe.",
  EMAIL_TOO_SHORT: "Entre le courriel au complet.",
  /* ⚠ REFUS UNIQUE ET OPAQUE — ne pas le décliner en variantes.
     La fonction serveur fond TROIS cas dans cette seule sentinelle :
     athlète introuvable, athlète sans compte, athlète de moins de 14 ans.
     Un message par cas ferait du champ courriel un détecteur d'âge et un
     révélateur d'état de compte pour des athlètes qui ne sont pas ceux de ce
     coach. Le texte ne dit donc RIEN de la raison, et c'est intentionnel. */
  NOT_INVITABLE: "Cet athlète ne peut pas être invité ici.",
  ALREADY_YOURS: "Cet athlète fait déjà partie de tes athlètes.",
  ALREADY_PENDING: "Invitation déjà envoyée — en attente de sa réponse.",

  OK: "",
};

/** Repli quand la sentinelle est inconnue : jamais le texte brut de Postgres. */
const REPLI = "Action impossible pour le moment. Réessaie.";

/**
 * Traduit une sentinelle (ou un message d'erreur Postgres qui la CONTIENT) en
 * français lisible. Accepte `null`/`undefined` pour simplifier les appels.
 *
 * Le test par `includes` et non par égalité : Postgres préfixe ses exceptions
 * (`P0001: ATHLETE_UNDER_14`) et TRANSFER_REQUIRES_CONFIRMATION arrive suivie
 * du nom de l'équipe quittée.
 */
export function attachmentSentinel(raw: string | null | undefined): string {
  if (!raw) return REPLI;
  const brut = raw.trim();
  if (brut === "OK") return "";
  for (const cle of Object.keys(MESSAGES) as AttachmentSentinel[]) {
    if (cle !== "OK" && brut.includes(cle)) return MESSAGES[cle];
  }
  return REPLI;
}

/** True si la sentinelle dénote un succès (ou un no-op traité comme tel). */
export function attachmentReussi(raw: string | null | undefined): boolean {
  return raw === "OK" || raw === "ALREADY_PENDING";
}
