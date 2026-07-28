"use client";

/* ═══════════════════════════════════════════════════════════════
   VisitCalendarCard — « Visite planifiée le … » + export agenda.

   Rendu UNIQUEMENT quand stage = VISITE_PLANIFIEE ET visit_at non nul
   (le gate vit chez l'appelant : pas de carte vide).

   Surface recruteur seulement — aucune donnée privée du recruteur
   (recruiter_pipeline.notes) ne transite ici : la carte ne connaît que
   l'athlète et l'instant.
═══════════════════════════════════════════════════════════════ */

import { Capacitor } from "@capacitor/core";

import { generateCalendarLinks, downloadIcs } from "@/lib/calendar/generateCalendarLinks";

interface Props {
  /** Instant ISO (timestamptz) tel que lu en DB. */
  visitAtIso: string;
  athleteName: string;
  sport?: string;
  /** École de l'athlète — devient LOCATION dans l'événement. */
  schoolName?: string;
}

/* L'app est FR-CA et le produit est québécois : on formate dans le
   fuseau local du navigateur (America/Toronto pour l'utilisateur cible).
   `visit_at` est un instant absolu — c'est bien à l'affichage qu'on le
   ramène en heure locale. */
const DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};
const TIME_FMT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

/** Minuit pile = l'utilisateur n'a pas saisi d'heure (elle est optionnelle).
 *  On n'affiche alors pas « à 00:00 », qui se lirait comme un vrai rendez-vous. */
function hasTimeComponent(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

export default function VisitCalendarCard({ visitAtIso, athleteName, sport, schoolName }: Props) {
  const start = new Date(visitAtIso);
  if (Number.isNaN(start.getTime())) return null;

  const withTime = hasTimeComponent(start);
  const dateLabel = start.toLocaleDateString("fr-CA", DATE_FMT);
  const timeLabel = withTime ? start.toLocaleTimeString("fr-CA", TIME_FMT) : null;

  const title = sport ? `Visite — ${athleteName} (${sport})` : `Visite — ${athleteName}`;
  const { googleUrl, icsBlob, icsContent } = generateCalendarLinks({
    title,
    description: `Visite planifiée avec ${athleteName} via Nexus.`,
    location: schoolName || "",
    startDate: start,
    durationMinutes: 60,
  });

  const icsName = `visite-${athleteName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.ics`;

  /* Capacitor WebView ne sait pas ouvrir un onglet (`target="_blank"` navigue
     in-app ou no-op). Sur device on délègue au navigateur système via
     @capacitor/browser — même convention que les écrans Paramètres. */
  const openGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: googleUrl });
    } else {
      window.open(googleUrl, "_blank", "noopener,noreferrer");
    }
  };

  /* Le download Blob (`URL.createObjectURL` + `<a download>`) est mort dans
     WKWebView (iOS) et l'Android WebView. Sur device on écrit le .ics dans le
     cache puis on ouvre la feuille de partage native (Calendrier, Mail, Fichiers…)
     — même pattern que MonParcoursMobile (Filesystem + Share). Web inchangé. */
  const exportIcs = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
        const written = await Filesystem.writeFile({
          path: icsName,
          data: icsContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const { Share } = await import("@capacitor/share");
        await Share.share({
          title: "Visite planifiée",
          files: [written.uri],
          dialogTitle: "Ajouter au calendrier",
        });
      } catch (e) {
        console.error("[visite mobile] native calendar export failed:", e);
      }
    } else {
      downloadIcs(icsBlob, icsName);
    }
  };

  return (
    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <p className="text-sm text-white">
          <span className="font-semibold">Visite planifiée</span>
          {" le "}
          {dateLabel}
          {timeLabel && <> à {timeLabel}</>}
        </p>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={openGoogle}
          className="flex-1 text-center px-3 py-2 rounded-lg border border-[#2D3748] bg-[#13151a] text-sm font-semibold text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] transition-colors"
        >
          Google Agenda
        </button>
        <button
          type="button"
          onClick={exportIcs}
          className="flex-1 px-3 py-2 rounded-lg border border-[#2D3748] bg-[#13151a] text-sm font-semibold text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] transition-colors"
        >
          Ajouter au calendrier
        </button>
      </div>
    </div>
  );
}
