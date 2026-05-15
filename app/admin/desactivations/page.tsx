"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

/* ─────────────────────────────────────────────────────────────────
   Admin Désactivations — derived from users.status='DESACTIVE'.
   No dedicated `account_deactivations` table exists; no
   `deactivation_reason` column either, so the reason column shows
   `—` for now.
───────────────────────────────────────────────────────────────── */

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  COACH: "Entraîneur",
  RECRUTEUR: "Recruteur",
  ATHLETE: "Athlète",
};

interface DeactRow {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  school_name: string | null;
  deactivated_at: string;
  deactivated_at_fmt: string;
}

interface RawUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  school_id: string | null;
  updated_at: string;
}

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminDesactivationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DeactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [confirmRow, setConfirmRow] = useState<DeactRow | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [uRes, sRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, first_name, last_name, email, role, status, updated_at, school_id")
          .eq("status", "DESACTIVE")
          .order("updated_at", { ascending: false }),
        supabase.from("schools").select("id,name"),
      ]);

      const schoolMap = new Map<string, string>(
        ((sRes.data || []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
      );

      const mapped: DeactRow[] = ((uRes.data || []) as RawUser[]).map((u) => ({
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "—",
        email: u.email,
        role: u.role,
        school_name: u.school_id ? schoolMap.get(u.school_id) ?? null : null,
        deactivated_at: u.updated_at,
        deactivated_at_fmt: fmt(u.updated_at),
      }));

      setRows(mapped);
      setLoading(false);
    })();
  }, [supabase, version]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function reactivate(id: string) {
    const { error } = await supabase.from("users").update({ status: "ACTIF" }).eq("id", id);
    if (error) {
      console.error("[AdminDeactivations] reactivate error:", error.message);
      showToast(`Erreur: ${error.message}`);
      return;
    }
    showToast("Utilisateur réactivé");
    setConfirmRow(null);
    setVersion((v) => v + 1);
  }

  const columns: AdminColumn<DeactRow>[] = [
    {
      key: "name",
      label: "Utilisateur",
      readonly: true,
      render: (r) => (
        <div>
          <p className="text-[13px] font-bold text-white">{r.name}</p>
          <p className="text-[11px] text-[#6b7280]">{r.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      label: "Rôle",
      readonly: true,
      render: (r) => (
        <span className="inline-flex px-2.5 py-1 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-[11px] font-bold">
          {ROLE_LABEL[r.role] ?? r.role}
        </span>
      ),
    },
    {
      key: "school_name",
      label: "École",
      readonly: true,
      render: (r) =>
        r.school_name ? (
          <span className="text-[13px] text-[#9CA3AF]">{r.school_name}</span>
        ) : (
          <span className="text-[#4a4d56]">—</span>
        ),
    },
    { key: "deactivated_at_fmt", label: "Désactivé le", readonly: true },
    {
      key: "id",
      label: "Action",
      readonly: true,
      align: "right",
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmRow(r);
          }}
          className="px-3 py-1.5 rounded-lg border border-[#22C55E]/50 text-[#22C55E] text-[11px] font-bold uppercase tracking-wider hover:bg-[#22C55E]/10 transition-colors"
        >
          Réactiver
        </button>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Désactivations
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          {rows.length} compte{rows.length > 1 ? "s" : ""} désactivé{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <p className="text-[14px] text-[#9CA3AF] mb-1">Aucune désactivation</p>
          <p className="text-[12px] text-[#6b7280]">
            Aucun utilisateur n&apos;est actuellement désactivé sur la plateforme.
          </p>
        </div>
      ) : (
        <AdminTable<DeactRow>
          rows={rows}
          columns={columns}
          table="users"
          searchFields={["name", "email"]}
          searchPlaceholder="Rechercher…"
        />
      )}

      {confirmRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmRow(null)}
          />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[440px] shadow-2xl mx-4">
            <h2 className="font-head text-[16px] font-black text-white uppercase mb-3">
              Réactiver le compte
            </h2>
            <p className="text-[13px] text-[#9CA3AF] mb-6">
              Réactiver le compte de {[confirmRow.first_name, confirmRow.last_name].filter(Boolean).join(" ") || confirmRow.email}?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRow(null)}
                className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => reactivate(confirmRow.id)}
                className="px-5 py-2.5 rounded-lg bg-[#22C55E] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#1EA751] transition-colors"
              >
                Réactiver
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
