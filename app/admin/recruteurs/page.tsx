"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserCheck, AlertTriangle, AlertCircle, ShieldOff, ShieldCheck, Mail, Phone, Building2, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Admin — Recruiters awareness dashboard
   NO gating of recruiters: signup remains immediate/full-access.
   Admin uses this to review new signups and manually deactivate
   suspicious accounts.
═══════════════════════════════════════════════════════════════ */

type AccountStatus = "ACTIF" | "DESACTIVE" | "EN_ATTENTE" | "DIPLOME";

interface RecruiterRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  school_id: string | null;
  school_name: string | null;
  status: AccountStatus;
  created_at: string;
  activityCount: number;
  flagNoSchool: boolean;
  flagSuspiciousEmail: boolean;
  flagDuplicateSchool: boolean;
}

const COMMON_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "live.com",
  "videotron.ca",
  "bell.ca",
  "sympatico.ca",
]);

function isSuspiciousEmail(email: string): boolean {
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return true;
  const domain = parts[1];
  if (domain.endsWith(".ca") || domain.endsWith(".qc.ca") || domain.endsWith(".edu")) return false;
  return !COMMON_EMAIL_DOMAINS.has(domain);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function isWithinLastDays(iso: string, days: number): boolean {
  const diff = Date.now() - new Date(iso).getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

type FilterTab = "all" | "new" | "flagged";

export default function AdminRecruteursPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<RecruiterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMonthCount, setActiveMonthCount] = useState(0);
  const [tab, setTab] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);

    // 1. Fetch all recruiters + school name
    const { data: recruiters, error: rErr } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, phone, avatar_url, school_id, status, created_at, schools!school_id(name)")
      .eq("role", "RECRUTEUR")
      .order("created_at", { ascending: false });

    if (rErr) {
      console.error("[AdminRecruteurs] load error:", rErr.message);
      setLoading(false);
      return;
    }

    const recruiterIds = (recruiters || []).map((r) => r.id as string);

    // 2. Activity: messages sent
    let msgsByUser = new Map<string, number>();
    let pipeByUser = new Map<string, number>();
    if (recruiterIds.length > 0) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id")
        .in("sender_id", recruiterIds);
      (msgs || []).forEach((m) => {
        const sid = m.sender_id as string;
        msgsByUser.set(sid, (msgsByUser.get(sid) || 0) + 1);
      });

      const { data: pipes } = await supabase
        .from("pipeline")
        .select("recruiter_id")
        .in("recruiter_id", recruiterIds);
      (pipes || []).forEach((p) => {
        const rid = p.recruiter_id as string;
        pipeByUser.set(rid, (pipeByUser.get(rid) || 0) + 1);
      });
    }

    // 3. "Actifs ce mois" — distinct recruiter_ids in conversations OR pipeline since first of month
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const monthStartIso = firstOfMonth.toISOString();

    const [convsMonth, pipeMonth] = await Promise.all([
      supabase.from("conversations").select("recruiter_id").gte("created_at", monthStartIso),
      supabase.from("pipeline").select("recruiter_id").gte("updated_at", monthStartIso),
    ]);
    const activeIds = new Set<string>();
    (convsMonth.data || []).forEach((r) => activeIds.add(r.recruiter_id as string));
    (pipeMonth.data || []).forEach((r) => activeIds.add(r.recruiter_id as string));
    setActiveMonthCount(activeIds.size);

    // 4. Build rows with flags
    const schoolCount = new Map<string, number>();
    (recruiters || []).forEach((r) => {
      if (r.school_id) {
        schoolCount.set(r.school_id as string, (schoolCount.get(r.school_id as string) || 0) + 1);
      }
    });

    const built: RecruiterRow[] = (recruiters || []).map((r) => {
      const schoolRaw = (r as { schools?: unknown }).schools;
      const school = (Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw) as { name?: string } | null;
      const id = r.id as string;
      const email = (r.email as string) || "";
      const schoolId = (r.school_id as string) || null;

      return {
        id,
        email,
        first_name: (r.first_name as string) || null,
        last_name: (r.last_name as string) || null,
        phone: (r.phone as string) || null,
        avatar_url: (r.avatar_url as string) || null,
        school_id: schoolId,
        school_name: school?.name || null,
        status: (r.status as AccountStatus) || "ACTIF",
        created_at: r.created_at as string,
        activityCount: (msgsByUser.get(id) || 0) + (pipeByUser.get(id) || 0),
        flagNoSchool: !schoolId,
        flagSuspiciousEmail: isSuspiciousEmail(email),
        flagDuplicateSchool: schoolId ? (schoolCount.get(schoolId) || 0) > 1 : false,
      };
    });

    const newCount = built.filter((r) => isWithinLastDays(r.created_at, 7)).length;
    const flaggedCount = built.filter(
      (r) => r.flagNoSchool || r.flagSuspiciousEmail || r.flagDuplicateSchool
    ).length;

    setRows(built);
    setLoading(false);
  }

  async function toggleDeactivate(row: RecruiterRow) {
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
  const flaggedCount = rows.filter(
    (r) => r.flagNoSchool || r.flagSuspiciousEmail || r.flagDuplicateSchool
  ).length;

  const visibleRows = useMemo(() => {
    if (tab === "new") return rows.filter((r) => isWithinLastDays(r.created_at, 7));
    if (tab === "flagged") return rows.filter((r) => r.flagNoSchool || r.flagSuspiciousEmail || r.flagDuplicateSchool);
    return rows;
  }, [rows, tab]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-head text-[28px] font-black text-white tracking-tight uppercase">Recruteurs</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">
            Surveillance des nouvelles inscriptions — aucun blocage, révision au besoin.
          </p>
        </div>
        <div className="text-[12px] text-[#6b7280]">
          <span className="text-white font-bold tabular-nums">{totalCount}</span> recruteurs au total
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Total</p>
          <p className="font-head text-[32px] font-black text-white mt-2 tabular-nums">{totalCount}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">comptes recruteur</p>
        </div>
        <div className="bg-[#1A1D24] border border-[#F59E0B]/30 rounded-xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F59E0B]">Nouveaux (7 jours)</p>
          <p className="font-head text-[32px] font-black text-[#F59E0B] mt-2 tabular-nums">{newCount}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">à réviser</p>
        </div>
        <div className="bg-[#1A1D24] border border-[#22C55E]/30 rounded-xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#22C55E]">Actifs ce mois</p>
          <p className="font-head text-[32px] font-black text-[#22C55E] mt-2 tabular-nums">{activeMonthCount}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">avec activité pipeline ou messagerie</p>
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
                <th className="px-4 py-3 font-bold">CÉGEP</th>
                <th className="px-4 py-3 font-bold">Inscrit le</th>
                <th className="px-4 py-3 font-bold text-right">Activité</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold">Flags</th>
                <th className="w-8"><span className="sr-only">Détails</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2128]">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#6b7280]">Chargement…</td>
                </tr>
              )}
              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#6b7280]">Aucun recruteur dans cette vue.</td>
                </tr>
              )}
              {visibleRows.map((r) => {
                const isNew = isWithinLastDays(r.created_at, 7);
                const isExpanded = expandedId === r.id;
                const flags: { icon: React.ReactNode; label: string; color: string }[] = [];
                if (r.flagNoSchool) flags.push({ icon: <AlertTriangle size={13} />, label: "Aucun CÉGEP", color: "text-[#F59E0B]" });
                if (r.flagSuspiciousEmail) flags.push({ icon: <AlertTriangle size={13} />, label: "Courriel inhabituel", color: "text-[#F59E0B]" });
                if (r.flagDuplicateSchool) flags.push({ icon: <AlertCircle size={13} />, label: "Doublon possible", color: "text-[#E63946]" });

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
                          <span className="text-[#9CA3AF]">{r.school_name}</span>
                        ) : (
                          <span className="text-[#E63946] font-semibold">⚠ Aucun CÉGEP</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">{r.activityCount}</td>
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
                        <td colSpan={8} className="px-6 py-5">
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
                                {r.flagSuspiciousEmail && (
                                  <span className="text-[11px] text-[#F59E0B] font-semibold">⚠ Domaine inhabituel</span>
                                )}
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
                                  <span>{r.school_name}</span>
                                ) : (
                                  <span className="text-[#E63946]">Aucun CÉGEP associé</span>
                                )}
                                {r.flagDuplicateSchool && (
                                  <span className="text-[11px] text-[#E63946] font-semibold">⚠ Doublon possible</span>
                                )}
                              </div>
                              <p className="text-[12px] text-[#6b7280] mt-3">
                                Inscrit le {formatDate(r.created_at)} · Activité totale : <span className="text-white font-semibold">{r.activityCount}</span>
                              </p>
                              <p className="text-[12px] text-[#6b7280]">
                                Sport / division / bio : non disponibles (champs non implémentés dans le schéma actuel).
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
