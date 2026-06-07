"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurListesMobile — iter 7.15 Sprint 1 (Index seulement)
   Grille verticale des listes du recruteur + sheets Créer/Supprimer.
   Réutilise les hooks TanStack (useRecruiterLists/useCreateList/useDeleteList),
   pattern AnimatePresence + motion.div layout (canon 14.12) pour
   l'entrée/sortie animée. Gating PRO via FeatureGate (canon).
   Le détail d'une liste arrive Sprint 2 → tap carte = toast info.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useRecruiterLists, type RecruiterListSummary } from "@/lib/queries/recruiter/useRecruiterLists";
import { useCreateList } from "@/lib/queries/recruiter/useCreateList";
import { useDeleteList } from "@/lib/queries/recruiter/useDeleteList";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"][d.getMonth()];
    return `${day} ${month}`;
  } catch { return ""; }
}

/* ── Sheet Créer une liste ─────────────────────────────────────── */

function CreateListSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useMobileToast();
  const createMut = useCreateList();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) {
      setName(""); setDescription(""); setSubmitError(null);
    }
  }, [open]);

  if (!mounted) return null;

  const canSubmit = name.trim().length > 0 && !createMut.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      await createMut.mutateAsync({ name, description: description || null });
      triggerHaptic("Medium");
      toast.success({ message: "Liste créée" });
      onClose();
      // Iter 7.16 — scroll-to-top après création. Le tri DESC + optimistic en
      // tête placent déjà la nouvelle liste en index 0 du DOM, mais si l'user
      // avait scrollé vers le bas avant d'ouvrir le sheet, la nouvelle carte
      // est hors viewport. Smooth scroll pour qu'elle soit visible immédiatement
      // avec son animation d'entrée. requestAnimationFrame pour laisser le
      // sheet finir sa fermeture et le DOM se réorganiser avant le scroll.
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch (e) {
      const err = e as { message?: string };
      setSubmitError(err.message || "Erreur lors de la création.");
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
            style={{ maxHeight: "92vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between border-b border-white/[0.06]">
              <button type="button" onClick={onClose} aria-label="Annuler" className="text-[14px] text-white/55 font-medium">
                Annuler
              </button>
              <span className="text-[15px] font-bold text-white">Nouvelle liste</span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`text-[14px] font-bold ${canSubmit ? "text-[#E63946]" : "text-white/30"}`}
              >
                {createMut.isPending ? "..." : "Créer"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] text-white/50 font-bold mb-2">
                  Nom <span className="text-[#E63946]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 80))}
                  placeholder="Ex : QB prioritaires 2026"
                  autoFocus
                  className="w-full bg-white/[0.06] rounded-xl px-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] text-white/50 font-bold mb-2">
                  Description <span className="text-white/40">(optionnel)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                  placeholder="Décris l'objectif de cette liste…"
                  rows={3}
                  className="w-full bg-white/[0.06] rounded-xl px-3 py-2.5 text-[14px] text-white placeholder:text-white/40 outline-none resize-none"
                />
                <p className="text-[11px] text-white/40 mt-1 text-right tabular-nums">{description.length}/200</p>
              </div>
              {submitError && (
                <div className="px-3 py-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30">
                  <p className="text-[13px] text-[#EF4444] font-medium">{submitError}</p>
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

/* ── Sheet Confirmer suppression ──────────────────────────────── */

function ConfirmDeleteSheet({
  open, onClose, list, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  list: RecruiterListSummary | null;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && list && (
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
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="font-head text-[18px] font-black text-white uppercase tracking-tight">
                Supprimer cette liste ?
              </p>
              <p className="text-[14px] text-white/70 leading-relaxed">
                <span className="text-white font-semibold">« {list.name} »</span> sera supprimée.
                Les {list.athleteCount} athlète{list.athleteCount > 1 ? "s" : ""} ne seront pas supprimés
                de tes favoris, juste retirés de cette liste.
              </p>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <button
                type="button"
                onClick={onConfirm}
                className="w-full py-3 rounded-xl bg-[#E63946] active:bg-[#D42B22] text-white font-bold text-[15px] transition-colors"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-white/[0.06] active:bg-white/[0.10] text-white font-semibold text-[15px] transition-colors"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── ListCard ─────────────────────────────────────────────────── */

function ListCard({
  list, onTap, onDelete,
}: {
  list: RecruiterListSummary;
  onTap: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative bg-[#1A1D24] rounded-2xl overflow-hidden">
      {/* Bande accent couleur de la liste */}
      <div className="absolute inset-y-0 left-0 w-[5px]" style={{ backgroundColor: list.color }} />
      <button
        type="button"
        onClick={onTap}
        className="w-full text-left pl-4 pr-3 py-4 active:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold text-white truncate">{list.name}</p>
            {list.description && (
              <p className="text-[13px] text-white/55 mt-0.5 truncate">{list.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-[13px] text-white/70">
              <span className="tabular-nums">
                {list.athleteCount} athlète{list.athleteCount > 1 ? "s" : ""}
              </span>
              {list.dominantSport && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="truncate">{list.dominantSport}</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-white/40 mt-2">
              Modifiée {formatRelativeDate(list.updatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); triggerHaptic("Light"); onDelete(); }}
            aria-label="Plus d'options"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/55 active:bg-white/[0.08] flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>
      </button>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────── */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-6">
      <div className="w-16 h-16 rounded-full bg-[#1A1D24] flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
        </svg>
      </div>
      <p className="text-[16px] font-bold text-white">Aucune liste pour le moment</p>
      <p className="text-[13px] text-white/55 mt-2 max-w-xs leading-relaxed">
        Crée des listes pour organiser tes prospects par sport, position ou stratégie de recrutement.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 px-5 py-3 rounded-xl bg-[#E63946] active:bg-[#D42B22] text-white font-bold text-[14px]"
      >
        Créer ma première liste
      </button>
    </div>
  );
}

/* ── Inner component (PRO-gated content) ──────────────────────── */

function ListesInner() {
  const router = useRouter();
  const { data: lists = [], isLoading } = useRecruiterLists();
  const deleteMut = useDeleteList();
  const toast = useMobileToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<RecruiterListSummary | null>(null);

  const handleTapList = useCallback((list: RecruiterListSummary) => {
    triggerHaptic("Light");
    // Iter 7.22 — filet de sécurité : si l'utilisateur tape sur l'optimistic
    // avant que onSuccess de useCreateList ait remplacé le temp-id, on évite
    // de pousser "temp-XXX" dans l'URL (qui causerait "invalid input syntax
    // for type uuid" en aval). Le remplacement temp → vrai id se fait dès que
    // l'INSERT résout, donc cette fenêtre est très courte (<500ms) mais ce
    // filet la rend impossible à hit.
    if (list.id.startsWith("temp-")) {
      toast.info({ message: "Création en cours…", detail: "Réessaie dans un instant." });
      return;
    }
    router.push(`/recruteur/listes/${list.id}`);
  }, [router, toast]);

  const handleRequestDelete = useCallback((list: RecruiterListSummary) => {
    setConfirmTarget(list);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmTarget) return;
    const snapshot = confirmTarget;
    setConfirmTarget(null);
    try {
      await deleteMut.mutateAsync(snapshot.id);
      triggerHaptic("Medium");
      toast.success({ message: "Liste supprimée", detail: snapshot.name });
    } catch (e) {
      const err = e as { message?: string };
      toast.error({ message: "Échec", detail: err.message || "Impossible de supprimer la liste." });
    }
  }, [confirmTarget, deleteMut, toast]);

  return (
    <div className="min-h-screen bg-[#111317] text-white pb-[calc(64px+env(safe-area-inset-bottom))]">
      {/* Header sticky opaque (canon 14.11 : pas de backdrop-blur) */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-4 pt-3 pb-3 flex items-center justify-between">
          {/* Iter 7.19 Section B — count retiré (épuré). */}
          <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
            Mes listes
          </h1>
          <button
            type="button"
            onClick={() => { triggerHaptic("Light"); setCreateOpen(true); }}
            aria-label="Créer une liste"
            className="w-9 h-9 rounded-full bg-[#E63946] active:bg-[#D42B22] flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-[#1A1D24] animate-pulse" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {lists.map((l) => (
                <motion.div
                  key={l.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <ListCard
                    list={l}
                    onTap={() => handleTapList(l)}
                    onDelete={() => handleRequestDelete(l)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CreateListSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <ConfirmDeleteSheet
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        list={confirmTarget}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* ── Outer component (PRO gate canon) ─────────────────────────── */

export function RecruteurListesMobile() {
  // FeatureGate conditional render — UpgradePlaceholder s'affiche si tier < pro.
  // Copy déjà définie pour "custom_lists" dans FEATURE_DESCRIPTIONS (canon).
  // Ce gate empêche tout fetch listes côté non-PRO (pas de leak réseau).
  return (
    <FeatureGate feature="custom_lists" requiredTier="pro">
      <ListesInner />
    </FeatureGate>
  );
}
