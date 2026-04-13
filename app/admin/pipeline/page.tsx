"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

/* ─────────────────────────────────────────────────────────────────
   Admin Pipeline — Vue plateforme de tous les pipelines recruteurs.
   Source: recruiter_pipeline + athletes + users + schools.
───────────────────────────────────────────────────────────────── */

const STAGE_OPTIONS = [
  { value: "IDENTIFIE", label: "Identifié" },
  { value: "CONTACTE", label: "Contacté" },
  { value: "EN_DISCUSSION", label: "En discussion" },
  { value: "VISITE_PLANIFIEE", label: "Visite planifiée" },
  { value: "ENGAGE", label: "Engagé" },
  { value: "LETTRE_SIGNEE", label: "Lettre signée" },
];

const STAGE_COLORS: Record<string, string> = {
  IDENTIFIE: "bg-[#6b7280]/15 text-[#9CA3AF]",
  CONTACTE: "bg-[#3B82F6]/15 text-[#3B82F6]",
  EN_DISCUSSION: "bg-[#F59E0B]/15 text-[#F59E0B]",
  VISITE_PLANIFIEE: "bg-[#A855F7]/15 text-[#A855F7]",
  ENGAGE: "bg-[#3B82F6]/15 text-[#3B82F6]",
  LETTRE_SIGNEE: "bg-[#22C55E]/15 text-[#22C55E]",
};

interface PipelineRow {
  id: string;
  athlete_name: string;
  recruiter_name: string;
  stage: string;
  updated: string;
  updated_fmt: string;
  school_to_cegep: string;
}

interface RawRow {
  id: string;
  stage: string;
  updated_at: string | null;
  moved_at: string | null;
  athlete: { id: string; first_name: string | null; last_name: string | null; school_id: string | null } | null;
  recruiter: { id: string; first_name: string | null; last_name: string | null; school_id: string | null } | null;
}

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminPipelinePage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pipeRes, schoolRes] = await Promise.all([
        supabase
          .from("recruiter_pipeline")
          .select(
            `id, stage, moved_at, updated_at,
             athlete:athlete_id(id, first_name, last_name, school_id),
             recruiter:recruiter_id(id, first_name, last_name, school_id)`,
          )
          .order("updated_at", { ascending: false }),
        supabase.from("schools").select("id,name"),
      ]);

      const schoolMap = new Map<string, string>(
        (schoolRes.data || []).map((s: { id: string; name: string }) => [s.id, s.name]),
      );

      const data = (pipeRes.data || []) as unknown as RawRow[];
      const mapped: PipelineRow[] = data.map((r) => {
        const athleteName =
          [r.athlete?.first_name, r.athlete?.last_name].filter(Boolean).join(" ") || "—";
        const recruiterName =
          [r.recruiter?.first_name, r.recruiter?.last_name].filter(Boolean).join(" ") || "—";
        const aSchool = r.athlete?.school_id ? schoolMap.get(r.athlete.school_id) : null;
        const rSchool = r.recruiter?.school_id ? schoolMap.get(r.recruiter.school_id) : null;
        const school_to_cegep = aSchool && rSchool
          ? `${aSchool} → ${rSchool}`
          : aSchool
          ? `${aSchool} → —`
          : rSchool
          ? `— → ${rSchool}`
          : "—";

        return {
          id: r.id,
          athlete_name: athleteName,
          recruiter_name: recruiterName,
          stage: r.stage,
          updated: r.updated_at ?? "",
          updated_fmt: fmt(r.updated_at),
          school_to_cegep,
        };
      });

      setRows(mapped);
      setLoading(false);
    })();
  }, [supabase]);

  const filtered = useMemo(
    () => (stageFilter === "all" ? rows : rows.filter((r) => r.stage === stageFilter)),
    [rows, stageFilter],
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function bumpMovedAt(id: string) {
    const { error } = await supabase
      .from("recruiter_pipeline")
      .update({ moved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) showToast(`Erreur: ${error.message}`);
  }

  const columns: AdminColumn<PipelineRow>[] = [
    {
      key: "athlete_name",
      label: "Athlète",
      readonly: true,
      render: (r) => <span className="text-[13px] font-bold text-white">{r.athlete_name}</span>,
    },
    {
      key: "recruiter_name",
      label: "Recruteur",
      readonly: true,
      render: (r) => <span className="text-[13px] text-[#9CA3AF]">{r.recruiter_name}</span>,
    },
    {
      key: "stage",
      label: "Stage",
      type: "select",
      options: STAGE_OPTIONS,
      render: (r) => {
        const opt = STAGE_OPTIONS.find((o) => o.value === r.stage);
        const cls = STAGE_COLORS[r.stage] || "bg-[#2D3748] text-[#9CA3AF]";
        return (
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${cls}`}>
            {opt?.label ?? r.stage}
          </span>
        );
      },
    },
    { key: "updated_fmt", label: "Mis à jour", readonly: true },
    {
      key: "school_to_cegep",
      label: "École → CÉGEP",
      readonly: true,
      render: (r) => <span className="text-[13px] text-[#9CA3AF]">{r.school_to_cegep}</span>,
    },
  ];

  const selectBase =
    "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Pipeline — Vue plateforme
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          {rows.length} entrée{rows.length > 1 ? "s" : ""} de pipeline tous recruteurs confondus
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          title="Stage"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Tous les stages</option>
          {STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucune entrée de pipeline</div>
      ) : (
        <AdminTable<PipelineRow>
          rows={filtered}
          columns={columns}
          table="recruiter_pipeline"
          searchFields={["athlete_name", "recruiter_name", "school_to_cegep"]}
          searchPlaceholder="Rechercher par athlète, recruteur, école…"
          onSaved={(id, patch) => {
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
            if (patch.stage) {
              bumpMovedAt(String(id));
              showToast("Stage mis à jour");
            }
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
