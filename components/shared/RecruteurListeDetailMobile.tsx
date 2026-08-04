"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurListeDetailMobile — iter 7.17 Sprint 2
   Détail d'une liste : header + stats bar + cartes athlètes
   (visuel Pipeline-style canon 14.1, horizontal photo-gauche) +
   swipe-gauche pour retirer + tap-profil. Pas de notes ce sprint.
   Gating PRO via FeatureGate (canon 14.x).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { useListAthletes, type ListAthlete, type ListMetadata } from "@/lib/queries/recruiter/useListAthletes";
import { useRemoveListMember } from "@/lib/queries/recruiter/useRemoveListMember";
import { useDeleteList } from "@/lib/queries/recruiter/useDeleteList";
import { usePipelineNotes } from "@/lib/queries/recruiter/usePipelineNotes";
import { useAddPipelineNote } from "@/lib/queries/recruiter/useAddPipelineNote";
import { useListNotes } from "@/lib/queries/recruiter/useListNotes";
import { useAddListNote } from "@/lib/queries/recruiter/useAddListNote";
import { getStatusConfig, type RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { AddAthleteToListSheet } from "@/components/shared/AddAthleteToListSheet";
import { formatRelativeDate } from "@/lib/utils/formatRelativeDate";
import { triggerHaptic } from "@/lib/haptics";


/* ── ListAthleteCardMobile ─────────────────────────────────────
   Réplique le visuel PipelineCardMobile (canon 14.1 photo-gauche
   bleed + gradient fade single-surface to-right finissant #1A1D24).
   Wrappé dans framer-motion drag="x" — swipe gauche révèle action
   "Retirer". Sans swipe-stage (différence avec Pipeline). */

const REMOVE_THRESHOLD = 110;

function ListAthleteCardMobile({
  athlete,
  onTap,
  onRemove,
  onTapNotes,
}: {
  athlete: ListAthlete;
  onTap: () => void;
  onRemove: () => void;
  onTapNotes: () => void;
}) {
  const x = useMotionValue(0);
  // Action "Retirer" révélée à droite quand l'utilisateur swipe vers la gauche
  // (x devient négatif). On affiche le bouton dans l'overlay et on l'opacifie
  // proportionnellement au déplacement.
  const removeOpacity = useTransform(x, [-REMOVE_THRESHOLD, -40, 0], [1, 0.5, 0]);
  const fullName = `${athlete.firstName} ${athlete.lastName}`.trim() || "Athlète";
  const [first, ...rest] = fullName.split(/\s+/);
  const statusConfig = athlete.recruitmentStatus
    ? getStatusConfig(athlete.recruitmentStatus as RecruitmentStatus)
    : null;

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Overlay action "Retirer" — derrière la carte, révélé au swipe gauche */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-[#E63946]"
        style={{ opacity: removeOpacity, width: "100%" }}
      >
        <div className="flex items-center gap-2 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
          <span className="text-[14px] font-bold uppercase tracking-wider">Retirer</span>
        </div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -REMOVE_THRESHOLD - 40, right: 0 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -REMOVE_THRESHOLD) {
            triggerHaptic("Medium");
            onRemove();
          } else {
            // snap back
            x.set(0);
          }
        }}
      >
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); onTap(); }}
          className="w-full relative overflow-hidden active:opacity-80 transition-opacity text-left bg-[#1A1D24]"
          style={{ height: 132 }}
        >
          {/* Photo bleed gauche 150px (canon 14.1) */}
          {athlete.photoUrl ? (
            <div className="absolute left-0 top-0 bottom-0 w-[150px] z-0 pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={athlete.photoUrl}
                alt=""
                crossOrigin="anonymous"
                className="w-full h-full object-cover object-[center_top]"
              />
            </div>
          ) : (
            <div className="absolute left-0 top-0 bottom-0 w-[150px] z-0 flex items-center justify-center pointer-events-none">
              <span
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: 32, fontWeight: 900,
                  color: "rgba(255,255,255,0.06)",
                  letterSpacing: "0.05em", lineHeight: 1,
                }}
              >
                {(first[0] ?? "")}{(rest[0]?.[0] ?? "")}
              </span>
            </div>
          )}
          {/* Gradient overlay finissant #1A1D24 OPAQUE (single-surface, canon 14.1) */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[150px] z-[1] pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, transparent 0%, transparent 38%, rgba(26,29,36,0.9) 80%, #1A1D24 100%)",
            }}
          />

          {/* Iter 7.28 Section 2 — carte épurée : école+promotion retirées
              (dispo dans le profil athlète, redondance levée). Espace libéré
              utilisé pour agrandir nom (16→18) et position·# (13→14), carte
              légèrement plus haute (120→132) pour aérer. */}
          <div className="absolute inset-y-0 left-[150px] right-0 z-10 flex flex-col justify-center px-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-white font-bold text-[18px] leading-tight truncate">{fullName}</p>
              {athlete.isVerified && (
                <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3B82F6]">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
              <span className="flex-shrink-0 ml-auto flex items-center gap-1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-[15px] font-bold text-white tabular-nums">{athlete.coachRating.toFixed(1)}</span>
              </span>
            </div>

            <p className="text-[14px] text-[#9CA3AF] mt-1.5 truncate">
              {[athlete.positionAbbr || athlete.sportName, athlete.jersey ? `#${athlete.jersey}` : null]
                .filter(Boolean).join(" · ") || "—"}
            </p>

            {statusConfig && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusConfig.color }} />
                <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: statusConfig.color }}>
                  {statusConfig.shortLabel ?? statusConfig.label}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Iter 7.18 Sprint 3 — bouton Notes (icône bulle) coin bas-droit.
            stopPropagation + onPointerDown stop pour ne pas déclencher le
            tap-carte ni initier le drag framer. */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); triggerHaptic("Light"); onTapNotes(); }}
          aria-label="Notes"
          className="absolute right-2 bottom-2 z-20 w-8 h-8 rounded-full bg-white/[0.10] active:bg-white/[0.18] flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </motion.div>
    </div>
  );
}

/* ── formatRelativeDate promu vers lib/utils/formatRelativeDate (iter 7.30b)
   pour réutilisation par RecruteurActivitesMobile. Import en tête du fichier. */

/* ── AthleteNotesSheet — notes GLOBALES par athlète (recruiter_notes) ─── */

function AthleteNotesSheet({
  open, onClose, athlete,
}: {
  open: boolean;
  onClose: () => void;
  athlete: ListAthlete | null;
}) {
  const toast = useMobileToast();
  const athleteId = athlete?.athleteId ?? null;
  const { data: notes = [], isLoading } = usePipelineNotes(open ? athleteId : null);
  const addMut = useAddPipelineNote();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setContent(""); setError(null); } }, [open]);

  if (!mounted) return null;

  const handleSubmit = async () => {
    if (!athleteId || !content.trim() || addMut.isPending) return;
    setError(null);
    try {
      await addMut.mutateAsync({ athleteId, content });
      triggerHaptic("Light");
      setContent("");
    } catch (e) {
      const err = e as { message?: string };
      void triggerHaptic("Error");
        setError(err.message || "Erreur lors de l'ajout.");
    }
  };

  const canSubmit = !!content.trim() && !addMut.isPending;
  const fullName = athlete ? `${athlete.firstName} ${athlete.lastName}`.trim() : "";

  return createPortal(
    <AnimatePresence>
      {open && athlete && (
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
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ maxHeight: "85vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-11 h-11 rounded-full bg-white/[0.06] active:bg-white/[0.10] flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
              <span className="text-[15px] font-bold text-white truncate px-3">Notes</span>
              <div className="w-9" />
            </div>

            <div className="px-4 py-4 border-b border-white/[0.06]">
              <p className="font-head text-[18px] font-black text-white uppercase tracking-tight truncate">
                {fullName}
              </p>
              <p className="text-[12px] text-white/55 mt-1 leading-relaxed">
                Ces notes sont visibles partout (profil + toutes tes listes).
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {isLoading ? (
                <>
                  <div className="h-16 rounded-2xl nx-pulse-notes" />
                  <div className="h-16 rounded-2xl nx-pulse-notes" />
                </>
              ) : notes.length === 0 ? (
                <p className="text-[14px] text-white/55 italic text-center py-8">
                  Aucune note sur cet athlète.
                </p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
                    <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap break-words">
                      {n.content}
                    </p>
                    <p className="text-[11px] text-white/40 mt-1.5">
                      {formatRelativeDate(n.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 pt-3 pb-4 border-t border-white/[0.06] space-y-2">
              {error && (
                <div className="px-3 py-2 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30">
                  <p className="text-[12px] text-[#EF4444] font-medium">{error}</p>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 500))}
                  placeholder="Ajouter une note…"
                  rows={2}
                  className="flex-1 bg-white/[0.06] rounded-2xl px-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none resize-none"
                />
                <button
                  type="button"
                  onClick={() => { void triggerHaptic("Light"); if (canSubmit) { handleSubmit().catch(() => { toast.error({ message: "Échec" }); }); } }}
                  disabled={!canSubmit}
                  aria-label="Ajouter"
                  className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    canSubmit ? "bg-[#E63946] active:bg-[#D42B22]" : "bg-white/[0.06]"
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canSubmit ? "#FFFFFF" : "#4a4d56"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── ListNotesPanel — feed notes de liste INLINE (iter 7.28 Section 3) ───
   Avant : bottom sheet portal accessible uniquement via le menu ⋮ →
   peu découvrable. Maintenant : panneau plein écran sous le segmented
   control "Athlètes | Notes". Réutilise useListNotes + useAddListNote.
   Pas de portal, pas de motion, pas de mounted gate (toujours rendu
   quand view === "notes"). */

function ListNotesPanel({ listId }: { listId: string }) {
  const toast = useMobileToast();
  const { data: notes = [], isLoading } = useListNotes(listId);
  const addMut = useAddListNote();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim() || addMut.isPending) return;
    setError(null);
    try {
      await addMut.mutateAsync({ listId, content });
      triggerHaptic("Light");
      setContent("");
    } catch (e) {
      const err = e as { message?: string };
      void triggerHaptic("Error");
        setError(err.message || "Erreur lors de l'ajout.");
    }
  };

  const canSubmit = !!content.trim() && !addMut.isPending;

  return (
    <div className="flex flex-col">
      {/* Feed des notes */}
      <div className="px-4 pt-3 pb-3 space-y-3">
        {isLoading ? (
          <>
            <div className="h-16 rounded-2xl nx-pulse-notes" />
            <div className="h-16 rounded-2xl nx-pulse-notes" />
          </>
        ) : notes.length === 0 ? (
          <p className="text-[14px] text-white/55 italic text-center py-12">
            Aucune note sur cette liste.
          </p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
              <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap break-words">
                {n.content}
              </p>
              <p className="text-[11px] text-white/40 mt-1.5">
                {formatRelativeDate(n.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Composer sticky bottom (au-dessus de la TabBar mobile).
          `--kbd-h` est ajouté À LA MAIN ici, alors que la règle globale de
          globals.css suffit partout ailleurs : ce conteneur pose son `bottom`
          en STYLE EN LIGNE, qui bat toute feuille. Sans cet ajout, la règle
          serait écrasée et le champ de note resterait sous le clavier — c'est
          précisément l'un des deux écrans signalés. */}
      <div
        className="sticky bottom-0 bg-[#111317] border-t border-white/[0.06] px-4 pt-3 space-y-2"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          bottom: "calc(64px + env(safe-area-inset-bottom) + var(--kbd-h, 0px))",
        }}
      >
        {error && (
          <div className="px-3 py-2 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30">
            <p className="text-[12px] text-[#EF4444] font-medium">{error}</p>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 500))}
            placeholder="Note datée pour cette liste…"
            rows={2}
            className="flex-1 bg-white/[0.06] rounded-2xl px-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none resize-none"
          />
          <button
            type="button"
            onClick={() => { void triggerHaptic("Light"); if (canSubmit) { handleSubmit().catch(() => { toast.error({ message: "Échec" }); }); } }}
            disabled={!canSubmit}
            aria-label="Ajouter"
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              canSubmit ? "bg-[#E63946] active:bg-[#D42B22]" : "bg-white/[0.06]"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canSubmit ? "#FFFFFF" : "#4a4d56"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SegmentedTabs (iter 7.28 Section 3) — pill control iOS style ─── */

function SegmentedTabs<T extends string>({
  value, onChange, items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; badge?: number }[];
}) {
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-full p-1 w-full">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => { triggerHaptic("Light"); onChange(it.value); }}
            className={`nx-mobile-touch-min inline-flex items-center justify-center flex-1 px-4 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] transition-all ${
              active
                ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]"
                : "text-[#9CA3AF] active:text-white"
            }`}
          >
            {it.label}
            {typeof it.badge === "number" && it.badge > 0 && (
              <span className={`ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] tabular-nums ${
                active ? "bg-white/25 text-white" : "bg-white/[0.10] text-white/70"
              }`}>
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── ListActionSheet (menu ⋮) — iOS action sheet ──────────────── */

interface SheetAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function ListActionSheet({
  open, onClose, actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: SheetAction[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-3 bottom-3 z-[75] flex flex-col gap-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="rounded-2xl bg-[#1A1D24] overflow-hidden">
              {actions.map((a, idx) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={a.disabled}
                  onClick={a.disabled ? undefined : () => { triggerHaptic("Light"); a.onClick(); }}
                  className={`w-full flex items-center gap-3 px-4 h-14 text-left transition-colors ${
                    idx > 0 ? "border-t border-white/[0.06]" : ""
                  } ${
                    a.disabled ? "opacity-40" : "active:bg-white/[0.04]"
                  }`}
                >
                  <span className="flex-shrink-0">{a.icon}</span>
                  <span className={`text-[15px] font-medium ${a.destructive ? "text-[#E63946]" : "text-white"}`}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#1A1D24] h-14 text-[15px] font-bold text-white active:bg-white/[0.04] transition-colors"
            >
              Annuler
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── ConfirmDeleteListSheet (réutilisé Sprint 1 pattern) ─────── */

function ConfirmDeleteListSheet({
  open, onClose, list, athleteCount, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  list: ListMetadata | null;
  athleteCount: number;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  // Iter 7.20 Section A — guard "&& list" retiré (cf. ListNotesSheet) :
  // le sheet s'ouvre même si la metadata list n'est pas encore chargée.
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
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-4 py-5 space-y-3">
              <p className="font-head text-[18px] font-black text-white uppercase tracking-tight">
                Supprimer cette liste ?
              </p>
              <p className="text-[14px] text-white/70 leading-relaxed">
                {list?.name
                  ? <><span className="text-white font-semibold">« {list.name} »</span> sera supprimée. </>
                  : "Cette liste sera supprimée. "}
                Les {athleteCount} athlète{athleteCount > 1 ? "s" : ""} ne seront pas supprimés
                de tes favoris, juste retirés de cette liste.
              </p>
            </div>
            <div className="px-4 pb-5 space-y-2">
              <button
                type="button"
                onClick={onConfirm}
                className="w-full py-3 rounded-2xl bg-[#E63946] active:bg-[#D42B22] text-white font-bold text-[15px] transition-colors"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-white/[0.06] active:bg-white/[0.10] text-white font-semibold text-[15px] transition-colors"
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

/* ── StatsBar ──────────────────────────────────────────────── */

function StatsBar({
  total, verifiedCount, dominantSport, avgRating,
}: {
  total: number;
  verifiedCount: number;
  dominantSport: string | null;
  avgRating: number;
}) {
  // Iter 7.28 Section 1 — étoile cote rendue séparément en doré canon (#F59E0B)
  // pour cohérence avec les étoiles des cartes athlètes. Le `rating` slot porte
  // un flag dédié pour appliquer la couleur or à l'étoile, le chiffre reste blanc.
  const items: { label: string; value: string; rating?: boolean }[] = [
    { label: `athlète${total > 1 ? "s" : ""}`, value: String(total) },
    { label: total > 1 ? "vérifiés" : "vérifié", value: String(verifiedCount) },
  ];
  if (dominantSport) items.push({ label: dominantSport, value: "" });
  if (avgRating > 0) items.push({ label: "cote moy.", value: avgRating.toFixed(1), rating: true });

  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/70">
      {items.map((it, idx) => (
        <span key={it.label + idx} className="flex items-center gap-1">
          {idx > 0 && <span className="text-white/30">·</span>}
          {it.rating && (
            <span className="text-[#F59E0B] font-semibold leading-none">★</span>
          )}
          {it.value && <span className="text-white font-semibold tabular-nums">{it.value}</span>}
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ── Inner (PRO-gated) ─────────────────────────────────────── */

function DetailInner({ listId }: { listId: string }) {
  const router = useRouter();
  const toast = useMobileToast();
  const { list, athletes, isLoading, stats } = useListAthletes(listId);
  const removeMut = useRemoveListMember();
  const deleteMut = useDeleteList();

  // Iter 7.18 Sprint 3 — états des sheets.
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [athleteNotesTarget, setAthleteNotesTarget] = useState<ListAthlete | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // Iter 7.24 Sprint 4b — état du sheet "Ajouter un athlète".
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  // Iter 7.28 Section 3 — segmented control : "athletes" (défaut) vs "notes".
  // Les notes de liste sortent du menu ⋮ vers une vue inline découvrable.
  const [view, setView] = useState<"athletes" | "notes">("athletes");
  // Compteur de notes pour afficher sur le segment ("Notes · N"). Lu indépendamment
  // du segment actif pour que le badge soit visible dès qu'on arrive sur le détail.
  const { data: notesPreview = [] } = useListNotes(listId);

  // Iter 7.24 — Set des athleteId déjà dans la liste, calculé depuis useListAthletes.
  // Passé au sheet pour masquer ces athlètes de la liste de favoris proposés.
  const existingIds = useMemo(
    () => new Set(athletes.map((a) => a.athleteId)),
    [athletes],
  );

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    // Iter 7.20 Section A — router.push explicit vers l'Index au lieu de
    // router.back(). router.back() avec historique pollué (deep-link refresh,
    // matchDynamicRoute replaces) peut retomber sur "/" → fallback /auth (login).
    // push garantit le retour à l'Index peu importe l'état history.
    router.push("/recruteur/listes");
  }, [router]);

  const handleTapAthlete = useCallback((a: ListAthlete) => {
    triggerHaptic("Light");
    // Iter 7.18 Sprint 3 — back-nav précis : on encode l'id de la liste pour
    // que le back du profil revienne au DÉTAIL spécifique (pas l'Index).
    try { sessionStorage.setItem("lastRecruiterTab", `list-detail:${listId}`); } catch { /* no-op */ }
    router.push(`/recruteur/athletes/${a.athleteId}`);
  }, [router, listId]);

  const handleRemove = useCallback(async (a: ListAthlete) => {
    try {
      await removeMut.mutateAsync({
        listId,
        athleteId: a.athleteId,
        memberId: a.memberId,
      });
      toast.success({
        message: "Retiré de la liste",
        detail: `${a.firstName} ${a.lastName} reste dans tes favoris.`,
      });
    } catch (e) {
      const err = e as { message?: string };
      toast.error({ message: "Échec", detail: err.message || "Impossible de retirer l'athlète." });
    }
  }, [listId, removeMut, toast]);

  const handleConfirmDelete = useCallback(async () => {
    // Iter 7.21 Section D — ne PAS fermer le sheet avant le succès. Avant :
    // si la mutation échouait (RLS, auth, réseau), le sheet était déjà fermé →
    // utilisateur ne voyait que le toast d'erreur sans contexte. Le sheet ferme
    // SEULEMENT après le succès confirmé.
    try {
      await deleteMut.mutateAsync(listId);
      toast.success({ message: "Liste supprimée", detail: list?.name });
      setConfirmDeleteOpen(false);
      router.push("/recruteur/listes");
    } catch (e) {
      const err = e as { message?: string; code?: string };
      // Surface l'erreur exacte (code + message Postgres si dispo) pour
      // diagnostiquer en cas d'échec récurrent (RLS, FK, etc.).
      const detail = err.code ? `[${err.code}] ${err.message ?? ""}` : err.message;
      toast.error({ message: "Échec suppression", detail: detail || "Erreur inconnue." });
      // eslint-disable-next-line no-console
      console.error("[handleConfirmDelete]", e);
    }
  }, [deleteMut, listId, list?.name, router, toast]);

  return (
    <div className="min-h-screen bg-[#111317] text-white pb-[calc(64px+env(safe-area-inset-bottom))]">
      {/* Header sticky opaque (canon 14.11) */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-4 pt-2 pb-2 flex items-center gap-2 min-h-[52px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] flex-shrink-0"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {/* Iter 7.20 Section A — placeholder "…" Unicode supprimé : il était
              perçu comme un "•••" parasite à côté du back-arrow. Skeleton bar
              opaque pendant le fetch, vrai nom + dot couleur après chargement. */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {list ? (
              <>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: list.color }} />
                <h1 className="font-head text-[18px] font-black text-white uppercase tracking-tight truncate">
                  {list.name}
                </h1>
              </>
            ) : (
              <div className="h-4 w-32 rounded bg-white/[0.08] animate-pulse" />
            )}
          </div>
          {/* Iter 7.24 Sprint 4b — bouton "+ Ajouter un athlète" dans le header,
              à gauche du menu ⋮. 1 tap → ouvre AddAthleteToListSheet (sélecteur
              de favoris filtré côté client, exclut les membres déjà présents).
              Iter 7.28 Section 3 — visible UNIQUEMENT sur le segment Athlètes
              (sans pertinence sur la vue Notes). */}
          {view === "athletes" && (
          <button
            type="button"
            aria-label="Ajouter un athlète"
            onClick={() => { triggerHaptic("Light"); setAddAthleteOpen(true); }}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] flex-shrink-0 text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
          </button>
          )}
          <button
            type="button"
            aria-label="Plus d'options"
            onClick={() => { triggerHaptic("Light"); setActionSheetOpen(true); }}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] flex-shrink-0 text-white/70"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        {/* Iter 7.28 Section 3 — stats bar visible UNIQUEMENT sur le segment
            athlètes (les notes ont leur propre vue plein écran). */}
        {view === "athletes" && !isLoading && athletes.length > 0 && (
          <StatsBar
            total={stats.total}
            verifiedCount={stats.verifiedCount}
            dominantSport={stats.dominantSport}
            avgRating={stats.avgRating}
          />
        )}

        {/* Iter 7.28 Section 3 — segmented control Athlètes | Notes. Badge sur
            "Notes" affiche le compteur quand > 0 pour signaler le contenu. */}
        <div className="px-4 pt-1 pb-3">
          <SegmentedTabs<"athletes" | "notes">
            value={view}
            onChange={setView}
            items={[
              { value: "athletes", label: "Athlètes" },
              { value: "notes", label: "Notes", badge: notesPreview.length },
            ]}
          />
        </div>
      </div>

      {/* Iter 7.28 Section 3 — body conditionnel selon le segment actif. */}
      {view === "athletes" ? (
        <div className="px-4 pt-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[132px] rounded-2xl bg-[#1A1D24] animate-pulse" />
              ))}
            </div>
          ) : athletes.length === 0 ? (
            <EmptyState onAdd={() => { triggerHaptic("Light"); setAddAthleteOpen(true); }} />
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {athletes.map((a) => (
                  <motion.div
                    key={a.athleteId}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, x: -60 }}
                    transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <ListAthleteCardMobile
                      athlete={a}
                      onTap={() => handleTapAthlete(a)}
                      onRemove={() => handleRemove(a)}
                      onTapNotes={() => setAthleteNotesTarget(a)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <ListNotesPanel listId={listId} />
      )}

      {/* Iter 7.18 Sprint 3 — sheets */}
      <AthleteNotesSheet
        open={!!athleteNotesTarget}
        onClose={() => setAthleteNotesTarget(null)}
        athlete={athleteNotesTarget}
      />
      {/* Iter 7.28 Section 3 — ListNotesSheet retiré : les notes sont
          maintenant accessibles via le segmented control (vue inline). */}
      <ListActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        actions={[
          {
            label: "Renommer",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <polygon points="18.5 2.5 21.5 5.5 12 15 8 16 9 12 18.5 2.5" />
              </svg>
            ),
            onClick: () => {},
            disabled: true,
          },
          {
            label: "Supprimer la liste",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            ),
            onClick: () => { setActionSheetOpen(false); setConfirmDeleteOpen(true); },
            destructive: true,
          },
        ]}
      />
      <ConfirmDeleteListSheet
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        list={list}
        athleteCount={stats.total}
        onConfirm={handleConfirmDelete}
      />

      {/* Iter 7.24 Sprint 4b — sheet sélecteur d'athlètes (source = favoris). */}
      <AddAthleteToListSheet
        open={addAthleteOpen}
        onClose={() => setAddAthleteOpen(false)}
        listId={listId}
        listName={list?.name ?? null}
        existingIds={existingIds}
      />

      <style jsx>{`
        @keyframes nx-pulse-notes-kf { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-notes) { background: #1A1D24; animation: nx-pulse-notes-kf 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <SharedEmptyState
      image="/empty/nexus-empty-shortlist.png"
      title="Aucun athlète dans cette liste"
      description="Ajoute des athlètes depuis tes favoris pour commencer à les organiser ici."
      action={{ label: "Ajouter un athlète", onClick: onAdd }}
    />
  );
}

/* ── Outer (PRO gate) ─────────────────────────────────────── */

export function RecruteurListeDetailMobile({ listId }: { listId: string }) {
  return (
    <FeatureGate feature="custom_lists" requiredTier="pro">
      <DetailInner listId={listId} />
    </FeatureGate>
  );
}
