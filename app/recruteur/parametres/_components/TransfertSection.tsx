"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   TransfertSection — CÉGEP transfer portal for recruiters
───────────────────────────────────────────────────────────────── */

interface Props {
  currentSchoolId: string;
  currentSchoolName: string;
  schools: { id: string; name: string }[];
}

interface DataCounts {
  favorites: number;
  pipeline: number;
  notes: number;
  lists: number;
  conversations: number;
}

interface PendingTransfer {
  id: string;
  to_school_id: string;
  to_school_name: string;
  status: string;
  requested_at: string;
  reason: string | null;
}

export default function TransfertSection({ currentSchoolId, currentSchoolName, schools }: Props) {
  const [counts, setCounts] = useState<DataCounts>({ favorites: 0, pipeline: 0, notes: 0, lists: 0, conversations: 0 });
  const [pending, setPending] = useState<PendingTransfer | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [reason, setReason] = useState("");
  const [keepFavorites, setKeepFavorites] = useState(true);
  const [keepPipeline, setKeepPipeline] = useState(true);
  const [keepNotes, setKeepNotes] = useState(true);
  const [keepLists, setKeepLists] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [success, setSuccess] = useState(false);

  // Filter schools: exclude current school
  const availableSchools = schools.filter((s) => s.id !== currentSchoolId);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Fetch counts in parallel
      const [favRes, pipeRes, noteRes, listRes, convRes, transferRes] = await Promise.all([
        supabase.from("recruiter_favorites").select("*", { count: "exact", head: true }).eq("recruiter_id", user.id),
        supabase.from("recruiter_pipeline").select("*", { count: "exact", head: true }).eq("recruiter_id", user.id),
        supabase.from("recruiter_notes").select("*", { count: "exact", head: true }).eq("recruiter_id", user.id),
        supabase.from("recruiter_lists").select("*", { count: "exact", head: true }).eq("recruiter_id", user.id),
        supabase.from("conversations").select("*", { count: "exact", head: true }).eq("recruiter_id", user.id),
        supabase.from("transfer_requests").select("id, to_school_id, status, requested_at, reason").eq("user_id", user.id).eq("status", "PENDING").maybeSingle(),
      ]);

      setCounts({
        favorites: favRes.count ?? 0,
        pipeline: pipeRes.count ?? 0,
        notes: noteRes.count ?? 0,
        lists: listRes.count ?? 0,
        conversations: convRes.count ?? 0,
      });

      const transferData = transferRes.data;
      if (transferData) {
        const schoolMatch = schools.find((s) => s.id === transferData.to_school_id);
        setPending({
          ...transferData,
          to_school_name: schoolMatch?.name || "Inconnu",
        });
      }

      setLoading(false);
    }
    load();
  }, [currentSchoolId, schools]);

  async function handleSubmit() {
    if (!selectedSchoolId) return;
    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { data: userData } = await supabase.from("users").select("first_name, last_name").eq("id", user.id).single();
    const newSchool = availableSchools.find((s) => s.id === selectedSchoolId);

    const { error } = await supabase.from("transfer_requests").insert({
      user_id: user.id,
      from_school_id: currentSchoolId,
      to_school_id: selectedSchoolId,
      reason: reason.trim() || null,
      keep_favorites: keepFavorites,
      keep_pipeline: keepPipeline,
      keep_notes: keepNotes,
      keep_lists: keepLists,
    });

    if (!error) {
      // Notify admin
      await supabase.from("admin_notifications").insert({
        type: "SYSTEM",
        title: "Demande de transfert",
        message: `Le recruteur ${userData?.first_name || ""} ${userData?.last_name || ""} a demandé un transfert vers ${newSchool?.name || "un autre CÉGEP"}. Veuillez approuver ou refuser dans Paramètres → Admin CÉGEP.`,
        related_user_id: user.id,
      });

      setPending({
        id: "new",
        to_school_id: selectedSchoolId,
        to_school_name: newSchool?.name || "Inconnu",
        status: "PENDING",
        requested_at: new Date().toISOString(),
        reason: reason.trim() || null,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    }

    setSubmitting(false);
  }

  async function handleCancel() {
    if (!pending) return;
    setCancelling(true);

    const supabase = createClient();
    await supabase.from("transfer_requests").delete().eq("id", pending.id);

    setPending(null);
    setConfirmCancel(false);
    setCancelling(false);
    setSelectedSchoolId("");
    setReason("");
  }

  const sectionHeader = (label: string) => (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-0.5 h-4 bg-[#E63946] rounded-full" />
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{label}</span>
    </div>
  );

  const cardCls = "bg-[#1A1D24] rounded-xl border border-[#2A2D35] p-5 mb-4";

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Transfert de CÉGEP</h2>
          <p className="text-[14px] text-[#6b7280] mt-1">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Transfert de CÉGEP</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Changez d&apos;établissement tout en conservant vos données.</p>
      </div>

      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
          <span className="text-[13px] font-bold text-[#22C55E]">Votre demande de transfert a été envoyée au directeur sportif de votre CÉGEP actuel.</span>
        </div>
      )}

      {/* Current data summary */}
      <div className={cardCls}>
        {sectionHeader("Vos données actuelles")}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-[16px]">🏫</span>
            <span className="text-[14px] text-white font-bold">CÉGEP actuel : {currentSchoolName || "Non défini"}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 ml-7">
            <span className="text-[13px] text-[#9CA3AF]">
              <span className="text-[#E63946] font-bold">♥</span> {counts.favorites} favori{counts.favorites !== 1 ? "s" : ""}
            </span>
            <span className="text-[13px] text-[#9CA3AF]">
              <span className="text-[#E63946] font-bold">📋</span> {counts.pipeline} pipeline
            </span>
            <span className="text-[13px] text-[#9CA3AF]">
              <span className="text-[#E63946] font-bold">📝</span> {counts.notes} note{counts.notes !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 ml-7">
            <span className="text-[13px] text-[#9CA3AF]">
              <span className="text-[#E63946] font-bold">📁</span> {counts.lists} liste{counts.lists !== 1 ? "s" : ""}
            </span>
            <span className="text-[13px] text-[#9CA3AF]">
              <span className="text-[#E63946] font-bold">💬</span> {counts.conversations} conversation{counts.conversations !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Pending transfer OR request form */}
      {pending ? (
        <div className={cardCls}>
          {sectionHeader("Transfert en cours")}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[16px]">📤</span>
              <span className="text-[13px] text-[#9CA3AF]">
                Demande envoyée le{" "}
                <span className="text-white font-bold">
                  {new Date(pending.requested_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 ml-7">
              <span className="text-[13px] text-[#9CA3AF]">Vers :</span>
              <span className="text-[13px] text-white font-bold">{pending.to_school_name}</span>
            </div>
            <div className="flex items-center gap-2.5 ml-7">
              <span className="text-[13px] text-[#9CA3AF]">Statut :</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-wider">En attente d&apos;approbation</span>
              </span>
            </div>
            {pending.reason && (
              <div className="ml-7 mt-1">
                <span className="text-[11px] text-[#6b7280]">Raison : </span>
                <span className="text-[12px] text-[#9CA3AF] italic">{pending.reason}</span>
              </div>
            )}

            {/* Cancel button */}
            {!confirmCancel ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="px-4 py-2 border border-[#EF4444] text-[#EF4444] text-[12px] font-bold rounded-lg hover:bg-[#EF4444]/10 transition-colors uppercase tracking-wider"
                >
                  Annuler la demande
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-4 p-3 bg-[#EF4444]/5 rounded-lg border border-[#EF4444]/20">
                <span className="text-[12px] text-[#9CA3AF]">Annuler cette demande de transfert ?</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-3 py-1.5 bg-[#EF4444] text-white text-[11px] font-bold rounded-lg hover:bg-[#DC2626] transition-colors uppercase tracking-wider disabled:opacity-50"
                >
                  {cancelling ? "..." : "Confirmer"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors"
                >
                  Non
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={cardCls}>
          {sectionHeader("Demander un transfert")}
          <div className="space-y-4">
            {/* CÉGEP selector */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5 block">
                Nouveau CÉGEP <span className="text-[#EF4444]">*</span>
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                aria-label="Nouveau CÉGEP"
                className="w-full h-11 px-4 bg-[#111317] border border-[#2D3748] rounded-lg text-[14px] text-white focus:border-[#E63946] outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">Sélectionner un CÉGEP</option>
                {availableSchools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5 block">
                Raison du transfert <span className="text-[10px] text-[#4a4d56] normal-case tracking-normal">(optionnel)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Expliquez brièvement..."
                className="w-full bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 text-[14px] text-white placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
              />
            </div>

            {/* What you keep */}
            <div className="bg-[#13151a] rounded-lg border border-[#2A2D35] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Ce que vous conservez</p>
              <div className="space-y-2.5">
                <KeepToggle label={`Mes favoris (${counts.favorites})`} checked={keepFavorites} onChange={setKeepFavorites} />
                <KeepToggle label={`Mon pipeline (${counts.pipeline})`} checked={keepPipeline} onChange={setKeepPipeline} />
                <KeepToggle label={`Mes notes (${counts.notes})`} checked={keepNotes} onChange={setKeepNotes} />
                <KeepToggle label={`Mes listes (${counts.lists})`} checked={keepLists} onChange={setKeepLists} />
              </div>

              {/* Conversations warning */}
              <div className="flex items-start gap-2.5 mt-4 pt-3 border-t border-[#2A2D35]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                  Les conversations restent avec votre ancien CÉGEP. Vous pourrez les consulter en lecture seule pendant 30 jours.
                </p>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedSchoolId || submitting}
              className={`w-full py-3 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
                selectedSchoolId && !submitting
                  ? "bg-[#E63946] text-white hover:bg-[#D42B22]"
                  : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
              }`}
            >
              {submitting ? "Envoi en cours..." : "Demander le transfert"}
            </button>

            {/* Disclaimer */}
            <div className="flex items-start gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[11px] text-[#4a4d56] leading-relaxed">
                Cette demande sera envoyée au directeur sportif de votre CÉGEP actuel pour approbation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Keep toggle checkbox ────────────────────────────────────── */

function KeepToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? "bg-[#22C55E] border-[#22C55E]" : "border-[#4a4d56] group-hover:border-[#6b7280]"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>
      <span className={`text-[13px] ${checked ? "text-white" : "text-[#6b7280]"}`}>{label}</span>
    </label>
  );
}
