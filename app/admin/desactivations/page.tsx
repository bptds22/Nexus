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
  email: string;
  role: string;
  deactivated_at: string;
  deactivated_at_fmt: string;
  reason: string;
}

interface RawUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("users")
        .select("id,email,first_name,last_name,role,updated_at")
        .eq("status", "DESACTIVE")
        .order("updated_at", { ascending: false });

      const mapped: DeactRow[] = ((data || []) as RawUser[]).map((u) => ({
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "—",
        email: u.email,
        role: u.role,
        deactivated_at: u.updated_at,
        deactivated_at_fmt: fmt(u.updated_at),
        reason: "—",
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
      showToast(`Erreur: ${error.message}`);
      return;
    }
    showToast("Utilisateur réactivé");
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
    { key: "deactivated_at_fmt", label: "Désactivé le", readonly: true },
    {
      key: "reason",
      label: "Raison",
      readonly: true,
      render: (r) => <span className="text-[12px] text-[#6b7280]">{r.reason}</span>,
    },
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
            reactivate(r.id);
          }}
          className="px-3 py-1.5 rounded-lg border border-[#E63946]/50 text-[#E63946] text-[11px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
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

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
