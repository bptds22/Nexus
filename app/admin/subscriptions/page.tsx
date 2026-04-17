"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

/* ─────────────────────────────────────────────────────────────────
   Admin Subscriptions — Wired to public.subscriptions + users.

   Design decision: AdminTable writes by row id to ONE table.
   We set `table="subscriptions"` and use the SUBSCRIPTION row id
   for users that already have a subscription (the trigger creates
   one for every new user, so coverage should be 100%). For the
   rare case where a user has none, we render an inline "Créer"
   button that inserts a default `free` row, then refreshes.
───────────────────────────────────────────────────────────────── */

const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "all_star", label: "All Star" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  COACH: "Entraîneur",
  RECRUTEUR: "Recruteur",
  ATHLETE: "Athlète",
};

interface SubRow {
  id: string;             // subscription.id if exists, else `user:<user_id>`
  has_sub: boolean;
  user_id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  status: string;
}

interface UserRecord {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface SubRecord {
  id: string;
  user_id: string;
  tier: string;
  status: string;
}

function buildRows(users: UserRecord[], subs: SubRecord[]): SubRow[] {
  const subByUser = new Map(subs.map((s) => [s.user_id, s]));
  return users.map((u) => {
    const s = subByUser.get(u.id);
    return {
      id: s?.id ?? `user:${u.id}`,
      has_sub: !!s,
      user_id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "—",
      email: u.email,
      role: u.role,
      tier: s?.tier ?? "free",
      status: s?.status ?? "—",
    };
  });
}

export default function AdminSubscriptionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    const [uRes, sRes] = await Promise.all([
      supabase.from("users").select("id,email,first_name,last_name,role").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("id,user_id,tier,status"),
    ]);
    setRows(buildRows((uRes.data || []) as UserRecord[], (sRes.data || []) as SubRecord[]));
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function createSub(user_id: string) {
    const { error } = await supabase.from("subscriptions").insert({ user_id, tier: "free", status: "active" });
    if (error) {
      showToast(`Erreur: ${error.message}`);
      return;
    }
    showToast("Abonnement créé");
    await refresh();
  }

  const filtered = useMemo(
    () => (tierFilter === "all" ? rows : rows.filter((r) => r.tier === tierFilter)),
    [rows, tierFilter],
  );

  const columns: AdminColumn<SubRow>[] = [
    {
      key: "name",
      label: "Utilisateur",
      readonly: true,
      render: (r) => <span className="text-[13px] font-bold text-white">{r.name}</span>,
    },
    {
      key: "email",
      label: "Courriel",
      readonly: true,
      render: (r) => <span className="text-[13px] text-[#9CA3AF]">{r.email}</span>,
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
      key: "tier",
      label: "Plan",
      type: "select",
      options: TIER_OPTIONS,
      readonly: false,
      render: (r) => {
        if (!r.has_sub) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                createSub(r.user_id);
              }}
              className="px-3 py-1 rounded-full border border-[#E63946]/40 text-[#E63946] text-[11px] font-bold hover:bg-[#E63946]/10 transition-colors"
            >
              + Créer
            </button>
          );
        }
        const cls =
          r.tier === "all_star"
            ? "bg-[#E63946]/15 text-[#E63946]"
            : r.tier === "pro"
            ? "bg-[#DAB65A]/15 text-[#DAB65A]"
            : "bg-[#2D3748] text-[#9CA3AF]";
        return (
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${cls}`}>
            {r.tier}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Statut",
      readonly: true,
      render: (r) => <span className="text-[12px] text-[#9CA3AF] uppercase tracking-wider">{r.status}</span>,
    },
  ];

  const selectBase =
    "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Abonnements
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          {rows.length} utilisateur{rows.length > 1 ? "s" : ""} —{" "}
          {rows.filter((r) => r.tier === "pro").length} Pro ·{" "}
          {rows.filter((r) => r.tier === "all_star").length} All Star
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          title="Plan"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Tous les plans</option>
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucun utilisateur</div>
      ) : (
        <AdminTable<SubRow>
          rows={filtered}
          columns={columns}
          table="subscriptions"
          searchFields={["name", "email"]}
          searchPlaceholder="Rechercher par nom ou courriel…"
          onSaved={(id, patch) => {
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
            if (patch.tier) showToast("Plan mis à jour");
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
