"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

type SchoolType = "SECONDAIRE" | "CEGEP" | "LIGUE_CIVILE";
type Reseau = "PUBLIC" | "PRIVE";
type Langue = "FR" | "EN" | "BILINGUE";

interface SchoolRow {
  id: string;
  name: string;
  type: SchoolType;
  city: string | null;
  region: string | null;
  reseau: Reseau | null;
  langue: Langue | null;
  athlete_count: number;
  sport_count: number;
  team_count: number;
  coach_count: number;
  recruiter_count: number;
}

const TYPE_OPTIONS: { value: SchoolType; label: string }[] = [
  { value: "SECONDAIRE", label: "Secondaire" },
  { value: "CEGEP", label: "CÉGEP" },
  { value: "LIGUE_CIVILE", label: "Ligue civile" },
];

const RESEAU_OPTIONS: { value: Reseau; label: string }[] = [
  { value: "PUBLIC", label: "Public" },
  { value: "PRIVE", label: "Privé" },
];

const LANGUE_OPTIONS: { value: Langue; label: string }[] = [
  { value: "FR", label: "Français" },
  { value: "EN", label: "Anglais" },
  { value: "BILINGUE", label: "Bilingue" },
];

const selectBase =
  "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

type SortBy =
  | "name_asc"
  | "name_desc"
  | "athletes_desc"
  | "coaches_desc"
  | "recruiters_desc"
  | "teams_desc";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "name_asc", label: "Nom (A-Z)" },
  { value: "name_desc", label: "Nom (Z-A)" },
  { value: "athletes_desc", label: "# Athlètes (↓)" },
  { value: "coaches_desc", label: "# Coachs (↓)" },
  { value: "recruiters_desc", label: "# Recruteurs (↓)" },
  { value: "teams_desc", label: "# Équipes (↓)" },
];

export default function AdminSchoolsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | SchoolType>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [reseauFilter, setReseauFilter] = useState<"all" | Reseau>("all");
  const [langueFilter, setLangueFilter] = useState<"all" | Langue>("all");
  const [withAthletes, setWithAthletes] = useState(false);
  const [withCoaches, setWithCoaches] = useState(false);
  const [withRecruiters, setWithRecruiters] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("name_asc");
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    type: SchoolType;
    city: string;
    region: string;
    reseau: "" | Reseau;
    langue: "" | Langue;
  }>({
    name: "",
    type: "SECONDAIRE",
    city: "",
    region: "",
    reseau: "",
    langue: "",
  });

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchAll() {
    setLoading(true);
    const [schoolsRes, athletesRes, scCoachesRes, legacyCoachesRes, recruitersRes, teamsRes] = await Promise.all([
      supabase.from("schools").select("id,name,type,city,region,reseau,langue").order("name"),
      supabase.from("athletes").select("school_id"),
      supabase.from("school_coaches").select("school_id, user_id"),
      supabase.from("users").select("id, school_id, role").eq("role", "COACH"),
      supabase.from("users").select("id, school_id, role").eq("role", "RECRUTEUR"),
      supabase.from("teams").select("school_id,sport_id"),
    ]);

    const athleteCounts = new Map<string, number>();
    for (const a of (athletesRes.data || []) as { school_id: string | null }[]) {
      if (!a.school_id) continue;
      athleteCounts.set(a.school_id, (athleteCounts.get(a.school_id) || 0) + 1);
    }
    // Union school_coaches + legacy users.school_id, dedupe by (school_id, user_id)
    const coachPairs = new Set<string>();
    for (const c of (scCoachesRes.data || []) as { school_id: string | null; user_id: string | null }[]) {
      if (!c.school_id || !c.user_id) continue;
      coachPairs.add(`${c.school_id}:${c.user_id}`);
    }
    for (const u of (legacyCoachesRes.data || []) as { id: string; school_id: string | null }[]) {
      if (!u.school_id) continue;
      coachPairs.add(`${u.school_id}:${u.id}`);
    }
    const coachCounts = new Map<string, number>();
    for (const pair of coachPairs) {
      const [sid] = pair.split(":");
      coachCounts.set(sid, (coachCounts.get(sid) || 0) + 1);
    }
    const recruiterCounts = new Map<string, number>();
    for (const u of (recruitersRes.data || []) as { id: string; school_id: string | null }[]) {
      if (!u.school_id) continue;
      recruiterCounts.set(u.school_id, (recruiterCounts.get(u.school_id) || 0) + 1);
    }
    const teamCounts = new Map<string, number>();
    const sportSets = new Map<string, Set<string>>();
    for (const t of (teamsRes.data || []) as { school_id: string | null; sport_id: string | null }[]) {
      if (!t.school_id) continue;
      teamCounts.set(t.school_id, (teamCounts.get(t.school_id) || 0) + 1);
      if (t.sport_id) {
        if (!sportSets.has(t.school_id)) sportSets.set(t.school_id, new Set());
        sportSets.get(t.school_id)!.add(t.sport_id);
      }
    }

    const mapped: SchoolRow[] = ((schoolsRes.data || []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id as string,
      name: (s.name as string) ?? "",
      type: (s.type as SchoolType) ?? "SECONDAIRE",
      city: (s.city as string) ?? null,
      region: (s.region as string) ?? null,
      reseau: (s.reseau as Reseau) ?? null,
      langue: (s.langue as Langue) ?? null,
      athlete_count: athleteCounts.get(s.id as string) || 0,
      sport_count: sportSets.get(s.id as string)?.size || 0,
      team_count: teamCounts.get(s.id as string) || 0,
      coach_count: coachCounts.get(s.id as string) || 0,
      recruiter_count: recruiterCounts.get(s.id as string) || 0,
    }));
    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.region) set.add(r.region);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [rows]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (!r.city) continue;
      if (regionFilter !== "all" && r.region !== regionFilter) continue;
      set.add(r.city);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [rows, regionFilter]);

  // If the selected city no longer exists under the current region, reset it.
  useEffect(() => {
    if (cityFilter !== "all" && !cityOptions.includes(cityFilter)) setCityFilter("all");
  }, [cityOptions, cityFilter]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (regionFilter !== "all" && r.region !== regionFilter) return false;
      if (cityFilter !== "all" && r.city !== cityFilter) return false;
      if (reseauFilter !== "all" && r.reseau !== reseauFilter) return false;
      if (langueFilter !== "all" && r.langue !== langueFilter) return false;
      if (withAthletes && r.athlete_count <= 0) return false;
      if (withCoaches && r.coach_count <= 0) return false;
      if (withRecruiters && r.recruiter_count <= 0) return false;
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":      return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
        case "name_desc":     return b.name.localeCompare(a.name, "fr", { sensitivity: "base" });
        case "athletes_desc": return b.athlete_count - a.athlete_count || a.name.localeCompare(b.name, "fr");
        case "coaches_desc":  return b.coach_count - a.coach_count   || a.name.localeCompare(b.name, "fr");
        case "recruiters_desc": return b.recruiter_count - a.recruiter_count || a.name.localeCompare(b.name, "fr");
        case "teams_desc":    return b.team_count - a.team_count     || a.name.localeCompare(b.name, "fr");
      }
    });
    return sorted;
  }, [rows, typeFilter, regionFilter, cityFilter, reseauFilter, langueFilter, withAthletes, withCoaches, withRecruiters, sortBy]);

  const totalWithAthletes = useMemo(() => filtered.filter((r) => r.athlete_count > 0).length, [filtered]);
  const totalWithCoaches  = useMemo(() => filtered.filter((r) => r.coach_count > 0).length, [filtered]);
  const totalWithRecruiters = useMemo(() => filtered.filter((r) => r.recruiter_count > 0).length, [filtered]);

  const columns: AdminColumn<SchoolRow>[] = [
    {
      key: "id",
      label: "ID",
      readonly: true,
      width: "180px",
      render: (r) => <span className="text-[11px] text-[#6b7280] font-mono">{r.id.slice(0, 8)}…</span>,
    },
    {
      key: "name",
      label: "Nom",
      readonly: true,
      render: (r) => (
        <Link
          href={`/admin/schools/${r.id}`}
          className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {r.name}
        </Link>
      ),
    },
    {
      key: "type",
      label: "Type",
      readonly: true,
      width: "140px",
      render: (r) => {
        const label = TYPE_OPTIONS.find((o) => o.value === r.type)?.label ?? r.type;
        return <span className="text-[13px] text-[#E0E0E0]">{label}</span>;
      },
    },
    { key: "city", label: "Ville", readonly: true },
    { key: "region", label: "Région", readonly: true },
    {
      key: "reseau",
      label: "Réseau",
      readonly: true,
      width: "120px",
      render: (r) => {
        if (!r.reseau) return <span className="text-[#4a4d56]">—</span>;
        const label = r.reseau === "PUBLIC" ? "Public" : "Privé";
        return <span className="text-[13px] text-[#E0E0E0]">{label}</span>;
      },
    },
    {
      key: "langue",
      label: "Langue",
      readonly: true,
      width: "130px",
      render: (r) => {
        if (!r.langue) return <span className="text-[#4a4d56]">—</span>;
        const label = r.langue === "FR" ? "FR" : r.langue === "EN" ? "EN" : "Bilingue";
        return <span className="text-[13px] text-[#E0E0E0]">{label}</span>;
      },
    },
    {
      key: "athlete_count",
      label: "# Athlètes",
      readonly: true,
      align: "right",
      width: "120px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.athlete_count}</span>,
    },
    {
      key: "sport_count",
      label: "# Sports",
      readonly: true,
      align: "right",
      width: "110px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.sport_count}</span>,
    },
    {
      key: "team_count",
      label: "# Équipes",
      readonly: true,
      align: "right",
      width: "110px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.team_count}</span>,
    },
    {
      key: "coach_count",
      label: "# Coachs",
      readonly: true,
      align: "right",
      width: "120px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.coach_count}</span>,
    },
    {
      key: "recruiter_count",
      label: "# Recruteurs",
      readonly: true,
      align: "right",
      width: "130px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.recruiter_count}</span>,
    },
  ];

  async function handleAdd() {
    if (!form.name.trim()) {
      notify("Le nom est requis");
      return;
    }
    const { error } = await supabase.from("schools").insert({
      name: form.name.trim(),
      type: form.type,
      city: form.city.trim() || null,
      region: form.region.trim() || null,
      reseau: form.reseau || null,
      langue: form.langue || null,
    });
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    notify("Établissement ajouté");
    setForm({ name: "", type: "SECONDAIRE", city: "", region: "", reseau: "", langue: "" });
    setShowAdd(false);
    fetchAll();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Gestion des établissements
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1">{rows.length} établissement(s) au total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
        >
          {showAdd ? "Annuler" : "+ Ajouter un établissement"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-4">
          <h2 className="font-head text-[14px] font-black text-white uppercase">Nouvel établissement</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Nom"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={selectBase}
            />
            <select
              title="Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SchoolType }))}
              className={selectBase}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Ville"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className={selectBase}
            />
            <input
              type="text"
              placeholder="Région"
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              className={selectBase}
            />
            <select
              title="Réseau"
              value={form.reseau}
              onChange={(e) => setForm((f) => ({ ...f, reseau: e.target.value as "" | Reseau }))}
              className={selectBase}
            >
              <option value="">Réseau (opt.)</option>
              {RESEAU_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              title="Langue"
              value={form.langue}
              onChange={(e) => setForm((f) => ({ ...f, langue: e.target.value as "" | Langue }))}
              className={selectBase}
            >
              <option value="">Langue (opt.)</option>
              {LANGUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D93C3C] transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Filters — row 1: type + region + city */}
      <div className="flex flex-wrap gap-3">
        <select
          title="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | SchoolType)}
          className={selectBase}
        >
          <option value="all">Tous les types</option>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          title="Région"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Toutes les régions</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          title="Ville"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Toutes les villes</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          title="Réseau"
          value={reseauFilter}
          onChange={(e) => setReseauFilter(e.target.value as "all" | Reseau)}
          className={selectBase}
        >
          <option value="all">Tous les réseaux</option>
          {RESEAU_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          title="Langue"
          value={langueFilter}
          onChange={(e) => setLangueFilter(e.target.value as "all" | Langue)}
          className={selectBase}
        >
          <option value="all">Toutes les langues</option>
          {LANGUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Filters — row 2: toggles + sort */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={withAthletes}
            onChange={(e) => setWithAthletes(e.target.checked)}
            className="w-4 h-4 accent-[#E63946]"
          />
          <span className="text-[13px] text-[#E0E0E0]">Avec athlètes</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={withCoaches}
            onChange={(e) => setWithCoaches(e.target.checked)}
            className="w-4 h-4 accent-[#E63946]"
          />
          <span className="text-[13px] text-[#E0E0E0]">Avec coachs</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={withRecruiters}
            onChange={(e) => setWithRecruiters(e.target.checked)}
            className="w-4 h-4 accent-[#E63946]"
          />
          <span className="text-[13px] text-[#E0E0E0]">Avec recruteurs</span>
        </label>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#6b7280] uppercase tracking-wider font-bold">Trier</span>
          <select
            title="Trier"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={selectBase}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#1A1D24] border border-[#2D3748] text-[#E0E0E0]">
          <span className="font-bold tabular-nums">{filtered.length}</span>
          <span className="ml-1 text-[#9CA3AF]">établissement(s) affiché(s) sur {rows.length}</span>
        </span>
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
          <span className="font-bold tabular-nums">{totalWithAthletes}</span>
          <span className="ml-1">avec athlètes actifs</span>
        </span>
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <span className="font-bold tabular-nums">{totalWithCoaches}</span>
          <span className="ml-1">avec coachs inscrits</span>
        </span>
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
          <span className="font-bold tabular-nums">{totalWithRecruiters}</span>
          <span className="ml-1">avec recruteurs inscrits</span>
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucun établissement</div>
      ) : (
        <AdminTable<SchoolRow>
          rows={filtered}
          columns={columns}
          table="schools"
          searchFields={["name", "city", "region"]}
          searchPlaceholder="Rechercher par nom, ville, région..."
          onRowClick={(r) => router.push(`/admin/schools/${r.id}`)}
          onSaved={(id, patch) =>
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
          }
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#E63946] rounded-lg px-5 py-3 text-[13px] text-white shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
