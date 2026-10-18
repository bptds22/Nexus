/* ═══════════════════════════════════════════════════════════════
   Flux d'agenda du recruteur Pro — le format iCalendar (RFC 5545), pur.

   Décision BP 2026-10-01 : RELANCES et VISITES de l'unité.
     · Relance — journée entière à l'échéance, la note en description ;
     · Visite  — à l'heure prévue, 1 h par défaut (la durée n'est pas saisie) ;
     · chaque événement porte le lien vers le dossier dans Mon processus.
   Décision BP 2026-10-09 : les MATCHS ajoutés aussi — par l'unité (flux
   recruteur, nxa_) ou par le partenaire (flux partenaire, nxp_).
     · Match — heure de la source lue par instantMatch (lib/calendar/heureMatch,
       la SEULE lecture d'heure : « 6:30 PM » = 18 h 30 à Montréal), 2 h par
       défaut ; sans heure lisible, journée entière — jamais une heure inventée.
   Les noms arrivent déjà filtrés par la base (agenda_flux : « Identité
   réservée » pour un mineur non consentant) ; ce module ne les recalcule pas.
═══════════════════════════════════════════════════════════════ */

import { instantMatch } from "@/lib/calendar/heureMatch";
import { nomGroupe } from "@/lib/civil/classementCivil";

export interface EvenementAgenda {
  type: "RELANCE" | "VISITE";
  cible: "athlete" | "carte";
  cible_id: string;
  nom: string | null;
  /** Relance : "YYYY-MM-DD". */
  jour: string | null;
  /** Visite : timestamptz ISO. */
  instant: string | null;
  note: string | null;
}

/** Détails d'une visite pour l'agenda (agenda_visites_details, BP 2026-10-18) :
 *  le lieu, le lien Zoom et le responsable suivent l'événement dans Google / Outlook. */
export interface DetailsVisiteAgenda {
  cible: "athlete" | "carte";
  cible_id: string;
  format: "EN_PERSONNE" | "ZOOM" | "TELEPHONE";
  adresse: string | null;
  lien: string | null;
  /** Nom résolu : recruteur Nexus, sinon le nom tapé. */
  responsable: string | null;
  note: string | null;
}

const FORMAT_AGENDA: Record<DetailsVisiteAgenda["format"], string> = {
  EN_PERSONNE: "En personne",
  ZOOM: "Zoom",
  TELEPHONE: "Téléphone",
};

/** Clé d'une visite dans les détails : « athlete:<id> » ou « carte:<id> ». */
export const cleDetailsAgenda = (d: Pick<DetailsVisiteAgenda, "cible" | "cible_id">) => `${d.cible}:${d.cible_id}`;

export function indexerDetailsAgenda(lignes: readonly DetailsVisiteAgenda[]): Map<string, DetailsVisiteAgenda> {
  return new Map(lignes.map((d) => [cleDetailsAgenda(d), d]));
}

/** LOCATION, URL et lignes de DESCRIPTION d'une visite détaillée. Le lien Zoom
 *  n'est retenu que s'il est en https:// (la base l'exige déjà). */
export function champsVisiteAgenda(d: DetailsVisiteAgenda | undefined): { lieu: string | null; url: string | null; lignes: string[] } {
  if (!d) return { lieu: null, url: null, lignes: [] };
  const lien = d.format === "ZOOM" && d.lien && /^https:\/\//i.test(d.lien.trim()) ? d.lien.trim() : null;
  const adresse = d.format === "EN_PERSONNE" ? d.adresse?.trim() || null : null;
  return {
    lieu: adresse ?? lien,
    url: lien,
    lignes: [
      `Format : ${FORMAT_AGENDA[d.format] ?? d.format}`,
      d.responsable?.trim() ? `Responsable : ${d.responsable.trim()}` : null,
      lien ? `Zoom : ${lien}` : null,
      d.note?.trim() || null,
    ].filter((x): x is string => !!x),
  };
}

export const NOM_CALENDRIER = "Nexus — relances, visites et matchs";
export const NOM_CALENDRIER_PARTENAIRE = "Nexus — mes matchs";

/** Un match d'un flux d'agenda (agenda_matchs_unite / agenda_matchs_partenaire) :
 *  l'heure arrive BRUTE (« 6:30 PM », « 18:30 », ou null). */
export interface MatchAgenda {
  game_id: string;
  jour: string;
  heure: string | null;
  domicile: string;
  visiteur: string;
  terrain: string | null;
  ligue: string | null;
  /** Le groupe du match (BP 2026-10-09) : « Atome Nord », « Pee-Wee AAA Sud ».
   *  La zone en fait partie — deux groupes ne se confondent jamais. */
  categorie?: string | null;
  division?: string | null;
  zone?: string | null;
}

/** Durée d'un match dans l'agenda : la source ne la donne pas. */
const DUREE_MATCH_MS = 2 * 3600_000;

export interface OptionsIcs {
  /** Les matchs à ajouter au flux. */
  matchs?: MatchAgenda[];
  /** Nom du calendrier affiché par l'agenda (défaut : celui du recruteur). */
  nom?: string;
  /** Lien d'un match (la carte des matchs du rôle) ; aucun lien si absent. */
  lienMatch?: (m: MatchAgenda) => string;
  /** Détails des visites, par cleDetailsAgenda (lieu, Zoom, responsable). */
  detailsVisites?: Map<string, DetailsVisiteAgenda>;
}

/** Échappement TEXT de la RFC 5545 (§3.3.11). */
export function echapper(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** Pliage à 75 octets (§3.1), sans couper un caractère UTF-8. */
export function plier(ligne: string): string {
  const enc = new TextEncoder();
  if (enc.encode(ligne).length <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  let octets = 0;
  let limite = 75;
  for (const ch of ligne) {
    const n = enc.encode(ch).length;
    if (octets + n > limite) {
      morceaux.push(courant);
      courant = "";
      octets = 0;
      limite = 74; // la ligne de continuation commence par une espace
    }
    courant += ch;
    octets += n;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

const p2 = (n: number) => String(n).padStart(2, "0");

function horodatageUtc(d: Date): string {
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
}

function dateIcs(jour: string): string {
  return jour.slice(0, 10).replace(/-/g, "");
}

function lendemain(jour: string): string {
  const [a, m, j] = jour.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + 1));
  return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}`;
}

/** Le dossier dans Mon processus — `?athlete=` ouvre aussi une carte prospect. */
export function lienDossier(origine: string, e: Pick<EvenementAgenda, "cible_id">): string {
  return `${origine.replace(/\/$/, "")}/recruteur/pipeline?athlete=${encodeURIComponent(e.cible_id)}`;
}

export function titreEvenement(e: Pick<EvenementAgenda, "type" | "nom">): string {
  const nom = (e.nom ?? "").trim() || "Identité réservée";
  return `${e.type === "RELANCE" ? "Relance" : "Visite"} — ${nom}`;
}

/** Le calendrier complet. Un tableau vide donne un calendrier VALIDE, vide. */
export function genererIcs(evenements: EvenementAgenda[], origine: string, maintenant = new Date(), options: OptionsIcs = {}): string {
  const stamp = horodatageUtc(maintenant);
  const l: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexus//Agenda recruteur//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(options.nom ?? NOM_CALENDRIER)}`,
    "X-WR-TIMEZONE:America/Toronto",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of evenements) {
    const lien = lienDossier(origine, e);
    const visite = e.type === "VISITE" ? champsVisiteAgenda(options.detailsVisites?.get(cleDetailsAgenda(e))) : null;
    const description = [
      visite && visite.lignes.length > 0 ? visite.lignes.join("\n") : null,
      e.note?.trim(),
      `Dossier : ${lien}`,
    ].filter(Boolean).join("\n\n");
    const debutFin: string[] = [];
    if (e.type === "RELANCE") {
      if (!e.jour) continue;
      debutFin.push(`DTSTART;VALUE=DATE:${dateIcs(e.jour)}`, `DTEND;VALUE=DATE:${lendemain(e.jour)}`);
    } else {
      if (!e.instant) continue;
      const debut = new Date(e.instant);
      if (Number.isNaN(debut.getTime())) continue;
      debutFin.push(`DTSTART:${horodatageUtc(debut)}`, `DTEND:${horodatageUtc(new Date(debut.getTime() + 3600_000))}`);
    }
    l.push(
      "BEGIN:VEVENT",
      // Stable d'une lecture à l'autre : l'agenda met à jour au lieu de dupliquer.
      `UID:${e.type.toLowerCase()}-${e.cible}-${e.cible_id}@nexussports.ca`,
      `DTSTAMP:${stamp}`,
      ...debutFin,
      `SUMMARY:${echapper(titreEvenement(e))}`,
      ...(visite?.lieu ? [`LOCATION:${echapper(visite.lieu)}`] : []),
      `DESCRIPTION:${echapper(description)}`,
      // Visite sur Zoom : le lien de la rencontre ; sinon le dossier (aussi dans la description).
      `URL:${visite?.url ?? lien}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  for (const m of options.matchs ?? []) {
    const debutFin = debutFinMatch(m);
    if (!debutFin) continue;
    const lien = options.lienMatch?.(m);
    const description = [
      m.ligue?.trim() || null,
      m.heure && !instantMatch(m.jour, m.heure) ? `Heure publiée : ${m.heure}` : null,
      debutFin[0].includes("VALUE=DATE") ? "Heure à confirmer à la source." : null,
      lien ? `Carte des matchs : ${lien}` : null,
    ].filter(Boolean).join("\n\n");
    l.push(
      "BEGIN:VEVENT",
      `UID:match-${m.game_id}@nexussports.ca`,
      `DTSTAMP:${stamp}`,
      ...debutFin,
      `SUMMARY:${echapper(titreMatchAgenda(m))}`,
      ...(m.terrain ? [`LOCATION:${echapper(m.terrain)}`] : []),
      ...(description ? [`DESCRIPTION:${echapper(description)}`] : []),
      ...(lien ? [`URL:${lien}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  l.push("END:VCALENDAR");
  return l.map(plier).join("\r\n") + "\r\n";
}

export function titreMatchAgenda(m: Pick<MatchAgenda, "domicile" | "visiteur" | "categorie" | "division" | "zone">): string {
  const groupe = nomGroupe(m);
  return `Match — ${m.domicile} vs ${m.visiteur}${groupe ? ` · ${groupe}` : ""}`;
}

/** DTSTART / DTEND d'un match : l'instant de Montréal (instantMatch), 2 h ; sans
 *  heure lisible, la journée entière. null si le jour est illisible. */
export function debutFinMatch(m: Pick<MatchAgenda, "jour" | "heure">): [string, string] | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(m.jour ?? "")) return null;
  const debut = instantMatch(m.jour.slice(0, 10), m.heure);
  if (debut) return [`DTSTART:${horodatageUtc(debut)}`, `DTEND:${horodatageUtc(new Date(debut.getTime() + DUREE_MATCH_MS))}`];
  return [`DTSTART;VALUE=DATE:${dateIcs(m.jour)}`, `DTEND;VALUE=DATE:${lendemain(m.jour)}`];
}

/* ── Les adresses d'abonnement ─────────────────────────────── */

export function adresseFlux(origine: string, jeton: string): string {
  return `${origine.replace(/\/$/, "")}/api/agenda/${jeton}.ics`;
}

export function adresseWebcal(httpsUrl: string): string {
  return httpsUrl.replace(/^https?:\/\//, "webcal://");
}

/** Google Agenda : « Ajouter un agenda à partir d'une URL », pré-rempli. */
export function lienGoogle(httpsUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(adresseWebcal(httpsUrl))}`;
}

/** Outlook (Microsoft 365, comptes de cégep). */
export function lienOutlook(httpsUrl: string, nom: string = NOM_CALENDRIER): string {
  return `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(nom)}`;
}

/** Outlook.com (compte personnel). */
export function lienOutlookPerso(httpsUrl: string, nom: string = NOM_CALENDRIER): string {
  return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(nom)}`;
}

/** « Comment faire ? » — pages d'aide OFFICIELLES, en français (vérifiées 2026-10-11).
 *  Apple : une seule page couvre l'iPhone et le Mac. Microsoft redirige vers
 *  /fr-fr/outlook/… ; l'adresse ci-dessous reste valide. */
export const AIDE_AGENDA = {
  google: "https://support.google.com/calendar/answer/37100?hl=fr",
  outlook: "https://support.microsoft.com/fr-fr/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c",
  apple: "https://support.apple.com/fr-ca/102301",
} as const;

/** Le jeton tel que l'émet agenda_jeton_creer() — tout autre segment est rejeté avant la base. */
/** nxa_ : recruteur (agenda_jetons) ; nxp_ : partenaire (agenda_jetons_partenaire). */
export const FORME_JETON = /^nx[ap]_[0-9a-f]{64}$/;
export const estJetonPartenaire = (jeton: string) => jeton.startsWith("nxp_");
