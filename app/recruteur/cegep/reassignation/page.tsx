"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getStatusConfig } from "@/lib/config/recruitmentStatuses";
import FeatureGate from "@/components/subscription/FeatureGate";
import CegepGate from "@/components/subscription/CegepGate";
import StarRating from "@/components/ui/StarRating";
import { createClient } from "@/lib/supabase/client";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import {
  fetchRecruiterAthleteCards,
  displayFullName,
  type RecruiterEvalRow,
} from "@/lib/queries/shared/recruiterAthleteCards";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";

/* ── Local types (replaces mock imports) ── */

interface ReassignRecruiter {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  sports: string[];
  status: "active" | "inactive" | "departing";
  departureDate?: string;
}

interface ReassignAthlete {
  id: string;
  full_name: string;
  recruiterId: string;
  sport: string;
  position: string;
  school: string;
  pipeline_status: RecruitmentStatus;
  days_in_status: number;
  coach_rating: number;
  is_verified: boolean;
}

interface TransferRecord {
  id: string;
  date: string;
  fromName: string;
  toName: string;
  athleteCount: number;
  sport: string;
  reason: string;
  performedBy: string;
}

function getWorkloadLevel(count: number): { label: string; color: string } {
  if (count <= 5) return { label: "Léger", color: "#22C55E" };
  if (count <= 15) return { label: "Modéré", color: "#F59E0B" };
  return { label: "Élevé", color: "#E63946" };
}

/* ═══════════════════════════════════════════════════════════════
   Réassignation des Prospects — CÉGEP Director
   Transfer athletes between recruiters without losing pipeline state.
═══════════════════════════════════════════════════════════════ */

const RED = "#E63946";

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Confirm Modal ────────────────────────────────────────────── */

function ConfirmModal({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-[modalIn_0.2s_ease-out]">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">{title}</h3>
        <div className="mt-3">{children}</div>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
          <button type="button" onClick={onConfirm} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Pipeline Status Badge ────────────────────────────────────── */

function StatusBadge({ status }: { status: RecruitmentStatus }) {
  if (status === "none") return null;
  const cfg = getStatusConfig(status);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
      style={{ backgroundColor: cfg.bgColor, borderWidth: 1, borderStyle: "solid", borderColor: cfg.borderColor, color: cfg.color }}
    >
      {cfg.shortLabel}
    </span>
  );
}

/* Stars: use shared StarRating component */

/* ── Recruiter Card ───────────────────────────────────────────── */

function RecruiterCard({
  rec,
  athleteCount,
  role,
  onClick,
}: {
  rec: ReassignRecruiter;
  athleteCount: number;
  role: "source" | "dest" | "none";
  onClick: () => void;
}) {
  const wl = getWorkloadLevel(athleteCount);
  const statusPill = rec.status === "departing"
    ? { label: `Quitte le ${new Date(rec.departureDate!).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`, color: RED }
    : rec.status === "inactive"
    ? { label: "Inactif", color: "#6B7280" }
    : { label: "Actif", color: "#22C55E" };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 w-[200px] bg-[#1A1D24] rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${
        role === "source"
          ? "border-[#E63946]/40 shadow-[0_0_20px_rgba(230,57,70,0.10)]"
          : role === "dest"
          ? "border-[#22C55E]/40 shadow-[0_0_20px_rgba(34,197,94,0.10)]"
          : "border-white/5 hover:border-[#2D3748]"
      }`}
    >
      {/* Role label */}
      {role !== "none" && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest mb-2 ${
          role === "source" ? "bg-[#E63946]/15 text-[#E63946]" : "bg-[#22C55E]/15 text-[#22C55E]"
        }`}>
          {role === "source" ? "Source" : "Destination"}
        </span>
      )}
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[#2F3440] border border-[#2D3748] flex items-center justify-center mb-3">
        <span className="text-[12px] font-bold text-white/30">{rec.initials}</span>
      </div>
      <p className="text-[14px] font-bold text-white truncate">{rec.firstName} {rec.lastName}</p>
      {/* Sports */}
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {rec.sports.map((s) => (
          <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#2D3748]/50 text-[#9CA3AF]">{s}</span>
        ))}
      </div>
      {/* Count + workload */}
      <div className="flex items-center gap-2 mt-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
        <span className="text-[13px] font-bold text-white">{athleteCount}</span>
        <span className="text-[11px] text-[#6b7280]">athlètes</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: wl.color }} />
        <span className="text-[11px] font-semibold" style={{ color: wl.color }}>{wl.label}</span>
      </div>
      {/* Status pill */}
      <div className="mt-2.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${statusPill.color}15`, color: statusPill.color }}>
          {statusPill.label}
        </span>
      </div>
    </button>
  );
}

/* ── Transfer History Table ───────────────────────────────────── */

function TransferHistory({ history }: { history: TransferRecord[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Historique des transferts</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#2D3748] overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2D3748]">
                {["Date", "De", "À", "Athlètes", "Sport", "Raison", "Par"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id} className="border-b border-[#2D3748]/40">
                  <td className="px-4 py-2.5 text-[12px] text-[#9CA3AF] whitespace-nowrap">{new Date(t.date).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-2.5 text-[12px] text-white font-semibold whitespace-nowrap">{t.fromName}</td>
                  <td className="px-4 py-2.5 text-[12px] text-white font-semibold whitespace-nowrap">{t.toName}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#9CA3AF]">{t.athleteCount}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#9CA3AF]">{t.sport}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#6b7280] italic max-w-[200px] truncate">{t.reason}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#6b7280]">{t.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Format date helper ──────────────────────────────────────── */

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tous les statuts" },
  { value: "identifie", label: "Identifié" },
  { value: "contacte", label: "Contacté" },
  { value: "en_discussion", label: "En discussion" },
  { value: "visite_planifiee", label: "Visite planifiée" },
  { value: "engage", label: "Engagé" },
  { value: "lettre_signee", label: "Lettre signée" },
];

const SPORT_FILTERS = ["", "Football", "Hockey", "Basketball", "Soccer", "Volleyball"];

export default function Page() {
  return (
    <FeatureGate feature="cegep_management" requiredTier="all_star" adminBypass={true}>
      <ReassignationWrapperContent />
    </FeatureGate>
  );
}

function ReassignationWrapperContent() {
  return <CegepGate><ReassignationPage /></CegepGate>;
}

function ReassignationPage() {
  const [athletes, setAthletes] = useState<ReassignAthlete[]>([]);
  const [recruiters, setRecruiters] = useState<ReassignRecruiter[]>([]);
  const [loading, setLoading] = useState(true);

  const [sourceId, setSourceId] = useState<string>("");
  const [destId, setDestId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sportFilter, setSportFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [notifyDest, setNotifyDest] = useState(true);
  const [notifyCoach, setNotifyCoach] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [transferActivity, setTransferActivity] = useState<string | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: currentUser } = await supabase.from("users").select("school_id, first_name, last_name").eq("id", user.id).single();
      if (!currentUser?.school_id) { setLoading(false); return; }

      // All team members
      const { data: team } = await supabase
        .from("users")
        .select("id, first_name, last_name, role, sport")
        .eq("school_id", currentUser.school_id);

      const recs: ReassignRecruiter[] = (team || []).map((t) => ({
        id: t.id,
        firstName: (t.first_name as string) || "",
        lastName: (t.last_name as string) || "",
        initials: `${((t.first_name as string) || "")[0] || ""}${((t.last_name as string) || "")[0] || ""}`.toUpperCase(),
        sports: (t.sport as string) ? [(t.sport as string)] : [],
        status: "active" as const,
      }));
      setRecruiters(recs);

      const teamIds = recs.map((r) => r.id);
      if (teamIds.length === 0) { setLoading(false); return; }

      /* TEMPS 1 — la relation possédée, sans embed `athletes` : la RPC
         projette tout ce que cette page lit (nom, vérifié, sport, position,
         école, et l'agrégat d'évaluations pour la cote). */
      const { data: pipelineData } = await supabase
        .from("recruiter_pipeline")
        .select("recruiter_id, athlete_id, stage, created_at, updated_at")
        .in("recruiter_id", teamIds);

      /* TEMPS 2 — l'identité et le reste, projetés par le serveur. */
      const cards = await fetchRecruiterAthleteCards(
        supabase,
        (pipelineData || []).map((p) => p.athlete_id as string).filter(Boolean),
      );

      const athList: ReassignAthlete[] = (pipelineData || []).map((p) => {
        const card = cards.get(p.athlete_id as string) ?? null;
        /* `coach_rating` lisait `evaluations.cote_globale`, PAS
           `cote_globale_entraineur` — deux colonnes distinctes. On garde la
           même source via l'agrégat projeté, sinon la cote affichée change
           silencieusement de sens. */
        const eObj = selectBestEvaluation(
          Array.isArray(card?.evaluations) ? (card.evaluations as RecruiterEvalRow[]) : [],
        ) as { cote_globale?: number } | null;
        const STAGE_TO_STATUS: Record<string, RecruitmentStatus> = {
          IDENTIFIE: "identifie", CONTACTE: "contacte", EN_DISCUSSION: "en_discussion",
          VISITE_PLANIFIEE: "visite_planifiee", ENGAGE: "engage", LETTRE_SIGNEE: "lettre_signee",
        };
        const daysInStatus = p.updated_at ? Math.floor((Date.now() - new Date(p.updated_at as string).getTime()) / 86400000) : 0;
        return {
          id: p.athlete_id,
          full_name: displayFullName(card),
          recruiterId: p.recruiter_id,
          sport: card?.sport_nom || "",
          position: card?.position_abbr || "",
          school: card?.school_name || "",
          pipeline_status: STAGE_TO_STATUS[p.stage as string] || ("identifie" as RecruitmentStatus),
          days_in_status: daysInStatus,
          coach_rating: (eObj?.cote_globale as number) || 0,
          is_verified: card?.verified === true,
        };
      });
      setAthletes(athList);
      setLoading(false);
    }
    load();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* Departing recruiters */
  const departingRecruiters = recruiters.filter((r) => r.status === "departing");
  const departingAthleteCount = departingRecruiters.reduce(
    (sum, r) => sum + athletes.filter((a) => a.recruiterId === r.id).length, 0
  );

  /* Athlete counts per recruiter */
  const countsByRecruiter = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of recruiters) m[r.id] = athletes.filter((a) => a.recruiterId === r.id).length;
    return m;
  }, [athletes, recruiters]);

  /* Source athletes (filtered) */
  const sourceAthletes = useMemo(() => {
    if (!sourceId) return [];
    let list = athletes.filter((a) => a.recruiterId === sourceId);
    if (sportFilter) list = list.filter((a) => a.sport === sportFilter);
    if (statusFilter) list = list.filter((a) => a.pipeline_status === statusFilter);
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.full_name.toLowerCase().includes(q));
    }
    return list;
  }, [athletes, sourceId, sportFilter, statusFilter, search]);

  /* Destination preview */
  const destAthletes = useMemo(() => {
    if (!destId) return [];
    return athletes.filter((a) => a.recruiterId === destId);
  }, [athletes, destId]);

  const selectedAthletes = useMemo(
    () => sourceAthletes.filter((a) => selected.has(a.id)),
    [sourceAthletes, selected]
  );

  /* Source/dest recruiter objects */
  const sourceRec = recruiters.find((r) => r.id === sourceId);
  const destRec = recruiters.find((r) => r.id === destId);

  /* Select handlers */
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(sourceAthletes.map((a) => a.id)));
  };

  const selectNone = () => setSelected(new Set());

  const selectBySport = (sport: string) => {
    setSelected(new Set(sourceAthletes.filter((a) => a.sport === sport).map((a) => a.id)));
  };

  /* Auto-select departing recruiter */
  const autoSelectDeparting = (recId: string) => {
    setSourceId(recId);
    setSportFilter("");
    setStatusFilter("");
    setSearch("");
    // Select all after state update
    setTimeout(() => {
      const allIds = athletes.filter((a) => a.recruiterId === recId).map((a) => a.id);
      setSelected(new Set(allIds));
    }, 0);
  };

  /* Execute transfer */
  const executeTransfer = useCallback(async () => {
    if (!sourceRec || !destRec || selected.size === 0) return;

    const supabase = createClient();
    const athleteIds = Array.from(selected);

    // Transfer pipeline entries in DB
    for (const athleteId of athleteIds) {
      await supabase
        .from("recruiter_pipeline")
        .update({ recruiter_id: destId })
        .eq("recruiter_id", sourceId)
        .eq("athlete_id", athleteId);
    }

    // Transfer favorites
    for (const athleteId of athleteIds) {
      const { data: fav } = await supabase
        .from("recruiter_favorites")
        .select("id")
        .eq("recruiter_id", sourceId)
        .eq("athlete_id", athleteId)
        .maybeSingle();
      if (fav) {
        await supabase.from("recruiter_favorites").upsert(
          { recruiter_id: destId, athlete_id: athleteId },
          { onConflict: "recruiter_id,athlete_id" }
        );
      }
    }

    // Transfer notes
    for (const athleteId of athleteIds) {
      const { data: noteRows } = await supabase
        .from("recruiter_notes")
        .select("content")
        .eq("recruiter_id", sourceId)
        .eq("athlete_id", athleteId);
      for (const n of noteRows || []) {
        await supabase.from("recruiter_notes").insert({ recruiter_id: destId, athlete_id: athleteId, content: n.content });
      }
    }

    // Move athletes in local state
    setAthletes((prev) =>
      prev.map((a) => selected.has(a.id) ? { ...a, recruiterId: destId } : a)
    );

    // Log locally
    const newRecord: TransferRecord = {
      id: `th-${Date.now()}`,
      date: new Date().toISOString(),
      fromName: `${sourceRec.firstName} ${sourceRec.lastName}`,
      toName: `${destRec.firstName} ${destRec.lastName}`,
      athleteCount: selected.size,
      sport: selectedAthletes.length > 0 ? selectedAthletes[0].sport : "Mixte",
      reason: notes || "—",
      performedBy: "Dir. sportif",
    };
    setTransferHistory((prev) => [newRecord, ...prev]);

    setTransferActivity(
      `✓ ${selected.size} athlète${selected.size > 1 ? "s" : ""} transféré${selected.size > 1 ? "s" : ""} de ${sourceRec.firstName} ${sourceRec.lastName} à ${destRec.firstName} ${destRec.lastName} le ${formatDate(new Date())}`
    );
    setTimeout(() => setTransferActivity(null), 5000);

    setSelected(new Set());
    setNotes("");
    setShowConfirm(false);
    showToast("Transfert effectué");
  }, [sourceRec, destRec, sourceId, destId, selected, selectedAthletes, notes, showToast]);

  /* Unique sports in source */
  const sourceSports = useMemo(() => {
    if (!sourceId) return [];
    const sports = new Set(athletes.filter((a) => a.recruiterId === sourceId).map((a) => a.sport));
    return Array.from(sports);
  }, [athletes, sourceId]);

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto"><p className="text-[#6b7280] text-sm">Chargement...</p></div>;
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">

      {/* ── Departing banner ─────────────────────────────────── */}
      {departingRecruiters.map((r) => (
        <div key={r.id} className="bg-[#E63946]/8 border border-[#E63946]/20 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-[13px] text-[#E63946] font-bold">
              {r.firstName} {r.lastName} quitte le CÉGEP le {new Date(r.departureDate!).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}.{" "}
              <span className="text-white">{athletes.filter((a) => a.recruiterId === r.id).length} athlètes doivent être réassignés.</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => autoSelectDeparting(r.id)}
            className="flex items-center gap-2 px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-widest rounded-lg transition-colors shrink-0"
          >
            Réassigner tout
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      ))}

      {/* ── Transfer activity banner ──────────────────────────── */}
      {transferActivity && (
        <div className="bg-[#22C55E]/8 border border-[#22C55E]/20 rounded-xl px-5 py-3 animate-[fadeInUp_0.3s_ease-out]">
          <span className="text-[13px] text-[#22C55E] font-bold">{transferActivity}</span>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Réassignation des prospects
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Transférez des athlètes d&apos;un recruteur à un autre sans perdre l&apos;historique du processus
        </p>
      </div>

      {/* ── Section 1: Recruiter cards ────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {recruiters.map((r) => (
          <RecruiterCard
            key={r.id}
            rec={r}
            athleteCount={countsByRecruiter[r.id] || 0}
            role={sourceId === r.id ? "source" : destId === r.id ? "dest" : "none"}
            onClick={() => {
              if (!sourceId || sourceId === r.id) { setSourceId(r.id); setSelected(new Set()); }
              else if (!destId && r.id !== sourceId) setDestId(r.id);
            }}
          />
        ))}
      </div>

      {/* ── Section 2: Workspace ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT — Source */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 space-y-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Transférer de</h2>

          <select
            value={sourceId}
            onChange={(e) => { setSourceId(e.target.value); setSelected(new Set()); setDestId(""); }}
            aria-label="Recruteur source"
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors"
          >
            <option value="">Sélectionner un recruteur</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>{r.firstName} {r.lastName} ({countsByRecruiter[r.id] || 0} athlètes)</option>
            ))}
          </select>

          {sourceId && (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} aria-label="Sport" className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] text-[#e0e0e0] focus:border-[#E63946] outline-none">
                  <option value="">Tous les sports</option>
                  {SPORT_FILTERS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Statut" className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] text-[#e0e0e0] focus:border-[#E63946] outline-none">
                  {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="flex-1 min-w-[120px] bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none"
                />
              </div>

              {/* Select controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={selectAll} className="text-[11px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">Tout sélectionner</button>
                <span className="text-[#2D3748]">·</span>
                <button type="button" onClick={selectNone} className="text-[11px] font-bold text-[#6b7280] hover:text-[#9CA3AF] transition-colors">Désélectionner</button>
                {sourceSports.length > 1 && sourceSports.map((s) => (
                  <span key={s}>
                    <span className="text-[#2D3748]">·</span>
                    <button type="button" onClick={() => selectBySport(s)} className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors ml-2">{s}</button>
                  </span>
                ))}
                {selected.size > 0 && (
                  <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-full bg-[#E63946]/15 text-[#E63946] text-[11px] font-bold">
                    {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Athlete list */}
              <div className="space-y-1 max-h-[420px] overflow-y-auto">
                {sourceAthletes.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-[13px] text-[#4a4d56]">Aucun athlète à transférer avec ces filtres</p>
                  </div>
                ) : (
                  sourceAthletes.map((a) => (
                    <label
                      key={a.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        selected.has(a.id) ? "bg-[#E63946]/8 border border-[#E63946]/20" : "bg-[#13151a] border border-transparent hover:border-[#2D3748]"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        selected.has(a.id) ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56]"
                      }`}>
                        {selected.has(a.id) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                        )}
                      </div>
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="sr-only" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-white truncate">{a.full_name}</span>
                          {a.is_verified && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6b7280] truncate">{a.sport} · {a.position} · {a.school}</p>
                      </div>

                      <StatusBadge status={a.pipeline_status} />
                      <span className="text-[10px] text-[#4a4d56] whitespace-nowrap hidden sm:block">{a.days_in_status}j</span>
                      <div className="hidden sm:block"><StarRating rating={a.coach_rating} size="sm" /></div>
                    </label>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT — Destination */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 space-y-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Transférer à</h2>

          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            aria-label="Recruteur destination"
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors"
          >
            <option value="">Sélectionner un recruteur</option>
            {recruiters.filter((r) => r.id !== sourceId).map((r) => (
              <option key={r.id} value={r.id}>{r.firstName} {r.lastName} ({countsByRecruiter[r.id] || 0} athlètes)</option>
            ))}
          </select>

          {destId && (
            <>
              {/* Current pipeline summary */}
              <div className="bg-[#13151a] rounded-lg border border-[#2a2d36] p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Pipeline actuel</p>
                <p className="text-[16px] font-bold text-white">{destAthletes.length} athlètes actuels</p>
                {selected.size > 0 && (
                  <p className="text-[14px] font-bold text-[#E63946]">+ {selected.size} athlète{selected.size > 1 ? "s" : ""} à transférer</p>
                )}
                <div className="border-t border-[#2D3748]/40 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#9CA3AF]">Après le transfert</span>
                    <span className="text-[16px] font-bold text-white">{destAthletes.length + selected.size} athlètes</span>
                  </div>
                  {(() => {
                    const wl = getWorkloadLevel(destAthletes.length + selected.size);
                    return (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: wl.color }} />
                        <span className="text-[11px] font-semibold" style={{ color: wl.color }}>{wl.label}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Incoming preview */}
              {selected.size > 0 && (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">Athlètes à transférer</p>
                  {selectedAthletes.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E63946]/5 border border-[#E63946]/10">
                      <span className="text-[12px] font-bold text-white truncate">{a.full_name}</span>
                      <span className="text-[10px] text-[#6b7280]">{a.sport} · {a.position}</span>
                      <div className="ml-auto"><StatusBadge status={a.pipeline_status} /></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Transfer options */}
              <div className="space-y-3 border-t border-[#2D3748]/40 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Options de transfert</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Jean-François quitte le CÉGEP le 1er mai. Transférer tous ses prospects football à Marc-André."
                  rows={2}
                  className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[12px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
                />
                {/* Toggles */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[12px] text-[#9CA3AF]">Notifier le recruteur destination</span>
                  <button type="button" onClick={() => setNotifyDest(!notifyDest)} className={`relative w-10 h-6 rounded-full transition-colors ${notifyDest ? "bg-[#22C55E]" : "bg-[#2D3748]"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifyDest ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-[12px] text-[#9CA3AF]">Notifier les coachs concernés</span>
                    <p className="text-[10px] text-[#4a4d56] mt-0.5">Les coachs verront que le recruteur assigné a changé</p>
                  </div>
                  <button type="button" onClick={() => setNotifyCoach(!notifyCoach)} className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${notifyCoach ? "bg-[#22C55E]" : "bg-[#2D3748]"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifyCoach ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Transfer CTA ──────────────────────────────────────── */}
      {sourceId && destId && selected.size > 0 && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="w-full py-4 bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[14px] uppercase tracking-widest rounded-xl transition-all hover:-translate-y-0.5 active:scale-[0.99]"
        >
          Transférer {selected.size} athlète{selected.size > 1 ? "s" : ""} de {sourceRec?.firstName} → {destRec?.firstName}
        </button>
      )}

      {/* ── Transfer History ──────────────────────────────────── */}
      <TransferHistory history={transferHistory} />

      {/* ── Confirm Modal ─────────────────────────────────────── */}
      {showConfirm && sourceRec && destRec && (
        <ConfirmModal
          title="Confirmer le transfert?"
          confirmLabel="Confirmer le transfert"
          onConfirm={executeTransfer}
          onCancel={() => setShowConfirm(false)}
        >
          <div className="space-y-3">
            <p className="text-[13px] text-[#9CA3AF]">
              <span className="font-bold text-white">{selected.size} athlète{selected.size > 1 ? "s" : ""}</span> de{" "}
              <span className="font-bold text-white">{sourceRec.firstName} {sourceRec.lastName}</span> →{" "}
              <span className="font-bold text-white">{destRec.firstName} {destRec.lastName}</span>
            </p>
            <div className="max-h-[150px] overflow-y-auto space-y-1">
              {selectedAthletes.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[12px]">
                  <span className="text-white">{a.full_name}</span>
                  <span className="text-[#6b7280]">{a.sport} · {a.position}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[#6b7280] italic">Les statuts de pipeline seront conservés.</p>
          </div>
        </ConfirmModal>
      )}

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
