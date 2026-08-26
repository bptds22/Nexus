"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteEditWizardMobile — Sprint B-1 foundation of the athlete
   co-creation editor on Capacitor.

   Mirrors the web athlete profile (app/athlete/profil/page.tsx) EXACTLY :
     - Same load query (athletes + joins + secondary FK lookups +
       athlete_suggestions).
     - Same field classification (DIRECT / SUGGEST / LOCKED — wrapper
       authority on the rendered tree, NOT code-path existence).
     - Same suggest insert shape (one INSERT per field, French champ
       strings byte-for-byte → apply_approved_suggestion trigger).
     - Same DIRECT update path (UPDATE athletes set col=val, immediate).
     - Same in-place edit affordance via the shared row kit (no overlays
       for text/suggest ; bottom-sheet only for choice pickers).

   SPRINT B-1 SCOPE (this sprint) :
     - Step 0 : shell + IS_CAPACITOR dispatch + load + civil derivation.
     - MÉDIAS step (DIRECT) : 5 url fields, immediate UPDATE athletes,
       inline edit via InlineEditRow.
     - PHYSIQUE step (SUGGEST) : 11 fields, inline-expand SuggestExpand
       wrapper (no overlay), INSERT athlete_suggestions per field,
       En-attente pill when a champ already has EN_ATTENTE.

   DEFERRED (Sprint B-2 / B-3) :
     - Identité step (LOCKED — read-only context display)
     - Académique step (mostly LOCKED on web ; product decision pending
       on the 4 unwrapped multi-choice/toggle fields)
     - Sport step (SUGGEST, 5 fields, FK lookup option lists)
     - Évaluation step (cote + 14 traits + Distinctions ; "detailed wins"
       UI to mirror the apply_approved_suggestion trigger guard)

   For B-1, all 5 pills render in the chrome but only Médias and
   Physique have real content — the other 3 show a "à venir" placeholder
   so the wizard's overall shape is testable end-to-end.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/storage/uploadAvatar";
import AthletePhotoHero from "@/components/shared/AthletePhotoHero";
import type { AthleteSuggestion, AthleteTraitRatings, TeamHistoryEntry } from "@/lib/types/models";
import TeamHistoryBlock from "@/components/shared/athlete/TeamHistoryBlock";
import TeamHistoryEditor from "@/components/shared/athlete/TeamHistoryEditor";
import { parseTeamHistory, isTeamHistoryValid } from "@/components/shared/athlete/teamHistory";
import { Card, InlineEditRow, PickerRow, ReadOnlyRow, DateRow, ToggleRow, ChipsBlock } from "@/components/shared/wizard/rows";
import { StarRow } from "@/components/shared/wizard/stars";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import {
  HeightWheel, WeightWheel, formatHeightDisplay, formatWeightDisplay,
  UNIT_MODE_STORAGE_KEY, type UnitMode,
} from "@/components/shared/wizard/HeightWeightWheel";
import { WizardPills } from "@/components/shared/wizard/WizardPills";
import { Skeleton } from "@/components/ui/Skeleton";
import { GREEN, YELLOW, RED, PencilIcon, LockIcon } from "@/components/shared/wizard/modeIcons";
import { triggerHaptic } from "@/lib/haptics";
import { SUBJECTS, HONORS, CEGEP_REGIONS } from "@/lib/config/academicOptions";
import ProgrammeCegepPicker from "@/components/shared/ProgrammeCegepPicker";
import { useCegepPrograms, resolveProgrammesVises } from "@/lib/queries/shared/useCegepPrograms";
import {
  BADGE_CONFIG, MAX_DETAIL_LENGTH,
  type DistinctionEntry,
} from "@/lib/config/badges";
import BadgePicker from "@/components/shared/BadgePicker";
import { useBadgeCatalogue } from "@/lib/config/useBadgeCatalogue";
import { entreesIncompletes, type BadgeEntry } from "@/lib/config/badgeCatalogue";
import { chargerBadgesAthlete, badgesDepuisRaw, type BadgeAffiche } from "@/lib/queries/shared/athleteBadges";
import { traitGroups, champToColumn, type GrilleRef, type TraitEntry } from "@/lib/evaluations/grilles";
import { useGrilles } from "@/lib/evaluations/useGrilles";

/* ═══════════════════════════════════════════════════════════════
   Loaded athlete shape — narrowed to the fields B-1 actually reads.
   Other fields (academic, sport, eval) are not consumed in B-1 ;
   B-2/B-3 will widen this interface as those sections come online.
═══════════════════════════════════════════════════════════════ */
interface LoadedAthlete {
  id: string;
  /** Resolved coach FK ; used for athlete_suggestions.coach_id. */
  coachId: string | null;
  photoUrl: string;                     // athletes.photo_url — DIRECT (athlete owns own photo)
  firstName: string;
  /* ── Identité — 5 DIRECT (first/last name, DOB, genre, telephone) +
        5 LOCKED (age computed / city + region from schools FK / school
        or team affiliation / graduation year). Display values mirror
        page.tsx :1511-1517 + the converted-to-direct subset. ── */
  lastName: string;                     // athletes.last_name (DIRECT — B-2.5 conversion)
  dateNaissance: string;                // athletes.date_naissance "YYYY-MM-DD" (DIRECT)
  age: number;                          // computed from date_naissance (page.tsx :982-988) — LOCKED
  gender: string;                       // athletes.genre — DIRECT (M / F / X)
  city: string;                         // schools.city via join — LOCKED (derived)
  region: string;                       // schools.region via join — LOCKED (derived)
  graduationYear: string;               // athletes.annee_diplomation — LOCKED (coach-managed)
  telephone: string;                    // athletes.telephone — DIRECT
  /* ── Académique (LOCKED) — display values mirrored from page.tsx :1595-1657 ── */
  gpa: string;                          // athletes.moyenne_generale
  programmeCegepVise: string[];         // athletes.programme_cegep_vise JSONB (legacy, repli lecture)
  programmesVises: string[];            // athletes.programmes_vises uuid[] -> cegep_program_labels
  strongSubjects: string[];             // athletes.matieres_fortes JSONB
  academicHonors: string[];             // athletes.mentions_academiques JSONB
  openToPrivate: boolean;               // athletes.ouvert_cegep_prive
  openToAnglophone: boolean;            // athletes.ouvert_cegep_anglophone
  openToRelocate: boolean;              // athletes.pret_changer_region
  preferredRegions: string[];           // athletes.regions_cegep_preferees JSONB
  /* ── Sport (SUGGEST) — current values + ids for picker scoping ── */
  primarySport: string;                 // sports.nom via join (primary)
  primaryPosition: string;              // positions.nom via join (primary)
  jerseyNumber: string;                 // athletes.numero_jersey
  parcoursEquipes: TeamHistoryEntry[];  // athletes.parcours_equipes (JSONB)
  /** FK id needed to SCOPE the primary position picker at row-render time. */
  sportId: string | null;
  /* ── Physique (SUGGEST) — current values ── */
  heightDisplay: string;
  weightDisplay: string;
  wingspan: string;
  dominantHand: string;
  dominantFoot: string;
  fortyYard: string;
  verticalJump: string;
  broadJump: string;
  benchPress: string;
  shuttleAgility: string;
  sprint100m: string;
  /* ── Médias (DIRECT) — current values ── */
  highlightVideoUrl: string;
  fullGameUrl: string;
  hudlUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  /* ── Évaluation (SUGGEST + LOCKED rapport) — mirrors web
        page.tsx :1053-1068 + :1115-1119 verbatim. The 14 trait keys
        match AthleteTraitRatings (the desktop's type) so the
        detailed-wins predicate evaluates identically.

        traitRatings stays `undefined` when no evaluations row exists
        for the athlete — desktop encodes this with `evalRel ? {...} :
        undefined`, and the isDetailedMode predicate (`!!traitRatings
        && some > 0`) collapses cleanly to "simple mode".

        coachReport is LOCKED (no champ in trigger CASE — never
        suggestable). coachName comes from the users!coach_id join
        so the rapport quote can be attributed. ── */
  traitRatings: AthleteTraitRatings | undefined;
  overallRating: number;            // evaluations.cote_globale (|| 0)
  coachReport: string;              // evaluations.rapport_entraineur (LOCKED)
  coachName: string;                // "first_name last_name" via users!athletes_coach_id_fkey
  /** Current coach-set distinctions (SUGGEST champ "Distinctions" —
   *  athlete proposes a new array, coach approves, trigger writes
   *  it back as JSONB). Lu via badgesDepuisRaw depuis athlete_badges ; legacy
   *  string-array rows + the canonical {badge, detail?} shape both
   *  rehydrate to the same DistinctionEntry[] view. */
  coachDistinctions: BadgeAffiche[];
  /** Grille figée sur l'éval affichée ; NULL = repli par position. */
  grilleId: string | null;
  positionId: string | null;
  /* ── Civil/école derivation (Identité affiliation row) ── */
  isCivil: boolean;
  schoolName: string;
  teamName: string | undefined;
  leagueName: string | undefined;
  /** Cached _raw row for valeur_actuelle lookup at suggest time
   *  (mirrors page.tsx submitSuggestion's a._raw read). */
  raw: Record<string, unknown>;
}

/* ── Sport / position option shapes loaded from the DB (new in B-2). ── */
interface SportOption { id: string; nom: string }
interface PositionOption { id: string; nom: string; abreviation: string | null; sport_id: string | null }

const STEP_LABELS = ["Identité", "Académique", "Physique", "Sport", "Médias", "Évaluation"] as const;
/* Identité is MIXED (5 DIRECT + 5 LOCKED — green chip for dominant
   editable mode, per-row indicators show actual state). Académique
   was flipped to fully DIRECT in B-2.5 — every field is athlete-
   editable, no coach approval gate. Physique and Sport stay SUGGEST
   (coach approves), Médias stays DIRECT.

   Évaluation (B-3a) is SUGGEST-dominant : athletes suggest cote +
   trait ratings + (B-3b) distinctions, all requiring coach approval
   via athlete_suggestions. The Rapport entraîneur sub-block is
   LOCKED (display-only, no champ), but the section chip stays YELLOW
   because suggest is the dominant action and the rapport is a small
   header block. The detailed-wins rule (see EvaluationStep below)
   ALSO gates whether "Cote globale" can be suggested at all — this
   is a UI-level mirror of the apply_approved_suggestion trigger's
   v_is_detailed guard. */
const STEP_MODES = ["MIXED", "DIRECT", "SUGGEST", "SUGGEST", "DIRECT", "SUGGEST"] as const;
const STEP_ACCENTS: (string | undefined)[] = [GREEN, GREEN, YELLOW, YELLOW, GREEN, YELLOW];

const STATUS_MAP: Record<string, "pending" | "approved" | "rejected"> = {
  EN_ATTENTE: "pending",
  APPROUVEE: "approved",
  REJETEE: "rejected",
};

const HAND_OPTIONS: PickerOption[] = [
  { value: "Droite", label: "Droite" },
  { value: "Gauche", label: "Gauche" },
  { value: "Ambidextre", label: "Ambidextre" },
];
const FOOT_OPTIONS: PickerOption[] = [
  { value: "Droit", label: "Droit" },
  { value: "Gauche", label: "Gauche" },
  { value: "Les deux", label: "Les deux" },
];
// Identité Genre — canon mirror of page.tsx :793 (PersonalEditForm).
// Stored values are "M" / "F" / "X" ; UI labels are the full French
// words. Empty value = unset, picker shows placeholder.
const GENDER_OPTIONS: PickerOption[] = [
  { value: "M", label: "Masculin" },
  { value: "F", label: "Féminin" },
  { value: "X", label: "Autre" },
];

/* TRAIT_CHAMPS / CHARACTER_TRAITS / TACTICAL_TRAITS retirés. Le libellé et la
   clé écrite dans athlete_suggestions.champ ne sont plus le même objet :
   `champ` porte le NOM DE COLONNE, le libellé vient de la grille de l'athlète.
   Les deux groupes sont désormais ceux du module (9 / 5). */

/* ═══════════════════════════════════════════════════════════════
   SuggestExpand — inline-expanding suggest form (NO overlay).

   Mirrors the web's SuggestibleField expanded state at page.tsx :340-360
   verbatim : current value struck through, proposed-value input, optional
   message textarea, Soumettre / Annuler actions. Lives inline UNDER the
   row, not in a portal or sheet.

   Renders either a text input (InlineEditRow-style commit semantics) or
   a PickerRow + MobilePicker for choice fields — picked via the
   `inputType` prop.
═══════════════════════════════════════════════════════════════ */
interface SuggestExpandProps {
  champ: string;                    // exact French label written into athlete_suggestions.champ
  currentValue: string;             // displayed struck-through above the input
  initialProposed: string;
  inputType: "text" | "picker" | "wheel";
  /** For inputType="wheel" : which shared wheel to mount. The committed
   *  proposed value is ALWAYS the canonical imperial string the
   *  apply_approved_suggestion trigger parses — "6'4\"" (height) or
   *  "185 lbs" (weight) — regardless of the unit toggle. */
  wheelKind?: "height" | "weight";
  pickerOptions?: PickerOption[];
  numericMode?: "numeric" | "decimal";
  /** Per-field placeholder shown in the text-input branch. When omitted,
   *  the input renders WITHOUT a placeholder (no fallback hint) — earlier
   *  versions had a hardcoded "Ex: 6'2&quot;" leak from Taille into every
   *  text SUGGEST field including Numéro. */
  placeholder?: string;
  submitting: boolean;
  onSubmit: (proposed: string, message: string) => Promise<void>;
  onCancel: () => void;
}

/** Seed the wheel from the struck-through current value so it opens at
 *  the athlete's existing measurement. "6'4\"" → {ft:"6",in:"4"} ;
 *  "185 lbs" → {lbs:"185"}. Empty when there's nothing to parse. */
function parseHeightSeed(v: string): { ft: string; inches: string } {
  const m = v.match(/(\d+)\s*'\s*(\d+)?/);
  if (!m) return { ft: "", inches: "" };
  return { ft: m[1] || "", inches: m[2] || "0" };
}
function parseWeightSeed(v: string): string {
  const m = v.match(/[\d.]+/);
  return m ? m[0] : "";
}

function SuggestExpand({
  champ, currentValue, initialProposed, inputType, wheelKind, pickerOptions, numericMode, placeholder,
  submitting, onSubmit, onCancel,
}: SuggestExpandProps) {
  const [proposed, setProposed] = useState(initialProposed);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  /* ── Wheel state (inputType="wheel"). unitMode persists via the same
        key the coach wizard uses. Lazy init from localStorage is safe
        here : SuggestExpand only mounts on tap (client-only, post-
        hydration), so there's no SSR mismatch. The imperial values
        below drive the wheel position + the canonical proposed string. ── */
  const [unitMode, setUnitMode] = useState<UnitMode>(() => {
    if (typeof window === "undefined") return "imperial";
    try {
      const v = localStorage.getItem(UNIT_MODE_STORAGE_KEY);
      return v === "metric" || v === "imperial" ? v : "imperial";
    } catch { return "imperial"; }
  });
  const setUnit = (m: UnitMode) => {
    setUnitMode(m);
    try { localStorage.setItem(UNIT_MODE_STORAGE_KEY, m); } catch { /* no-op */ }
  };
  const heightSeed = parseHeightSeed(currentValue);
  const [hFeet, setHFeet] = useState(heightSeed.ft);
  const [hInches, setHInches] = useState(heightSeed.inches);
  const [wLbs, setWLbs] = useState(parseWeightSeed(currentValue));
  const [wheelOpen, setWheelOpen] = useState(false);

  const trimmed = proposed.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== currentValue.trim();

  return (
    <div className="px-4 py-3 bg-[#13151a] border-t border-[#EAB308]/20">
      {/* Current value (struck through) */}
      <p className="text-[11px] text-[#6b7280] line-through mb-2">
        Actuel : {currentValue || "—"}
      </p>

      {/* Proposed value — text vs picker. Both inline (no overlay for
          text ; bottom-sheet only on picker tap — the rest stays inline). */}
      <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-[#EAB308] mb-1.5">
        Nouvelle valeur proposée
      </label>
      {inputType === "text" ? (
        <input
          type="text"
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          autoFocus
          inputMode={numericMode}
          pattern={numericMode === "numeric" ? "[0-9]*" : undefined}
          aria-label={champ}
          className="w-full bg-[#111317] border border-white/[0.10] rounded-2xl px-4 py-3 text-[15px] text-white placeholder:text-white/40 outline-none focus:border-[#EAB308]/40"
          placeholder={placeholder}
        />
      ) : inputType === "wheel" ? (
        <>
          <button
            type="button"
            onClick={() => { void triggerHaptic("Light"); setWheelOpen(true); }}
            className="w-full flex items-center justify-between bg-[#111317] border border-white/[0.10] rounded-2xl px-4 py-3 active:bg-white/[0.04] text-left"
          >
            <span className={`text-[15px] ${proposed ? "text-white" : "text-white/40"}`}>
              {proposed
                ? (wheelKind === "height"
                    ? formatHeightDisplay(hFeet, hInches, unitMode)
                    : formatWeightDisplay(wLbs, unitMode))
                : "Sélectionner…"}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {wheelKind === "height" ? (
            <HeightWheel
              open={wheelOpen}
              onClose={() => setWheelOpen(false)}
              feet={hFeet}
              inches={hInches}
              unitMode={unitMode}
              onUnitChange={setUnit}
              onCommit={(ft, inch) => {
                setHFeet(ft);
                setHInches(inch);
                // Canonical imperial string the trigger parses : FT'IN".
                setProposed(ft || inch ? `${ft || "0"}'${inch || "0"}"` : "");
              }}
            />
          ) : (
            <WeightWheel
              open={wheelOpen}
              onClose={() => setWheelOpen(false)}
              lbs={wLbs}
              unitMode={unitMode}
              onUnitChange={setUnit}
              onCommit={(lbs) => {
                setWLbs(lbs);
                // Canonical imperial string the trigger parses : "N lbs".
                setProposed(lbs ? `${lbs} lbs` : "");
              }}
            />
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => { void triggerHaptic("Light"); setPickerOpen(true); }}
            className="w-full flex items-center justify-between bg-[#111317] border border-white/[0.10] rounded-2xl px-4 py-3 active:bg-white/[0.04] text-left"
          >
            <span className={`text-[15px] ${proposed ? "text-white" : "text-white/40"}`}>
              {pickerOptions?.find((o) => o.value === proposed)?.label || "Sélectionner…"}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {pickerOptions && (
            <MobilePicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              title={champ}
              options={pickerOptions}
              value={proposed || null}
              onChange={(v) => setProposed(typeof v === "string" ? v : "")}
            />
          )}
        </>
      )}

      {/* Optional message — verbatim labels/placeholder from web SuggestibleField. */}
      <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mt-3 mb-1.5">
        Message pour ton coach (optionnel)
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Ex: Explique pourquoi tu proposes ce changement"
        aria-label="Message"
        className="w-full bg-[#111317] border border-white/[0.10] rounded-2xl px-4 py-3 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-[#EAB308]/60 resize-none"
      />

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={() => { void triggerHaptic("Light"); onSubmit(trimmed, message); }}
          className="flex-1 h-11 rounded-2xl bg-[#EAB308] text-white text-[13px] font-bold uppercase tracking-wider active:bg-[#CA8A04] disabled:opacity-40"
        >
          {submitting ? "Envoi…" : "Soumettre la suggestion"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-4 rounded-2xl text-[12px] font-bold text-[#9CA3AF] active:bg-white/[0.04]"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SuggestRow — wraps a row with the yellow indicator + tap-to-expand
   into SuggestExpand. When a champ already has EN_ATTENTE, renders
   the En-attente pill instead of the edit affordance.
═══════════════════════════════════════════════════════════════ */
interface SuggestRowProps {
  label: string;
  value: string;
  champ: string;
  pending: AthleteSuggestion | undefined;
  inputType: "text" | "picker" | "wheel";
  wheelKind?: "height" | "weight";
  pickerOptions?: PickerOption[];
  numericMode?: "numeric" | "decimal";
  /** Per-field placeholder for the text-input branch. Threaded to
   *  SuggestExpand. Omit to render no placeholder. */
  placeholder?: string;
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<void>;
  isLast?: boolean;
}

function SuggestRow({
  label, value, champ, pending, inputType, wheelKind, pickerOptions, numericMode, placeholder,
  submitting, onSubmit, isLast,
}: SuggestRowProps) {
  const [expanded, setExpanded] = useState(false);

  // En-attente — display the pending proposed value, no edit affordance.
  if (pending) {
    return (
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: isLast ? undefined : "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          <PencilIcon color={YELLOW} size={12} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-white/70 truncate">{label}</p>
          <p className="text-[12px] text-[#EAB308] mt-0.5 truncate">
            Suggéré : <span className="font-bold">{pending.proposed_value}</span>
          </p>
        </div>
        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#EAB308]/15 border border-[#EAB308]/30 text-[#EAB308] shrink-0">
          En attente
        </span>
      </div>
    );
  }

  // Default — collapsed row, tap to expand into SuggestExpand.
  return (
    <div>
      <button
        type="button"
        onClick={() => { void triggerHaptic("Light"); setExpanded(true); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/[0.04]"
        style={{ borderBottom: isLast && !expanded ? undefined : "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          <PencilIcon color={YELLOW} size={12} />
        </span>
        <span className="flex-1 text-[14px] text-white/70 truncate">{label}</span>
        <span className="text-[14px] font-semibold text-white max-w-[55%] truncate text-right">
          {value || "—"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      {expanded && (
        <SuggestExpand
          champ={champ}
          currentValue={value}
          initialProposed=""
          inputType={inputType}
          wheelKind={wheelKind}
          pickerOptions={pickerOptions}
          numericMode={numericMode}
          placeholder={placeholder}
          submitting={submitting}
          onSubmit={async (proposed, message) => {
            await onSubmit(champ, proposed, message, value);
            setExpanded(false);
          }}
          onCancel={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DirectUrlRow — green-pencil DIRECT row for the 5 media URL fields.
   Uses InlineEditRow with type="url" for in-place editing ; on commit,
   immediate UPDATE athletes. No overlay, no portal.
═══════════════════════════════════════════════════════════════ */
function DirectUrlRow({
  label, value, onSave, placeholder,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span
        className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none z-[1]"
      >
        <PencilIcon color={GREEN} size={12} />
      </span>
      <div className="pl-6">
        <InlineEditRow
          label={label}
          value={value}
          onSave={onSave}
          placeholder={placeholder}
          type="url"
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AthleteEditWizardMobile() {
  const router = useRouter();

  const [a, setA] = useState<LoadedAthlete | null>(null);
  const [suggestions, setSuggestions] = useState<AthleteSuggestion[]>([]);
  const [sportsOptions, setSportsOptions] = useState<SportOption[]>([]);
  const [positionsOptions, setPositionsOptions] = useState<PositionOption[]>([]);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  /* Photo upload (DIRECT, athlete owns own photo). photoError surfaces a
     failed upload visibly — pas de faux succès silencieux. */
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /* `mounted` gates createPortal — same SSR/hydration safety guard the
     coach "Modifier le profil" sticky bar uses at
     AthleteRecruiterProfileBodyMobile.tsx :2538. Without it, createPortal
     would run during SSR / first render before document.body is reliably
     available, hydration mismatches show up in dev. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // B-2 : all 5 steps now have real content. Default landing step is
  // Identité (step 0) — the natural top of the wizard.

  /* ── LOAD — verbatim from page.tsx :932-1094 ─────────────────────
        Same main athletes select with joins, same 2 secondary FK
        lookups, same athlete_suggestions query + STATUS_MAP. */
  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: raw } = await supabase
      .from("athletes")
      .select(`
        *,
        sports!sport_id(nom),
        position_id,
        positions!position_id(nom, abreviation),
        schools!school_id(name, region, city, type),
        team_athletes(team_id, teams!team_id(name)),
        evaluations(vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination, vision_du_jeu, sens_tactique, leadership, discipline, coachabilite, intelligence_jeu, competitivite, esprit_equipe, resilience, attitude_mentalite, cote_globale, rapport_entraineur, distinctions, updated_at, grille_id),
        athlete_badges(contexte, created_at, retire_le, badges(code, libelle)),
        users!athletes_coach_id_fkey(first_name, last_name)
      `)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!raw) return;

    // ── Secondary sport / position NAME lookups (verbatim from
    //    page.tsx :953-959). Kept as separate queries to match the
    //    desktop's exact load pattern (Bug #8 — no joining away).

    // Civil / école derivation (verbatim from page.tsx :971-974).
    const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
    const taRel = Array.isArray(raw.team_athletes) ? raw.team_athletes[0] : raw.team_athletes;
    const teamRelRaw = (taRel as { teams?: unknown } | null)?.teams;
    const teamRel = (Array.isArray(teamRelRaw) ? teamRelRaw[0] : teamRelRaw) as { name?: string } | null;
    const schoolType = (schoolRel as { type?: string } | null)?.type;
    const isCivil = !raw.school_id || schoolType === "LIGUE_CIVILE";
    const schoolName = isCivil ? "" : (schoolRel?.name || "");
    const teamName = isCivil ? teamRel?.name : undefined;
    const leagueName = isCivil && !teamRel?.name ? "Ligue Civile" : undefined;

    const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
    const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
    const primarySport = (sportRel as { nom?: string } | null)?.nom || "";
    const primaryPosition = (posRel as { nom?: string; abreviation?: string } | null)?.nom
      || (posRel as { nom?: string; abreviation?: string } | null)?.abreviation
      || "";

    const heightDisplay = raw.taille_pieds
      ? `${raw.taille_pieds}'${raw.taille_pouces || 0}"`
      : "";
    const weightDisplay = raw.poids_lbs ? `${raw.poids_lbs} lbs` : "";

    // ── Age computation (verbatim from page.tsx :982-988). ──
    let age = 0;
    if (raw.date_naissance) {
      const bd = new Date(raw.date_naissance as string);
      const now = new Date();
      age = now.getFullYear() - bd.getFullYear();
      if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
    }

    // ── Evaluation derivation (Sprint B-3a, mirrors page.tsx
    //    :1053-1068 + :1115-1119). evalRel may be undefined when no
    //    coach has evaluated this athlete yet — traitRatings stays
    //    `undefined` then, and isDetailedMode collapses cleanly to
    //    simple mode (where a flat Cote globale is suggestable).
    //    coachRel comes from the users!athletes_coach_id_fkey join
    //    so the rapport quote can be attributed.
    const evalRel = selectBestEvaluation(Array.isArray(raw.evaluations) ? raw.evaluations : raw.evaluations ? [raw.evaluations] : []) as Record<string, unknown> | null | undefined;
    const coachRel = (Array.isArray(raw.users) ? raw.users[0] : raw.users) as { first_name?: string; last_name?: string } | null | undefined;
    const traitRatings: AthleteTraitRatings | undefined = evalRel ? {
      speed:           (evalRel.vitesse_explosivite  as number) || 0,
      power:           (evalRel.force_puissance      as number) || 0,
      endurance:       (evalRel.endurance_cardio     as number) || 0,
      agility:         (evalRel.agilite_coordination as number) || 0,
      gameVision:      (evalRel.vision_du_jeu        as number) || 0,
      tactics:         (evalRel.sens_tactique        as number) || 0,
      leadership:      (evalRel.leadership           as number) || 0,
      discipline:      (evalRel.discipline           as number) || 0,
      coachability:    (evalRel.coachabilite         as number) || 0,
      gameIQ:          (evalRel.intelligence_jeu     as number) || 0,
      competitiveness: (evalRel.competitivite        as number) || 0,
      teamwork:        (evalRel.esprit_equipe        as number) || 0,
      resilience:      (evalRel.resilience           as number) || 0,
      attitude:        (evalRel.attitude_mentalite   as number) || 0,
    } : undefined;
    const overallRating = (evalRel?.cote_globale as number) || 0;
    const coachReport = (evalRel?.rapport_entraineur as string) || "";
    const coachName = coachRel
      ? `${coachRel.first_name || ""} ${coachRel.last_name || ""}`.trim()
      : "";
    /* VOIE 2 — depuis athlete_badges, embarqué dans la requête ci-dessus :
       aucune requête de plus. Le libellé du catalogue voyage avec, et part
       en prop à DistinctionBadge. */
    const coachDistinctions = badgesDepuisRaw(raw as Record<string, unknown>);
    /* Règle de lecture des grilles : grille_id de l'éval affichée d'abord,
       la position de l'athlète ensuite. */
    const grilleId   = ((evalRel as Record<string, unknown> | null)?.grille_id as string | null) ?? null;
    const positionId = (raw.position_id as string | null) ?? null;

    setA({
      id: raw.id as string,
      coachId: (raw.coach_id as string) || null,
      photoUrl: (raw.photo_url as string) || "",
      firstName: (raw.first_name as string) || "",
      // Identité — 5 DIRECT + 5 LOCKED (mixed mode after B-2.5 conversion)
      lastName: (raw.last_name as string) || "",
      dateNaissance: (raw.date_naissance as string) || "",
      age,
      gender: (raw.genre as string) || "",
      city: (schoolRel as { city?: string } | null)?.city || "",
      region: (schoolRel as { region?: string } | null)?.region || "",
      graduationYear: raw.annee_diplomation ? String(raw.annee_diplomation) : "",
      telephone: (raw.telephone as string) || "",
      // Académique (LOCKED)
      gpa: raw.moyenne_generale != null ? String(raw.moyenne_generale) : "",
      programmeCegepVise: Array.isArray(raw.programme_cegep_vise) ? raw.programme_cegep_vise as string[] : [],
      programmesVises: Array.isArray(raw.programmes_vises) ? (raw.programmes_vises as unknown[]).map(String) : [],
      strongSubjects: Array.isArray(raw.matieres_fortes) ? raw.matieres_fortes as string[] : [],
      academicHonors: Array.isArray(raw.mentions_academiques) ? raw.mentions_academiques as string[] : [],
      openToPrivate: !!raw.ouvert_cegep_prive,
      openToAnglophone: !!raw.ouvert_cegep_anglophone,
      openToRelocate: !!raw.pret_changer_region,
      preferredRegions: Array.isArray(raw.regions_cegep_preferees) ? raw.regions_cegep_preferees as string[] : [],
      // Sport (SUGGEST)
      primarySport,
      primaryPosition,
      jerseyNumber: raw.numero_jersey != null ? String(raw.numero_jersey) : "",
      parcoursEquipes: parseTeamHistory(raw.parcours_equipes),
      sportId: (raw.sport_id as string) || null,
      // Physique (SUGGEST)
      heightDisplay,
      weightDisplay,
      wingspan: (raw.envergure as string) || "",
      dominantHand: (raw.main_dominante as string) || "",
      dominantFoot: (raw.pied_dominant as string) || "",
      fortyYard: (raw.test_40_verges as string) || "",
      verticalJump: (raw.saut_vertical as string) || "",
      broadJump: (raw.saut_longueur as string) || "",
      benchPress: (raw.developpe_couche as string) || "",
      shuttleAgility: (raw.navette_agilite as string) || "",
      sprint100m: (raw.sprint_100m as string) || "",
      // Médias (DIRECT)
      highlightVideoUrl: (raw.video_faits_saillants_url as string) || "",
      fullGameUrl: (raw.video_match_complet_url as string) || "",
      hudlUrl: (raw.hudl_url as string) || "",
      youtubeUrl: (raw.youtube_url as string) || "",
      instagramUrl: (raw.instagram_url as string) || "",
      // Évaluation (SUGGEST traits + cote + LOCKED rapport + SUGGEST distinctions)
      traitRatings,
      overallRating,
      coachReport,
      coachName,
      coachDistinctions,
      grilleId,
      positionId,
      // Civil/école
      isCivil,
      schoolName,
      teamName,
      leagueName,
      raw: raw as Record<string, unknown>,
    });

    // ── Sport / position option lists (NEW in B-2). Loaded once at
    //    mount ; the Sport step's pickers consume the static list and
    //    the position picker is scoped client-side by the athlete's
    //    current sport_id / sport_secondaire_id at row-render time.
    //    These are reference data — safe to fetch in full. ──
    const [{ data: sportsList }, { data: positionsList }] = await Promise.all([
      supabase.from("sports").select("id, nom").order("nom"),
      supabase.from("positions").select("id, nom, abreviation, sport_id").order("nom"),
    ]);
    setSportsOptions((sportsList as SportOption[]) || []);
    setPositionsOptions((positionsList as PositionOption[]) || []);

    // Pending suggestions — verbatim from page.tsx :1077-1094.
    const { data: sugs } = await supabase
      .from("athlete_suggestions")
      .select("id, champ, valeur_actuelle, valeur_proposee, status, message, raison_rejet, created_at")
      .eq("athlete_id", raw.id)
      .order("created_at", { ascending: false });
    if (sugs) {
      setSuggestions(sugs.map((s) => ({
        id: s.id,
        field: s.champ,
        current_value: s.valeur_actuelle,
        proposed_value: s.valeur_proposee,
        message: s.message || "",
        status: (STATUS_MAP[s.status] || "pending") as "pending" | "approved" | "rejected",
        submitted_at: s.created_at,
        rejection_reason: s.raison_rejet || undefined,
      })));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── getPending — verbatim mirror of page.tsx :1290 helper. */
  const pendingSugs = useMemo(() => suggestions.filter((s) => s.status === "pending"), [suggestions]);
  /* Compare sur la COLONNE : l'app 1.2 en magasin a pu créer la suggestion avec
     un libellé FR, celle-ci l'écrit en nom de colonne. Les deux doivent
     retrouver le même critère. */
  /* Grille de l'athlète : grille_id de l'éval affichée, sinon sa position.
     Une seule résolution, partagée par l'affichage et par la suggestion. */
  const grilleSet = useGrilles();
  const traitGroupsResolved = traitGroups(grilleSet, {
    grilleId:   ((a as { grilleId?: string | null } | null)?.grilleId) ?? null,
    positionId: ((a as { positionId?: string | null } | null)?.positionId) ?? null,
  } as GrilleRef);

  const getPending = useCallback((champ: string) => {
    const col = champToColumn(champ);
    return pendingSugs.find((s) =>
      s.field === champ || (col !== null && champToColumn(s.field) === col));
  }, [pendingSugs]);

  /* ── DIRECT save — mirrors page.tsx :1224-1236 (Médias saveField)
        widened to cover the Académique JSONB + bool columns introduced
        in B-2.5. UPDATE athletes set col=value where id=athleteId.

        Empty-value handling, by type :
          - string   : "" → null  (matches the existing Médias/Identité
                       contract — empty URL/text rows clear the column).
          - string[] : "" → []    (matches the web's AcademicEditForm at
                       page.tsx :950 — empty arrays write as [], NEVER
                       null, so the recruiter read of a JSONB column is
                       always an iterable array).
          - boolean  : pass through verbatim.

        Supabase-js serializes JS arrays → JSONB transparently — no
        JSON.stringify (that would double-encode and break the
        recruiter-side .filter / .map). */
  const saveDirect = useCallback(async (
    column: string,
    value: string | string[] | boolean | TeamHistoryEntry[],
  ) => {
    if (!a) return;
    const supabase = createClient();
    let payload: string | string[] | boolean | null;
    if (typeof value === "string") payload = value || null;
    else payload = value;                                  // array or bool — pass through
    await supabase.from("athletes").update({ [column]: payload }).eq("id", a.id);
    await load();
  }, [a, load]);

  /* ── Photo (DIRECT) — réutilise le MÊME mécanisme que le coach via le
        helper partagé uploadAvatar : upload sous le dossier de l'athlète
        connecté (auth.uid()), getPublicUrl, puis écriture photo_url par
        le chemin DIRECT (saveDirect → UPDATE athletes + reload). L'erreur
        d'upload est rendue visible (photoError) — jamais avalée. */
  const handlePhotoChange = useCallback(async (file: File | null) => {
    if (!file || !a) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const publicUrl = await uploadAvatar(file);
      await saveDirect("photo_url", publicUrl);
    } catch (err) {
      console.error("[AthleteEdit] photo upload error:", err);
      void triggerHaptic("Error");
      setPhotoError("Échec du téléversement de la photo. Réessaie.");
    } finally {
      setPhotoUploading(false);
    }
  }, [a, saveDirect]);

  const handlePhotoRemove = useCallback(async () => {
    if (!a) return;
    setPhotoError(null);
    await saveDirect("photo_url", "");   // "" → null (efface la colonne)
  }, [a, saveDirect]);

  /* ── SUGGEST submit — verbatim from page.tsx :1263-1272.
        One INSERT per field with the exact French champ string. */
  const submitSuggestion = useCallback(async (
    champ: string,
    proposed: string,
    message: string,
    currentValue: string,
  ) => {
    if (!a) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // coach_id : prefer the cached _raw value, fall back to a lookup
      // (matches page.tsx :1257-1261).
      let coachId: string | null = a.coachId;
      if (!coachId) {
        const { data: row } = await supabase.from("athletes").select("coach_id").eq("id", a.id).single();
        coachId = (row?.coach_id as string) || null;
      }

      await supabase.from("athlete_suggestions").insert({
        athlete_id: a.id,
        submitted_by: user.id,
        coach_id: coachId,
        champ,
        valeur_actuelle: currentValue,
        valeur_proposee: proposed,
        status: "EN_ATTENTE",
        message: message || null,
      });

      await load();
    } finally {
      setSubmitting(false);
    }
  }, [a, load]);

  if (!a) {
    return (
      <div className="min-h-screen bg-[#111317]" style={{ overflowY: "auto", overflowX: "hidden", height: "100dvh" }}>
        {/* Header skeleton — mirrors WizardPills (eyebrow + title + pill row) */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton width={44} height={44} rounded={999} />
            <div className="flex-1">
              <Skeleton className="h-3 w-12 rounded-full mb-2" />
              <Skeleton className="h-4 w-40 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>
        {/* Step body skeleton — mirrors px-4 pt-4 pb-48 space-y-5 field rows */}
        <div className="px-4 pt-4 pb-48 space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#1A1D24] border border-white/5 p-4 space-y-4">
              <Skeleton className="h-3 w-24 rounded-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-[#111317]" style={{ overflowY: "auto", overflowX: "hidden", height: "100dvh" }}>
      <WizardPills
        labels={[...STEP_LABELS]}
        active={step}
        onSelect={setStep}
        accentColors={STEP_ACCENTS}
        eyebrow="Étape"
        title={a.firstName ? `Mon profil — ${a.firstName}` : "Mon profil"}
        onBack={() => router.back()}
      />

      {/* pb-48 (192px) clears the bottom chrome stack : MobileTabBar
          (~64px + safe-area-inset-bottom) + sticky "Vu pour le
          recruteur" CTA (~76px) + a small visual buffer. The previous
          pb-32 (128px) would let the last content row hide behind the
          new CTA. The editor root is its own scroll container
          (height:100dvh + overflowY:auto), so this padding is the
          only buffer between the last row and the CTA's top edge. */}
      <div className="px-4 pt-4 pb-48 space-y-5">
        {/* ── Step 0 : Identité (MIXED — 5 DIRECT + 5 LOCKED) ── */}
        {step === 0 && (
          <IdentiteStep
            a={a}
            onDirect={saveDirect}
            onPhotoChange={handlePhotoChange}
            onPhotoRemove={handlePhotoRemove}
            photoUploading={photoUploading}
            photoError={photoError}
          />
        )}

        {/* ── Step 1 : Académique (DIRECT — B-2.5 conversion) ── */}
        {step === 1 && <AcademiqueStep a={a} onDirect={saveDirect} />}

        {/* ── Step 2 : Physique (SUGGEST) ── */}
        {step === 2 && <PhysiqueStep a={a} getPending={getPending} submitting={submitting} onSubmit={submitSuggestion} />}

        {/* ── Step 3 : Sport (SUGGEST — B-2 wired) ── */}
        {step === 3 && (
          <SportStep
            a={a}
            sportsOptions={sportsOptions}
            positionsOptions={positionsOptions}
            getPending={getPending}
            submitting={submitting}
            onSubmit={submitSuggestion}
            saveDirect={saveDirect}
          />
        )}

        {/* ── Step 4 : Médias (DIRECT) ── */}
        {step === 4 && <MediasStep a={a} onDirect={saveDirect} />}

        {/* ── Step 5 : Évaluation (SUGGEST cote + traits + LOCKED rapport) ── */}
        {step === 5 && (
          <EvaluationStep
            groups={traitGroupsResolved}
            a={a}
            getPending={getPending}
            submitting={submitting}
            onSubmit={submitSuggestion}
          />
        )}
      </div>
    </div>

    {/* ══ Sticky "Vu pour le recruteur" bottom CTA (Sprint C, Edit 2) ══
        Copies the coach "Modifier le profil" sticky-bar pattern verbatim
        from AthleteRecruiterProfileBodyMobile.tsx :2537-2577. createPortal
        to document.body escapes the AnimatedRoute motion.div's
        `willChange: transform` containing block, so position:fixed anchors
        to the viewport (not the motion.div). z-30 sits below the
        MobileTabBar (z-40), but the `bottom: calc(64px + safe-area)`
        offset places the CTA geometrically ABOVE the tab bar — both stay
        visible, no overlap. ALWAYS visible (no hide-on-scroll : the editor
        has no window-bound scroll listener, and adding one to drive a
        translateY would force re-renders of the entire wizard on every
        frame — out of scope and unnecessary for a single-action CTA).

        triggerHaptic is intentionally NOT imported here — the haptic util
        lives in AthleteRecruiterProfileBodyMobile.tsx as a local helper
        and threading it through (or wiring @capacitor/haptics directly)
        is out of scope for "move the button to the bottom". The CTA still
        delivers the OS-native tap feedback through the active: state. */}
    {mounted && typeof document !== "undefined" && createPortal(
      <div
        className="fixed left-0 right-0 z-30 px-3 py-2.5"
        style={{
          bottom: "calc(80px + env(safe-area-inset-bottom))",
          backgroundColor: "rgba(17,19,23,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); router.push("/athlete/profil/apercu"); }}
          className="w-full flex items-center justify-center gap-2 bg-[#E63946] text-white rounded-2xl px-4 py-3 font-head font-bold text-[13px] uppercase tracking-widest active:bg-[#D42B22] shadow-[0_0_20px_rgba(230,57,70,0.3)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Vu pour le recruteur
        </button>
      </div>,
      document.body,
    )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IDENTITÉ step — MIXED : 5 DIRECT + 5 LOCKED.

   Mirrors web page.tsx :1511-1533 post-conversion :
     - DIRECT (green pencil) : Prénom (first_name), Nom (last_name),
       Date de naissance (date_naissance), Genre (genre via picker),
       Téléphone (telephone). Each writes immediately via saveDirect
       to the matching athletes column.
     - LOCKED (red lock) : Âge (recomputed from date_naissance on
       reload, no column of its own), Ville (schools.city via FK
       join), Région (schools.region), affiliation row École /
       Équipe civile (civil/école label swap mirrors page.tsx :1515),
       Graduation (annee_diplomation — coach-managed).

   Genre stored as "M"/"F"/"X" ; display labels via GENDER_OPTIONS
   mapping. DOB stored + displayed as "YYYY-MM-DD" (web DatePicker
   + mobile DateRow share this format).
═══════════════════════════════════════════════════════════════ */
function IdentiteStep({
  a, onDirect, onPhotoChange, onPhotoRemove, photoUploading, photoError,
}: {
  a: LoadedAthlete;
  onDirect: (column: string, value: string | string[] | boolean) => Promise<void>;
  onPhotoChange: (file: File | null) => void;
  onPhotoRemove: () => void;
  photoUploading: boolean;
  photoError: string | null;
}) {
  const affiliationLabel = a.isCivil ? "Équipe civile" : "École";
  const affiliationValue = a.isCivil
    ? (a.teamName || a.leagueName || "—")
    : (a.schoolName || "—");
  const genderDisplay = GENDER_OPTIONS.find((o) => o.value === a.gender)?.label || "";
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Identité · Mixte
        </p>
        <PencilIcon color={GREEN} size={12} />
      </div>
      <p className="text-[12px] text-white/55 px-1">
        Certains champs sont modifiables directement ; d&apos;autres sont gérés par ton coach.
      </p>

      {/* Photo de profil — DIRECT. Même composant que le wizard coach
          (components/shared/AthletePhotoHero). */}
      <AthletePhotoHero
        photoUrl={a.photoUrl}
        uploading={photoUploading}
        error={photoError}
        onChange={onPhotoChange}
        onRemove={onPhotoRemove}
      />

      {/* DIRECT rows — modifiable, green pencil indicator. */}
      <Card>
        <DirectIndicatorRow>
          <InlineEditRow
            label="Prénom"
            value={a.firstName}
            type="text"
            onSave={(v) => { void onDirect("first_name", v); }}
            placeholder="Ex: Toa"
          />
        </DirectIndicatorRow>
        <DirectIndicatorRow>
          <InlineEditRow
            label="Nom"
            value={a.lastName}
            type="text"
            onSave={(v) => { void onDirect("last_name", v); }}
            placeholder="Ex: Smith"
          />
        </DirectIndicatorRow>
        <DirectIndicatorRow>
          <DateRow
            label="Date de naissance"
            value={a.dateNaissance}
            onChange={(v) => { void onDirect("date_naissance", v); }}
          />
        </DirectIndicatorRow>
        <DirectIndicatorRow>
          <PickerRow
            label="Genre"
            value={genderDisplay}
            onTap={() => setGenderPickerOpen(true)}
          />
          <MobilePicker
            open={genderPickerOpen}
            onClose={() => setGenderPickerOpen(false)}
            title="Genre"
            options={GENDER_OPTIONS}
            value={a.gender || null}
            onChange={(v) => {
              if (typeof v === "string") void onDirect("genre", v);
            }}
          />
        </DirectIndicatorRow>
        <DirectIndicatorRow>
          <InlineEditRow
            label="Téléphone"
            value={a.telephone}
            type="tel"
            onSave={(v) => { void onDirect("telephone", v); }}
            placeholder="514-000-0000"
          />
        </DirectIndicatorRow>
      </Card>

      {/* LOCKED rows — display-only, red lock indicator. Âge stays
          locked because it's derived from date_naissance (no column
          of its own — recomputed at load post-DOB edit). Ville /
          Région derive from the schools FK join. Affiliation +
          Graduation are coach-managed. */}
      <Card>
        <LockedIndicatorRow>
          <ReadOnlyRow label="Âge" value={a.age > 0 ? `${a.age} ans` : ""} />
        </LockedIndicatorRow>
        <LockedIndicatorRow>
          <ReadOnlyRow label="Ville" value={a.city} />
        </LockedIndicatorRow>
        <LockedIndicatorRow>
          <ReadOnlyRow label="Région" value={a.region} />
        </LockedIndicatorRow>
        <LockedIndicatorRow>
          <ReadOnlyRow label={affiliationLabel} value={affiliationValue} />
        </LockedIndicatorRow>
        <LockedIndicatorRow>
          <ReadOnlyRow label="Graduation" value={a.graduationYear} />
        </LockedIndicatorRow>
      </Card>
    </div>
  );
}

/* Tiny visual wrappers : prepend the mode indicator next to a wrapped
   shared row. The shared row primitives don't know about per-row
   mode glyphs ; this composition adds the green pencil / red lock
   in a positioned-absolute layer to the LEFT without touching the
   shared kit's signature. */
function DirectIndicatorRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none z-[1]">
        <PencilIcon color={GREEN} size={12} />
      </span>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function LockedIndicatorRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none z-[1]">
        <LockIcon size={12} />
      </span>
      <div className="pl-6">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACADÉMIQUE step — fully DIRECT (B-2.5 conversion).

   Athletes own this section entirely : moyenne, programme visé,
   matières fortes, mentions, 3 préférence booleans, régions préférées.
   No suggestions, no coach gate — every field writes immediately to
   athletes.<column> via saveDirect.

   Option lists are the shared canonical lists from
   @/lib/config/academicOptions (single source of truth, shared with
   the athlete onboarding step-2 pill grids). The JSONB arrays are
   written as raw JS arrays (supabase-js → JSONB) ; empty selections
   write as [] not null, matching the web's AcademicEditForm
   (page.tsx :949-955).

   DECISION : Régions préférées is ALWAYS shown (no conditional on
   pret_changer_region). The web edit form hides it until "open to
   relocate" is true ; the mobile flow surfaces it always so the
   athlete can express preferred regions without the coupling
   ergonomic, and so a tap on a region doesn't require flipping the
   préf-relocate toggle first.
═══════════════════════════════════════════════════════════════ */
function AcademiqueStep({
  a, onDirect,
}: {
  a: LoadedAthlete;
  onDirect: (column: string, value: string | string[] | boolean) => Promise<void>;
}) {
  /* T2 — sélecteur partagé. Remplace le couple (type, détail libre)
     dont programmeCegepDecode/Array assurait l'aller-retour : c'est ce
     couple qui a produit « Technique — Technique — Génie robotique ».
     La valeur affichée retombe sur l'ancienne colonne tant qu'elle n'est
     pas vidée (T3), via resolveProgrammesVises. */
  const [progPickerOpen, setProgPickerOpen] = useState(false);
  const { data: catalogueProg } = useCegepPrograms();
  const progLabels = resolveProgrammesVises(a.programmesVises, a.programmeCegepVise, catalogueProg);
  const progTypeLabel = progLabels.join(", ");

  /* Pill toggle helper : add value when absent, remove when present.
     The JSONB array column is updated atomically via saveDirect — no
     local state ; the load() that fires inside saveDirect reseeds
     the membership for the next render. */
  const toggleArrayValue = (column: string, current: string[], v: string) => {
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    void onDirect(column, next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Académique · Direct
        </p>
        <PencilIcon color={GREEN} size={12} />
      </div>
      <p className="text-[12px] text-white/55 px-1">
        Tu peux modifier ces informations directement — pas besoin de l&apos;approbation de ton coach.
      </p>

      {/* Moyenne + Programme visé (+ optional technique detail). */}
      <Card>
        <InlineEditRow
          label="Moyenne générale"
          value={a.gpa}
          type="text"
          numericMode="decimal"
          placeholder="Ex: 82"
          onSave={(v) => {
            /* Match web AcademicEditForm: parseFloat(gpa) or null.
               Stored numeric ; we write the parsed number's string
               form so the saveDirect string branch lands a parsed
               value in the column. Empty → null (string branch). */
            const trimmed = v.trim();
            if (!trimmed) { void onDirect("moyenne_generale", ""); return; }
            const parsed = parseFloat(trimmed);
            void onDirect("moyenne_generale", Number.isFinite(parsed) ? String(parsed) : "");
          }}
        />
        <PickerRow
          label="Programme visé"
          value={progTypeLabel}
          onTap={() => setProgPickerOpen(true)}
        />
        <ProgrammeCegepPicker
          open={progPickerOpen}
          onClose={() => setProgPickerOpen(false)}
          value={a.programmesVises}
          onChange={(ids) => { void onDirect("programmes_vises", ids); }}
        />
      </Card>

      {/* Matières fortes + Mentions académiques — fixed-list pills
          + custom free-text badges (CustomChipsField handles both,
          plus the inline "Ajouter" affordance). Custom values are
          plain strings appended to the same JSONB array — no schema
          change.  Régions préférées (below) stays fixed-list only :
          the Québec regions set is closed by product decision, so no
          custom-add field there. */}
      <Card>
        <CustomChipsField
          label="Matières fortes"
          column="matieres_fortes"
          fixedOptions={SUBJECTS}
          values={a.strongSubjects}
          onWrite={(col, next) => { void onDirect(col, next); }}
          placeholder="Ajouter une matière..."
        />
        <CustomChipsField
          label="Mentions académiques"
          column="mentions_academiques"
          fixedOptions={HONORS}
          values={a.academicHonors}
          onWrite={(col, next) => { void onDirect(col, next); }}
          placeholder="Ajouter une mention..."
        />
      </Card>

      {/* Préférences CÉGEP — 3 ToggleRow, each writes its boolean
          column directly. */}
      <Card>
        <ToggleRow
          label="Ouvert au CÉGEP privé"
          checked={a.openToPrivate}
          onToggle={() => { void onDirect("ouvert_cegep_prive", !a.openToPrivate); }}
        />
        <ToggleRow
          label="Ouvert au CÉGEP anglophone"
          checked={a.openToAnglophone}
          onToggle={() => { void onDirect("ouvert_cegep_anglophone", !a.openToAnglophone); }}
        />
        <ToggleRow
          label="Prêt à changer de région"
          checked={a.openToRelocate}
          onToggle={() => { void onDirect("pret_changer_region", !a.openToRelocate); }}
        />
      </Card>

      {/* Régions préférées — ALWAYS shown (decision : decoupled from
          pret_changer_region on mobile ; web couples them, mobile
          does not). */}
      <Card>
        <ChipsBlock label="Régions préférées">
          {CEGEP_REGIONS.map((r) => (
            <ChipToggle
              key={r}
              label={r}
              active={a.preferredRegions.includes(r)}
              onToggle={() => toggleArrayValue("regions_cegep_preferees", a.preferredRegions, r)}
            />
          ))}
        </ChipsBlock>
      </Card>
    </div>
  );
}

/* ChipToggle — single multi-select pill rendered inside a ChipsBlock.
   Active = red fill (canon recruitment-active style), inactive =
   muted neutral. Tap fires the parent's toggle handler. */
function ChipToggle({
  label, active, onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  // aria-pressed intentionally omitted — the jsx-a11y/aria-proptypes
  // rule rejects any JSX expression value (even one that resolves to
  // "true"/"false"), and the alternative (two button JSX branches)
  // adds clutter without a real a11y win. Active state is conveyed
  // by the red fill style ; sighted + keyboard users can still tell.
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-bold border transition-colors ${
        active
          ? "bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30"
          : "bg-white/[0.04] text-white/70 border-white/[0.08] active:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CustomChipsField — fixed-list pills + free-text custom badges +
   inline "Ajouter" affordance, all writing the same JSONB array.

   Used for matieres_fortes + mentions_academiques. NOT used for
   regions_cegep_preferees — regions are a closed set by product
   decision (8 fixed Québec regions ; no custom-add).

   Behavior :
     - Fixed pills : toggle in/out of the array. Case-insensitive
       active detection so a custom-typed "mathematiques" still lights
       up the canonical "Mathématiques" pill on next reload.
     - Custom pills : every array value NOT present in fixedOptions
       (case-insensitive) renders as a selected, removable badge with
       an × button. WITHOUT this rendering, custom values would save
       to the DB but vanish from the UI.
     - Add field : trimmed, case-insensitive dedupe against BOTH the
       fixed list (canonicalize to the fixed-list spelling) AND the
       current values. Length cap : 60 chars. Enter / button tap
       commits ; empty input → ignored.
═══════════════════════════════════════════════════════════════ */
function CustomChipsField({
  label, column, fixedOptions, values, onWrite, placeholder,
}: {
  label: string;
  column: string;
  fixedOptions: readonly string[];
  values: string[];
  onWrite: (column: string, next: string[]) => void;
  placeholder: string;
}) {
  const MAX_LEN = 60;
  const [draft, setDraft] = useState("");

  const fixedLowerSet = useMemo(
    () => new Set(fixedOptions.map((o) => o.toLowerCase())),
    [fixedOptions],
  );
  const valuesLowerSet = useMemo(
    () => new Set(values.map((v) => v.toLowerCase())),
    [values],
  );
  /* Custom values = anything in the stored array NOT matching a
     fixed-list option (case-insensitive). Pre-existing custom values
     written via the web's comma-split form land here on first render. */
  const customValues = useMemo(
    () => values.filter((v) => !fixedLowerSet.has(v.toLowerCase())),
    [values, fixedLowerSet],
  );

  const toggleFixed = (option: string) => {
    const optionLower = option.toLowerCase();
    const isActive = valuesLowerSet.has(optionLower);
    const next = isActive
      ? values.filter((v) => v.toLowerCase() !== optionLower)
      : [...values, option];
    onWrite(column, next);
  };

  const removeCustom = (value: string) => {
    onWrite(column, values.filter((v) => v !== value));
  };

  const addCustom = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > MAX_LEN) return;
    const lower = trimmed.toLowerCase();

    /* Case-insensitive match against the fixed list → canonicalize
       to the official spelling instead of adding a custom dupe. */
    const fixedMatch = fixedOptions.find((o) => o.toLowerCase() === lower);
    if (fixedMatch) {
      if (!valuesLowerSet.has(lower)) onWrite(column, [...values, fixedMatch]);
      setDraft("");
      return;
    }
    /* Custom branch : skip if a value with the same case-insensitive
       form is already in the array (no duplicate badges). */
    if (valuesLowerSet.has(lower)) { setDraft(""); return; }
    onWrite(column, [...values, trimmed]);
    setDraft("");
  };

  return (
    <div className="px-4 py-3 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px] text-white/55">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {fixedOptions.map((option) => (
          <ChipToggle
            key={option}
            label={option}
            active={valuesLowerSet.has(option.toLowerCase())}
            onToggle={() => toggleFixed(option)}
          />
        ))}
        {customValues.map((value) => (
          <CustomChip
            key={value}
            label={value}
            onRemove={() => removeCustom(value)}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder={placeholder}
          maxLength={MAX_LEN}
          aria-label={`Ajouter — ${label}`}
          className="flex-1 min-w-0 bg-[#111317] border border-white/[0.10] rounded-xl px-3 py-2 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-white/[0.20]"
        />
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); addCustom(); }}
          disabled={!draft.trim()}
          className="shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors bg-[#E63946] text-white active:bg-[#D42B22] disabled:opacity-40 disabled:bg-white/[0.06] disabled:text-white/40"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

/* CustomChip — single custom badge with × remove button. Styled like
   an active ChipToggle (red fill) + a trailing close button. */
function CustomChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[12px] font-bold border bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30">
      <span className="truncate max-w-[160px]">{label}</span>
      <button
        type="button"
        onClick={() => { void triggerHaptic("Medium"); onRemove(); }}
        aria-label={`Retirer ${label}`}
        className="w-5 h-5 inline-flex items-center justify-center rounded-full active:bg-[#E63946]/25"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SPORT step — 5 SUGGEST rows.

   Champ strings BYTE-FOR-BYTE match the web fieldMap at page.tsx
   :1245-1252 AND the apply_approved_suggestion trigger's name→id
   resolution branches (Sport principal, Position, Sport secondaire,
   Position secondaire, Numéro). For choice fields the picker options
   are exact sport / position NAMES from the loaded reference lists —
   the trigger looks up the name in `sports.nom` / `positions.nom` and
   RAISES on no-match, so free-text entry is not surfaced. Position
   pickers are SCOPED client-side : primary by athletes.sport_id,
   secondary by athletes.sport_secondaire_id (fallback sport_id when
   no secondary sport is set — mirrors page.tsx).
═══════════════════════════════════════════════════════════════ */
function SportStep({
  a, sportsOptions, positionsOptions, getPending, submitting, onSubmit, saveDirect,
}: {
  a: LoadedAthlete;
  sportsOptions: SportOption[];
  positionsOptions: PositionOption[];
  getPending: (champ: string) => AthleteSuggestion | undefined;
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<void>;
  saveDirect: (column: string, value: string | string[] | boolean | TeamHistoryEntry[]) => Promise<void>;
}) {
  /* The picker `value` field is the same string the trigger receives
     (the sport / position NAME), so we map each option to {value=nom,
     label=nom}. The trigger does the name→id lookup at approval time
     (page.tsx fieldMap maps "Sport principal" → sport_id ; the trigger
     resolves via `sports WHERE lower(nom) = lower(proposed)` etc.). */
  const sportPickerOptions: PickerOption[] = useMemo(
    () => sportsOptions.map((s) => ({ value: s.nom, label: s.nom })),
    [sportsOptions],
  );

  // Parcours d'équipes — DIRECT write (distinct from the suggest-only rows).
  const [phEditing, setPhEditing] = useState(false);
  const [phDraft, setPhDraft] = useState<TeamHistoryEntry[]>([]);
  const [phSaving, setPhSaving] = useState(false);
  const phCurrent = a.parcoursEquipes ?? [];
  const phMaxYear = new Date().getFullYear() + 1;
  const phValid = isTeamHistoryValid(phDraft, phMaxYear);
  const phStart = () => { setPhDraft(phCurrent); setPhEditing(true); };
  const phSave = async () => {
    if (!phValid) return;
    setPhSaving(true);
    await saveDirect("parcours_equipes", phDraft);
    setPhSaving(false);
    setPhEditing(false);
  };

  // Primary position picker : scoped to the athlete's CURRENT primary
  // sport (athletes.sport_id). Secondary position picker : scoped to
  // sport_secondaire_id ; falls back to primary sport_id when the
  // secondary sport isn't set yet. Mirrors page.tsx's StructuredInput
  // scoping for these champs.
  /* Position picker label : show "ABREV — Nom" when an abbreviation
     exists (e.g. "QB — Quart-arrière"), else fall back to the full
     name. The picker's `value` STAYS p.nom verbatim — the trigger
     resolves Position champs by name (sport-scoped at apply time),
     so changing the value would break apply_approved_suggestion's
     lookup. Only the visible label changes. */
  const primaryPositionOptions: PickerOption[] = useMemo(
    () => positionsOptions
      .filter((p) => p.sport_id === a.sportId)
      .map((p) => ({ value: p.nom, label: p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom })),
    [positionsOptions, a.sportId],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: YELLOW }}>
          Sport · Suggest
        </p>
        <PencilIcon color={YELLOW} size={12} />
      </div>
      <p className="text-[12px] text-white/55 px-1">
        Tes propositions sont envoyées à ton coach pour approbation.
      </p>
      <Card>
        <SuggestRow
          label="Sport principal"
          value={a.primarySport}
          champ="Sport principal"
          pending={getPending("Sport principal")}
          inputType="picker"
          pickerOptions={sportPickerOptions}
          submitting={submitting}
          onSubmit={onSubmit}
        />
        <SuggestRow
          label="Position principale"
          value={a.primaryPosition}
          champ="Position"
          pending={getPending("Position")}
          inputType="picker"
          pickerOptions={primaryPositionOptions}
          submitting={submitting}
          onSubmit={onSubmit}
        />
        <SuggestRow
          label="Numéro"
          value={a.jerseyNumber}
          champ="Numéro"
          pending={getPending("Numéro")}
          inputType="text"
          numericMode="numeric"
          placeholder="Ex: 24"
          submitting={submitting}
          onSubmit={onSubmit}
          isLast
        />
      </Card>

      {/* Parcours d'équipes — édition directe (athlète-owned), distincte
          des suggestions ci-dessus. */}
      <div className="mt-4 rounded-2xl bg-[#1A1D24] border border-[#2D3748] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-head font-bold tracking-[0.12em] uppercase text-[#9CA3AF]">Parcours d&apos;équipes</h3>
          {!phEditing && (
            <button type="button" onClick={() => { void triggerHaptic("Light"); phStart(); }} className="text-[12px] font-bold text-[#E63946]">
              {phCurrent.length ? "Modifier" : "Ajouter"}
            </button>
          )}
        </div>
        {phEditing ? (
          <>
            <TeamHistoryEditor value={phDraft} onChange={setPhDraft} sports={sportsOptions} maxYear={phMaxYear} />
            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-[#2D3748]/40">
              <button type="button" onClick={() => { void triggerHaptic("Light"); setPhEditing(false); }} className="text-[13px] font-bold text-[#9CA3AF]">Annuler</button>
              <button type="button" onClick={() => { void triggerHaptic("Light"); phSave(); }} disabled={phSaving || !phValid} className="px-4 py-2 bg-[#E63946] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg">
                {phSaving ? "…" : "Enregistrer"}
              </button>
            </div>
          </>
        ) : phCurrent.length === 0 ? (
          <p className="text-[13px] text-[#6b7280]">Aucun parcours ajouté.</p>
        ) : (
          <TeamHistoryBlock entries={phCurrent} headingClassName="hidden" />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PHYSIQUE step — 11 SUGGEST rows. Champ strings BYTE-FOR-BYTE
   match the web fieldMap at app/athlete/profil/page.tsx :1245-1252
   AND the apply_approved_suggestion trigger CASE branches.
═══════════════════════════════════════════════════════════════ */
function PhysiqueStep({
  a, getPending, submitting, onSubmit,
}: {
  a: LoadedAthlete;
  getPending: (champ: string) => AthleteSuggestion | undefined;
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<void>;
}) {
  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: YELLOW }}>
            Physique · Suggest
          </p>
          <PencilIcon color={YELLOW} size={12} />
        </div>
        <p className="text-[12px] text-white/55 mb-3 px-1">
          Tes propositions sont envoyées à ton coach pour approbation.
        </p>
        <Card>
          <SuggestRow label="Taille"          value={a.heightDisplay}   champ="Taille"          pending={getPending("Taille")}          inputType="wheel" wheelKind="height" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Poids"           value={a.weightDisplay}   champ="Poids"           pending={getPending("Poids")}           inputType="wheel" wheelKind="weight" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Envergure"       value={a.wingspan}        champ="Envergure"       pending={getPending("Envergure")}       inputType="text" placeholder="Ex: 78&quot;"    submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Main dominante"  value={a.dominantHand}    champ="Main dominante"  pending={getPending("Main dominante")}  inputType="picker" pickerOptions={HAND_OPTIONS} submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Pied dominant"   value={a.dominantFoot}    champ="Pied dominant"   pending={getPending("Pied dominant")}   inputType="picker" pickerOptions={FOOT_OPTIONS} submitting={submitting} onSubmit={onSubmit} isLast />
        </Card>
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/45 mb-2 px-1">
          Tests athlétiques
        </p>
        <Card>
          <SuggestRow label="40 verges"        value={a.fortyYard}      champ="40 yards"         pending={getPending("40 yards")}         inputType="text" placeholder="Ex: 4.72s"     submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Saut vertical"    value={a.verticalJump}   champ="Saut vertical"    pending={getPending("Saut vertical")}    inputType="text" placeholder="Ex: 32&quot;"   submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Saut en longueur" value={a.broadJump}      champ="Saut longueur"    pending={getPending("Saut longueur")}    inputType="text" placeholder="Ex: 9'2&quot;"  submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Développé couché" value={a.benchPress}     champ="Développé couché" pending={getPending("Développé couché")} inputType="text" placeholder="Ex: 225 × 8"   submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Navette"          value={a.shuttleAgility} champ="Navette"          pending={getPending("Navette")}          inputType="text" placeholder="Ex: 4.31s"     submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Sprint 100m"      value={a.sprint100m}     champ="Sprint 100m"      pending={getPending("Sprint 100m")}      inputType="text" placeholder="Ex: 10.9s"     submitting={submitting} onSubmit={onSubmit} isLast />
        </Card>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MÉDIAS step — 5 DIRECT url rows. Same dbMap as page.tsx :1228-1231
   (highlightVideo → video_faits_saillants_url, etc.). UPDATE athletes
   fires immediately on InlineEditRow commit.
═══════════════════════════════════════════════════════════════ */
function MediasStep({
  a, onDirect,
}: {
  a: LoadedAthlete;
  onDirect: (column: string, value: string) => Promise<void>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Médias · Direct
        </p>
        <PencilIcon color={GREEN} size={12} />
      </div>
      <p className="text-[12px] text-white/55 mb-3 px-1">
        Tu peux modifier ces liens directement — l&apos;enregistrement est immédiat.
      </p>
      <Card>
        <DirectUrlRow
          label="Faits saillants"
          value={a.highlightVideoUrl}
          placeholder="https://youtube.com/watch?v=…"
          onSave={(v) => onDirect("video_faits_saillants_url", v)}
        />
        <DirectUrlRow
          label="Match complet"
          value={a.fullGameUrl}
          placeholder="https://youtube.com/…"
          onSave={(v) => onDirect("video_match_complet_url", v)}
        />
        <DirectUrlRow
          label="Hudl"
          value={a.hudlUrl}
          placeholder="https://hudl.com/video/…"
          onSave={(v) => onDirect("hudl_url", v)}
        />
        <DirectUrlRow
          label="YouTube"
          value={a.youtubeUrl}
          placeholder="https://youtube.com/@…"
          onSave={(v) => onDirect("youtube_url", v)}
        />
        <DirectUrlRow
          label="Instagram"
          value={a.instagramUrl}
          placeholder="https://instagram.com/…"
          onSave={(v) => onDirect("instagram_url", v)}
        />
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ÉVALUATION step — SUGGEST cote + 14 traits, LOCKED rapport.
   Sprint B-3a (Distinctions is B-3b).

   This is the trigger-critical surface : the champ strings + the
   detailed-wins rule are wired to apply_approved_suggestion. Mirrors
   web EvaluationSuggest (page.tsx :544-691) verbatim.

   Layout :
     - Rapport entraîneur (LOCKED red lock chip, italicized quote
       attributed to the coach). NO champ — never suggestable.
     - Cote globale row — TWO mutually-exclusive variants by
       isDetailedMode :
         · SIMPLE (no traits) : star-suggest row, half-stars,
           champ="Cote globale", valeur_proposee = draft.toFixed(1).
         · DETAILED (any trait > 0) : READ-ONLY auto-average display.
           NO suggest button. UI mirrors trigger's v_is_detailed
           guard — the athlete cannot emit a "Cote globale"
           suggestion when detailed traits exist.
     - Trait grid (Caractère + Tactique Cards) — only rendered when
       isDetailedMode is true. Each trait is a whole-star suggest
       row with champ = the trait's exact French label.

   isDetailedMode mirrors page.tsx :550 verbatim :
     !!traitRatings && groups.flatMap((g) => g.traits).some((t) => (traitRatings[t.camel] || 0) > 0)
═══════════════════════════════════════════════════════════════ */
function EvaluationStep({
  a, getPending, submitting, onSubmit, groups,
}: {
  a: LoadedAthlete;
  getPending: (champ: string) => AthleteSuggestion | undefined;
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<void>;
  /** Les 2 groupes (9 / 5), libellés résolus par la grille de l'athlète. */
  groups: { title: string; traits: TraitEntry[] }[];
}) {
  const tr = a.traitRatings;
  const TRAIT_CHAMPS: TraitEntry[] = groups.flatMap((g) => g.traits);
  const CHARACTER_TRAITS = groups[0]?.traits ?? [];
  const TACTICAL_TRAITS  = groups[1]?.traits ?? [];
  const camel = (t: TraitEntry) => t.camel as keyof AthleteTraitRatings;
  const isDetailedMode = !!tr && TRAIT_CHAMPS.some((t) => (tr[camel(t)] || 0) > 0);

  /* traitAvg — auto-average of non-zero traits (verbatim from
     page.tsx :562-567). When isDetailedMode is false, falls back
     to the flat overallRating from the loaded cote_globale. */
  const traitAvg = isDetailedMode && tr
    ? (() => {
        const vals = TRAIT_CHAMPS.map((t) => (tr[camel(t)] || 0)).filter((v) => v > 0);
        return vals.length ? vals.reduce((acc, v) => acc + v, 0) / vals.length : 0;
      })()
    : a.overallRating;

  const getCurrent = (key: keyof AthleteTraitRatings) => (tr ? tr[key] || 0 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: YELLOW }}>
          Évaluation · Suggest
        </p>
        <PencilIcon color={YELLOW} size={12} />
      </div>
      <p className="text-[12px] text-white/55 px-1">
        Tes propositions sont envoyées à ton coach pour approbation.
      </p>

      {/* ── Rapport entraîneur — LOCKED (display-only).
            No champ in apply_approved_suggestion : the athlete cannot
            propose changes to this. Rendered only when the coach has
            actually written one. Heading carries a red LockIcon for
            consistency with the rest of the LOCKED indicator canon
            (Identité locked rows, Médias none). */}
      {a.coachReport && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45">
              Rapport entraîneur
            </p>
            <LockIcon size={12} />
          </div>
          <Card>
            <div className="px-4 py-4 bg-[#0E1015]">
              {a.coachName && (
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45 mb-2">
                  Coach {a.coachName}
                </p>
              )}
              <p className="text-[14px] text-white/75 leading-relaxed italic">
                &ldquo;{a.coachReport}&rdquo;
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Cote globale ─────────────────────────────────────────
            SIMPLE branch (no traits) : suggestable via StarSuggestRow,
            half-stars enabled, champ="Cote globale".
            DETAILED branch (any trait > 0) : READ-ONLY auto-average.
            No suggest button. This is the UI mirror of the trigger's
            v_is_detailed guard at migration L109-114 — the athlete
            cannot emit a "Cote globale" suggestion when any trait is
            set, so a flat-cote proposal can never roll back at apply
            time. */}
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45 mb-2 px-1">
          Cote globale
        </p>
        {!isDetailedMode ? (
          <Card>
            <StarSuggestRow
              label={a.overallRating > 0 ? `${a.overallRating.toFixed(1)}/5` : "—"}
              currentValue={a.overallRating}
              champ="Cote globale"
              allowHalf
              starSize={28}
              pending={getPending("Cote globale")}
              submitting={submitting}
              onSubmit={async (proposed) => {
                /* Cote stringify : toFixed(1) → e.g. "4.5". Matches
                   trigger ::numeric cast (migration L115). */
                await onSubmit("Cote globale", proposed.toFixed(1), "", String(a.overallRating || ""));
              }}
              isLast
            />
          </Card>
        ) : (
          <Card>
            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] text-white/55">Cote calculée</p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Moyenne automatique de tes critères ci-dessous.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StarRow value={Math.round(traitAvg)} onChange={() => { /* read-only */ }} size={20} />
                <span className="text-[14px] font-bold text-white w-12 text-right">
                  {traitAvg > 0 ? `${traitAvg.toFixed(1)}/5` : "—"}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ── Trait grid — only when detailed mode is on. Two Cards :
            Caractère (8 character traits), Tactique (6 tactical).
            Each row is a StarSuggestRow with whole-star input
            (allowHalf=false) and champ = the trait's exact French
            label. valeur_proposee = String(int) "1"-"5", matching
            the trigger ::int cast for those 14 columns. */}
      {isDetailedMode && (
        <>
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45 mb-2 px-1">
              Caractère
            </p>
            <Card>
              {CHARACTER_TRAITS.map((t, i) => {
                const current = getCurrent(camel(t));
                return (
                  <StarSuggestRow
                    key={t.column}
                    label={t.label}
                    currentValue={current}
                    champ={t.column}
                    allowHalf={false}
                    starSize={20}
                    pending={getPending(t.column)}
                    submitting={submitting}
                    onSubmit={async (proposed) => {
                      /* Submit guard mirrors page.tsx :587 :
                         only emit if proposed > 0 && proposed !== current.
                         StarSuggestRow's submit path enforces > 0 ;
                         the equality check happens here. */
                      if (proposed === current) return;
                      // `champ` = NOM DE COLONNE (clé stable).
                      await onSubmit(t.column, String(proposed), "", String(current || ""));
                    }}
                    isLast={i === CHARACTER_TRAITS.length - 1}
                  />
                );
              })}
            </Card>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45 mb-2 px-1">
              Tactique
            </p>
            <Card>
              {TACTICAL_TRAITS.map((t, i) => {
                const current = getCurrent(camel(t));
                return (
                  <StarSuggestRow
                    key={t.column}
                    label={t.label}
                    currentValue={current}
                    champ={t.column}
                    allowHalf={false}
                    starSize={20}
                    pending={getPending(t.column)}
                    submitting={submitting}
                    onSubmit={async (proposed) => {
                      if (proposed === current) return;
                      // `champ` = NOM DE COLONNE (clé stable).
                      await onSubmit(t.column, String(proposed), "", String(current || ""));
                    }}
                    isLast={i === TACTICAL_TRAITS.length - 1}
                  />
                );
              })}
            </Card>
          </div>
        </>
      )}

      {/* ── Distinctions (SUGGEST) ──────────────────────────────
            Single-row, single-suggestion : the whole entries array is
            JSON-stringified into one athlete_suggestions row with champ
            "Distinctions" + valeur_proposee = JSON.stringify(entries).
            Trigger casts ::jsonb on apply (migration L190-193) and the
            recruiter/coach read goes through pastillesBadges, so the
            stringify→jsonb→parse round-trip is symmetric. */}
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45 mb-2 px-1">
          Distinctions
        </p>
        <Card>
          <DistinctionsSuggestRow
            athleteId={a.id ?? null}
            sportId={a.sportId}
            sportNom={a.primarySport || null}
            currentDistinctions={a.coachDistinctions}
            pending={getPending("Distinctions")}
            submitting={submitting}
            onSubmit={async (entries) => {
              /* champ + payload format are trigger-critical. champ MUST
                 be exactly "Distinctions" (single trigger CASE branch
                 at migration L190). NEVER emit "Distinction
                 personnalisée" — that's a SEPARATE branch (L195-196)
                 used by a different admin flow ; emitting it from the
                 athlete profile would INSERT into custom_distinctions
                 instead of updating evaluations.distinctions, which is
                 not what we want here. The custom badge's display title
                 lives inside the entries array as { badge:"custom",
                 detail:"<title>" } and ships through the regular
                 Distinctions branch. */
              const valueActuelle = JSON.stringify(a.coachDistinctions);
              await onSubmit("Distinctions", JSON.stringify(entries), "", valueActuelle);
            }}
          />
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   StarSuggestRow — parallel to SuggestRow but with a StarRow input
   body (no text/picker overlap with SuggestExpand). Owns its own
   expand state + yellow indicator + pending pill + Soumettre /
   Annuler shell.

   Submit guard : refuses to commit if `proposed <= 0`. Per-row
   semantic guards (e.g. "trait must differ from current") are
   delegated to the caller's onSubmit. The trigger doesn't care
   about identical values — they update the column to the same int —
   but emitting them clutters the coach's approval inbox, so the
   trait call sites in EvaluationStep skip when proposed === current.

   `allowHalf` is forwarded to StarRow ; the row is half-star for
   Cote globale and whole-star for individual traits.
═══════════════════════════════════════════════════════════════ */
function StarSuggestRow({
  label, currentValue, champ, allowHalf, starSize, pending, submitting, onSubmit, isLast,
}: {
  label: string;
  /** Currently-stored value in evaluations (0 = unset). Displayed
   *  in the collapsed read state + struck-through in the expand
   *  state for the "Actuel" context. */
  currentValue: number;
  /** Exact French champ string ; trigger-critical. Mirrored
   *  byte-for-byte from TRAIT_CHAMPS labels OR the literal
   *  "Cote globale" for the flat-cote row. */
  champ: string;
  allowHalf: boolean;
  starSize: number;
  pending: AthleteSuggestion | undefined;
  submitting: boolean;
  /** Called with the validated `proposed` number (always > 0). The
   *  caller does the stringify (String(int) for traits, toFixed(1)
   *  for cote) inside its own onSubmit closure. */
  onSubmit: (proposed: number) => Promise<void>;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(0);

  const hasPending = !!pending;

  /* Collapsed surface — yellow pencil indicator + current value
     stars + pending pill (mirrors SuggestRow's read state). The
     pending pill appears when an EN_ATTENTE suggestion exists for
     this champ. */
  if (!expanded) {
    return (
      <div className={`w-full ${isLast ? "" : "border-b border-white/[0.06]"}`}>
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); setDraft(currentValue); setExpanded(true); }}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 active:bg-white/[0.02]"
        >
          <span className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <PencilIcon color={YELLOW} size={12} />
            <span className="text-[14px] text-white/70 truncate">{label}</span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <StarRow value={currentValue} onChange={() => { /* read-only */ }} size={starSize > 24 ? 18 : 16} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
        {hasPending && (
          <div className="px-4 pb-3 -mt-1">
            <span className="inline-block text-[11px] font-bold text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/25 rounded-full px-2 py-0.5">
              ⏳ En attente : {pending?.proposed_value}/5
            </span>
          </div>
        )}
      </div>
    );
  }

  /* Expanded surface — current/proposed stars + Soumettre / Annuler.
     Submit guard : refuse draft <= 0. */
  const canSubmit = draft > 0 && !submitting;
  return (
    <div className={`w-full ${isLast ? "" : "border-b border-white/[0.06]"} px-4 py-3 bg-[#0E1015]`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] text-white font-semibold">{champ}</span>
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); setExpanded(false); }}
          className="text-[12px] text-white/45 active:text-white/70"
        >
          Annuler
        </button>
      </div>
      {currentValue > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">Actuel</span>
          <StarRow value={currentValue} onChange={() => { /* read-only */ }} size={16} />
          <span className="text-[12px] text-white/55">{allowHalf ? currentValue.toFixed(1) : currentValue}/5</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <StarRow value={draft} onChange={setDraft} size={starSize} allowHalf={allowHalf} />
        <span className="text-[13px] font-bold text-white w-12 text-right">
          {draft > 0 ? `${allowHalf ? draft.toFixed(1) : draft}/5` : "—"}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={async () => {
            if (!canSubmit) return;
            await onSubmit(draft);
            setExpanded(false);
          }}
          disabled={!canSubmit}
          className="px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors bg-[#EAB308] text-[#111317] active:bg-[#D4A20A] disabled:opacity-40 disabled:bg-white/[0.06] disabled:text-white/40"
        >
          {submitting ? "..." : "Soumettre"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DistinctionsSuggestRow — Sprint B-3b.

   The ONLY structured-payload suggestion in the system : a JSONB
   array of {badge, detail?} entries that ships as ONE suggestion row
   (champ="Distinctions", valeur_proposee=JSON.stringify(entries)) ;
   the trigger casts ::jsonb and the recruiter/coach read goes through
   pastillesBadges. Symmetric round-trip.

   Mirrors web DistinctionsSuggest (app/athlete/profil/page.tsx :695-
   800) :
     - 7 badges from BADGE_ORDER as a toggle list (custom label is
       shown as "Personnalisée" — same display substitution as web
       page.tsx :772).
     - MAX_BADGES = 5 cap (enforced both on toggle AND visually : once
       5 are selected, unselected entries dim + disable).
     - 3 hasDetail badges (team_leader / league_leader / custom)
       reveal an inline detail input capped at MAX_DETAIL_LENGTH = 30.
       Placeholders : custom → "Titre", others → "Ex: Points, Buts,
       Passes..." — verbatim mirror of web :780.
     - On submit, entries with empty detail strings have their detail
       key OMITTED (not detail:"") — same as web :716-718's
       `detail: detail || undefined` idiom which JSON.stringify drops
       from the serialized object.

   INPUT SURFACE : inline-expand (no bottom sheet). The 7-badge list +
   per-badge detail inputs fit comfortably inline at ~10 rows worst-
   case, well below typical step height. Keeping it inline preserves
   the no-popup canon of the rest of the athlete editor — every
   suggest row in this wizard is inline-expand (text, picker, stars,
   now distinctions). A bottom sheet would be the ONLY exception and
   would have to ship + own its own animation/close semantics. Inline
   stays simpler and consistent.

   Submission shape is byte-identical to the web payload so the
   apply_approved_suggestion trigger's `::jsonb` cast and the canonical
   pastillesBadges read are both symmetric round-trips.
═══════════════════════════════════════════════════════════════ */
function DistinctionsSuggestRow({
  athleteId, sportId, sportNom, currentDistinctions, pending, submitting, onSubmit,
}: {
  athleteId: string | null;
  sportId: string | null;
  sportNom: string | null;
  currentDistinctions: DistinctionEntry[];
  pending: AthleteSuggestion | undefined;
  submitting: boolean;
  onSubmit: (entries: DistinctionEntry[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [autres, setAutres] = useState<BadgeEntry[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const cat = useBadgeCatalogue();
  /* Draft is seeded from currentDistinctions on expand (mirrors web
     `startEditing` at page.tsx :727-730) so the athlete edits the
     existing set rather than starting blank. */
  const [draft, setDraft] = useState<BadgeEntry[]>([]);
  const hasPending = !!pending;
  const incomplets = entreesIncompletes(draft, cat);

  /* Le picker part des badges issus de SUGGESTIONS, pas de
     evaluations.distinctions. Ceux posés par un coach s'affichent en lecture
     seule : une suggestion ne peut pas les retirer. Si la lecture échoue on
     N'OUVRE PAS — ouvrir sur une liste vide proposerait de tout retirer. */
  const ouvrir = async () => {
    setErreur(null);
    if (!athleteId) { setErreur("profil non chargé"); return; }
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      const b = await chargerBadgesAthlete(sb, athleteId, user?.id ?? null, false, "suggestion");
      setDraft(b.miens);
      setAutres(b.autres);
      setExpanded(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async () => {
    /* Normalize entries for the wire payload : drop empty detail keys
       so JSON.stringify omits them (matches web exactly — empty detail
       must NOT serialize as `"detail":""`). Preserve insertion order
       (athlete's tap order = badge ordering in the recruiter view). */
    /* Ancienne forme {badge, detail} avec les NOUVEAUX codes :
       code_badge_catalogue accepte les deux vocabulaires, donc aucun SQL à
       toucher et le contrat de onSubmit reste inchangé. */
    const wire: DistinctionEntry[] = draft.map((e) => {
      const d = (e.contexte || "").trim();
      return d ? { badge: e.code, detail: d } : { badge: e.code };
    });
    await onSubmit(wire);
    setExpanded(false);
  };

  /* ─── Collapsed surface ──────────────────────────────────────
        Yellow pencil indicator + "Distinctions" + small chip summary
        of currently-coach-set badges + pending pill. Same visual
        canon as the StarSuggestRow read-state. */
  if (!expanded) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); void ouvrir(); }}
          className="w-full flex items-start justify-between gap-3 px-4 py-3 active:bg-white/[0.02]"
        >
          <span className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <PencilIcon color={YELLOW} size={12} />
            <span className="text-[14px] text-white/70 truncate">Distinctions</span>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        {/* Current badges as small muted chips. Empty state shows an
            em-dash via the read-only branch ; in expand mode the user
            sees the same chip list reflected in the toggle states. */}
        {currentDistinctions.length > 0 ? (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {currentDistinctions.map((e, i) => {
              const cfg = BADGE_CONFIG[e.badge];
              if (!cfg) return null;
              const label = e.badge === "custom"
                ? (e.detail || "Personnalisée")
                : (e.detail ? `${cfg.label} — ${e.detail}` : cfg.label);
              return (
                <span
                  key={`${e.badge}-${i}`}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] border border-white/[0.08] text-white/75"
                >
                  {label}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="px-4 pb-3">
            <span className="text-[12px] text-white/35">—</span>
          </div>
        )}
        {hasPending && (
          <div className="px-4 pb-3 -mt-1">
            <span className="inline-block text-[11px] font-bold text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/25 rounded-full px-2 py-0.5">
              ⏳ En attente
            </span>
          </div>
        )}
      </div>
    );
  }

  /* ─── Expanded surface ───────────────────────────────────────
        7-badge toggle list + per-badge detail inputs (hasDetail
        only) + Annuler/Soumettre. Cap counter (n/MAX_BADGES) sits
        above the action row. */
  return (
    <div className="w-full px-4 py-3 bg-[#0E1015]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] text-white font-semibold">Distinctions</span>
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); setExpanded(false); }}
          className="text-[12px] text-white/45 active:text-white/70"
        >
          Annuler
        </button>
      </div>

      {/* Ambre : l'accent des surfaces athlète mobile. Les compteurs (dont
          le plafond par famille) sont portés par le picker. */}
      <BadgePicker
        value={draft}
        onChange={setDraft}
        sportId={sportId}
        sportNom={sportNom}
        autresBadges={autres}
        layout="rangees"
        accent="#EAB308"
      />

      <div className="mt-3 flex items-center justify-end gap-3 pb-2">
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); submit(); }}
          disabled={submitting}
          className="px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors bg-[#EAB308] text-[#111317] active:bg-[#D4A20A] disabled:opacity-40 disabled:bg-white/[0.06] disabled:text-white/40"
        >
          {submitting ? "..." : "Soumettre"}
        </button>
      </div>
    </div>
  );
}
