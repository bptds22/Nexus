"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

type UserRole =
  | "ADMIN"
  | "COACH"
  | "RECRUTEUR"
  | "DIRECTEUR_SECONDAIRE"
  | "DIRECTEUR_CEGEP"
  | "ATHLETE";

type AccountStatus = "ACTIF" | "DESACTIVE" | "EN_ATTENTE" | "DIPLOME";

interface UserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  status: AccountStatus;
  school_id: string | null;
  school_name?: string | null;
  is_school_admin: boolean | null;
  subscription_tier?: string | null;
  created_at: string;
  created_at_fmt?: string;
}

interface SchoolLookup {
  id: string;
  name: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "COACH", label: "Entraîneur" },
  { value: "RECRUTEUR", label: "Recruteur" },
  { value: "DIRECTEUR_SECONDAIRE", label: "Directeur secondaire" },
  { value: "DIRECTEUR_CEGEP", label: "Directeur CÉGEP" },
  { value: "ATHLETE", label: "Athlète" },
];

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: "ACTIF", label: "Actif" },
  { value: "DESACTIVE", label: "Désactivé" },
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "DIPLOME", label: "Diplômé" },
];

const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "allstar", label: "All Star" },
];

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminUsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [schools, setSchools] = useState<SchoolLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "COACH" as UserRole,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [uRes, sRes, subRes] = await Promise.all([
        supabase
          .from("users")
          .select("id,email,first_name,last_name,role,status,school_id,is_school_admin,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("schools").select("id,name").order("name"),
        supabase.from("subscriptions").select("user_id,tier"),
      ]);

      const schoolMap = new Map((sRes.data || []).map((s: SchoolLookup) => [s.id, s.name]));
      const subMap = new Map<string, string>(
        (subRes.data || []).map((s: { user_id: string; tier: string }) => [s.user_id, s.tier]),
      );

      const mapped: UserRow[] = (uRes.data || []).map((u: Record<string, unknown>) => ({
        id: u.id as string,
        email: (u.email as string) ?? "",
        first_name: (u.first_name as string) ?? null,
        last_name: (u.last_name as string) ?? null,
        role: u.role as UserRole,
        status: u.status as AccountStatus,
        school_id: (u.school_id as string) ?? null,
        school_name: u.school_id ? schoolMap.get(u.school_id as string) ?? null : null,
        is_school_admin: (u.is_school_admin as boolean) ?? false,
        subscription_tier: subMap.get(u.id as string) ?? "free",
        created_at: u.created_at as string,
        created_at_fmt: formatDate(u.created_at as string),
      }));

      setRows(mapped);
      setSchools((sRes.data as SchoolLookup[]) || []);
      setLoading(false);
    })();
  }, [supabase]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, roleFilter, statusFilter]);

  const columns: AdminColumn<UserRow>[] = [
    { key: "email", label: "Courriel", type: "text", width: "220px" },
    { key: "first_name", label: "Prénom", type: "text" },
    { key: "last_name", label: "Nom", type: "text" },
    {
      key: "role",
      label: "Rôle",
      type: "select",
      options: ROLE_OPTIONS,
      render: (r) => {
        const opt = ROLE_OPTIONS.find((o) => o.value === r.role);
        return (
          <span className="inline-flex px-2.5 py-1 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] text-[11px] font-bold">
            {opt?.label ?? r.role}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Statut",
      type: "select",
      options: STATUS_OPTIONS,
      render: (r) => {
        const bg =
          r.status === "ACTIF"
            ? "bg-[#22C55E]/15 text-[#22C55E]"
            : r.status === "DESACTIVE"
            ? "bg-[#E63946]/15 text-[#E63946]"
            : r.status === "EN_ATTENTE"
            ? "bg-[#EAB308]/15 text-[#EAB308]"
            : "bg-[#6b7280]/15 text-[#6b7280]";
        const label = STATUS_OPTIONS.find((o) => o.value === r.status)?.label ?? r.status;
        return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${bg}`}>{label}</span>;
      },
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
    { key: "is_school_admin", label: "Admin école", type: "boolean", align: "center" },
    {
      key: "subscription_tier",
      label: "Abonnement",
      readonly: true,
      render: (r) => {
        const tier = r.subscription_tier || "free";
        const cls =
          tier === "allstar"
            ? "bg-[#E63946]/15 text-[#E63946]"
            : tier === "pro"
            ? "bg-[#DAB65A]/15 text-[#DAB65A]"
            : "bg-[#2D3748] text-[#9CA3AF]";
        return (
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${cls}`}>
            {tier}
          </span>
        );
      },
    },
    { key: "created_at_fmt", label: "Inscrit le", type: "readonly" },
  ];

  async function handleInvite() {
    if (!inviteForm.email) return;
    const supa = createClient();
    const { error } = await supa.from("users").insert({
      id: crypto.randomUUID(),
      email: inviteForm.email,
      first_name: inviteForm.first_name || null,
      last_name: inviteForm.last_name || null,
      role: inviteForm.role,
      status: "EN_ATTENTE",
    });
    if (error) {
      setToast(`Erreur: ${error.message}`);
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setToast("Utilisateur créé");
    setTimeout(() => setToast(null), 3000);
    setShowInvite(false);
    setInviteForm({ email: "", first_name: "", last_name: "", role: "COACH" });
    // Refresh
    const { data } = await supa
      .from("users")
      .select("id,email,first_name,last_name,role,status,school_id,is_school_admin,created_at")
      .order("created_at", { ascending: false });
    if (data) {
      setRows((prev) => {
        const schoolMap = new Map(schools.map((s) => [s.id, s.name]));
        return data.map((u: Record<string, unknown>) => ({
          id: u.id as string,
          email: (u.email as string) ?? "",
          first_name: (u.first_name as string) ?? null,
          last_name: (u.last_name as string) ?? null,
          role: u.role as UserRole,
          status: u.status as AccountStatus,
          school_id: (u.school_id as string) ?? null,
          school_name: u.school_id ? schoolMap.get(u.school_id as string) ?? null : null,
          is_school_admin: (u.is_school_admin as boolean) ?? false,
          subscription_tier: prev.find((p) => p.id === u.id)?.subscription_tier ?? "free",
          created_at: u.created_at as string,
          created_at_fmt: formatDate(u.created_at as string),
        }));
      });
    }
  }

  const selectBase =
    "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Gestion des utilisateurs
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1">{rows.length} utilisateurs au total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
        >
          + Inviter un utilisateur
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          title="Rôle"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={selectBase}
        >
          <option value="all">Tous les rôles</option>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucun utilisateur</div>
      ) : (
        <AdminTable<UserRow>
          rows={filteredRows}
          columns={columns}
          table="users"
          searchFields={["first_name", "last_name", "email"]}
          searchPlaceholder="Rechercher par nom ou courriel..."
          onSaved={(id, patch) =>
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
          }
        />
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInvite(false)}
          />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[480px] shadow-2xl mx-4">
            <h2 className="font-head text-[16px] font-black text-white uppercase mb-5">
              Inviter un utilisateur
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">
                  Courriel *
                </label>
                <input
                  type="email"
                  title="Courriel"
                  placeholder="courriel@exemple.ca"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className={selectBase + " w-full"}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">
                    Prénom
                  </label>
                  <input
                    type="text"
                    title="Prénom"
                    placeholder="Prénom"
                    value={inviteForm.first_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                    className={selectBase + " w-full"}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">
                    Nom
                  </label>
                  <input
                    type="text"
                    title="Nom"
                    placeholder="Nom"
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                    className={selectBase + " w-full"}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">
                  Rôle
                </label>
                <select
                  title="Rôle"
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value as UserRole })
                  }
                  className={selectBase + " w-full"}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={!inviteForm.email}
                className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40"
              >
                Créer
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
