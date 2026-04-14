"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   Admin School Detail — inline-editable header, stats bar, 4 tabs.
═══════════════════════════════════════════════════════════════ */

type SchoolRow = Record<string, unknown>;

const TYPE_OPTS = [
  { v: "SECONDAIRE", l: "Secondaire" },
  { v: "CEGEP", l: "CÉGEP" },
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

function frDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
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
  team_name: string | null;
  athleteCount: number;
  verifiedCount: number;
}

interface TeamRow {
  id: string;
  nom: string;
  sport_name: string | null;
  coach_name: string | null;
  created_at: string | null;
  athleteCount: number;
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

type Tab = "coachs" | "equipes" | "athletes" | "activite";

export default function AdminSchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("coachs");

  const [stats, setStats] = useState({
    totalAthletes: 0,
    verifiedAthletes: 0,
    totalCoaches: 0,
    totalTeams: 0,
    profileViews: 0,
  });

  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const [regionOptions, setRegionOptions] = useState<string[]>([]);

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
      console.log("[admin/schools] school:", sch, "error:", error);
      if (cancelled) return;
      if (!sch) { setSchool(null); setLoading(false); return; }
      setSchool(sch as SchoolRow);

      // distinct regions for dropdown
      const { data: regRows } = await supabase.from("schools").select("region");
      const regs = Array.from(new Set(((regRows as { region: string | null }[] | null) || [])
        .map((r) => r.region).filter((r): r is string => !!r))).sort((a, b) => a.localeCompare(b, "fr"));
      if (!cancelled) setRegionOptions(regs);

      // Fetch athlete ids first (needed for views + activity)
      const { data: athleteRowsRaw } = await supabase
        .from("athletes")
        .select(`
          id, first_name, last_name, photo_url, verified, status, annee_diplomation,
          coach_id, sport_id, position_id,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          evaluations!athlete_id(cote_globale)
        `)
        .eq("school_id", id)
        .order("last_name");
      console.log("[admin/schools] athletes raw:", athleteRowsRaw);
      const athleteIds: string[] = ((athleteRowsRaw as { id: string }[] | null) || []).map((a) => a.id);

      const mappedAthletes: AthleteRow[] = ((athleteRowsRaw as Record<string, unknown>[] | null) || []).map((r) => {
        const sp = Array.isArray(r.sports) ? r.sports[0] : r.sports;
        const po = Array.isArray(r.positions) ? r.positions[0] : r.positions;
        const evs = Array.isArray(r.evaluations) ? r.evaluations : [];
        const cote = evs.length > 0 ? ((evs[0] as Record<string, unknown>).cote_globale as number | null) : null;
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
      // The real columns are: id, school_id, coach_id, role, sport, team_name,
      // created_at. Fetch user details in a separate query and merge client-side.
      const athleteCoachIds = Array.from(new Set(
        ((athleteRowsRaw as Record<string, unknown>[] | null) || [])
          .map((r) => r.coach_id as string | null)
          .filter((v): v is string => !!v)
      ));
      const [scRes, legacyRes] = await Promise.all([
        supabase
          .from("school_coaches")
          .select("id, school_id, coach_id, role, sport, team_name, created_at")
          .eq("school_id", id),
        supabase
          .from("users")
          .select("id, school_id, role")
          .eq("role", "COACH")
          .eq("school_id", id),
      ]);
      console.log(
        "[admin/schools] school_coaches rows:", scRes.data, "err:", scRes.error,
        "legacy users(role=COACH,school_id=id):", legacyRes.data, "err:", legacyRes.error,
        "athleteCoachIds:", athleteCoachIds,
      );

      // Build per-coach metadata (role/sport/team_name from school_coaches, when present)
      type CoachMeta = { scId: string; role: string | null; sport: string | null; team_name: string | null };
      const coachMeta = new Map<string, CoachMeta>();
      for (const r of (scRes.data as Record<string, unknown>[] | null) || []) {
        const cid = r.coach_id as string | null;
        if (!cid) continue;
        if (!coachMeta.has(cid)) {
          coachMeta.set(cid, {
            scId: (r.id as string) || "",
            role: (r.role as string) ?? null,
            sport: (r.sport as string) ?? null,
            team_name: (r.team_name as string) ?? null,
          });
        }
      }
      for (const u of (legacyRes.data as Record<string, unknown>[] | null) || []) {
        const uid = u.id as string;
        if (!coachMeta.has(uid)) {
          coachMeta.set(uid, { scId: "", role: "COACH", sport: null, team_name: null });
        }
      }
      for (const cid of athleteCoachIds) {
        if (!coachMeta.has(cid)) {
          coachMeta.set(cid, { scId: "", role: null, sport: null, team_name: null });
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
        console.log("[admin/schools] coach users:", userRows, "err:", userErr);
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
          team_name: meta.team_name,
          athleteCount: counts.total,
          verifiedCount: counts.verified,
        };
      });
      if (!cancelled) setCoaches(mappedCoaches);

      // Teams — use SELECT * so we accept whatever columns the table has
      // (some deployments use `name`, others `nom`). We read either below.
      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select("*, sports!sport_id(nom)")
        .eq("school_id", id);
      console.log("[admin/schools] teams:", teamRows, "err:", teamErr);
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

      // Coach names for teams — teams has NO coach_id. Derive via
      // school_coaches.team_name matching teams.name, then look up user names.
      const coachNameByTeamName = new Map<string, string>();
      const scCoachIds = Array.from(new Set(
        ((scRes.data as Record<string, unknown>[] | null) || [])
          .map((r) => r.coach_id as string | null)
          .filter((v): v is string => !!v)
      ));
      const scUserById = new Map<string, { first_name?: string; last_name?: string }>();
      if (scCoachIds.length > 0) {
        const { data: scUsers, error: scUserErr } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", scCoachIds);
        console.log("[admin/schools] team-coach users:", scUsers, "err:", scUserErr);
        for (const u of (scUsers as Record<string, unknown>[] | null) || []) {
          scUserById.set(u.id as string, {
            first_name: (u.first_name as string) ?? "",
            last_name: (u.last_name as string) ?? "",
          });
        }
      }
      for (const r of (scRes.data as Record<string, unknown>[] | null) || []) {
        const tn = (r.team_name as string) || "";
        const cid = r.coach_id as string | null;
        if (!tn || !cid) continue;
        const u = scUserById.get(cid);
        if (!u) continue;
        const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
        if (full && !coachNameByTeamName.has(tn)) coachNameByTeamName.set(tn, full);
      }

      const mappedTeams: TeamRow[] = teamList.map((t) => {
        const sp = Array.isArray(t.sports) ? t.sports[0] : t.sports;
        // Accept either `name` or `nom` (schema varies by deployment)
        const teamName = (t.name as string) || (t.nom as string) || "—";
        return {
          id: t.id as string,
          nom: teamName,
          sport_name: (sp as { nom?: string } | null)?.nom ?? null,
          coach_name: coachNameByTeamName.get(teamName) ?? null,
          created_at: (t.created_at as string) ?? null,
          athleteCount: teamAthleteCount.get(t.id as string) || 0,
        };
      });
      mappedTeams.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      if (!cancelled) setTeams(mappedTeams);

      // profile_views for this school's athletes
      let profileViews = 0;
      if (athleteIds.length > 0) {
        const [{ count: pv1 }, { count: pv2 }] = await Promise.all([
          supabase.from("profile_views").select("*", { count: "exact", head: true }).in("athlete_id", athleteIds),
          supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).in("athlete_id", athleteIds),
        ]);
        profileViews = (pv1 || 0) + (pv2 || 0);
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
        console.log("[admin/schools] activities:", actRows);
        const mappedAct: ActivityRow[] = ((actRows as Record<string, unknown>[] | null) || []).map((r) => {
          const ath = r.athletes as Record<string, unknown> | null;
          const athName = ath ? `${(ath.first_name as string) || ""} ${(ath.last_name as string) || ""}`.trim() : null;
          const cid = r.coach_id as string | null;
          const cn = cid ? (() => {
            const u = scUserById.get(cid) || userById.get(cid);
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
    console.log("[admin/schools] save patch:", patch);
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
    console.log("[admin/schools] demote DIRECTEUR →", demote);
    if (demote.error) { notify(`Erreur: ${demote.error.message}`); return; }

    // 2. Promote the selected coach row.
    const promote = await supabase
      .from("school_coaches")
      .update({ role: "DIRECTEUR" })
      .eq("id", coach.scId);
    console.log("[admin/schools] promote →", promote);
    if (promote.error) { notify(`Erreur: ${promote.error.message}`); return; }

    setCoaches((prev) => prev.map((c) => {
      if (c.id === coach.id) return { ...c, role: "DIRECTEUR" };
      if (c.role === "DIRECTEUR") return { ...c, role: "COACH" };
      return c;
    }));
    notify(`${name} est maintenant Directeur`);
  }

  async function removeCoachFromSchool(coach: CoachRow) {
    const name = `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() || "ce coach";
    const schoolName = S("name") || "cette école";
    if (!confirm(`Retirer ${name} de ${schoolName} ? Cette action est irréversible.`)) return;
    // If this coach came from school_coaches, delete that row. If it came from
    // the legacy users.school_id link (no scId), null the user's school_id.
    const res = coach.scId
      ? await supabase.from("school_coaches").delete().eq("id", coach.scId)
      : await supabase.from("users").update({ school_id: null }).eq("id", coach.id);
    if (res.error) { notify(`Erreur: ${res.error.message}`); return; }
    setCoaches((prev) => prev.filter((c) => c.id !== coach.id));
    setStats((s) => ({ ...s, totalCoaches: Math.max(0, s.totalCoaches - 1) }));
    notify("Coach retiré");
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
        <Link href="/admin/schools" className="text-[13px] text-[#E63946] hover:underline">← Retour aux écoles</Link>
        <p className="mt-6 text-[#9CA3AF]">École introuvable.</p>
      </div>
    );
  }

  const verifiedPct = stats.totalAthletes > 0 ? Math.round((stats.verifiedAthletes / stats.totalAthletes) * 100) : 0;

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
            ← Retour aux écoles
          </Link>
          <p className="text-[11px] text-[#6b7280] mt-2">
            Écoles <span className="text-[#4a4d56] mx-1">›</span> <span className="text-white">{S("name") || "École"}</span>
          </p>
          <h1 className="font-head text-[28px] sm:text-[32px] font-black text-white uppercase tracking-tight mt-1">
            {S("name") || "École"}
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
        <h2 className="font-head text-[14px] font-black text-white uppercase tracking-tight mb-4">Informations de l&apos;école</h2>
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
          <label className="space-y-1.5 block">
            <span className={labelCls}>Réseau</span>
            <select value={S("reseau")} onChange={(e) => setS("reseau", e.target.value || null)} className={inputCls}>
              {RESEAU_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 block">
            <span className={labelCls}>Langue</span>
            <select value={S("langue")} onChange={(e) => setS("langue", e.target.value || null)} className={inputCls}>
              {LANGUE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </label>
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
                          {c.sport || c.team_name ? (
                            <span>
                              {c.sport && <span className="text-white">{c.sport}</span>}
                              {c.sport && c.team_name && <span className="text-[#4a4d56] mx-1">·</span>}
                              {c.team_name && <span>{c.team_name}</span>}
                            </span>
                          ) : <span className="text-[#4a4d56]">—</span>}
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
                              onClick={() => removeCoachFromSchool(c)}
                              disabled={isLastDirecteur}
                              title={isLastDirecteur ? "Transférez le rôle avant de retirer" : undefined}
                              className={`px-3 py-1.5 rounded border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                                isLastDirecteur
                                  ? "border-[#2D3748] text-[#4a4d56] cursor-not-allowed opacity-60"
                                  : "border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946] hover:text-[#E63946]"
                              }`}
                            >
                              Retirer
                            </button>
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
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Coach</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]"># Athlètes</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Créée le</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id} className="border-b border-[#2D3748] hover:bg-[#22252D]">
                      <td className="px-4 py-3 text-white font-bold">{t.nom}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{t.sport_name || "—"}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{t.coach_name || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.athleteCount}</td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{frDate(t.created_at)}</td>
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

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#E63946] rounded-lg px-5 py-3 text-[13px] text-white shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
