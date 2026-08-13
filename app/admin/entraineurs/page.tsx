"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, AlertCircle, Building2, Mail, Phone, ShieldCheck, ShieldOff, UserCheck, Users, X } from "lucide-react";
import { embeddedSchool, schoolTypeLabel } from "@/lib/config/schoolTypes";

/* ═══════════════════════════════════════════════════════════════
   Admin — tableau de bord Entraîneurs.

   Calqué sur /admin/recruteurs, PAS sur un filtre de rôle de
   /admin/users : les colonnes viennent de trois tables (users +
   schools par jointure, school_coaches pour le rôle réel,
   team_coaches pour les équipes), ce qu'un filtre sur `users` ne
   rapporte pas.

   L'établissement passe par la JOINTURE `schools!school_id`. Un
   select complet de `schools` serait tronqué par PostgREST au-delà
   de 1000 lignes — c'est ce qui faisait afficher un tiret à des
   entraîneurs pourtant rattachés (un club civil trié en fin
   d'alphabet tombait systématiquement hors de la fenêtre).

   Les requêtes secondaires sont bornées par `.in("coach_id", …)`
   pour la même raison : aucun select de table entière ici.
═══════════════════════════════════════════════════════════════ */

type AccountStatus = "ACTIF" | "DESACTIVE" | "EN_ATTENTE" | "DIPLOME";

/**
 * Rôle réel dans l'établissement. `school_coaches.role` est la SEULE
 * source qui porte les trois états ; `users.is_school_admin` est un
 * booléen dérivé qui ne sait pas distinguer un intérim d'un titulaire.
 */
type CoachRole = "DIRECTEUR" | "DIRECTEUR_INTERIM" | "COACH";

const COACH_ROLE_LABELS: Record<CoachRole, string> = {
  DIRECTEUR: "Directeur",
  DIRECTEUR_INTERIM: "Directeur intérimaire",
  COACH: "Coach",
};

interface CoachRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  school_id: string | null;
  school_name: string | null;
  school_type: string | null;
  /** null = aucune ligne school_coaches → « Non rattaché ». */
  coach_role: CoachRole | null;
  is_school_admin: boolean;
  team_count: number;
  athlete_count: number;
  status: AccountStatus;
  created_at: string;
  flagNoSchool: boolean;
  flagNoRole: boolean;
  flagNoTeam: boolean;
}

const COACH_SELECT = "id, email, first_name, last_name, phone, avatar_url, school_id, status, is_school_admin, created_at, schools!school_id(name,type)";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function isWithinLastDays(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}

type FilterTab = "all" | "new" | "flagged";

export default function AdminEntraineursPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);

    const { data: coaches, error } = await supabase
      .from("users")
      .select(COACH_SELECT)
      .eq("role", "COACH")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[AdminEntraineurs] load error:", error.message);
      setLoading(false);
      return;
    }

    const coachIds = (coaches || []).map((c) => c.id as string);

    const roleByCoach = new Map<string, CoachRole>();
    const teamsByCoach = new Map<string, number>();
    const athletesByCoach = new Map<string, number>();

    if (coachIds.length > 0) {
      const [scRes, tcRes, athRes] = await Promise.all([
        supabase.from("school_coaches").select("coach_id, role").in("coach_id", coachIds),
        supabase.from("team_coaches").select("coach_id").in("coach_id", coachIds),
        supabase.from("athletes").select("coach_id").in("coach_id", coachIds),
      ]);

      for (const r of ((scRes.data || []) as { coach_id: string | null; role: string | null }[])) {
        if (r.coach_id && r.role) roleByCoach.set(r.coach_id, r.role as CoachRole);
      }
      for (const t of ((tcRes.data || []) as { coach_id: string | null }[])) {
        if (t.coach_id) teamsByCoach.set(t.coach_id, (teamsByCoach.get(t.coach_id) || 0) + 1);
      }
      for (const a of ((athRes.data || []) as { coach_id: string | null }[])) {
        if (a.coach_id) athletesByCoach.set(a.coach_id, (athletesByCoach.get(a.coach_id) || 0) + 1);
      }
    }

    const built: CoachRow[] = (coaches || []).map((c) => {
      const id = c.id as string;
      const joined = embeddedSchool((c as { schools?: unknown }).schools);
      const schoolId = (c.school_id as string) || null;
      const coachRole = roleByCoach.get(id) ?? null;
      const teamCount = teamsByCoach.get(id) || 0;

      return {
        id,
        email: (c.email as string) || "",
        first_name: (c.first_name as string) || null,
        last_name: (c.last_name as string) || null,
        phone: (c.phone as string) || null,
        avatar_url: (c.avatar_url as string) || null,
        school_id: schoolId,
        school_name: joined?.name ?? null,
        school_type: joined?.type ?? null,
        coach_role: coachRole,
        is_school_admin: (c.is_school_admin as boolean) ?? false,
        team_count: teamCount,
        athlete_count: athletesByCoach.get(id) || 0,
        status: (c.status as AccountStatus) || "ACTIF",
        created_at: c.created_at as string,
        flagNoSchool: !schoolId,
        flagNoRole: coachRole === null,
        flagNoTeam: teamCount === 0,
      };
    });

    setRows(built);
    setLoading(false);
  }

  async function toggleDeactivate(row: CoachRow) {
    const nextStatus: AccountStatus = row.status === "ACTIF" ? "DESACTIVE" : "ACTIF";
    const { error } = await supabase.from("users").update({ status: nextStatus }).eq("id", row.id);
    if (error) {
      setToast(`Erreur : ${error.message}`);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
    setToast(nextStatus === "DESACTIVE" ? "Compte désactivé" : "Compte réactivé");
    setTimeout(() => setToast(null), 2500);
  }

  const totalCount = rows.length;
  const newCount = rows.filter((r) => isWithinLastDays(r.created_at, 7)).length;
  const orphanCount = rows.filter((r) => r.flagNoSchool && r.flagNoRole).length;
  const flaggedCount = rows.filter((r) => r.flagNoSchool || r.flagNoRole || r.flagNoTeam).length;

  const visibleRows = useMemo(() => {
    if (tab === "new") return rows.filter((r) => isWithinLastDays(r.created_at, 7));
    if (tab === "flagged") return rows.filter((r) => r.flagNoSchool || r.flagNoRole || r.flagNoTeam);
    return rows;
  }, [rows, tab]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-head text-[28px] font-black text-white tracking-tight uppercase">Entraîneurs</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">
            Rattachement, rôle réel et équipes — un tiret ne signale plus qu&apos;un vrai orphelin.
          </p>
        </div>
        <div className="text-[12px] text-[#6b7280]">
          <span className="text-white font-bold tabular-nums">{totalCount}</span> entraîneurs au total
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Total</p>
          <p className="font-head text-[32px] font-black text-white mt-2 tabular-nums">{totalCount}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">comptes entraîneur</p>
        </div>
        <div className="bg-[#1A1D24] border border-[#F59E0B]/30 rounded-xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F59E0B]">Nouveaux (7 jours)</p>
          <p className="font-head text-[32px] font-black text-[#F59E0B] mt-2 tabular-nums">{newCount}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">à réviser</p>
        </div>
        <div className="bg-[#1A1D24] border border-[#E63946]/30 rounded-xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E63946]">Sans rattachement</p>
          <p className="font-head text-[32px] font-black text-[#E63946] mt-2 tabular-nums">{orphanCount}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">ni établissement ni ligne school_coaches</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {([
          { key: "all", label: `Tous (${totalCount})` },
          { key: "new", label: `Nouveaux 7j (${newCount})` },
          { key: "flagged", label: `Signalés (${flaggedCount})` },
        ] as { key: FilterTab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${
              tab === t.key
                ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                : "bg-[#1A1D24] text-[#6b7280] border border-[#1e2128] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.02] border-b border-[#1e2128]">
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
                <th className="px-4 py-3 font-bold">Nom</th>
                <th className="px-4 py-3 font-bold">Courriel</th>
                <th className="px-4 py-3 font-bold">Établissement</th>
                <th className="px-4 py-3 font-bold">Rôle</th>
                <th className="px-4 py-3 font-bold">Équipes</th>
                <th className="px-4 py-3 font-bold">Inscrit le</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold">Flags</th>
                <th className="w-8"><span className="sr-only">Détails</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2128]">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#6b7280]">Chargement…</td>
                </tr>
              )}
              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#6b7280]">Aucun entraîneur dans cette vue.</td>
                </tr>
              )}
              {visibleRows.map((r) => {
                const isNew = isWithinLastDays(r.created_at, 7);
                const isExpanded = expandedId === r.id;
                const flags: { icon: React.ReactNode; label: string; color: string }[] = [];
                if (r.flagNoSchool) flags.push({ icon: <AlertCircle size={13} />, label: "Aucun établissement", color: "text-[#E63946]" });
                if (r.flagNoRole) flags.push({ icon: <AlertTriangle size={13} />, label: "Aucune ligne school_coaches", color: "text-[#F59E0B]" });
                if (r.flagNoTeam) flags.push({ icon: <AlertTriangle size={13} />, label: "Aucune équipe", color: "text-[#F59E0B]" });

                return (
                  <Fragment key={r.id}>
                    <tr
                      className={`hover:bg-white/[0.03] cursor-pointer transition-colors relative ${
                        isNew ? "border-l-4 border-l-[#F59E0B]" : "border-l-4 border-l-transparent"
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#2a2d36] flex items-center justify-center shrink-0 text-[11px] font-bold text-white">
                            {(r.first_name?.[0] || "") + (r.last_name?.[0] || "") || "?"}
                          </div>
                          <span className="text-white font-medium">
                            {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#9CA3AF]">{r.email}</td>
                      <td className="px-4 py-3">
                        {r.school_name ? (
                          <span className="flex flex-col items-start leading-tight">
                            <span className="text-[#9CA3AF]">{r.school_name}</span>
                            {r.school_type && (
                              <span className="text-[11px] text-[#6b7280]">{schoolTypeLabel(r.school_type)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[#4a4d56]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.coach_role ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            r.coach_role === "DIRECTEUR"
                              ? "bg-[#E63946]/15 text-[#E63946]"
                              : r.coach_role === "DIRECTEUR_INTERIM"
                              ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                              : "bg-[#2D3748] text-[#9CA3AF]"
                          }`}>
                            {COACH_ROLE_LABELS[r.coach_role]}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#6b7280]">Non rattaché</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.team_count === 0 ? (
                          <span className="text-[11px] text-[#6b7280]">Aucune équipe</span>
                        ) : (
                          <span className="text-white font-semibold tabular-nums">{r.team_count}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          r.status === "ACTIF"
                            ? "bg-[#22C55E]/15 text-[#22C55E]"
                            : "bg-[#6b7280]/20 text-[#9CA3AF]"
                        }`}>
                          {r.status === "ACTIF" ? "Actif" : r.status === "DESACTIVE" ? "Désactivé" : r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {flags.length === 0 ? (
                          <span className="text-[#6b7280] text-[11px]">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {flags.map((f, i) => (
                              <span key={i} className={`inline-flex items-center gap-1 ${f.color}`} title={f.label}>
                                {f.icon}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-[#6b7280]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr className="bg-[#111317] border-l-4 border-l-[#E63946]/30">
                        <td colSpan={9} className="px-6 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-[120px_1fr_260px] gap-6 items-start">
                            {/* Avatar */}
                            <div className="flex lg:flex-col items-center lg:items-start gap-3">
                              {r.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.avatar_url} alt="" className="w-24 h-24 rounded-xl object-cover border border-white/10" />
                              ) : (
                                <div className="w-24 h-24 rounded-xl bg-[#2a2d36] flex items-center justify-center text-[28px] font-bold text-white">
                                  {(r.first_name?.[0] || "") + (r.last_name?.[0] || "") || "?"}
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="space-y-2 text-[13px]">
                              <div className="flex items-center gap-2 text-white/80">
                                <Mail size={14} className="text-[#6b7280]" />
                                <span>{r.email}</span>
                              </div>
                              {r.phone && (
                                <div className="flex items-center gap-2 text-white/80">
                                  <Phone size={14} className="text-[#6b7280]" />
                                  <span>{r.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-white/80">
                                <Building2 size={14} className="text-[#6b7280]" />
                                {r.school_name ? (
                                  <span>
                                    {r.school_name}
                                    {r.school_type && (
                                      <span className="text-[#6b7280]"> · {schoolTypeLabel(r.school_type)}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-[#E63946]">Aucun établissement associé</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-white/80">
                                <Users size={14} className="text-[#6b7280]" />
                                <span>
                                  {r.team_count === 0 ? "Aucune équipe coachée" : `${r.team_count} équipe${r.team_count > 1 ? "s" : ""} coachée${r.team_count > 1 ? "s" : ""}`}
                                  {" · "}
                                  {r.athlete_count === 0 ? "aucun athlète" : `${r.athlete_count} athlète${r.athlete_count > 1 ? "s" : ""}`}
                                </span>
                              </div>
                              <p className="text-[12px] text-[#6b7280] mt-3">
                                Inscrit le {formatDate(r.created_at)} · Rôle :{" "}
                                <span className="text-white font-semibold">
                                  {r.coach_role ? COACH_ROLE_LABELS[r.coach_role] : "non rattaché"}
                                </span>
                                {" "}(school_coaches)
                              </p>
                              <p className="text-[12px] text-[#6b7280]">
                                is_school_admin : <span className="text-white font-semibold">{r.is_school_admin ? "oui" : "non"}</span> — booléen dérivé
                                sur lequel l&apos;application gate l&apos;accès ; il ne distingue pas l&apos;intérim.
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDeactivate(r);
                                }}
                                className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider border transition-colors ${
                                  r.status === "ACTIF"
                                    ? "border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10"
                                    : "border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/10"
                                }`}
                              >
                                {r.status === "ACTIF" ? (<><ShieldOff size={14} /> Désactiver le compte</>) : (<><ShieldCheck size={14} /> Réactiver</>)}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId(null);
                                  setToast("Révision marquée");
                                  setTimeout(() => setToast(null), 2000);
                                }}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider border border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/10 transition-colors"
                              >
                                <ShieldCheck size={14} /> Tout semble correct
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#1e2128] rounded-lg px-4 py-3 shadow-xl flex items-center gap-3 z-50">
          <UserCheck size={16} className="text-[#22C55E]" />
          <span className="text-[13px] text-white">{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Fermer" title="Fermer" className="text-[#6b7280] hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
