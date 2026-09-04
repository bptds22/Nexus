/* ═══════════════════════════════════════════════════════════════
   threadStatus — shared status model + preset filter for BOTH the
   coach inbox (/coach/demandes) and the athlete inbox
   (/athlete/messages). Framework-agnostic (no JSX) so the web pages
   AND the mobile wrappers can consume ONE implementation.

   Extracted from app/coach/demandes/_data/mockThreadsData.ts so the
   athlete page reuses the exact same preset logic instead of
   reimplementing it. mockThreadsData now re-exports ThreadStatus +
   mapDbStatus from here for backward compat.
═══════════════════════════════════════════════════════════════ */

export type ThreadStatus = "nouveau" | "repondu" | "reponse_recue" | "envoye" | "archive";

/* Map a DB conversation status + "who replied" flags to a ThreadStatus.
   `meReplied` = the current viewer sent ≥1 message ; `otherReplied` =
   the counterparty sent ≥1 message. Coach passes (coachReplied,
   recruiterReplied) ; athlete passes (athleteReplied, coachReplied) —
   same shape, viewer-relative. */
export function mapDbStatus(
  dbStatus: string | null,
  meReplied?: boolean,
  otherReplied?: boolean,
): ThreadStatus {
  const s = (dbStatus || "").toLowerCase();
  if (s === "archived" || s === "archive") return "archive";
  if (meReplied && otherReplied) return "reponse_recue";
  if (meReplied) return "repondu";
  return "nouveau";
}

/* ── Status presets (the Row-2 pills, both inboxes) ─────────────── */

export type StatusPreset = "tous" | "nouveau" | "reponse_recue" | "sans_reponse" | "archive";

export const STATUS_PILLS: { key: StatusPreset; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "nouveau", label: "Nouveau" },
  { key: "reponse_recue", label: "Réponse reçue" },
  { key: "sans_reponse", label: "Sans réponse" },
  { key: "archive", label: "Archivé" },
];

export function mapUrlStatusPreset(p: string | null): StatusPreset {
  if (p === "nouveau" || p === "reponse_recue" || p === "sans_reponse" || p === "archive") return p;
  return "tous";
}

export interface StatusFilterableThread {
  status: ThreadStatus;
  /** sender_id of the LAST message (null if none) — drives "Sans réponse". */
  lastSenderId: string | null;
}

/* Does a thread match a status preset ? "Sans réponse" = the last
   message came from the current viewer (waiting on the counterparty),
   excluding archived.

   « Tous » exclut l'archive depuis le 2026-09-04 — voir le commentaire sur
   le `case` correspondant. Ce point-là ne reproduit plus le switch coach
   d'origine, et c'est délibéré. */
export function matchesStatusPreset(
  preset: StatusPreset,
  t: StatusFilterableThread,
  userId: string | undefined,
): boolean {
  switch (preset) {
    case "nouveau":
      return t.status === "nouveau";
    case "reponse_recue":
      return t.status === "reponse_recue";
    case "sans_reponse":
      return t.lastSenderId != null && t.lastSenderId === userId && t.status !== "archive";
    case "archive":
      return t.status === "archive";
    /* « Tous » = tous les fils VIVANTS. L'archive est un RANGEMENT, pas un
       statut parmi d'autres : un fil qu'on a archivé, on a dit qu'on ne
       voulait plus le voir dans la liste courante. C'est le standard de
       toutes les messageries, et la pastille « Archivé » existe pour les
       retrouver — ils ne disparaissent pas, ils sortent de la vue par défaut.

       Avant le 2026-09-04, ils y figuraient mais coulaient au fond grâce à la
       priorité de statut du tri. Cette priorité a été retirée (le tri se fait
       désormais par date du dernier message) : sans cette ligne, un fil
       archivé remonterait s'intercaler entre deux fils actifs. Le tri ne peut
       plus faire ce travail de rangement — c'est au filtre de le faire, et
       c'est sa place.

       `sans_reponse` excluait déjà l'archive juste au-dessus : on ne fait
       qu'appliquer la même règle à la vue par défaut. */
    case "tous":
      return t.status !== "archive";
    default:
      return t.status !== "archive";
  }
}

/* STATUS_SORT_PRIORITY A ÉTÉ RETIRÉ (2026-09-04).
   { nouveau: 0, reponse_recue: 1, repondu: 2, envoye: 3, archive: 4 } servait
   de clé PRIMAIRE au tri des deux boîtes (coach, athlète), la date ne
   départageant qu'à statut égal. Un fil dont le dernier message datait d'« il
   y a 0 min » se retrouvait donc sous des fils vieux de cinq semaines, sans
   que l'écran puisse l'expliquer — l'horodatage affiché contredisait l'ordre.

   Les deux listes trient désormais par date du dernier message, décroissant.
   Ce que cette table faisait remonter est déjà exprimable par les FILTRES de
   la même barre (`matchesStatusPreset` ci-dessus : « nouveau », « réponse
   reçue », « sans réponse »). Si un fil non lu doit ressortir, ce sera un
   badge ou un filtre — pas un réordonnancement.

   Ne pas la rétablir sans traiter ça : c'est le tri qui a produit le bug, pas
   son contenu. */
