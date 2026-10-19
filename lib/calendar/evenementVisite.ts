/* ═══════════════════════════════════════════════════════════════
   evenementVisite — L'événement d'agenda d'une visite planifiée, UNE source
   pour tous les boutons « Google Agenda » / « Ajouter au calendrier »
   (BP 2026-10-19) : Détails de visite du calendrier, Mon processus (web et
   appli) et la fiche athlète.

     · LIEU        = l'adresse (en personne) ou le lien Zoom ; sans détails,
                     l'école de l'athlète (comportement d'avant) ;
     · DESCRIPTION = le format, le responsable, le lien Zoom ou le téléphone,
                     les notes.

   Le téléphone n'est pas une donnée des détails (la base garde le format,
   pas de numéro) : « Format : Téléphone » le dit. Mêmes règles que le flux
   d'agenda (lib/agenda/ics.ts, champsVisiteAgenda). Pur : aucune horloge.
═══════════════════════════════════════════════════════════════ */

import { generateCalendarLinks, type CalendarLinks } from "@/lib/calendar/generateCalendarLinks";
import { LIBELLE_FORMAT, type DetailsVisite } from "@/lib/visites/detailsVisite";

export interface EntreeVisite {
  /** Instant ISO (timestamptz) de la visite. */
  visitAtIso: string;
  athleteName: string;
  sport?: string | null;
  /** École de l'athlète : le lieu quand aucune adresse ni lien n'est connu. */
  schoolName?: string | null;
  /** Détails de la visite (visites_details_unite), s'il y en a. */
  details?: Pick<DetailsVisite, "format" | "adresse" | "lien" | "responsable_nom" | "note"> | null;
}

export interface EvenementVisite {
  title: string;
  location: string;
  description: string;
  start: Date;
  durationMinutes: number;
}

const net = (v: string | null | undefined) => (v ?? "").trim();

/** Minuit pile = aucune heure saisie (elle est facultative). */
export function aUneHeure(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** null si l'instant est illisible. Sans heure saisie, l'événement part à 12 h
 *  (sinon l'agenda montre « minuit → 1 h »). Toujours 1 h. */
export function evenementVisite(e: EntreeVisite): EvenementVisite | null {
  const brut = new Date(e.visitAtIso);
  if (Number.isNaN(brut.getTime())) return null;
  const start = aUneHeure(brut)
    ? brut
    : new Date(brut.getFullYear(), brut.getMonth(), brut.getDate(), 12, 0, 0, 0);

  const d = e.details ?? null;
  const lien = d?.format === "ZOOM" && /^https:\/\//i.test(net(d.lien)) ? net(d.lien) : "";
  const adresse = d?.format === "EN_PERSONNE" ? net(d.adresse) : "";

  const lignes = d
    ? [
        `Format : ${LIBELLE_FORMAT[d.format] ?? d.format}`,
        net(d.responsable_nom) ? `Responsable : ${net(d.responsable_nom)}` : "",
        lien ? `Zoom : ${lien}` : "",
        adresse ? `Adresse : ${adresse}` : "",
        net(d.note),
      ]
    : [];

  return {
    title: e.sport ? `Visite — ${e.athleteName} (${e.sport})` : `Visite — ${e.athleteName}`,
    location: adresse || lien || net(e.schoolName),
    description: [`Visite planifiée avec ${e.athleteName} via Nexus.`, ...lignes].filter(Boolean).join("\n"),
    start,
    durationMinutes: 60,
  };
}

/** Le lien Google et le .ics de la visite. */
export function liensVisite(e: EntreeVisite): (CalendarLinks & { evenement: EvenementVisite; icsName: string }) | null {
  const ev = evenementVisite(e);
  if (!ev) return null;
  const liens = generateCalendarLinks({
    title: ev.title,
    description: ev.description,
    location: ev.location,
    startDate: ev.start,
    durationMinutes: ev.durationMinutes,
  });
  return { ...liens, evenement: ev, icsName: nomFichierVisite(e.athleteName) };
}

/** « visite-jean-tremblay.ics » (accents retirés). */
export function nomFichierVisite(nom: string): string {
  const base = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `visite-${base || "nexus"}.ics`;
}
