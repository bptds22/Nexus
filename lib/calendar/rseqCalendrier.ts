/* ═══════════════════════════════════════════════════════════════
   rseqCalendrier — le calendrier de ligue RSEQ, servi par Nexus.

   POURQUOI UN RELAIS (bug 1.4.3, 2026-09-22). GenerateLeagueCalendar répond
   `Content-Type: text/html` pour un fichier .xlsx (vérifié en direct : corps
   qui commence par « PK », 132 ko, `Content-Disposition: attachment`). Un
   navigateur de bureau se fie à la disposition et télécharge ; Chrome
   Android (onglet personnalisé ouvert par @capacitor/browser) se fie au type
   et AFFICHE le binaire en texte. On ne peut pas corriger l'en-tête du RSEQ :
   la route /api/rseq/calendrier le re-sert avec le bon type.

   ── PAS UN PROXY OUVERT ─────────────────────────────────────────
   La route ne prend AUCUNE URL en paramètre : seulement un identifiant de
   ligue, validé comme GUID, collé dans l'adresse RSEQ fixe ci-dessous. Et
   elle ne relaie que ce qui ressemble à un classeur (signature ZIP « PK »).

   Fonctions PURES ici (aucun réseau) : la route les appelle, les tests les
   vérifient hors navigateur.
═══════════════════════════════════════════════════════════════ */

/** Adresse RSEQ, la SEULE que la route contacte. */
export const RSEQ_GENERATE_CALENDAR =
  "https://diffusion.s1.rseq.ca/api/LeagueApi/GenerateLeagueCalendar?leagueId=";

/** URL publique de la route. ABSOLUE, pas relative : dans l'app, la page
 *  vit sous https://localhost (le bundle), où /api n'existe pas — le lien
 *  doit sortir vers la production. Même raison que urlInvitation(). */
export const NEXUS_CALENDRIER_RSEQ = "https://nexussports.ca/api/rseq/calendrier";

export const TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vrai pour un GUID canonique (8-4-4-4-12 hexadécimaux), et RIEN d'autre :
 *  ni accolades, ni espaces, ni chemin, ni second paramètre. */
export function estGuid(v: string | null | undefined): v is string {
  return typeof v === "string" && GUID.test(v);
}

/** « Volleyball C F D2 Sud-Ouest (2026-2027) » → « volleyball-c-f-d2-sud-ouest-2026-2027 ».
 *  Minuscules ASCII, chiffres et tirets seulement, 60 caractères au plus :
 *  le résultat entre tel quel dans un en-tête Content-Disposition, il ne
 *  doit pouvoir y glisser ni guillemet, ni point-virgule, ni saut de ligne. */
export function slugLigue(nom: string | null | undefined): string {
  if (!nom) return "";
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Nom du fichier téléchargé. Sans nom de ligue exploitable, le début du
 *  GUID — jamais un nom vide. */
export function nomFichierCalendrier(leagueId: string, ligue: string | null | undefined): string {
  const slug = slugLigue(ligue) || leagueId.slice(0, 8).toLowerCase();
  return `calendrier-rseq-${slug}.xlsx`;
}

/** Lien de la carte de match vers la route Nexus. */
export function urlCalendrierRseq(leagueId: string, ligue?: string | null): string {
  const p = new URLSearchParams({ leagueId });
  const slug = slugLigue(ligue);
  if (slug) p.set("ligue", slug);
  return `${NEXUS_CALENDRIER_RSEQ}?${p.toString()}`;
}

/** Un classeur .xlsx est une archive ZIP : il commence par « PK\x03\x04 ».
 *  Tout le reste (page d'erreur, JSON 500 du RSEQ) n'est pas relayé. */
export function ressembleAXlsx(octets: Uint8Array): boolean {
  return octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04;
}
