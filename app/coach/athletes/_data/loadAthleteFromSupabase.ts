import { createClient } from "@/lib/supabase/client";
import type { AthleteProfile } from "./mockAthleteProfiles";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Shared Supabase loader for coach athlete pages.
   Queries the athletes table and maps to both AthleteProfile
   and AthleteProfileRecruiterView types.
═══════════════════════════════════════════════════════════════ */

const ATHLETE_SELECT = `
  id,
  first_name,
  last_name,
  date_naissance,
  genre,
  photo_url,
  verified,
  profile_completion,
  verification_method,
  verified_at,
  verified_by,
  annee_diplomation,
  numero_jersey,
  cote_globale_entraineur,
  moyenne_generale,
  matieres_fortes,
  mentions_academiques,
  ouvert_cegep_prive,
  ouvert_cegep_anglophone,
  pret_changer_region,
  regions_cegep_preferees,
  taille_pieds,
  taille_pouces,
  poids_lbs,
  main_dominante,
  test_40_verges,
  saut_vertical,
  sprint_100m,
  video_faits_saillants_url,
  hudl_url,
  youtube_url,
  instagram_url,
  video_match_complet_url,
  bio,
  email,
  notes_coach,
  programme_cegep_vise,
  consentement_parental,
  status,
  sports!sport_id(nom),
  positions!position_id(nom, abreviation),
  evaluations(
    cote_globale, leadership, discipline, coachabilite, intelligence_jeu,
    competitivite, esprit_equipe, resilience, attitude_mentalite,
    rapport_entraineur, distinctions
  ),
  users!athletes_coach_id_fkey(first_name, last_name)
`;

export async function loadAthleteRaw(athleteId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log("Auth user:", user?.id, user?.email);

  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("athletes")
    .select(ATHLETE_SELECT)
    .eq("id", athleteId)
    .single();

  console.log("Athlete raw from Supabase:", JSON.stringify(data), "error:", error);
  return { data, error };
}

export function mapToAthleteProfile(raw: Record<string, unknown>): AthleteProfile {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const evals = Array.isArray(raw.evaluations) ? raw.evaluations : [];
  const eval0 = evals[0] as Record<string, unknown> | undefined;

  const heightFt = (raw.taille_pieds as number) || 0;
  const heightIn = (raw.taille_pouces as number) || 0;
  const weightLbs = (raw.poids_lbs as number) || 0;

  const profile: AthleteProfile = {
    id: raw.id as string,
    firstName: (raw.first_name as string) || "",
    lastName: (raw.last_name as string) || "",
    dateOfBirth: (raw.date_naissance as string) || "",
    niveau: "Sec. 5",
    position: posObj?.abreviation || posObj?.nom || "",
    jerseyNumber: raw.numero_jersey != null ? String(raw.numero_jersey) : undefined,
    photo: (raw.photo_url as string) || undefined,
    heightDisplay: heightFt ? `${heightFt}'${heightIn}"` : "",
    weightDisplay: weightLbs ? `${weightLbs} lbs` : "",
    fortyYard: (raw.test_40_verges as string) || undefined,
    videoUrl: (raw.video_faits_saillants_url as string) || undefined,
    gpa: (raw.moyenne_generale as number) || undefined,
    graduationYear: (raw.annee_diplomation as number) || 0,
    coachName: (() => {
      const coach = raw.users as { first_name?: string; last_name?: string } | null;
      return coach ? `${coach.first_name || ""} ${coach.last_name || ""}`.trim() : "";
    })(),
    coachSchool: "",
    profilePercent: (raw.profile_completion as number) || 0,
    isVerified: !!(raw.verified),
    views: 0,
    favorites: 0,
    stars: (eval0?.cote_globale as number) || (raw.cote_globale_entraineur as number) || 0,
    school: "",
    region: "",
    sport: (sportObj?.nom?.toLowerCase().replace(/ /g, "_") || "football") as AthleteProfile["sport"],
    badges: (eval0?.distinctions as AthleteProfile["badges"]) || [],
    coachEndorsement: (raw.notes_coach as string) || (eval0?.rapport_entraineur as string) || undefined,
    openToRelocate: !!(raw.pret_changer_region),
    openToPrivate: !!(raw.ouvert_cegep_prive),
    openToAnglophone: !!(raw.ouvert_cegep_anglophone),
  };

  console.log("Mapped AthleteProfile:", profile.firstName, profile.lastName, "pos:", profile.position, "sport:", profile.sport);
  return profile;
}

export function mapToRecruiterView(raw: Record<string, unknown>): AthleteProfileRecruiterView {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const evals = Array.isArray(raw.evaluations) ? raw.evaluations : [];
  const eval0 = evals[0] as Record<string, unknown> | undefined;
  const coach = raw.users as { first_name?: string; last_name?: string } | null;

  const heightFt = (raw.taille_pieds as number) || 0;
  const heightIn = (raw.taille_pouces as number) || 0;
  const weightLbs = (raw.poids_lbs as number) || 0;
  const posName = posObj?.nom || "";
  const posAbbr = posObj?.abreviation || "";
  const primaryPosition = posAbbr ? `${posName} (${posAbbr})` : posName;

  const traitRatings = eval0 ? {
    leadership: (eval0.leadership as number) || 0,
    discipline: (eval0.discipline as number) || 0,
    coachability: (eval0.coachabilite as number) || 0,
    gameIQ: (eval0.intelligence_jeu as number) || 0,
    competitiveness: (eval0.competitivite as number) || 0,
    teamwork: (eval0.esprit_equipe as number) || 0,
    resilience: (eval0.resilience as number) || 0,
    attitude: (eval0.attitude_mentalite as number) || 0,
  } : undefined;

  const view: AthleteProfileRecruiterView = {
    id: raw.id as string,
    firstName: (raw.first_name as string) || "",
    lastName: (raw.last_name as string) || "",
    age: 0,
    gender: ((raw.genre as string) || "M") as "M" | "F" | "Autre",
    photoUrl: (raw.photo_url as string) || "",
    schoolName: "",
    city: "",
    region: "",
    graduationYear: (raw.annee_diplomation as number) || 0,
    dateOfBirth: (raw.date_naissance as string) || "",
    primarySport: sportObj?.nom || "",
    primaryPosition,
    jerseyNumber: raw.numero_jersey != null ? String(raw.numero_jersey) : "",
    heightFeet: heightFt,
    heightInches: heightIn,
    heightDisplay: heightFt ? `${heightFt}'${heightIn}"` : "",
    weightLbs,
    weightDisplay: weightLbs ? `${weightLbs} lbs` : "",
    dominantHand: (raw.main_dominante as "Droite" | "Gauche" | "Ambidextre") || undefined,
    fortyYard: (raw.test_40_verges as string) || "",
    verticalJump: (raw.saut_vertical as string) || "",
    sprint100m: (raw.sprint_100m as string) || "",
    gpa: (raw.moyenne_generale as number) || undefined,
    strongSubjects: (raw.matieres_fortes as string[]) || [],
    academicHonors: (raw.mentions_academiques as string[]) || [],
    targetCegepProgram: [],
    openToRelocate: !!(raw.pret_changer_region),
    openToPrivate: !!(raw.ouvert_cegep_prive),
    openToAnglophone: !!(raw.ouvert_cegep_anglophone),
    wantsDEC: false,
    preferredRegions: (raw.regions_cegep_preferees as string[]) || [],
    coachName: coach ? `${coach.first_name || ""} ${coach.last_name || ""}`.trim() : "",
    coachSchool: "",
    coachReport: (raw.notes_coach as string) || (eval0?.rapport_entraineur as string) || "",
    traitRatings: traitRatings as AthleteProfileRecruiterView["traitRatings"],
    overallRating: (eval0?.cote_globale as number) || (raw.cote_globale_entraineur as number) || 0,
    distinctions: (eval0?.distinctions as AthleteProfileRecruiterView["distinctions"]) || [],
    highlightVideoUrl: (raw.video_faits_saillants_url as string) || "",
    hudlUrl: (raw.hudl_url as string) || "",
    youtubeUrl: (raw.youtube_url as string) || "",
    instagramUrl: (raw.instagram_url as string) || "",
    fullGameUrl: (raw.video_match_complet_url as string) || "",
    isVerified: !!(raw.verified),
    profileCompleteness: (raw.profile_completion as number) || 0,
    favoriteCount: 0,
    viewsThisMonth: 0,
    isOpenToOffers: true,
  };

  console.log("Mapped RecruiterView:", view.firstName, view.lastName, "pos:", view.primaryPosition);
  return view;
}
