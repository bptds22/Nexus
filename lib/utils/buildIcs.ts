/* ═══════════════════════════════════════════════════════════════
   buildIcs — helper PUR qui assemble une string iCalendar (VCALENDAR/
   VEVENT) en mémoire. Aucune dépendance npm, aucune écriture disque,
   aucun accès réseau. Les dates sont passées EN ARGUMENT (start/end) :
   la fonction ne lit jamais l'horloge — donc déterministe et testable.

   Le format des instants est le `YYYYMMDDTHHMMSSZ` (UTC) attendu par
   iCal ET par Google Agenda ; on le dérive des getters UTC de Date,
   donc indépendant du fuseau du navigateur. Un `Date` construit depuis
   un timestamptz Postgres est déjà le bon instant ; on ne fait que le
   formater.
═══════════════════════════════════════════════════════════════ */

export interface IcsEventInput {
  /** Titre de l'événement → SUMMARY. Ex. « Visite — Jean Tremblay / Cégep X ». */
  summary: string;
  /** Début de l'événement (instant absolu). */
  start: Date;
  /** Fin de l'événement (instant absolu). Cf. durée par défaut chez l'appelant. */
  end: Date;
  /** École / cégep → LOCATION. */
  location?: string;
  /** Texte libre → DESCRIPTION. */
  description?: string;
}

/** Date → `YYYYMMDDTHHMMSSZ` (UTC). Le format attendu par iCal ET par Google. */
export function toICalUtc(d: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/* Échappement iCalendar (RFC 5545 §3.3.11) : backslash, virgule et
   point-virgule sont des séparateurs, et un retour ligne s'écrit `\n`
   littéral. L'ordre compte — le backslash d'abord, sinon on ré-échappe
   les backslashes qu'on vient d'introduire. */
function escapeICalText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/* Les lignes iCal sont limitées à 75 octets ; au-delà on plie avec un
   CRLF suivi d'UNE espace. On compte en octets (UTF-8), pas en chars —
   un « é » pèse 2 octets et ferait déborder une ligne comptée en chars. */
function foldICalLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  // Limite à 74 pour laisser la place à l'espace de continuation.
  for (const ch of line) {
    const chBytes = enc.encode(ch).length;
    if (curBytes + chBytes > 74) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += chBytes;
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

/**
 * Assemble le contenu .ics d'un événement unique. Retourne la string
 * brute (à écrire dans un Blob web ou un fichier Cache Capacitor).
 */
export function buildIcs({
  summary,
  start,
  end,
  location = "",
  description = "",
}: IcsEventInput): string {
  const dtStart = toICalUtc(start);
  const dtEnd = toICalUtc(end);

  /* UID : stable pour un même (titre, instant) → ré-importer le même
     fichier met à jour l'événement au lieu d'en créer un doublon.
     Pas de Math.random() : deux exports du même rendez-vous doivent
     produire le même UID (fonction pure). */
  const uid = `${dtStart}-${encodeURIComponent(summary).slice(0, 40)}@nexussports.ca`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexus//Visite planifiee//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    // DTSTAMP dérivé de start (pas de new Date()) pour rester déterministe.
    `DTSTAMP:${dtStart}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldICalLine(`SUMMARY:${escapeICalText(summary)}`),
    foldICalLine(`DESCRIPTION:${escapeICalText(description)}`),
    foldICalLine(`LOCATION:${escapeICalText(location)}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF obligatoire (RFC 5545 §3.1) — Outlook rejette les LF nus.
  return lines.join("\r\n") + "\r\n";
}
