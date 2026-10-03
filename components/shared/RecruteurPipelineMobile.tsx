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

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { usePipelineCards } from "@/lib/queries/recruiter/usePipelineCards";
import { useProcessusUnite } from "@/lib/queries/recruiter/useProcessusUnite";
import { estCarte } from "@/lib/cartes/carteProspect";
import { OngletInfosCarte, OngletHistoriqueCarte, SURFACE_PROSPECT } from "@/components/recruteur/cartes/PanneauCarte";
import FilNotesSuiviMobile from "@/components/shared/FilNotesSuiviMobile";
import CreerProspectMobile from "@/components/shared/CreerProspectMobile";
import { messageRetraitProcessus, MESSAGE_RETRAIT_CARTE } from "@/lib/pipeline/messagesUnite";
import OngletInfosPanneau from "@/app/recruteur/pipeline/_components/OngletInfosPanneau";
import OngletHistoriquePanneau from "@/app/recruteur/pipeline/_components/OngletHistoriquePanneau";
import { useFiltreSportUnite, type FiltreSportUnite as FiltreSportUniteEtat } from "@/lib/queries/recruiter/useFiltreSportUnite";
import FiltreSportUnite from "@/components/recruteur/cegep/FiltreSportUnite";
import AvisLectureSeule from "@/components/recruteur/cegep/AvisLectureSeule";
import { TOUS, SANS_SPORT } from "@/lib/cegep/filtreSportUnite";
import { useSheetKeyboardGeometry } from "@/lib/hooks/useSheetKeyboardGeometry";
import {
  sortPipelineCards,
  DEFAULT_PIPELINE_SORT,
  type PipelineSortMode,
} from "@/lib/pipeline/sortPipelineCards";
import {
  filterPipelineCards,
  facetOptions,
  activeFilterCount,
  EMPTY_FILTERS,
  QUICK_FILTERS,
  quickDepuisFiltreUrl,
  FILTRE_PIPELINE_URL,
  type PipelineFilters,
  type QuickKey,
} from "@/lib/pipeline/filterPipelineCards";
import { useUpdatePipelineStage } from "@/lib/queries/recruiter/useUpdatePipelineStage";
import { etapePorteVisite, etapeApresSaisieVisite } from "@/lib/pipeline/regleVisite";
import { useTogglePipelinePriority } from "@/lib/queries/recruiter/useTogglePipelinePriority";
import { useUpsertAthleteGrade } from "@/lib/queries/recruiter/useUpsertAthleteGrade";
import { GradeChip, GradePicker } from "@/components/shared/GradeChip";
import type { Grade } from "@/lib/config/grades";
import { useUpdateNextAction } from "@/lib/queries/recruiter/useUpdateNextAction";
import { useRemoveFromPipeline } from "@/lib/queries/recruiter/useRemoveFromPipeline";
import { useMobileToast } from "@/components/mobile/MobileToast";
import VisitCalendarCard from "@/components/shared/VisitCalendarCard";
import VisitDateEditor from "@/components/shared/VisitDateEditor";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import { triggerHaptic } from "@/lib/haptics";
import { aUneCote } from "@/lib/evaluations/presence";

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

/** « 12 août » (l'icône calendrier dit « visite » — recette 1.4.4) à partir
 *  de l'instant ISO (recruiter_pipeline.visit_at).
 *  Formaté en heure locale FR-CA (produit québécois) ; retourne null si l'ISO
 *  est invalide pour que l'appelant n'affiche rien. */
function formatVisitPill(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
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

/** « 12 sept » (l'icône horloge dit « relance ») + drapeau retard (date strictement avant aujourd'hui).
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
    label: d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" }),
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

/* Le ⋮ ouvrait la seule porte vers les filtres — et la feuille s'ouvre sur
   « Trier les athlètes par », si bien qu'on n'y voyait qu'un tri. Les facettes
   existaient depuis toujours, deux sections plus bas, invisibles. Un bouton
   NOMMÉ les rend atteignables, et sa pastille dit combien sont actifs sans
   qu'on ait à ouvrir quoi que ce soit. */
function PipelineHeader({ totalCount, nActiveFilters, onFilterTap, onProspectTap }: {
  totalCount: number;
  nActiveFilters: number;
  onFilterTap: () => void;
  /** « + Prospect » (recette 1.4.4) : absent quand la carte ne naîtrait pas
   *  dans l'unité affichée, ou pour un compte gratuit. */
  onProspectTap?: () => void;
}) {
  return (
    <div className="px-4 pb-3 bg-[#111317]" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.25rem)" }}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="font-head text-[24px] font-black text-white uppercase tracking-tight">Mon processus</h1>
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">
            {totalCount} athlète{totalCount !== 1 ? "s" : ""} · Saison 2025-2026
          </p>
        </div>
        {/* UNE pilule LABELLISÉE, et elle est la porte unique. Le ⋮ est mort —
            il ouvrait exactement la même feuille, un second déclencheur pour
            rien.

            Un mot écrit plutôt qu'une icône seule (retour de recette, BP
            2026-09-10) : « Filtrer » se lit sans apprentissage, là où un
            pictogramme demande de deviner. L'entonnoir revient avec lui.

            L'aria-label, lui, nomme les QUATRE sections de la feuille —
            statistiques, tri, filtres, mode focus. Le libellé visible dit le
            geste le plus fréquent ; l'étiquette d'accessibilité dit tout ce
            qu'on trouve derrière, pour qui ne voit pas l'écran. La pastille ne
            compte que les filtres : seule des quatre à avoir un état. */}
        <div className="flex items-center gap-2 flex-shrink-0">
        {/* « + Prospect » : petit, contour, à côté de « Filtrer » — pas de
            bouton flottant (décision BP 2026-10-02). */}
        {onProspectTap && (
          <button
            type="button"
            data-testid="ajouter-prospect"
            onClick={() => { triggerHaptic("Light"); onProspectTap(); }}
            aria-label="Ajouter un prospect"
            className="h-11 px-3 rounded-full flex items-center border border-white/15 text-[13px] font-bold text-white active:bg-white/5"
          >
            + Prospect
          </button>
        )}
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); onFilterTap(); }}
          aria-label={
            nActiveFilters > 0
              ? `Filtrer — statistiques, tri, filtres, mode focus — ${nActiveFilters} filtre${nActiveFilters > 1 ? "s" : ""} actif${nActiveFilters > 1 ? "s" : ""}`
              : "Filtrer — statistiques, tri, filtres, mode focus"
          }
          aria-haspopup="dialog"
          className="relative h-11 pl-3.5 pr-4 rounded-full flex items-center gap-1.5 bg-[#E63946] active:bg-[#D42B22] shadow-[0_0_16px_rgba(230,57,70,0.28)] flex-shrink-0"
        >
          {/* PILE PLEINE, pas un libellé rouge posé sur le fond sombre.
              L'étape d'avant avait déjà tranché « rouge en permanence, pas
              seulement quand un filtre est actif » — le raisonnement tient
              toujours : c'est la porte unique vers la feuille, une action
              toujours disponible. Mais du #E63946 en TEXTE sur #111317 se
              lisait comme un lien, pas comme un bouton, et se noyait dans le
              rouge ambiant de l'écran. Le rouge passe donc au REMPLISSAGE,
              l'encre passe en blanc.
              L'état « des filtres tournent » se dit toujours par la pastille,
              jamais par la couleur du bouton — elle s'inverse simplement
              (blanc sur rouge) pour rester lisible sur le nouveau fond. */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="text-[13px] font-bold text-white">
            Filtrer
          </span>
          {nActiveFilters > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#E63946] text-[10px] font-black leading-none">
              {nActiveFilters}
            </span>
          )}
        </button>
        </div>
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

  /* « Collé ou pas » — via une sentinelle de hauteur nulle posee JUSTE avant
     la rangee. Tant qu'elle est visible, la rangee est au repos sous
     l'en-tete ; des qu'elle sort par le haut, la rangee est epinglee.

     Pourquoi pas le prop `scrolled` qui existe deja : il est calcule sur
     `window.scrollY` (~l.1721), et en Capacitor `html`/`body` sont
     `position: fixed; overflow: hidden` — le scroll vit dans le <main> du
     layout. `window.scrollY` reste donc a 0 et l'evenement ne part jamais :
     `scrolled` est FAUX EN PERMANENCE dans l'app. Le flou et le lisere qu'il
     pilote sont du code mort cote mobile (constat, pas corrige ici).
     IntersectionObserver n'a pas ce defaut : son root par defaut est le
     viewport, il fonctionne quel que soit le conteneur qui scrolle. */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Auto-scroll horizontal pour garder l'onglet actif visible
  useEffect(() => {
    if (!containerRef.current) return;
    const btn = containerRef.current.querySelector<HTMLButtonElement>(`[data-tab="${activeStage}"]`);
    if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeStage]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 0 }} />
    <div
      className="sticky top-0 z-30"
      style={{
        /* `nx-safe-top` retire : il posait `env(safe-area-inset-top) + 0.75rem`
           EN PERMANENCE, alors que l'en-tete « Mon processus » (~l.175) reserve
           DEJA la safe-area. Sur iOS l'encoche etait donc comptee DEUX FOIS —
           ~59 px morts entre le sous-titre et les pilules sur un 17 Pro Max.
           Sur Android l'inset vaut 0, d'ou un ecart invisible : c'est ce qui
           rendait le bug propre a iOS.
           Desormais la safe-area n'est reservee que QUAND la rangee est
           epinglee — la, elle est reellement sous la Dynamic Island et doit
           s'en degager. Au repos elle remonte contre le sous-titre. */
        paddingTop: stuck ? "calc(env(safe-area-inset-top, 0px) + 0.75rem)" : "0.25rem",
        backgroundColor: scrolled ? "rgba(17,19,23,0.85)" : "#111317",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid transparent",
        transition: "background-color 200ms ease-out, backdrop-filter 200ms ease-out, border-bottom-color 200ms ease-out, padding-top 160ms ease-out",
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
    </>
  );
}

/* ── PipelineCardMobile V3 (iter 6.1b) ───────────────────────── */

/* Aucun liseré gauche sur les cartes (recette 1.4.4, BP 2026-10-02) : ni la
   teinte du statut global, ni le rouge de « Prioritaire » — le web n'en a pas.
   La priorité se lit dans le panneau de la carte. */

function PipelineCardMobile({ card, onTap }: { card: PipelineKanbanCard; onTap: () => void }) {
  // Carte prospect (lot C) : fond rouge pâle, comme au kanban web.
  const prospect = estCarte(card);
  const fond = prospect ? SURFACE_PROSPECT : "#1A1D24";
  const [first, ...rest] = (card.full_name || "").split(/\s+/);
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
      data-testid={prospect ? "carte-prospect" : "carte-dossier"}
      className="w-full relative rounded-2xl overflow-hidden active:opacity-80 transition-opacity text-left"
      style={{ height: 120, backgroundColor: fond }}
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
          background: prospect
            ? `linear-gradient(to right, transparent 0%, transparent 38%, ${fond}e6 80%, ${fond} 100%)`
            : "linear-gradient(to right, transparent 0%, transparent 38%, rgba(26,29,36,0.9) 80%, #1A1D24 100%)",
        }}
      />

      {/* Iter 7.3 Fix A — left-[150px] au RAS de la fin de photo (pas
          d'overlap → noms entiers) + z-10 pour stacking stable WebView. */}
      {/* Cote du coach, et le grade A-D SOUS elle (décision BP 2026-10-02).
          Colonne ABSOLUE en haut à droite : empilée dans la ligne du nom,
          elle grandissait la ligne et la carte (120 px fixes, centrée,
          overflow-hidden) rognait les étoiles par le haut (recette 1.4.4). */}
      <div className="absolute top-2.5 right-3 z-20 flex flex-col items-end gap-1 pointer-events-none">
        <span className="flex items-center gap-1">
          {/* Une cote ABSENTE n'est pas une cote de ZÉRO (lib/evaluations/presence).
              Sans elle, ni étoile ni chiffre — la carte n'affirme rien. */}
          {aUneCote(card.coach_rating) ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="text-[13px] font-bold text-white">{card.coach_rating.toFixed(1)}</span>
            </>
          ) : prospect ? (
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#E63946]">Prospect</span>
          ) : (
            <span className="text-[10px] text-[#6B7280]">Non évalué</span>
          )}
        </span>
        <GradeChip grade={card.grade} />
      </div>

      <div className="absolute inset-y-0 left-[150px] right-0 z-10 flex flex-col justify-center px-3">
        {/* Ligne 1 : nom + verified inline + cote droite */}
        {/* pr : la colonne cote + grade (absolue, en haut à droite). */}
        <div className="flex items-center gap-1.5 min-w-0 pr-[60px]">
          <p className="text-white font-bold text-base truncate">{card.full_name}</p>
          {card.is_verified && (
            <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3B82F6]">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </div>

        {/* Ligne 2 : position · numéro UNIQUEMENT (Fix 3 — école + promo retirées) */}
        <p className="text-[15px] text-[#9CA3AF] mt-1 truncate pr-[60px]">
          {[card.position || card.sport, card.jersey ? `#${card.jersey}` : null]
            .filter(Boolean).join(" · ") || "—"}
        </p>

        {/* Épure (recette 1.4.4, BP 2026-10-02) : plus de pastille de statut
            global (EN PROCESSUS, OUVERT…) ni de « Aucun mouvement depuis N j »
            sur la carte. Le statut reste dans la fiche. */}

        {/* Rangée de pilules — visite (VISITE_PLANIFIEE) et relance. Les deux
            partagent UNE ligne en flex-wrap : la carte est haute de 120px fixes
            avec overflow-hidden, deux lignes séparées la feraient déborder dès
            qu'un athlète porte les deux dates. */}
        {(() => {
          // De « Visite planifiée » à « Lettre signée » (regleVisite).
          const visitLabel = etapePorteVisite(card.status) ? formatVisitPill(card.visit_at) : null;
          if (!visitLabel && !relance) return null;
          return (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {/* Visite — style blanc/neutre (décision BP) sur fond subtil. */}
              {visitLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span className="text-[11px] font-bold text-white" aria-label={`Visite le ${visitLabel}`}>{visitLabel}</span>
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
                  <span className="text-[11px] font-bold" style={{ color: relance.isLate ? "#F59E0B" : "#FFFFFF" }} aria-label={`Relance le ${relance.label}`}>
                    {relance.label}
                  </span>
                </span>
              )}
            </div>
          );
        })()}

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

/* ── FiltresSheet (recette 1.4.4, BP 2026-10-02) ─────────────────
   LA porte unique des filtres : le bouton rouge « Filtrer » de l'en-tête.
   Dans l'ordre décidé par BP : Sport (directeurs seulement), les 5
   interrupteurs rapides, Position et Promotion en listes déroulantes, École
   en champ de recherche, « Réinitialiser » et « Voir N athlètes ». Plus
   aucune liste de pastilles par valeur.
   Les statistiques, le tri et le mode focus quittent la feuille ; le tri
   « relance la plus proche » suit toujours ?filtre=relances.
   Un champ texte : géométrie clavier obligatoire (remonter ET plafonner). */
function FiltresSheet({
  open, onClose,
  filters, setFilters,
  quick, setQuick,
  ecole, setEcole,
  cards, nbResultats,
  filtreSport,
}: {
  open: boolean;
  onClose: () => void;
  filters: PipelineFilters;
  setFilters: (updater: (f: PipelineFilters) => PipelineFilters) => void;
  quick: QuickKey[];
  setQuick: (updater: (q: QuickKey[]) => QuickKey[]) => void;
  ecole: string;
  setEcole: (v: string) => void;
  cards: PipelineKanbanCard[];
  /** Athlètes que les filtres laissent passer, toutes étapes confondues. */
  nbResultats: number;
  /** Directeur (admin cégep) seulement : le sport de l'unité. */
  filtreSport: FiltreSportUniteEtat | null;
}) {
  const toast = useMobileToast();
  const kbdStyle = useSheetKeyboardGeometry();
  // Monté côté client seulement (export statique) — sans setState dans un effet.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  /* Les options d'une liste se comptent sur les cartes filtrées par TOUT le
     reste (facetOptions exclut la facette comptée) : une position proposée
     rend au moins un athlète. */
  const positions = useMemo(
    () => facetOptions(cards, "position", filters, { quick, school: ecole }),
    [cards, filters, quick, ecole],
  );
  const promotions = useMemo(
    () => facetOptions(cards, "graduation_year", filters, { quick, school: ecole }),
    [cards, filters, quick, ecole],
  );

  if (!mounted) return null;

  const sportsDirecteur = filtreSport
    ? filtreSport.options.filter((o) => o.valeur !== SANS_SPORT && o.valeur !== TOUS).length
    : 0;
  const montrerSport = !!filtreSport && filtreSport.pret && sportsDirecteur >= 2;
  const choisir = (cle: "position" | "graduation_year", v: string) =>
    setFilters((f) => ({ ...f, [cle]: v ? [v] : [] }));
  const reinitialiser = () => {
    triggerHaptic("Light");
    setFilters(() => EMPTY_FILTERS);
    setQuick(() => []);
    setEcole("");
    if (filtreSport?.monSportId) filtreSport.setChoix(filtreSport.monSportId);
    toast.info({ message: "Filtres réinitialisés" });
  };
  const titre = "text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2";
  const liste = "w-full min-h-[46px] bg-[#1A1D24] border border-white/10 rounded-xl px-3 text-[15px] text-white outline-none focus:border-[#E63946] [&>option]:bg-[#13151a]";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Filtres"
            data-testid="feuille-filtres"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ ...kbdStyle, touchAction: "pan-y" }}
          >
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            <div className="flex items-center justify-between px-4 mb-1">
              <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Filtrer</h2>
              <button type="button" onClick={onClose} aria-label="Fermer" className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center active:bg-white/5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-5" style={{ overflowX: "hidden", overscrollBehaviorX: "none", touchAction: "pan-y" }}>
              {montrerSport && filtreSport && (
                <section>
                  <h3 className={titre}>Sport</h3>
                  <FiltreSportUnite filtre={filtreSport} sansGroupeSansSport className="w-full min-h-[46px]" />
                </section>
              )}

              <section>
                <h3 className={titre}>Filtres rapides</h3>
                <div className="bg-[#1A1D24] rounded-2xl divide-y divide-white/[0.06]">
                  {QUICK_FILTERS.map((q) => {
                    const actif = quick.includes(q.key);
                    return (
                      <button
                        key={q.key}
                        type="button"
                        role="switch"
                        aria-checked={actif}
                        data-testid={`filtre-choix-${q.key}`}
                        onClick={() => {
                          triggerHaptic("Light");
                          setQuick((cur) => (cur.includes(q.key) ? cur.filter((k) => k !== q.key) : [...cur, q.key]));
                        }}
                        className="w-full min-h-[50px] px-4 flex items-center justify-between text-left active:bg-white/[0.03]"
                      >
                        <span className={`text-[15px] ${actif ? "text-white font-semibold" : "text-[#e0e0e0]"}`}>{q.label}</span>
                        <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${actif ? "bg-[#E63946]" : "bg-white/10"}`}>
                          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ left: actif ? "22px" : "2px", transition: "left 200ms ease" }} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="filtre-position" className={`${titre} block`}>Position</label>
                  <select id="filtre-position" data-testid="filtre-position" className={liste}
                    value={filters.position[0] ?? ""} onChange={(e) => choisir("position", e.target.value)}>
                    <option value="">Toutes</option>
                    {positions.map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="filtre-promotion" className={`${titre} block`}>Promotion</label>
                  <select id="filtre-promotion" data-testid="filtre-promotion" className={liste}
                    value={filters.graduation_year[0] ?? ""} onChange={(e) => choisir("graduation_year", e.target.value)}>
                    <option value="">Toutes</option>
                    {promotions.map((o) => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
                  </select>
                </div>
              </section>

              <section>
                <label htmlFor="filtre-ecole" className={`${titre} block`}>École</label>
                <input
                  id="filtre-ecole"
                  data-testid="filtre-ecole"
                  type="search"
                  value={ecole}
                  onChange={(e) => setEcole(e.target.value)}
                  placeholder="Nom de l'école ou du club"
                  autoComplete="off"
                  enterKeyHint="search"
                  className={liste}
                />
              </section>
            </div>

            <div className="flex items-center gap-3 px-4 pt-2 pb-3 border-t border-white/[0.06]">
              <button type="button" onClick={reinitialiser} className="min-h-[48px] px-3 text-[14px] font-bold text-[#9CA3AF] active:text-white">
                Réinitialiser
              </button>
              <button
                type="button"
                data-testid="voir-resultats"
                onClick={() => { triggerHaptic("Light"); onClose(); }}
                className="flex-1 min-h-[48px] rounded-2xl bg-[#E63946] text-white text-[14px] font-bold active:bg-[#D42B22]"
              >
                Voir {nbResultats} athlète{nbResultats > 1 ? "s" : ""}
              </button>
            </div>
          </motion.div>
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
  card, open, onClose, isFreeDemoMode, modeUnite, moi, lectureSeule = false,
}: {
  /** Dossier d'une AUTRE unité, lu par un directeur (lot 3) : rien ne s'écrit. */
  lectureSeule?: boolean;
  card: PipelineKanbanCard | null;
  open: boolean;
  onClose: () => void;
  isFreeDemoMode: boolean;
  /** Tableau blanc (lot 2 de la 1.4.4) : Pro / All Star = le dossier de l'UNITÉ. */
  modeUnite: boolean;
  moi: string | null;
}) {
  const router = useRouter();
  const toast = useMobileToast();
  const updateStage = useUpdatePipelineStage();
  const togglePriority = useTogglePipelinePriority();
  const upsertGrade = useUpsertAthleteGrade();
  const updateNextAction = useUpdateNextAction();
  const removeFromPipeline = useRemoveFromPipeline();
  // Le sheet porte un champ (notes) : remonter ET plafonner au-dessus du
  // clavier (CLAUDE.md, « Clavier mobile »).
  const kbdStyle = useSheetKeyboardGeometry("90dvh");
  /* Les COLLÈGUES qui suivent l'athlète (moi exclu) — « Suivi par » et la
     confirmation de retrait les nomment (décision BP 3, comme le web). */
  const collegues = (card?.suivi_par ?? [])
    .map((id, i) => (id === moi ? null : card?.suivi_par_noms?.[i] ?? null))
    .filter((n): n is string => !!n);

  // Onglets (lot 3 de la 1.4.4, parité web) — rouvre toujours sur « Actions ».
  const [onglet, setOnglet] = useState<"actions" | "infos" | "historique">("actions");
  const [ongletPour, setOngletPour] = useState<string | null>(card?.id ?? null);
  if ((card?.id ?? null) !== ongletPour) { setOngletPour(card?.id ?? null); setOnglet("actions"); }
  const refuserLecture = () => toast.warning({ message: "Dossier d'une autre unité : lecture seule" });
  /* Carte prospect (lot C, recette 1.4.4) : mêmes gestes (étape, relance,
     visite, grade, priorité, notes), écrits sur la CARTE — les hooks routent
     vers ecrireCarte / retirerCarte. Pas de profil ni de message : l'athlète
     n'a pas de compte. */
  const carte = estCarte(card);

  const [isPriority, setIsPriority] = useState(card?.flagged ?? false);
  // Grade local — même raison que visitAtLocal/nextActionAtLocal : `card` est
  // un snapshot non réactif au cache TanStack.
  const [gradeLocal, setGradeLocal] = useState<Grade | null>(card?.grade ?? null);
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
    if (!open) { setDragOffset(0); setIsDragging(false); setConfirmRemove(false); }
  }, [open]);

  // Fix 5 iter 6.1b — Prefetch du profil athlète au mount du sheet pour
  // éviter le flash de page intermédiaire quand l'utilisateur tap
  // "Voir profil complet". Next router prefetch est no-op en static export
  // mais inoffensif.
  useEffect(() => {
    if (open && card?.id && !estCarte(card)) {
      try { router.prefetch(`/recruteur/athletes/${card.id}`); } catch { /* no-op */ }
    }
  }, [open, card?.id, router]);

  // Iter 6.1e Fix 4 — Auto-cancel du confirm "Retirer" après 3s d'inactivité
  // pour éviter qu'un tap accidentel reste actif si l'utilisateur ferme le
  // sheet et revient plus tard.
  useEffect(() => {
    if (!confirmRemove) return;
    // Des collègues à nommer : le temps de LIRE la phrase avant qu'elle parte.
    const t = window.setTimeout(() => setConfirmRemove(false), collegues.length > 0 || carte ? 8000 : 3000);
    return () => window.clearTimeout(t);
  }, [confirmRemove, collegues.length, carte]);

  if (!mounted) return null;

  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  const handleStageChange = async (newStage: string) => {
    if (lectureSeule) { refuserLecture(); return; }
    if (isFreeDemoMode) {
      toast.warning({ message: "Changer le stage est réservé aux membres Pro" });
      return;
    }
    if (!card) return;
    try {
      await updateStage.mutateAsync({ cardId: card.id, newStage, carte });
      toast.success({ message: `Déplacé vers ${STAGE_BY_LOWER[newStage.toLowerCase()]?.label || newStage}` });
      onClose();
    } catch {
      toast.error({ message: "Erreur lors du changement de stage" });
    }
  };

  // Modification de la date de visite depuis le kanban — CHEMIN UNIQUE côté
  // kanban : useUpdatePipelineStage (cache TanStack cohérent via l'optimistic
  // update du hook). Règle du web (regleVisite, lot 0 de la 1.4.4) : poser une
  // date avance l'étape AU MOINS à « Visite planifiée » sans jamais la faire
  // reculer (Engagé reste Engagé) ; l'effacer ne change pas l'étape.
  const handleSaveVisitDate = async (iso: string | undefined) => {
    if (lectureSeule) { refuserLecture(); return; }
    if (!card) return;
    if (isFreeDemoMode) {
      toast.warning({ message: "Planifier une visite est réservé aux membres Pro" });
      return;
    }
    const prev = visitAtLocal;
    setSavingVisit(true);
    setVisitAtLocal(iso ?? null);
    try {
      await updateStage.mutateAsync({
        cardId: card.id,
        newStage: (iso ? etapeApresSaisieVisite(card.status) : card.status).toUpperCase(),
        visitAtIso: iso ?? null,
        carte,
      });
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
    if (lectureSeule) { refuserLecture(); return; }
    if (!card) return;
    if (isFreeDemoMode) {
      toast.warning({ message: "Planifier une relance est réservé aux membres Pro" });
      return;
    }
    const prev = nextActionAtLocal;
    setSavingNextAction(true);
    setNextActionAtLocal(dateStr);
    try {
      await updateNextAction.mutateAsync({ cardId: card.id, nextActionAt: dateStr, carte });
      toast.success({ message: dateStr ? "Date de relance enregistrée" : "Date de relance effacée" });
    } catch {
      setNextActionAtLocal(prev);
      toast.error({ message: "Erreur lors de l'enregistrement de la relance" });
    } finally {
      setSavingNextAction(false);
    }
  };

  const handleTogglePriority = async () => {
    if (lectureSeule) { refuserLecture(); return; }
    if (isFreeDemoMode) {
      toast.warning({ message: "Marquer prioritaire est réservé aux membres Pro" });
      return;
    }
    if (!card) return;
    const newValue = !isPriority;
    setIsPriority(newValue); // optimistic local
    triggerHaptic("Light");
    try {
      await togglePriority.mutateAsync({ cardId: card.id, value: newValue, carte });
    } catch {
      setIsPriority(!newValue);
      toast.error({ message: "Erreur priorité" });
    }
  };

  // `null` retire le grade — useUpsertAthleteGrade traduit ça en DELETE.
  // Optimiste local + rollback, sans spinner : la grille reste tapable.
  const handleSetGrade = async (grade: Grade | null) => {
    if (lectureSeule) { refuserLecture(); return; }
    if (isFreeDemoMode) {
      toast.warning({ message: "Noter un athlète est réservé aux membres Pro" });
      return;
    }
    if (!card) return;
    const prev = gradeLocal;
    setGradeLocal(grade);
    triggerHaptic("Light");
    try {
      await upsertGrade.mutateAsync({ athleteId: card.id, grade, carte });
    } catch {
      setGradeLocal(prev);
      toast.error({ message: "Erreur grade" });
    }
  };

  const handleRemove = async () => {
    if (lectureSeule) { refuserLecture(); return; }
    if (!card) return;
    if (isFreeDemoMode) {
      toast.warning({ message: "La gestion du processus est réservée aux membres Pro" });
      return;
    }
    if (!confirmRemove) { setConfirmRemove(true); return; }
    try {
      // Pour toute l'unité (unite_retirer_du_processus) — la confirmation a
      // nommé les collègues juste avant. Unité du dossier, comme le web.
      await removeFromPipeline.mutateAsync({ cardId: card.id, sportId: card.unite_sport_id ?? null, carte });
      toast.success({ message: carte ? "Carte prospect supprimée" : "Athlète retiré du processus" });
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
            // kbdStyle : remonte ET plafonne au-dessus du clavier (champ de notes).
            style={{ ...kbdStyle, touchAction: "pan-y" }}
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
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
              /* Verrou horizontal. `touch-action: pan-y` existe deja sur la
                 RACINE du sheet, mais il ne protege pas ce conteneur-ci : c'est
                 LUI qui scrolle (`overflow-y-auto`), et sans contrainte sur X un
                 enfant plus large le rend scrollable lateralement — le contenu
                 se tire au doigt et s'etire sous WebKit.
                 Les trois ensemble : `hidden` interdit le scroll X, `none` coupe
                 le rebond elastique sur X (l'axe Y garde le sien), `pan-y`
                 declare au compositeur que seul le geste vertical compte — il
                 cesse d'attendre pour arbitrer et le scroll vertical part plus
                 franchement. */
              style={{ overflowX: "hidden", overscrollBehaviorX: "none", touchAction: "pan-y" }}
            >
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
                  {carte && (
                    <p className="text-[11px] uppercase tracking-wider font-bold text-[#E63946] mt-1">Carte prospect · sans compte Nexus</p>
                  )}
                  {/* Tableau blanc : qui d'autre suit ce dossier dans l'unité. */}
                  {modeUnite && collegues.length > 0 && (
                    <p className="text-[12px] text-[#9CA3AF] mt-1">
                      Suivi aussi par <span className="text-white">{collegues.join(", ")}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ONGLETS (lot 3 de la 1.4.4, parité web) — Actions / Infos /
                  Historique. Infos et Historique sont les composants du web. */}
              <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-[#1A1D24]">
                {([["actions", "Actions"], ["infos", "Infos"], ["historique", "Historique"]] as const).map(([cle, libelle]) => (
                  <button
                    key={cle}
                    type="button"
                    role="tab"
                    aria-selected={onglet === cle}
                    onClick={() => { triggerHaptic("Light"); setOnglet(cle); }}
                    className={`flex-1 min-h-[40px] rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${onglet === cle ? "bg-[#E63946] text-white" : "text-[#9CA3AF] active:bg-white/[0.04]"}`}
                  >
                    {libelle}
                  </button>
                ))}
              </div>

              {/* Infos d'un dossier : monté dès l'ouverture de la fiche, CACHÉ
                  hors de son onglet — il se charge pendant qu'on est sur
                  Actions, et reste en mémoire pour la session (recette 1.4.4). */}
              {!estCarte(card) && (
                <div hidden={onglet !== "infos"}>
                  <OngletInfosPanneau athleteId={card.id} memoire />
                </div>
              )}
              {onglet === "infos" ? (
                estCarte(card) ? <OngletInfosCarte card={card} /> : null
              ) : onglet === "historique" ? (
                estCarte(card) ? <OngletHistoriqueCarte carteId={card.id} /> : <OngletHistoriquePanneau athleteId={card.id} />
              ) : (
              <>
              {lectureSeule && (
                <p className="text-[12px] text-[#F59E0B] leading-snug rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] px-3 py-2.5" role="note">
                  Dossier d&apos;une autre unité de ton cégep : lecture seule.
                </p>
              )}

              {/* Pill statut global + recruté ailleurs warning */}
              {(() => {
                const status = statusGlobalColor(card.recruitment_status);
                const recrutedElsewhere =
                  card.recruitment_status === "RECRUTE" &&
                  ["identifie", "contacte", "en_discussion", "visite_planifiee"].includes(card.status);
                // Une carte prospect n'a pas de statut global : « Ouvert » n'y dirait rien.
                if (carte || (!status && !recrutedElsewhere)) return null;
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
              {etapePorteVisite(card.status) && (
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

              {/* Cote — les étoiles vides restent visibles pour tenir la mise en
                  page, mais SANS chiffre : « 0,0 » affirmerait une note de zéro
                  là où il n'y a pas de note (lib/evaluations/presence). */}
              {!carte && <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24"
                    fill={aUneCote(card.coach_rating) && i <= Math.round(card.coach_rating) ? "#F59E0B" : "#4a4d56"} stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
                {aUneCote(card.coach_rating) ? (
                  <>
                    <span className="text-[13px] font-bold text-[#F59E0B] ml-1">{card.coach_rating.toFixed(1)}</span>
                    <span className="text-[11px] text-[#6B7280] ml-1">Cote du coach</span>
                  </>
                ) : (
                  <span className="text-[11px] text-[#6B7280] ml-1">Pas encore évalué par son entraîneur</span>
                )}
              </div>}

              {/* Grade — SOUS la cote (lot 3 de la 1.4.4). Cibles 44px
                  (compact={false}) : c'est du tactile, pas du curseur. */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">{modeUnite ? "Grade de l'unité" : "Mon grade"}</h3>
                <GradePicker value={gradeLocal} onSelect={handleSetGrade} compact={false} />
              </div>

              {/* Progress completion — sans objet pour une carte prospect. */}
              {!carte && <div>
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
              </div>}

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

              {/* Notes de suivi — LE fil du joueur, signé (lot 2 de la 1.4.4) :
                  les notes de l'unité, les miennes supprimables, celles des
                  collègues en lecture seule. Mode démo : les miennes, et
                  « Poster » renvoie à l'offre Pro. */}
              <FilNotesSuiviMobile
                athleteId={card.id}
                carteId={carte ? card.id : null}
                modeUnite={modeUnite}
                lectureSeule={lectureSeule}
                onTease={() => toast.warning({ message: "Les notes sont réservées aux membres Pro" })}
                onErreur={(m) => toast.error({ message: m })}
              />

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
                {!carte && (<>
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
                </>)}
                {/* Iter 6.1e Fix 4 — État confirm = rouge plein + halo pulse.
                    Tableau blanc : la phrase dit ce que le retrait fait, et
                    NOMME les collègues (même texte que le web). */}
                {confirmRemove && (
                  <p className="text-[12px] text-[#F59E0B] leading-snug px-1" role="alert">
                    {carte ? MESSAGE_RETRAIT_CARTE : messageRetraitProcessus(collegues, modeUnite)}
                  </p>
                )}
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
                  {confirmRemove ? (carte ? "Confirmer la suppression" : "Confirmer le retrait") : (carte ? "Supprimer la carte" : "Retirer du processus")}
                </button>
              </div>
              </>
              )}
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
  const searchParams = useSearchParams();
  const { tier, loading: tierLoading, isSchoolAdmin } = useSubscription();
  /* ── DÉCISION PRODUIT (BP, 2026-09-10) — écrite, jamais héritée ──────
     LE MODE DÉMO GRATUIT DE « MON PROCESSUS » EST ASSUMÉ.

     Un compte Free VOIT le pipeline et ne peut rien y écrire. Ce n'est pas
     un verrou oublié : c'est un levier de conversion, et il est délibéré
     depuis 0002c30 (« Pipeline demo mode for Free + sidebar unlock »), qui
     a retiré le <FeatureGate feature="unlimited_pipeline" requiredTier="pro">
     posé le matin même par 23c060e.

     ⚠️ DEUX CHOSES CONTREDISENT CE CHOIX AILLEURS, et c'est voulu de les
     laisser dire le contraire tant que le chantier « source de vérité unique
     du gating » n'a pas tranché (docs/fast-follow-1.4.2.md) :

       · la NAVIGATION reverrouille — `requiredTier: "pro"` sur l'item de la
         sidebar (adea65b) et de la MobileTabBar. Le lien est donc bloqué,
         la route ne l'est pas. C'est ce qui rend la démo atteignable par
         lien direct et invisible depuis le menu.
       · la TABLE DE FEATURES du SubscriptionProvider déclare
         `free.can_use_pipeline: false`. Elle n'est lue par personne.

     CE QUI TIENT VRAIMENT, ce n'est aucun de ces deux-là : c'est la RLS.
     `user_has_pro()` garde le with_check de recruiter_pipeline en INSERT
     ET en UPDATE. La démo est donc en lecture seule par construction, pas
     par politesse du client. Ne retirez pas ces gardes `isFreeDemoMode`
     en croyant simplifier : elles évitent à l'usager un refus serveur sec.
     ──────────────────────────────────────────────────────────────────── */
  const isFreeDemoMode = !tierLoading && tier === "free";
  const queryClient = useQueryClient();
  const toast = useMobileToast();
  useCurrentUser(); // warm cache pour les hooks de mutation

  /* ── TABLEAU BLANC DE L'UNITÉ (lot 2 de la 1.4.4, registre §38) ─────
     Même partage que le web (app/recruteur/pipeline/page.tsx) : un Pro ou
     All Star voit le processus de son UNITÉ (cégep × sport) — une carte par
     athlète, qui le suit, les notes signées ; un gratuit reste sur SES
     lignes en mode démo. Pendant le chargement du palier, rien n'est lu.
     Le filtre sport de l'admin cégep (lecture seule hors de son sport)
     arrive avec le lot 3 : ici, l'unité de l'acteur seulement.

     CARTES PROSPECT (lot C) : useProcessusUnite les rend avec les dossiers.
     Depuis la recette 1.4.4 (BP 2026-10-02), l'app les AFFICHE (fond rouge
     pâle, comme le web) et les ouvre : étape, relance, visite, grade,
     priorité, notes, Infos, Historique. Leur CRÉATION reste au web. */
  const modeUnite = !tierLoading && (tier === "pro" || tier === "all_star");
  const { data: donneesDemo, isLoading: chargementDemo } = usePipelineCards({ enabled: isFreeDemoMode });
  /* Directeur (admin cégep) — lot 3 de la 1.4.4, parité web : un sélecteur de
     sport (son sport, un autre sport de son cégep, ou tout le cégep). Hors de
     son sport, les dossiers se LISENT sans se modifier (registre §40). */
  const adminCegep = modeUnite && !!isSchoolAdmin;
  const filtreSport = useFiltreSportUnite();
  const choixSport = adminCegep ? filtreSport.choix : null;
  const sportParam = choixSport && choixSport !== TOUS && choixSport !== SANS_SPORT ? choixSport : null;
  const { data: donneesUnite, isLoading: chargementUnite } = useProcessusUnite({
    enabled: modeUnite && (!adminCegep || filtreSport.pret),
    sportId: sportParam,
    toutLeCegep: choixSport === TOUS,
  });
  const pipelineData = modeUnite ? donneesUnite : isFreeDemoMode ? donneesDemo : undefined;
  const pipelineLoading = modeUnite ? chargementUnite : isFreeDemoMode ? chargementDemo : true;
  /* Mémoïsé : `?? []` fabriquait un tableau NEUF à chaque rendu, si bien que
     tous les useMemo qui en dépendent se recalculaient sans arrêt — le lint le
     signalait déjà avant l'ajout des compteurs filtrés. */
  const cards = useMemo(() => pipelineData?.cards ?? [], [pipelineData]);
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const loading = tierLoading || pipelineLoading;
  /** Dossier d'une autre unité (directeur sur un autre sport) : lecture seule.
   *  SAUF un dossier que JE suis (recette 1.4.4) : un recruteur dont le sport
   *  a changé gardait ses dossiers dans l'ancienne unité et ne pouvait plus
   *  rien y écrire — relance, étape, grade tombaient en « lecture seule ». */
  const estAutreUnite = (c: PipelineKanbanCard | null | undefined) =>
    !!c && modeUnite && !!c.unite_sport_id && !!filtreSport.monSportId && c.unite_sport_id !== filtreSport.monSportId
    && !(!!moi && (c.suivi_par ?? []).includes(moi));

  const [selectedCard, setSelectedCard] = useState<PipelineKanbanCard | null>(null);
  const [activeStage, setActiveStage] = useState<string>(STAGES[0].lower);
  const [sheetOpen, setSheetOpen] = useState(false);

  // La feuille « Filtrer » (porte unique des filtres, recette 1.4.4).
  const [menuOpen, setMenuOpen] = useState(false);
  /* ?filtre=relances (parité avec app/recruteur/pipeline/page.tsx) : chip
     active + tri « relance la plus proche » dès le premier rendu. */
  const filtreUrl = searchParams.get("filtre");
  const [sortBy, setSortBy] = useState<PipelineSortMode>(() =>
    filtreUrl === FILTRE_PIPELINE_URL.relances ? "next_action_asc" : DEFAULT_PIPELINE_SORT,
  );
  const [filters, setFilters] = useState<PipelineFilters>(EMPTY_FILTERS);
  const [quick, setQuick] = useState<QuickKey[]>(() => quickDepuisFiltreUrl(filtreUrl));
  /** Recherche d'école ou de club (feuille « Filtrer »). */
  const [ecole, setEcole] = useState("");
  /* « + Prospect » — mêmes conditions que le web : la carte naît dans
     l'unité du recruteur, donc pas quand un directeur regarde un autre
     sport (ou tout le cégep). */
  const [creerProspect, setCreerProspect] = useState(false);
  const monSportId = currentUser?.profile.sport_id ?? null;
  const peutCreerProspect = modeUnite && !!monSportId && !(adminCegep && filtreSport.choix !== monSportId);

  // Mutation pour le swipe
  const updateStage = useUpdatePipelineStage();

  // Groupage par stage + counts (counts pour les tabs, tous stages)
  /* LES COMPTEURS SUIVENT LE FILTRE (patron du web, où FunnelSummary reçoit
     `filteredCards` et garde `cards.length` à part pour le total).

     Avant, `cardsByStage` était bâti sur `cards` brutes : les pastilles des
     onglets et la ventilation du menu annonçaient 12 là où la liste filtrée
     n'en rendait que 3. Un compteur qui ne suit pas le filtre ne décrit plus
     rien — il dit juste combien il y en aurait sans filtre.

     Le TOTAL, lui, reste brut : c'est « combien d'athlètes je suis », une
     réponse qui ne doit pas bouger quand je regarde un sous-ensemble. */
  const cardsFiltrees = useMemo(
    () => filterPipelineCards(cards, filters, { quick, school: ecole }),
    [cards, filters, quick, ecole],
  );

  const cardsByStage = useMemo(() => {
    const grouped: Record<string, PipelineKanbanCard[]> = {};
    for (const s of STAGES) grouped[s.lower] = [];
    for (const card of cards) {
      const stageLower = (card.status || "identifie").toString().toLowerCase();
      if (grouped[stageLower]) grouped[stageLower].push(card);
    }
    return grouped;
  }, [cards]);
  /* Les pastilles des onglets comptent sur les cartes FILTRÉES. */
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STAGES) c[s.lower] = 0;
    for (const card of cardsFiltrees) {
      const k = (card.status || "identifie").toString().toLowerCase();
      if (c[k] !== undefined) c[k]++;
    }
    return c;
  }, [cardsFiltrees]);

  // Fix 2 (page-par-stage) + iter 6.1b sort/filter/focus + tri prioritaires
  const activeStageCards = useMemo(() => {
    // FILTRER PUIS TRIER — même ordre qu'au web. Les facettes viennent de
    // lib/pipeline/filterPipelineCards, le tri de sortPipelineCards : les
    // deux surfaces appellent exactement les mêmes fonctions.
    const list = filterPipelineCards(cardsByStage[activeStage] ?? [], filters, { quick, school: ecole });
    return sortPipelineCards(list, sortBy);
  }, [cardsByStage, activeStage, filters, quick, ecole, sortBy]);

  // Index du stage actif pour les bornes du swipe (canSwipeLeft/Right)
  const activeStageIndex = useMemo(
    () => STAGES.findIndex((s) => s.lower === activeStage),
    [activeStage]
  );

  const handleTabTap = (lower: string) => {
    setActiveStage(lower);
  };

  /* ── ?filtre= venu du tableau de bord (paquet A 1.4.4) ─────────────────
     LE BUG : la puce « À relancer » s'activait, mais l'écran restait sur
     l'onglet « Identifié ». Les relances dues des autres étapes étaient
     filtrées… et invisibles : « Tout voir » ouvrait une liste vide ou
     partielle alors que la carte du tableau de bord en annonçait N.
     Le web n'a pas ce problème (une seule liste, toutes étapes).

     1. Le filtre suit l'URL même si l'écran est déjà monté (un second
        « Tout voir » ne remontait pas l'état initial).
     2. Une fois les cartes chargées, l'onglet se place sur la PREMIÈRE
        étape qui contient une carte filtrée — une seule fois par arrivée,
        pour ne pas reprendre la main à l'usager qui change d'onglet. */
  /* Motif « ajuster l'état pendant le rendu » (react.dev, you-might-not-
     need-an-effect) : pas de setState dans un effet, pas de rendu en cascade. */
  const [filtreVu, setFiltreVu] = useState<string | null>(filtreUrl);
  if (filtreUrl !== filtreVu) {
    setFiltreVu(filtreUrl);
    if (filtreUrl) {
      setQuick(quickDepuisFiltreUrl(filtreUrl));
      if (filtreUrl === FILTRE_PIPELINE_URL.relances) setSortBy("next_action_asc");
    }
  }
  const [filtrePositionne, setFiltrePositionne] = useState<string | null>(null);
  /* Les DONNÉES doivent être là (recette 1.4.4, tuile Visites) : pour un
     directeur, la lecture attend son filtre sport — désactivée, elle n'est
     pas « en chargement », et le positionnement se faisait sur un processus
     VIDE, une fois pour toutes, en restant sur « Identifié (0) ». */
  if (filtreUrl && filtreUrl === filtreVu && !pipelineLoading && !!pipelineData && filtrePositionne !== filtreUrl && quick.length > 0) {
    setFiltrePositionne(filtreUrl);
    const premiere = STAGES.find((st) => (counts[st.lower] ?? 0) > 0);
    if (premiere) setActiveStage(premiere.lower);
  }

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

  /* ?athlete=<id> (clic sur un nom précis dans « Relances aujourd'hui ») :
     ouvre directement sa fiche pipeline — même mécanique que le SlideOver
     web. `cards` charge de façon async, l'effet réessaie à chaque changement
     jusqu'à ce que la carte apparaisse. `card.id` est l'athlete_id. */
  /* Une seule ouverture par athlète demandé : sans ce verrou, chaque
     rechargement de `cards` (après un balayage, une note, une relance)
     ROUVRAIT la feuille qu'on venait de fermer. L'onglet suit l'étape de la
     carte, pour qu'on la retrouve en refermant. */
  const athleteDemande = searchParams.get("athlete");
  const [athleteOuvert, setAthleteOuvert] = useState<string | null>(null);
  if (athleteDemande !== athleteOuvert) {
    const found = athleteDemande ? cards.find((c) => c.id === athleteDemande) : null;
    if (!athleteDemande) {
      setAthleteOuvert(null);
    } else if (found) {
      setAthleteOuvert(athleteDemande);
      const etape = (found.status || "identifie").toString().toLowerCase();
      if (STAGE_BY_LOWER[etape]) setActiveStage(etape);
      setSelectedCard(found);
      setSheetOpen(true);
    }
  }

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
    if (estAutreUnite(card)) {
      toast.warning({ message: "Dossier d'une autre unité : lecture seule" });
      return;
    }
    const fromStage = STAGES[activeStageIndex];
    const toStage = direction === "right" ? STAGES[activeStageIndex + 1] : STAGES[activeStageIndex - 1];
    if (!fromStage || !toStage) return;
    updateStage.mutate(
      { cardId: card.id, newStage: toStage.key, carte: estCarte(card) },
      {
        onSuccess: () => {
          toast.success({
            message: `Déplacé vers ${toStage.label}`,
            duration: 5000,
            action: {
              label: "Annuler",
              onClick: () => {
                updateStage.mutate(
                  { cardId: card.id, newStage: fromStage.key, carte: estCarte(card) },
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

      <PipelineHeader
        totalCount={cards.length}
        nActiveFilters={activeFilterCount(filters, { quick, school: ecole })}
        onFilterTap={handleMenuTap}
        onProspectTap={peutCreerProspect ? () => setCreerProspect(true) : undefined}
      />

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

      {/* Directeur : l'avis de lecture seule reste à l'écran ; le choix du
          sport est passé dans la feuille « Filtrer » (recette 1.4.4). Plus
          de pastille « Filtres » : le bouton rouge de l'en-tête est la seule
          porte. */}
      {adminCegep && (
        <div className="px-4 pt-2">
          <AvisLectureSeule filtre={filtreSport} />
        </div>
      )}

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
        modeUnite={modeUnite}
        moi={moi}
        lectureSeule={estAutreUnite(selectedCard)}
      />

      {creerProspect && monSportId && (
        <CreerProspectMobile sportId={monSportId} onClose={() => setCreerProspect(false)} />
      )}

      <FiltresSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        filters={filters} setFilters={setFilters}
        quick={quick} setQuick={setQuick}
        ecole={ecole} setEcole={setEcole}
        cards={cards}
        nbResultats={cardsFiltrees.length}
        filtreSport={adminCegep ? filtreSport : null}
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
