"use client";

import {  useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { genderLabel } from "@/lib/config/gender";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { uploadImage } from "@/lib/upload/uploadImage";
import PagesTab from "@/components/shared/pages/PagesTab";

/* ═══════════════════════════════════════════════════════════════
   Admin School Detail — inline-editable header, stats bar, 4 tabs.
═══════════════════════════════════════════════════════════════ */

type SchoolRow = Record<string, unknown>;

const TYPE_OPTS = [
  { v: "SECONDAIRE", l: "Secondaire" },
  { v: "CEGEP", l: "CÉGEP" },
  { v: "LIGUE_CIVILE", l: "Ligue civile" },
];
const RESEAU_OPTS = [
  { v: "", l: "—" },
  { v: "PUBLIC", l: "Public" },
  { v: "PRIVE", l: "Privé" },
];
const LANGUE_OPTS = [
  { v: "", l: "—" },
  { v: "FR", l: "Français" },
  { v: "EN", l: "Anglais" },
  { v: "BILINGUE", l: "Bilingue" },
];

const inputCls =
  "w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-[#E0E0E0] focus:outline-none focus:border-[#E63946]/50";
const labelCls = "text-[11px] font-bold tracking-[0.12em] uppercase text-[#9CA3AF]";
const card = "bg-[#1A1D24] border border-[#2D3748] rounded-xl";

function frRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `Il y a ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

interface CoachRow {
  id: string; // users.id (= school_coaches.coach_id, = athletes.coach_id)
  scId: string; // school_coaches.id — used for delete action ("" if legacy-only)
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: string | null;
  role: string | null; // school_coaches.role (e.g. 'DIRECTEUR')
  sport: string | null;
  // Phase 6.1.x : team membership is derived via team_coaches → teams.name
  // (multi-team supported). Replaces the legacy school_coaches.team_name field.
  teams: string[];
  athleteCount: number;
  verifiedCount: number;
  is_school_admin: boolean;
}

interface TeamRow {
  id: string;
  nom: string;
  sport_name: string | null;
  coach_name: string | null;
  created_at: string | null;
  athleteCount: number;
  division: string | null;
  age_group: string | null;
  gender: string | null;
  league: string | null;
}

interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  sport_name: string | null;
  position_label: string | null;
  annee_diplomation: number | null;
  verified: boolean;
  status: string | null;
  cote_globale: number | null;
}

interface ActivityRow {
  id: string;
  type: string;
  created_at: string;
  athlete_name: string | null;
  coach_name: string | null;
  metadata: Record<string, unknown>;
}

type Tab = "coachs" | "equipes" | "athletes" | "activite" | "pages";

export default function AdminSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [tab, setTab] = useState<Tab>("coachs");
  // Loi 25 logo gate — true only when ≥1 confirmed staff user is linked.
  const [logoAllowed, setLogoAllowed] = useState(false);

  const [stats, setStats] = useState({
    totalAthletes: 0,
    verifiedAthletes: 0,
    totalCoaches: 0,
    totalTeams: 0,
    profileViews: 0 });

  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const [regionOptions, setRegionOptions] = useState<string[]>([]);

  // ── Transfer / delete coach modals ────────────────────────────
  interface SchoolOption { id: string; name: string; type: string | null; city: string | null }
  const [allSchools, setAllSchools] = useState<SchoolOption[]>([]);
  type TransferRole = "COACH" | "RECRUTEUR";
  const [transferModal, setTransferModal] = useState<{
    coach: CoachRow;
    newSchoolId: string;
    newRole: TransferRole;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ coach: CoachRow; ackChecked: boolean } | null>(null);
  const [actionPending, setActionPending] = useState(false);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function S(key: string): string {
    const v = school ? (school as Record<string, unknown>)[key] : undefined;
    return (v as string) ?? "";
  }
  function setS(key: string, value: unknown) {
    setSchool((s) => ({ ...(s || {}), [key]: value }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: sch, error } = await supabase.from("schools").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (!sch) { setSchool(null); setLoading(false); return; }
      setSchool(sch as SchoolRow);

      // distinct regions for dropdown
      const { data: regRows } = await supabase.from("schools").select("region");
      const regs = Array.from(new Set(((regRows as { region: string | null }[] | null) || [])
        .map((r) => r.region).filter((r): r is string => !!r))).sort((a, b) => a.localeCompare(b, "fr"));
      if (!cancelled) setRegionOptions(regs);

      // Logo gate (Loi 25 — image rights). Show the school logo ONLY if ≥1
      // staff user (coach / recruteur / directeur — linked via users.school_id)
      // has completed onboarding. A half-finished signup (linked but
      // onboarding_complete = false) does NOT count — no real consent. A null
      // count (query error / RLS) → 0 → false → no logo (fail-safe).
      const { count: staffCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("school_id", id)
        .eq("onboarding_complete", true);
      if (!cancelled) setLogoAllowed((staffCount ?? 0) > 0);

      // NOTE: Transfer dropdown fetches schools on demand (see loadAllSchools()).

      // Fetch athlete ids first (needed for views + activity)
      const { data: athleteRowsRaw } = await supabase
        .from("athletes")
        .select(`
          id, first_name, last_name, photo_url, verified, status, annee_diplomation,
          coach_id, sport_id, position_id,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          evaluations!athlete_id(cote_globale, updated_at)
        `)
        .eq("school_id", id)
        .order("last_name");
      const athleteIds: string[] = ((athleteRowsRaw as { id: string }[] | null) || []).map((a) => a.id);

      const mappedAthletes: AthleteRow[] = ((athleteRowsRaw as Record<string, unknown>[] | null) || []).map((r) => {
        const sp = Array.isArray(r.sports) ? r.sports[0] : r.sports;
        const po = Array.isArray(r.positions) ? r.positions[0] : r.positions;
        const evs = Array.isArray(r.evaluations) ? r.evaluations : [];
        const bestEv = selectBestEvaluation(evs) as Record<string, unknown> | null;
        const cote = bestEv ? (bestEv.cote_globale as number | null) : null;
        return {
          id: r.id as string,
          first_name: (r.first_name as string) ?? null,
          last_name: (r.last_name as string) ?? null,
          photo_url: (r.photo_url as string) ?? null,
          sport_name: (sp as { nom?: string } | null)?.nom ?? null,
          position_label: ((po as { abreviation?: string; nom?: string } | null)?.abreviation
            || (po as { nom?: string } | null)?.nom) ?? null,
          annee_diplomation: (r.annee_diplomation as number) ?? null,
          verified: !!r.verified,
          status: (r.status as string) ?? null,
          cote_globale: cote,
        };
      });
      if (!cancelled) setAthletes(mappedAthletes);
      const verifiedAthletes = mappedAthletes.filter((a) => a.verified).length;
      const totalAthletes = mappedAthletes.length;

      // Coaches — union of 3 sources so we never miss one regardless of which
      // link is populated. Dedupe by user_id.
      //   (1) school_coaches where school_id = this school (coach_id → users.id)
      //   (2) users.role=COACH AND users.school_id = this school (legacy direct link)
      //   (3) distinct athletes.coach_id for athletes at this school (covers cases
      //       where the link tables got out of sync)
      // school_coaches has NO user_id column and NO is_school_admin column.
      // The real columns are: id, school_id, coach_id, role, sport, created_at.
      // Phase 6.1.x dropped the team_name read — team membership is now derived
      // via team_coaches → teams.name (see fetch + maps below).
      // Fetch user details in a separate query and merge client-side.
      const athleteCoachIds = Array.from(new Set(
        ((athleteRowsRaw as Record<string, unknown>[] | null) || [])
          .map((r) => r.coach_id as string | null)
          .filter((v): v is string => !!v)
      ));
      const [scRes, legacyRes] = await Promise.all([
        supabase
          .from("school_coaches")
          .select("id, school_id, coach_id, role, sport, created_at")
          .eq("school_id", id),
        supabase
          .from("users")
          .select("id, school_id, role")
          .eq("role", "COACH")
          .eq("school_id", id),
      ]);

      // Build per-coach metadata (role/sport from school_coaches, when present).
      // Phase 6.1.x : team membership patched in after team_coaches fetch below.
      type CoachMeta = { scId: string; role: string | null; sport: string | null };
      const coachMeta = new Map<string, CoachMeta>();
      for (const r of (scRes.data as Record<string, unknown>[] | null) || []) {
        const cid = r.coach_id as string | null;
        if (!cid) continue;
        if (!coachMeta.has(cid)) {
          coachMeta.set(cid, {
            scId: (r.id as string) || "",
            role: (r.role as string) ?? null,
            sport: (r.sport as string) ?? null,
          });
        }
      }
      for (const u of (legacyRes.data as Record<string, unknown>[] | null) || []) {
        const uid = u.id as string;
        if (!coachMeta.has(uid)) {
          coachMeta.set(uid, { scId: "", role: "COACH", sport: null });
        }
      }
      for (const cid of athleteCoachIds) {
        if (!coachMeta.has(cid)) {
          coachMeta.set(cid, { scId: "", role: null, sport: null });
        }
      }

      // Fetch user details for all union members — only use columns that exist
      // on public.users. is_school_admin / last_sign_in_at / avatar_url are NOT
      // guaranteed to exist and will 400 the whole query if requested.
      const allCoachIds = Array.from(coachMeta.keys());
      let userById = new Map<string, Record<string, unknown>>();
      if (allCoachIds.length > 0) {
        const { data: userRows, error: userErr } = await supabase
          .from("users")
          .select("id, first_name, last_name, email, is_school_admin, role, avatar_url, created_at")
          .in("id", allCoachIds);
        userById = new Map(((userRows as Record<string, unknown>[] | null) || []).map((u) => [u.id as string, u]));
      }

      // per-coach athlete + verified counts
      const athleteByCoach = new Map<string, { total: number; verified: number }>();
      for (const r of (athleteRowsRaw as Record<string, unknown>[] | null) || []) {
        const cid = r.coach_id as string | null;
        if (!cid) continue;
        const cur = athleteByCoach.get(cid) || { total: 0, verified: 0 };
        cur.total++;
        if (r.verified) cur.verified++;
        athleteByCoach.set(cid, cur);
      }

      const mappedCoaches: CoachRow[] = allCoachIds.map((cid) => {
        const meta = coachMeta.get(cid)!;
        const u = userById.get(cid);
        const counts = athleteByCoach.get(cid) || { total: 0, verified: 0 };
        return {
          id: cid,
          scId: meta.scId,
          first_name: (u?.first_name as string) ?? null,
          last_name: (u?.last_name as string) ?? null,
          email: (u?.email as string) ?? null,
          created_at: (u?.created_at as string) ?? null,
          role: meta.role,
          sport: meta.sport,
          // teams[] is patched in below once team_coaches is fetched
          teams: [],
          athleteCount: counts.total,
          verifiedCount: counts.verified,
          is_school_admin: Boolean(u?.is_school_admin),
        };
      });

      // Teams — use SELECT * so we accept whatever columns the table has
      // (some deployments use `name`, others `nom`). We read either below.
      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select("*, sports!sport_id(nom)")
        .eq("school_id", id);
      const teamList = (teamRows as Record<string, unknown>[] | null) || [];
      const teamIds: string[] = teamList.map((t) => t.id as string);

      // team_athletes counts
      let teamAthleteCount = new Map<string, number>();
      if (teamIds.length > 0) {
        const { data: taRows } = await supabase
          .from("team_athletes")
          .select("team_id")
          .in("team_id", teamIds);
        for (const row of (taRows as { team_id: string }[] | null) || []) {
          teamAthleteCount.set(row.team_id, (teamAthleteCount.get(row.team_id) || 0) + 1);
        }
      }

      // Phase 6.1.x — Team membership is now derived from team_coaches
      // (replaces the legacy school_coaches.team_name match-by-name). Two
      // maps are built here: teamsByCoachId (Usage B — coach → list of team
      // names) and coachByTeamId (Usage A — team → primary coach_id, with
      // head_coach preferred when multiple coaches share a team).
      const teamNameById = new Map<string, string>();
      for (const t of teamList) {
        const tname = (t.name as string) || (t.nom as string) || "";
        if (tname) teamNameById.set(t.id as string, tname);
      }

      const teamsByCoachId = new Map<string, string[]>();
      const coachByTeamId = new Map<string, { coachId: string; role: string | null }>();
      let teamCoachCoachIds: string[] = [];
      if (teamIds.length > 0) {
        const { data: tcRows, error: tcErr } = await supabase
          .from("team_coaches")
          .select("team_id, coach_id, role")
          .in("team_id", teamIds);
        for (const row of (tcRows as Record<string, unknown>[] | null) || []) {
          const tid = row.team_id as string;
          const cid = row.coach_id as string;
          const role = (row.role as string) ?? null;
          const tname = teamNameById.get(tid);
          if (tname) {
            if (!teamsByCoachId.has(cid)) teamsByCoachId.set(cid, []);
            teamsByCoachId.get(cid)!.push(tname);
          }
          const existing = coachByTeamId.get(tid);
          if (!existing || (role === "head_coach" && existing.role !== "head_coach")) {
            coachByTeamId.set(tid, { coachId: cid, role });
          }
        }
        teamsByCoachId.forEach((v) => v.sort((a, b) => a.localeCompare(b, "fr")));
        teamCoachCoachIds = Array.from(new Set(
          ((tcRows as Record<string, unknown>[] | null) || []).map((r) => r.coach_id as string)
        ));
      }

      // Extend userById with any team_coaches coach_ids missing from the
      // school_coaches union (e.g. a coach attached to a team but not yet
      // registered in school_coaches).
      const extraCoachIds = teamCoachCoachIds.filter((cid) => !userById.has(cid));
      if (extraCoachIds.length > 0) {
        const { data: extraUsers } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", extraCoachIds);
        for (const u of (extraUsers as Record<string, unknown>[] | null) || []) {
          userById.set(u.id as string, u);
        }
      }

      // Patch mappedCoaches with their teams + commit setCoaches.
      const patchedCoaches: CoachRow[] = mappedCoaches.map((c) => ({
        ...c,
        teams: teamsByCoachId.get(c.id) ?? [],
      }));
      if (!cancelled) setCoaches(patchedCoaches);

      const mappedTeams: TeamRow[] = teamList.map((t) => {
        const sp = Array.isArray(t.sports) ? t.sports[0] : t.sports;
        // Accept either `name` or `nom` (schema varies by deployment)
        const teamName = (t.name as string) || (t.nom as string) || "—";
        const tcEntry = coachByTeamId.get(t.id as string);
        const coachUser = tcEntry ? userById.get(tcEntry.coachId) : null;
        const coachName = coachUser
          ? `${(coachUser as { first_name?: string }).first_name ?? ""} ${(coachUser as { last_name?: string }).last_name ?? ""}`.trim() || null
          : null;
        return {
          id: t.id as string,
          nom: teamName,
          sport_name: (sp as { nom?: string } | null)?.nom ?? null,
          coach_name: coachName,
          created_at: (t.created_at as string) ?? null,
          athleteCount: teamAthleteCount.get(t.id as string) || 0,
          division: (t.division as string) ?? null,
          age_group: (t.age_group as string) ?? null,
          gender: (t.gender as string) ?? null,
          league: (t.league as string) ?? null,
        };
      });
      mappedTeams.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      if (!cancelled) setTeams(mappedTeams);

      // recruiter_athlete_views for this school's athletes
      let profileViews = 0;
      if (athleteIds.length > 0) {
        const { count: pv } = await supabase
          .from("recruiter_athlete_views")
          .select("*", { count: "exact", head: true })
          .in("athlete_id", athleteIds);
        profileViews = pv || 0;
      }

      if (!cancelled) {
        setStats({
          totalAthletes,
          verifiedAthletes,
          totalCoaches: mappedCoaches.length,
          totalTeams: mappedTeams.length,
          profileViews,
        });
      }

      // Activities — athletes from this school OR coaches from this school
      const coachIdsForActivity = mappedCoaches.map((c) => c.id);
      if (athleteIds.length === 0 && coachIdsForActivity.length === 0) {
        if (!cancelled) setActivities([]);
      } else {
        // Build a union: athlete_id IN (...) OR coach_id IN (...)
        const filters: string[] = [];
        if (athleteIds.length > 0) filters.push(`athlete_id.in.(${athleteIds.join(",")})`);
        if (coachIdsForActivity.length > 0) filters.push(`coach_id.in.(${coachIdsForActivity.join(",")})`);
        const { data: actRows } = await supabase
          .from("activities")
          .select("*, athletes(first_name, last_name)")
          .or(filters.join(","))
          .order("created_at", { ascending: false })
          .limit(30);
        const mappedAct: ActivityRow[] = ((actRows as Record<string, unknown>[] | null) || []).map((r) => {
          const ath = r.athletes as Record<string, unknown> | null;
          const athName = ath ? `${(ath.first_name as string) || ""} ${(ath.last_name as string) || ""}`.trim() : null;
          const cid = r.coach_id as string | null;
          const cn = cid ? (() => {
            const u = userById.get(cid);
            if (!u) return null;
            return `${(u as { first_name?: string }).first_name ?? ""} ${(u as { last_name?: string }).last_name ?? ""}`.trim() || null;
          })() : null;
          return {
            id: r.id as string,
            type: (r.type as string) || "",
            created_at: (r.created_at as string) || "",
            athlete_name: athName,
            coach_name: cn,
            metadata: (r.metadata as Record<string, unknown>) || {},
          };
        });
        if (!cancelled) setActivities(mappedAct);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase, id]);

  // Upload logo établissement (net-neuf). Bucket avatars, préfixe
  // logos/schools/ (RLS admin-write existante). preserveTransparency → PNG.
  // logo_url n'étant PAS dans le patch de handleSave, on persiste tout de
  // suite via le même pattern from("schools").update. Le gate d'affichage
  // Loi 25 (logoAllowed) n'est PAS touché — on ajoute juste la capacité.
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const res = await uploadImage(file, {
      bucket: "avatars",
      pathBase: `logos/schools/${id}`,
      preserveTransparency: true,
    });
    if (!res.ok) { notify(`Erreur logo : ${res.message}`); setUploadingLogo(false); return; }
    const supabase = createClient();
    const { error } = await supabase.from("schools").update({ logo_url: res.publicUrl }).eq("id", id);
    if (error) { notify(`Erreur sauvegarde : ${error.message}`); setUploadingLogo(false); return; }
    setS("logo_url", res.publicUrl);
    notify("Logo mis à jour");
    setUploadingLogo(false);
  }

  async function handleSave() {
    if (!school) return;
    setSaving(true);

    // Whitelist: only columns that exist on the loaded row (prevents errors for
    // optional extended fields that may not be present in the schema).
    const candidateKeys = [
      "name", "type", "city", "region", "reseau", "langue",
      "address", "adresse", "website", "site_web", "telephone", "email",
      "has_secondaire", "has_collegial",
    ];
    const patch: Record<string, unknown> = {};
    for (const k of candidateKeys) {
      if (k in school) patch[k] = (school as Record<string, unknown>)[k];
    }
    const { error } = await supabase.from("schools").update(patch).eq("id", id);
    setSaving(false);
    if (error) {
      notify(`Erreur: ${error.message}`);
      return;
    }
    notify("École enregistrée");
  }

  async function promoteToDirecteur(coach: CoachRow) {
    const name = `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() || "ce coach";

    // Only promote coaches that already have a school_coaches row. Inserting
    // new school_coaches rows trips a legacy DB trigger that reads a dropped
    // school_registry.director_id column. No schools.* column is ever touched.
    if (!coach.scId) {
      notify("Ce coach doit d'abord être ajouté à l'école (school_coaches) avant promotion.");
      return;
    }

    if (!confirm(`Promouvoir ${name} au rôle de Directeur ?`)) return;

    // 1. Demote current DIRECTEUR(s) at this school to 'COACH'.
    const demote = await supabase
      .from("school_coaches")
      .update({ role: "COACH" })
      .eq("school_id", id)
      .eq("role", "DIRECTEUR");
    if (demote.error) { notify(`Erreur: ${demote.error.message}`); return; }

    // 2. Promote the selected coach row.
    const promote = await supabase
      .from("school_coaches")
      .update({ role: "DIRECTEUR" })
      .eq("id", coach.scId);
    if (promote.error) { notify(`Erreur: ${promote.error.message}`); return; }

    setCoaches((prev) => prev.map((c) => {
      if (c.id === coach.id) return { ...c, role: "DIRECTEUR" };
      if (c.role === "DIRECTEUR") return { ...c, role: "COACH" };
      return c;
    }));
    notify(`${name} est maintenant Directeur`);
  }

  async function loadAllSchools() {
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, city, type")
      .neq("id", id)
      .order("name", { ascending: true })
      .limit(10000);
    if (error) {
      notify(`Erreur chargement écoles : ${error.message}`);
      return;
    }
    const mapped: SchoolOption[] = ((data || []) as SchoolOption[]).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type ?? null,
      city: s.city ?? null,
    }));
    setAllSchools(mapped);
  }

  async function openTransferModal(coach: CoachRow) {
    setTransferModal({ coach, newSchoolId: "", newRole: "COACH" });
    // Always refetch on open so the dropdown reflects the current DB state
    await loadAllSchools();
  }

  async function confirmTransfer() {
    if (!transferModal || !transferModal.newSchoolId) return;
    const { coach, newSchoolId, newRole } = transferModal;
    const name = `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() || "ce coach";
    const target = allSchools.find((s) => s.id === newSchoolId);
    setActionPending(true);

    // 1. Remove from current school's coach list (if scId exists)
    if (coach.scId) {
      const { error } = await supabase.from("school_coaches").delete().eq("id", coach.scId);
      if (error) { setActionPending(false); notify(`Erreur: ${error.message}`); return; }
    }

    // 2. Update the user's primary school (+ role if switching to RECRUTEUR)
    const userPatch: Record<string, unknown> = { school_id: newSchoolId };
    if (newRole === "RECRUTEUR") userPatch.role = "RECRUTEUR";
    const { error: uErr } = await supabase.from("users").update(userPatch).eq("id", coach.id);
    if (uErr) { setActionPending(false); notify(`Erreur: ${uErr.message}`); return; }

    // 3. Unlink athletes
    //    - Staying as coach: only unlink athletes at the OLD school
    //    - Becoming recruteur: unlink ALL athletes (no longer a coach)
    const unlinkQuery = supabase.from("athletes").update({ coach_id: null }).eq("coach_id", coach.id);
    const { error: aErr } = newRole === "RECRUTEUR"
      ? await unlinkQuery
      : await unlinkQuery.eq("school_id", id);
    if (aErr) { setActionPending(false); notify(`Erreur: ${aErr.message}`); return; }

    setCoaches((prev) => prev.filter((c) => c.id !== coach.id));
    setStats((s) => ({ ...s, totalCoaches: Math.max(0, s.totalCoaches - 1) }));
    setTransferModal(null);
    setActionPending(false);

    if (newRole === "RECRUTEUR") {
      notify(`${name} est maintenant recruteur au ${target?.name ?? "nouveau CÉGEP"}`);
    } else {
      notify(`${name} a été transféré à ${target?.name ?? "la nouvelle école"}`);
    }
  }

  function openDeleteModal(coach: CoachRow) {
    setDeleteModal({ coach, ackChecked: false });
  }

  async function confirmDelete() {
    if (!deleteModal || !deleteModal.ackChecked) return;
    const { coach } = deleteModal;
    const name = `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() || "ce coach";
    setActionPending(true);

    // 1. Deactivate user + clear school link
    const { error: uErr } = await supabase
      .from("users")
      .update({ status: "DESACTIVE", school_id: null })
      .eq("id", coach.id);
    if (uErr) { setActionPending(false); notify(`Erreur: ${uErr.message}`); return; }

    // 2. Unlink ALL athletes from this coach
    const { error: aErr } = await supabase
      .from("athletes")
      .update({ coach_id: null })
      .eq("coach_id", coach.id);
    if (aErr) { setActionPending(false); notify(`Erreur: ${aErr.message}`); return; }

    // 3. Remove from school_coaches (this school)
    if (coach.scId) {
      await supabase.from("school_coaches").delete().eq("id", coach.scId);
    }

    setCoaches((prev) => prev.filter((c) => c.id !== coach.id));
    setStats((s) => ({ ...s, totalCoaches: Math.max(0, s.totalCoaches - 1) }));
    setDeleteModal(null);
    setActionPending(false);
    notify(`Le compte de ${name} a été désactivé`);
  }

  async function deleteTeam(teamId: string) {
    if (!confirm("Supprimer cette équipe ? Les athlètes associés ne seront pas supprimés.")) return;
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) { notify(`Erreur: ${error.message}`); return; }
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    setStats((s) => ({ ...s, totalTeams: Math.max(0, s.totalTeams - 1) }));
    notify("Équipe supprimée");
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center text-[#6b7280]">Chargement...</div>
    );
  }
  if (!school) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Link href="/admin/schools" className="text-[13px] text-[#E63946] hover:underline">← Retour aux établissements</Link>
        <p className="mt-6 text-[#9CA3AF]">Établissement introuvable.</p>
      </div>
    );
  }

  const verifiedPct = stats.totalAthletes > 0 ? Math.round((stats.verifiedAthletes / stats.totalAthletes) * 100) : 0;

  // Phase 6.1.y : LIGUE_CIVILE establishments hide école-specific fields
  // (Réseau, Langue). Identity fields (Nom/Ville/Région/Adresse/Site web)
  // stay shared across all 3 types.
  const isCivilLigue = S("type") === "LIGUE_CIVILE";

  // iso_active is a boolean — render as Oui/Non, "—" when NULL.
  const isoActiveRaw = (school as Record<string, unknown>).iso_active;
  const isoActiveLabel = isoActiveRaw === true ? "Oui" : isoActiveRaw === false ? "Non" : "—";

  // activity grouping
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday.getTime() - 86400000);
  const startWeek = new Date(startToday.getTime() - 7 * 86400000);
  const groups: { label: string; items: ActivityRow[] }[] = [
    { label: "Aujourd'hui", items: [] },
    { label: "Hier", items: [] },
    { label: "Cette semaine", items: [] },
    { label: "Plus ancien", items: [] },
  ];
  for (const a of activities) {
    const d = new Date(a.created_at);
    if (d >= startToday) groups[0].items.push(a);
    else if (d >= startYesterday) groups[1].items.push(a);
    else if (d >= startWeek) groups[2].items.push(a);
    else groups[3].items.push(a);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
      {/* Breadcrumb + back */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/schools" className="text-[12px] text-[#9CA3AF] hover:text-[#E63946] transition-colors">
            ← Retour aux établissements
          </Link>
          <p className="text-[11px] text-[#6b7280] mt-2">
            Établissements <span className="text-[#4a4d56] mx-1">›</span> <span className="text-white">{S("name") || "Établissement"}</span>
          </p>
          <h1 className="font-head text-[28px] sm:text-[32px] font-black text-white uppercase tracking-tight mt-1">
            {S("name") || "Établissement"}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      {/* Editable header form */}
      <section className={`${card} p-6`}>
        <h2 className="font-head text-[14px] font-black text-white uppercase tracking-tight mb-4">Informations de l&apos;établissement</h2>

        {/* Logo — Loi 25 gated. Renders only when a confirmed staff user is
            linked to this school; otherwise hidden (no consent = no image). */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[#2D3748]">
          <div className="w-20 h-20 rounded-lg bg-[#111317] border border-[#2D3748] flex items-center justify-center overflow-hidden shrink-0">
            {logoAllowed && S("logo_url") ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={S("logo_url")} alt={`Logo ${S("name")}`} className="w-full h-full object-contain" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              </svg>
            )}
          </div>
          <div className="text-[12px] leading-relaxed min-w-0">
            {!S("logo_url") ? (
              <span className="text-[#6b7280]">Aucun logo importé pour cet établissement.</span>
            ) : logoAllowed ? (
              <span className="text-[#9CA3AF]">Logo affiché — au moins un utilisateur confirmé est rattaché à cet établissement.</span>
            ) : (
              <span className="text-[#F59E0B]">Logo masqué — aucun utilisateur confirmé rattaché. L&apos;affichage reste bloqué tant qu&apos;aucun consentement réel n&apos;existe (Loi 25, droits d&apos;image).</span>
            )}
          </div>
          <label className="shrink-0 ml-auto cursor-pointer px-3 py-2 rounded-lg border border-[#2D3748] text-[12px] font-bold text-[#E0E0E0] hover:border-[#E63946]/40 transition-colors whitespace-nowrap">
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} title="Importer un logo" />
            {uploadingLogo ? "Import…" : "Importer un logo"}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="space-y-1.5 block">
            <span className={labelCls}>Nom</span>
            <input type="text" value={S("name")} onChange={(e) => setS("name", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1.5 block">
            <span className={labelCls}>Type</span>
            <select value={S("type") || "SECONDAIRE"} onChange={(e) => setS("type", e.target.value)} className={inputCls}>
              {TYPE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 block">
            <span className={labelCls}>Ville</span>
            <input type="text" value={S("city")} onChange={(e) => setS("city", e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1.5 block">
            <span className={labelCls}>Région</span>
            <select value={S("region")} onChange={(e) => setS("region", e.target.value)} className={inputCls}>
              <option value="">—</option>
              {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          {!isCivilLigue && (
            <label className="space-y-1.5 block">
              <span className={labelCls}>Réseau</span>
              <select value={S("reseau")} onChange={(e) => setS("reseau", e.target.value || null)} className={inputCls}>
                {RESEAU_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
          )}
          {!isCivilLigue && (
            <label className="space-y-1.5 block">
              <span className={labelCls}>Langue</span>
              <select value={S("langue")} onChange={(e) => setS("langue", e.target.value || null)} className={inputCls}>
                {LANGUE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
          )}
          {"address" in (school as object) && (
            <label className="space-y-1.5 block md:col-span-2">
              <span className={labelCls}>Adresse</span>
              <input type="text" value={S("address")} onChange={(e) => setS("address", e.target.value)} className={inputCls} />
            </label>
          )}
          {"adresse" in (school as object) && (
            <label className="space-y-1.5 block md:col-span-2">
              <span className={labelCls}>Adresse</span>
              <input type="text" value={S("adresse")} onChange={(e) => setS("adresse", e.target.value)} className={inputCls} />
            </label>
          )}
          {"website" in (school as object) && (
            <label className="space-y-1.5 block">
              <span className={labelCls}>Site web</span>
              <input type="text" value={S("website")} onChange={(e) => setS("website", e.target.value)} className={inputCls} />
            </label>
          )}
          {"telephone" in (school as object) && (
            <label className="space-y-1.5 block">
              <span className={labelCls}>Téléphone</span>
              <input type="text" value={S("telephone")} onChange={(e) => setS("telephone", e.target.value)} className={inputCls} />
            </label>
          )}
          {"email" in (school as object) && (
            <label className="space-y-1.5 block">
              <span className={labelCls}>Courriel</span>
              <input type="text" value={S("email")} onChange={(e) => setS("email", e.target.value)} className={inputCls} />
            </label>
          )}
          {"site_web" in (school as object) && (
            <label className="space-y-1.5 block">
              <span className={labelCls}>Site web</span>
              <input type="text" value={S("site_web")} onChange={(e) => setS("site_web", e.target.value)} className={inputCls} />
            </label>
          )}
        </div>

        {/* Données importées — read-only reference fields surfaced from the
            RSEQ / open-data import (not editable from this panel). */}
        <div className="mt-6 pt-5 border-t border-[#2D3748]">
          <h3 className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#6b7280] mb-3">Données importées</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {([
              ["Code postal", S("postal_code") || "—"],
              ["Identifiant (slug)", S("slug") || "—"],
              ["ISO actif", isoActiveLabel],
              ["Nom d'équipe / mascotte", S("team_name") || "—"],
              ["ID institution RSEQ", S("rseq_institution_id") || "—"],
            ] as [string, string][]).map(([fieldLabel, value]) => (
              <div key={fieldLabel}>
                <span className={labelCls}>{fieldLabel}</span>
                <p className="text-[13px] text-[#E0E0E0] mt-1 break-all">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Athlètes", value: stats.totalAthletes.toString() },
          { label: "Vérifiés", value: `${stats.verifiedAthletes}`, sub: `${verifiedPct}%` },
          { label: "Coachs", value: stats.totalCoaches.toString() },
          { label: "Équipes", value: stats.totalTeams.toString() },
          { label: "Profils consultés", value: stats.profileViews.toString() },
        ].map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">{s.label}</p>
            <p className="text-[28px] font-head font-black text-[#E63946] leading-none mt-2">{s.value}</p>
            {s.sub && <p className="text-[11px] text-[#9CA3AF] mt-1">{s.sub} vérifiés</p>}
          </div>
        ))}
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2D3748]">
        {([
          ["coachs", "Coachs"],
          ["equipes", "Équipes"],
          ["athletes", "Athlètes"],
          ["activite", "Activité"],
          ["pages", "Pages"],
        ] as [Tab, string][]).map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 rounded-t-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${
                active
                  ? "bg-[#E63946] text-white"
                  : "text-[#9CA3AF] hover:text-white border-b-2 border-transparent"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "coachs" && (
        <section className={`${card} overflow-hidden`}>
          {coaches.length === 0 ? (
            <div className="text-center py-12 text-[#6b7280]">Aucun coach</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-[#E0E0E0]">
                <thead className="bg-[#13151a] border-b border-[#2D3748]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Nom</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Email</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Rôle</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Sport / Équipe</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Inscrit</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]"># Athlètes</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">% Vérifiés</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const directeurCount = coaches.filter((x) => x.role === "DIRECTEUR").length;
                    return coaches.map((c) => {
                      const pct = c.athleteCount > 0 ? Math.round((c.verifiedCount / c.athleteCount) * 100) : 0;
                      const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
                      const isLastDirecteur = c.role === "DIRECTEUR" && directeurCount <= 1;
                      return (
                      <tr key={c.id} className="border-b border-[#2D3748] hover:bg-[#22252D]">
                        <td className="px-4 py-3 text-white font-bold">{fullName}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{c.email || "—"}</td>
                        <td className="px-4 py-3">
                          {c.role === "DIRECTEUR" ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[#E63946] text-[11px] font-bold uppercase tracking-wider">Directeur</span>
                          ) : c.role ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full bg-white/5 border border-[#2D3748] text-[#E0E0E0] text-[11px] font-bold uppercase tracking-wider">{c.role}</span>
                          ) : <span className="text-[#4a4d56]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[#9CA3AF]">
                          {(() => {
                            const teamsStr = c.teams.length > 0 ? c.teams.join(", ") : "";
                            if (!c.sport && !teamsStr) {
                              return <span className="text-[#4a4d56]">—</span>;
                            }
                            return (
                              <span>
                                {c.sport && <span className="text-white">{c.sport}</span>}
                                {c.sport && teamsStr && <span className="text-[#4a4d56] mx-1">·</span>}
                                {teamsStr && <span>{teamsStr}</span>}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{frRelative(c.created_at)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{c.athleteCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#9CA3AF]">{pct}%</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2 justify-end">
                            {c.role !== "DIRECTEUR" && (
                              <button
                                type="button"
                                onClick={() => promoteToDirecteur(c)}
                                className="px-3 py-1.5 rounded border border-[#E63946] text-[11px] font-bold uppercase tracking-wider text-[#E63946] hover:bg-[#E63946]/10 transition-colors"
                              >
                                Promouvoir
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openTransferModal(c)}
                              disabled={isLastDirecteur}
                              title={isLastDirecteur ? "Transférez le rôle de directeur avant le transfert" : undefined}
                              className={`px-3 py-1.5 rounded border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                                isLastDirecteur
                                  ? "border-[#2D3748] text-[#4a4d56] cursor-not-allowed opacity-60"
                                  : "border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10"
                              }`}
                            >
                              Transférer
                            </button>
                            {c.is_school_admin ? (
                              <span
                                title="Compte administrateur d'école — protégé"
                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6b7280] italic"
                              >
                                Admin école
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openDeleteModal(c)}
                                disabled={isLastDirecteur}
                                title={isLastDirecteur ? "Transférez le rôle de directeur avant la suppression" : undefined}
                                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                  isLastDirecteur
                                    ? "text-[#4a4d56] cursor-not-allowed opacity-60"
                                    : "text-[#E63946]/75 hover:text-[#E63946]"
                                }`}
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "pages" && (
        <PagesTab
          schoolId={String(id)}
          schoolName={String(school?.name ?? "")}
          teams={teams.map((t) => ({
            id: t.id, nom: t.nom, sport_name: t.sport_name,
            division: t.division, gender: t.gender,
          }))}
        />
      )}

      {tab === "equipes" && (
        <section className={`${card} overflow-hidden`}>
          {teams.length === 0 ? (
            <div className="text-center py-12 text-[#6b7280]">Aucune équipe</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-[#E0E0E0]">
                <thead className="bg-[#13151a] border-b border-[#2D3748]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Équipe</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Sport</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Division</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Catégorie</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Genre</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Ligue</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id} className="border-b border-[#2D3748] hover:bg-[#22252D]">
                      <td className="px-4 py-3 text-white font-bold">{t.nom}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{t.sport_name || "—"}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{t.division || "—"}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{t.age_group || "—"}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{genderLabel(t.gender)}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{t.league || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteTeam(t.id)}
                          className="px-3 py-1.5 rounded border border-[#2D3748] text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:border-[#E63946] hover:text-[#E63946] transition-colors"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "athletes" && (
        <section className={`${card} overflow-hidden`}>
          {athletes.length === 0 ? (
            <div className="text-center py-12 text-[#6b7280]">Aucun athlète</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-[#E0E0E0]">
                <thead className="bg-[#13151a] border-b border-[#2D3748]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Athlète</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Sport</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Position</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Promotion</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Vérifié</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Cote</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((a) => {
                    const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || "—";
                    const initials = `${(a.first_name ?? "?").charAt(0)}${(a.last_name ?? "").charAt(0)}`.toUpperCase();
                    return (
                      <tr
                        key={a.id}
                        onClick={() => router.push(`/admin/athletes/${a.id}`)}
                        className="border-b border-[#2D3748] hover:bg-[#22252D] cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#13151a] border border-[#2D3748] flex items-center justify-center overflow-hidden shrink-0">
                              {a.photo_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={a.photo_url} alt={name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold text-[#9CA3AF]">{initials}</span>
                              )}
                            </div>
                            <span className="text-white font-bold">{name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{a.sport_name || "—"}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{a.position_label || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{a.annee_diplomation || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {a.verified ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#22C55E]/20">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </span>
                          ) : (
                            <span className="text-[#4a4d56]">✕</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.cote_globale != null ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[#F59E0B]">★</span>
                              <span className="tabular-nums">{a.cote_globale.toFixed(1)}</span>
                            </span>
                          ) : <span className="text-[#4a4d56]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {a.status ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-[#E0E0E0] border border-[#2D3748]">
                              {a.status}
                            </span>
                          ) : <span className="text-[#4a4d56]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "activite" && (
        <section className="space-y-5">
          {activities.length === 0 ? (
            <div className={`${card} p-8 text-center text-[#6b7280]`}>Aucune activité pour cette école</div>
          ) : (
            groups.filter((g) => g.items.length > 0).map((g) => (
              <div key={g.label}>
                <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">{g.label}</h3>
                <div className="space-y-2">
                  {g.items.map((a) => (
                    <div key={a.id} className={`${card} p-4 flex items-start gap-3`}>
                      <div className="w-8 h-8 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#E63946]">{(a.type || "?").slice(0, 2)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white">
                          <span className="font-bold">{a.type.replace(/_/g, " ")}</span>
                          {a.athlete_name && <span className="text-[#9CA3AF]"> · {a.athlete_name}</span>}
                          {a.coach_name && <span className="text-[#9CA3AF]"> · {a.coach_name}</span>}
                        </p>
                        <p className="text-[11px] text-[#6b7280] mt-1">{frRelative(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* ── Transfer modal ─────────────────────────────────── */}
      {transferModal && (() => {
        const filteredSchools = transferModal.newRole === "RECRUTEUR"
          ? allSchools.filter((s) => s.type === "CEGEP")
          : allSchools;
        const isRoleChange = transferModal.newRole === "RECRUTEUR";
        const schoolLabel = isRoleChange ? "CÉGEP d'affiliation" : "Nouvel établissement";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-[520px] bg-[#1A1D24] border border-[#2D3748] rounded-xl shadow-2xl">
              <div className="px-6 py-5 border-b border-[#2D3748]">
                <h3 className="text-[17px] font-bold text-white">
                  Transférer {`${transferModal.coach.first_name ?? ""} ${transferModal.coach.last_name ?? ""}`.trim()}
                </h3>
              </div>
              <div className="px-6 py-5 space-y-5">

                {/* Step 1 — role selection */}
                <div>
                  <p className={labelCls}>Nouveau rôle</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([
                      { value: "COACH", label: "Entraîneur" },
                      { value: "RECRUTEUR", label: "Recruteur CÉGEP" },
                    ] as { value: TransferRole; label: string }[]).map((opt) => {
                      const selected = transferModal.newRole === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setTransferModal({ ...transferModal, newRole: opt.value, newSchoolId: "" });
                          }}
                          className={`px-3 py-2.5 rounded-lg border text-[13px] font-bold uppercase tracking-wider transition-colors ${
                            selected
                              ? "border-[#E63946] bg-[#E63946]/10 text-[#E63946]"
                              : "border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2 — school selection */}
                <div>
                  <label htmlFor="transfer-school" className={labelCls}>{schoolLabel}</label>
                  <select
                    id="transfer-school"
                    value={transferModal.newSchoolId}
                    onChange={(e) => {
                      setTransferModal({ ...transferModal, newSchoolId: e.target.value });
                    }}
                    className={`${inputCls} mt-1.5`}
                  >
                    <option value="">
                      {isRoleChange ? "— Sélectionnez un CÉGEP —" : "— Sélectionnez une école —"}
                    </option>
                    {filteredSchools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.city ? ` · ${s.city}` : ""}{isRoleChange ? "" : ` — ${s.type === "CEGEP" ? "CÉGEP" : "Secondaire"}`}
                      </option>
                    ))}
                  </select>
                  {isRoleChange && (
                    <p className="text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
                      Le rôle sera changé de COACH à RECRUTEUR. L&apos;entraîneur aura accès au portail recruteur.
                    </p>
                  )}
                </div>

                {transferModal.coach.athleteCount > 0 && (
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg px-4 py-3 text-[12px] text-[#F59E0B]">
                    ⚠ {transferModal.coach.athleteCount} athlète(s) seront dissociés de cet entraîneur.
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-[#2D3748] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModal(null)}
                  className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmTransfer}
                  disabled={!transferModal.newSchoolId || actionPending}
                  className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    isRoleChange
                      ? "bg-[#E63946] text-white hover:bg-[#D42B22]"
                      : "bg-[#F59E0B] text-[#111317] hover:bg-[#FBBF24]"
                  }`}
                >
                  Confirmer le transfert
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete (deactivate) modal ──────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-[520px] bg-[#1A1D24] border border-[#E63946]/40 rounded-xl shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2D3748]">
              <h3 className="text-[17px] font-bold text-white">
                Supprimer le compte de {`${deleteModal.coach.first_name ?? ""} ${deleteModal.coach.last_name ?? ""}`.trim()} ?
              </h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-[#E63946]/10 border border-[#E63946]/40 rounded-lg px-4 py-3 text-[12px] text-[#E63946]">
                ⚠ Cette action désactivera le compte de cet entraîneur.
              </div>
              <p className="text-[13px] text-[#E0E0E0] leading-relaxed">
                L&apos;entraîneur ne pourra plus se connecter à Nexus. Ses évaluations et vérifications resteront dans le système mais ne seront plus modifiables.
              </p>
              {deleteModal.coach.athleteCount > 0 && (
                <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                  Cet entraîneur a {deleteModal.coach.athleteCount} athlète(s). Leurs profils resteront actifs mais ne seront plus liés à un entraîneur.
                </p>
              )}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteModal.ackChecked}
                  onChange={(e) => setDeleteModal({ ...deleteModal, ackChecked: e.target.checked })}
                  className="mt-0.5 accent-[#E63946]"
                />
                <span className="text-[13px] text-[#E0E0E0]">
                  Je comprends que cette action désactivera le compte.
                </span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-[#2D3748] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!deleteModal.ackChecked || actionPending}
                className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Supprimer le compte
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#E63946] rounded-lg px-5 py-3 text-[13px] text-white shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
