"use client";

/* ═══════════════════════════════════════════════════════════════
   AddToListSheet — iter 7.23 Sprint 4
   Bottom Sheet Portal (canon 14.x) qui affiche les listes du recruteur
   avec checkboxes pré-cochées si l'athlète y est déjà. Chaque tap
   toggle immédiat (optimistic, pas de bouton Valider) — pattern iOS.
   Réutilise useRecruiterLists (Sprint 1). PRO-only (le caller décide
   du rendu conditionnel).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useRecruiterLists, type RecruiterListSummary } from "@/lib/queries/recruiter/useRecruiterLists";
import { useAthleteListMembership } from "@/lib/queries/recruiter/useAthleteListMembership";
import { useToggleListMember } from "@/lib/queries/recruiter/useToggleListMember";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

export interface AddToListSheetProps {
  open: boolean;
  onClose: () => void;
  athleteId: string;
  athleteFullName: string;
}

export function AddToListSheet({ open, onClose, athleteId, athleteFullName }: AddToListSheetProps) {
  const toast = useMobileToast();
  const { data: lists = [], isLoading: listsLoading } = useRecruiterLists();
  const { data: membership = new Set<string>(), isLoading: membershipLoading } = useAthleteListMembership(
    open ? athleteId : null,
  );
  const toggleMut = useToggleListMember();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const handleToggle = async (list: RecruiterListSummary) => {
    if (list.id.startsWith("temp-")) {
      toast.info({ message: "Création en cours…", detail: "Réessaie dans un instant." });
      return;
    }
    const isCurrentlyMember = membership.has(list.id);
    triggerHaptic("Light");
    try {
      await toggleMut.mutateAsync({
        listId: list.id,
        athleteId,
        isCurrentlyMember,
      });
      // Toast léger après confirmation côté DB.
      toast.success({
        message: isCurrentlyMember ? `Retiré de ${list.name}` : `Ajouté à ${list.name}`,
      });
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const detail = err.code ? `[${err.code}] ${err.message ?? ""}` : err.message;
      toast.error({ message: "Échec", detail: detail || "Erreur inconnue." });
      // eslint-disable-next-line no-console
      console.error("[AddToListSheet toggle]", e);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#111317] rounded-t-3xl flex flex-col"
            style={{ maxHeight: "85vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between border-b border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-9 h-9 rounded-full bg-white/[0.06] active:bg-white/[0.10] flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
              <span className="text-[15px] font-bold text-white truncate px-3">Ajouter à une liste</span>
              <div className="w-9" />
            </div>

            <div className="px-5 py-3 border-b border-white/[0.06]">
              <p className="text-[13px] text-white/70 truncate">{athleteFullName}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {listsLoading || membershipLoading ? (
                <div className="px-5 py-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-[#1A1D24] animate-pulse" />
                  ))}
                </div>
              ) : lists.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12 px-6">
                  <p className="text-[15px] font-bold text-white">Aucune liste</p>
                  <p className="text-[13px] text-white/55 mt-2 max-w-xs leading-relaxed">
                    Crée une liste depuis l&apos;onglet « Mes listes » pour commencer à organiser tes prospects.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {lists.map((l) => {
                    const checked = membership.has(l.id);
                    const isTemp = l.id.startsWith("temp-");
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => handleToggle(l)}
                        disabled={isTemp}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                          isTemp ? "opacity-50" : "active:bg-white/[0.04]"
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: l.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-white truncate">{l.name}</p>
                          <p className="text-[12px] text-white/55 mt-0.5 tabular-nums">
                            {l.athleteCount} athlète{l.athleteCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        {/* Checkbox iOS-style : cercle vide ou cercle plein avec check */}
                        <span
                          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                            checked ? "bg-[#E63946]" : "bg-white/[0.08] border border-white/20"
                          }`}
                        >
                          {checked && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
