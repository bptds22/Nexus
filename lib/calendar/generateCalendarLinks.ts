/* ═══════════════════════════════════════════════════════════════
   generateCalendarLinks — export d'un événement vers Google Agenda
   ou un fichier .ics. Pur string-building : AUCUNE dépendance npm
   (pas de date-fns, pas de lib ical).

   Les deux formats veulent le même chose : un instant UTC au format
   iCalendar basique `YYYYMMDDTHHMMSSZ`. On le dérive de l'objet Date
   via ses getters UTC — donc indépendant du fuseau du navigateur.
   Un `Date` construit depuis un timestamptz Postgres est déjà le bon
   instant ; on ne fait que le formater.

   Le corps .ics est délégué au helper pur `lib/utils/buildIcs` (source
   unique du VCALENDAR/VEVENT) ; ici on ne fait qu'y ajouter l'URL
   Google, le Blob et la commodité de download.
═══════════════════════════════════════════════════════════════ */

import { buildIcs, toICalUtc, toICalDate } from "@/lib/utils/buildIcs";

export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  /** Défaut 60 minutes. Ignoré si `allDay`. */
  durationMinutes?: number;
  /** Journée entière (ajout 2026-10-07, carte des matchs : match sans heure).
   *  Le jour LOCAL de `startDate` ; fin exclusive au lendemain. Absent → inchangé. */
  allDay?: boolean;
}

export interface CalendarLinks {
  googleUrl: string;
  /** Outlook (Microsoft 365 / outlook.office.com) — ajout du 2026-10-07 pour
   *  la carte des matchs. Les appelants d'avant l'ignorent. */
  outlookUrl: string;
  icsBlob: Blob;
  /** Le .ics brut — exposé pour les tests et pour un download sans Blob. */
  icsContent: string;
}

const DEFAULT_DURATION_MIN = 60;

export function generateCalendarLinks(input: CalendarEventInput): CalendarLinks {
  const {
    title,
    description = "",
    location = "",
    startDate,
    durationMinutes = DEFAULT_DURATION_MIN,
    allDay = false,
  } = input;

  const end = allDay
    ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1)
    : new Date(startDate.getTime() + durationMinutes * 60_000);
  // Journée entière : Google veut `YYYYMMDD/YYYYMMDD` (fin exclusive).
  const dtStart = allDay ? toICalDate(startDate) : toICalUtc(startDate);
  const dtEnd = allDay ? toICalDate(end) : toICalUtc(end);
  const isoJour = (d: Date) => toICalDate(d).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");

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

  /* ── Outlook ──────────────────────────────────────────────────
     Lien « composer un événement » d'Outlook sur le web. Les instants
     partent en ISO 8601 UTC (« …Z ») : Outlook les replace dans le fuseau
     de l'utilisateur. Chaque valeur encodée individuellement. */
  const outlookParams = [
    "path=%2Fcalendar%2Faction%2Fcompose",
    "rru=addevent",
    `subject=${encodeURIComponent(title)}`,
    ...(allDay
      ? ["allday=true", `startdt=${isoJour(startDate)}`, `enddt=${isoJour(end)}`]
      : [`startdt=${encodeURIComponent(startDate.toISOString())}`, `enddt=${encodeURIComponent(end.toISOString())}`]),
    `body=${encodeURIComponent(description)}`,
    `location=${encodeURIComponent(location)}`,
  ].join("&");
  const outlookUrl = `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams}`;

  /* ── .ics ─────────────────────────────────────────────────────
     Corps délégué au helper pur (source unique du VCALENDAR/VEVENT,
     escaping, folding et UID stable). */
  const icsContent = buildIcs({
    summary: title,
    start: startDate,
    end,
    location,
    description,
    allDay,
  });

  return {
    googleUrl,
    outlookUrl,
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
