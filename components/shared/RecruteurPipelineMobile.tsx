"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurPipelineMobile — Page Pipeline mobile-native (iter 6.1a)
   MVP utilisable : header sticky + tabs stages scrollables + sections
   collapsibles par stage + cards rows compactes + bottom sheet detail
   avec grid 6 stages + actions secondaires + toggle priorité optimiste
   + notes inline.

   Réservé iter 6.1b :
     - Swipe Tinder gauche/droite sur card (change stage)
     - Optimistic update TanStack via onMutate/onError
     - ⋮ Menu Apple Reminders (Tri / Filtre / Mode focus)
     - Toast Undo (5s) sur stage change
     - Stage change animation (motion.div layout)
     - Bug fix retire desktop

   Référence design : docs/mobile-design-system.md.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { usePipelineCards } from "@/lib/queries/recruiter/usePipelineCards";
import {
  sortPipelineCards,
  PIPELINE_SORT_OPTIONS,
  DEFAULT_PIPELINE_SORT,
  type PipelineSortMode,
} from "@/lib/pipeline/sortPipelineCards";
import { usePipelineNotes } from "@/lib/queries/recruiter/usePipelineNotes";
import { useUpdatePipelineStage } from "@/lib/queries/recruiter/useUpdatePipelineStage";
import { useTogglePipelinePriority } from "@/lib/queries/recruiter/useTogglePipelinePriority";
import { useUpsertAthleteGrade } from "@/lib/queries/recruiter/useUpsertAthleteGrade";
import { GradeChip, GradePicker } from "@/components/shared/GradeChip";
import type { Grade } from "@/lib/config/grades";
import { useUpdateNextAction } from "@/lib/queries/recruiter/useUpdateNextAction";
import { useAddPipelineNote } from "@/lib/queries/recruiter/useAddPipelineNote";
import { useRemoveFromPipeline } from "@/lib/queries/recruiter/useRemoveFromPipeline";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { MobilePicker } from "@/components/mobile/MobilePicker";
import VisitCalendarCard from "@/components/shared/VisitCalendarCard";
import VisitDateEditor from "@/components/shared/VisitDateEditor";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import { triggerHaptic } from "@/lib/haptics";

/* ── Stages config (DB enum stage) ───────────────────────────── */

interface StageConfig {
  key: string;        // DB stage (UPPERCASE)
  lower: string;      // card.status (lowercase)
  label: string;
  color: string;
}

// Iter 6.1c — palette stages corrigée. Les stages PIPELINE (privés au
// recruteur) ≠ statuts globaux athlète. Bug fixé : LETTRE_SIGNEE était
// VERT, confondu avec le statut OUVERT global. Maintenant logique
// progression : gris → bleu → ambre → ambre → rouge → rouge.
const STAGES: StageConfig[] = [
  { key: "IDENTIFIE",        lower: "identifie",        label: "Identifié",        color: "#6B7280" }, // gris
  { key: "CONTACTE",         lower: "contacte",         label: "Contacté",         color: "#3B82F6" }, // bleu (in-progress)
  { key: "EN_DISCUSSION",    lower: "en_discussion",    label: "En discussion",    color: "#F59E0B" }, // ambre
  { key: "VISITE_PLANIFIEE", lower: "visite_planifiee", label: "Visite planifiée", color: "#F59E0B" }, // ambre
  { key: "ENGAGE",           lower: "engage",           label: "Engagé",           color: "#E63946" }, // rouge Nexus
  { key: "LETTRE_SIGNEE",    lower: "lettre_signee",    label: "Lettre signée",    color: "#E63946" }, // rouge Nexus
];

const STAGE_BY_LOWER: Record<string, StageConfig> = Object.fromEntries(STAGES.map((s) => [s.lower, s]));

/* ── Recruitment status (global athlète) palette ─────────────── */

function statusGlobalColor(status: string): { dot: string; label: string; animated: boolean } | null {
  switch (status) {
    case "OUVERT":
      return { dot: "#22C55E", label: "OUVERT", animated: false };
    case "EN_PROCESSUS":
      return { dot: "#F59E0B", label: "EN PROCESSUS", animated: true };
    case "RECRUTE":
      return { dot: "#E63946", label: "RECRUTÉ", animated: false };
    case "RETIRE":
      return { dot: "#6B7280", label: "RETIRÉ", animated: false };
    default:
      return null;
  }
}

/* ── Visite planifiée — pilule de date ───────────────────────── */

/** « Visite · 12 août » à partir de l'instant ISO (recruiter_pipeline.visit_at).
 *  Formaté en heure locale FR-CA (produit québécois) ; retourne null si l'ISO
 *  est invalide pour que l'appelant n'affiche rien. */
function formatVisitPill(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Visite · ${d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}`;
}

/* ── Relance (next_action_at) — pilule de date ───────────────────
   PÉRIMÈTRE : la DATE seulement. `next_action_note` n'est ni lue, ni
   écrite, ni affichée sur mobile — frontière assumée, cf.
   docs/pipeline-recruteur-frontieres.md (la RLS de recruiter_pipeline est
   par LIGNE : le coach reçoit déjà la note, l'UI ne la propage pas).

   `next_action_at` est une colonne `date` : PostgREST la rend en
   "AAAA-MM-JJ" nu. `new Date("2026-09-03")` parserait MINUIT UTC, soit le
   2 septembre 20h à Montréal — un jour d'écart à l'affichage ET sur le
   verdict « en retard ». D'où le découpage manuel en minuit LOCAL. */
function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** « Relance · 12 sept » + drapeau retard (date strictement avant aujourd'hui).
 *  `now` vient de useClientNow() : à 0 (premier rendu) on ne déclare AUCUN
 *  retard, même prudence que la pill visite côté web — sinon la carte vire
 *  au gold pendant l'hydratation puis se corrige. */
function formatRelancePill(value: string | null | undefined, now: number): { label: string; isLate: boolean } | null {
  const d = parseDateOnly(value);
  if (!d) return null;
  let isLate = false;
  if (now) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    isLate = d.getTime() < today.getTime();
  }
  return {
    label: `Relance · ${d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}`,
    isLate,
  };
}

/** Timestamp client stable — 0 au premier rendu (jamais de Date.now() pendant
 *  le render : hydratation serveur/client divergente). Réplique de
 *  useClientNow() dans app/recruteur/pipeline/page.tsx. */
function useClientNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); }, []);
  return now;
}

/* ── PipelineHeader ──────────────────────────────────────────── */

function PipelineHeader({ totalCount, onMenuTap }: { totalCount: number; onMenuTap: () => void }) {
  return (
    <div className="px-4 pb-3 bg-[#111317]" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="font-head text-[24px] font-black text-white uppercase tracking-tight">Mon processus</h1>
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">
            {totalCount} athlète{totalCount !== 1 ? "s" : ""} · Saison 2025-2026
          </p>
        </div>
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); onMenuTap(); }}
          aria-label="Menu"
          className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
            <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── StageTabsSticky ─────────────────────────────────────────── */

function StageTabsSticky({
  counts, activeStage, scrolled, onTabTap,
}: {
  counts: Record<string, number>;
  activeStage: string;
  scrolled: boolean;
  onTabTap: (lower: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Auto-scroll horizontal pour garder l'onglet actif visible
  useEffect(() => {
    if (!containerRef.current) return;
    const btn = containerRef.current.querySelector<HTMLButtonElement>(`[data-tab="${activeStage}"]`);
    if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeStage]);

  return (
    <div
      className="sticky top-0 z-30 nx-safe-top"
      style={{
        backgroundColor: scrolled ? "rgba(17,19,23,0.85)" : "#111317",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid transparent",
        transition: "background-color 200ms ease-out, backdrop-filter 200ms ease-out, border-bottom-color 200ms ease-out",
      }}
    >
      <div ref={containerRef} className="overflow-x-auto nx-no-scrollbar">
        <div className="flex gap-2 px-4 py-2.5 min-w-max">
          {STAGES.map((stage) => {
            const isActive = activeStage === stage.lower;
            const count = counts[stage.lower] ?? 0;
            return (
              <button
                key={stage.lower}
                type="button"
                data-tab={stage.lower}
                onClick={() => { triggerHaptic("Light"); onTabTap(stage.lower); }}
                className={`min-h-[44px] inline-flex items-center px-4 rounded-full text-[13px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-[#E63946] text-white"
                    : "bg-[#1A1D24] text-[#9CA3AF] active:bg-white/5"
                }`}
              >
                {stage.label}
                <span className={`ml-1.5 text-[10px] ${isActive ? "text-white/80" : "text-[#6B7280]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── PipelineCardMobile V3 (iter 6.1b) ───────────────────────── */

function getBorderLeftStyle(card: PipelineKanbanCard): React.CSSProperties {
  // Prioritaire → border rouge full opacity (override)
  if (card.flagged) {
    return { borderLeft: "3px solid #E63946" };
  }
  // Sinon → border selon statut global. Iter 6.1e Fix 2 : 30% → 60% alpha
  // pour plus de présence visuelle (avant trop subtle).
  const status = statusGlobalColor(card.recruitment_status);
  if (!status || card.recruitment_status === "RETIRE") return {};
  return { borderLeft: `3px solid ${status.dot}99` }; // 60% alpha (0x99 = 153/255)
}

function PipelineCardMobile({ card, onTap }: { card: PipelineKanbanCard; onTap: () => void }) {
  const status = statusGlobalColor(card.recruitment_status);
  const [first, ...rest] = (card.full_name || "").split(/\s+/);
  const showStaleness = (card.days_in_status ?? 0) > 5;
  const now = useClientNow();
  const relance = formatRelancePill(card.next_action_at, now);
  // Iter 7.1 — Card = UNE SEULE SURFACE. Photo en FOND absolute gauche,
  // gradient horizontal → #1A1D24 OPAQUE à droite (couleur de la carte),
  // texte en absolute overlay sur la zone fondue. Aucune 2-boîtes empilées
  // = aucune couture. École + promo retirées (Fix 3 désencombrer).
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="w-full relative rounded-2xl overflow-hidden active:opacity-80 transition-opacity text-left bg-[#1A1D24]"
      style={{ ...getBorderLeftStyle(card), height: 120 }}
    >
      {/* Iter 7.4 Section A — RÉPLIQUE du mécanisme DashboardHero (qui marche).
          Cause root du fade KO précédent : AthletePhotoFill rend <img z-[1]>
          qui bat le gradient overlay z-auto → gradient sous l'img → bord net.
          Solution : raw <img> dans container z-0 (comme hero), gradient à z-[1]
          par-dessus l'img. Photo bleed flush aux 3 bords gauche/haut/bas. */}
      {card.photo_url ? (
        <div className="absolute left-0 top-0 bottom-0 w-[150px] z-0 pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.photo_url}
            alt=""
            crossOrigin="anonymous"
            className="w-full h-full object-cover object-[center_top]"
          />
        </div>
      ) : (
        // Fallback initiales watermark (la photo n'existe pas)
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
      {/* Gradient overlay AU-DESSUS de l'img (z-[1] vs photo z-0) qui termine
          en #1A1D24 OPAQUE = couleur de card → fondu sans couture. */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[150px] z-[1] pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent 0%, transparent 38%, rgba(26,29,36,0.9) 80%, #1A1D24 100%)",
        }}
      />

      {/* Iter 7.3 Fix A — left-[150px] au RAS de la fin de photo (pas
          d'overlap → noms entiers) + z-10 pour stacking stable WebView. */}
      <div className="absolute inset-y-0 left-[150px] right-0 z-10 flex flex-col justify-center px-3">
        {/* Ligne 1 : nom + verified inline + cote droite */}
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-white font-bold text-base truncate">{card.full_name}</p>
          {card.is_verified && (
            <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3B82F6]">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
          {/* Cote du coach + mon grade, groupés à droite (retour terrain
              2026-09-04) — même regroupement qu'au kanban web. */}
          <span className="flex-shrink-0 ml-auto flex items-center gap-1.5">
            <GradeChip grade={card.grade} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-sm font-bold text-white">{(card.coach_rating ?? 0).toFixed(1)}</span>
          </span>
        </div>

        {/* Ligne 2 : position · numéro UNIQUEMENT (Fix 3 — école + promo retirées) */}
        <p className="text-[15px] text-[#9CA3AF] mt-1 truncate">
          {[card.position || card.sport, card.jersey ? `#${card.jersey}` : null]
            .filter(Boolean).join(" · ") || "—"}
        </p>

        {/* Ligne 3 : statut global — SAUF « OUVERT » (arbitrage BP,
            2026-09-04). C'est l'état par défaut : l'absence de pastille
            signifie « ouvert ». EN PROCESSUS et RECRUTÉ restent, ils disent
            qu'un autre recruteur travaille l'athlète. Le statut complet reste
            dans le bottom sheet athlète, inchangé.
            La bordure gauche de la carte (getBorderLeftStyle) garde bien la
            teinte verte d'OUVERT : c'est un liseré, pas une pastille — il ne
            revendique aucune place dans la lecture. */}
        {status && card.recruitment_status !== "OUVERT" && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                backgroundColor: status.dot,
                animation: status.animated ? "nx-breathe 1.6s ease-in-out infinite" : undefined,
              }}
            />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: status.dot }}>
              {status.label}
            </span>
          </div>
        )}

        {/* Rangée de pilules — visite (VISITE_PLANIFIEE) et relance. Les deux
            partagent UNE ligne en flex-wrap : la carte est haute de 120px fixes
            avec overflow-hidden, deux lignes séparées la feraient déborder dès
            qu'un athlète porte les deux dates. */}
        {(() => {
          const visitLabel = card.status === "visite_planifiee" ? formatVisitPill(card.visit_at) : null;
          if (!visitLabel && !relance) return null;
          return (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {/* Visite — style blanc/neutre (décision BP) sur fond subtil. */}
              {visitLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span className="text-[11px] font-bold text-white">{visitLabel}</span>
                </span>
              )}
              {/* Relance — neutre tant qu'elle est à venir, GOLD #F59E0B une fois
                  la date passée. Une échéance dépassée n'est PAS une alerte : ni
                  le rouge plateforme #E63946, ni le rouge critique #EF4444. */}
              {relance && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: relance.isLate ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.1)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={relance.isLate ? "#F59E0B" : "#FFFFFF"} strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                  <span className="text-[11px] font-bold" style={{ color: relance.isLate ? "#F59E0B" : "#FFFFFF" }}>
                    {relance.label}
                  </span>
                </span>
              )}
            </div>
          );
        })()}

        {/* Ligne 4 : staleness conditionnelle (text-[12px] muted) */}
        {showStaleness && (
          <p className="text-[12px] text-white/60 mt-1.5">
            Aucun mouvement depuis {card.days_in_status}j
          </p>
        )}
      </div>
    </button>
  );
}

/* ── SwipeableCard (Fix 6 — swipe Tinder via framer-motion) ─── */

interface SwipeableCardProps {
  card: PipelineKanbanCard;
  currentStageIndex: number;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  prevStageLabel: string;
  nextStageLabel: string;
  onTap: () => void;
  onCommitSwipe: (direction: "left" | "right") => void;
  onEdgeBounce: (direction: "left" | "right") => void;
}

const SWIPE_THRESHOLD = 140;

function SwipeableCard({
  card, canSwipeLeft, canSwipeRight, prevStageLabel, nextStageLabel,
  onTap, onCommitSwipe, onEdgeBounce,
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-6, 6]);
  const cardOpacity = useTransform(x, [-200, 0, 200], [0.65, 1, 0.65]);
  const overlayRightOpacity = useTransform(x, [40, SWIPE_THRESHOLD], [0, 0.95]);
  const overlayLeftOpacity = useTransform(x, [-SWIPE_THRESHOLD, -40], [0.95, 0]);

  // Fix 5+6 iter 6.1c : couleur ROUGE Nexus pour avancer, GRIS pour reculer.
  // Overlay reste informatif (avec label "STAGE FINAL"/"PREMIER STAGE") aux
  // extrêmes — au relâche, bounce sans commit.
  // Fix 4 iter 6.1d : label sur 2 lignes (split sur l'espace) pour les
  // labels multi-mots ("EN DISCUSSION", "VISITE PLANIFIÉE", "LETTRE SIGNÉE",
  // "STAGE FINAL", "PREMIER STAGE").
  const rightLabel = canSwipeRight ? nextStageLabel : "Stage final";
  const leftLabel = canSwipeLeft ? prevStageLabel : "Premier stage";
  const splitLabel = (label: string): [string, string] => {
    const parts = label.trim().split(/\s+/);
    if (parts.length <= 1) return [parts[0] ?? "", ""];
    return [parts[0], parts.slice(1).join(" ")];
  };
  const [rightLine1, rightLine2] = splitLabel(rightLabel);
  const [leftLine1, leftLine2] = splitLabel(leftLabel);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Overlay ROUGE (révélé quand swipe droite = avancer) */}
      <motion.div
        style={{ opacity: overlayRightOpacity }}
        className="absolute inset-0 flex items-center justify-start px-5 pointer-events-none rounded-2xl bg-gradient-to-r from-[#E63946]/30 via-[#E63946]/15 to-transparent"
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[12px] uppercase tracking-wider font-bold text-[#E63946]">
              {rightLine1}
            </span>
            {rightLine2 && (
              <span className="text-[12px] uppercase tracking-wider font-bold text-[#E63946]">
                {rightLine2}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Overlay GRIS (révélé quand swipe gauche = reculer) */}
      <motion.div
        style={{ opacity: overlayLeftOpacity }}
        className="absolute inset-0 flex items-center justify-end px-5 pointer-events-none rounded-2xl bg-gradient-to-l from-[#6B7280]/30 via-[#6B7280]/15 to-transparent"
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[12px] uppercase tracking-wider font-bold text-[#6B7280]">
              {leftLine1}
            </span>
            {leftLine2 && (
              <span className="text-[12px] uppercase tracking-wider font-bold text-[#6B7280]">
                {leftLine2}
              </span>
            )}
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </div>
      </motion.div>

      {/* Card draggable */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const offset = info.offset.x;
          if (offset > SWIPE_THRESHOLD) {
            if (canSwipeRight) onCommitSwipe("right");
            else onEdgeBounce("right");
          } else if (offset < -SWIPE_THRESHOLD) {
            if (canSwipeLeft) onCommitSwipe("left");
            else onEdgeBounce("left");
          }
        }}
        style={{ x, rotate, opacity: cardOpacity }}
        className="relative z-[1]"
      >
        <PipelineCardMobile card={card} onTap={onTap} />
      </motion.div>
    </div>
  );
}

/* ── PipelineMenuSheet (Fix 9 — ⋮ Apple Reminders style) ──── */

/* Le type de tri et ses libellés vivent dans lib/pipeline/sortPipelineCards —
   la barre de filtres web lit exactement la même liste. Un mode ajouté là-bas
   apparaît ici sans rien toucher. */

// Iter 6.1d Fix 3 — palette bicolore pour le breakdown stats du ⋮ menu
// (UNIQUEMENT dans le breakdown, pas dans les section headers du main).
// Logique : IDENTIFIE/CONTACTE = soft (gris, pas encore engagé),
// EN_DISCUSSION → LETTRE_SIGNEE = actif (rouge Nexus).
const STATS_STAGE_COLOR_MAP: Record<string, string> = {
  IDENTIFIE:        "#6B7280",
  CONTACTE:         "#6B7280",
  EN_DISCUSSION:    "#E63946",
  VISITE_PLANIFIEE: "#E63946",
  ENGAGE:           "#E63946",
  LETTRE_SIGNEE:    "#E63946",
};

function PipelineMenuSheet({
  open, onClose,
  sortBy, setSortBy,
  filterSport, setFilterSport,
  focusMode, setFocusMode,
  availableSports,
  cards,
}: {
  open: boolean;
  onClose: () => void;
  sortBy: PipelineSortMode;
  setSortBy: (v: PipelineSortMode) => void;
  filterSport: string | null;
  setFilterSport: (v: string | null) => void;
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  availableSports: string[];
  cards: PipelineKanbanCard[];
}) {
  const toast = useMobileToast();
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const dragStartYRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setDragOffset(0); setIsDragging(false); } }, [open]);

  if (!mounted) return null;

  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  const sportOptions = useMemo(() => {
    const opts = [{ value: "", label: "Tous les sports" }];
    for (const s of availableSports) opts.push({ value: s, label: s });
    return opts;
  }, [availableSports]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/60"
            onClick={closeSheet}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: dragOffset }}
            exit={{ y: "100%" }}
            transition={isDragging ? { duration: 0 } : { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
            // touchAction pan-y (#2) : geste vertical uniquement, pas de glisse horizontale.
            style={{ maxHeight: "85dvh", paddingBottom: "env(safe-area-inset-bottom)", touchAction: "pan-y" }}
          >
            {/* Drag handle */}
            <div
              onTouchStart={(e) => { setIsDragging(true); dragStartYRef.current = e.touches[0].clientY; }}
              onTouchMove={(e) => {
                if (dragStartYRef.current === 0) return;
                const dy = Math.max(0, e.touches[0].clientY - dragStartYRef.current);
                setDragOffset(dy);
              }}
              onTouchEnd={() => {
                if (dragOffset > 100) closeSheet();
                else setDragOffset(0);
                setIsDragging(false); dragStartYRef.current = 0;
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-center pt-3 pb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            </div>

            <button
              type="button" onClick={closeSheet} aria-label="Fermer"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center active:bg-white/5 z-10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
              {/* Iter 6.1c Fix 8 — Stats funnel (total + breakdown horizontal) */}
              {(() => {
                const counts: Record<string, number> = {};
                for (const s of STAGES) counts[s.key] = 0;
                for (const c of cards) {
                  const k = (c.status || "").toString().toUpperCase();
                  if (counts[k] !== undefined) counts[k]++;
                }
                // Iter 7.3 Section D — survival% (closing rate) au lieu du
                // ratio adjacent qui pouvait dépasser 100%. Formule cohérente
                // avec MonProcessusFunnel du Dashboard.
                const N = STAGES.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);
                return (
                  <section>
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">
                      Statistiques de mon processus
                    </h3>
                    <div className="bg-[#1A1D24] rounded-2xl p-4 mb-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-1">
                        Total athlètes suivis
                      </p>
                      <p className="font-head text-[28px] font-black text-white leading-none">
                        {cards.length}
                      </p>
                    </div>
                    <div className="overflow-x-auto nx-no-scrollbar -mx-4 px-4">
                      <div className="flex items-center gap-2 min-w-max pb-1">
                        {STAGES.map((stage, idx) => {
                          const cur = counts[stage.key] ?? 0;
                          const reachedAtLeast = STAGES.slice(idx).reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);
                          const survival = N > 0 ? Math.round((reachedAtLeast / N) * 100) : 0;
                          return (
                            <div key={stage.key} className="flex items-center gap-2">
                              <div className="bg-[#1A1D24] rounded-2xl px-3 py-2 min-w-[88px] text-center">
                                <p
                                  className="font-head text-[22px] font-black leading-none"
                                  style={{ color: STATS_STAGE_COLOR_MAP[stage.key] ?? stage.color }}
                                >
                                  {cur}
                                </p>
                                <p className="text-[9px] uppercase tracking-wider text-[#6B7280] mt-1 truncate">
                                  {stage.label}
                                </p>
                                <p className="text-[10px] font-bold text-white/70 mt-1 tabular-nums">
                                  {survival}%
                                </p>
                              </div>
                              {idx < STAGES.length - 1 && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* Section Trier par */}
              <section>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">Trier les athlètes par</h3>
                <div className="bg-[#1A1D24] rounded-2xl overflow-hidden">
                  {PIPELINE_SORT_OPTIONS.map((opt) => {
                    const active = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { triggerHaptic("Light"); setSortBy(opt.value); }}
                        className="flex items-center justify-between w-full px-4 py-3.5 border-b border-white/[0.06] last:border-b-0 text-left active:bg-white/[0.03] transition-colors"
                      >
                        <span className="text-[15px] text-white/95 font-medium">{opt.label}</span>
                        {active && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Section Filtrer par sport */}
              <section>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">Filtrer par sport</h3>
                <button
                  type="button"
                  onClick={() => { triggerHaptic("Light"); setSportPickerOpen(true); }}
                  className="flex items-center justify-between w-full px-4 py-3.5 bg-[#1A1D24] rounded-2xl text-left active:bg-white/[0.03] transition-colors"
                >
                  <span className="text-[15px] text-white/95 font-medium">Sport</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] text-white/50 truncate max-w-[150px]">
                      {filterSport || "Tous"}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              </section>

              {/* Section Mode focus */}
              <section>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">Mode focus</h3>
                <button
                  type="button"
                  onClick={() => { triggerHaptic("Light"); setFocusMode(!focusMode); }}
                  className="flex items-start justify-between w-full px-4 py-3.5 bg-[#1A1D24] rounded-2xl text-left active:bg-white/[0.03] transition-colors"
                >
                  <div className="flex-1 pr-3">
                    <p className="text-[15px] text-white/95 font-medium">Cacher recrutés ailleurs</p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      Les athlètes signés ailleurs sont masqués
                    </p>
                  </div>
                  <span
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${focusMode ? "bg-[#E63946]" : "bg-white/10"}`}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                      style={{ left: focusMode ? "22px" : "2px", transition: "left 200ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                    />
                  </span>
                </button>
              </section>

              {/* Réinitialiser */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSortBy(DEFAULT_PIPELINE_SORT); setFilterSport(null); setFocusMode(false);
                    toast.info({ message: "Filtres réinitialisés" });
                  }}
                  className="w-full px-4 py-3.5 rounded-2xl text-[14px] text-[#E63946] font-bold active:bg-[#E63946]/10 transition-colors"
                >
                  Réinitialiser tous les filtres
                </button>
              </div>

              {/* Sections futures (disabled). "Statistiques détaillées" retiré
                  en iter 6.1c : le breakdown funnel est maintenant en haut du sheet. */}
              <div className="pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between px-4 py-3 opacity-40">
                  <p className="text-[13px] text-white">Exporter mon processus</p>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-[#6B7280] px-2 py-1 rounded bg-white/5">
                    Bientôt
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sport picker rendu APRÈS le sheet pour stacking z-index */}
          <MobilePicker
            open={sportPickerOpen}
            onClose={() => setSportPickerOpen(false)}
            title="Sport"
            options={sportOptions}
            value={filterSport ?? ""}
            onChange={(v) => setFilterSport((v as string) || null)}
          />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── EmptyStageState (Fix 2 iter 6.1a-fix) ───────────────────── */

function EmptyStageState({ stage }: { stage: StageConfig }) {
  return (
    <SharedEmptyState
      image="/empty/nexus-empty-effectif.png"
      title="Aucun athlète à ce stage"
      description={`Les athlètes apparaîtront ici quand tu les passes à ${stage.label}.`}
      /* optical offset for left-weighted PNG — remove if asset re-exported balanced */
      imageOffsetX={14}
    />
  );
}

/* ── PipelineDetailSheet ─────────────────────────────────────── */

/* ── NextActionDateEditor — date de relance (next_action_at) ─────
   Présentationnel, calqué sur VisitDateEditor (components/shared/
   VisitDateEditor.tsx) : même surface #0C0E12, même rounded-2xl, même
   text-[16px] (sous 16px, iOS zoome à la focalisation) et même bouton qui
   ne s'active que si la valeur a réellement changé — pas de write inutile.

   Deux différences assumées : aucun champ heure (next_action_at est une
   colonne `date`, pas un timestamptz) et AUCUN champ note. */
function NextActionDateEditor({
  value, onSave, saving = false,
}: {
  value: string | null;
  onSave: (dateStr: string | null) => void | Promise<void>;
  saving?: boolean;
}) {
  // Pas de useEffect de re-sync ici (contrairement à VisitDateEditor, qui en
  // porte un et se fait taper dessus par react-hooks/set-state-in-effect) :
  // l'appelant passe une `key` dérivée de l'athlète + de la valeur, donc un
  // changement amont REMONTE le composant et ce useState se réinitialise seul.
  const [date, setDate] = useState(value?.slice(0, 10) ?? "");

  const isDirty = (date || null) !== (value?.slice(0, 10) || null);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#9CA3AF] mb-1.5">
          Date de relance
        </p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date de relance"
          className="w-full bg-[#0C0E12] border border-white/[0.06] rounded-2xl px-3 py-2.5 text-[16px] text-white outline-none focus:border-[#E63946]/40 transition-colors"
        />
      </div>

      <button
        type="button"
        onClick={() => onSave(date || null)}
        disabled={!isDirty || saving}
        className={`w-full py-3 rounded-2xl text-[13px] uppercase tracking-wider font-bold transition-colors ${
          isDirty && !saving
            ? "bg-[#E63946] text-white active:bg-[#D42B22]"
            : "bg-white/[0.06] text-[#4a4d56]"
        }`}
      >
        {saving ? "…" : date ? "Enregistrer la relance" : "Effacer la relance"}
      </button>
    </div>
  );
}

function PipelineDetailSheet({
  card, open, onClose, isFreeDemoMode,
}: {
  card: PipelineKanbanCard | null;
  open: boolean;
  onClose: () => void;
  isFreeDemoMode: boolean;
}) {
  const router = useRouter();
  const toast = useMobileToast();
  const { data: notes = [], isLoading: notesLoading } = usePipelineNotes(card?.id ?? null);
  const updateStage = useUpdatePipelineStage();
  const togglePriority = useTogglePipelinePriority();
  const upsertGrade = useUpsertAthleteGrade();
  const updateNextAction = useUpdateNextAction();
  const addNote = useAddPipelineNote();
  const removeFromPipeline = useRemoveFromPipeline();

  const [noteText, setNoteText] = useState("");
  const [isPriority, setIsPriority] = useState(card?.flagged ?? false);
  // Grade local — même raison que visitAtLocal/nextActionAtLocal : `card` est
  // un snapshot non réactif au cache TanStack.
  const [gradeLocal, setGradeLocal] = useState<Grade | null>(card?.grade ?? null);
  const [posting, setPosting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Date de visite locale — le `card` prop est un snapshot (non réactif au
  // cache TanStack). On la garde en local pour un feedback immédiat après
  // enregistrement ; l'invalidate du hook rafraîchit la liste kanban.
  const [visitAtLocal, setVisitAtLocal] = useState<string | null>(card?.visit_at ?? null);
  const [savingVisit, setSavingVisit] = useState(false);
  // Date de relance locale — même raison que visitAtLocal : `card` est un
  // snapshot non réactif au cache TanStack. LA DATE SEULEMENT : la note de
  // suivi (next_action_note) ne descend pas au mobile.
  const [nextActionAtLocal, setNextActionAtLocal] = useState<string | null>(card?.next_action_at ?? null);
  const [savingNextAction, setSavingNextAction] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const nowTs = useClientNow();
  // Fix 7 iter 6.1a-fix : useRef car `let` était reset à chaque render →
  // les handlers touch perdaient la position de départ.
  const dragStartYRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setIsPriority(card?.flagged ?? false); }, [card?.id, card?.flagged]);
  useEffect(() => { setGradeLocal(card?.grade ?? null); }, [card?.id, card?.grade]);
  useEffect(() => { setVisitAtLocal(card?.visit_at ?? null); }, [card?.id, card?.visit_at]);
  useEffect(() => { setNextActionAtLocal(card?.next_action_at ?? null); }, [card?.id, card?.next_action_at]);
  useEffect(() => {
    if (!open) { setDragOffset(0); setIsDragging(false); setNoteText(""); setConfirmRemove(false); }
  }, [open]);

  // Fix 5 iter 6.1b — Prefetch du profil athlète au mount du sheet pour
  // éviter le flash de page intermédiaire quand l'utilisateur tap
  // "Voir profil complet". Next router prefetch est no-op en static export
  // mais inoffensif.
  useEffect(() => {
    if (open && card?.id) {
      try { router.prefetch(`/recruteur/athletes/${card.id}`); } catch { /* no-op */ }
    }
  }, [open, card?.id, router]);

  // Iter 6.1e Fix 4 — Auto-cancel du confirm "Retirer" après 3s d'inactivité
  // pour éviter qu'un tap accidentel reste actif si l'utilisateur ferme le
  // sheet et revient plus tard.
  useEffect(() => {
    if (!confirmRemove) return;
    const t = window.setTimeout(() => setConfirmRemove(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmRemove]);

  if (!mounted) return null;

  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  const handleStageChange = async (newStage: string) => {
    if (isFreeDemoMode) {
      toast.warning({ message: "Changer le stage est réservé aux membres Pro" });
      return;
    }
    if (!card) return;
    try {
      await updateStage.mutateAsync({ cardId: card.id, newStage });
      toast.success({ message: `Déplacé vers ${STAGE_BY_LOWER[newStage.toLowerCase()]?.label || newStage}` });
      onClose();
    } catch {
      toast.error({ message: "Erreur lors du changement de stage" });
    }
  };

  // Modification de la date de visite depuis le kanban — CHEMIN UNIQUE côté
  // kanban : useUpdatePipelineStage avec le stage VISITE_PLANIFIEE + la date
  // (cache TanStack cohérent via l'optimistic update du hook). Optimiste local,
  // rollback si l'écriture échoue.
  const handleSaveVisitDate = async (iso: string | undefined) => {
    if (!card) return;
    if (isFreeDemoMode) {
      toast.warning({ message: "Planifier une visite est réservé aux membres Pro" });
      return;
    }
    const prev = visitAtLocal;
    setSavingVisit(true);
    setVisitAtLocal(iso ?? null);
    try {
      await updateStage.mutateAsync({ cardId: card.id, newStage: "VISITE_PLANIFIEE", visitAtIso: iso });
      toast.success({ message: iso ? "Date de visite enregistrée" : "Date de visite effacée" });
    } catch {
      setVisitAtLocal(prev);
      toast.error({ message: "Erreur lors de l'enregistrement de la date" });
    } finally {
      setSavingVisit(false);
    }
  };

  // Date de relance (recruiter_pipeline.next_action_at). Même parcours que
  // handleSaveVisitDate : optimiste local, rollback si l'écriture échoue.
  // L'UPDATE ne porte QUE next_action_at — jamais next_action_note, jamais
  // flagged, jamais le stage (frontière Lot 1).
  const handleSaveNextAction = async (dateStr: string | null) => {
    if (!card) return;
    if (isFreeDemoMode) {
      toast.warning({ message: "Planifier une relance est réservé aux membres Pro" });
      return;
    }
    const prev = nextActionAtLocal;
    setSavingNextAction(true);
    setNextActionAtLocal(dateStr);
    try {
      await updateNextAction.mutateAsync({ cardId: card.id, nextActionAt: dateStr });
      toast.success({ message: dateStr ? "Date de relance enregistrée" : "Date de relance effacée" });
    } catch {
      setNextActionAtLocal(prev);
      toast.error({ message: "Erreur lors de l'enregistrement de la relance" });
    } finally {
      setSavingNextAction(false);
    }
  };

  const handleTogglePriority = async () => {
    if (isFreeDemoMode) {
      toast.warning({ message: "Marquer prioritaire est réservé aux membres Pro" });
      return;
    }
    if (!card) return;
    const newValue = !isPriority;
    setIsPriority(newValue); // optimistic local
    triggerHaptic("Light");
    try {
      await togglePriority.mutateAsync({ cardId: card.id, value: newValue });
    } catch {
      setIsPriority(!newValue);
      toast.error({ message: "Erreur priorité" });
    }
  };

  // `null` retire le grade — useUpsertAthleteGrade traduit ça en DELETE.
  // Optimiste local + rollback, sans spinner : la grille reste tapable.
  const handleSetGrade = async (grade: Grade | null) => {
    if (isFreeDemoMode) {
      toast.warning({ message: "Noter un athlète est réservé aux membres Pro" });
      return;
    }
    if (!card) return;
    const prev = gradeLocal;
    setGradeLocal(grade);
    triggerHaptic("Light");
    try {
      await upsertGrade.mutateAsync({ athleteId: card.id, grade });
    } catch {
      setGradeLocal(prev);
      toast.error({ message: "Erreur grade" });
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !card) return;
    if (isFreeDemoMode) {
      toast.warning({ message: "Les notes sont réservées aux membres Pro" });
      setNoteText("");
      return;
    }
    setPosting(true);
    try {
      await addNote.mutateAsync({ athleteId: card.id, content: noteText });
      setNoteText("");
      toast.success({ message: "Note ajoutée" });
    } catch {
      toast.error({ message: "Erreur lors de l'ajout de la note" });
    } finally {
      setPosting(false);
    }
  };

  const handleRemove = async () => {
    if (!card) return;
    if (isFreeDemoMode) {
      toast.warning({ message: "La gestion du processus est réservée aux membres Pro" });
      return;
    }
    if (!confirmRemove) { setConfirmRemove(true); return; }
    try {
      await removeFromPipeline.mutateAsync({ cardId: card.id });
      toast.success({ message: "Athlète retiré du processus" });
      onClose();
    } catch {
      toast.error({ message: "Erreur lors du retrait" });
    }
  };

  // Fix 3 iter 6.1c — sessionStorage pour que le back du profil revienne
  // vers Pipeline (pas Recherche). Fix 5 iter 6.1b conservé : close sheet
  // d'abord puis nav avec delay 280ms pour éviter le flash.
  const handleViewProfile = () => {
    if (!card) return;
    const id = card.id;
    try { sessionStorage.setItem("lastRecruiterTab", "pipeline"); } catch { /* no-op */ }
    onClose();
    window.setTimeout(() => router.push(`/recruteur/athletes/${id}`), 280);
  };

  const handleSendMessage = () => {
    if (!card) return;
    router.push(`/recruteur/messages/nouveau?athlete=${card.id}`);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && card && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 - dragOffset / 600 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[55] bg-black/60"
            onClick={closeSheet}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: dragOffset }}
            exit={{ y: "100%" }}
            transition={isDragging ? { duration: 0 } : { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
            // touchAction pan-y (#2) : geste vertical uniquement, pas de glisse horizontale.
            style={{ maxHeight: "90dvh", paddingBottom: "env(safe-area-inset-bottom)", touchAction: "pan-y" }}
          >
            {/* Handle iOS — drag area (swipe-down to close, Fix 5+7) */}
            <div
              onTouchStart={(e) => { setIsDragging(true); dragStartYRef.current = e.touches[0].clientY; }}
              onTouchMove={(e) => {
                if (dragStartYRef.current === 0) return;
                const dy = Math.max(0, e.touches[0].clientY - dragStartYRef.current);
                setDragOffset(dy);
              }}
              onTouchEnd={() => {
                if (dragOffset > 100) closeSheet();
                else setDragOffset(0);
                setIsDragging(false); dragStartYRef.current = 0;
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-center pt-3 pb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            </div>

            {/* Bouton X absolute top-right (Fix 5) */}
            <button
              type="button"
              onClick={closeSheet}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center active:bg-white/5 z-10"
              aria-label="Fermer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Header athlète : photo + meta + pill statut global (Fix 6)
                  + fade horizontal blend (Fix 1 iter 6.1e — bg #111317 du sheet) */}
              <div className="flex items-start gap-3">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-[#2F3440]">
                  {(() => {
                    const [f, ...r] = (card.full_name || "").split(/\s+/);
                    return <AthletePhotoFill photoUrl={card.photo_url} firstName={f} lastName={r.join(" ")} initialsFontSize={22} className="object-[center_15%]" identityVisible={card.identityVisible} />;
                  })()}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(to right, transparent 25%, rgba(17,19,23,0.5) 65%, rgba(17,19,23,0.9) 90%, rgba(17,19,23,1) 100%)",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-head text-[18px] font-black text-white uppercase tracking-tight truncate">
                    {card.full_name}
                  </h2>
                  <p className="text-[12px] uppercase tracking-wider text-[#9CA3AF] font-semibold mt-1 truncate">
                    {[card.sport, card.position].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-[12px] text-[#9CA3AF] truncate">{card.noTeam ? "Ligue civile" : card.school}</p>
                  {card.graduation_year > 0 && (
                    <p className="text-[12px] text-[#6B7280]">Promotion {card.graduation_year}</p>
                  )}
                </div>
              </div>

              {/* Pill statut global + recruté ailleurs warning */}
              {(() => {
                const status = statusGlobalColor(card.recruitment_status);
                const recrutedElsewhere =
                  card.recruitment_status === "RECRUTE" &&
                  ["identifie", "contacte", "en_discussion", "visite_planifiee"].includes(card.status);
                if (!status && !recrutedElsewhere) return null;
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {status && (
                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: `${status.dot}1f` }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: status.dot,
                            animation: status.animated ? "nx-breathe 1.6s ease-in-out infinite" : undefined,
                          }}
                        />
                        <span
                          className="text-[10px] uppercase tracking-wider font-bold"
                          style={{ color: status.dot }}
                        >
                          {status.label}
                        </span>
                      </div>
                    )}
                    {card.recruitment_status === "RECRUTE" && card.committed_school_name && (
                      <span className="text-[11px] text-[#9CA3AF]">· {card.committed_school_name}</span>
                    )}
                    {recrutedElsewhere && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/15">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                        </svg>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[#F59E0B]">
                          Recruté ailleurs
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Section visite — quand le stage est VISITE_PLANIFIEE : mini
                  date-picker pour POSER/MODIFIER la date (visit_at), plus la
                  MÊME carte « voir la visite » (+ export agenda) que le profil
                  complet (VisitCalendarCard, gate strict : une date). Piloté
                  par visitAtLocal pour un feedback immédiat. */}
              {card.status === "visite_planifiee" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-3">Visite planifiée</h3>
                    <VisitDateEditor
                      visitAtIso={visitAtLocal}
                      onSave={handleSaveVisitDate}
                      saving={savingVisit}
                    />
                  </div>
                  {visitAtLocal && (
                    <VisitCalendarCard
                      visitAtIso={visitAtLocal}
                      athleteName={card.full_name}
                      sport={card.sport || undefined}
                      schoolName={card.noTeam ? undefined : card.school || undefined}
                    />
                  )}
                </div>
              )}

              {/* Section relance — présente à TOUS les stages : une relance
                  n'est pas conditionnée par une visite. Pilotée par
                  nextActionAtLocal pour un feedback immédiat, comme la visite.
                  LA DATE SEULEMENT — aucun champ note (frontière Lot 1). */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-3">Prochaine relance</h3>
                <NextActionDateEditor
                  key={`${card.id}:${nextActionAtLocal ?? ""}`}
                  value={nextActionAtLocal}
                  onSave={handleSaveNextAction}
                  saving={savingNextAction}
                />
                {/* Échéance dépassée → gold #F59E0B. Volontairement PAS un
                    rouge : une relance en retard est une échéance, pas une
                    alerte critique. */}
                {formatRelancePill(nextActionAtLocal, nowTs)?.isLate && (
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#F59E0B]">
                      Relance en retard
                    </span>
                  </div>
                )}
              </div>

              {/* Cote */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24"
                    fill={i <= Math.round(card.coach_rating ?? 0) ? "#F59E0B" : "#4a4d56"} stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
                <span className="text-[13px] font-bold text-[#F59E0B] ml-1">{(card.coach_rating ?? 0).toFixed(1)}</span>
                <span className="text-[11px] text-[#6B7280] ml-1">Cote du coach</span>
              </div>

              {/* Progress completion */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold">Profil complété</span>
                  <span className="text-[13px] text-white font-bold">{Math.round(card.profile_completeness ?? 0)}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${card.profile_completeness ?? 0}%`, backgroundColor: "#E63946" }}
                  />
                </div>
              </div>

              {/* Toggle priorité — Iter 6.1e Fix 3 : icône ⭐ retirée, label seul */}
              <div className="flex items-center justify-between py-3 border-y border-white/[0.06]">
                <div className="flex-1 pr-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] font-bold">Prioritaire</span>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">Apparaît en premier dans la liste du stage</p>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePriority}
                  disabled={isFreeDemoMode}
                  aria-label={isPriority ? "Retirer priorité" : "Marquer prioritaire"}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isPriority ? "bg-[#E63946]" : "bg-white/10"} ${isFreeDemoMode ? "opacity-40" : ""}`}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                    style={{ left: isPriority ? "22px" : "2px", transition: "left 200ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  />
                </button>
              </div>

              {/* Mon grade — sous la priorité, avant les notes. Cibles 44px
                  (compact={false}) : c'est du tactile, pas du curseur. */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">Mon grade</h3>
                <GradePicker value={gradeLocal} onSelect={handleSetGrade} compact={false} />
              </div>

              {/* Notes inline */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">Notes de suivi</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ajouter une note…"
                    disabled={isFreeDemoMode}
                    className="flex-1 px-3 py-2.5 bg-[#0C0E12] rounded-2xl text-[16px] text-white placeholder:text-[#4a4d56] border border-white/[0.06] outline-none focus:border-[#E63946]/40 disabled:opacity-50"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                  />
                  <button
                    type="button"
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || posting || isFreeDemoMode}
                    className={`px-4 py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-bold transition-colors ${
                      noteText.trim() && !posting && !isFreeDemoMode
                        ? "bg-[#E63946] text-white active:bg-[#D42B22]"
                        : "bg-white/[0.06] text-[#4a4d56]"
                    }`}
                  >
                    {posting ? "..." : "Poster"}
                  </button>
                </div>

                {/* Timeline notes : skeleton si loading, sinon liste (Fix 8) */}
                <div className="mt-3">
                  {notesLoading ? (
                    <div className="space-y-2.5">
                      <div className="pl-3 border-l-2 border-white/[0.06]">
                        <div className="h-3 rounded nx-pulse-skel-pl" style={{ width: "85%" }} />
                        <div className="h-2.5 mt-1 rounded nx-pulse-skel-pl" style={{ width: "30%" }} />
                      </div>
                      <div className="pl-3 border-l-2 border-white/[0.06]">
                        <div className="h-3 rounded nx-pulse-skel-pl" style={{ width: "65%" }} />
                        <div className="h-2.5 mt-1 rounded nx-pulse-skel-pl" style={{ width: "30%" }} />
                      </div>
                    </div>
                  ) : notes.length > 0 ? (
                    <div className="space-y-2.5 max-h-44 overflow-y-auto">
                      {notes.slice(0, 5).map((n) => (
                        <div key={n.id} className="pl-3 border-l-2 border-[#E63946]/40">
                          <p className="text-[12px] text-[#e0e0e0] leading-relaxed">{n.content}</p>
                          <p className="text-[10px] text-[#6B7280] mt-0.5">
                            {new Date(n.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#4a4d56] italic">Aucune note pour cet athlète</p>
                  )}
                </div>
              </div>

              {/* Grid Changer le statut */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">Changer le statut</h3>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.map((stage) => {
                    const isActive = card.status === stage.lower;
                    return (
                      <button
                        key={stage.lower}
                        type="button"
                        onClick={() => { void triggerHaptic("Light"); handleStageChange(stage.key); }}
                        disabled={isActive || isFreeDemoMode}
                        className={`py-3 rounded-2xl text-[11px] uppercase tracking-wider font-bold transition-colors ${
                          isActive
                            ? "bg-[#E63946] text-white"
                            : isFreeDemoMode
                              ? "bg-[#1A1D24] text-[#4a4d56]"
                              : "bg-[#1A1D24] text-[#e0e0e0] active:bg-white/[0.04]"
                        }`}
                      >
                        {stage.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions secondaires */}
              <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => { void triggerHaptic("Light"); handleViewProfile(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1A1D24] text-white text-[13px] font-bold active:bg-white/5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Voir le profil complet
                </button>
                <button
                  type="button"
                  onClick={() => { void triggerHaptic("Light"); handleSendMessage(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1A1D24] text-white text-[13px] font-bold active:bg-white/5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Envoyer un message au coach
                </button>
                {/* Iter 6.1e Fix 4 — État confirm = rouge plein + halo pulse */}
                <button
                  type="button"
                  onClick={() => { void triggerHaptic("Medium"); handleRemove(); }}
                  disabled={isFreeDemoMode}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-[13px] font-bold transition-all ${
                    confirmRemove
                      ? "border-[#E63946] bg-[#E63946] text-white nx-confirm-pulse"
                      : "border-[#E63946]/30 bg-transparent text-[#E63946] active:bg-[#E63946]/10"
                  } ${isFreeDemoMode ? "opacity-40" : ""}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  {confirmRemove ? "Confirmer le retrait" : "Retirer du processus"}
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

/* ── EmptyState / Skeleton ───────────────────────────────────── */

function EmptyState({ isFreeDemo }: { isFreeDemo: boolean }) {
  return (
    <SharedEmptyState
      image="/empty/nexus-empty-effectif.png"
      title={isFreeDemo ? "Processus réservé Pro" : "Processus vide"}
      description={isFreeDemo
        ? "La gestion du processus et le suivi des athlètes sont réservés aux membres Pro."
        : "Ajoute un athlète en favori depuis Recherche pour commencer à le suivre dans ton processus."}
      /* optical offset for left-weighted PNG — remove if asset re-exported balanced */
      imageOffsetX={14}
    />
  );
}

function SkeletonList() {
  return (
    <div className="px-4 py-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl">
          <div className="w-14 h-14 rounded-2xl nx-pulse-skel-pl" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded nx-pulse-skel-pl" style={{ width: "60%" }} />
            <div className="h-2.5 rounded nx-pulse-skel-pl" style={{ width: "40%" }} />
            <div className="h-2.5 rounded nx-pulse-skel-pl" style={{ width: "70%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function RecruteurPipelineMobile() {
  const { tier, loading: tierLoading } = useSubscription();
  const isFreeDemoMode = tier === "free";
  const queryClient = useQueryClient();
  const toast = useMobileToast();
  useCurrentUser(); // warm cache pour les hooks de mutation

  const { data: pipelineData, isLoading: pipelineLoading } = usePipelineCards();
  const cards = pipelineData?.cards ?? [];
  const loading = tierLoading || pipelineLoading;

  const [selectedCard, setSelectedCard] = useState<PipelineKanbanCard | null>(null);
  const [activeStage, setActiveStage] = useState<string>(STAGES[0].lower);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Iter 6.1b — ⋮ menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<PipelineSortMode>(DEFAULT_PIPELINE_SORT);
  const [filterSport, setFilterSport] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  // Mutation pour le swipe
  const updateStage = useUpdatePipelineStage();

  // Groupage par stage + counts (counts pour les tabs, tous stages)
  const cardsByStage = useMemo(() => {
    const grouped: Record<string, PipelineKanbanCard[]> = {};
    for (const s of STAGES) grouped[s.lower] = [];
    for (const card of cards) {
      const stageLower = (card.status || "identifie").toString().toLowerCase();
      if (grouped[stageLower]) grouped[stageLower].push(card);
    }
    return grouped;
  }, [cards]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STAGES) c[s.lower] = cardsByStage[s.lower].length;
    return c;
  }, [cardsByStage]);

  // Sports disponibles pour le filtre du ⋮ menu
  const availableSports = useMemo(() => {
    const s = new Set<string>();
    for (const c of cards) if (c.sport) s.add(c.sport);
    return Array.from(s).sort();
  }, [cards]);

  // Fix 2 (page-par-stage) + iter 6.1b sort/filter/focus + tri prioritaires
  const activeStageCards = useMemo(() => {
    let list = (cardsByStage[activeStage] ?? []).slice();
    if (filterSport) list = list.filter((c) => c.sport === filterSport);
    if (focusMode) list = list.filter((c) => c.recruitment_status !== "RECRUTE");
    // Le tri (flaggués d'abord, puis mode courant) est parti dans
    // lib/pipeline/sortPipelineCards : le web appelle la même fonction.
    return sortPipelineCards(list, sortBy);
  }, [cardsByStage, activeStage, filterSport, focusMode, sortBy]);

  // Index du stage actif pour les bornes du swipe (canSwipeLeft/Right)
  const activeStageIndex = useMemo(
    () => STAGES.findIndex((s) => s.lower === activeStage),
    [activeStage]
  );

  const handleTabTap = (lower: string) => {
    setActiveStage(lower);
  };

  // Scroll listener (top bar blur)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0; let last = 0; let tick = false;
    const onScroll = () => {
      last = window.scrollY || 0;
      if (!tick) {
        raf = window.requestAnimationFrame(() => { setScrolled(last > 20); tick = false; });
        tick = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) window.cancelAnimationFrame(raf); };
  }, []);

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 80;
  useEffect(() => {
    let startY = 0; let current = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (sheetOpen) return;
      if ((window.scrollY || 0) === 0) startY = e.touches[0].clientY; else startY = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (sheetOpen) return;
      if ((window.scrollY || 0) !== 0 || startY === 0) return;
      current = Math.max(0, Math.min(e.touches[0].clientY - startY, 120));
      setPullDistance(current);
      setIsPulling(current > 0);
    };
    const onTouchEnd = async () => {
      if (sheetOpen) return;
      if (current >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic("Medium");
        await queryClient.invalidateQueries({ queryKey: ["pipeline"] });
        window.setTimeout(() => { setIsRefreshing(false); setPullDistance(0); setIsPulling(false); }, 600);
      } else {
        setPullDistance(0); setIsPulling(false);
      }
      startY = 0; current = 0;
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [sheetOpen, isRefreshing, queryClient]);

  const handleCardTap = (card: PipelineKanbanCard) => {
    setSelectedCard(card);
    setSheetOpen(true);
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    window.setTimeout(() => setSelectedCard(null), 320);
  };

  // Fix 9 — ⋮ menu sheet
  const handleMenuTap = () => {
    setMenuOpen(true);
  };

  // Fix 6+7+8 — Swipe Tinder commit avec optimistic update + Toast Undo 5s
  const handleSwipeCommit = (card: PipelineKanbanCard, direction: "left" | "right") => {
    if (isFreeDemoMode) {
      toast.warning({ message: "La gestion du processus est réservée aux membres Pro" });
      return;
    }
    const fromStage = STAGES[activeStageIndex];
    const toStage = direction === "right" ? STAGES[activeStageIndex + 1] : STAGES[activeStageIndex - 1];
    if (!fromStage || !toStage) return;
    updateStage.mutate(
      { cardId: card.id, newStage: toStage.key },
      {
        onSuccess: () => {
          toast.success({
            message: `Déplacé vers ${toStage.label}`,
            duration: 5000,
            action: {
              label: "Annuler",
              onClick: () => {
                updateStage.mutate(
                  { cardId: card.id, newStage: fromStage.key },
                  { onSuccess: () => toast.info({ message: "Annulé" }) }
                );
              },
            },
          });
        },
        onError: () => {
          toast.error({ message: "Erreur changement de stage" });
        },
      }
    );
  };

  const handleSwipeEdgeBounce = (direction: "left" | "right") => {
    const message = direction === "right" ? "Stage final atteint" : "Premier stage du processus";
    toast.warning({ message });
  };

  const isEmpty = !loading && cards.length === 0;

  return (
    <div className="min-h-screen bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="fixed left-0 right-0 z-[55] flex justify-center items-center pointer-events-none"
          style={{ top: 0, height: Math.max(pullDistance, isRefreshing ? 60 : 0) }}
        >
          <div
            className="rounded-full p-2"
            style={{
              background: "rgba(230, 57, 70, 0.1)",
              transform: isRefreshing ? "rotate(0deg)" : `rotate(${pullDistance * 4}deg)`,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: isRefreshing ? "nx-rotate-pl 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
        </div>
      )}

      <PipelineHeader totalCount={cards.length} onMenuTap={handleMenuTap} />

      {/* Free demo banner */}
      {isFreeDemoMode && !loading && cards.length > 0 && (
        <div className="mx-4 mb-2 bg-[#1A1D24] border border-[#F59E0B]/30 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-[12px] text-[#9CA3AF] flex-1">
            Mode démo — sauvegarde réservée aux membres <span className="text-[#F59E0B] font-bold">Pro</span>.
          </p>
        </div>
      )}

      <StageTabsSticky
        counts={counts}
        activeStage={activeStage}
        scrolled={scrolled}
        onTabTap={handleTabTap}
      />

      {/* Content — page-par-stage (Fix 2 iter 6.1a-fix) */}
      {loading ? (
        <SkeletonList />
      ) : isEmpty ? (
        <EmptyState isFreeDemo={isFreeDemoMode} />
      ) : (
        <div className="pb-8 pt-2">
          {/* Header section stage actif avec count */}
          <div className="px-4 py-2.5 flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: STAGE_BY_LOWER[activeStage]?.color ?? "#6B7280" }}
            />
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280] font-bold">
              {STAGE_BY_LOWER[activeStage]?.label}
            </h2>
            <span className="text-[11px] text-[#4a4d56] font-bold">
              ({activeStageCards.length})
            </span>
          </div>

          {/* Cards du stage actif — fade cross-transition 200ms */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="px-4"
            >
              {activeStageCards.length === 0 ? (
                <EmptyStageState stage={STAGE_BY_LOWER[activeStage]} />
              ) : (
                <div className="space-y-2">
                  {activeStageCards.map((card) => {
                    const canSwipeLeft = activeStageIndex > 0;
                    const canSwipeRight = activeStageIndex < STAGES.length - 1;
                    const prevStageLabel = canSwipeLeft ? STAGES[activeStageIndex - 1].label : "Limite";
                    const nextStageLabel = canSwipeRight ? STAGES[activeStageIndex + 1].label : "Limite";
                    return (
                      <SwipeableCard
                        key={card.id}
                        card={card}
                        currentStageIndex={activeStageIndex}
                        canSwipeLeft={canSwipeLeft}
                        canSwipeRight={canSwipeRight}
                        prevStageLabel={prevStageLabel}
                        nextStageLabel={nextStageLabel}
                        onTap={() => handleCardTap(card)}
                        onCommitSwipe={(dir) => handleSwipeCommit(card, dir)}
                        onEdgeBounce={handleSwipeEdgeBounce}
                      />
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <PipelineDetailSheet
        card={selectedCard}
        open={sheetOpen}
        onClose={handleSheetClose}
        isFreeDemoMode={isFreeDemoMode}
      />

      {/* Fix 9 — ⋮ Menu sheet Apple Reminders style. Iter 6.1c : cards prop
          ajoutée pour le breakdown stats funnel en haut du sheet. */}
      <PipelineMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        sortBy={sortBy} setSortBy={setSortBy}
        filterSport={filterSport} setFilterSport={setFilterSport}
        focusMode={focusMode} setFocusMode={setFocusMode}
        availableSports={availableSports}
        cards={cards}
      />

      <style jsx>{`
        @keyframes nx-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes nx-rotate-pl { to { transform: rotate(360deg); } }
        @keyframes nx-pulse-pl { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        :global(.nx-pulse-skel-pl) { background: #0C0E12; animation: nx-pulse-pl 1.4s ease-in-out infinite; }
        :global(.nx-no-scrollbar) { scrollbar-width: none; -ms-overflow-style: none; }
        :global(.nx-no-scrollbar::-webkit-scrollbar) { display: none; }
        @keyframes nx-confirm-pulse-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(230, 57, 70, 0); }
          50% { box-shadow: 0 0 0 6px rgba(230, 57, 70, 0.4); }
        }
        :global(.nx-confirm-pulse) { animation: nx-confirm-pulse-kf 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
