/* carteAthlete — la ligne de public.partner_athlete_profile adaptée à la carte
   (AthletePlayerCard). Extrait de app/partenaire/athletes/[id]/PageClient.tsx
   (2026-10-18) pour l'aperçu des Téléchargements (6.6) : même adaptation, sans copie. */

import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import type { FormatCarte } from "@/lib/partenaires/journal";

/** Le SOUS-ENSEMBLE de public.partner_athlete_profile que la CARTE consomme.

    Ce n'est PAS le miroir du RETURNS TABLE — la fonction en projette 61
    depuis le 2026-09-04, et le miroir fidele vit dans `PartnerRpcRow`
    (components/shared/AthleteRecruiterProfileBody.tsx), le seul endroit ou
    verifier ce que la RPC rend vraiment. Ici on ne declare que ce que
    AthletePlayerCard affiche ; le corps de fiche partage lit le reste.

    Le CADRE qui decide du perimetre est dans le commentaire de la fonction
    en base : chiffres sur grille structuree oui, texte nominatif libre
    jamais, statut de recrutement masque (motif commercial). */
export type PartnerAthleteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  age: number | null;
  genre: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  cote_globale: number | string | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | string | null;
  bio: string | null;
  sport_nom: string | null;
  position_nom: string | null;
  position_abbr: string | null;
  school_name: string | null;
  school_region: string | null;
  school_city: string | null;
  school_type: string | null;
  is_civil: boolean | null;
  team_name: string | null;
  league_name: string | null;
  distinctions: unknown;
  video_faits_saillants_url: string | null;
  hudl_url: string | null;
  youtube_url: string | null;
};

/* PostgREST rend les colonnes `numeric` en CHAINE JSON ("5.00"), pas en nombre.
   Sans conversion, la cote passerait telle quelle a un composant qui attend un
   number — meme piege que dans partnerFilters.sortPartnerRows. */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Adapte la ligne de la RPC a la forme attendue par AthletePlayerCard.
 *
 * Les champs LAISSES VIDES le sont PAR CONSTRUCTION, pas par oubli : la RPC ne
 * les projette pas, et la fiche partenaire ne les affiche pas (elle est forcee
 * en mode « simple » et masque deja le bloc academique et le nom de
 * l'entraineur). Les remplir supposerait de rouvrir la porte que le point 5
 * ferme.
 *
 * `dateOfBirth: ""` en particulier : le type le declare requis, heritage du
 * chemin coach. Un partenaire ne recoit JAMAIS la date de naissance — l'age
 * derive suffit a tout ce que la carte affiche.
 */
export function mapPartnerRpcToRecruiterView(r: PartnerAthleteRow): AthleteProfileRecruiterView {
  const ft = r.taille_pieds ?? 0;
  const inch = r.taille_pouces ?? 0;
  const lbs = num(r.poids_lbs);
  const genre = r.genre === "M" || r.genre === "F" ? r.genre : "Autre";

  return {
    id: r.id,
    identityVisible: true,
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    age: r.age ?? 0,
    gender: genre,
    photoUrl: r.photo_url ?? undefined,
    schoolName: r.school_name ?? "",
    city: r.school_city ?? "",
    region: r.school_region ?? "",
    graduationYear: r.annee_diplomation ?? 0,
    dateOfBirth: "", // jamais projetee a un partenaire

    primarySport: r.sport_nom ?? "",
    primaryPosition: r.position_abbr ?? r.position_nom ?? "",
    jerseyNumber: r.numero_jersey ?? "",
    teamName: r.team_name ?? undefined,
    leagueName: r.league_name ?? undefined,

    heightFeet: ft,
    heightInches: inch,
    heightDisplay: ft ? `${ft}'${inch}"` : "",
    weightLbs: lbs,
    weightDisplay: lbs ? `${lbs} lb` : "",

    // Dossier scolaire et preferences d'etablissement — HORS PERIMETRE.
    strongSubjects: [],
    academicHonors: [],
    targetCegepProgram: [],
    openToRelocate: false,
    openToPrivate: false,
    openToAnglophone: false,
    wantsDEC: false,
    preferredRegions: [],

    // Texte libre d'un adulte sur un mineur — HORS PERIMETRE, definitivement.
    coachName: "",
    coachSchool: "",

    /* `cote_globale` est deja `coalesce(evaluation retenue,
       athletes.cote_globale_entraineur)` cote serveur depuis la migration
       20260904130334 — la meme preseance que la fiche recruteur. La carte
       partageable et le corps de fiche affichent donc le MEME nombre, sans
       que ni l'un ni l'autre n'ait a le recalculer. */
    overallRating: num(r.cote_globale),
    /* La carte ne consomme pas les distinctions ; le corps partage les rend
       lui-meme depuis la RPC. On evite de dupliquer ici la conversion
       jsonb -> DistinctionEntry[]. */
    distinctions: [],

    highlightVideoUrl: r.video_faits_saillants_url ?? undefined,
    hudlUrl: r.hudl_url ?? undefined,
    youtubeUrl: r.youtube_url ?? undefined,

    isCivil: r.is_civil ?? false,
    isVerified: r.verified ?? false,
    parentalConsent: false, // donnee de conformite, jamais projetee
    lastValidation: r.last_profile_validation,
    profileCompleteness: 0,
    favoriteCount: 0,
    viewsThisMonth: 0,
    isOpenToOffers: false,
  };
}

/** Les deux formats de la carte officielle (AthletePlayerCard), tailles RÉELLES des PNG. */
export const FORMATS_CARTE: Record<FormatCarte, { nom: string; taille: string; forme: string; ratio: number }> = {
  publication: { nom: "Publication", taille: "1080×1350", forme: "portrait 4:5", ratio: 1080 / 1350 },
  story: { nom: "Story", taille: "1080×1920", forme: "plein écran 9:16", ratio: 1080 / 1920 },
};

/** « Publication — 1080×1350 (portrait 4:5) » */
export function libelleFormat(f: FormatCarte): string {
  const m = FORMATS_CARTE[f];
  return `${m.nom} — ${m.taille} (${m.forme})`;
}
