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
  pied_dominant,
  envergure,
  taille_mains,
  test_40_verges,
  saut_vertical,
  saut_longueur,
  sprint_100m,
  developpe_couche,
  navette_agilite,
  video_faits_saillants_url,
  hudl_url,
  youtube_url,
  instagram_url,
  video_match_complet_url,
  video_entrainement_url,
  bio,
  email,
  telephone,
  nom_parent,
  telephone_parent,
  notes_coach,
  programme_cegep_vise,
  consentement_parental,
  status,
  statut_recrutement_override,
  recrutement_override_at,
  recruitment_status,
  committed_school_id,
  open_to_offers,
  position_secondaire_id,
  school_id,
  coach_id,
  sports!sport_id(nom),
  positions!position_id(nom, abreviation),
  schools!school_id(name, city, region),
  committed_school:schools!committed_school_id(name),
  evaluations(
    cote_globale, leadership, discipline, coachabilite, intelligence_jeu,
    competitivite, esprit_equipe, resilience, attitude_mentalite,
    rapport_entraineur, distinctions
  ),
  users!coach_id(first_name, last_name)
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

  // Resolve secondary position name (can't do two FK joins to same table)
  if (data && (data as Record<string, unknown>).position_secondaire_id) {
    const { data: secPos } = await supabase
      .from("positions")
      .select("nom, abreviation")
      .eq("id", (data as Record<string, unknown>).position_secondaire_id)
      .single();
    if (secPos) {
      (data as Record<string, unknown>)._secondary_position = secPos;
    }
  }

  return { data, error };
}

export function mapToAthleteProfile(raw: Record<string, unknown>): AthleteProfile {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const schoolObj = schoolRel as { name?: string; city?: string; region?: string } | null;
  const evals = Array.isArray(raw.evaluations) ? raw.evaluations : [];
  const eval0 = evals[0] as Record<string, unknown> | undefined;
  console.log("School data:", schoolObj?.name, "Coach data:", raw.users);

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
    coachSchool: schoolObj?.name || "",
    profilePercent: (raw.profile_completion as number) || 0,
    isVerified: !!(raw.verified),
    views: 0,
    favorites: 0,
    stars: (eval0?.cote_globale as number) || (raw.cote_globale_entraineur as number) || 0,
    school: schoolObj?.name || "",
    region: "",
    sport: (sportObj?.nom?.toLowerCase().replace(/ /g, "_") || "football") as AthleteProfile["sport"],
    badges: ((eval0?.distinctions as AthleteProfile["badges"]) || []).filter((b) => b != null),
    coachEndorsement: (raw.notes_coach as string) || (eval0?.rapport_entraineur as string) || undefined,
    openToRelocate: !!(raw.pret_changer_region),
    openToPrivate: !!(raw.ouvert_cegep_prive),
    openToAnglophone: !!(raw.ouvert_cegep_anglophone),
  };

  console.log("Mapped AthleteProfile:", profile.firstName, profile.lastName, "pos:", profile.position, "sport:", profile.sport);
  return profile;
}

/** Build modifier form data directly from raw Supabase response — preserves ALL fields */
export function buildFormFromRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const schoolObj = schoolRel as { name?: string; city?: string; region?: string } | null;
  const evals = Array.isArray(raw.evaluations) ? raw.evaluations : [];
  const eval0 = evals[0] as Record<string, unknown> | undefined;

  console.log("buildFormFromRaw school:", schoolObj);
  console.log("buildFormFromRaw matieres_fortes:", raw.matieres_fortes);
  console.log("buildFormFromRaw regions_cegep:", raw.regions_cegep_preferees);
  console.log("buildFormFromRaw evaluation:", eval0 ? JSON.stringify(eval0) : "null");
  console.log("buildFormFromRaw distinctions:", eval0?.distinctions);

  const heightFt = raw.taille_pieds != null ? String(raw.taille_pieds) : "";
  const heightIn = raw.taille_pouces != null ? String(raw.taille_pouces) : "";
  const weightLbs = raw.poids_lbs != null ? String(raw.poids_lbs) : "";

  // Parse programme_cegep_vise
  let progArr: string[] = [];
  const progRaw = raw.programme_cegep_vise;
  if (Array.isArray(progRaw)) progArr = progRaw.filter((v) => v != null);
  else if (typeof progRaw === "string" && progRaw.startsWith("[")) try { progArr = JSON.parse(progRaw).filter((v: unknown) => v != null); } catch { /* */ }

  const formData = {
    identity: {
      identityMode: "detailed",
      photo: (raw.photo_url as string) || "",
      firstName: (raw.first_name as string) || "",
      lastName: (raw.last_name as string) || "",
      gender: (raw.genre as string) || "",
      dateOfBirth: (raw.date_naissance as string) || "",
      gradYear: raw.annee_diplomation != null ? String(raw.annee_diplomation) : "",
      school: schoolObj?.name || "",
      city: schoolObj?.city || "",
      region: schoolObj?.region || "",
      phone: (raw.telephone as string) || "",
      email: (raw.email as string) || "",
      parentName: (raw.nom_parent as string) || "",
      parentPhone: (raw.telephone_parent as string) || "",
    },
    academic: {
      academicMode: "simple",
      gpa: raw.moyenne_generale != null ? String(raw.moyenne_generale) : "",
      strongSubjects: (raw.matieres_fortes as string[]) || [],
      academicHonors: (raw.mentions_academiques as string[]) || [],
      cegepType: progArr.some((p) => p.toLowerCase().includes("technique")) ? "technique" : progArr.length > 0 ? "dec_general" : "",
      cegepProgramDetail: progArr.find((p) => p.toLowerCase().includes("technique")) || "",
      openToPrivate: !!(raw.ouvert_cegep_prive),
      openToAnglophone: !!(raw.ouvert_cegep_anglophone),
      openToRelocate: !!(raw.pret_changer_region),
      cegepRegions: (raw.regions_cegep_preferees as string[]) || [],
    },
    physical: {
      physicalMode: "simple",
      heightFeet: heightFt,
      heightInches: heightIn,
      weightLbs: weightLbs,
      wingspan: (raw.envergure as string) || "",
      handSize: (raw.taille_mains as string) || "",
      dominantHand: (raw.main_dominante as string) || "",
      dominantFoot: (raw.pied_dominant as string) || "",
      fortyYard: (raw.test_40_verges as string) || "",
      verticalJump: (raw.saut_vertical as string) || "",
      broadJump: (raw.saut_longueur as string) || "",
      benchPress: (raw.developpe_couche as string) || "",
      shuttleAgility: (raw.navette_agilite as string) || "",
      sprint100m: (raw.sprint_100m as string) || "",
    },
    sports: {
      sportsMode: "detailed",
      primarySport: sportObj?.nom || "",
      primarySportDetail: "",
      secondarySport: "",
      secondarySportDetail: "",
      primaryPosition: posObj?.abreviation || posObj?.nom || "",
      secondaryPosition: (() => {
        const sp = raw._secondary_position as { abreviation?: string; nom?: string } | undefined;
        return sp?.abreviation || sp?.nom || "";
      })(),
      secondarySportPosition: "",
      selectedTeamId: "",
      currentTeam: "",
      teamLevel: "",
      teamDivision: "",
      jerseyNumber: raw.numero_jersey != null ? String(raw.numero_jersey) : "",
      league: "",
      secondaryTeamId: "",
      secondaryTeam: "",
      secondaryTeamLevel: "",
      secondaryTeamDivision: "",
      secondaryLeague: "",
      recruitingLevel: "",
      openToCoaching: !!(raw.ouvert_entraineur_cegep),
    },
    scouting: {
      evalMode: "simple",
      starRating: (eval0?.cote_globale as number) || (raw.cote_globale_entraineur as number) || 0,
      traitRatings: eval0 ? {
        leadership: (eval0.leadership as number) || 0,
        ethique_travail: (eval0.discipline as number) || 0,
        coachabilite: (eval0.coachabilite as number) || 0,
        vision_jeu: (eval0.intelligence_jeu as number) || 0,
        esprit_equipe: (eval0.esprit_equipe as number) || 0,
        competitivite_resilience: (eval0.competitivite as number) || (eval0.resilience as number) || 0,
        vitesse_explosivite: 0,
        force_puissance: 0,
        endurance_cardio: 0,
        agilite_coordination: 0,
        sens_tactique: 0,
      } : {},
      badges: (() => {
        const rawDist = eval0?.distinctions;
        if (!rawDist) return [];
        const arr = Array.isArray(rawDist) ? rawDist : [];
        // DB stores string keys OR badge objects — handle both
        const BADGE_LABELS: Record<string, { label: string; icon: string }> = {
          captain: { label: "Capitaine", icon: "captain" },
          allstar: { label: "Étoile provinciale", icon: "allstar" },
          target: { label: "Meilleur joueur d'équipe", icon: "target" },
          champion: { label: "Meilleur joueur de la ligue", icon: "champion" },
          trending: { label: "Progression marquée", icon: "trending" },
        };
        return arr
          .filter((d: unknown) => d != null)
          .map((d: unknown) => {
            if (typeof d === "string") {
              const info = BADGE_LABELS[d];
              return info ? { badgeId: d, label: info.label, icon: info.icon } : null;
            }
            if (typeof d === "object" && d !== null && "badgeId" in (d as Record<string, unknown>)) return d;
            return null;
          })
          .filter((b: unknown) => b != null);
      })(),
      coachEndorsement: (raw.notes_coach as string) || (eval0?.rapport_entraineur as string) || "",
    },
    media: {
      mediaMode: "simple",
      hudlLink: (raw.hudl_url as string) || "",
      youtubeLink: (raw.youtube_url as string) || "",
      instagramLink: (raw.instagram_url as string) || "",
      highlightVideo: (raw.video_faits_saillants_url as string) || "",
      fullGameVideo: (raw.video_match_complet_url as string) || "",
      trainingVideo: (raw.video_entrainement_url as string) || "",
    },
    submission: {
      recruitingStatus: (raw.statut_recrutement_override as string) || "",
      preferredDivision: "",
    },
    parentalConsent: !!(raw.consentement_parental),
  };

  console.log("Form initialized from DB:", JSON.stringify({
    jersey: formData.sports.jerseyNumber,
    programme: formData.academic.cegepType,
    openPrivate: formData.academic.openToPrivate,
    openAnglo: formData.academic.openToAnglophone,
    relocate: formData.academic.openToRelocate,
    starRating: formData.scouting.starRating,
    traitRatings: formData.scouting.traitRatings,
    highlights: formData.media.highlightVideo,
    secondaryPosition: formData.sports.secondaryPosition,
  }));

  return formData;
}

export function mapToRecruiterView(raw: Record<string, unknown>): AthleteProfileRecruiterView {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const schoolObj = schoolRel as { name?: string; city?: string; region?: string } | null;
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
    schoolName: schoolObj?.name || "",
    city: "",
    region: "",
    graduationYear: (raw.annee_diplomation as number) || 0,
    dateOfBirth: (raw.date_naissance as string) || "",
    primarySport: sportObj?.nom || "",
    primaryPosition,
    secondaryPosition: (() => {
      const sp = raw._secondary_position as { abreviation?: string; nom?: string } | undefined;
      return sp?.abreviation || sp?.nom || "";
    })(),
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
    wingspan: (raw.envergure as string) || "",
    handSize: (raw.taille_mains as string) || "",
    dominantFoot: (raw.pied_dominant as "Gauche" | "Droit" | "Les deux") || undefined,
    broadJump: (raw.saut_longueur as string) || "",
    benchPress: (raw.developpe_couche as string) || "",
    shuttleAgility: (raw.navette_agilite as string) || "",
    gpa: (raw.moyenne_generale as number) || undefined,
    strongSubjects: (raw.matieres_fortes as string[]) || [],
    academicHonors: (raw.mentions_academiques as string[]) || [],
    targetCegepProgram: (() => {
      const p = raw.programme_cegep_vise;
      if (Array.isArray(p)) return p as string[];
      if (typeof p === "string" && p.startsWith("[")) try { return JSON.parse(p) as string[]; } catch { return []; }
      if (typeof p === "string" && p.length > 0) return [p];
      return [];
    })(),
    program: (() => {
      const p = raw.programme_cegep_vise;
      let arr: string[] = [];
      if (Array.isArray(p)) arr = p;
      else if (typeof p === "string" && p.startsWith("[")) try { arr = JSON.parse(p); } catch { /* */ }
      else if (typeof p === "string" && p.length > 0) arr = [p];
      console.log("programme_cegep_vise raw:", p, "parsed:", arr);
      return arr.length > 0 ? arr.join(", ") : undefined;
    })(),
    openToRelocate: !!(raw.pret_changer_region),
    openToPrivate: !!(raw.ouvert_cegep_prive),
    openToAnglophone: !!(raw.ouvert_cegep_anglophone),
    wantsDEC: false,
    preferredRegions: (raw.regions_cegep_preferees as string[]) || [],
    coachName: coach ? `${coach.first_name || ""} ${coach.last_name || ""}`.trim() : "",
    coachSchool: schoolObj?.name || "",
    coachReport: (raw.notes_coach as string) || (eval0?.rapport_entraineur as string) || "",
    traitRatings: traitRatings as AthleteProfileRecruiterView["traitRatings"],
    overallRating: (eval0?.cote_globale as number) || (raw.cote_globale_entraineur as number) || 0,
    distinctions: ((eval0?.distinctions as AthleteProfileRecruiterView["distinctions"]) || []).filter((d) => d != null),
    highlightVideoUrl: (raw.video_faits_saillants_url as string) || "",
    hudlUrl: (raw.hudl_url as string) || "",
    youtubeUrl: (raw.youtube_url as string) || "",
    instagramUrl: (raw.instagram_url as string) || "",
    fullGameUrl: (raw.video_match_complet_url as string) || "",
    practiceVideoUrl: (raw.video_entrainement_url as string) || "",
    isVerified: !!(raw.verified),
    profileCompleteness: (raw.profile_completion as number) || 0,
    favoriteCount: 0,
    viewsThisMonth: 0,
    isOpenToOffers: true,
  };

  console.log("Mapped RecruiterView:", view.firstName, view.lastName, "pos:", view.primaryPosition);
  return view;
}
