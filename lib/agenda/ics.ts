/* ═══════════════════════════════════════════════════════════════
   Flux d'agenda du recruteur Pro — le format iCalendar (RFC 5545), pur.

   Décision BP 2026-10-01 : RELANCES et VISITES de l'unité, pas de matchs.
     · Relance — journée entière à l'échéance, la note en description ;
     · Visite  — à l'heure prévue, 1 h par défaut (la durée n'est pas saisie) ;
     · chaque événement porte le lien vers le dossier dans Mon processus.
   Les noms arrivent déjà filtrés par la base (agenda_flux : « Identité
   réservée » pour un mineur non consentant) ; ce module ne les recalcule pas.
═══════════════════════════════════════════════════════════════ */

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

export const NOM_CALENDRIER = "Nexus — relances et visites";

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
export function genererIcs(evenements: EvenementAgenda[], origine: string, maintenant = new Date()): string {
  const stamp = horodatageUtc(maintenant);
  const l: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nexus//Agenda recruteur//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(NOM_CALENDRIER)}`,
    "X-WR-TIMEZONE:America/Toronto",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of evenements) {
    const lien = lienDossier(origine, e);
    const description = [e.note?.trim(), `Dossier : ${lien}`].filter(Boolean).join("\n\n");
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
      `DESCRIPTION:${echapper(description)}`,
      `URL:${lien}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  l.push("END:VCALENDAR");
  return l.map(plier).join("\r\n") + "\r\n";
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
export function lienOutlook(httpsUrl: string): string {
  return `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(NOM_CALENDRIER)}`;
}

/** Outlook.com (compte personnel). */
export function lienOutlookPerso(httpsUrl: string): string {
  return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(NOM_CALENDRIER)}`;
}

/** Le jeton tel que l'émet agenda_jeton_creer() — tout autre segment est rejeté avant la base. */
export const FORME_JETON = /^nxa_[0-9a-f]{64}$/;
