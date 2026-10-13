/* ═══════════════════════════════════════════════════════════════
   /12octobre — accès à l'ENREGISTREMENT de la démo recruteurs, par jeton
   (décision BP 2026-10-13). Constantes partagées par la page, la route
   POST /api/demo-access et /12octobre/video. Pur, testé.

   L'ID YouTube n'est PAS ici : il vit dans la variable d'environnement
   serveur DEMO_YOUTUBE_ID, jamais dans le code.
═══════════════════════════════════════════════════════════════ */

export const DUREE_MINUTES = 35;

export const POINTS_DEMO = [
  "Mon processus : votre pipeline, vos notes, votre cote personnelle. Il remplace votre Excel.",
  "Le calendrier : les parties de vos cibles, quand le calendrier de leur ligue est publié.",
  "Le profil complet du joueur, avec l'évaluation validée par son coach.",
  "Les listes partagées à votre staff, la messagerie encadrée, votre page de programme.",
] as const;

export interface Chapitre { temps: string; secondes: number; titre: string }

const CHAPITRES_BRUTS: [string, string][] = [
  ["0:00", "Introduction — votre outil de recrutement, pas une banque de joueurs"],
  ["1:30", "Loi 25"],
  ["3:45", "Mon processus — votre pipeline, vos notes, votre cote personnelle"],
  ["6:35", "Relances et visites"],
  ["9:55", "Migrer votre Excel dans Mon processus"],
  ["12:15", "Le calendrier des matchs"],
  ["17:25", "La recherche : sport, position, année de graduation, cote"],
  ["18:00", "Le profil complet — mesures, stats, highlights, infos scolaires, cégeps ciblés"],
  ["22:45", "Les fédérations officielles Nexus"],
  ["25:55", "La messagerie encadrée et les périodes de blackout"],
  ["26:15", "La réputation du coach"],
  ["28:00", "Les listes"],
  ["28:25", "Votre page de programme"],
  ["32:15", "Prix et forfait groupe"],
  ["33:10", "Accès gratuit jusqu'au 31 octobre — comment commencer"],
];

/** « m:ss » → secondes. */
export function enSecondes(t: string): number {
  const [m, s] = t.split(":").map(Number);
  return m * 60 + s;
}

export const CHAPITRES: Chapitre[] = CHAPITRES_BRUTS.map(([temps, titre]) => ({ temps, secondes: enSecondes(temps), titre }));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const estUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** URL d'intégration YouTube (domaine sans témoins), départ à `debut` s. */
export function urlLecteur(idVideo: string, debut = 0, auto = false): string {
  const q = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (debut > 0) q.set("start", String(debut));
  if (auto) q.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(idVideo)}?${q.toString()}`;
}

/** Message lisible pour une erreur de la RPC demo_access_demander. */
export function messageErreurAcces(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("trop de tentatives")) return "Trop de tentatives depuis votre connexion. Réessayez dans une heure, ou écrivez-nous.";
  if (m.includes("courriel invalide")) return "Ce courriel ne semble pas valide.";
  if (m.includes("obligatoires")) return "Le prénom, le nom et le courriel sont obligatoires.";
  if (m.includes("consentement")) return "Cochez la case de consentement pour recevoir le lien par courriel.";
  return "La demande n'a pas pu être envoyée. Réessayez, ou écrivez-nous à info@nexussports.ca.";
}
