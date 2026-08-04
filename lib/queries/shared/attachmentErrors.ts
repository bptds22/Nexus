/* ═══════════════════════════════════════════════════════════════
   attachmentErrors — traduction des SENTINELLES du transfer portal.

   Les fonctions SQL du rattachement (apply_team_attachment,
   resolve_team_join_token, create/revoke_team_join_token) lèvent des
   sentinelles PROTOCOLAIRES : majuscules, sans accent, pensées pour être
   comparées par du code, pas lues par un humain. C'est la convention déjà en
   place dans create_athlete_invitation (NOT_AUTHENTICATED, ATHLETE_UNDER_14…).

   Elles ne portent donc PAS le marqueur « NEXUS: » de
   supabase/migrations/20260731200000_raise_marqueur_nexus.sql, réservé aux
   messages DÉJÀ rédigés pour l'écran. friendlyDbError() les remplacerait par
   son générique — c'est voulu : la copie française vit ici, en un seul endroit
   partagé par le web et le mobile, pas dispersée sur chaque site d'appel.

   Ton : tutoiement (on parle à l'athlète).
═══════════════════════════════════════════════════════════════ */

export type AttachmentSentinel =
  | "NOT_AUTHENTICATED"
  | "ATHLETE_NOT_FOUND"
  | "ATHLETE_UNDER_14"
  | "TEAM_NOT_FOUND"
  | "TEAM_INACTIVE"
  | "JOIN_CODE_NOT_FOUND"
  | "JOIN_CODE_REVOKED"
  | "JOIN_CODE_EXPIRED"
  | "JOIN_CODE_EXHAUSTED"
  | "JOIN_CODE_TEAM_MISMATCH"
  | "TRANSFER_REQUIRES_CONFIRMATION";

/** Détails transportés par TRANSFER_REQUIRES_CONFIRMATION dans le champ
 *  `details` de l'erreur PostgREST (RAISE … USING DETAIL = <json>). C'est le
 *  SERVEUR qui impose l'écran de confirmation : l'UI ne fait que l'afficher. */
export interface TransferConfirmation {
  previous_team_id: string;
  previous_team_name: string | null;
  previous_school_name: string | null;
  previous_sport: string | null;
  previous_season: string | null;
  target_team_id: string;
  target_team_name: string | null;
  target_school_name: string | null;
}

const MESSAGES: Record<AttachmentSentinel, string> = {
  NOT_AUTHENTICATED:
    "Ta session a expiré — reconnecte-toi pour rejoindre une équipe.",
  ATHLETE_NOT_FOUND:
    "Ton profil d'athlète n'est pas encore créé. Termine ton inscription avant de rejoindre une équipe.",
  ATHLETE_UNDER_14:
    "Tu dois avoir 14 ans pour rejoindre une équipe toi-même. Demande à ton parent ou à ton entraîneur de t'ajouter.",
  TEAM_NOT_FOUND:
    "Cette équipe n'existe plus. Demande un nouveau code à ton entraîneur.",
  TEAM_INACTIVE:
    "Cette équipe n'est plus active pour la saison en cours. Demande à ton entraîneur quelle équipe rejoindre.",
  JOIN_CODE_NOT_FOUND:
    "Ce code n'existe pas. Vérifie chaque caractère — il n'y a ni 0, ni O, ni 1, ni I, ni L dans nos codes.",
  JOIN_CODE_REVOKED:
    "Ce code a été désactivé par ton entraîneur. Demande-lui le nouveau.",
  JOIN_CODE_EXPIRED:
    "Ce code est expiré. Demande un nouveau code à ton entraîneur.",
  JOIN_CODE_EXHAUSTED:
    "Ce code a déjà servi au nombre maximum de joueurs. Demande un nouveau code à ton entraîneur.",
  JOIN_CODE_TEAM_MISMATCH:
    "Ce code ne correspond pas à l'équipe affichée. Recharge la page et réessaie.",
  TRANSFER_REQUIRES_CONFIRMATION:
    "Tu fais déjà partie d'une équipe. Confirme le transfert pour en changer.",
};

/** Copie de repli quand l'erreur ne vient pas de nos fonctions (panne réseau,
 *  refus RLS, bug). On ne recopie JAMAIS le message brut du moteur à l'écran. */
export const ATTACHMENT_FALLBACK =
  "Impossible de te rattacher à cette équipe pour l'instant. Réessaie dans un moment.";

const SENTINELS = Object.keys(MESSAGES) as AttachmentSentinel[];

function rawMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const o = err as { message?: unknown };
  return typeof o.message === "string" ? o.message : "";
}

/** Reconnaît la sentinelle portée par une erreur PostgREST, ou null.
 *
 *  Le test est un PRÉFIXE, pas une égalité : TRANSFER_REQUIRES_CONFIRMATION
 *  arrive suffixée du nom de l'ancienne équipe (« …: Dragons Juvenile (Nexus
 *  Secondaire) »), et les autres peuvent être préfixées par le moteur. */
export function attachmentSentinel(err: unknown): AttachmentSentinel | null {
  const msg = rawMessage(err);
  if (!msg) return null;
  // JOIN_CODE_NOT_FOUND avant JOIN_CODE_* plus courts : on prend la plus
  // longue correspondance pour éviter qu'un préfixe commun ne gagne.
  const hit = SENTINELS
    .filter((s) => msg.includes(s))
    .sort((a, b) => b.length - a.length)[0];
  return hit ?? null;
}

/** Message français prêt à afficher pour une erreur de rattachement. */
export function attachmentErrorMessage(err: unknown): string {
  const s = attachmentSentinel(err);
  return s ? MESSAGES[s] : ATTACHMENT_FALLBACK;
}

/** Extrait les détails du transfert à confirmer, ou null si l'erreur n'est pas
 *  TRANSFER_REQUIRES_CONFIRMATION (ou si le JSON est illisible — on préfère
 *  alors ne pas ouvrir un écran de confirmation à moitié vide). */
export function transferConfirmation(err: unknown): TransferConfirmation | null {
  if (attachmentSentinel(err) !== "TRANSFER_REQUIRES_CONFIRMATION") return null;
  const details = (err as { details?: unknown })?.details;
  if (typeof details !== "string") return null;
  try {
    const parsed = JSON.parse(details) as TransferConfirmation;
    return parsed?.previous_team_id && parsed?.target_team_id ? parsed : null;
  } catch {
    return null;
  }
}

/** Phrase de l'écran de confirmation, construite depuis les détails serveur.
 *  Les noms peuvent manquer (école supprimée) — on dégrade sans « null ». */
export function transferConfirmationText(c: TransferConfirmation): string {
  const from = [c.previous_team_name, c.previous_school_name].filter(Boolean).join(" · ");
  const to = [c.target_team_name, c.target_school_name].filter(Boolean).join(" · ");
  return (
    `Tu fais partie de ${from || "une autre équipe"}. ` +
    `En rejoignant ${to || "cette équipe"}, tu quittes ton équipe actuelle — ` +
    `elle sera ajoutée à ton parcours et ton entraîneur ne te verra plus dans son alignement.`
  );
}
