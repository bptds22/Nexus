"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteOnboardingMobile — iter 7.50-a
   "Construis ta carte" — onboarding minimum mobile (3 écrans).

   Philosophie (DIAG 7.50-v2) : ne capturer que ce qui est nécessaire
   pour générer la carte joueur (set minimum). Les champs avancés
   (GPA, taille, poids, vidéos, tests) sont DÉPORTÉS au profil édition
   existant (/athlete/profil). L'athlète arrive sur sa carte WOW dès
   le minimum + complète plus tard depuis le dashboard.

   ÉCRAN 1 — Toi & Consentements (Loi 25 PRÉSERVÉ INTÉGRALEMENT)
   ÉCRAN 2 — Ton équipe (sport + école OU équipe civile + coach)
   ÉCRAN 3 — Ta carte (position + jersey + promo + région + photo)

   ⚠️ Loi 25 / mineurs : les 2 checkboxes parentales obligatoires
   (consentement_parental + consentement_parental_date ISO) + la
   PartnerVisibilityConsentCard intacte. consentComms écrit dans
   auth.users.user_metadata.consent_marketing (canon /auth/invite).

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
import PartnerVisibilityConsentCard from "@/components/shared/PartnerVisibilityConsentCard";
import ClaimProfileModal, { type OrphanProfile } from "@/components/auth/ClaimProfileModal";

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

const RELATION_OPTIONS: PickerOption[] = [
  { value: "Père", label: "Père" },
  { value: "Mère", label: "Mère" },
  { value: "Tuteur légal", label: "Tuteur légal" },
  { value: "Autre", label: "Autre" },
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
type CoachRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  school_name: string | null;
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

  // Step machine 1|2|3
  const [step, setStep] = useState<1 | 2 | 3>(1);

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

  // Parent
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelationship, setParentRelationship] = useState<string>("");

  // Consents Loi 25
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState(false);
  const [consentPartnerVisibility, setConsentPartnerVisibility] = useState(false);
  const [consentComms, setConsentComms] = useState(false);

  // Sport / école / coach / équipe civile
  const [primarySport, setPrimarySport] = useState<string>("");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string>("");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedCoachName, setSelectedCoachName] = useState<string>("");
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
  const [openRelation, setOpenRelation] = useState(false);
  const [openYear, setOpenYear] = useState(false);
  const [openPosition, setOpenPosition] = useState(false);
  const [openRegion, setOpenRegion] = useState(false);

  // Sheets (école, équipe civile, coach)
  const [schoolSheetOpen, setSchoolSheetOpen] = useState(false);
  const [coachSheetOpen, setCoachSheetOpen] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);

  // Data sources sheets
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);

  const [coachSearch, setCoachSearch] = useState("");
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);

  const [teamSearch, setTeamSearch] = useState("");
  const [civilTeams, setCivilTeams] = useState<CivilTeamRow[]>([]);
  const [civilTeamsLoading, setCivilTeamsLoading] = useState(false);

  // Saving
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
        .from("users").select("context").eq("id", user.id).single();
      const ctxRaw = contextRow?.context;
      const ctx: "scolaire" | "ligue_civile" =
        ctxRaw === "ligue_civile" ? "ligue_civile" : "scolaire";
      if (cancelled) return;
      setUserContext(ctx);

      // Resume : athletes row + team_athletes junction
      const { data: existing } = await supabase
        .from("athletes")
        .select("*, schools!school_id(name, type), sports!sport_id(nom), positions!position_id(abreviation), team_athletes(team_id, teams!team_id(id, name, school_id))")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (existing) {
        setExistingAthleteId(existing.id as string);

        // Profil complet ? bypass direct dashboard
        const profileComplete = existing.first_name && existing.last_name && existing.sport_id
          && (ctx === "ligue_civile" || existing.school_id);
        if (profileComplete) {
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
          ? flatten(teamAthleteRel.teams as { id?: string; name?: string; school_id?: string } | { id?: string; name?: string; school_id?: string }[] | null)
          : null;
        if (teamRel?.id) {
          setSelectedTeamId(teamRel.id);
          if (teamRel.name) setSelectedTeamName(teamRel.name);
          if (teamRel.school_id) setSelectedTeamSchoolId(teamRel.school_id);
        }

        if (existing.parent_first_name) setParentFirstName(existing.parent_first_name as string);
        if (existing.parent_last_name) setParentLastName(existing.parent_last_name as string);
        if (existing.parent_email) setParentEmail(existing.parent_email as string);
        if (existing.telephone_parent) setParentPhone(existing.telephone_parent as string);
        if (existing.parent_relationship) setParentRelationship(existing.parent_relationship as string);
        if (existing.consentement_parental) {
          setConsentProfile(true);
          setConsentVisibility(true);
        }
        if (existing.partner_visibility_opt_in) {
          setConsentPartnerVisibility(true);
        }

        const sportRel = flatten(existing.sports as { nom?: string } | { nom?: string }[] | null);
        if (sportRel?.nom) setPrimarySport(sportRel.nom);

        const posRel = flatten(existing.positions as { abreviation?: string } | { abreviation?: string }[] | null);
        if (posRel?.abreviation) setPrimaryPosition(posRel.abreviation);
        if (existing.position_id) setPrimaryPositionId(existing.position_id as string);
        if (existing.numero_jersey) setJerseyNumber(existing.numero_jersey as string);

        // Resume à la première étape incomplète (set minimum)
        const step1OK = !!(existing.first_name && existing.last_name
          && existing.consentement_parental
          && existing.parent_first_name && existing.parent_last_name && existing.parent_email);
        const step2OK = !!(existing.sport_id
          && (ctx === "ligue_civile" ? (teamRel?.id || existing.school_id) : existing.school_id));

        if (step1OK && step2OK) setStep(3);
        else if (step1OK) setStep(2);
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
    if (full.parent_first_name) setParentFirstName(full.parent_first_name as string);
    if (full.parent_last_name) setParentLastName(full.parent_last_name as string);
    if (full.parent_email) setParentEmail(full.parent_email as string);
    if (full.telephone_parent) setParentPhone(full.telephone_parent as string);
    if (full.parent_relationship) setParentRelationship(full.parent_relationship as string);
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

  // Coach (par école sélectionnée)
  useEffect(() => {
    if (!coachSheetOpen || !selectedSchoolId) return;
    setCoachesLoading(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, schools!school_id(name)")
        .eq("role", "COACH")
        .eq("school_id", selectedSchoolId)
        .order("last_name");
      const mapped: CoachRow[] = ((data as Record<string, unknown>[]) || []).map((r) => {
        const sch = flatten(r.schools as { name?: string } | { name?: string }[] | null);
        return {
          id: r.id as string,
          first_name: (r.first_name as string) ?? null,
          last_name: (r.last_name as string) ?? null,
          school_name: sch?.name ?? null,
        };
      });
      setCoaches(mapped);
      setCoachesLoading(false);
    })();
  }, [coachSheetOpen, selectedSchoolId]);

  const visibleCoaches = useMemo(() => {
    const q = normalize(coachSearch);
    if (!q) return coaches;
    return coaches.filter((c) =>
      normalize(`${c.first_name ?? ""} ${c.last_name ?? ""}`).includes(q)
    );
  }, [coaches, coachSearch]);

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

  const canProceedScreen1 = !!(
    firstName.trim() && lastName.trim() &&
    parentFirstName.trim() && parentLastName.trim() && parentEmail.trim() &&
    consentProfile && consentVisibility
  );

  const canProceedScreen2 = !!(
    primarySport &&
    (userContext === "ligue_civile" ? true : selectedSchoolId)
  );

  const canSubmit = !!(
    canProceedScreen1 && canProceedScreen2 &&
    gradYear
    // position/jersey/region/photo restent optionnels (set minimum carte)
  );

  /* ── Photo upload (web file input, Capacitor Camera en sprint ultérieur) ── */

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPhotoUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("athlete-photos")
      .upload(filePath, file, { upsert: true });
    if (upErr) {
      toast.error({ message: "Échec de l'upload", detail: upErr.message });
      setPhotoUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("athlete-photos").getPublicUrl(filePath);
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
      // Parent / Guardian
      nom_parent: `${parentFirstName.trim()} ${parentLastName.trim()}`.trim() || null,
      parent_first_name: parentFirstName.trim() || null,
      parent_last_name: parentLastName.trim() || null,
      parent_email: parentEmail.trim() || null,
      telephone_parent: parentPhone.trim() || null,
      parent_relationship: parentRelationship || null,
      consentement_parental: consentProfile && consentVisibility,
      consentement_parental_date: (consentProfile && consentVisibility) ? new Date().toISOString() : null,
      ...(consentProfile && consentVisibility && consentPartnerVisibility ? {
        partner_visibility_parental_consent: true,
        partner_visibility_opt_in: true,
        partner_visibility_opted_in_at: new Date().toISOString(),
      } : {}),
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

    // consent_marketing → auth.users.user_metadata (canon /auth/invite)
    if (consentComms) {
      try {
        await supabase.auth.updateUser({
          data: { consent_marketing: new Date().toISOString() },
        });
      } catch (err) {
        console.warn("[OnboardingMobile] consent_marketing metadata write failed (non-blocking):", err);
      }
    }

    // Flip onboarding_complete + redirect (TODO 7.50-b : /athlete/onboarding/carte)
    await supabase.from("users").update({ onboarding_complete: true }).eq("id", userId);
    triggerHaptic("Medium");
    setSaving(false);
    router.replace("/athlete/dashboard");
  }, [
    canSubmit, userId, saving, primarySport, primaryPosition, primaryPositionId,
    userContext, selectedTeamSchoolId, selectedSchoolId, selectedCoachId,
    firstName, lastName, photo, email, phone, gradYear, jerseyNumber,
    parentFirstName, parentLastName, parentEmail, parentPhone, parentRelationship,
    consentProfile, consentVisibility, consentPartnerVisibility, consentComms,
    existingAthleteId, selectedTeamId, router, toast,
  ]);

  /* ── Handlers nav ────────────────────────────────────────── */

  const handleNext = useCallback(() => {
    triggerHaptic("Light");
    if (step === 1 && canProceedScreen1) setStep(2);
    else if (step === 2 && canProceedScreen2) setStep(3);
  }, [step, canProceedScreen1, canProceedScreen2]);

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
  }, [step]);

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] text-white flex items-center justify-center">
        <p className="text-[14px] text-[#6b7280]">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317] text-white flex flex-col">
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
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40">
              Étape {step} sur 3
            </p>
            <h1 className="font-head text-[18px] font-black uppercase tracking-tight text-white truncate">
              {step === 1 ? "Toi & consentements" : step === 2 ? "Ton équipe" : "Ta carte"}
            </h1>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {[1, 2, 3].map((s) => (
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
            firstName={firstName} setFirstName={setFirstName}
            lastName={lastName} setLastName={setLastName}
            phone={phone} setPhone={setPhone}
            parentFirstName={parentFirstName} setParentFirstName={setParentFirstName}
            parentLastName={parentLastName} setParentLastName={setParentLastName}
            parentEmail={parentEmail} setParentEmail={setParentEmail}
            parentPhone={parentPhone} setParentPhone={setParentPhone}
            parentRelationship={parentRelationship}
            onOpenRelation={() => setOpenRelation(true)}
            consentProfile={consentProfile} setConsentProfile={setConsentProfile}
            consentVisibility={consentVisibility} setConsentVisibility={setConsentVisibility}
            consentPartnerVisibility={consentPartnerVisibility} setConsentPartnerVisibility={setConsentPartnerVisibility}
            consentComms={consentComms} setConsentComms={setConsentComms}
          />
        )}

        {step === 2 && (
          <Step2Content
            userContext={userContext}
            primarySport={primarySport} setPrimarySport={setPrimarySport}
            selectedSchoolName={selectedSchoolName}
            onOpenSchool={() => setSchoolSheetOpen(true)}
            selectedCoachName={selectedCoachName}
            onOpenCoach={() => setCoachSheetOpen(true)}
            selectedTeamName={selectedTeamName}
            onOpenTeam={() => setTeamSheetOpen(true)}
            schoolIdSelected={!!selectedSchoolId}
          />
        )}

        {step === 3 && (
          <Step3Content
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
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={step === 1 ? !canProceedScreen1 : !canProceedScreen2}
            className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all ${
              (step === 1 ? canProceedScreen1 : canProceedScreen2)
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

      {/* MobilePickers (relation, year, position, region) */}
      <MobilePicker
        open={openRelation}
        onClose={() => setOpenRelation(false)}
        title="Lien de parenté"
        options={RELATION_OPTIONS}
        value={parentRelationship || null}
        onChange={(v) => setParentRelationship(v ? String(v) : "")}
      />
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
          // Reset coach si école change
          setSelectedCoachId(null);
          setSelectedCoachName("");
          setCoaches([]);
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

      <SearchSheet<CoachRow>
        open={coachSheetOpen}
        onClose={() => setCoachSheetOpen(false)}
        title="Mon coach"
        searchPlaceholder="Rechercher mon coach…"
        searchValue={coachSearch}
        onSearchChange={setCoachSearch}
        items={visibleCoaches}
        loading={coachesLoading}
        keyOf={(c) => c.id}
        onSelect={(c) => {
          setSelectedCoachId(c.id);
          setSelectedCoachName(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim());
        }}
        emptyContent={
          <p className="text-center text-[14px] text-white/55 py-12 px-4">
            Aucun coach trouvé pour cette école. Tu pourras associer un coach plus tard depuis ton profil.
          </p>
        }
        renderItem={(c, onTap) => (
          <button
            type="button"
            onClick={onTap}
            className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors"
          >
            <p className="text-[16px] font-semibold text-white truncate">
              {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
            </p>
            {c.school_name && (
              <p className="text-[13px] text-white/55 truncate">{c.school_name}</p>
            )}
          </button>
        )}
        footer={
          <button
            type="button"
            onClick={() => {
              setSelectedCoachId(null);
              setSelectedCoachName("");
              setCoachSheetOpen(false);
            }}
            className="w-full h-11 rounded-2xl border border-white/[0.10] text-[14px] font-semibold text-white/70 active:bg-white/[0.04]"
          >
            Continuer sans coach
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

const inputCls = "w-full bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-[#E63946]/40";
const labelCls = "block text-[12px] font-bold uppercase tracking-[0.18em] text-white/50 mb-1.5";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-head text-[15px] font-black uppercase tracking-tight text-white flex items-center gap-2 mb-3 mt-6">
      <span className="w-0.5 h-4 bg-[#E63946] rounded-full" />
      {children}
    </h2>
  );
}

function CheckboxRow({
  checked, onChange, label, required, hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        checked ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56]"
      }`}>
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </div>
      <span className="text-[14px] text-white/80 leading-snug flex-1">
        {label}{required && <span className="text-[#EF4444] ml-0.5">*</span>}
        {hint && <span className="block text-[12px] text-white/40 mt-0.5">{hint}</span>}
      </span>
    </label>
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

/* ── ÉCRAN 1 — Toi & consentements ───────────────────────────── */

interface Step1Props {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  parentFirstName: string; setParentFirstName: (v: string) => void;
  parentLastName: string; setParentLastName: (v: string) => void;
  parentEmail: string; setParentEmail: (v: string) => void;
  parentPhone: string; setParentPhone: (v: string) => void;
  parentRelationship: string;
  onOpenRelation: () => void;
  consentProfile: boolean; setConsentProfile: (v: boolean) => void;
  consentVisibility: boolean; setConsentVisibility: (v: boolean) => void;
  consentPartnerVisibility: boolean; setConsentPartnerVisibility: (v: boolean) => void;
  consentComms: boolean; setConsentComms: (v: boolean) => void;
}

function Step1Content(p: Step1Props) {
  return (
    <div className="px-4 pt-4 space-y-1">
      <SectionTitle>Toi</SectionTitle>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Prénom <span className="text-[#E63946]">*</span></label>
          <input
            type="text" value={p.firstName} onChange={(e) => p.setFirstName(e.target.value)}
            placeholder="Ton prénom" autoComplete="given-name" className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nom <span className="text-[#E63946]">*</span></label>
          <input
            type="text" value={p.lastName} onChange={(e) => p.setLastName(e.target.value)}
            placeholder="Ton nom" autoComplete="family-name" className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Téléphone</label>
          <input
            type="tel" inputMode="tel" value={p.phone} onChange={(e) => p.setPhone(e.target.value)}
            placeholder="(514) 555-0123" autoComplete="tel" className={inputCls}
          />
        </div>
      </div>

      <SectionTitle>Parent ou tuteur</SectionTitle>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Prénom du parent <span className="text-[#E63946]">*</span></label>
          <input
            type="text" value={p.parentFirstName} onChange={(e) => p.setParentFirstName(e.target.value)}
            placeholder="Prénom" className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nom du parent <span className="text-[#E63946]">*</span></label>
          <input
            type="text" value={p.parentLastName} onChange={(e) => p.setParentLastName(e.target.value)}
            placeholder="Nom" className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Courriel du parent <span className="text-[#E63946]">*</span></label>
          <input
            type="email" inputMode="email" autoCapitalize="off" autoCorrect="off"
            value={p.parentEmail} onChange={(e) => p.setParentEmail(e.target.value)}
            placeholder="parent@exemple.ca" className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Téléphone du parent</label>
          <input
            type="tel" inputMode="tel" value={p.parentPhone} onChange={(e) => p.setParentPhone(e.target.value)}
            placeholder="(514) 555-0123" className={inputCls}
          />
        </div>
        <PickerRow
          label="Lien de parenté"
          value={p.parentRelationship}
          placeholder="Sélectionner…"
          onTap={p.onOpenRelation}
        />
      </div>

      <SectionTitle>Consentement parental</SectionTitle>
      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
        <CheckboxRow
          checked={p.consentProfile} onChange={p.setConsentProfile}
          required
          label="Je confirme que mon parent ou tuteur légal autorise la création de mon profil athlète sur Nexus."
        />
        <CheckboxRow
          checked={p.consentVisibility} onChange={p.setConsentVisibility}
          required
          label="Mon parent ou tuteur légal consent à ce que mes informations sportives et académiques soient visibles par les recruteurs des CÉGEP."
        />
        <CheckboxRow
          checked={p.consentComms} onChange={p.setConsentComms}
          label="Mon parent ou tuteur accepte de recevoir des communications de Nexus concernant mon recrutement."
          hint="(optionnel)"
        />
      </div>

      {/* PartnerVisibility (Loi 25 — réutiliser tel quel, copy v1 flaggée counsel) */}
      <PartnerVisibilityConsentCard
        audience="athlete"
        checked={p.consentPartnerVisibility}
        onChange={p.setConsentPartnerVisibility}
      />
    </div>
  );
}

/* ── ÉCRAN 2 — Ton équipe ────────────────────────────────────── */

interface Step2Props {
  userContext: "scolaire" | "ligue_civile";
  primarySport: string; setPrimarySport: (v: string) => void;
  selectedSchoolName: string;
  onOpenSchool: () => void;
  selectedCoachName: string;
  onOpenCoach: () => void;
  selectedTeamName: string;
  onOpenTeam: () => void;
  schoolIdSelected: boolean;
}

function Step2Content(p: Step2Props) {
  return (
    <div className="px-4 pt-4 space-y-1">
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

          <SectionTitle>Mon coach (optionnel)</SectionTitle>
          <PickerRow
            label="Coach"
            value={p.selectedCoachName}
            placeholder={p.schoolIdSelected ? "Sélectionner mon coach…" : "Choisis d'abord ton école"}
            onTap={() => { if (p.schoolIdSelected) p.onOpenCoach(); }}
          />
          {!p.schoolIdSelected && (
            <p className="text-[12px] text-white/40 italic px-1 mt-1">
              Tu pourras associer un coach plus tard depuis ton profil.
            </p>
          )}
        </>
      ) : (
        <>
          <SectionTitle>Mon équipe civile</SectionTitle>
          <PickerRow
            label="Équipe"
            value={p.selectedTeamName}
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

/* ── ÉCRAN 3 — Ta carte ──────────────────────────────────────── */

interface Step3Props {
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

function Step3Content(p: Step3Props) {
  return (
    <div className="px-4 pt-4 space-y-1">
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
