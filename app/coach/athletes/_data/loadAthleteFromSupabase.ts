import { createClient } from "@/lib/supabase/client";
import { fetchProgrammeLabels } from "@/lib/queries/shared/useCegepPrograms";
import type { AthleteProfile } from "./mockAthleteProfiles";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { calculateCompletion, type AthleteLike, type EvalLike } from "@/lib/utils/profileCompletion";
import { selectBestEvaluation, isDetailed } from "@/lib/evaluations/selectEvaluation";
import { parseTeamHistory } from "@/components/shared/athlete/teamHistory";

/* ═══════════════════════════════════════════════════════════════
   Shared Supabase loader for coach athlete pages.
   Queries the athletes table and maps to both AthleteProfile
   and AthleteProfileRecruiterView types.
═══════════════════════════════════════════════════════════════ */

const ATHLETE_SELECT = `
  id,
  user_id,
  first_name,
  last_name,
  date_naissance,
  genre,
  photo_url,
  verified,
  profile_completion,
  last_profile_validation,
  modified_since_verification,
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
  programmes_vises,
  consentement_parental,
  status,
  statut_recrutement_override,
  recrutement_override_at,
  recruitment_status,
  committed_school_id,
  open_to_offers,
  parcours_equipes,
  school_id,
  coach_id,
  position_id,
  sports!sport_id(nom),
  positions!position_id(nom, abreviation),
  schools!school_id(name, city, region, type),
  committed_school:schools!committed_school_id(name),
  team_athletes(team_id, teams!team_id(name, schools!school_id(name, type))),
  evaluations(
    cote_globale,
    vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination,
    vision_du_jeu, sens_tactique,
    leadership, discipline, coachabilite, intelligence_jeu,
    competitivite, esprit_equipe, resilience, attitude_mentalite,
    rapport_entraineur, distinctions, updated_at, coach_id, grille_id,
    evaluator:users!evaluations_coach_id_fkey(first_name, last_name)
  ),
  users!coach_id(first_name, last_name),
  athlete_badges(contexte, created_at, retire_le, badges(code, libelle))
`;

export async function loadAthleteRaw(athleteId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("athletes")
    .select(ATHLETE_SELECT)
    .eq("id", athleteId)
    .single();

  /* T2 — les libellés de programme résolus UNE fois ici, déposés sur `raw`
     sous une clé qui n'est pas une colonne. Les trois mappeurs synchrones
     plus bas (mapToAthleteProfile / buildFormFromRaw / mapToRecruiterView)
     sont appelés depuis neuf endroits : leur passer un paramètre aurait
     imposé neuf modifications d'appelants pour une donnée d'affichage.
     Chacun retombe sur programme_cegep_vise quand la clé est absente —
     donc les appelants qui ne passent PAS par loadAthleteRaw continuent
     d'afficher le legacy, ce qui reste correct jusqu'à T3. */
  if (data) {
    (data as Record<string, unknown>)._programmes_labels =
      await fetchProgrammeLabels(supabase, Array.isArray((data as Record<string, unknown>).programmes_vises)
        ? ((data as Record<string, unknown>).programmes_vises as unknown[]).map(String)
        : []);
  }

  return { data, error };
}

/* ═══════════════════════════════════════════════════════════════
   VOIE 2 — les badges viennent de athlete_badges, pas de la colonne
   dérivée evaluations.distinctions.

   POURQUOI PAR L'EMBED ET PAS PAR UNE REQUÊTE
   mapToAthleteProfile et mapToRecruiterView sont SYNCHRONES et appelées
   depuis neuf endroits. Les rendre asynchrones, ou leur ajouter un
   paramètre, aurait imposé neuf modifications d'appelants pour une donnée
   d'affichage. L'embed la fait arriver par `raw`, et les deux mappeurs se
   servent — sans changer de signature.

   CE QUE ÇA CHANGE POUR L'ÉCRAN
   distinctions ne portait que les codes ayant un équivalent hérité : Caron
   y avait 3 badges sur 7, et un athlète dont tous les badges sont
   spécifiques au sport n'en avait AUCUN. L'embed les rend tous, avec le
   libellé du catalogue — c'est lui qui part dans la prop `libelle` de
   DistinctionBadge.

   Les badges RETIRÉS sont exclus ICI, pas en base : retire_le documente un
   retrait, il ne supprime pas la ligne.
═══════════════════════════════════════════════════════════════ */
interface LigneBadgeAffichee {
  contexte: string | null;
  /* La date d'attribution est created_at. Il n'existe PAS de attribue_le :
     attribue_par est l'AUTEUR, retire_le la date de RETRAIT. */
  created_at?: string | null;
  retire_le: string | null;
  badges: { code: string; libelle: string } | { code: string; libelle: string }[] | null;
}

export interface BadgeAffiche {
  badge: string;
  detail?: string;
  libelle: string;
  attribueLe?: string | null;
}

export function badgesDepuisRaw(raw: Record<string, unknown>): BadgeAffiche[] {
  const brut = raw.athlete_badges;
  if (!Array.isArray(brut)) return [];
  return (brut as LigneBadgeAffichee[])
    .filter((l) => !l.retire_le)
    .map((l): BadgeAffiche | null => {
      const b = Array.isArray(l.badges) ? l.badges[0] : l.badges;
      if (!b?.code) return null;
      return {
        badge: b.code,
        detail: l.contexte ?? undefined,
        libelle: b.libelle,
        attribueLe: l.created_at ?? null,
      };
    })
    .filter((e): e is BadgeAffiche => e !== null);
}

export function mapToAthleteProfile(raw: Record<string, unknown>): AthleteProfile {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const schoolObj = schoolRel as { name?: string; city?: string; region?: string; type?: string } | null;
  const evals = Array.isArray(raw.evaluations) ? raw.evaluations : [];
  const eval0 = (selectBestEvaluation(evals) ?? undefined) as Record<string, unknown> | undefined;

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
    badges: badgesDepuisRaw(raw) as unknown as AthleteProfile["badges"],
    coachEndorsement: (raw.notes_coach as string) || (eval0?.rapport_entraineur as string) || undefined,
    openToRelocate: !!(raw.pret_changer_region),
    openToPrivate: !!(raw.ouvert_cegep_prive),
    openToAnglophone: !!(raw.ouvert_cegep_anglophone),
  };

  return profile;
}

/** Build modifier form data directly from raw Supabase response — preserves ALL fields */
export function buildFormFromRaw(raw: Record<string, unknown>, coachUserId?: string): Record<string, unknown> {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const schoolObj = schoolRel as { name?: string; city?: string; region?: string; type?: string } | null;
  const evals = (Array.isArray(raw.evaluations) ? raw.evaluations : []) as Record<string, unknown>[];
  // #2 (règle finale BP — UNE seule éval vivante) : le FORMULAIRE Modifier ouvre
  // sur l'éval PUBLIQUE ACTUELLE = la plus récente (celle du directeur si dernière),
  // TOUS les champs (cote + traits) inclus. Le coach modifie À PARTIR d'elle et sa
  // sauvegarde (coach_id=self, updated_at=now) devient la nouvelle publique
  // (latest-wins à l'écriture). Plus de « chacun édite sa version ».
  const eval0 = (selectBestEvaluation(evals) ?? undefined) as Record<string, unknown> | undefined;
  // Note publique = colonne dénormalisée last-write (identique à eval0 ci-dessus).
  const publicNote = (raw.cote_globale_entraineur as number) || 0;
  // Évaluateur de la note publique (souvent le directeur), lisible via la RLS #1.
  const publicEvaluatorName = ((): string => {
    const evRaw = eval0?.evaluator;
    const ev = (Array.isArray(evRaw) ? evRaw[0] : evRaw) as { first_name?: string; last_name?: string } | null;
    return ev ? `${ev.first_name || ""} ${ev.last_name || ""}`.trim() : "";
  })();
  const publicEvaluatorId = (eval0?.coach_id as string) || "";
  // Le bandeau « modifiée par {nom} » ne s'affiche que si l'éval publique vient
  // d'un AUTRE évaluateur que le coach courant (sinon c'est déjà la sienne).
  const publicByOther = !!publicEvaluatorId && !!coachUserId && publicEvaluatorId !== coachUserId;


  const heightFt = raw.taille_pieds != null ? String(raw.taille_pieds) : "";
  const heightIn = raw.taille_pouces != null ? String(raw.taille_pouces) : "";
  const weightLbs = raw.poids_lbs != null ? String(raw.poids_lbs) : "";

  // Parse programme_cegep_vise — nouvelle colonne d'abord (voir loadAthleteRaw).
  let progArr: string[] = Array.isArray(raw._programmes_labels) ? raw._programmes_labels as string[] : [];
  const progRaw = progArr.length > 0 ? null : raw.programme_cegep_vise;
  if (Array.isArray(progRaw)) progArr = progRaw.filter((v) => v != null);
  else if (typeof progRaw === "string" && progRaw.startsWith("[")) try { progArr = JSON.parse(progRaw).filter((v: unknown) => v != null); } catch { /* */ }

  const formData = {
    // Note publique last-write (#2/#3) — pour le bandeau contexte du formulaire.
    publicNote,
    publicEvaluatorName,
    publicEvaluatorId,
    publicByOther,
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
      programmesVises: Array.isArray(raw.programmes_vises) ? (raw.programmes_vises as unknown[]).map(String) : [],
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
      primaryPosition: posObj?.abreviation || posObj?.nom || "",
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
      parcoursEquipes: parseTeamHistory(raw.parcours_equipes),
    },
    scouting: {
      /* Mirror the apply_approved_suggestion trigger's "detailed wins"
         rule at load time. If any of the 14 trait columns is non-zero,
         this athlete has detailed evaluation data already — open the
         wizard in detailed mode so the coach sees the traits + the
         auto-averaged cote rather than only the simple StarRow (which
         in the old "always simple at load" default hid the detailed
         data and made it easy to silently overwrite via a flat cote).
         No-traits athletes still open in simple mode unchanged. */
      // Type deduced on the SELECTED evaluation (selectBestEvaluation),
      // via the shared isDetailed() — same 14-field definition as the
      // selection rule, so the displayed mode matches the shown evaluation.
      evalMode: isDetailed(eval0) ? "detailed" : "simple",
      starRating: (eval0?.cote_globale as number) || (raw.cote_globale_entraineur as number) || 0,
      traitRatings: eval0 ? {
        // Keys match DB columns directly
        vitesse_explosivite: (eval0.vitesse_explosivite as number) || 0,
        force_puissance: (eval0.force_puissance as number) || 0,
        endurance_cardio: (eval0.endurance_cardio as number) || 0,
        agilite_coordination: (eval0.agilite_coordination as number) || 0,
        vision_du_jeu: (eval0.vision_du_jeu as number) || 0,
        sens_tactique: (eval0.sens_tactique as number) || 0,
        leadership: (eval0.leadership as number) || 0,
        discipline: (eval0.discipline as number) || 0,
        coachabilite: (eval0.coachabilite as number) || 0,
        intelligence_jeu: (eval0.intelligence_jeu as number) || 0,
        competitivite: (eval0.competitivite as number) || 0,
        esprit_equipe: (eval0.esprit_equipe as number) || 0,
        resilience: (eval0.resilience as number) || 0,
        attitude_mentalite: (eval0.attitude_mentalite as number) || 0,
      } : {},
      /* Les badges NE viennent PLUS de evaluations.distinctions : c'est une
         colonne dérivée, et elle ne dit pas QUI a attribué quoi — donc pas
         ce que l'écran a le droit d'éditer. Chaque surface les charge par
         chargerBadgesAthlete, qui rend le découpage éditable / lecture seule. */
      badges: [],
      coachEndorsement: (eval0?.rapport_entraineur as string) || (raw.notes_coach as string) || "",
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


  return formData;
}

export function mapToRecruiterView(raw: Record<string, unknown>): AthleteProfileRecruiterView {
  const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
  const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
  const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
  const sportObj = sportRel as { nom?: string } | null;
  const posObj = posRel as { nom?: string; abreviation?: string } | null;
  const schoolObj = schoolRel as { name?: string; city?: string; region?: string; type?: string } | null;
  const evals = Array.isArray(raw.evaluations) ? raw.evaluations : [];
  const eval0 = (selectBestEvaluation(evals) ?? undefined) as Record<string, unknown> | undefined;
  const coach = raw.users as { first_name?: string; last_name?: string } | null;

  const heightFt = (raw.taille_pieds as number) || 0;
  const heightIn = (raw.taille_pouces as number) || 0;
  const weightLbs = (raw.poids_lbs as number) || 0;
  const posName = posObj?.nom || "";
  const posAbbr = posObj?.abreviation || "";
  const primaryPosition = posAbbr ? `${posName} (${posAbbr})` : posName;

  const traitRatings = eval0 ? {
    speed: (eval0.vitesse_explosivite as number) || 0,
    power: (eval0.force_puissance as number) || 0,
    endurance: (eval0.endurance_cardio as number) || 0,
    agility: (eval0.agilite_coordination as number) || 0,
    gameVision: (eval0.vision_du_jeu as number) || 0,
    tactics: (eval0.sens_tactique as number) || 0,
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
    // Phase 1 audit (post-Phase 6.1): schoolName overload eliminated.
    // Canonical "civil" rule = no school_id OR school.type ===
    // 'LIGUE_CIVILE'. Each affiliation field carries one meaning:
    //   schoolName: real école name, empty for civil
    //   teamName:   civil team name when present
    //   leagueName: "Ligue Civile" label when civil but no team
    //   isCivil:    discriminator the view layer branches on
    isCivil: !raw.school_id || schoolObj?.type === "LIGUE_CIVILE",
    schoolName: (!raw.school_id || schoolObj?.type === "LIGUE_CIVILE") ? "" : (schoolObj?.name || ""),
    teamName: (() => {
      const civil = !raw.school_id || schoolObj?.type === "LIGUE_CIVILE";
      if (!civil) return undefined;
      const taRel = (raw as Record<string, unknown>).team_athletes;
      const ta = (Array.isArray(taRel) ? taRel[0] : taRel) as { teams?: unknown } | null;
      const teamRel = ta?.teams;
      const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) as { name?: string } | null;
      return team?.name;
    })(),
    leagueName: (() => {
      const civil = !raw.school_id || schoolObj?.type === "LIGUE_CIVILE";
      if (!civil) return undefined;
      const taRel = (raw as Record<string, unknown>).team_athletes;
      const ta = (Array.isArray(taRel) ? taRel[0] : taRel) as { teams?: unknown } | null;
      const teamRel = ta?.teams;
      const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) as { name?: string } | null;
      return team?.name ? undefined : "Ligue Civile";
    })(),
    // Iter 7.50-b3 — la jointure schools (ATHLETE_SELECT) charge city +
    // region, mais le mapper les laissait à "" depuis toujours. Bug
    // latent : la carte recruteur (et le ticket bottom V30) affichait
    // vide pour tous les athlètes scolaires. Fix sans changement de
    // contrat (le type reste `string`, on tire juste la vraie valeur).
    city: schoolObj?.city || "",
    region: schoolObj?.region || "",
    graduationYear: (raw.annee_diplomation as number) || 0,
    dateOfBirth: (raw.date_naissance as string) || "",
    primarySport: sportObj?.nom || "",
    primaryPosition,
    teamHistory: parseTeamHistory(raw.parcours_equipes),
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
      if (Array.isArray(raw._programmes_labels) && raw._programmes_labels.length > 0) return raw._programmes_labels as string[];
      const p = raw.programme_cegep_vise;
      if (Array.isArray(p)) return p as string[];
      if (typeof p === "string" && p.startsWith("[")) try { return JSON.parse(p) as string[]; } catch { return []; }
      if (typeof p === "string" && p.length > 0) return [p];
      return [];
    })(),
    program: (() => {
      const pl = raw._programmes_labels;
      if (Array.isArray(pl) && pl.length > 0) return (pl as string[]).join(", ");
      const p = raw.programme_cegep_vise;
      let arr: string[] = [];
      if (Array.isArray(p)) arr = p;
      else if (typeof p === "string" && p.startsWith("[")) try { arr = JSON.parse(p); } catch { /* */ }
      else if (typeof p === "string" && p.length > 0) arr = [p];
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
    // NOTE affichée = LA PLUS RÉCENTE. On lit d'abord la colonne dénormalisée
    // athletes.cote_globale_entraineur (maintenue en last-write par le trigger
    // calc_cote_globale : elle reflète TOUJOURS la dernière éval saisie, tous
    // coachs confondus, et reste lisible même quand la RLS evaluations ne
    // renvoie au coach courant que SA propre ligne). eval0 (selectBestEvaluation)
    // ne sert que de repli si la colonne est nulle (données legacy sans cascade).
    overallRating: (raw.cote_globale_entraineur as number) || (eval0?.cote_globale as number) || 0,
    distinctions: badgesDepuisRaw(raw),
    /* Règle de lecture des grilles : grille_id de l'éval choisie d'abord,
       position de l'athlète ensuite. Les deux voyagent ensemble jusqu'au
       rendu, qui applique resolveGrille. */
    grilleId: (eval0?.grille_id as string | null) ?? null,
    positionId: (raw.position_id as string | null) ?? null,
    // Attribution : auteur de l'éval choisie (selectBestEvaluation → coach_id +
    // users embed). Le composant compare evaluatorCoachId au coach connecté pour
    // décider d'afficher « Évalué par … ». Visible quand la requête renvoie la
    // ligne d'un autre évaluateur (directeur en oversight, admin).
    evaluatorCoachId: (eval0?.coach_id as string | null) ?? null,
    evaluatorName: (() => {
      const ev = eval0?.evaluator as { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }> | null | undefined;
      const evObj = Array.isArray(ev) ? ev[0] : ev;
      return evObj ? `${evObj.first_name || ""} ${evObj.last_name || ""}`.trim() : "";
    })(),
    highlightVideoUrl: (raw.video_faits_saillants_url as string) || "",
    hudlUrl: (raw.hudl_url as string) || "",
    youtubeUrl: (raw.youtube_url as string) || "",
    instagramUrl: (raw.instagram_url as string) || "",
    fullGameUrl: (raw.video_match_complet_url as string) || "",
    practiceVideoUrl: (raw.video_entrainement_url as string) || "",
    isVerified: !!(raw.verified),
    parentalConsent: !!(raw.consentement_parental),
    lastValidation: (raw.last_profile_validation as string) || null,
    modifiedSinceVerification: !!(raw.modified_since_verification),
    profileCompleteness: calculateCompletion(raw as AthleteLike, (eval0 as EvalLike) || null, null).percentage,
    favoriteCount: 0,
    viewsThisMonth: 0,
    // isOpenToOffers : hardcoded true. Champ REQUIS sur le type
    // AthleteProfileRecruiterView (héritage), aucun composant ne le lit
    // en JSX. Stub conservé pour compatibilité de type — ne pas le câbler
    // à la pill du coach (la sous-ligne "Ouvert/Fermé aux offres" est
    // legacy côté coach mobile et n'est PAS surfacée).
    isOpenToOffers: true,
    // Athlete recruitment status fields — fix : étaient droppés, badge
    // tombait toujours sur "OUVERT" côté coach mobile même pour des
    // athlètes recrutés. open_to_offers volontairement NON porté ici
    // (one pill = recruitment_status seul ; voir commentaire isOpenToOffers).
    recruitmentStatus: (raw.recruitment_status as string) || "OUVERT",
    committedSchoolName: (() => {
      const cs = raw.committed_school;
      const csObj = Array.isArray(cs) ? cs[0] : cs;
      return (csObj as { name?: string } | null)?.name || "";
    })(),
  };

  return view;
}
