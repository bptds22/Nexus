"use client";

import { useState, useRef, useEffect } from "react";
import type { RecruitmentStatus, RetireReason } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig, getValidTransitions, needsAutoMessage, RETIRE_REASONS, RECRUITMENT_STATUSES } from "@/lib/config/recruitmentStatuses";
import { StatusIcon } from "./RecruitmentStatusBadge";

/* ─────────────────────────────────────────────────────────────────
   StatusChangeDropdown
   Shows only valid next statuses. Handles special cases:
   - "Contacté" without thread → triggers onComposeIntro callback
   - "Visite planifiée" → optional date picker
   - "Lettre signée" → triggers onCelebrate callback
   - "Retiré" → optional reason dropdown
───────────────────────────────────────────────────────────────── */

interface Props {
  currentStatus: RecruitmentStatus;
  athleteId: string;
  hasExistingThread?: boolean;
  /** `visitDate` : instant ISO COMPLET (date + heure si saisie), pas un
   *  simple YYYY-MM-DD — il part tel quel dans recruiter_pipeline.visit_at
   *  (timestamptz). Voir combineVisitInstant() plus bas. */
  onStatusChange: (newStatus: RecruitmentStatus, extra?: { visitDate?: string; retireReason?: RetireReason }) => void;
  onComposeIntro?: () => void;
  onCelebrate?: () => void;
}

/* `<input type="date">` donne "YYYY-MM-DD", `<input type="time">` donne
 * "HH:MM". `new Date("2026-03-12T14:00")` (sans suffixe Z) est interprété
 * en HEURE LOCALE par le moteur JS — exactement ce qu'on veut : le
 * recruteur saisit 14h à Montréal, on stocke l'instant UTC correspondant.
 * Ajouter un "Z" ici décalerait la visite de 4-5h.
 *
 * Heure absente → minuit local. VisitCalendarCard traite minuit pile comme
 * « pas d'heure saisie » et n'affiche alors que la date. */
function combineVisitInstant(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T${time || "00:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function StatusChangeDropdown({
  currentStatus,
  athleteId,
  hasExistingThread = false,
  onStatusChange,
  onComposeIntro,
  onCelebrate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showRetireReason, setShowRetireReason] = useState(false);
  const [showVisitDate, setShowVisitDate] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [retireReason, setRetireReason] = useState<RetireReason | "">("");
  const ref = useRef<HTMLDivElement>(null);

  const transitions = getValidTransitions(currentStatus);
  const allStatuses = RECRUITMENT_STATUSES.filter((s) => s.id !== "none" && s.id !== currentStatus);
  const forwardStatuses = allStatuses.filter((s) => transitions.includes(s.id));
  const otherStatuses = allStatuses.filter((s) => !transitions.includes(s.id));
  const cfg = getStatusConfig(currentStatus);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowRetireReason(false);
        setShowVisitDate(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (currentStatus === "none") return null;

  function handleSelect(next: RecruitmentStatus) {
    // Contacté + no thread → compose intro
    if (next === "contacte" && needsAutoMessage(currentStatus, hasExistingThread)) {
      setOpen(false);
      onComposeIntro?.();
      return;
    }

    // Visite planifiée → show date picker
    if (next === "visite_planifiee") {
      setShowVisitDate(true);
      setShowRetireReason(false);
      return;
    }

    // Retiré → show reason dropdown
    if (next === "retire") {
      setShowRetireReason(true);
      setShowVisitDate(false);
      return;
    }

    // Lettre signée → celebrate
    if (next === "lettre_signee") {
      onStatusChange(next);
      setOpen(false);
      onCelebrate?.();
      return;
    }

    // Default
    onStatusChange(next);
    setOpen(false);
  }

  function confirmVisit() {
    onStatusChange("visite_planifiee", { visitDate: combineVisitInstant(visitDate, visitTime) });
    setOpen(false);
    setShowVisitDate(false);
    setVisitDate("");
    setVisitTime("");
  }

  function confirmRetire() {
    onStatusChange("retire", { retireReason: (retireReason as RetireReason) || undefined });
    setOpen(false);
    setShowRetireReason(false);
    setRetireReason("");
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => { setOpen(!open); setShowRetireReason(false); setShowVisitDate(false); }}
        className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border border-[#2D3748] bg-[#13151a] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        Changer le statut
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[260px] bg-[#1A1D24] border border-[#2D3748] rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Status options */}
          {!showRetireReason && !showVisitDate && (
            <div className="py-1">
              {/* Recommended next steps */}
              {forwardStatuses.length > 0 && (
                <>
                  <p className="px-4 py-2 text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Prochaine étape</p>
                  {forwardStatuses.map((s) => {
                    const isRetire = s.id === "retire";
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelect(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isRetire ? "hover:bg-[#374151]/20 mt-1 border-t border-[#2D3748]/50" : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <StatusIcon icon={s.icon} color={s.color} size={14} />
                        <span className="text-[13px] font-semibold" style={{ color: s.color }}>
                          {s.label}
                        </span>
                        {s.id === "contacte" && needsAutoMessage(currentStatus, hasExistingThread) && (
                          <span className="ml-auto text-[9px] text-[#6b7280] font-bold uppercase">+ message</span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {/* All other statuses */}
              {otherStatuses.length > 0 && (
                <>
                  <p className="px-4 py-2 mt-1 border-t border-[#2D3748]/50 text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Tous les statuts</p>
                  {otherStatuses.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelect(s.id)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <StatusIcon icon={s.icon} color={s.color} size={14} />
                      <span className="text-[13px] font-semibold opacity-60" style={{ color: s.color }}>
                        {s.label}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Visit date picker */}
          {showVisitDate && (
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Date prévue de la visite</p>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none"
              />

              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Heure (optionnel)</p>
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                // Sans date, l'heure ne veut rien dire (et combineVisitInstant
                // renverrait undefined) → on la verrouille tant que la date est vide.
                disabled={!visitDate}
                aria-label="Heure de la visite"
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none disabled:opacity-40"
              />

              <p className="text-[10px] text-[#6b7280]">Optionnel — tu peux ajouter la date plus tard</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowVisitDate(false); }} className="flex-1 px-3 py-2 rounded-lg text-[12px] font-bold text-[#6b7280] hover:text-white transition-colors">
                  Retour
                </button>
                <button type="button" onClick={confirmVisit} className="flex-1 px-3 py-2 rounded-lg text-[12px] font-bold bg-[#E63946] text-white hover:bg-[#D42B22] transition-colors">
                  Confirmer
                </button>
              </div>
            </div>
          )}

          {/* Retire reason */}
          {showRetireReason && (
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">Raison du retrait</p>
              <select
                value={retireReason}
                onChange={(e) => setRetireReason(e.target.value as RetireReason)}
                aria-label="Raison du retrait"
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#374151] outline-none"
              >
                <option value="">Optionnel — sélectionner</option>
                {RETIRE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowRetireReason(false); }} className="flex-1 px-3 py-2 rounded-lg text-[12px] font-bold text-[#6b7280] hover:text-white transition-colors">
                  Retour
                </button>
                <button type="button" onClick={confirmRetire} className="flex-1 px-3 py-2 rounded-lg text-[12px] font-bold bg-[#374151] text-[#9CA3AF] hover:bg-[#4B5563] transition-colors">
                  Retirer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
