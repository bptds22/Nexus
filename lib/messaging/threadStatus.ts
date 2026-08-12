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
   excluding archived. Mirrors the original coach desktop switch. */
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
    default:
      return true;
  }
}

/* Sort weight — nouveau first, then reponse_recue, …, archive last. */
export const STATUS_SORT_PRIORITY: Record<ThreadStatus, number> = {
  nouveau: 0, reponse_recue: 1, repondu: 2, envoye: 3, archive: 4,
};
