"use client";

/* ═══════════════════════════════════════════════════════════════
   SuggestionsAlert — Coach athlete profile.

   Renders ONLY when pendingSuggestions.length > 0. Lists each pending
   athlete_suggestions row (status='EN_ATTENTE') with diff + approve/
   reject actions.

   Canon : red #E63946 (action/urgent) + PENCIL/EDIT icon (a suggestion
   is the athlete proposing a profile-field change, NOT a message —
   never an envelope, never a shield).

   Two render modes :

   • INLINE mode (no `onTapSuggestion` prop — used by the WEB profile) :
     each suggestion renders fully expanded with the diff, message,
     time, and inline Approuver/Rejeter buttons. Reject expands an
     inline reason input + Confirmer/Annuler. The component OWNS its
     own rejectingId + rejectReason state — the parent's onReject just
     receives the suggestionId + reason and writes them.

   • TAP-THROUGH mode (`onTapSuggestion` provided — used by the future
     MOBILE profile) : each suggestion renders as a compact tappable
     summary row. Tap fires onTapSuggestion(s) — the parent (mobile)
     opens its own bottom-sheet for the full detail. Inline approve/
     reject UI is hidden in this mode (the sheet handles it).

   Presentational — write handlers passed via props.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface PendingSuggestion {
  id: string;
  champ: string;
  valeur_actuelle: string;
  valeur_proposee: string;
  message: string;
  created_at: string;
}

export interface SuggestionsAlertProps {
  pendingSuggestions: PendingSuggestion[];
  /** Approve. 1-column write : status='APPROUVEE'. Server trigger
   *  applies the proposed value to the athletes/evaluations row. */
  onApprove: (suggestionId: string) => void;
  /** Reject. status='REJETEE' + raison_rejet=reason (or null). */
  onReject: (suggestionId: string, reason: string) => void;
  /** Optional. When provided, switches to tap-through mode — each
   *  suggestion renders as a tappable summary line. Used by mobile
   *  to open a bottom-sheet for the full detail + actions. */
  onTapSuggestion?: (suggestion: PendingSuggestion) => void;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffMin < 1440) return `Il y a ${Math.floor(diffMin / 60)}h`;
  return `Il y a ${Math.floor(diffMin / 1440)}j`;
}

export default function SuggestionsAlert({
  pendingSuggestions, onApprove, onReject, onTapSuggestion,
}: SuggestionsAlertProps) {
  // Owned-by-component state for the inline reject flow. Switches to a
  // local input box under the suggestion being rejected; on Confirmer
  // we hand the reason up via onReject(id, reason) and clear local state.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const tapMode = !!onTapSuggestion;

  /* Exit animations : block-level quand la liste devient vide,
     row-level quand UNE suggestion est résolue (les autres restent).
     ~240ms ease-out, fade + height collapse. */
  return (
    <AnimatePresence initial={false}>
      {pendingSuggestions.length > 0 && (
        <motion.div
          key="suggestions-block"
          initial={{ opacity: 0, height: 0, scale: 0.97 }}
          animate={{ opacity: 1, height: "auto", scale: 1 }}
          exit={{ opacity: 0, height: 0, scale: 0.97 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
        >
    <div className="bg-[#4a4d56]/15 border border-[#4a4d56]/40 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-full bg-[#E63946]/15 flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#E63946]">
          {pendingSuggestions.length} suggestion{pendingSuggestions.length > 1 ? "s" : ""} en attente
        </h3>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
        {pendingSuggestions.map((s) => {
          if (tapMode) {
            return (
              <motion.button
                key={s.id}
                layout
                initial={{ opacity: 0, height: 0, scale: 0.97 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.97 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
                type="button"
                onClick={() => onTapSuggestion!(s)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[#13151a] border border-[#E63946]/10 active:bg-white/[0.03] hover:bg-white/[0.02] transition-colors text-left"
              >
                <span className="text-[13px] text-[#E63946] font-semibold truncate">{s.champ}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </motion.button>
            );
          }

          // Inline mode — web profile
          return (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, height: 0, scale: 0.97 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.97 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
              className="bg-[#13151a] rounded-lg border border-[#E63946]/10 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white">{s.champ}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {s.valeur_actuelle && <span className="text-[12px] text-[#6b7280] line-through">{s.valeur_actuelle}</span>}
                    <span className="text-[12px] text-[#6b7280]">→</span>
                    <span className="text-[13px] font-bold text-[#E63946]">{s.valeur_proposee}</span>
                  </div>
                  {s.message && <p className="text-[11px] text-[#6b7280] italic mt-1">&ldquo;{s.message}&rdquo;</p>}
                  <p className="text-[10px] text-[#4a4d56] mt-1">{relativeTime(s.created_at)}</p>
                </div>

                {rejectingId === s.id ? (
                  <div className="flex flex-col gap-2 shrink-0">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Raison (optionnel)"
                      aria-label="Raison du rejet"
                      className="bg-[#111317] border border-[#2D3748] rounded px-2 py-1 text-[11px] text-white w-40 focus:border-[#E63946] outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onReject(s.id, rejectReason);
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                        className="px-3 py-1 bg-[#E63946] text-white text-[10px] font-bold rounded hover:bg-[#D42B22] transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="text-[10px] text-[#6b7280] hover:text-white transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApprove(s.id)}
                      className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
                    >
                      Approuver
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(s.id)}
                      className="px-3 py-1.5 border border-[#E63946]/30 text-[#E63946] text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#E63946]/10 transition-colors"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
