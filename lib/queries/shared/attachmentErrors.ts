/* ═══════════════════════════════════════════════════════════════════════════
   attachmentErrors — LES sentinelles du rattachement d'équipe, réunies.

   ── CE FICHIER EST LE PRODUIT D'UNE COLLISION VOULUE ────────────────────────
   Deux versions ont coexisté, au MÊME chemin, exportant toutes deux
   `attachmentSentinel` avec des contrats incompatibles :
     · portail de transfert (main) — un EXTRACTEUR : (unknown) → Sentinel|null,
       plus attachmentErrorMessage / transferConfirmation / …, couvrant les
       JOIN_CODE_*.
     · invitation coach (dev) — un TRADUCTEUR : (string) → string, couvrant
       NOT_INVITABLE / ALREADY_YOURS / ALREADY_PENDING / NOT_YOUR_TEAM.
   Aucune n'était un sur-ensemble de l'autre. Le conflit de fusion était le
   mécanisme de rappel : il a fonctionné. Ceci en est la réunion.

   ── LE PRINCIPE DE LA RÉUNION ───────────────────────────────────────────────
   UNE table de messages, UN repli, UN comparateur. Les deux signatures sont
   conservées sous des noms DISTINCTS — on n'a tordu ni l'une ni l'autre :
     · attachmentSentinel(err: unknown)     → reconnaît, rend la sentinelle
     · attachmentErrorMessage(err: unknown) → rend le message français
     · attachmentMessageFr(raw: string)     → même chose depuis une CHAÎNE brute
       (c'était l'ancien `attachmentSentinel` de dev, renommé pour ce qu'il
       fait réellement : l'ancien nom mentait, il rendait un message)
   `attachmentMessageFr` délègue à la machinerie commune : pas de second
   dictionnaire, pas de second repli. C'est exactement la divergence qu'on
   voulait empêcher.

   ── DEUX PUBLICS, UN SEUL DICTIONNAIRE ──────────────────────────────────────
   Les sentinelles du portail parlent à l'ATHLÈTE qui rejoint une équipe ;
   celles de l'invitation parlent au COACH qui saisit un courriel. Le ton
   diffère donc d'une entrée à l'autre, et c'est normal — ce qui compte est
   qu'une sentinelle donnée n'ait qu'UN texte.

   ── ZÉRO PII (Loi 25) ───────────────────────────────────────────────────────
   Aucun message ne révèle l'âge, la date de naissance, le nom ni le courriel de
   qui que ce soit. On ne recopie JAMAIS le message brut du moteur à l'écran.

   Ton : tutoiement.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AttachmentSentinel =
  // ── communes aux deux origines ──
  | "NOT_AUTHENTICATED"
  | "ATHLETE_NOT_FOUND"
  | "ATHLETE_UNDER_14"
  | "TEAM_NOT_FOUND"
  | "TEAM_INACTIVE"
  | "TRANSFER_REQUIRES_CONFIRMATION"
  // ── portail de transfert : le code d'équipe ──
  | "JOIN_CODE_NOT_FOUND"
  | "JOIN_CODE_REVOKED"
  | "JOIN_CODE_EXPIRED"
  | "JOIN_CODE_EXHAUSTED"
  | "JOIN_CODE_TEAM_MISMATCH"
  // ── invitation coach : refus côté saisie de courriel ──
  | "NOT_COACH"
  | "NOT_YOUR_TEAM"
  | "EMAIL_TOO_SHORT"
  | "NOT_INVITABLE"
  | "ALREADY_YOURS"
  | "ALREADY_PENDING";

/** Détails transportés par TRANSFER_REQUIRES_CONFIRMATION dans le champ
 *  `details` de l'erreur PostgREST (RAISE … USING DETAIL = <json>). C'est le
 *  SERVEUR qui impose l'écran de confirmation : l'UI ne fait que l'afficher. */
export interface TransferConfirmation {
  previous_team_id: string;
  previous_team_name: string | null;
  previous_school_name: string | null;
  previous_sport: string | null;
  previous_season: string | null;
  previous_age_group: string | null;
  previous_division: string | null;
  previous_gender: string | null;
  previous_league: string | null;
  target_team_id: string;
  target_team_name: string | null;
  target_school_name: string | null;
  target_sport: string | null;
  target_season: string | null;
  target_age_group: string | null;
  target_division: string | null;
  target_gender: string | null;
  target_league: string | null;
}

const MESSAGES: Record<AttachmentSentinel, string> = {
  /* ── vues par l'ATHLÈTE ──────────────────────────────────────────────────
     Textes du portail conservés : ils sont en production, et ils DISENT QUOI
     FAIRE (« demande un nouveau code à ton entraîneur ») là où les variantes
     de la branche invitation se contentaient de constater. */
  NOT_AUTHENTICATED:
    "Ta session a expiré — reconnecte-toi pour rejoindre une équipe.",
  ATHLETE_NOT_FOUND:
    "Ton profil d'athlète n'est pas encore créé. Termine ton inscription avant de rejoindre une équipe.",
  ATHLETE_UNDER_14:
    "Tu dois avoir 14 ans pour rejoindre une équipe toi-même. Demande à ton parent ou à ton entraîneur de t'ajouter.",
  TEAM_NOT_FOUND:
    "Cette équipe n'existe plus. Demande ton code d'équipe à ton entraîneur.",
  TEAM_INACTIVE:
    "Cette équipe n'est plus active pour la saison en cours. Demande à ton entraîneur quelle équipe rejoindre.",
  TRANSFER_REQUIRES_CONFIRMATION:
    "Tu fais déjà partie d'une équipe. Confirme le transfert pour en changer.",

  // ── le code d'équipe, vu par l'ATHLÈTE ──
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

  /* ── vues par le COACH, sur les surfaces de saisie de courriel ────────── */
  NOT_COACH: "Cette action est réservée aux entraîneurs.",
  NOT_YOUR_TEAM: "Tu n'encadres pas cette équipe.",
  EMAIL_TOO_SHORT: "Entre le courriel au complet.",
  /* ⚠ REFUS UNIQUE ET OPAQUE — ne pas le décliner en variantes.
     invite_anchored_athlete_to_team fond TROIS cas dans cette seule
     sentinelle : athlète introuvable, athlète sans compte, athlète de moins de
     14 ans. Un message par cas ferait du champ courriel un détecteur d'âge et
     un révélateur d'état de compte pour des athlètes qui ne sont pas ceux de
     ce coach. Le texte ne dit donc RIEN de la raison, et c'est intentionnel. */
  NOT_INVITABLE: "Cet athlète ne peut pas être invité ici.",
  ALREADY_YOURS: "Cet athlète fait déjà partie de tes athlètes.",
  ALREADY_PENDING: "Invitation déjà envoyée — en attente de sa réponse.",
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
 *  Le test est une INCLUSION, pas une égalité : TRANSFER_REQUIRES_CONFIRMATION
 *  arrive suffixée du nom de l'ancienne équipe (« …: Dragons Juvenile (Nexus
 *  Secondaire) »), et les autres peuvent être préfixées par le moteur
 *  (« P0001: ATHLETE_UNDER_14 »).
 *
 *  ⚠ On prend la correspondance la PLUS LONGUE. Sans ce tri, un préfixe commun
 *  gagnerait : JOIN_CODE_NOT_FOUND contient JOIN_CODE_*, et NOT_INVITABLE
 *  cohabite avec NOT_COACH / NOT_YOUR_TEAM / NOT_AUTHENTICATED. */
export function attachmentSentinel(err: unknown): AttachmentSentinel | null {
  const msg = rawMessage(err);
  if (!msg) return null;
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

/** Même chose depuis une CHAÎNE brute — sentinelle nue ou message Postgres.
 *
 *  C'était `attachmentSentinel` sur la branche invitation. Renommé : l'ancien
 *  nom mentait (il rendait un message, pas une sentinelle) et entrait en
 *  collision avec l'extracteur ci-dessus. Le comportement est préservé, y
 *  compris le cas "OK" → chaîne vide, qui signale un succès sans rien afficher.
 *
 *  Délègue à la machinerie commune : AUCUN second dictionnaire, AUCUN second
 *  repli. C'est précisément la divergence que la fusion devait supprimer. */
export function attachmentMessageFr(raw: string | null | undefined): string {
  if (!raw) return ATTACHMENT_FALLBACK;
  if (raw.trim() === "OK") return "";
  return attachmentErrorMessage(raw);
}

/** True si la sentinelle dénote un succès (ou un no-op traité comme tel).
 *  ALREADY_PENDING compte comme un succès : l'invitation existe déjà, l'état
 *  visé est atteint — ce n'est pas une erreur à afficher en rouge. */
export function attachmentReussi(raw: string | null | undefined): boolean {
  return raw === "OK" || raw === "ALREADY_PENDING";
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
