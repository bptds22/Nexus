"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteOnboardingMobile — iter 7.50-a → 7.50-a-bis (2b)
   "Construis ta carte" — onboarding minimum mobile (2 écrans).

   Philosophie (DIAG 7.50-v2) : ne capturer que ce qui est nécessaire
   pour générer la carte joueur (set minimum). Les champs avancés
   (GPA, taille, poids, vidéos, tests) sont DÉPORTÉS au profil édition
   existant (/athlete/profil).

   ÉCRAN 1 — Ton équipe (sport + école OU équipe civile + coach)
   ÉCRAN 2 — Ta carte (position + jersey + promo + région + photo)

   ⚠️ Loi 25 / mineurs : les 2 consentements parentaux + la PII parent
   sont capturés UNE seule fois au signup mobile (SignupMobile, iter
   2a) et stashés dans auth.users.raw_user_meta_data + écrits dans
   users.privacy_preferences. Au submit ici, on RE-LIT le metadata et
   on l'écrit dans athletes.parent_* + athletes.consentement_parental{,_date}.
   Le timestamp consentement_parental_date = celui du signup, JAMAIS
   new Date() au submit (preuve légale = la date du consentement).
   Si metadata vide (compte créé hors signup mobile), fallback sûr :
   on n'écrit PAS consentement_parental=true sans preuve.

   ⚠️ partner_visibility_* (iter signup-polish-2 §C) : écrits depuis
   meta.consent_parental_partner_visibility (timestamp DU SIGNUP) si la
   case optionnelle PartnerVisibilityConsentCard a été cochée à l'écran
   "Toi & tes parents" du SignupMobile. Sinon → false/null par défaut DB.

   ⚠️ Resume + orphan claim modal préservés.
   ⚠️ team_athletes junction insert au submit final (scolaire OR civil).

   Le desktop /athlete/onboarding est inchangé byte-pour-byte ; ce
   composant est sélectionné via `if (IS_CAPACITOR)` dans page.tsx.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateProfileCompletion } from "@/lib/utils/calculateProfileCompletion";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { SearchSheet } from "@/components/mobile/SearchSheet";
import ClaimProfileModal, { type OrphanProfile } from "@/components/auth/ClaimProfileModal";
import AthleteOnboardingWowMobile from "@/components/shared/AthleteOnboardingWowMobile";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";

/* ── Constantes (alignées sur desktop) ──────────────────────── */

const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Autre",
];

const CEGEP_REGIONS = [
  "Montréal", "Québec", "Laurentides", "Lanaudière",
  "Montérégie", "Outaouais", "Estrie", "Sherbrooke",
];

/* ── Types data ─────────────────────────────────────────────── */

type SchoolRow = { id: string; name: string; city: string | null; type: string };
type CivilTeamRow = {
  id: string;
  name: string;
  age_group: string | null;
  division: string | null;
  school_id: string;
  school_name: string;
};
type ScolaireTeamRow = {
  id: string;
  name: string;
  division: string | null;
  age_group: string | null;
  gender: string | null;
};
type TeamCoachRow = {
  /** team_coaches.id */
  id: string;
  coach_id: string;
  /** head_coach | assistant | coordinator */
  role: string;
  first_name: string | null;
  last_name: string | null;
};

/* ── Helpers ────────────────────────────────────────────────── */

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (intensity === "Medium") {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch { /* no-op */ }
}

function flatten<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/** Iter team-3 — libellé d'une équipe scolaire. Toutes les teams d'une
 *  école/sport partagent souvent le même name (= nom de l'école), donc
 *  on affiche les attributs distinctifs (age_group · division · gender)
 *  et on retombe sur le name si absolument aucun attribut. Les chaînes
 *  vides "" sont traitées comme null (la colonne division stocke parfois
 *  "" plutôt que NULL pour les seeds civils). */
function scolaireTeamLabel(t: {
  name: string;
  division: string | null;
  age_group: string | null;
  gender: string | null;
}): string {
  const parts = [t.age_group, t.division, t.gender]
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(" · ") : t.name;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(s: string): string {
  return stripAccents(s).toLowerCase().trim();
}

const YEAR_OPTIONS: PickerOption[] = [
  { value: "2026", label: "2026" },
  { value: "2027", label: "2027" },
  { value: "2028", label: "2028" },
  { value: "2029", label: "2029" },
  { value: "2030", label: "2030" },
];

const REGION_OPTIONS: PickerOption[] = CEGEP_REGIONS.map((r) => ({ value: r, label: r }));

/* ═══════════════════════════════════════════════════════════════
   Composant principal
═══════════════════════════════════════════════════════════════ */

export function AthleteOnboardingMobile() {
  // Hooks AVANT toute condition (canon Rules of Hooks).
  const router = useRouter();
  const toast = useMobileToast();

  // Step machine 1|2 (consents + parent capturés au signup — iter 2b)
  const [step, setStep] = useState<1 | 2>(1);

  // Auth + context
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [userContext, setUserContext] = useState<"scolaire" | "ligue_civile">("scolaire");
  const [existingAthleteId, setExistingAthleteId] = useState<string | null>(null);

  // Orphan claim
  const [orphanMatch, setOrphanMatch] = useState<OrphanProfile | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);

  // État formulaire (set minimum)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Sport / école / coach / équipe civile
  const [primarySport, setPrimarySport] = useState<string>("");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string>("");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedCoachName, setSelectedCoachName] = useState<string>("");
  // Iter bugs-1-fix §B — flag "l'utilisateur a explicitement choisi de
  // continuer sans coach". L'auto-select effect (head_coach par défaut)
  // doit RESPECTER ce choix : sans ce flag, le clear coach était re-set
  // immédiatement par l'effect → bouton paraissait mort. Reset à false
  // quand on change d'équipe (nouveau contexte, l'auto-select repropose).
  const [userClearedCoach, setUserClearedCoach] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [selectedTeamSchoolId, setSelectedTeamSchoolId] = useState<string | null>(null);

  // Carte (écran 3)
  const [primaryPosition, setPrimaryPosition] = useState<string>(""); // abreviation
  const [primaryPositionId, setPrimaryPositionId] = useState<string | null>(null);
  const [positionOptions, setPositionOptions] = useState<PickerOption[]>([]);
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [gradYear, setGradYear] = useState<string>("");
  const [region, setRegion] = useState<string>("");

  // UI flags pickers
  const [openYear, setOpenYear] = useState(false);
  const [openPosition, setOpenPosition] = useState(false);
  const [openRegion, setOpenRegion] = useState(false);

  // Sheets (école, équipe civile, équipe scolaire)
  const [schoolSheetOpen, setSchoolSheetOpen] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [scolaireTeamSheetOpen, setScolaireTeamSheetOpen] = useState(false);

  // Data sources sheets
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);

  const [teamSearch, setTeamSearch] = useState("");
  const [civilTeams, setCivilTeams] = useState<CivilTeamRow[]>([]);
  const [civilTeamsLoading, setCivilTeamsLoading] = useState(false);

  // Iter team-2 — équipes scolaires (school+sport) + coachs attachés
  // à l'équipe choisie. Triplet d'état pour distinguer les 3 cas
  // A (équipe+coach) / B (équipe sans coach) / C (aucune équipe).
  // `Loaded` repère si la première requête a tourné, sans quoi le
  // rendu "aucune équipe" se déclencherait avant chargement.
  const [scolaireTeamSearch, setScolaireTeamSearch] = useState("");
  const [scolaireTeams, setScolaireTeams] = useState<ScolaireTeamRow[]>([]);
  const [scolaireTeamsLoaded, setScolaireTeamsLoaded] = useState(false);
  const [scolaireTeamsLoading, setScolaireTeamsLoading] = useState(false);

  const [teamCoaches, setTeamCoaches] = useState<TeamCoachRow[]>([]);
  const [teamCoachesLoaded, setTeamCoachesLoaded] = useState(false);
  const [teamCoachesLoading, setTeamCoachesLoading] = useState(false);

  // Saving
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Iter 7.50-b3 — phase "wow" post-submit. Une seule fois (moment de
  // création), pas au resume. Quand wowAthlete est set, le rendu bascule
  // sur AthleteOnboardingWowMobile, l'URL reste /athlete/onboarding (le
  // guard MobileTabBar le couvre déjà, strict ===).
  const [wowAthlete, setWowAthlete] = useState<AthleteProfileRecruiterView | null>(null);

  // Iter signup-polish-2 §D — fade-in du wizard à l'entrée pour masquer
  // le saut shell signup→onboarding (couplé au voile #111317 de
  // SignupMobile). Initial false → opacity 0 ; un requestAnimationFrame
  // bascule à true → fade vers 1 sur 400ms. NE s'applique QU'au wizard
  // (pas au WOW, pas au resume bypass qui redirect avant ce JSX).
  const [wizardMounted, setWizardMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWizardMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Init : auth + pré-remplissage + orphan claim ────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      if (cancelled) return;

      setUserId(user.id);
      if (user.email) setEmail(user.email);

      // Pré-remplissage métadonnées signup
      const meta = user.user_metadata || {};
      if (meta.first_name) setFirstName(meta.first_name as string);
      if (meta.last_name) setLastName(meta.last_name as string);
      if (meta.sport) setPrimarySport(meta.sport as string);

      // Fallback users table si metadata vide
      if (!meta.first_name) {
        const { data: userRow } = await supabase
          .from("users").select("first_name, last_name")
          .eq("id", user.id).single();
        if (userRow?.first_name) setFirstName(userRow.first_name);
        if (userRow?.last_name) setLastName(userRow.last_name);
      }

      // Context athlète
      const { data: contextRow } = await supabase
        .from("users").select("context, onboarding_complete").eq("id", user.id).single();
      const ctxRaw = contextRow?.context;
      const ctx: "scolaire" | "ligue_civile" =
        ctxRaw === "ligue_civile" ? "ligue_civile" : "scolaire";
      if (cancelled) return;
      setUserContext(ctx);

      // Resume : athletes row + team_athletes junction.
      // Iter team-3 — on tire aussi division/age_group/gender pour
      // reconstruire le libellé d'équipe via scolaireTeamLabel().
      const { data: existing } = await supabase
        .from("athletes")
        .select("*, schools!school_id(name, type), sports!sport_id(nom), positions!position_id(abreviation), team_athletes(team_id, teams!team_id(id, name, school_id, division, age_group, gender))")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (existing) {
        setExistingAthleteId(existing.id as string);

        // Bypass dashboard UNIQUEMENT si onboarding_complete === true — même
        // critère que le layout (app/athlete/layout.tsx). Avant : on redirigeait
        // sur la PRÉSENCE des champs athletes (first_name/last_name/sport_id/
        // school_id), qu'un compte CLAIMÉ (seedé par le coach) a déjà → saut au
        // dashboard avant handleSubmit (qui pose le flag, ~l.856), donc le flag
        // jamais posé → le layout (flag false) renvoyait à l'onboarding → boucle.
        // Désormais un compte claimé/non terminé reste sur l'onboarding
        // PRÉ-REMPLI et le complète, ce qui pose le flag. (Réplique le fix web —
        // commit 2dbc7fc.)
        if (contextRow?.onboarding_complete === true) {
          router.replace("/athlete/dashboard");
          return;
        }

        // Pré-fill set minimum
        if (existing.first_name) setFirstName(existing.first_name as string);
        if (existing.last_name) setLastName(existing.last_name as string);
        if (existing.telephone) setPhone(existing.telephone as string);
        if (existing.photo_url) setPhoto(existing.photo_url as string);
        if (existing.annee_diplomation) setGradYear(String(existing.annee_diplomation));

        const schoolRel = flatten(existing.schools as { name?: string; type?: string } | { name?: string; type?: string }[] | null);
        const schoolType = schoolRel?.type;
        if (existing.school_id && schoolType !== "LIGUE_CIVILE") {
          setSelectedSchoolId(existing.school_id as string);
          if (schoolRel?.name) setSelectedSchoolName(schoolRel.name);
        }
        if (existing.coach_id) setSelectedCoachId(existing.coach_id as string);

        // Civil team via junction
        const teamAthleteRel = flatten(existing.team_athletes as Record<string, unknown> | Record<string, unknown>[] | null);
        const teamRel = teamAthleteRel
          ? flatten(teamAthleteRel.teams as { id?: string; name?: string; school_id?: string; division?: string | null; age_group?: string | null; gender?: string | null } | { id?: string; name?: string; school_id?: string; division?: string | null; age_group?: string | null; gender?: string | null }[] | null)
          : null;
        if (teamRel?.id) {
          setSelectedTeamId(teamRel.id);
          if (teamRel.name) {
            // Iter team-3 — appliquer le helper aussi au resume, sinon
            // un athlète qui revient voit le nom d'école répété au lieu
            // de ses attributs distinctifs.
            setSelectedTeamName(scolaireTeamLabel({
              name: teamRel.name,
              division: teamRel.division ?? null,
              age_group: teamRel.age_group ?? null,
              gender: teamRel.gender ?? null,
            }));
          }
          if (teamRel.school_id) setSelectedTeamSchoolId(teamRel.school_id);
        }

        const sportRel = flatten(existing.sports as { nom?: string } | { nom?: string }[] | null);
        if (sportRel?.nom) setPrimarySport(sportRel.nom);

        const posRel = flatten(existing.positions as { abreviation?: string } | { abreviation?: string }[] | null);
        if (posRel?.abreviation) setPrimaryPosition(posRel.abreviation);
        if (existing.position_id) setPrimaryPositionId(existing.position_id as string);
        if (existing.numero_jersey) setJerseyNumber(existing.numero_jersey as string);

        // Resume à la première étape incomplète (set minimum).
        // Step 1 = équipe (sport + école/équipe), Step 2 = carte (gradYear).
        // Consents + parent vivent dans auth metadata depuis iter 2b, donc
        // ne participent plus au gating du resume.
        const step1OK = !!(existing.sport_id
          && (ctx === "ligue_civile" ? (teamRel?.id || existing.school_id) : existing.school_id));

        if (step1OK) setStep(2);
        else setStep(1);
      } else if (user.email) {
        // Phase 2 orphan claim — même requête que desktop
        const { data: orphan } = await supabase
          .from("athletes")
          .select("id, first_name, last_name, sports:sport_id(nom), schools:school_id(name), users:coach_id(first_name, last_name)")
          .ilike("email", user.email)
          .is("user_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orphan && !cancelled) {
          const sportRel = flatten(orphan.sports as { nom?: string } | { nom?: string }[] | null);
          const schoolRel = flatten(orphan.schools as { name?: string } | { name?: string }[] | null);
          const coachRel = flatten(orphan.users as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null);
          const coachName = coachRel
            ? `${coachRel.first_name ?? ""} ${coachRel.last_name ?? ""}`.trim() || null
            : null;
          setOrphanMatch({
            id: orphan.id as string,
            first_name: (orphan.first_name as string) ?? null,
            last_name: (orphan.last_name as string) ?? null,
            sport_name: sportRel?.nom ?? null,
            school_name: schoolRel?.name ?? null,
            coach_name: coachName,
          });
          setShowClaimModal(true);
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  /* ── Claim orphan (port desktop handler) ─────────────────── */

  const handleClaimOrphan = useCallback(async () => {
    if (!orphanMatch) return;
    const supabase = createClient();
    const { data: full } = await supabase
      .from("athletes")
      .select("*, schools!school_id(name, type), sports!sport_id(nom), positions!position_id(abreviation)")
      .eq("id", orphanMatch.id)
      .maybeSingle();
    if (!full) {
      setShowClaimModal(false);
      setOrphanMatch(null);
      return;
    }
    if (full.first_name) setFirstName(full.first_name as string);
    if (full.last_name) setLastName(full.last_name as string);
    if (full.photo_url) setPhoto(full.photo_url as string);
    if (full.telephone) setPhone(full.telephone as string);
    if (full.annee_diplomation) setGradYear(String(full.annee_diplomation));
    const schoolRel = flatten(full.schools as { name?: string; type?: string } | { name?: string; type?: string }[] | null);
    if (full.school_id && schoolRel?.type !== "LIGUE_CIVILE") {
      setSelectedSchoolId(full.school_id as string);
      if (schoolRel?.name) setSelectedSchoolName(schoolRel.name);
    }
    if (full.coach_id) setSelectedCoachId(full.coach_id as string);
    // parent_* + consents préservés en DB sur l'orphan ; le submit re-lit
    // user_metadata du signup (iter 2b) et écrase si preuve présente.
    const sportRel = flatten(full.sports as { nom?: string } | { nom?: string }[] | null);
    if (sportRel?.nom) setPrimarySport(sportRel.nom);
    const posRel = flatten(full.positions as { abreviation?: string } | { abreviation?: string }[] | null);
    if (posRel?.abreviation) setPrimaryPosition(posRel.abreviation);
    if (full.position_id) setPrimaryPositionId(full.position_id as string);
    if (full.numero_jersey) setJerseyNumber(full.numero_jersey as string);

    setExistingAthleteId(orphanMatch.id);
    setShowClaimModal(false);
  }, [orphanMatch]);

  const handleSkipClaim = useCallback(() => {
    setShowClaimModal(false);
    setOrphanMatch(null);
  }, []);

  /* ── Data loaders (wrappent les pickers desktop sans réécrire) ── */

  // École SECONDAIRE (= scolaire) — fetch one-shot, filter côté client.
  useEffect(() => {
    if (!schoolSheetOpen || schools.length > 0) return;
    setSchoolsLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schools")
        .select("id, name, city, type")
        .eq("type", "SECONDAIRE")
        .order("name");
      setSchools((data as SchoolRow[]) || []);
      setSchoolsLoading(false);
    })();
  }, [schoolSheetOpen, schools.length]);

  const visibleSchools = useMemo(() => {
    const q = normalize(schoolSearch);
    if (!q) return schools.slice(0, 50);
    return schools.filter((s) =>
      normalize(s.name).includes(q) || (s.city && normalize(s.city).includes(q))
    ).slice(0, 50);
  }, [schools, schoolSearch]);

  // Iter team-2 — équipes scolaires par école+sport (relayé par
  // la migration 20260607150000_teams_onboarding_readable : RLS
  // additive `Secondary teams readable for onboarding`).
  // Trigger : school_id + primarySport set en mode scolaire.
  // Reset si l'un des deux change, pour qu'on ne reste pas sur
  // une liste obsolète.
  useEffect(() => {
    if (userContext !== "scolaire" || !selectedSchoolId || !primarySport) {
      setScolaireTeams([]);
      setScolaireTeamsLoaded(false);
      return;
    }
    let cancelled = false;
    setScolaireTeamsLoading(true);
    setScolaireTeamsLoaded(false);
    (async () => {
      const supabase = createClient();
      const { data: sportRow } = await supabase
        .from("sports").select("id").eq("nom", primarySport).maybeSingle();
      if (cancelled) return;
      if (!sportRow?.id) {
        setScolaireTeams([]);
        setScolaireTeamsLoaded(true);
        setScolaireTeamsLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("teams")
        .select("id, name, division, age_group, gender")
        .eq("school_id", selectedSchoolId)
        .eq("sport_id", sportRow.id)
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      const mapped: ScolaireTeamRow[] = ((rows as Record<string, unknown>[]) || []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        division: (r.division as string) ?? null,
        age_group: (r.age_group as string) ?? null,
        gender: (r.gender as string) ?? null,
      }));
      setScolaireTeams(mapped);
      setScolaireTeamsLoaded(true);
      setScolaireTeamsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userContext, selectedSchoolId, primarySport]);

  const visibleScolaireTeams = useMemo(() => {
    const q = normalize(scolaireTeamSearch);
    if (!q) return scolaireTeams;
    return scolaireTeams.filter((t) =>
      normalize(t.name).includes(q) ||
      (t.division ? normalize(t.division).includes(q) : false) ||
      (t.age_group ? normalize(t.age_group).includes(q) : false)
    );
  }, [scolaireTeams, scolaireTeamSearch]);

  // Iter team-2 — coachs attachés à l'équipe scolaire choisie via
  // team_coaches (RLS additive même migration). Joint sur users
  // pour résoudre le nom. Si selectedTeamId nul ou mode civil, on
  // n'ouvre pas la requête — selectedCoachId reste indépendant.
  useEffect(() => {
    if (userContext !== "scolaire" || !selectedTeamId) {
      setTeamCoaches([]);
      setTeamCoachesLoaded(false);
      return;
    }
    let cancelled = false;
    setTeamCoachesLoading(true);
    setTeamCoachesLoaded(false);
    (async () => {
      const supabase = createClient();
      const { data: rows } = await supabase
        .from("team_coaches")
        .select("id, coach_id, role, users!coach_id(first_name, last_name)")
        .eq("team_id", selectedTeamId);
      if (cancelled) return;
      const mapped: TeamCoachRow[] = ((rows as Record<string, unknown>[]) || []).map((r) => {
        const u = flatten(r.users as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null);
        return {
          id: r.id as string,
          coach_id: r.coach_id as string,
          role: (r.role as string) || "assistant",
          first_name: u?.first_name ?? null,
          last_name: u?.last_name ?? null,
        };
      });
      // Tri : head_coach d'abord, puis coordinator, puis assistant.
      const roleOrder: Record<string, number> = { head_coach: 0, coordinator: 1, assistant: 2 };
      mapped.sort((a, b) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99));
      setTeamCoaches(mapped);
      setTeamCoachesLoaded(true);
      setTeamCoachesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userContext, selectedTeamId]);

  // Auto-sélection du head_coach par défaut quand on charge une
  // nouvelle équipe (sauf si le coach actuel est déjà dans la liste,
  // ex: orphan claim avait pré-rempli un coach valide).
  // Iter bugs-1-fix §B — respecter le choix explicite "Continuer sans
  // coach" (userClearedCoach) : ne PAS re-poser un head_coach après que
  // l'utilisateur l'ait délibérément clearé.
  useEffect(() => {
    if (!teamCoachesLoaded || teamCoaches.length === 0) return;
    if (userClearedCoach) return; // respecter le choix utilisateur
    const currentIsInList = selectedCoachId && teamCoaches.some((c) => c.coach_id === selectedCoachId);
    if (currentIsInList) return;
    const head = teamCoaches.find((c) => c.role === "head_coach") ?? teamCoaches[0];
    setSelectedCoachId(head.coach_id);
    setSelectedCoachName(`${head.first_name ?? ""} ${head.last_name ?? ""}`.trim());
  }, [teamCoachesLoaded, teamCoaches, selectedCoachId, userClearedCoach]);

  // Iter bugs-1-fix §B — reset userClearedCoach quand l'équipe change :
  // nouveau contexte = nouveau coachs possibles, l'auto-select peut
  // reproposer. Le clear ne "colle" donc qu'à l'équipe courante.
  useEffect(() => {
    setUserClearedCoach(false);
  }, [selectedTeamId]);

  // Équipe civile (par sport sélectionné)
  useEffect(() => {
    if (!teamSheetOpen || !primarySport) return;
    setCivilTeamsLoading(true);
    (async () => {
      const supabase = createClient();
      const { data: sportRow } = await supabase
        .from("sports").select("id").eq("nom", primarySport).maybeSingle();
      if (!sportRow?.id) { setCivilTeams([]); setCivilTeamsLoading(false); return; }
      const { data: rows } = await supabase
        .from("teams")
        .select("id, name, age_group, division, school_id, schools!school_id(name, type)")
        .eq("sport_id", sportRow.id)
        .order("name");
      const filtered: CivilTeamRow[] = [];
      for (const raw of (rows as Record<string, unknown>[]) || []) {
        const sch = flatten(raw.schools as { name?: string; type?: string } | { name?: string; type?: string }[] | null);
        if (sch?.type !== "LIGUE_CIVILE") continue;
        filtered.push({
          id: raw.id as string,
          name: raw.name as string,
          age_group: (raw.age_group as string) ?? null,
          division: (raw.division as string) ?? null,
          school_id: raw.school_id as string,
          school_name: sch.name ?? "",
        });
      }
      setCivilTeams(filtered);
      setCivilTeamsLoading(false);
    })();
  }, [teamSheetOpen, primarySport]);

  const visibleCivilTeams = useMemo(() => {
    const q = normalize(teamSearch);
    if (!q) return civilTeams;
    return civilTeams.filter((t) =>
      normalize(t.name).includes(q) || normalize(t.school_name).includes(q)
    );
  }, [civilTeams, teamSearch]);

  /* ── Positions (dépend du sport, depuis sports.id → positions) ── */

  useEffect(() => {
    if (!primarySport) { setPositionOptions([]); return; }
    (async () => {
      const supabase = createClient();
      const { data: sportRow } = await supabase
        .from("sports").select("id").eq("nom", primarySport).maybeSingle();
      if (!sportRow?.id) { setPositionOptions([]); return; }
      const { data: posRows } = await supabase
        .from("positions")
        .select("id, nom, abreviation")
        .eq("sport_id", sportRow.id)
        .order("abreviation");
      const opts: PickerOption[] = ((posRows as Record<string, unknown>[]) || []).map((p) => ({
        value: (p.abreviation as string) || (p.nom as string),
        label: `${p.nom as string}${p.abreviation ? ` (${p.abreviation as string})` : ""}`,
      }));
      setPositionOptions(opts);
    })();
  }, [primarySport]);

  /* ── Validation par écran ────────────────────────────────── */

  // Step 1 = équipe (sport principal + école OR équipe civile).
  const canProceedScreen1 = !!(
    primarySport &&
    (userContext === "ligue_civile" ? true : selectedSchoolId)
  );

  // Step 2 = carte. gradYear est le seul champ obligatoire ;
  // position/jersey/region/photo restent optionnels (set minimum).
  const canSubmit = !!(canProceedScreen1 && gradYear);

  /* ── Photo upload (web file input, Capacitor Camera en sprint ultérieur) ── */

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPhotoUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });
    if (upErr) {
      toast.error({ message: "Échec de l'upload", detail: upErr.message });
      setPhotoUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
    setPhoto(pub.publicUrl);
    setPhotoUploading(false);
    triggerHaptic("Light");
  }, [userId, toast]);

  /* ── Submit final ────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !userId || saving) return;
    setSaving(true);
    const supabase = createClient();

    // Defense in depth role check (parité desktop)
    const { data: userRoleCheck } = await supabase
      .from("users").select("role").eq("id", userId).single();
    if (userRoleCheck?.role !== "ATHLETE") {
      toast.error({ message: "Compte non configuré comme athlète." });
      setSaving(false);
      return;
    }

    // Re-lire raw_user_meta_data — preuve des consents parentaux capturés
    // au signup mobile (SignupMobile iter 2a) + PII parent stashée par
    // buildConsentMetadata(). ⚠️ Loi 25 : seule source autoritaire pour
    // consentement_parental + parent_*. JAMAIS new Date() pour la date
    // de consentement — c'est la date du SIGNUP qui fait foi.
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    const meta = (freshUser?.user_metadata ?? {}) as Record<string, unknown>;
    const consentProfileISO = typeof meta.consent_parental_profile === "string"
      ? meta.consent_parental_profile
      : null;
    const consentVisibilityISO = typeof meta.consent_parental_visibility === "string"
      ? meta.consent_parental_visibility
      : null;
    const hasParentalConsent = consentProfileISO !== null && consentVisibilityISO !== null;

    // Resolve sport_id + position_id
    const { data: sportData } = await supabase
      .from("sports").select("id").eq("nom", primarySport).single();
    let positionId: string | null = primaryPositionId;
    if (primaryPosition && sportData?.id && !positionId) {
      const { data: posData } = await supabase
        .from("positions").select("id")
        .eq("abreviation", primaryPosition).eq("sport_id", sportData.id)
        .maybeSingle();
      positionId = posData?.id ?? null;
    }

    const isCivil = userContext === "ligue_civile";
    const civilAnchorSchoolId = isCivil ? selectedTeamSchoolId : null;

    // Parent / consent slice : on n'écrit QUE si la preuve metadata est là.
    // Fallback (edge case : compte créé hors signup mobile) → on n'ajoute
    // RIEN, ce qui laisse les colonnes au défaut DB (INSERT) ou préserve
    // l'existant (UPDATE). Loi 25 : pas de consentement_parental=true sans
    // trace ISO datée du moment où il a été donné.
    const parentSlice: Record<string, unknown> = {};
    if (hasParentalConsent) {
      const pfn = typeof meta.parent_first_name === "string" ? meta.parent_first_name : null;
      const pln = typeof meta.parent_last_name === "string" ? meta.parent_last_name : null;
      const pem = typeof meta.parent_email === "string" ? meta.parent_email : null;
      const prel = typeof meta.parent_relationship === "string" ? meta.parent_relationship : null;
      const fullParentName = `${pfn ?? ""} ${pln ?? ""}`.trim();

      parentSlice.consentement_parental = true;
      parentSlice.consentement_parental_date = consentProfileISO; // timestamp DU SIGNUP
      parentSlice.parent_first_name = pfn;
      parentSlice.parent_last_name = pln;
      parentSlice.parent_email = pem;
      parentSlice.parent_relationship = prel;
      parentSlice.nom_parent = fullParentName || null;
    } else {
      console.warn(
        "[OnboardingMobile] user_metadata sans consent_parental_profile/visibility — " +
        "compte créé hors signup mobile. consentement_parental NON écrit (preuve absente).",
      );
    }

    // Iter signup-polish-2 §C — partner visibility OPTIONNEL capturé au
    // signup mobile (cf SignupMobile.handleSubmit). Si la case a été
    // cochée, raw_user_meta_data.consent_parental_partner_visibility =
    // ISO du SIGNUP. On traduit en 3 colonnes athletes :
    //   partner_visibility_parental_consent = true
    //   partner_visibility_opt_in           = true
    //   partner_visibility_opted_in_at      = ISO du SIGNUP (PAS now())
    // Même discipline Loi 25 que consentement_parental : pas d'écriture
    // sans preuve datée. Si NULL/non-string → on n'ajoute RIEN au record,
    // les 3 colonnes restent au défaut DB (INSERT: false/null) ou
    // préservent l'existant (UPDATE).
    const partnerVisibilityISO = typeof meta.consent_parental_partner_visibility === "string"
      ? meta.consent_parental_partner_visibility
      : null;
    if (partnerVisibilityISO !== null) {
      parentSlice.partner_visibility_parental_consent = true;
      parentSlice.partner_visibility_opt_in = true;
      parentSlice.partner_visibility_opted_in_at = partnerVisibilityISO;
    }

    // Iter signup-reorg — date de naissance capturée à l'écran 2 du signup
    // (SignupMobile.handleSubmit) et stashée dans raw_user_meta_data.date_naissance
    // (format ISO "YYYY-MM-DD"). Relue ici et écrite dans athletes.date_naissance
    // si présente. Si absente (compte créé hors signup mobile) → on n'écrit rien,
    // la colonne reste null (insert) ou préserve l'existant (update).
    const birthdateRaw = typeof meta.date_naissance === "string" && meta.date_naissance.length > 0
      ? meta.date_naissance
      : null;

    const athleteRecord: Record<string, unknown> = {
      user_id: userId,
      school_id: isCivil ? civilAnchorSchoolId : (selectedSchoolId || null),
      coach_id: isCivil ? null : selectedCoachId,
      league_team_id: null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      photo_url: photo || null,
      email: email || null,
      telephone: phone || null,
      annee_diplomation: gradYear ? parseInt(gradYear) : null,
      sport_id: sportData?.id || null,
      position_id: positionId,
      numero_jersey: jerseyNumber || null,
      ...(birthdateRaw !== null ? { date_naissance: birthdateRaw } : {}),
      ...parentSlice,
      // partner_visibility_* : écrits SEULEMENT si la case a été cochée au
      // signup (cf parentSlice ci-dessus). Sinon restent au défaut DB.
      status: "ACTIF",
      verified: false,
    };

    let athleteIdForTeam: string | null = existingAthleteId;
    if (existingAthleteId) {
      const { error } = await supabase.from("athletes").update(athleteRecord).eq("id", existingAthleteId);
      if (error) {
        console.error("[OnboardingMobile] update:", error);
        toast.error({ message: "Échec de sauvegarde", detail: error.message });
        setSaving(false); return;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("athletes").insert(athleteRecord).select("id").single();
      if (error) {
        console.error("[OnboardingMobile] insert:", error);
        toast.error({ message: "Échec de sauvegarde", detail: error.message });
        setSaving(false); return;
      }
      athleteIdForTeam = inserted?.id ?? null;
    }

    // team_athletes junction (scolaire OU civil)
    if (selectedTeamId && athleteIdForTeam) {
      const { error: taErr } = await supabase.from("team_athletes").insert({
        team_id: selectedTeamId,
        athlete_id: athleteIdForTeam,
      });
      if (taErr && taErr.code !== "23505") {
        console.error("[OnboardingMobile] team_athletes:", taErr);
      }
    }

    // Profile completion
    const { data: freshAthlete } = await supabase
      .from("athletes").select("*").eq("user_id", userId).single();
    if (freshAthlete) {
      const completion = calculateProfileCompletion(freshAthlete);
      await supabase.from("athletes").update({ profile_completion: completion }).eq("user_id", userId);
    }

    // consent_marketing : DÉJÀ écrit au signup mobile (raw_user_meta_data +
    // users.privacy_preferences via persistInitialConsents). Aucune
    // ré-écriture ici → la case marketing a été cochée/refusée UNE fois
    // au signup, c'est cette date qui fait foi.

    // Flip onboarding_complete BEFORE le WOW pour que toute navigation
    // back-button au milieu de l'animation aboutisse à un état cohérent.
    await supabase.from("users").update({ onboarding_complete: true }).eq("id", userId);
    triggerHaptic("Medium");

    // Iter 7.50-b3 — au lieu de redirect immédiat, on bascule en phase
    // WOW. Re-fetch via loadAthleteRaw + mapToRecruiterView pour avoir
    // exactement la même shape que la vue recruteur (la carte qu'on
    // affiche EST la carte que verront les recruteurs). Si l'idle se
    // passe mal (pas d'ID, fetch fail), on bypass le WOW et redirect
    // direct — pas de blocage UX.
    const finalId = athleteIdForTeam;
    if (finalId) {
      try {
        const { data: rawAthlete } = await loadAthleteRaw(finalId);
        if (rawAthlete) {
          const mapped = mapToRecruiterView(rawAthlete as Record<string, unknown>);
          setSaving(false);
          setWowAthlete(mapped);
          return; // ⚠️ pas de router.replace ici — c'est le CTA du WOW qui le fera
        }
      } catch (err) {
        console.warn("[OnboardingMobile] WOW re-fetch failed, bypass:", err);
      }
    }
    // Fallback : pas d'athlète à montrer, on redirect directement.
    setSaving(false);
    router.replace("/athlete/dashboard");
  }, [
    canSubmit, userId, saving, primarySport, primaryPosition, primaryPositionId,
    userContext, selectedTeamSchoolId, selectedSchoolId, selectedCoachId,
    firstName, lastName, photo, email, phone, gradYear, jerseyNumber,
    existingAthleteId, selectedTeamId, router, toast,
  ]);

  /* ── Handlers nav ────────────────────────────────────────── */

  const handleNext = useCallback(() => {
    triggerHaptic("Light");
    if (step === 1 && canProceedScreen1) setStep(2);
  }, [step, canProceedScreen1]);

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    if (step > 1) setStep((s) => (s - 1) as 1 | 2);
  }, [step]);

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white flex items-center justify-center">
        <p className="text-[14px] text-[#6b7280]">Chargement…</p>
      </div>
    );
  }

  // Iter 7.50-b3 — phase WOW prioritaire sur le wizard. Le CTA "C'est
  // parti" + le skip appellent tous les deux le redirect dashboard.
  if (wowAthlete) {
    return (
      <AthleteOnboardingWowMobile
        athlete={wowAthlete}
        onComplete={() => router.replace("/athlete/dashboard")}
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-[#111317] text-white flex flex-col"
      style={{
        // Iter signup-polish-2 §D — fade-in 0→1 sur 400ms. Couplé au voile
        // sortant de SignupMobile (#111317 opacity 1 quand on arrive ici)
        // → recouvrement propre, plus de saut visible PlaybookHeroArt →
        // PlaybookBackground. N'affecte pas le WOW ni le resume bypass.
        opacity: wizardMounted ? 1 : 0,
        transition: "opacity 400ms ease-out",
      }}
    >
      {/* Claim Modal Phase 2 */}
      {showClaimModal && orphanMatch && (
        <ClaimProfileModal
          orphan={orphanMatch}
          onClaim={handleClaimOrphan}
          onSkip={handleSkipClaim}
        />
      )}

      {/* Header sticky : back + progress + title */}
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center px-4 py-2 gap-2 min-h-[64px]">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0 disabled:opacity-30"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            {/* Iter signup-polish-1 — le titre passe en H1 inline dans le
                contenu (style aligné sur signup Step3Parent). Header sticky
                garde back + label "Étape X" + dots pour la navigation. */}
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40">
              Étape {step} sur 2
            </p>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  s <= step ? "bg-[#E63946]" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Contenu — scrollable */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
      >
        {step === 1 && (
          <Step1Content
            userContext={userContext}
            primarySport={primarySport} setPrimarySport={setPrimarySport}
            selectedSchoolName={selectedSchoolName}
            onOpenSchool={() => setSchoolSheetOpen(true)}
            schoolIdSelected={!!selectedSchoolId}
            // Iter team-2 — équipe scolaire + coachs inline
            selectedTeamId={userContext === "scolaire" ? selectedTeamId : null}
            selectedTeamName={userContext === "scolaire" ? selectedTeamName : ""}
            onOpenScolaireTeam={() => setScolaireTeamSheetOpen(true)}
            scolaireTeamsLoaded={scolaireTeamsLoaded}
            scolaireTeamsCount={scolaireTeams.length}
            teamCoachesLoaded={teamCoachesLoaded}
            teamCoaches={teamCoaches}
            selectedCoachId={selectedCoachId}
            onSelectCoach={(c) => {
              setSelectedCoachId(c.coach_id);
              setSelectedCoachName(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim());
            }}
            onClearCoach={() => {
              setSelectedCoachId(null);
              setSelectedCoachName("");
              // Iter bugs-1-fix §B — verrouille le choix pour que
              // l'auto-select ne re-pose pas un head_coach derrière.
              setUserClearedCoach(true);
            }}
            // Civil (existant)
            selectedTeamNameCivil={userContext === "ligue_civile" ? selectedTeamName : ""}
            onOpenTeam={() => setTeamSheetOpen(true)}
          />
        )}

        {step === 2 && (
          <Step2Content
            primaryPosition={primaryPosition}
            onOpenPosition={() => setOpenPosition(true)}
            jerseyNumber={jerseyNumber} setJerseyNumber={setJerseyNumber}
            gradYear={gradYear}
            onOpenYear={() => setOpenYear(true)}
            region={region}
            onOpenRegion={() => setOpenRegion(true)}
            photo={photo} photoUploading={photoUploading}
            onPhotoChange={handlePhotoChange}
            showRegion={userContext === "ligue_civile"}
            showPosition={positionOptions.length > 0}
          />
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06] px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {step < 2 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceedScreen1}
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all ${
              canProceedScreen1
                ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            Continuer
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              canSubmit && !saving
                ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                Création…
              </>
            ) : (
              "Construire ma carte"
            )}
          </button>
        )}
      </div>

      {/* MobilePickers (year, position, region) */}
      <MobilePicker
        open={openYear}
        onClose={() => setOpenYear(false)}
        title="Année de graduation"
        options={YEAR_OPTIONS}
        value={gradYear || null}
        onChange={(v) => setGradYear(v ? String(v) : "")}
      />
      <MobilePicker
        open={openPosition}
        onClose={() => setOpenPosition(false)}
        title="Position"
        options={positionOptions}
        value={primaryPosition || null}
        onChange={(v) => {
          setPrimaryPosition(v ? String(v) : "");
          setPrimaryPositionId(null); // re-résolu au submit via sport+abbr
        }}
      />
      <MobilePicker
        open={openRegion}
        onClose={() => setOpenRegion(false)}
        title="Région"
        options={REGION_OPTIONS}
        value={region || null}
        onChange={(v) => setRegion(v ? String(v) : "")}
      />

      {/* SearchSheets */}
      <SearchSheet<SchoolRow>
        open={schoolSheetOpen}
        onClose={() => setSchoolSheetOpen(false)}
        title="Mon école"
        searchPlaceholder="Rechercher mon école…"
        searchValue={schoolSearch}
        onSearchChange={setSchoolSearch}
        items={visibleSchools}
        loading={schoolsLoading}
        keyOf={(s) => s.id}
        onSelect={(s) => {
          setSelectedSchoolId(s.id);
          setSelectedSchoolName(s.name);
          // Reset équipe + coach si école change (orphan team_id sinon)
          setSelectedCoachId(null);
          setSelectedCoachName("");
          setSelectedTeamId(null);
          setSelectedTeamName("");
        }}
        renderItem={(s, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{s.name}</p>
            {s.city && (
              <p className="text-[13px] text-white/55 truncate">{s.city}</p>
            )}
          </button>
        )}
      />

      {/* Iter team-2 — équipe scolaire (école+sport). Le coach s'en
          déduit côté Step1Content (inline radio sur team_coaches). */}
      <SearchSheet<ScolaireTeamRow>
        open={scolaireTeamSheetOpen}
        onClose={() => setScolaireTeamSheetOpen(false)}
        title="Mon équipe scolaire"
        searchPlaceholder="Rechercher mon équipe…"
        searchValue={scolaireTeamSearch}
        onSearchChange={setScolaireTeamSearch}
        items={visibleScolaireTeams}
        loading={scolaireTeamsLoading}
        keyOf={(t) => t.id}
        onSelect={(t) => {
          setSelectedTeamId(t.id);
          // Iter team-3 — stocker les attributs distinctifs comme libellé
          // affiché (le name est ≈ identique d'une équipe à l'autre dans
          // la même école/sport, donc inutile à montrer).
          setSelectedTeamName(scolaireTeamLabel(t));
        }}
        emptyContent={
          <p className="text-center text-[14px] text-white/55 py-12 px-4">
            Aucune équipe trouvée pour cette école et ce sport.
          </p>
        }
        renderItem={(t, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">{scolaireTeamLabel(t)}</p>
          </button>
        )}
        footer={
          <button
            type="button"
            onClick={() => {
              setSelectedTeamId(null);
              setSelectedTeamName("");
              setScolaireTeamSheetOpen(false);
            }}
            className="w-full h-11 rounded-2xl border border-white/[0.10] text-[14px] font-semibold text-white/70 active:bg-white/[0.04]"
          >
            Continuer sans équipe
          </button>
        }
      />

      <SearchSheet<CivilTeamRow>
        open={teamSheetOpen}
        onClose={() => setTeamSheetOpen(false)}
        title="Mon équipe civile"
        searchPlaceholder="Rechercher mon équipe…"
        searchValue={teamSearch}
        onSearchChange={setTeamSearch}
        items={visibleCivilTeams}
        loading={civilTeamsLoading}
        keyOf={(t) => t.id}
        onSelect={(t) => {
          setSelectedTeamId(t.id);
          setSelectedTeamName(t.name);
          setSelectedTeamSchoolId(t.school_id);
        }}
        emptyContent={
          <p className="text-center text-[14px] text-white/55 py-12 px-4">
            Aucune équipe civile trouvée pour {primarySport || "ton sport"}. Tu pourras l&apos;associer plus tard.
          </p>
        }
        renderItem={(t, onTap) => {
          const meta = [t.age_group, t.division].filter(Boolean).join(" · ");
          return (
            <button
              type="button"
              onClick={onTap}
              className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
            >
              <p className="text-[16px] font-semibold text-white truncate">{t.name}</p>
              <p className="text-[13px] text-white/55 truncate">
                {t.school_name}{meta ? ` — ${meta}` : ""}
              </p>
            </button>
          );
        }}
        footer={
          <button
            type="button"
            onClick={() => {
              setSelectedTeamId(null);
              setSelectedTeamName("");
              setSelectedTeamSchoolId(null);
              setTeamSheetOpen(false);
            }}
            className="w-full h-11 rounded-2xl border border-white/[0.10] text-[14px] font-semibold text-white/70 active:bg-white/[0.04]"
          >
            Continuer sans équipe
          </button>
        }
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sous-composants par écran
═══════════════════════════════════════════════════════════════ */

/* ── Helpers UI ──────────────────────────────────────────── */

// Iter signup-polish-1 — typo alignée sur SignupMobile (Step3Parent / Step2Identity).
// Inputs : text-[17px] (vs 16 avant). Labels : tracking-[0.18em] text-[#B6BCC7]
// text-[13px] mb-1 (vs text-[12px] text-white/50 mb-1.5).
const inputCls = "w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 text-[17px] text-white placeholder:text-white/40 outline-none focus:border-[#E63946]/40";
const labelCls = "block uppercase mb-1 text-[13px] font-bold tracking-[0.18em] text-[#B6BCC7]";

// Iter signup-polish-1 — H1 inline en haut du contenu de chaque écran,
// aligné sur le style des écrans signup (font-head 26px, leading 0.95).
function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1
        className="font-head font-black text-white uppercase tracking-tight"
        style={{ fontSize: 26, lineHeight: 0.95 }}
      >
        {title}
      </h1>
      <p className="text-[14px] text-[#9CA3AF] mt-2 leading-snug">
        {subtitle}
      </p>
    </>
  );
}

// Iter signup-polish-1 — SectionTitle aligné sur signup h2 (text-[13px]
// text-white/70 + accent h-3 au lieu de h-4 + text-[15px] text-white).
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-head text-[13px] font-black uppercase tracking-tight text-white/70 flex items-center gap-2 mt-6 mb-3">
      <span className="w-0.5 h-3 bg-[#E63946] rounded-full" />
      {children}
    </h2>
  );
}

function PickerRow({
  label, value, placeholder, onTap, required,
}: {
  label: string;
  value: string;
  placeholder: string;
  onTap: () => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}{required && <span className="text-[#E63946] ml-0.5">*</span>}
      </label>
      <button
        type="button"
        onClick={onTap}
        className="w-full flex items-center justify-between bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 active:bg-[#22262e] transition-colors text-left min-h-[52px]"
      >
        <span className={`text-[16px] truncate ${value ? "text-white" : "text-white/40"}`}>
          {value || placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0 ml-2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

/* ── ÉCRAN 1 — Ton équipe ────────────────────────────────────── */

interface Step1Props {
  userContext: "scolaire" | "ligue_civile";
  primarySport: string; setPrimarySport: (v: string) => void;
  selectedSchoolName: string;
  onOpenSchool: () => void;
  schoolIdSelected: boolean;
  // Iter team-2 — équipe scolaire (school+sport)
  selectedTeamId: string | null;
  selectedTeamName: string;
  onOpenScolaireTeam: () => void;
  scolaireTeamsLoaded: boolean;
  scolaireTeamsCount: number;
  // Iter team-2 — coachs de l'équipe scolaire (inline radio)
  teamCoachesLoaded: boolean;
  teamCoaches: TeamCoachRow[];
  selectedCoachId: string | null;
  onSelectCoach: (coach: TeamCoachRow) => void;
  onClearCoach: () => void;
  // Civil (inchangé)
  selectedTeamNameCivil: string;
  onOpenTeam: () => void;
}

function Step1Content(p: Step1Props) {
  const roleLabel = (r: string) => r === "head_coach" ? "Entraîneur-chef" : r === "coordinator" ? "Coordonnateur" : "Assistant";
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Ton équipe."
        subtitle={p.userContext === "ligue_civile"
          ? "Choisis ton sport et ton équipe civile. Ce qui ira sur ta carte joueur."
          : "Choisis ton sport, ton école et — si elle existe — l'équipe à laquelle tu appartiens."}
      />
      <SectionTitle>Sport principal</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {SPORTS.map((s) => {
          const active = p.primarySport === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => { triggerHaptic("Light"); p.setPrimarySport(s); }}
              className={`min-h-[44px] inline-flex items-center justify-center px-3 rounded-2xl text-[13px] font-bold transition-colors ${
                active
                  ? "bg-[#E63946] text-white"
                  : "bg-[#1A1D24] border border-white/[0.06] text-white/70 active:bg-white/[0.04]"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {p.userContext === "scolaire" ? (
        <>
          <SectionTitle>Mon école</SectionTitle>
          <PickerRow
            label="École secondaire"
            value={p.selectedSchoolName}
            placeholder="Sélectionner mon école…"
            onTap={p.onOpenSchool}
            required
          />

          {/* Iter team-2 — section ÉQUIPE scolaire (visible une fois
              école + sport set). 3 cas non-bloquants :
              - A : équipe + coach → picker équipe + radio coachs
              - B : équipe sans coach → message statique
              - C : aucune équipe pour école+sport → message statique
                    + Continuer sans équipe (via footer du picker). */}
          {p.schoolIdSelected && p.primarySport && (
            <>
              <SectionTitle>Mon équipe</SectionTitle>
              {!p.scolaireTeamsLoaded ? (
                <p className="text-[12px] text-white/40 italic px-1 mt-1">
                  Chargement des équipes…
                </p>
              ) : p.scolaireTeamsCount === 0 ? (
                // CAS C — aucune équipe pour ce sport à cette école
                <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-4">
                  <p className="text-[15px] text-white/90 leading-relaxed">
                    Aucune équipe pour {p.primarySport} à {p.selectedSchoolName}. Demande à ton coach de s&apos;inscrire et d&apos;enregistrer ton équipe.
                  </p>
                  <p className="text-[14px] text-white/55 mt-3">
                    Tu peux continuer sans équipe — l&apos;école et le sport suffisent pour générer ta carte.
                  </p>
                </div>
              ) : (
                <>
                  <PickerRow
                    label="Équipe"
                    value={p.selectedTeamName}
                    placeholder="Sélectionner mon équipe…"
                    onTap={p.onOpenScolaireTeam}
                  />
                  {/* Section COACH — dépend de la team choisie */}
                  {p.selectedTeamId && (
                    <>
                      <SectionTitle>Mon coach</SectionTitle>
                      {!p.teamCoachesLoaded ? (
                        <p className="text-[12px] text-white/40 italic px-1 mt-1">
                          Chargement des coachs…
                        </p>
                      ) : p.teamCoaches.length === 0 ? (
                        // CAS B — équipe choisie sans coach inscrit
                        <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-4">
                          <p className="text-[15px] text-white/90 leading-relaxed">
                            Cette équipe n&apos;a pas encore de coach sur Nexus. Invite ton coach à vérifier ton profil.
                          </p>
                        </div>
                      ) : (
                        // CAS A — équipe + coachs : radio inline
                        <div className="space-y-2">
                          {p.teamCoaches.map((c) => {
                            const active = p.selectedCoachId === c.coach_id;
                            const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => { triggerHaptic("Light"); p.onSelectCoach(c); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors min-h-[52px] text-left ${
                                  active
                                    ? "bg-[#E63946]/12 border-[#E63946]/40"
                                    : "bg-[#1A1D24] border-white/[0.06] active:bg-white/[0.04]"
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  active ? "border-[#E63946]" : "border-white/30"
                                }`}>
                                  {active && <div className="w-2.5 h-2.5 rounded-full bg-[#E63946]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[15px] font-semibold text-white truncate">{fullName}</p>
                                  <p className="text-[12px] text-white/55">{roleLabel(c.role)}</p>
                                </div>
                              </button>
                            );
                          })}
                          {p.selectedCoachId && (
                            <button
                              type="button"
                              onClick={() => { triggerHaptic("Light"); p.onClearCoach(); }}
                              className="w-full h-11 rounded-2xl border border-white/[0.10] text-[13px] font-semibold text-white/55 active:bg-white/[0.04]"
                            >
                              Continuer sans coach
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {!p.schoolIdSelected && (
            <p className="text-[12px] text-white/40 italic px-1 mt-3">
              Choisis d&apos;abord ton école pour voir les équipes.
            </p>
          )}
        </>
      ) : (
        <>
          <SectionTitle>Mon équipe civile</SectionTitle>
          <PickerRow
            label="Équipe"
            value={p.selectedTeamNameCivil}
            placeholder={p.primarySport ? "Sélectionner mon équipe…" : "Choisis d'abord ton sport"}
            onTap={() => { if (p.primarySport) p.onOpenTeam(); }}
          />
          <p className="text-[12px] text-white/40 italic px-1 mt-1">
            Pas obligatoire — tu pourras l&apos;associer plus tard.
          </p>
        </>
      )}
    </div>
  );
}

/* ── ÉCRAN 2 — Ta carte ──────────────────────────────────────── */

interface Step2Props {
  primaryPosition: string;
  onOpenPosition: () => void;
  jerseyNumber: string; setJerseyNumber: (v: string) => void;
  gradYear: string;
  onOpenYear: () => void;
  region: string;
  onOpenRegion: () => void;
  photo: string | null;
  photoUploading: boolean;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showRegion: boolean;
  showPosition: boolean;
}

function Step2Content(p: Step2Props) {
  return (
    <div className="px-6 pt-4 space-y-1">
      <StepHeading
        title="Ta carte."
        subtitle="Une photo, une promotion, ton numéro. Le minimum pour la générer — tu pourras compléter le reste plus tard."
      />
      <SectionTitle>Ta photo</SectionTitle>
      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440] border border-white/[0.06]">
          {p.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo} alt="Photo" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-white/80">
            {p.photo ? "Photo téléchargée" : "Aucune photo (optionnel)"}
          </p>
          <label className="inline-flex items-center mt-2 h-11 px-4 rounded-2xl bg-white/[0.06] active:bg-white/[0.10] text-[14px] font-semibold text-white cursor-pointer min-w-[44px]">
            <input
              type="file"
              accept="image/*"
              onChange={p.onPhotoChange}
              className="sr-only"
              disabled={p.photoUploading}
            />
            {p.photoUploading ? "Téléchargement…" : (p.photo ? "Changer" : "Choisir une photo")}
          </label>
        </div>
      </div>

      <SectionTitle>Ta promotion</SectionTitle>
      <PickerRow
        label="Année de graduation"
        value={p.gradYear}
        placeholder="Sélectionner l'année…"
        onTap={p.onOpenYear}
        required
      />

      {p.showPosition && (
        <>
          <SectionTitle>Ta position</SectionTitle>
          <PickerRow
            label="Position"
            value={p.primaryPosition}
            placeholder="Sélectionner ta position…"
            onTap={p.onOpenPosition}
          />
        </>
      )}

      <SectionTitle>Numéro de jersey</SectionTitle>
      <div>
        <label className={labelCls}>Numéro</label>
        <input
          type="text"
          inputMode="numeric"
          value={p.jerseyNumber}
          onChange={(e) => p.setJerseyNumber(e.target.value.slice(0, 3))}
          placeholder="14"
          className={inputCls}
        />
      </div>

      {p.showRegion && (
        <>
          <SectionTitle>Ta région</SectionTitle>
          <PickerRow
            label="Région"
            value={p.region}
            placeholder="Sélectionner ta région…"
            onTap={p.onOpenRegion}
          />
        </>
      )}

      <p className="text-[12px] text-white/40 italic px-1 mt-6 mb-4 text-center">
        Tu pourras compléter ton profil détaillé (taille, poids, vidéos, notes) après création depuis ton dashboard.
      </p>
    </div>
  );
}
