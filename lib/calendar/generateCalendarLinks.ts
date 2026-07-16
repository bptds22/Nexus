/* ═══════════════════════════════════════════════════════════════
   generateCalendarLinks — export d'un événement vers Google Agenda
   ou un fichier .ics. Pur string-building : AUCUNE dépendance npm
   (pas de date-fns, pas de lib ical).

   Les deux formats veulent le même chose : un instant UTC au format
   iCalendar basique `YYYYMMDDTHHMMSSZ`. On le dérive de l'objet Date
   via ses getters UTC — donc indépendant du fuseau du navigateur.
   Un `Date` construit depuis un timestamptz Postgres est déjà le bon
   instant ; on ne fait que le formater.
═══════════════════════════════════════════════════════════════ */

export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  /** Défaut 60 minutes. */
  durationMinutes?: number;
}

export interface CalendarLinks {
  googleUrl: string;
  icsBlob: Blob;
  /** Le .ics brut — exposé pour les tests et pour un download sans Blob. */
  icsContent: string;
}

const DEFAULT_DURATION_MIN = 60;

/** Date → `YYYYMMDDTHHMMSSZ` (UTC). Le format attendu par iCal ET par Google. */
function toICalUtc(d: Date): string {
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

export function generateCalendarLinks(input: CalendarEventInput): CalendarLinks {
  const {
    title,
    description = "",
    location = "",
    startDate,
    durationMinutes = DEFAULT_DURATION_MIN,
  } = input;

  const end = new Date(startDate.getTime() + durationMinutes * 60_000);
  const dtStart = toICalUtc(startDate);
  const dtEnd = toICalUtc(end);

  /* ── Google Agenda ────────────────────────────────────────────
     `dates` veut `start/end` collés par un slash — que l'on NE doit
     pas encoder (URLSearchParams encoderait le `/` en %2F, ce que
     Google refuse). On assemble donc la query à la main, en encodant
     chaque valeur individuellement. */
  const googleParams = [
    "action=TEMPLATE",
    `text=${encodeURIComponent(title)}`,
    `dates=${dtStart}/${dtEnd}`,
    `details=${encodeURIComponent(description)}`,
    `location=${encodeURIComponent(location)}`,
  ].join("&");
  const googleUrl = `https://calendar.google.com/calendar/render?${googleParams}`;

  /* ── .ics ─────────────────────────────────────────────────────
     UID : stable pour un même (titre, instant) → ré-importer le même
     fichier met à jour l'événement au lieu d'en créer un doublon.
     Pas de Math.random() : deux téléchargements du même rendez-vous
     doivent produire le même UID. */
  const uid = `${dtStart}-${encodeURIComponent(title).slice(0, 40)}@nexussports.ca`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexus//Visite planifiee//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICalUtc(startDate)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldICalLine(`SUMMARY:${escapeICalText(title)}`),
    foldICalLine(`DESCRIPTION:${escapeICalText(description)}`),
    foldICalLine(`LOCATION:${escapeICalText(location)}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF obligatoire (RFC 5545 §3.1) — Outlook rejette les LF nus.
  const icsContent = lines.join("\r\n") + "\r\n";

  return {
    googleUrl,
    icsContent,
    icsBlob: new Blob([icsContent], { type: "text/calendar;charset=utf-8" }),
  };
}

/** Déclenche le téléchargement du .ics. No-op hors navigateur. */
export function downloadIcs(icsBlob: Blob, filename = "visite.ics"): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(icsBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
