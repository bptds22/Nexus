"use client";

/* ═══════════════════════════════════════════════════════════════
   VisitCalendarCard — « Visite planifiée le … » + export agenda.

   Rendu UNIQUEMENT quand stage = VISITE_PLANIFIEE ET visit_at non nul
   (le gate vit chez l'appelant : pas de carte vide).

   Surface recruteur seulement — aucune donnée privée du recruteur
   (recruiter_pipeline.notes) ne transite ici. Avec `cible`, la carte lit
   les Détails de la visite de l'unité (lieu, Zoom, responsable, note) :
   ils suivent l'événement exporté (BP 2026-10-19, lib/calendar/evenementVisite).
═══════════════════════════════════════════════════════════════ */

import { Capacitor } from "@capacitor/core";

import { downloadIcs } from "@/lib/calendar/generateCalendarLinks";
import { aUneHeure, liensVisite, type EntreeVisite } from "@/lib/calendar/evenementVisite";
import { cleVisite } from "@/lib/visites/detailsVisite";
import { useDetailsVisites } from "@/lib/queries/recruiter/useDetailsVisites";

interface Props {
  /** Instant ISO (timestamptz) tel que lu en DB. */
  visitAtIso: string;
  athleteName: string;
  sport?: string;
  /** École de l'athlète — LOCATION quand la visite n'a ni adresse ni lien. */
  schoolName?: string;
  /** Le dossier de la visite : ses Détails (lieu, Zoom…) passent dans l'événement. */
  cible?: { id: string; prospect?: boolean };
  /** Mise en forme du cadre. Fournie, elle REMPLACE le défaut
   *  (`rounded-lg px-4 py-3`) au lieu de s'y ajouter : deux arrondis ou deux
   *  paddings dans la même chaîne, c'est l'ordre du CSS qui tranche, pas nous.
   *  Absente → rendu inchangé (pipeline, mobile). */
  className?: string;
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

/** Les deux boutons d'export d'une visite (Google Agenda, Ajouter au calendrier).
 *  Partagés par la carte de visite et la fenêtre Détails du calendrier. */
export function BoutonsAgendaVisite({ entree, compact = false }: { entree: EntreeVisite; compact?: boolean }) {
  const liens = liensVisite(entree);
  if (!liens) return null;
  const { googleUrl, icsBlob, icsName, evenement } = liens;

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

  /* LE vrai chemin natif (iOS + Android). Ni le download Blob (mort en
     WKWebView) ni la feuille de partage (`Share.share` n'offre PAS « Ajouter au
     calendrier » pour un .ics sur iOS) ni `Browser.open` sur un file:// (que
     SFSafariViewController refuse) ne mettent l'événement dans l'agenda.

     On utilise EventKit via @ebarooni/capacitor-calendar : `createEventWithPrompt`
     ouvre l'ÉDITEUR D'ÉVÉNEMENT NATIF pré-rempli (titre/date/lieu/description).
     L'utilisateur tape « Ajouter » → l'événement entre RÉELLEMENT dans le
     calendrier de l'appareil (iOS : EKEventEditViewController ; Android : intent
     d'insertion). iOS demande l'accès calendrier la 1ʳᵉ fois (clés Info.plist
     ajoutées). Web : download .ics classique (marche dans un vrai navigateur). */
  const addToCalendar = async () => {
    if (!Capacitor.isNativePlatform()) {
      downloadIcs(icsBlob, icsName);
      return;
    }
    try {
      const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
      const startMs = evenement.start.getTime();
      await CapacitorCalendar.createEventWithPrompt({
        title: evenement.title,
        location: evenement.location || undefined,
        description: evenement.description,
        startDate: startMs,
        // Toujours un événement d'1 h (jamais journée entière ni minuit→1h).
        endDate: startMs + evenement.durationMinutes * 60 * 1000,
      });
    } catch (e) {
      console.error("[visite mobile] createEventWithPrompt a échoué:", e);
    }
  };

  const btn = `flex-1 text-center rounded-lg border border-[#2D3748] bg-[#13151a] font-semibold text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] transition-colors ${
    compact ? "px-2 py-2 text-[13px]" : "px-3 py-2 text-sm"
  }`;
  return (
    <div className="flex gap-2" data-testid="boutons-agenda-visite">
      <button type="button" onClick={openGoogle} className={btn}>Google Agenda</button>
      <button type="button" onClick={addToCalendar} className={btn}>Ajouter au calendrier</button>
    </div>
  );
}

export default function VisitCalendarCard({ visitAtIso, athleteName, sport, schoolName, cible, className }: Props) {
  const detailsQ = useDetailsVisites(!!cible);
  const details = cible ? detailsQ.data?.parCle.get(cleVisite(cible.id, cible.prospect)) ?? null : null;

  const start = new Date(visitAtIso);
  if (Number.isNaN(start.getTime())) return null;

  const dateLabel = start.toLocaleDateString("fr-CA", DATE_FMT);
  const timeLabel = aUneHeure(start) ? start.toLocaleTimeString("fr-CA", TIME_FMT) : null;

  return (
    <div className={`bg-[#1A1D24] border border-[#2D3748] ${className ?? "rounded-lg px-4 py-3"}`}>
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

      <div className="mt-3">
        <BoutonsAgendaVisite entree={{ visitAtIso, athleteName, sport, schoolName, details }} />
      </div>
    </div>
  );
}
