"use client";

/* ═══════════════════════════════════════════════════════════════
   VisitDateEditor — mini date-picker (date + heure optionnelle) pour
   POSER / MODIFIER la date de visite (recruiter_pipeline.visit_at).

   Présentationnel : ne connaît pas le chemin d'écriture. L'appelant
   fournit `visitAtIso` (valeur courante) + `onSave(iso | undefined)` et
   choisit son propre write path (persistPipelineStage côté fiche,
   useUpdatePipelineStage côté kanban). Réutilise combineVisitInstant /
   splitVisitInstant (source unique) pour rester symétrique avec le
   dropdown desktop.

   Style aligné sur les bottom sheets mobiles (fond #0C0E12, rounded-2xl,
   focus rouge Nexus). Inputs en text-[16px] pour éviter le zoom iOS.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { combineVisitInstant, splitVisitInstant } from "@/lib/pipeline/visitInstant";

interface Props {
  /** Instant ISO courant (recruiter_pipeline.visit_at) ou null. */
  visitAtIso: string | null;
  /** Écrit la nouvelle date. `undefined` = aucune date (date effacée). */
  onSave: (iso: string | undefined) => void | Promise<void>;
  saving?: boolean;
}

export default function VisitDateEditor({ visitAtIso, onSave, saving = false }: Props) {
  const initial = splitVisitInstant(visitAtIso);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);

  // Re-sync si la date courante change en amont (ex. après enregistrement,
  // ouverture sur un autre athlète, ou passage à VISITE_PLANIFIEE).
  useEffect(() => {
    const next = splitVisitInstant(visitAtIso);
    setDate(next.date);
    setTime(next.time);
  }, [visitAtIso]);

  const nextIso = combineVisitInstant(date, time);
  // Dirty = la valeur combinée diffère de la valeur stockée (évite un write
  // inutile qui bumperait moved_at sans changement réel).
  const isDirty = (nextIso ?? null) !== (visitAtIso ?? null);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#9CA3AF] mb-1.5">
          Date de la visite
        </p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date de la visite"
          className="w-full bg-[#0C0E12] border border-white/[0.06] rounded-2xl px-3 py-2.5 text-[16px] text-white outline-none focus:border-[#E63946]/40 transition-colors"
        />
      </div>

      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#9CA3AF] mb-1.5">
          Heure (optionnel)
        </p>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          // Sans date, l'heure ne veut rien dire (combineVisitInstant
          // renverrait undefined) → verrouillée tant que la date est vide.
          disabled={!date}
          aria-label="Heure de la visite"
          className="w-full bg-[#0C0E12] border border-white/[0.06] rounded-2xl px-3 py-2.5 text-[16px] text-white outline-none focus:border-[#E63946]/40 transition-colors disabled:opacity-40"
        />
      </div>

      <button
        type="button"
        onClick={() => onSave(nextIso)}
        disabled={!isDirty || saving}
        className={`w-full py-3 rounded-2xl text-[13px] uppercase tracking-wider font-bold transition-colors ${
          isDirty && !saving
            ? "bg-[#E63946] text-white active:bg-[#D42B22]"
            : "bg-white/[0.06] text-[#4a4d56]"
        }`}
      >
        {saving ? "…" : date ? "Enregistrer la date" : "Effacer la date"}
      </button>
    </div>
  );
}
