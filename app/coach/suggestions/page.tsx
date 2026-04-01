"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mapDbStatus } from "./_data/mockSuggestions";
import type { CoachSuggestion } from "./_data/mockSuggestions";

/* ═══════════════════════════════════════════════════════════════
   Suggestions des Athlètes — Coach approval queue
   Athletes propose profile changes, coach reviews and approves/rejects
═══════════════════════════════════════════════════════════════ */

type FilterKey = "all" | "pending" | "approved" | "rejected";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d} jours`;
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

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

/* ── Suggestion Card ──────────────────────────────────────────── */

function SuggestionCard({
  s,
  onApprove,
  onReject,
}: {
  s: CoachSuggestion;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 sm:p-6">
      {/* Header: athlete info + date */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2F3440] border border-[#2D3748] flex items-center justify-center shrink-0">
            <span className="text-[12px] font-bold text-white/20">{s.athlete_name.split(" ").map((w) => w[0]).join("")}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/coach/athletes/${s.athlete_id}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors">
                {s.athlete_name}
              </Link>
              {s.athlete_verified && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              )}
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E63946]/15 text-[#E63946]">{s.athlete_sport}</span>
            </div>
            <p className="text-[11px] text-[#6b7280] mt-0.5">Champ: <span className="text-[#9CA3AF] font-bold">{s.field}</span></p>
          </div>
        </div>
        <span className="text-[11px] text-[#4a4d56] shrink-0">{relativeTime(s.submitted_at)}</span>
      </div>

      {/* Comparison: current → proposed */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center mb-4">
        <div className="bg-[#111317] rounded-lg p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Valeur actuelle</p>
          <p className="text-[16px] font-bold text-white">{s.current_value || <span className="text-[#4a4d56] italic">Aucune</span>}</p>
        </div>
        <div className="hidden sm:flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
        </div>
        <div className="rounded-lg p-4 border" style={{ backgroundColor: "rgba(234,179,8,0.05)", borderColor: "rgba(234,179,8,0.20)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#EAB308] mb-1.5">Valeur proposée</p>
          <p className="text-[16px] font-bold text-[#EAB308]">{s.proposed_value}</p>
        </div>
      </div>

      {/* Athlete message */}
      {s.message && (
        <div className="border-l-[3px] border-[#EAB308] pl-4 py-2 mb-4 bg-[rgba(234,179,8,0.03)] rounded-r-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1">Message de l&apos;athlète</p>
          <p className="text-[13px] text-[#9CA3AF] italic">&ldquo;{s.message}&rdquo;</p>
        </div>
      )}

      {/* Status badges (approved/rejected) */}
      {s.status === "approved" && (
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#22C55E]/15 text-[#22C55E]">Approuvée</span>
          {s.reviewed_at && <span className="text-[11px] text-[#6b7280]">le {formatDate(s.reviewed_at)}</span>}
        </div>
      )}

      {s.status === "rejected" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E63946]/15 text-[#E63946]">Rejetée</span>
            {s.reviewed_at && <span className="text-[11px] text-[#6b7280]">le {formatDate(s.reviewed_at)}</span>}
          </div>
          {s.rejection_reason && (
            <div className="border-l-[3px] border-[#E63946] pl-4 py-2 bg-[rgba(230,57,70,0.03)] rounded-r-lg">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1">Raison du rejet</p>
              <p className="text-[13px] text-[#E63946] italic">&ldquo;{s.rejection_reason}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons (pending only) */}
      {s.status === "pending" && !showRejectForm && (
        <div className="flex items-center justify-end gap-3 mt-2">
          <button type="button" onClick={() => setShowRejectForm(true)}
            className="px-4 py-2 border border-[#E63946] text-[#E63946] text-[12px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#E63946]/10 transition-colors">
            Rejeter
          </button>
          <button type="button" onClick={() => onApprove(s.id)}
            className="px-5 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors">
            Approuver
          </button>
        </div>
      )}

      {/* Reject form (expanded) */}
      {s.status === "pending" && showRejectForm && (
        <div className="mt-3 bg-[#111317] border border-[#E63946]/20 rounded-lg p-4 space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block">Raison du rejet</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Ex: La taille sera mesurée officiellement au prochain entraînement"
            aria-label="Raison du rejet"
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none resize-none"
          />
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => { setShowRejectForm(false); setRejectReason(""); }} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
            <button type="button" onClick={() => { onReject(s.id, rejectReason); setShowRejectForm(false); setRejectReason(""); }}
              className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors">
              Confirmer le rejet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function CoachSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [athleteFilter, setAthleteFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data, error } = await supabase
        .from("profile_changes")
        .select("*, athletes(first_name, last_name, sport_id, verified, sports!sport_id(nom))")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });

      console.log("Suggestions data:", data, "error:", error);

      if (data) {
        const mapped: CoachSuggestion[] = data.map((row: Record<string, unknown>) => {
          const athleteRaw = row.athletes as Record<string, unknown> | null;
          const sportRaw = athleteRaw?.sports;
          const sport = Array.isArray(sportRaw) ? sportRaw[0] : sportRaw;
          const sportObj = sport as { nom?: string } | null;

          return {
            id: row.id as string,
            athlete_id: row.athlete_id as string,
            athlete_name: athleteRaw ? `${(athleteRaw.first_name as string) || ""} ${(athleteRaw.last_name as string) || ""}`.trim() : "Athlète",
            athlete_sport: sportObj?.nom || "",
            athlete_verified: !!(athleteRaw?.verified),
            field: (row.field_name as string) || "",
            current_value: (row.old_value as string) || null,
            proposed_value: (row.new_value as string) || "",
            message: (row.message as string) || null,
            status: mapDbStatus((row.status as string) || ""),
            submitted_at: (row.created_at as string) || "",
          };
        });
        setSuggestions(mapped);
      }
      setLoading(false);
    }
    load();
  }, []);

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const approvedCount = suggestions.filter((s) => s.status === "approved").length;
  const rejectedCount = suggestions.filter((s) => s.status === "rejected").length;

  const athletes = useMemo(() => {
    const set = new Set(suggestions.map((s) => s.athlete_name));
    return Array.from(set).sort();
  }, [suggestions]);

  const filtered = useMemo(() => {
    let list = [...suggestions];
    if (filter !== "all") list = list.filter((s) => s.status === filter);
    if (athleteFilter) list = list.filter((s) => s.athlete_name === athleteFilter);
    list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    return list;
  }, [suggestions, filter, athleteFilter]);

  const handleApprove = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("profile_changes").update({ status: "ACKNOWLEDGED" }).eq("id", id);
    console.log("Approve result:", error);
    if (!error) {
      setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, status: "approved" as const, reviewed_at: new Date().toISOString() } : s));
      showToast("Suggestion approuvée");
    }
  }, [showToast]);

  const handleReject = useCallback(async (id: string, reason: string) => {
    const supabase = createClient();
    // Find the suggestion to get old_value and field_name
    const suggestion = suggestions.find((s) => s.id === id);
    if (suggestion && suggestion.current_value) {
      // Revert the athlete field to old value
      const { error: revertError } = await supabase
        .from("athletes")
        .update({ [suggestion.field]: suggestion.current_value })
        .eq("id", suggestion.athlete_id);
      console.log("Revert athlete field:", suggestion.field, "→", suggestion.current_value, "error:", revertError);
    }
    const { error } = await supabase.from("profile_changes").update({ status: "REVERTED" }).eq("id", id);
    console.log("Reject result:", error);
    if (!error) {
      setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, status: "rejected" as const, reviewed_at: new Date().toISOString(), rejection_reason: reason } : s));
      showToast("Suggestion rejetée");
    }
  }, [showToast, suggestions]);

  const handleApproveAll = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("profile_changes")
      .update({ status: "ACKNOWLEDGED" })
      .eq("coach_id", userId)
      .eq("status", "PENDING");
    console.log("Approve all result:", error);
    if (!error) {
      setSuggestions((prev) => prev.map((s) => s.status === "pending" ? { ...s, status: "approved" as const, reviewed_at: new Date().toISOString() } : s));
      showToast(`${pendingCount} suggestions approuvées`);
    }
  }, [userId, pendingCount, showToast]);

  const TABS: { key: FilterKey; label: string; count: number; color: string }[] = [
    { key: "pending", label: "En attente", count: pendingCount, color: "#EAB308" },
    { key: "approved", label: "Approuvées", count: approvedCount, color: "#22C55E" },
    { key: "rejected", label: "Rejetées", count: rejectedCount, color: "#E63946" },
    { key: "all", label: "Toutes", count: suggestions.length, color: "#9CA3AF" },
  ];

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto flex items-center justify-center">
        <p className="text-[#6B7280] text-sm py-20">Chargement des suggestions...</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1000px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Suggestions des athlètes</h1>
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-[#E63946] text-white text-[11px] font-black">{pendingCount}</span>
          )}
        </div>
        <p className="text-[14px] text-[#9CA3AF]">Tes athlètes proposent des modifications à leur profil</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={athleteFilter}
          onChange={(e) => setAthleteFilter(e.target.value)}
          aria-label="Filtrer par athlète"
          className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
        >
          <option value="">Tous les athlètes</option>
          {athletes.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <div className="flex gap-1 flex-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                filter === tab.key ? "text-white" : "text-[#6b7280] hover:text-[#9CA3AF]"
              }`}
              style={filter === tab.key ? { backgroundColor: `${tab.color}20`, color: tab.color } : undefined}>
              {tab.label}
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black" style={{ backgroundColor: filter === tab.key ? tab.color : "#2D3748", color: filter === tab.key ? "#fff" : "#6b7280" }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {filter === "pending" && pendingCount > 1 && (
          <button type="button" onClick={handleApproveAll} className="text-[11px] font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors shrink-0">
            Tout approuver
          </button>
        )}
      </div>

      {/* Suggestion list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
              <path d="M13 13l2 2 4-4" stroke="#22C55E" strokeWidth="2" />
            </svg>
          </div>
          <h3 className="font-head text-lg font-black text-white uppercase mb-1">
            {filter === "pending" ? "Aucune suggestion en attente" : "Aucune suggestion"}
          </h3>
          <p className="text-[13px] text-[#9CA3AF] max-w-sm">
            {filter === "pending"
              ? "Quand tes athlètes proposeront des modifications à leur profil, elles apparaîtront ici."
              : "Aucune suggestion dans cette catégorie."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => (
            <SuggestionCard key={s.id} s={s} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
