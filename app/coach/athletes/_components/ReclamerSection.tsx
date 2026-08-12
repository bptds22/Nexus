"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RosterAthlete } from "../_data/mockRosterData";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { orgNounPossessif, type SchoolType } from "@/lib/utils/orgLabel";

/* ═══════════════════════════════════════════════════════════════
   ReclamerSection — multi-select grid for claiming unclaimed
   school athletes. Sets athletes.coach_id from NULL to the
   current coach via bulk UPDATE. RLS policy
   "coaches can claim unclaimed school athletes" enforces the
   security boundary (USING: NULL coach_id at MY school;
   WITH CHECK: new coach_id = auth.uid()).
═══════════════════════════════════════════════════════════════ */

interface ReclamerSectionProps {
  unclaimedAthletes: RosterAthlete[];
  currentUserId: string;
  /** Type d'org du coach courant → vocabulaire type-aware (club vs école). */
  orgType?: SchoolType | null;
  onClaimSuccess: () => void;
}

export default function ReclamerSection({
  unclaimedAthletes,
  currentUserId,
  orgType = null,
  onClaimSuccess,
}: ReclamerSectionProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleClaim() {
    if (selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    const supabase = createClient();
    const { error } = await supabase
      .from("athletes")
      .update({ coach_id: currentUserId })
      .in("id", ids);

    if (error) {
      console.error("[Claim failed]", error);
      setToast({ kind: "error", message: "Impossible de réclamer ces athlètes." });
      setTimeout(() => setToast(null), 4000);
      setSubmitting(false);
      setShowConfirm(false);
      return;
    }

    setToast({
      kind: "success",
      message: `${ids.length} athlète${ids.length > 1 ? "s ajoutés" : " ajouté"} à ton roster.`,
    });
    setTimeout(() => setToast(null), 4000);
    setSelectedIds(new Set());
    setShowConfirm(false);
    setSubmitting(false);
    onClaimSuccess();
  }

  if (unclaimedAthletes.length === 0) {
    return (
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">
          Aucun athlète non réclamé
        </h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 max-w-sm mx-auto">
          Aucun athlète non réclamé à {orgNounPossessif(orgType)} pour l&apos;instant.
        </p>
      </div>
    );
  }

  const count = selectedIds.size;

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
            Athlètes non réclamés à {orgNounPossessif(orgType)}
            <span className="text-[#F59E0B] ml-2">({unclaimedAthletes.length})</span>
          </h3>
          <p className="text-[13px] text-[#9CA3AF] mt-1">
            Sélectionne les athlètes dont tu veux devenir le coach principal.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
          {unclaimedAthletes.map((a) => {
            const selected = selectedIds.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleSelected(a.id)}
                className={`relative text-left bg-[#1A1D24] rounded-xl overflow-hidden transition-all duration-200 group ${
                  selected
                    ? "border-2 border-[#E63946] shadow-[0_0_24px_rgba(230,57,70,0.18)]"
                    : "border border-[#2D3748] hover:border-[#E63946]/30"
                }`}
              >
                {/* Checkbox top-left */}
                <div className="absolute top-3 left-3 z-10">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      selected
                        ? "bg-[#E63946] border-2 border-[#E63946]"
                        : "bg-[#111317]/80 border-2 border-[#4a4d56] group-hover:border-[#E63946]/60"
                    }`}
                  >
                    {selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Photo banner */}
                <div className="relative h-[140px] bg-[#2F3440] overflow-hidden">
                  <AthletePhotoFill
                    photoUrl={a.photo}
                    firstName={a.firstName}
                    lastName={a.lastName}
                    initialsFontSize={48}
                    className="object-[center_15%]"
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-bold text-white">
                      {a.firstName} {a.lastName}
                    </span>
                    {a.position && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">
                        {a.position}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#6b7280] mt-1">
                    {a.gradYear ? `Promotion ${a.gradYear}` : "—"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sticky action bar */}
        {count > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1A1D24] border border-[#E63946]/30 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4">
            <span className="text-[13px] text-white">
              <span className="font-bold">{count}</span> athlète{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              Réclamer {count} athlète{count > 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setShowConfirm(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
              Réclamer {count} athlète{count > 1 ? "s" : ""}?
            </h3>
            <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">
              Tu vas devenir le coach principal de {count} athlète{count > 1 ? "s" : ""}. Cette action peut être annulée plus tard.
            </p>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleClaim}
                disabled={submitting}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-40"
              >
                {submitting ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 border ${
            toast.kind === "success"
              ? "bg-[#1A1D24] border-[#22C55E]/30"
              : "bg-[#1A1D24] border-[#EF4444]/30"
          }`}>
            {toast.kind === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            )}
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
