/* ═══════════════════════════════════════════════════════════════
   saveAthlete — one shared save layer for the coach athlete
   wizard. Consumed by THREE surfaces :

   - app/coach/athletes/create/page.tsx              (web create)
   - app/coach/athletes/[id]/modifier/PageClient.tsx (web edit)
   - components/shared/AthleteWizardMobile.tsx       (Capacitor)

   Before this module, each surface had its own inline INSERT/UPDATE
   block, which is how the two bugs survived in web :
   - Cote auto-average (detailed mode) was applied in web EDIT but
     missing in web CREATE.
   - Consent guard (Loi 25) was not enforced anywhere — saves could
     silently flip a stored consentement_parental=true back to
     false because the form defaulted false.

   Both fixes live HERE so every surface inherits them :

   1. COTE AUTO-AVERAGE — in detailed eval mode, cote_globale is the
      mean of non-zero trait ratings. Applied in both saveAthleteCreate
      and saveAthleteEdit.

   2. CONSENT GUARD (edit only) — consentement_parental and
      consentement_parental_date are written ONLY when the form value
      differs from the baseline loaded from the row. If the user
      didn't toggle the checkbox, the stored value is preserved.
      In CREATE, consent always writes fresh (new row).

   Untouched :
   - `verified` is never written by edit. Create writes verified=false
     once at INSERT. The verify path lives on the profile.
   - `open_to_offers` is LEGACY. The edit caller passes whatever raw
     value it has and we write it back unchanged. Mobile never
     surfaces it; web edit retains its Oui/Non toggle.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AthleteFormData } from "./wizardFormShape";

/* ── Result + options ───────────────────────────────────────── */

export interface SaveResult {
  /** Athlete id (new in create, echoed in edit). */
  id?: string;
  error?: { message: string };
}

export interface SaveEditOptions {
  /** Stored consentement_parental value at load — used by the
   *  consent guard. A stored TRUE is never flipped to FALSE on save
   *  unless the user explicitly changed it this session. */
  consentBaseline: boolean;
  /** Stored open_to_offers value at load — preserved unchanged. */
  openToOffers: boolean | null;
  /** Current recruitment_status state from the UI. */
  recruitmentStatus: string;
  /** Current committed_school_id state from the UI. */
  committedSchoolId: string;
}

export interface SaveCreateOptions {
  /** Coach's school_id — written into athletes.school_id at INSERT. */
  coachSchoolId: string | null;
}

/* ── Internal helpers ───────────────────────────────────────── */

interface SportIds {
  sportId: string | null;
  positionId: string | null;
}

/** COTE AUTO-AVERAGE — DETAILED ALWAYS WINS.
 *
 *  Rule (mirrors apply_approved_suggestion's "Impossible d'appliquer
 *  une cote globale plate : l'évaluation détaillée est active" guard
 *  at baseline.sql :165-167 — that guard fires on the athlete-suggest
 *  path ; this is its coach-edit-side twin) :
 *
 *    - If ANY of the 14 trait columns is non-zero → cote_globale is
 *      the mean of the non-zero traits (rounded to 2 decimals).
 *      This holds REGARDLESS of evalMode — even a simple-mode save
 *      cannot write a flat cote that contradicts detailed trait data
 *      present in state.
 *    - If NO traits are set → cote_globale is the manual starRating
 *      (or null).
 *
 *  The persisted cote_globale can therefore never disagree with the
 *  trait columns. To change the cote when traits exist, the coach
 *  must edit the traits ; to abandon detailed evaluation entirely,
 *  the coach clears the traits in detailed mode (existing path). */
export function computeCoteGlobale(form: AthleteFormData): number | null {
  const rated = Object.values(form.scouting.traitRatings).filter((v) => v > 0);
  if (rated.length > 0) {
    return parseFloat((rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(2));
  }
  return form.scouting.starRating || null;
}

async function resolveSportIds(supabase: SupabaseClient, form: AthleteFormData): Promise<SportIds> {
  let sportId: string | null = null;
  let positionId: string | null = null;

  if (form.sports.primarySport) {
    const { data } = await supabase
      .from("sports").select("id")
      .eq("nom", form.sports.primarySport).maybeSingle();
    sportId = ((data as { id?: string } | null)?.id) ?? null;
  }
  if (form.sports.primaryPosition && sportId) {
    const { data: posRow } = await supabase
      .from("positions").select("id")
      .eq("abreviation", form.sports.primaryPosition).eq("sport_id", sportId).maybeSingle();
    const id1 = (posRow as { id?: string } | null)?.id ?? null;
    if (id1) positionId = id1;
    else {
      // Fallback : match by full name.
      const { data: posRow2 } = await supabase
        .from("positions").select("id")
        .eq("nom", form.sports.primaryPosition).eq("sport_id", sportId).maybeSingle();
      positionId = (posRow2 as { id?: string } | null)?.id ?? null;
    }
  }
  return { sportId, positionId };
}

function programmeCegepVise(form: AthleteFormData): string[] {
  const t = form.academic.cegepType;
  if (t === "dec_general") return ["DEC général"];
  if (t === "technique" && form.academic.cegepProgramDetail) return [`Technique — ${form.academic.cegepProgramDetail}`];
  if (t === "technique") return ["Programme technique"];
  return [];
}

function safeGpa(form: AthleteFormData): number | null {
  const v = form.academic.gpa ? parseFloat(form.academic.gpa) : null;
  return v !== null && (v < 0 || v > 100) ? null : v;
}

/** Columns written by BOTH create and edit. */
function buildSharedAthletesPayload(
  form: AthleteFormData,
  ids: SportIds,
  coteGlobale: number | null,
): Record<string, unknown> {
  return {
    // Identity (shared)
    first_name: form.identity.firstName,
    last_name: form.identity.lastName,
    date_naissance: form.identity.dateOfBirth || null,
    genre: form.identity.gender || null,
    annee_diplomation: form.identity.gradYear ? parseInt(form.identity.gradYear) : null,
    email: form.identity.email || null,
    photo_url: form.identity.photo || null,

    // Academic
    moyenne_generale: safeGpa(form),
    matieres_fortes: form.academic.strongSubjects || [],
    mentions_academiques: form.academic.academicHonors || [],
    programme_cegep_vise: programmeCegepVise(form),
    ouvert_cegep_prive: form.academic.openToPrivate,
    ouvert_cegep_anglophone: form.academic.openToAnglophone,
    pret_changer_region: form.academic.openToRelocate,
    regions_cegep_preferees: form.academic.cegepRegions || [],

    // Physical
    taille_pieds: form.physical.heightFeet ? parseInt(form.physical.heightFeet) : null,
    taille_pouces: form.physical.heightInches ? parseInt(form.physical.heightInches) : null,
    poids_lbs: form.physical.weightLbs ? parseFloat(form.physical.weightLbs) : null,
    envergure: form.physical.wingspan || null,
    taille_mains: form.physical.handSize || null,
    main_dominante: form.physical.dominantHand || null,
    pied_dominant: form.physical.dominantFoot || null,
    test_40_verges: form.physical.fortyYard || null,
    saut_vertical: form.physical.verticalJump || null,
    saut_longueur: form.physical.broadJump || null,
    developpe_couche: form.physical.benchPress || null,
    navette_agilite: form.physical.shuttleAgility || null,
    sprint_100m: form.physical.sprint100m || null,

    // Sport
    sport_id: ids.sportId,
    position_id: ids.positionId,
    numero_jersey: form.sports.jerseyNumber ? parseInt(form.sports.jerseyNumber) : null,
    ouvert_entraineur_cegep: form.sports.openToCoaching,
    // Parcours d'équipes (JSONB) — cap 10 (DB CHECK also enforces).
    parcours_equipes: (form.sports.parcoursEquipes ?? []).slice(0, 10),

    // Eval mirror (athletes mirror — recruteur uses this for the card)
    cote_globale_entraineur: coteGlobale,
    notes_coach: form.scouting.coachEndorsement || null,

    // Media
    video_faits_saillants_url: form.media.highlightVideo || null,
    hudl_url: form.media.hudlLink || null,
    youtube_url: form.media.youtubeLink || null,
    instagram_url: form.media.instagramLink || null,
    video_match_complet_url: form.media.fullGameVideo || null,
    video_entrainement_url: form.media.trainingVideo || null,

    // Override (the in-pipeline status the coach manually pins)
    statut_recrutement_override: form.submission.recruitingStatus || null,
    recrutement_override_at: form.submission.recruitingStatus ? new Date().toISOString() : null,
  };
}

function buildEvalRecord(
  form: AthleteFormData,
  athleteId: string,
  coachUserId: string,
  coteGlobale: number | null,
): Record<string, unknown> {
  const tr = form.scouting.traitRatings;
  const distinctions = form.scouting.badges.filter((b) => b && b.badge);
  return {
    coach_id: coachUserId,
    athlete_id: athleteId,
    cote_globale: coteGlobale,
    vitesse_explosivite: tr.vitesse_explosivite || null,
    force_puissance: tr.force_puissance || null,
    endurance_cardio: tr.endurance_cardio || null,
    agilite_coordination: tr.agilite_coordination || null,
    vision_du_jeu: tr.vision_du_jeu || null,
    sens_tactique: tr.sens_tactique || null,
    leadership: tr.leadership || null,
    discipline: tr.discipline || null,
    coachabilite: tr.coachabilite || null,
    intelligence_jeu: tr.intelligence_jeu || null,
    competitivite: tr.competitivite || null,
    esprit_equipe: tr.esprit_equipe || null,
    resilience: tr.resilience || null,
    attitude_mentalite: tr.attitude_mentalite || null,
    distinctions,
    rapport_entraineur: form.scouting.coachEndorsement.trim() || null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC : saveAthleteCreate
═══════════════════════════════════════════════════════════════ */
export async function saveAthleteCreate(
  supabase: SupabaseClient,
  form: AthleteFormData,
  coachUserId: string,
  options: SaveCreateOptions,
): Promise<SaveResult> {
  const coteGlobale = computeCoteGlobale(form);
  const ids = await resolveSportIds(supabase, form);

  const shared = buildSharedAthletesPayload(form, ids, coteGlobale);
  const createOnly: Record<string, unknown> = {
    coach_id: coachUserId,
    school_id: options.coachSchoolId,
    telephone: form.identity.phone || null,
    nom_parent: form.identity.parentName || null,
    telephone_parent: form.identity.parentPhone || null,
    // Consent ALWAYS writes fresh on create (new row).
    consentement_parental: form.parentalConsent,
    consentement_parental_date: form.parentalConsent ? new Date().toISOString() : null,
    status: "ACTIF",
    verified: false,
    profile_completion: 0,
    ...(form.parentalConsent && form.partnerVisibilityConsent ? {
      partner_visibility_parental_consent: true,
      partner_visibility_opt_in: true,
      partner_visibility_opted_in_at: new Date().toISOString(),
    } : {}),
  };

  const { data, error } = await supabase
    .from("athletes")
    .insert({ ...shared, ...createOnly })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error ?? { message: "INSERT athletes returned no row" } };
  }
  const athleteId = (data as { id: string }).id;

  // evaluations INSERT
  const evalRecord = buildEvalRecord(form, athleteId, coachUserId, coteGlobale);
  const evalRes = await supabase.from("evaluations").insert(evalRecord);
  if (evalRes.error) return { error: evalRes.error };

  // team_athletes INSERT (with joined_at — consistency fix)
  const selectedTeamId = form.sports.selectedTeamId;
  if (selectedTeamId) {
    const taRes = await supabase.from("team_athletes").insert({
      team_id: selectedTeamId,
      athlete_id: athleteId,
      jersey_number: form.sports.jerseyNumber || null,
      joined_at: new Date().toISOString(),
    });
    if (taRes.error) {
      console.error("[saveAthleteCreate] team_athletes insert failed:", taRes.error);
      // non-fatal — athlete row exists, team assignment can be redone manually
    }
  }

  return { id: athleteId };
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC : saveAthleteEdit
═══════════════════════════════════════════════════════════════ */
export async function saveAthleteEdit(
  supabase: SupabaseClient,
  athleteId: string,
  form: AthleteFormData,
  coachUserId: string,
  options: SaveEditOptions,
): Promise<SaveResult> {
  const coteGlobale = computeCoteGlobale(form);
  const ids = await resolveSportIds(supabase, form);

  const shared = buildSharedAthletesPayload(form, ids, coteGlobale);
  const editOnly: Record<string, unknown> = {
    recruitment_status: options.recruitmentStatus,
    committed_school_id: options.recruitmentStatus === "RECRUTE" ? (options.committedSchoolId || null) : null,
    // open_to_offers : LEGACY — write back what was loaded.
    open_to_offers: options.recruitmentStatus === "RECRUTE" ? options.openToOffers : null,
    recruitment_status_changed_by: coachUserId,
    recruitment_status_changed_at: new Date().toISOString(),
  };

  /* CONSENT GUARD — fix #2. Only emit the consent cols when the form
     value differs from the baseline that was loaded from the row.
     A stored TRUE is never silently flipped to FALSE because the
     form defaulted false. */
  const consentBlock = form.parentalConsent !== options.consentBaseline
    ? {
        consentement_parental: form.parentalConsent,
        consentement_parental_date: form.parentalConsent ? new Date().toISOString() : null,
      }
    : {};

  const updateRes = await supabase
    .from("athletes")
    .update({ ...shared, ...editOnly, ...consentBlock })
    .eq("id", athleteId);
  if (updateRes.error) return { error: updateRes.error };

  // evaluations UPSERT
  const evalRecord = buildEvalRecord(form, athleteId, coachUserId, coteGlobale);
  const evalRes = await supabase
    .from("evaluations")
    .upsert(evalRecord, { onConflict: "coach_id,athlete_id" });
  if (evalRes.error) return { error: evalRes.error };

  /* team_athletes — DÉPLACEMENT borné au sport, plus une purge globale.
     FIX 4 : l'ancien `.delete().eq("athlete_id", …)` effaçait TOUTES les
     appartenances de l'athlète, y compris celles d'autres sports, sans le
     dire. Un athlète football + basket perdait son basket dès qu'un coach
     ouvrait le wizard. On ne retire désormais que la ligne du sport visé,
     ce que la contrainte UNIQUE (athlete_id, sport_id) exige de toute façon
     avant de réinsérer. */
  const selectedTeamId = form.sports.selectedTeamId;
  if (selectedTeamId) {
    const { data: teamRow, error: teamErr } = await supabase
      .from("teams")
      .select("sport_id")
      .eq("id", selectedTeamId)
      .single();
    if (teamErr || !teamRow?.sport_id) {
      return { error: teamErr ?? { message: "Sport de l'équipe introuvable." } };
    }

    const delRes = await supabase
      .from("team_athletes")
      .delete()
      .eq("athlete_id", athleteId)
      .eq("sport_id", teamRow.sport_id as string);
    if (delRes.error) return { error: delRes.error };

    const taRes = await supabase.from("team_athletes").insert({
      team_id: selectedTeamId,
      athlete_id: athleteId,
      jersey_number: form.sports.jerseyNumber || null,
      joined_at: new Date().toISOString(),
    });
    // FIX 4 : remonté à l'appelant au lieu d'un console.error muet — un
    // rattachement d'équipe raté laissait l'athlète invisible au calendrier
    // sans que personne ne le sache.
    if (taRes.error) return { error: taRes.error };
  } else if (ids.sportId) {
    /* Aucune équipe sélectionnée = RETRAIT, mais borné au sport principal
       du formulaire. Sans cette borne on retomberait sur la purge globale
       qu'on vient de supprimer. Le trigger reset_athlete_anchor_on_team_remove
       s'applique normalement. */
    const delRes = await supabase
      .from("team_athletes")
      .delete()
      .eq("athlete_id", athleteId)
      .eq("sport_id", ids.sportId);
    if (delRes.error) return { error: delRes.error };
  }

  return { id: athleteId };
}
