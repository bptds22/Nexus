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

import { buildIcs, toICalUtc } from "@/lib/utils/buildIcs";

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
     Corps délégué au helper pur (source unique du VCALENDAR/VEVENT,
     escaping, folding et UID stable). */
  const icsContent = buildIcs({
    summary: title,
    start: startDate,
    end,
    location,
    description,
  });

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
