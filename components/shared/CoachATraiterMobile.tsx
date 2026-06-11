"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachATraiterMobile — Page mobile-native /coach/a-traiter.

   Consomme lib/coach/tasks.loadCoachTasks → CoachTasksBreakdown.
   AUCUNE recomputation des règles "à traiter" ici — toute la vérité
   vit dans le helper. Si le tab badge / dashboard divergent un
   jour, c'est qu'ils n'ont pas encore migré (step 3c).

   Layout :
     1. Header (titre + sous-titre)
     2. 3 filter cards (Vérification gris · Évaluation gold · Demandes vert)
        — tap = filtre la liste ; re-tap = retour à "Tout"
     3. View toggle "Par athlète | Toutes les tâches"
     4. Liste (respecte filtre + view)
     5. Actions inline :
        - Vérifier  → 5-col update sur athletes (no confirm)
        - Évaluer   → bottom-sheet quick-eval (star + rapport) → upsert evaluations
        - Approuver → status='APPROUVEE' (trigger applique côté serveur)
        - Rejeter   → status='REJETEE' + raison_rejet
     6. Empty state (total=0) → /empty/nexus-empty-shortlist.png (TODO: asset dédié)

   Après chaque action : reload des tasks (compteurs 3 cards live).
   Pull-to-refresh : même pattern que CoachAthletesMobile.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  loadCoachTasks,
  type CoachTasksBreakdown,
  type CoachTaskAthlete,
  type CoachTaskSuggestion,
} from "@/lib/coach/tasks";
import { useMobileToast } from "@/components/mobile/MobileToast";
import SuggestionSheet from "@/components/coach/SuggestionSheet";
import AthletePhoto from "@/components/shared/AthletePhoto";

/* ── Types ────────────────────────────────────────────────────── */

type FilterKey = "all" | "verif" | "eval" | "demande";
type ViewMode = "athlete" | "tasks";

interface PerAthleteEntry {
  athlete: CoachTaskAthlete;
  unverified: boolean;
  missingEval: boolean;
  suggestions: CoachTaskSuggestion[];
}

type FlatEntry =
  | { kind: "suggestion"; athlete: CoachTaskAthlete; suggestion: CoachTaskSuggestion }
  | { kind: "unverified"; athlete: CoachTaskAthlete }
  | { kind: "missingEval"; athlete: CoachTaskAthlete };

/* ── Helpers ──────────────────────────────────────────────────── */

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

function relativeTime(iso: string): string {
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

function slimAthleteFromName(athleteId: string, athleteName: string): CoachTaskAthlete {
  const [firstName, ...rest] = (athleteName || "").split(" ");
  return {
    id: athleteId,
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    photo: null,
    position: "",
    graduationYear: 0,
    sport: "",
  };
}

/* Mapping champ (label FR du trigger apply_approved_suggestion) → label
   compact pour la summary line. Fallback "Changement : {champ}" pour tout
   champ non mappé (assure-zéro silent drop si un nouveau champ apparait). */
const CHAMP_LABEL_MAP: Record<string, string> = {
  "Numéro": "Changement de numéro",
  "Position": "Changement de position",
  "Position secondaire": "Changement de position secondaire",
  "Sport principal": "Changement de sport principal",
  "Sport secondaire": "Changement de sport secondaire",
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
  "Leadership": "Nouveau score de leadership",
  "Discipline": "Nouveau score de discipline",
  "Coachabilité": "Nouveau score de coachabilité",
  "Intelligence de jeu": "Nouveau score d'intelligence de jeu",
  "Compétitivité": "Nouveau score de compétitivité",
  "Esprit d'équipe": "Nouveau score d'esprit d'équipe",
  "Résilience": "Nouveau score de résilience",
  "Attitude / Mentalité": "Nouveau score d'attitude",
  "Distinctions": "Nouvelles distinctions",
  "Distinction personnalisée": "Nouvelle distinction",
};

function champLabel(champ: string): string {
  if (!champ) return "Suggestion";
  return CHAMP_LABEL_MAP[champ] ?? `Changement : ${champ}`;
}

/* ── Filter card (top row) ────────────────────────────────────── */

function FilterCard({
  label, count, color, active, onTap, icon, countColor,
}: {
  label: string;
  count: number;
  /** Accent (border, icon tint, active glow). */
  color: string;
  active: boolean;
  onTap: () => void;
  icon: React.ReactNode;
  /** Color for the big count number. Defaults to white. Set independently
   *  of `color` so we can show e.g. a gray-accent card with a blue count. */
  countColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="relative flex flex-col items-center justify-center px-3 py-3 rounded-2xl bg-[#1A1D24] transition-all active:scale-[0.98]"
      style={{
        border: active ? `1.5px solid ${color}` : "1px solid rgba(255,255,255,0.05)",
        boxShadow: active ? `0 0 18px ${color}33` : undefined,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}1A` }}
      >
        {icon}
      </div>
      <span
        className="text-[22px] font-extrabold leading-none tabular-nums"
        style={{ color: countColor ?? "#FFFFFF" }}
      >
        {count}
      </span>
      <span className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] mt-1.5 text-center leading-tight">
        {label}
      </span>
    </button>
  );
}

/* ── View toggle (Par athlète | Toutes les tâches) ────────────── */

function ViewToggle({
  viewMode, onChange,
}: {
  viewMode: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5 w-fit">
      <button
        type="button"
        onClick={() => { triggerHaptic("Light"); onChange("athlete"); }}
        className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${
          viewMode === "athlete"
            ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]"
            : "text-[#6b7280]"
        }`}
      >
        Par athlète
      </button>
      <button
        type="button"
        onClick={() => { triggerHaptic("Light"); onChange("tasks"); }}
        className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${
          viewMode === "tasks"
            ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]"
            : "text-[#6b7280]"
        }`}
      >
        Toutes les tâches
      </button>
    </div>
  );
}

/* ── Athlete row (header for accordion + flat row anchor) ─────── */

function AthleteIdentity({ athlete, size = 40 }: { athlete: CoachTaskAthlete; size?: number }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-shrink-0 rounded-full overflow-hidden bg-[#2F3440]" style={{ width: size, height: size }}>
        <AthletePhoto
          photoUrl={athlete.photo ?? ""}
          firstName={athlete.firstName}
          lastName={athlete.lastName}
          size={size}
        />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-white truncate">
          {athlete.firstName} {athlete.lastName}
        </p>
        {(athlete.position || athlete.sport) && (
          <p className="text-[11px] text-[#9CA3AF] truncate">
            {[athlete.position, athlete.sport].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Task action rows (used inside accordion + flat view) ─────── */

function VerifyActionRow({ onVerify }: { onVerify: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#0C0E12] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-full bg-[#4a4d56]/15 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <span className="text-[12px] font-semibold text-[#9CA3AF] truncate">Profil non vérifié</span>
      </div>
      <button
        type="button"
        onClick={() => { triggerHaptic("Medium"); onVerify(); }}
        className="px-3 py-1.5 rounded-lg bg-[#3B82F6] active:bg-[#2563EB] text-white text-[11px] font-bold uppercase tracking-wider"
      >
        Vérifier
      </button>
    </div>
  );
}

function EvalActionRow({ onEvaluate, athleteId }: { onEvaluate: () => void; athleteId: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#0C0E12] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-full bg-[#F59E0B]/15 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <span className="text-[12px] font-semibold text-[#F59E0B] truncate">Évaluation manquante</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/coach/athletes/${athleteId}/modifier`}
          className="hidden sm:inline text-[11px] text-[#6B7280] active:text-white"
        >
          Complète →
        </Link>
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); onEvaluate(); }}
          className="px-3 py-1.5 rounded-lg bg-[#F59E0B] active:bg-[#D97706] text-white text-[11px] font-bold uppercase tracking-wider"
        >
          Évaluer
        </button>
      </div>
    </div>
  );
}

/* ── SuggestionsSummaryBlock + SuggestionSheet — collapse l'ancien
   inline SuggestionActionRow vers : (a) une summary compacte (1 ligne
   par suggestion, tappable) dans l'accordion / la flat list, et
   (b) une bottom-sheet portaled qui contient TOUT le détail (champ,
   diff, message, time, approve/reject). ─────────────────────────── */

function SuggestionSummaryLine({
  suggestion, onTap,
}: {
  suggestion: CoachTaskSuggestion;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left active:bg-white/[0.03] transition-colors"
    >
      <span className="text-[13px] text-[#E63946] font-semibold truncate">
        {champLabel(suggestion.champ)}
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function SuggestionsSummaryBlock({
  suggestions, onTapSuggestion,
}: {
  suggestions: CoachTaskSuggestion[];
  onTapSuggestion: (s: CoachTaskSuggestion) => void;
}) {
  /* Exit animations : block-level quand la liste se vide ; row-level
     quand UNE suggestion est résolue (les autres restent). ~240ms ease-out,
     fade + height collapse + scale léger. Cohérent avec SuggestionsAlert
     sur le coach profile. */
  return (
    <AnimatePresence initial={false}>
      {suggestions.length > 0 && (
        <motion.div
          key="sug-summary-block"
          initial={{ opacity: 0, height: 0, scale: 0.97 }}
          animate={{ opacity: 1, height: "auto", scale: 1 }}
          exit={{ opacity: 0, height: 0, scale: 0.97 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
        >
    <div className="bg-[#0C0E12] rounded-xl px-3 py-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-[#E63946]/15 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <span className="text-[12px] font-bold text-white">Suggestions</span>
        <span className="text-[11px] text-[#6B7280] tabular-nums">{suggestions.length}</span>
      </div>
      <div className="space-y-0.5">
        <AnimatePresence initial={false} mode="popLayout">
          {suggestions.map((s) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, height: 0, scale: 0.97 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.97 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <SuggestionSummaryLine suggestion={s} onTap={() => onTapSuggestion(s)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* SuggestionSheet a été extrait vers components/coach/SuggestionSheet.tsx
   (Step 4 — réutilisé par CoachAthleteProfileBodyMobile). Import au top. */

/* ── Athlete accordion card (per-athlete view) ────────────────── */

function AthleteAccordionCard({
  entry, expanded, onToggle,
  onVerify, onEvaluate, onOpenSuggestion,
}: {
  entry: PerAthleteEntry;
  expanded: boolean;
  onToggle: () => void;
  onVerify: (athleteId: string) => void;
  onEvaluate: (athleteId: string, athleteName: string) => void;
  /** Tap d'une summary line → ouvre la SuggestionSheet pour cette suggestion. */
  onOpenSuggestion: (suggestion: CoachTaskSuggestion, athleteName: string) => void;
}) {
  const taskCount =
    (entry.unverified ? 1 : 0) + (entry.missingEval ? 1 : 0) + entry.suggestions.length;
  return (
    <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.05] overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => { triggerHaptic("Light"); onToggle(); }}
        className="w-full flex items-center justify-between gap-3 p-3 text-left active:bg-white/[0.03] transition-colors"
      >
        <AthleteIdentity athlete={entry.athlete} />
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Task indicators as colored dots — keeps the name from being
              truncated when all 3 task types are present.
              blue = vérification · gold = évaluation · rouge = suggestions */}
          {entry.unverified && (
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" aria-label="Vérification requise" />
          )}
          {entry.missingEval && (
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" aria-label="Évaluation manquante" />
          )}
          {entry.suggestions.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#E63946]" aria-label={`${entry.suggestions.length} suggestion${entry.suggestions.length > 1 ? "s" : ""} en attente`} />
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`ml-1 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="accordion-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2">
              {entry.unverified && (
                <VerifyActionRow onVerify={() => onVerify(entry.athlete.id)} />
              )}
              {entry.missingEval && (
                <EvalActionRow
                  athleteId={entry.athlete.id}
                  onEvaluate={() => onEvaluate(entry.athlete.id, `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim())}
                />
              )}
              {entry.suggestions.length > 0 && (
                <SuggestionsSummaryBlock
                  suggestions={entry.suggestions}
                  onTapSuggestion={(s) =>
                    onOpenSuggestion(s, `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim())
                  }
                />
              )}
              {taskCount === 0 && (
                <p className="text-[12px] text-[#6B7280] italic py-2">Plus rien à traiter pour cet athlète.</p>
              )}
              {/* Profile link — secondary escape hatch from the actions list. */}
              <Link
                href={`/coach/athletes/${entry.athlete.id}`}
                className="flex items-center justify-center gap-1.5 bg-[#0C0E12] rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#9CA3AF] active:text-white transition-colors"
              >
                Voir profil
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Flat list item (Toutes les tâches view) ──────────────────── */

function FlatListItem({
  entry, onVerify, onEvaluate, onOpenSuggestion,
}: {
  entry: FlatEntry;
  onVerify: (athleteId: string) => void;
  onEvaluate: (athleteId: string, athleteName: string) => void;
  onOpenSuggestion: (suggestion: CoachTaskSuggestion, athleteName: string) => void;
}) {
  return (
    <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.05] p-3 space-y-2">
      <AthleteIdentity athlete={entry.athlete} size={36} />
      {entry.kind === "unverified" && <VerifyActionRow onVerify={() => onVerify(entry.athlete.id)} />}
      {entry.kind === "missingEval" && (
        <EvalActionRow
          athleteId={entry.athlete.id}
          onEvaluate={() => onEvaluate(entry.athlete.id, `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim())}
        />
      )}
      {entry.kind === "suggestion" && (
        <SuggestionsSummaryBlock
          suggestions={[entry.suggestion]}
          onTapSuggestion={(s) =>
            onOpenSuggestion(s, `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim())
          }
        />
      )}
    </div>
  );
}

/* ── EvalSheet — bottom-sheet quick-eval (star + rapport) ─────── */

function EvalSheet({
  open, athleteId, athleteName, onClose, onSave,
}: {
  open: boolean;
  athleteId: string | null;
  athleteName: string;
  onClose: () => void;
  onSave: (athleteId: string, star: number, report: string) => Promise<void>;
}) {
  const [star, setStar] = useState(0);
  const [report, setReport] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (open) { setStar(0); setReport(""); setSaving(false); }
  }, [open, athleteId]);

  if (!mounted || !open || !athleteId) return null;
  const canSave = (star > 0 || report.trim().length > 0) && !saving;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!saving) onClose(); }}
        style={{ animation: "nx-at-fade 200ms ease-out forwards" }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          animation: "nx-at-sheet-up 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-6 pt-2 pb-6">
          <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
            Évaluer {athleteName || "l'athlète"}
          </h3>
          <p className="text-[13px] text-[#9CA3AF] mt-1.5 mb-4 leading-relaxed">
            Cote globale et/ou rapport rapide. Tu peux compléter plus tard.
          </p>

          {/* Star input */}
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">Cote globale</p>
          <div className="flex items-center gap-2 mt-2 mb-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => { triggerHaptic("Light"); setStar(star === i ? 0 : i); }}
                className="active:scale-95 transition-transform"
                aria-label={`${i} étoile${i > 1 ? "s" : ""}`}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill={star >= i ? "#F59E0B" : "#2D3748"} stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            ))}
            {star > 0 && (
              <span className="text-[14px] font-bold text-[#F59E0B] ml-2 tabular-nums">{star}/5</span>
            )}
          </div>

          {/* Report textarea */}
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">Rapport (optionnel)</p>
          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            rows={4}
            placeholder="Tes observations en quelques mots…"
            maxLength={1000}
            aria-label="Rapport entraîneur"
            className="w-full mt-2 bg-[#0C0E12] border border-white/[0.06] rounded-2xl px-4 py-3 text-[14px] text-white placeholder:text-[#6B7280] focus:border-[#E63946] outline-none resize-none"
          />

          <Link
            href={`/coach/athletes/${athleteId}/modifier`}
            onClick={onClose}
            className="block mt-3 text-[12px] font-bold text-[#9CA3AF] active:text-white"
          >
            Évaluation complète →
          </Link>

          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-[#0C0E12] text-[#9CA3AF] text-[14px] font-bold active:bg-white/5 disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={async () => {
                if (!canSave) return;
                setSaving(true);
                await onSave(athleteId, star, report);
                setSaving(false);
              }}
              className="flex-1 h-12 rounded-2xl bg-[#E63946] text-white text-[14px] font-bold active:bg-[#D42B22] disabled:opacity-40"
            >
              {saving ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
        <style jsx>{`
          @keyframes nx-at-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes nx-at-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
      </div>
    </>,
    document.body,
  );
}

/* ── Skeleton + Empty ─────────────────────────────────────────── */

function SkeletonList() {
  return (
    <div className="px-4 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[78px] rounded-2xl nx-pulse-skel" />
      ))}
      <style jsx>{`
        @keyframes nx-at-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
        .nx-pulse-skel { background: #1A1D24; animation: nx-at-pulse 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function FullEmptyState() {
  return (
    <div className="px-6 py-12 text-center">
      {/* TODO: dedicated nexus-empty-taches asset — réutilise shortlist en attendant */}
      <img
        src="/empty/nexus-empty-shortlist.png"
        alt=""
        className="mx-auto mb-4 w-[140px] h-auto object-contain"
      />
      <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
        Tout est à jour
      </h3>
      <p className="text-[13px] text-[#9CA3AF] mt-2 max-w-sm mx-auto">
        Aucune tâche à traiter pour le moment.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function CoachATraiterMobile() {
  const toast = useMobileToast();

  const [tasks, setTasks] = useState<CoachTasksBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [coachUserId, setCoachUserId] = useState<string>("");

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("athlete");

  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null);
  const [rejectingSuggestionId, setRejectingSuggestionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Eval sheet
  const [evalSheetAthleteId, setEvalSheetAthleteId] = useState<string | null>(null);
  const [evalSheetAthleteName, setEvalSheetAthleteName] = useState<string>("");

  // Suggestion sheet (one suggestion at a time — full detail + approve/reject)
  const [suggestionSheet, setSuggestionSheet] = useState<{ suggestion: CoachTaskSuggestion; athleteName: string } | null>(null);

  const reload = useCallback(() => setRefreshVersion((v) => v + 1), []);

  /* ── Load tasks via the shared helper ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }
      setCoachUserId(user.id);
      const result = await loadCoachTasks(supabase, user.id);
      if (cancelled) return;
      setTasks(result);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshVersion]);

  /* ── Pull-to-refresh ── */
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 80;
  useEffect(() => {
    let startY = 0;
    let current = 0;
    const blocked = () => !!evalSheetAthleteId;
    const onTouchStart = (e: TouchEvent) => {
      if (blocked()) return;
      if ((window.scrollY || 0) === 0) startY = e.touches[0].clientY;
      else startY = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (blocked()) return;
      if ((window.scrollY || 0) !== 0 || startY === 0) return;
      current = Math.max(0, Math.min(e.touches[0].clientY - startY, 120));
      setPullDistance(current);
      setIsPulling(current > 0);
    };
    const onTouchEnd = async () => {
      if (blocked()) return;
      if (current >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic("Medium");
        reload();
        window.setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setIsPulling(false);
        }, 600);
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
      startY = 0;
      current = 0;
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [evalSheetAthleteId, isRefreshing, reload]);

  /* ── Per-athlete grouping (memo) ── */
  const perAthleteAll = useMemo<PerAthleteEntry[]>(() => {
    if (!tasks) return [];
    const map = new Map<string, PerAthleteEntry>();

    for (const a of tasks.unverified) {
      const existing = map.get(a.id);
      if (existing) existing.unverified = true;
      else map.set(a.id, { athlete: a, unverified: true, missingEval: false, suggestions: [] });
    }
    for (const a of tasks.missingEval) {
      const existing = map.get(a.id);
      if (existing) {
        existing.missingEval = true;
        // Enrich with full athlete shape if previous entry was slim
        if (!existing.athlete.position && a.position) existing.athlete = a;
      } else {
        map.set(a.id, { athlete: a, unverified: false, missingEval: true, suggestions: [] });
      }
    }
    for (const s of tasks.pendingSuggestions) {
      const existing = map.get(s.athleteId);
      if (existing) {
        existing.suggestions.push(s);
      } else {
        map.set(s.athleteId, {
          athlete: slimAthleteFromName(s.athleteId, s.athleteName),
          unverified: false,
          missingEval: false,
          suggestions: [s],
        });
      }
    }

    const list = Array.from(map.values());
    // Sort: athletes with most tasks first; tiebreak alphabetical
    list.sort((a, b) => {
      const aT = (a.unverified ? 1 : 0) + (a.missingEval ? 1 : 0) + a.suggestions.length;
      const bT = (b.unverified ? 1 : 0) + (b.missingEval ? 1 : 0) + b.suggestions.length;
      if (bT !== aT) return bT - aT;
      return `${a.athlete.lastName} ${a.athlete.firstName}`.localeCompare(`${b.athlete.lastName} ${b.athlete.firstName}`);
    });
    return list;
  }, [tasks]);

  const perAthleteFiltered = useMemo<PerAthleteEntry[]>(() => {
    return perAthleteAll.filter((e) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "verif") return e.unverified;
      if (activeFilter === "eval") return e.missingEval;
      if (activeFilter === "demande") return e.suggestions.length > 0;
      return true;
    });
  }, [perAthleteAll, activeFilter]);

  /* ── Flat tasks list (memo) ── */
  const flatTasksAll = useMemo<FlatEntry[]>(() => {
    if (!tasks) return [];
    const fullAthleteIndex = new Map<string, CoachTaskAthlete>();
    for (const a of [...tasks.unverified, ...tasks.missingEval]) {
      if (!fullAthleteIndex.has(a.id)) fullAthleteIndex.set(a.id, a);
    }

    const entries: FlatEntry[] = [];
    // Suggestions first (sorted desc by created_at — already done in helper query)
    for (const s of tasks.pendingSuggestions) {
      const athlete = fullAthleteIndex.get(s.athleteId) ?? slimAthleteFromName(s.athleteId, s.athleteName);
      entries.push({ kind: "suggestion", athlete, suggestion: s });
    }
    for (const a of tasks.unverified) {
      entries.push({ kind: "unverified", athlete: a });
    }
    for (const a of tasks.missingEval) {
      entries.push({ kind: "missingEval", athlete: a });
    }
    return entries;
  }, [tasks]);

  const flatTasksFiltered = useMemo<FlatEntry[]>(() => {
    return flatTasksAll.filter((e) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "verif") return e.kind === "unverified";
      if (activeFilter === "eval") return e.kind === "missingEval";
      if (activeFilter === "demande") return e.kind === "suggestion";
      return true;
    });
  }, [flatTasksAll, activeFilter]);

  /* ── Action handlers (write + reload) ── */

  const onVerify = useCallback(async (athleteId: string) => {
    if (!coachUserId) return;
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("athletes").update({
      verified: true,
      verification_method: "manuel_coach",
      verified_at: nowIso,
      verified_by: coachUserId,
      last_profile_validation: nowIso,
    }).eq("id", athleteId);
    if (error) {
      console.error("[CoachATraiter] verify failed:", error.message);
      toast.error({ message: "Erreur de vérification" });
      return;
    }
    toast.success({ message: "Athlète vérifié" });
    reload();
  }, [coachUserId, reload, toast]);

  const onApprove = useCallback(async (suggestionId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("athlete_suggestions")
      .update({ status: "APPROUVEE" })
      .eq("id", suggestionId);
    if (error) {
      console.error("[CoachATraiter] approve failed:", error.message);
      toast.error({ message: "Erreur d'approbation" });
      return;
    }
    toast.success({ message: "Suggestion approuvée" });
    setSuggestionSheet(null);
    reload();
  }, [reload, toast]);

  const onReject = useCallback(async (suggestionId: string) => {
    const supabase = createClient();
    const reasonToSave = rejectReason.trim() || null;
    const { error } = await supabase
      .from("athlete_suggestions")
      .update({ status: "REJETEE", raison_rejet: reasonToSave })
      .eq("id", suggestionId);
    if (error) {
      console.error("[CoachATraiter] reject failed:", error.message);
      toast.error({ message: "Erreur de rejet" });
      return;
    }
    toast.success({ message: "Suggestion rejetée" });
    setRejectingSuggestionId(null);
    setRejectReason("");
    setSuggestionSheet(null);
    reload();
  }, [rejectReason, reload, toast]);

  const onOpenSuggestionSheet = useCallback((suggestion: CoachTaskSuggestion, athleteName: string) => {
    triggerHaptic("Light");
    setRejectingSuggestionId(null);
    setRejectReason("");
    setSuggestionSheet({ suggestion, athleteName });
  }, []);

  const onCloseSuggestionSheet = useCallback(() => {
    setSuggestionSheet(null);
    setRejectingSuggestionId(null);
    setRejectReason("");
  }, []);

  const onQuickEvalSave = useCallback(async (athleteId: string, star: number, report: string) => {
    if (!coachUserId) return;
    const supabase = createClient();
    const trimmedReport = report.trim();
    const { error } = await supabase
      .from("evaluations")
      .upsert(
        {
          coach_id: coachUserId,
          athlete_id: athleteId,
          cote_globale: star > 0 ? star : null,
          rapport_entraineur: trimmedReport || null,
        },
        { onConflict: "coach_id,athlete_id" },
      );
    if (error) {
      console.error("[CoachATraiter] eval upsert failed:", error.message);
      toast.error({ message: "Erreur d'évaluation" });
      return;
    }
    toast.success({ message: "Évaluation enregistrée" });
    setEvalSheetAthleteId(null);
    reload();
  }, [coachUserId, reload, toast]);

  const onOpenEvalSheet = useCallback((athleteId: string, athleteName: string) => {
    triggerHaptic("Light");
    setEvalSheetAthleteId(athleteId);
    setEvalSheetAthleteName(athleteName);
  }, []);

  /* ── Computed counts (drive the 3 filter cards) ── */
  const counts = useMemo(() => ({
    unverified: tasks?.unverified.length ?? 0,
    missingEval: tasks?.missingEval.length ?? 0,
    pendingSuggestions: tasks?.pendingSuggestions.length ?? 0,
    total: tasks?.total ?? 0,
  }), [tasks]);

  const filterCategoryEmpty =
    activeFilter !== "all" && (
      (activeFilter === "verif" && counts.unverified === 0) ||
      (activeFilter === "eval" && counts.missingEval === 0) ||
      (activeFilter === "demande" && counts.pendingSuggestions === 0)
    );

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Pull-to-refresh */}
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
              style={{ animation: isRefreshing ? "nx-at-rotate 1s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
          <style jsx>{`@keyframes nx-at-rotate { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="font-head text-[24px] font-black text-white uppercase tracking-tight leading-tight">
          À traiter
        </h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Tout ce qui attend ta décision.
        </p>
      </div>

      {/* Filter cards */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-4">
        <FilterCard
          label="Vérification"
          count={counts.unverified}
          color="#3B82F6"
          active={activeFilter === "verif"}
          onTap={() => setActiveFilter(activeFilter === "verif" ? "all" : "verif")}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          }
        />
        <FilterCard
          label="Évaluation"
          count={counts.missingEval}
          color="#F59E0B"
          active={activeFilter === "eval"}
          onTap={() => setActiveFilter(activeFilter === "eval" ? "all" : "eval")}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />
        <FilterCard
          label="Suggestions"
          count={counts.pendingSuggestions}
          color="#E63946"
          active={activeFilter === "demande"}
          onTap={() => setActiveFilter(activeFilter === "demande" ? "all" : "demande")}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          }
        />
      </div>

      {/* View toggle */}
      <div className="px-4 mb-3">
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SkeletonList />
          </motion.div>
        ) : counts.total === 0 ? (
          <motion.div key="empty-all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FullEmptyState />
          </motion.div>
        ) : filterCategoryEmpty ? (
          <motion.div key="empty-filter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 py-10 text-center">
            <p className="text-[13px] text-[#6B7280] italic">Rien à traiter dans cette catégorie.</p>
          </motion.div>
        ) : viewMode === "athlete" ? (
          <motion.div key="view-athlete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 space-y-2">
            <AnimatePresence mode="popLayout">
              {perAthleteFiltered.map((entry) => (
                <motion.div
                  key={entry.athlete.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <AthleteAccordionCard
                    entry={entry}
                    expanded={expandedAthleteId === entry.athlete.id}
                    onToggle={() => setExpandedAthleteId(expandedAthleteId === entry.athlete.id ? null : entry.athlete.id)}
                    onVerify={onVerify}
                    onEvaluate={onOpenEvalSheet}
                    onOpenSuggestion={onOpenSuggestionSheet}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="view-tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 space-y-2">
            <AnimatePresence mode="popLayout">
              {flatTasksFiltered.map((entry, idx) => {
                const key = entry.kind === "suggestion" ? `s-${entry.suggestion.id}` : `${entry.kind}-${entry.athlete.id}-${idx}`;
                return (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <FlatListItem
                      entry={entry}
                      onVerify={onVerify}
                      onEvaluate={onOpenEvalSheet}
                      onOpenSuggestion={onOpenSuggestionSheet}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-eval bottom-sheet */}
      <EvalSheet
        open={!!evalSheetAthleteId}
        athleteId={evalSheetAthleteId}
        athleteName={evalSheetAthleteName}
        onClose={() => setEvalSheetAthleteId(null)}
        onSave={onQuickEvalSave}
      />

      {/* Suggestion sheet — opens for one suggestion at a time from the
          summary lines. Approve/reject close the sheet on success. */}
      <SuggestionSheet
        open={!!suggestionSheet}
        suggestion={suggestionSheet?.suggestion ?? null}
        athleteName={suggestionSheet?.athleteName ?? ""}
        rejecting={!!suggestionSheet && rejectingSuggestionId === suggestionSheet.suggestion.id}
        rejectReason={rejectReason}
        onClose={onCloseSuggestionSheet}
        onStartReject={() => suggestionSheet && setRejectingSuggestionId(suggestionSheet.suggestion.id)}
        onCancelReject={() => { setRejectingSuggestionId(null); setRejectReason(""); }}
        onChangeReason={setRejectReason}
        onApprove={() => suggestionSheet && onApprove(suggestionSheet.suggestion.id)}
        onReject={() => suggestionSheet && onReject(suggestionSheet.suggestion.id)}
      />
    </div>
  );
}
