"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

/* ─────────────────────────────────────────────────────────────────
   Admin Moderation — Wired to public.reports.
───────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS = [
  { value: "OUVERT", label: "Ouvert" },
  { value: "EN_EXAMEN", label: "En examen" },
  { value: "RESOLU", label: "Résolu" },
  { value: "REJETE", label: "Rejeté" },
];

const TYPE_LABEL: Record<string, string> = {
  PROFIL: "Profil",
  MESSAGE: "Message",
  ABUS_CONTACT: "Abus de contact",
};

interface ModRow {
  id: string;
  reporter: string;
  type: string;
  reason: string;
  date: string;
  date_fmt: string;
  status: string;
}

interface RawReport {
  id: string;
  type: string;
  raison: string;
  status: string;
  created_at: string;
  reported_by_id: string | null;
}

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminModerationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ModRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: reports } = await supabase
        .from("reports")
        .select("id,type,raison,status,created_at,reported_by_id")
        .order("created_at", { ascending: false });

      const reporterIds = Array.from(
        new Set(((reports || []) as RawReport[]).map((r) => r.reported_by_id).filter(Boolean) as string[]),
      );

      let userMap = new Map<string, string>();
      if (reporterIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id,first_name,last_name,email")
          .in("id", reporterIds);
        userMap = new Map(
          (users || []).map((u: { id: string; first_name: string | null; last_name: string | null; email: string }) => [
            u.id,
            [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "—",
          ]),
        );
      }

      const mapped: ModRow[] = ((reports || []) as RawReport[]).map((r) => ({
        id: r.id,
        reporter: r.reported_by_id ? userMap.get(r.reported_by_id) ?? "—" : "—",
        type: r.type,
        reason: r.raison,
        date: r.created_at,
        date_fmt: fmt(r.created_at),
        status: r.status,
      }));

      setRows(mapped);
      setLoading(false);
    })();
  }, [supabase]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  const columns: AdminColumn<ModRow>[] = [
    {
      key: "reporter",
      label: "Signalé par",
      readonly: true,
      render: (r) => <span className="text-[13px] text-[#9CA3AF]">{r.reporter}</span>,
    },
    {
      key: "type",
      label: "Type",
      readonly: true,
      render: (r) => (
        <span className="inline-flex px-2.5 py-1 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-[11px] font-bold">
          {TYPE_LABEL[r.type] ?? r.type}
        </span>
      ),
    },
    { key: "reason", label: "Raison", type: "text" },
    { key: "date_fmt", label: "Date", readonly: true },
    {
      key: "status",
      label: "Statut",
      type: "select",
      options: STATUS_OPTIONS,
      render: (r) => {
        const cls =
          r.status === "OUVERT"
            ? "bg-[#E63946]/15 text-[#E63946]"
            : r.status === "EN_EXAMEN"
            ? "bg-[#F59E0B]/15 text-[#F59E0B]"
            : r.status === "RESOLU"
            ? "bg-[#22C55E]/15 text-[#22C55E]"
            : "bg-[#6b7280]/15 text-[#6b7280]";
        return (
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${cls}`}>
            {STATUS_OPTIONS.find((o) => o.value === r.status)?.label ?? r.status}
          </span>
        );
      },
    },
  ];

  const selectBase =
    "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Modération &amp; signalements
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          {rows.length} signalement{rows.length > 1 ? "s" : ""} au total
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          title="Statut"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Tous les statuts</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <p className="text-[14px] text-[#9CA3AF] mb-1">Aucun signalement</p>
          <p className="text-[12px] text-[#6b7280]">
            La table <code className="text-[#E63946]">reports</code> est prête mais vide.
          </p>
        </div>
      ) : (
        <AdminTable<ModRow>
          rows={filtered}
          columns={columns}
          table="reports"
          searchFields={["reporter", "reason", "type"]}
          searchPlaceholder="Rechercher…"
          onSaved={(id, patch) =>
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
          }
        />
      )}
    </div>
  );
}
