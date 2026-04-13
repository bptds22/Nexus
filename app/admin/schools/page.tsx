"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

type SchoolType = "SECONDAIRE" | "CEGEP";

interface SchoolRow {
  id: string;
  name: string;
  type: SchoolType;
  city: string | null;
  region: string | null;
  athlete_count: number;
  coach_count: number;
}

const TYPE_OPTIONS: { value: SchoolType; label: string }[] = [
  { value: "SECONDAIRE", label: "Secondaire" },
  { value: "CEGEP", label: "CÉGEP" },
];

const selectBase =
  "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

export default function AdminSchoolsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | SchoolType>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ name: string; type: SchoolType; city: string; region: string }>({
    name: "",
    type: "SECONDAIRE",
    city: "",
    region: "",
  });

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchAll() {
    setLoading(true);
    const [schoolsRes, athletesRes, coachesRes] = await Promise.all([
      supabase.from("schools").select("id,name,type,city,region").order("name"),
      supabase.from("athletes").select("school_id"),
      supabase.from("users").select("school_id,role").eq("role", "COACH"),
    ]);

    const athleteCounts = new Map<string, number>();
    for (const a of (athletesRes.data || []) as { school_id: string | null }[]) {
      if (!a.school_id) continue;
      athleteCounts.set(a.school_id, (athleteCounts.get(a.school_id) || 0) + 1);
    }
    const coachCounts = new Map<string, number>();
    for (const c of (coachesRes.data || []) as { school_id: string | null }[]) {
      if (!c.school_id) continue;
      coachCounts.set(c.school_id, (coachCounts.get(c.school_id) || 0) + 1);
    }

    const mapped: SchoolRow[] = ((schoolsRes.data || []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id as string,
      name: (s.name as string) ?? "",
      type: (s.type as SchoolType) ?? "SECONDAIRE",
      city: (s.city as string) ?? null,
      region: (s.region as string) ?? null,
      athlete_count: athleteCounts.get(s.id as string) || 0,
      coach_count: coachCounts.get(s.id as string) || 0,
    }));
    setRows(mapped);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const filtered = useMemo(
    () => (typeFilter === "all" ? rows : rows.filter((r) => r.type === typeFilter)),
    [rows, typeFilter],
  );

  const columns: AdminColumn<SchoolRow>[] = [
    {
      key: "id",
      label: "ID",
      readonly: true,
      width: "180px",
      render: (r) => <span className="text-[11px] text-[#6b7280] font-mono">{r.id.slice(0, 8)}…</span>,
    },
    { key: "name", label: "Nom", type: "text" },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: TYPE_OPTIONS,
      width: "140px",
      render: (r) => {
        const cls =
          r.type === "CEGEP"
            ? "bg-[#E63946]/15 text-[#E63946]"
            : "bg-[#3B82F6]/15 text-[#3B82F6]";
        const label = TYPE_OPTIONS.find((o) => o.value === r.type)?.label ?? r.type;
        return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${cls}`}>{label}</span>;
      },
    },
    { key: "city", label: "Ville", type: "text" },
    { key: "region", label: "Région", type: "text" },
    {
      key: "athlete_count",
      label: "# Athlètes",
      readonly: true,
      align: "right",
      width: "120px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.athlete_count}</span>,
    },
    {
      key: "coach_count",
      label: "# Coachs",
      readonly: true,
      align: "right",
      width: "120px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.coach_count}</span>,
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
    });
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    notify("École ajoutée");
    setForm({ name: "", type: "SECONDAIRE", city: "", region: "" });
    setShowAdd(false);
    fetchAll();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Gestion des écoles
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1">{rows.length} école(s) au total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
        >
          {showAdd ? "Annuler" : "+ Ajouter une école"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-4">
          <h2 className="font-head text-[14px] font-black text-white uppercase">Nouvelle école</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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

      <div className="flex flex-wrap gap-3">
        <select
          title="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | SchoolType)}
          className={selectBase}
        >
          <option value="all">Tous les types</option>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucune école</div>
      ) : (
        <AdminTable<SchoolRow>
          rows={filtered}
          columns={columns}
          table="schools"
          searchFields={["name", "city", "region"]}
          searchPlaceholder="Rechercher par nom, ville, région..."
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
