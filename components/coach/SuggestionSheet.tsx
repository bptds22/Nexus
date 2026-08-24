"use client";

/* ═══════════════════════════════════════════════════════════════
   SuggestionSheet — bottom-sheet pour examiner UNE suggestion à la fois.

   Extraction de CoachATraiterMobile (Step 3b) pour réutilisation par le
   coach athlete profile mobile (Step 4). Ne dupliquer ni le helper
   champLabel ni le sheet — UNE seule source de vérité.

   Pattern : portaled au document.body (échappe le containing block
   AnimatedRoute), backdrop fade 200ms + sheet slide-up cubic-bezier
   overshoot 280ms (iOS canon). Le rejet expand un input de raison
   inline dans la sheet (Confirmer / Annuler).

   Présentationnel — les writes (status='APPROUVEE' / status='REJETEE'
   + raison_rejet) sont passés via les props onApprove / onReject.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CoachTaskSuggestion } from "@/lib/coach/tasks";
import { champToColumn } from "@/lib/evaluations/grilles";
import { triggerHaptic } from "@/lib/haptics";

/* ── champ label map + helper (réutilisé par les summary lines) ── */

/* Phrase d'annonce par critère, indexée par NOM DE COLONNE.
   Les 14 y sont — les 6 ajoutés en juin 2026 (vitesse, puissance, endurance,
   agilité, vision, sens tactique) manquaient, et retombaient sur le générique
   « Changement : … ». champLabel accepte AUSSI les libellés FR : une
   suggestion créée par l'app 1.2 en magasin doit rester lisible chez le coach. */
const CHAMP_PHRASE_BY_COLUMN: Record<string, string> = {
  leadership:           "Nouveau score de leadership",
  discipline:           "Nouveau score de discipline",
  coachabilite:         "Nouveau score de coachabilité",
  intelligence_jeu:     "Nouveau score d'intelligence de jeu",
  competitivite:        "Nouveau score de compétitivité",
  esprit_equipe:        "Nouveau score d'esprit d'équipe",
  resilience:           "Nouveau score de résilience",
  attitude_mentalite:   "Nouveau score de disponibilité",
  vitesse_explosivite:  "Nouveau score de vitesse",
  force_puissance:      "Nouveau score de puissance",
  endurance_cardio:     "Nouveau score d'endurance",
  agilite_coordination: "Nouveau score d'agilité / coordination",
  vision_du_jeu:        "Nouveau score de vision du jeu",
  sens_tactique:        "Nouveau score de sens tactique",
};

export const CHAMP_LABEL_MAP: Record<string, string> = {
  "Numéro": "Changement de numéro",
  "Position": "Changement de position",
  "Sport principal": "Changement de sport principal",
  "Taille": "Changement de taille",
  "Poids": "Changement de poids",
  "Envergure": "Changement d'envergure",
  "Taille mains": "Changement de taille des mains",
  "Main dominante": "Changement de main dominante",
  "Pied dominant": "Changement de pied dominant",
  "40 yards": "Nouveau temps 40 verges",
  "Saut vertical": "Nouveau saut vertical",
  "Saut longueur": "Nouveau saut en longueur",
  "Développé couché": "Nouveau développé couché",
  "Navette": "Nouveau temps de navette",
  "Sprint 100m": "Nouveau sprint 100m",
  "Cote globale": "Nouvelle cote globale",
  "Distinctions": "Nouvelles distinctions",
  "Distinction personnalisée": "Nouvelle distinction",
};

export function champLabel(champ: string): string {
  if (!champ) return "Suggestion";
  // 1) trait : on passe par la colonne, ce qui couvre les deux espaces de clés
  const col = champToColumn(champ);
  if (col && CHAMP_PHRASE_BY_COLUMN[col]) return CHAMP_PHRASE_BY_COLUMN[col];
  // 2) champs non-traits (Taille, Poids, Distinctions…), inchangés
  return CHAMP_LABEL_MAP[champ] ?? `Changement : ${champ}`;
}

export function relativeTime(iso: string): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "";
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}


export interface SuggestionSheetProps {
  open: boolean;
  suggestion: CoachTaskSuggestion | null;
  athleteName: string;
  rejecting: boolean;
  rejectReason: string;
  onClose: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onChangeReason: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export default function SuggestionSheet({
  open, suggestion, athleteName, rejecting, rejectReason,
  onClose, onStartReject, onCancelReject, onChangeReason, onApprove, onReject,
}: SuggestionSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open || !suggestion) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "nx-sug-fade 200ms ease-out forwards" }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          animation: "nx-sug-sheet-up 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-6 pt-2 pb-6">
          {/* Header — pencil icon + champ label */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-full bg-[#E63946]/15 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <h3 className="font-head text-[15px] font-black text-white uppercase tracking-tight">
              {champLabel(suggestion.champ)}
            </h3>
          </div>
          {athleteName && (
            <p className="text-[12px] text-[#9CA3AF] mb-4">
              Proposée par <span className="text-white font-bold">{athleteName}</span>
            </p>
          )}

          {/* Diff */}
          <div className="flex items-center gap-3 bg-[#0C0E12] rounded-xl px-4 py-3 mb-3">
            {suggestion.valeurActuelle && (
              <>
                <span className="text-[14px] text-[#6B7280] line-through truncate flex-1">{suggestion.valeurActuelle}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0" aria-hidden>
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </>
            )}
            <span className="text-[15px] text-white font-bold truncate flex-1 text-right">{suggestion.valeurProposee}</span>
          </div>

          {/* Message + time */}
          {suggestion.message && (
            <p className="text-[13px] text-[#9CA3AF] italic mb-2 leading-relaxed">
              &laquo; {suggestion.message} &raquo;
            </p>
          )}
          <p className="text-[11px] text-[#4a4d56] mb-5">{relativeTime(suggestion.createdAt)}</p>

          {/* Actions */}
          {rejecting ? (
            <div className="space-y-3">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => onChangeReason(e.target.value)}
                placeholder="Raison du rejet (optionnel)"
                aria-label="Raison du rejet"
                className="w-full bg-[#0C0E12] border border-white/[0.06] rounded-2xl px-4 py-3 text-[14px] text-white placeholder:text-[#6B7280] focus:border-[#E63946] outline-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancelReject}
                  className="flex-1 h-12 rounded-2xl bg-[#0C0E12] text-[#9CA3AF] text-[14px] font-bold active:bg-white/5"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => { triggerHaptic("Medium"); onReject(); }}
                  className="flex-1 h-12 rounded-2xl bg-[#E63946] text-white text-[14px] font-bold active:bg-[#D42B22]"
                >
                  Confirmer le rejet
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onStartReject}
                className="flex-1 h-12 rounded-2xl border-2 border-[#E63946] text-[#E63946] text-[14px] font-bold active:bg-[#E63946]/10"
              >
                Rejeter
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic("Medium"); onApprove(); }}
                className="flex-1 h-12 rounded-2xl bg-[#22C55E] text-white text-[14px] font-bold active:bg-[#16A34A]"
              >
                Approuver
              </button>
            </div>
          )}
        </div>
        <style jsx>{`
          @keyframes nx-sug-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes nx-sug-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
      </div>
    </>,
    document.body,
  );
}
