/* ═══════════════════════════════════════════════════════════════
   Démo recruteurs du 12 octobre 2026 — constantes de la page publique
   /12octobre. Les courriels ont les leurs (Deno) dans
   supabase/functions/send-demo-inscription/email.ts : garder les deux
   alignés (date, lien Meet, lien de réservation).
═══════════════════════════════════════════════════════════════ */

export const DEMO_12_OCTOBRE = {
  libelle: "lundi 12 octobre 2026, de 12 h à 13 h (heure de Montréal)",
  libelleCourt: "lundi 12 octobre à 12 h",
  meet: "https://meet.google.com/myi-efqn-kes",
  reservation: "https://calendar.app.google/RUBKQe4k5ySpa6Be8",
  videoId: "bzZGBZWmq7k",
  telephone: "438-498-0494",
  courriel: "info@nexussports.ca",
} as const;

export type Participation = "DIRECT" | "ENREGISTREMENT";
export const PARTICIPATIONS: Participation[] = ["DIRECT", "ENREGISTREMENT"];

export const ROLES_DEMO = [
  { valeur: "RECRUTEUR", libelle: "Recruteur" },
  { valeur: "ENTRAINEUR_CHEF", libelle: "Entraîneur-chef" },
  { valeur: "DIRECTEUR_SPORTS", libelle: "Directeur des sports" },
  { valeur: "AUTRE", libelle: "Autre" },
] as const;

export const INTERETS_DEMO = [
  { valeur: "OUTILS", libelle: "Les outils de recrutement" },
  { valeur: "BASSIN", libelle: "Le bassin d'athlètes" },
  { valeur: "AUTRE", libelle: "Autre" },
] as const;

export const libelleParticipation: Record<Participation, string> = {
  DIRECT: "Démo en direct",
  ENREGISTREMENT: "Enregistrement",
};

/** L'inscription recruteur, courriel pré-rempli (modifiable). */
export function lienOuvrirCompte(courriel: string): string {
  const q = new URLSearchParams({ role: "collegial" });
  const c = courriel.trim();
  if (c) q.set("email", c);
  return `/auth/pro?${q.toString()}`;
}

export const estParticipation = (v: unknown): v is Participation =>
  typeof v === "string" && (PARTICIPATIONS as string[]).includes(v);

/** Message lisible pour une erreur de la RPC inscrire_demo. */
export function messageErreurInscription(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("trop de tentatives")) return "Trop de tentatives depuis votre connexion. Réessayez dans une heure, ou écrivez-nous.";
  if (m.includes("courriel invalide")) return "Ce courriel ne semble pas valide.";
  if (m.includes("obligatoires")) return "Le prénom, le nom et le courriel sont obligatoires.";
  if (m.includes("consentement")) return "Cochez la case de consentement pour recevoir les courriels de l'événement.";
  if (m.includes("participation")) return "Choisissez comment vous souhaitez participer.";
  return "L'inscription n'a pas pu être envoyée. Réessayez, ou écrivez-nous.";
}
