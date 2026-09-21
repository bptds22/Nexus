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
     - PHYSIQUE step (SUGGEST) : 11 fields, inline-expand ChampDirectExpand
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
import { ecrireChampAthlete } from "@/lib/athlete/champVersColonne";
import { uploadAvatar } from "@/lib/storage/uploadAvatar";
import AthletePhotoHero from "@/components/shared/AthletePhotoHero";
import type { AthleteSuggestion, AthleteTraitRatings, TeamHistoryEntry } from "@/lib/types/models";
import TeamHistoryBlock from "@/components/shared/athlete/TeamHistoryBlock";
import TeamHistoryEditor from "@/components/shared/athlete/TeamHistoryEditor";
import { parseTeamHistory, isTeamHistoryValid } from "@/components/shared/athlete/teamHistory";
import { Card, InlineEditRow, PickerRow, ReadOnlyRow, ToggleRow, ChipsBlock } from "@/components/shared/wizard/rows";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";
import { StarRow } from "@/components/shared/wizard/stars";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import {
  HeightWheel, WeightWheel, formatHeightDisplay, formatWeightDisplay,
  UNIT_MODE_STORAGE_KEY, type UnitMode,
} from "@/components/shared/wizard/HeightWeightWheel";
import { WizardPills } from "@/components/shared/wizard/WizardPills";
import { Skeleton } from "@/components/ui/Skeleton";
import { GREEN, YELLOW, PencilIcon, LockIcon } from "@/components/shared/wizard/modeIcons";
import { triggerHaptic } from "@/lib/haptics";
import { SUBJECTS, HONORS, CEGEP_REGIONS } from "@/lib/config/academicOptions";
import ProgrammeCegepPicker from "@/components/shared/ProgrammeCegepPicker";
import { useCegepPrograms, resolveProgrammesVises } from "@/lib/queries/shared/useCegepPrograms";
import {
  BADGE_CONFIG,
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
   editable, no coach approval gate. Médias stays DIRECT.

   ⚠️ CORRIGÉ le 2026-09-11 : Physique et Sport étaient encore déclarées
   SUGGEST/JAUNE alors qu'elles écrivent EN DIRECT depuis le 2026-09-09
   (submitSuggestion → ecrireChampAthlete). L'athlète voyait donc un crayon
   jaune, un libellé « Nouvelle valeur proposée » et un bouton jaune sur un
   champ qui s'enregistrait immédiatement. Un héritage de chrome, pas une
   intention — et exactement le genre d'écart que le code couleur existe
   pour rendre impossible.

   Évaluation (B-3a) is SUGGEST-dominant : athletes suggest cote +
   trait ratings + (B-3b) distinctions, all requiring coach approval
   via athlete_suggestions. The Rapport entraîneur sub-block is
   LOCKED (display-only, no champ), but the section chip stays YELLOW
   because suggest is the dominant action and the rapport is a small
   header block. The detailed-wins rule (see EvaluationStep below)
   ALSO gates whether "Cote globale" can be suggested at all — this
   is a UI-level mirror of the apply_approved_suggestion trigger's
   v_is_detailed guard. */
/* LE CODE COULEUR EST LA LOI — décision BP, 2026-09-11 (règle 11).
   La convention vit en tête de components/shared/wizard/modeIcons.tsx ;
   ces deux tableaux en sont l'application, étape par étape :
     0 Identité   MIXED  → VERT   (direct + quelques champs verrouillés)
     1 Académique DIRECT → VERT
     2 Physique   DIRECT → VERT   (était JAUNE à tort)
     3 Sport      DIRECT → VERT   (était JAUNE à tort)
     4 Médias     DIRECT → VERT
     5 Évaluation SUGGEST→ JAUNE  (cote, 14 traits, distinctions)
   Une seule étape propose. Toutes les autres écrivent. */
const STEP_MODES = ["MIXED", "DIRECT", "DIRECT", "DIRECT", "DIRECT", "SUGGEST"] as const;
const STEP_ACCENTS: (string | undefined)[] = [GREEN, GREEN, GREEN, GREEN, GREEN, YELLOW];

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
   ChampDirectExpand — inline-expanding suggest form (NO overlay).

   Mirrors the web's SuggestibleField expanded state at page.tsx :340-360
   verbatim : current value struck through, proposed-value input, optional
   message textarea, Soumettre / Annuler actions. Lives inline UNDER the
   row, not in a portal or sheet.

   Renders either a text input (InlineEditRow-style commit semantics) or
   a PickerRow + MobilePicker for choice fields — picked via the
   `inputType` prop.
═══════════════════════════════════════════════════════════════ */
interface ChampDirectExpandProps {
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
  /** Rend le MOTIF d'un refus, ou null si l'écriture est passée. */
  onSubmit: (proposed: string, message: string) => Promise<string | null>;
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

function ChampDirectExpand({
  champ, currentValue, initialProposed, inputType, wheelKind, pickerOptions, numericMode, placeholder,
  submitting, onSubmit, onCancel,
}: ChampDirectExpandProps) {
  const [proposed, setProposed] = useState(initialProposed);
  /* `message` survit en constante vide : la signature onSubmit le porte
     encore pour les appelants non migrés. Il n'a plus de champ ni de
     destination — le flux de proposition est mort. */
  const message = "";
  /* Le motif d'un refus vit ICI, pas chez le parent : il est propre à ce
     champ et il s'affiche juste dessous. Le faire descendre sur deux étages
     de props aurait élargi la surface pour un texte transitoire. */
  const [erreur, setErreur] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  /* ── Wheel state (inputType="wheel"). unitMode persists via the same
        key the coach wizard uses. Lazy init from localStorage is safe
        here : ChampDirectExpand only mounts on tap (client-only, post-
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
    <div className="px-4 py-3 bg-[#13151a] border-t border-[#22C55E]/20">
      {/* CÉRÉMONIE RETIRÉE le 2026-09-11. Il y avait ici « Actuel : … » barré
          et un libellé « NOUVELLE VALEUR PROPOSÉE ». Deux mensonges pour un
          champ qui s'écrit directement : rien n'est proposé, et la valeur
          courante est déjà visible sur la rangée juste au-dessus. Le champ
          s'ouvre, on saisit, on enregistre. */}
      {inputType === "text" ? (
        <input
          type="text"
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          autoFocus
          inputMode={numericMode}
          pattern={numericMode === "numeric" ? "[0-9]*" : undefined}
          aria-label={champ}
          className="w-full bg-[#111317] border border-white/[0.10] rounded-2xl px-4 py-3 text-[15px] text-white placeholder:text-white/40 outline-none focus:border-[#22C55E]/40"
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

      {/* Le champ « Message pour ton coach » est RETIRÉ avec le flux de
          proposition : il n'y a plus d'approbation à motiver, et le message
          n'était plus lu par personne. Un champ qui n'aboutit nulle part
          coûte un geste et ment sur ce qui se passe. */}

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={async () => { void triggerHaptic("Light"); setErreur(await onSubmit(trimmed, message)); }}
          className="flex-1 h-11 rounded-2xl bg-[#22C55E] text-[#0A2E16] text-[13px] font-bold uppercase tracking-wider active:bg-[#16A34A] disabled:opacity-40"
        >
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-4 rounded-2xl text-[12px] font-bold text-[#9CA3AF] active:bg-white/[0.04]"
        >
          Annuler
        </button>
      </div>
      {/* Le motif du refus, en toutes lettres. « Position introuvable pour ton
          sport » se corrige ; un échec muet laisse le jeune retaper la même
          chose. */}
      {erreur && (
        <p className="mt-2 text-[12px] leading-relaxed text-[#E63946]">{erreur}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ChampDirectRow — une rangée qui s'ÉCRIT, indicateur VERT.

   Elle s'appelait `SuggestRow` et portait le jaune, l'« En attente » et le
   vocabulaire de proposition. C'était vrai jusqu'au 2026-09-09 ; depuis,
   ces champs écrivent droit sur `athletes` (ecrireChampAthlete). Le nom et
   la couleur ont survécu à la décision — et c'est ainsi qu'un athlète a vu
   « NOUVELLE VALEUR PROPOSÉE » sur un champ déjà enregistré.

   Le nom dit maintenant le monde. Si un jour ces champs redeviennent des
   propositions, il faudra renommer — ce qui est précisément le garde-fou
   qui manquait.

   La branche « En attente » est RETIRÉE : une écriture directe ne crée
   aucune ligne athlete_suggestions, donc ce chemin ne pouvait plus
   s'atteindre. Le `pending` disparaît avec elle.
═══════════════════════════════════════════════════════════════ */
interface ChampDirectRowProps {
  label: string;
  value: string;
  champ: string;
  inputType: "text" | "picker" | "wheel";
  wheelKind?: "height" | "weight";
  pickerOptions?: PickerOption[];
  numericMode?: "numeric" | "decimal";
  /** Per-field placeholder for the text-input branch. Threaded to
   *  ChampDirectExpand. Omit to render no placeholder. */
  placeholder?: string;
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<string | null>;
  isLast?: boolean;
}

function ChampDirectRow({
  label, value, champ, inputType, wheelKind, pickerOptions, numericMode, placeholder,
  submitting, onSubmit, isLast,
}: ChampDirectRowProps) {
  const [expanded, setExpanded] = useState(false);

  // Rangée repliée — on tape pour ouvrir la saisie en place.
  return (
    <div>
      <button
        type="button"
        onClick={() => { void triggerHaptic("Light"); setExpanded(true); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/[0.04]"
        style={{ borderBottom: isLast && !expanded ? undefined : "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          <PencilIcon color={GREEN} size={12} />
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
        <ChampDirectExpand
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
            const motif = await onSubmit(champ, proposed, message, value);
            /* On ne referme QUE si l'écriture est passée : sur un refus, le
               champ reste ouvert avec sa valeur et son motif sous les yeux. */
            if (!motif) setExpanded(false);
            return motif;
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
  /* Échec d'une écriture DIRECTE (saveDirect). Avant 1.4.3 l'erreur était
     avalée : un refus de la base (RLS, trigger de périmètre) faisait
     revenir le champ à l'ancienne valeur au load(), sans un mot. */
  const [directError, setDirectError] = useState<string | null>(null);
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
      .select("id, champ, valeur_actuelle, valeur_proposee, status, message, raison_rejet, note_systeme, created_at")
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
        system_note: (s as { note_systeme?: string | null }).note_systeme ?? null,
      })));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  /* ── L'ÉTAT RÉEL, PAS L'ÉTAT ESPÉRÉ ──────────────────────────────────────
        Décision BP du 2026-09-12, après une recette perdue à chasser un
        fantôme. `getPending` ne rendait que les EN_ATTENTE — et il n'existe
        AUCUNE ligne EN_ATTENTE en base : le trigger de transition résout tout
        dans la transaction d'insertion (délai mesuré : 0.000000 s). La
        pastille était donc structurellement invisible, et l'athlète soumettait
        dans le noir.

        `derniereSuggestion` rend la PLUS RÉCENTE quel que soit son statut. La
        rangée affiche ce que le serveur dit — en attente, approuvée ou
        refusée. Le jour où le volet 6 de D6 laisse les évaluations en
        EN_ATTENTE, le même code se met à afficher « En attente » sans qu'on y
        retouche : c'est le statut qui change, pas l'écran. */
  const derniereSuggestion = useCallback((champ: string) => {
    const col = champToColumn(champ);
    /* `suggestions` arrive déjà trié created_at DESC (cf. load()), donc le
       premier trouvé est le plus récent. */
    return suggestions.find((s) =>
      s.field === champ || (col !== null && champToColumn(s.field) === col));
  }, [suggestions]);

  /* Le récapitulatif de l'étape Évaluation : uniquement les champs qui
     APPARTIENNENT à l'entraîneur. Les champs de profil s'écrivent en direct
     et n'ont produit de ligne que via l'ancien chemin — les mélanger ici
     ferait croire qu'ils attendent une approbation. */
  const suggestionsEvaluation = useMemo(
    () => suggestions.filter((s) => s.field === "Distinctions"
      || s.field === "Distinction personnalisée"
      || s.field === "Cote globale"
      || champToColumn(s.field) !== null).slice(0, 12),
    [suggestions],
  );

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
    const { error } = await supabase.from("athletes").update({ [column]: payload }).eq("id", a.id);
    if (error) {
      console.error(`[saveDirect] ${column}: ${erreurLisible(error)}`);
      setDirectError("Ta modification n'a pas été enregistrée. Réessaie dans un instant.");
    } else {
      setDirectError(null);
    }
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
  /* `_message` reste dans la SIGNATURE parce que les appelants le passent
     encore, mais il n'a plus de destination : le flux de proposition est
     mort, il n'y a plus de coach à qui écrire. Le `void` le dit à eslint
     sans le faire disparaître de la signature — le retirer obligerait à
     toucher chaque appelant pour un paramètre qui partira de lui-même au
     nettoyage de 1.4.2. */
  const submitSuggestion = useCallback(async (
    champ: string,
    proposed: string,
    _message: string,
    currentValue: string,
  ): Promise<string | null> => {
    if (!a) return "Profil indisponible.";
    /* Rien n'a changé : pas d'UPDATE, pas de rechargement. Le wizard
       rouvre souvent la même rangée sans rien modifier. */
    if (proposed === currentValue) return null;
    void _message;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "Session expirée — reconnecte-toi.";

      /* ── ÉDITION DIRECTE (décision BP, 2026-09-09) ──────────────────
         Ces champs ne passent plus par une proposition. L'écriture va
         droit sur `athletes`, par le même mapping que le moteur SQL —
         voir lib/athlete/champVersColonne.ts, qui cite le SQL qu'il
         reproduit.

         Ce qui existait avant, et pourquoi ça ne pouvait pas rester :
         le wizard insérait dans athlete_suggestions, et un TRIGGER DE
         TRANSITION approuvait aussitôt. La donnée arrivait donc bien —
         mais l'écran disait « envoyé à ton coach pour approbation »
         alors que la plateforme avait déjà tranché, et aucun coach ne
         voyait rien. Un mensonge, à des mineurs.

         Ce trigger est temporaire (retrait prévu 1.4.2). Tant qu'il est
         là, les deux chemins coexistent et DOIVENT écrire pareil. */
      const res = await ecrireChampAthlete(supabase, a.id, champ, proposed);
      if (!res.ok) return res.motif;

      await load();
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [a, load]);

  /* ── PROPOSITION D'ÉVALUATION — le SECOND chemin, et il est distinct ──────
        `submitSuggestion` ci-dessus écrit EN DIRECT sur `athletes` : c'est le
        régime des champs de profil (Physique / Sport / Médias), décidé le
        2026-09-09, et il ne change pas.

        La cote, les 14 traits et les distinctions n'appartiennent pas à
        l'athlète : ils se PROPOSENT. Ce chemin-ci insère donc une vraie ligne
        `athlete_suggestions` en EN_ATTENTE, destinée à la boîte du coach
        (/coach/a-traiter) — exactement ce que font déjà le web
        (athlete/profil) et le binaire iOS 1.4. Android rejoint la parité.

        ⚠️ `champ` est écrit À L'IDENTIQUE de ce qu'attend
        `apply_approved_suggestion` : libellé français exact pour la cote et
        les distinctions, NOM DE COLONNE pour les 14 traits (découplage
        libellé/clé du lot 3 — le libellé affiché vient de la grille de
        position, il n'est donc PAS une clé stable). */
  const proposerEvaluation = useCallback(async (
    champ: string,
    valeurProposee: string,
    valeurActuelle: string,
  ): Promise<string | null> => {
    if (!a) return "Profil indisponible.";
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "Session expirée — reconnecte-toi.";

      /* coach_id : on préfère la valeur déjà chargée, sinon relecture. La
         colonne est un INSTANTANÉ du destinataire au moment du dépôt ; la
         boîte du coach, elle, joint sur athletes.coach_id. */
      let coachId: string | null = a.coachId;
      if (!coachId) {
        const { data: row } = await supabase
          .from("athletes").select("coach_id").eq("id", a.id).maybeSingle();
        coachId = (row?.coach_id as string) || null;
      }

      const { error } = await supabase.from("athlete_suggestions").insert({
        athlete_id: a.id,
        submitted_by: user.id,
        coach_id: coachId,
        champ,
        valeur_actuelle: valeurActuelle,
        valeur_proposee: valeurProposee,
        status: "EN_ATTENTE",
      });
      if (error) {
        console.error(`[AthleteEditWizard] proposition: ${error.code ?? ""} ${error.message}`);
        return error.message;
      }

      await load();
      return null;
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
        {directError && (
          <div role="alert" className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">
            {directError}
          </div>
        )}

        {/* ── Step 0 : Identité (MIXED — 4 DIRECT + 6 LOCKED) ── */}
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
        {step === 2 && <PhysiqueStep a={a} submitting={submitting} onSubmit={submitSuggestion} />}

        {/* ── Step 3 : Sport (SUGGEST — B-2 wired) ── */}
        {step === 3 && (
          <SportStep
            a={a}
            sportsOptions={sportsOptions}
            positionsOptions={positionsOptions}
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
            derniereSuggestion={derniereSuggestion}
            suggestionsEvaluation={suggestionsEvaluation}
            onRejoindreEquipe={() => router.push("/athlete/transfert")}
            submitting={submitting}
            onPropose={proposerEvaluation}
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
   IDENTITÉ step — MIXED : 4 DIRECT + 6 LOCKED.

   Mirrors web page.tsx :1511-1533 post-conversion :
     - DIRECT (green pencil) : Prénom (first_name), Nom (last_name),
       Genre (genre via picker), Téléphone (telephone). Each writes
       immediately via saveDirect to the matching athletes column.
     - LOCKED (red lock) : Date de naissance — protégée après
       l'onboarding (trigger de périmètre, migration 20260921173234 ;
       registre §30), même renvoi courriel que le web —, Âge
       (recomputed from date_naissance, no column of its own), Ville (schools.city via FK
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
          <ReadOnlyRow label="Date de naissance" value={a.dateNaissance} />
        </LockedIndicatorRow>
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
      <p className="px-1 text-[12px] leading-relaxed text-white/55">
        Pour corriger ta date de naissance, écris à{" "}
        <a href="mailto:info@nexussports.ca?subject=Correction%20de%20date%20de%20naissance" className="text-[#E63946] underline underline-offset-2">info@nexussports.ca</a>.
      </p>
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
/* `getPending` a disparu de la signature avec la branche « En attente » des
   rangées directes : ces champs s'écrivent, ils n'attendent rien. Une prop
   d'attente sur un écran qui n'attend pas invite le prochain à s'en servir. */
function SportStep({
  a, sportsOptions, positionsOptions, submitting, onSubmit, saveDirect,
}: {
  a: LoadedAthlete;
  sportsOptions: SportOption[];
  positionsOptions: PositionOption[];
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<string | null>;
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
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Sport
        </p>
        <PencilIcon color={GREEN} size={12} />
      </div>
      <p className="text-[12px] text-white/55 px-1">
        Tes modifications sont enregistrées tout de suite.
      </p>
      <Card>
        <ChampDirectRow
          label="Sport principal"
          value={a.primarySport}
          champ="Sport principal"
          inputType="picker"
          pickerOptions={sportPickerOptions}
          submitting={submitting}
          onSubmit={onSubmit}
        />
        <ChampDirectRow
          label="Position principale"
          value={a.primaryPosition}
          champ="Position"
          inputType="picker"
          pickerOptions={primaryPositionOptions}
          submitting={submitting}
          onSubmit={onSubmit}
        />
        <ChampDirectRow
          label="Numéro"
          value={a.jerseyNumber}
          champ="Numéro"
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
  a, submitting, onSubmit,
}: {
  a: LoadedAthlete;
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<string | null>;
}) {
  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
            Physique
          </p>
          <PencilIcon color={GREEN} size={12} />
        </div>
        <p className="text-[12px] text-white/55 mb-3 px-1">
          Tes modifications sont enregistrées tout de suite.
        </p>
        <Card>
          <ChampDirectRow label="Taille"          value={a.heightDisplay}   champ="Taille"          inputType="wheel" wheelKind="height" submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Poids"           value={a.weightDisplay}   champ="Poids"           inputType="wheel" wheelKind="weight" submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Envergure"       value={a.wingspan}        champ="Envergure"       inputType="text" placeholder="Ex: 78&quot;"    submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Main dominante"  value={a.dominantHand}    champ="Main dominante"  inputType="picker" pickerOptions={HAND_OPTIONS} submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Pied dominant"   value={a.dominantFoot}    champ="Pied dominant"   inputType="picker" pickerOptions={FOOT_OPTIONS} submitting={submitting} onSubmit={onSubmit} isLast />
        </Card>
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/45 mb-2 px-1">
          Tests athlétiques
        </p>
        <Card>
          <ChampDirectRow label="40 verges"        value={a.fortyYard}      champ="40 yards"         inputType="text" placeholder="Ex: 4.72s"     submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Saut vertical"    value={a.verticalJump}   champ="Saut vertical"    inputType="text" placeholder="Ex: 32&quot;"   submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Saut en longueur" value={a.broadJump}      champ="Saut longueur"    inputType="text" placeholder="Ex: 9'2&quot;"  submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Développé couché" value={a.benchPress}     champ="Développé couché" inputType="text" placeholder="Ex: 225 × 8"   submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Navette"          value={a.shuttleAgility} champ="Navette"          inputType="text" placeholder="Ex: 4.31s"     submitting={submitting} onSubmit={onSubmit} />
          <ChampDirectRow label="Sprint 100m"      value={a.sprint100m}     champ="Sprint 100m"      inputType="text" placeholder="Ex: 10.9s"     submitting={submitting} onSubmit={onSubmit} isLast />
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
/* PROPOSITION, PAS ÉCRITURE — et c'est toute la différence avec les autres
   étapes. Physique / Sport / Médias écrivent en direct sur `athletes` ; ici
   l'athlète PROPOSE et l'entraîneur tranche. `onPropose` insère donc une
   ligne `athlete_suggestions` en EN_ATTENTE, jamais un UPDATE.

   Parité assumée avec les deux autres clients : le web (athlete/profil,
   EvaluationSuggest) et le binaire iOS 1.4 offrent exactement ce geste. */
function EvaluationStep({
  a, groups, derniereSuggestion, suggestionsEvaluation, onRejoindreEquipe, submitting, onPropose,
}: {
  a: LoadedAthlete;
  /** Les 2 groupes (9 / 5), libellés résolus par la grille de l'athlète. */
  groups: { title: string; traits: TraitEntry[] }[];
  derniereSuggestion: (champ: string) => AthleteSuggestion | undefined;
  suggestionsEvaluation: AthleteSuggestion[];
  /** Le geste qui débloque tout quand il n'y a pas d'entraîneur : le code
   *  d'équipe, déjà en place sur /athlete/transfert (MonEquipeSection). */
  onRejoindreEquipe: () => void;
  submitting: boolean;
  onPropose: (champ: string, valeurProposee: string, valeurActuelle: string) => Promise<string | null>;
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

  /* Le prochain pas du jeune dépend d'UNE question : quelqu'un peut-il lire sa
     proposition ? Sans entraîneur rattaché, elle attendra indéfiniment — et lui
     dire « en attente d'approbation » serait lui promettre un lecteur qui
     n'existe pas. On lui dit d'aller en chercher un. */
  const aUnCoach = !!a.coachId;

  return (
    <div className="space-y-4">
      {/* ÉVALUATION — L'ÉTAPE OÙ L'ATHLÈTE PROPOSE.

          La cote, les 14 traits et les distinctions restent la propriété de
          l'entraîneur : c'est ce qui leur donne leur valeur auprès des
          recruteurs. Mais l'athlète peut les PROPOSER, et c'est ce que font
          déjà le web et iOS 1.4 — Android rattrape la parité.

          Le texte dit exactement ce qui se passe : une soumission, pas un
          enregistrement. Même formulation que le web. */}
      <div className="flex items-center gap-2 px-1">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">
          Évaluation
        </p>
        <PencilIcon color={YELLOW} size={12} />
      </div>

      {/* L'ENCART QUI DIT LE MONDE.
          C'était une ligne de texte gris parmi d'autres — donc invisible, et
          l'athlète découvrait la règle au moment du refus. Ici c'est une
          carte teintée : elle se lit AVANT le premier geste, et sa couleur
          est celle des trois rangées en dessous. Le jaune n'est pas un
          ornement, c'est la même information que le crayon.

          Même anatomie que les cartes d'état du design system (Card + pile
          d'icône ronde + titre/corps) — cf. la carte « Mode démo » du
          pipeline recruteur. */}
      <Card>
        <div className="px-4 py-3.5 flex items-start gap-3 bg-[#EAB308]/[0.06] border-l-2 border-[#EAB308]/50">
          <span
            aria-hidden
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[15px] bg-[#EAB308]/15 border border-[#EAB308]/25"
          >
            ⏳
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#EAB308] leading-snug">
              {aUnCoach ? "Cette section se propose" : "Il te manque un entraîneur"}
            </p>
            {/* Le même écran, deux situations. Avec un entraîneur, on décrit ce
                qui va se passer. Sans, on décrit ce qu'il reste à faire — parce
                que promettre une approbation à qui n'a personne pour approuver,
                c'est la définition du mensonge qu'on vient de retirer deux fois. */}
            <p className="text-[12px] leading-relaxed text-white/60 mt-0.5">
              {aUnCoach
                ? "Modifications soumises à ton entraîneur pour approbation."
                : "Tu peux proposer ton évaluation dès maintenant — elle attendra qu'un entraîneur rejoigne ton profil pour être approuvée."}
            </p>
            {!aUnCoach && (
              <button
                type="button"
                onClick={() => { void triggerHaptic("Light"); onRejoindreEquipe(); }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold bg-[#EAB308]/15 border border-[#EAB308]/30 text-[#EAB308] active:bg-[#EAB308]/25"
              >
                Rejoindre mon équipe
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </Card>

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
            {/* Demi-étoiles ici, et ici SEULEMENT : la cote plate accepte
                4.5 ; les 14 traits sont des entiers (cast ::int côté
                trigger). `valeur_proposee` part donc en toFixed(1). */}
            <StarSuggestRow
              label="Cote du coach"
              currentValue={a.overallRating}
              champ="Cote globale"
              allowHalf
              starSize={26}
              suggestion={derniereSuggestion("Cote globale")}
              aUnCoach={aUnCoach}
              submitting={submitting}
              onSubmit={async (proposed) => {
                await onPropose("Cote globale", proposed.toFixed(1), a.overallRating > 0 ? a.overallRating.toFixed(1) : "");
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
            the trigger ::int cast for those 14 columns.

            ⚠️ PLUS DE GARDE `isDetailedMode` ICI — décision BP, 2026-09-12.
            La grille ne s'affichait que si au moins un trait était DÉJÀ noté
            par l'entraîneur. Autrement dit : « tu ne peux proposer une note
            que si on t'en a déjà mis une ». Pour tout nouvel inscrit — donc
            pour ceux qui en ont le plus besoin — les 14 traits étaient
            invisibles et impossibles à proposer.

            La règle devient : PROPOSER NE PRÉSUPPOSE PAS D'AVOIR ÉTÉ NOTÉ.

            Ce qui ne change PAS : la LECTURE. Un trait jamais noté rend « — »
            dans StarSuggestRow, jamais cinq étoiles vides — une note absente
            n'est pas une note de zéro. C'est le GESTE qui s'ouvre, pas
            l'affichage qui invente une valeur.

            `isDetailedMode` sert encore juste au-dessus, pour la cote : elle
            reste le miroir client de la garde `v_is_detailed` du trigger, qui
            refuse d'appliquer une cote plate quand l'évaluation détaillée est
            active. Cette garde-là est critique et ne bouge pas. */}
      {(
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
                    starSize={24}
                    suggestion={derniereSuggestion(t.column)}
                    aUnCoach={aUnCoach}
                    submitting={submitting}
                    onSubmit={async (proposed) => {
                      /* Même valeur = pas de ligne. Le trigger l'appliquerait
                         sans dommage, mais elle encombrerait la boîte du
                         coach pour un changement qui n'en est pas un. */
                      if (proposed === current) return;
                      await onPropose(t.column, String(proposed), current > 0 ? String(current) : "");
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
                    starSize={24}
                    suggestion={derniereSuggestion(t.column)}
                    aUnCoach={aUnCoach}
                    submitting={submitting}
                    onSubmit={async (proposed) => {
                      if (proposed === current) return;
                      await onPropose(t.column, String(proposed), current > 0 ? String(current) : "");
                    }}
                    isLast={i === TACTICAL_TRAITS.length - 1}
                  />
                );
              })}
            </Card>
          </div>
        </>
      )}

      {/* ── Distinctions — PROPOSABLES ──────────────────────────
            Les plafonds (« plafond atteint ») et l'exclusion mutuelle
            (« déjà attribué par quelqu'un d'autre ») ne sont PAS ici : elles
            vivent dans BadgePicker, partagé avec le web et iOS. C'est
            pourquoi la parité de comportement est acquise sans la
            réimplémenter — et pourquoi il ne faut surtout pas la dupliquer
            ici le jour où une règle changera. */}
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45 mb-2 px-1">
          Distinctions
        </p>
        <Card>
          <DistinctionsSuggestRow
            athleteId={a.id}
            sportId={a.sportId}
            sportNom={a.primarySport || null}
            currentDistinctions={a.coachDistinctions}
            suggestion={derniereSuggestion("Distinctions")}
            aUnCoach={aUnCoach}
            submitting={submitting}
            onSubmit={async (entries) => {
              /* Une SEULE ligne pour tout le jeu de badges, sérialisée en
                 JSON — la forme qu'attend le `::jsonb` du trigger, et celle
                 que le web envoie déjà. Un badge par ligne casserait
                 l'approbation côté coach. */
              await onPropose("Distinctions", JSON.stringify(entries), "");
            }}
          />
        </Card>
      </div>

      {/* ── MES PROPOSITIONS — le journal, pas la promesse ────────────────
            Port du panneau « Mes suggestions » du web (athlete/profil
            :1980-2026), en liste unique plutôt qu'en trois onglets : sur un
            écran de 411 px, trois onglets pour douze lignes coûtent un geste
            de plus qu'ils n'en économisent. Le statut est porté par la
            pastille de chaque ligne, donc l'information est la même.

            Il vit ICI, en bas de l'étape, et pas ailleurs : c'est la seule
            étape dont les gestes attendent une décision de quelqu'un d'autre.
            Les champs de profil s'écrivent — ils n'ont rien à journaliser. */}
      {suggestionsEvaluation.length > 0 && (
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/45 mb-2 px-1">
            Mes propositions
          </p>
          <Card>
            <div className="divide-y divide-white/[0.06]">
              {suggestionsEvaluation.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[13px] font-semibold text-white/85 min-w-0 truncate">
                      {libelleChampProposition(s.field, groups)}
                    </span>
                    <span className="shrink-0"><PastilleStatut s={s} aUnCoach={aUnCoach} /></span>
                  </div>
                  <p className="mt-1 text-[12px] text-white/55 break-words">
                    {s.field === "Distinctions"
                      ? (badgesProposes(s.proposed_value).join(" · ") || s.proposed_value)
                      : <>
                          {s.current_value ? <span className="line-through text-white/30">{s.current_value}</span> : null}
                          {s.current_value ? " → " : null}
                          <span className="font-bold text-white/85">{s.proposed_value}</span>
                        </>}
                  </p>
                  {motifHumain(s) && (
                    <p className="mt-1 text-[11px] leading-relaxed text-[#E63946]/85">
                      {motifHumain(s)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Le libellé LISIBLE d'un champ proposé. `field` porte un nom de colonne
 *  depuis le découplage du lot 3 (`esprit_equipe`), ou un libellé français
 *  pour les lignes déposées par les clients plus anciens. On rend celui de
 *  la grille de l'athlète quand on le retrouve, sinon la valeur telle quelle
 *  — jamais une colonne brute présentée comme du français. */
function libelleChampProposition(
  field: string,
  groups: { title: string; traits: TraitEntry[] }[],
): string {
  const col = champToColumn(field);
  if (col) {
    const t = groups.flatMap((g) => g.traits).find((x) => x.column === col);
    if (t) return t.label;
  }
  return field;
}

/* ── RESTAURÉ le 2026-09-11 depuis eb52329^ / 0b6e05b^ ────────────────────
   Ces deux composants avaient été retirés la veille au motif que le trigger
   de transition rejetait leurs propositions. Le motif était exact — il l'est
   encore — mais la conclusion était fausse : le web et le binaire iOS 1.4
   offrent ce geste EN PRODUCTION, les utilisateurs s'en servent, et Android
   était le seul client à ne pas l'avoir. La parité passe avant.

   Le rejet automatique tombe avec le volet 6 de la migration D6
   (docs/d6-volet6-suggestion-evaluation.sql). D'ici là, les trois clients se
   comportent pareil — ce qui est la condition pour que le correctif serveur
   les répare tous les trois d'un coup.
   ──────────────────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════
   PastilleStatut — ce que le SERVEUR dit de la dernière proposition.

   Une seule pastille pour les trois rangées de l'étape Évaluation, alignée
   sur le panneau « Mes suggestions » du web (athlete/profil :1987-2020) :
   jaune en attente, vert approuvé, rouge refusé.

   ⚠️ AUCUN de ces trois états n'est deviné côté client. C'est la leçon de la
   recette du 2026-09-12 : la version précédente n'affichait que EN_ATTENTE,
   un état qu'aucune ligne n'atteint aujourd'hui — donc rien ne s'affichait
   jamais, et l'athlète soumettait dans le noir.
═══════════════════════════════════════════════════════════════ */
function PastilleStatut({ s, valeur, aUnCoach }: {
  s: AthleteSuggestion;
  valeur?: string;
  /** L'athlète a-t-il un entraîneur rattaché ? Décide du PROCHAIN PAS montré. */
  aUnCoach: boolean;
}) {
  /* ── UN REFUS MACHINE N'EST PAS UN REFUS ────────────────────────────────
     `system_note` est posé par le trigger de transition, jamais par un
     humain. Tant que le volet 6 de D6 n'est pas appliqué, TOUTE proposition
     d'évaluation est rejetée à l'insertion — annoncer « Refusée » ferait
     croire au jeune que son entraîneur l'a recalé, alors que personne n'a
     rien lu. On montre donc l'attente, c'est-à-dire la vérité de sa
     situation : ça n'a pas encore été regardé.

     Le rouge reste pour les VRAIS refus, ceux qu'un entraîneur prononce —
     ils n'ont pas de note_systeme, et leur motif est un message humain, donc
     affichable. */
  const refusMachine = s.status === "rejected" && !!s.system_note;
  const enAttente = s.status === "pending" || refusMachine;

  /* L'état décrit SON PROCHAIN PAS, jamais l'architecture (règle 11).
     Sans entraîneur, le prochain pas n'est pas d'attendre — c'est d'aller
     en chercher un. */
  const texte = enAttente
    ? (aUnCoach
        ? "⏳ En attente d'approbation du coach"
        : "⏳ Invite ton coach pour qu'il approuve cette évaluation")
    : s.status === "approved"
      ? "✓ Approuvée"
      : "✕ Refusée";

  const skin = enAttente
    ? { bord: "#EAB308", fond: "rgba(234,179,8,0.10)" }
    : s.status === "approved"
      ? { bord: "#22C55E", fond: "rgba(34,197,94,0.10)" }
      : { bord: "#E63946", fond: "rgba(230,57,70,0.10)" };

  return (
    <span
      className="inline-block text-[11px] font-bold rounded-full px-2 py-0.5 leading-snug"
      style={{ color: skin.bord, background: skin.fond, border: `1px solid ${skin.bord}40` }}
    >
      {texte}{valeur ? ` · ${valeur}` : ""}
    </span>
  );
}

/** Un vrai refus d'entraîneur — donc un motif ÉCRIT PAR UN HUMAIN, qu'on peut
 *  montrer. Le motif d'un refus machine, lui, ne s'affiche jamais : c'est de
 *  l'architecture, et l'architecture ne s'adresse pas au jeune. */
function motifHumain(s: AthleteSuggestion): string | null {
  if (s.status !== "rejected" || s.system_note) return null;
  return s.rejection_reason ?? null;
}

/* ═══════════════════════════════════════════════════════════════
   StarSuggestRow — parallel to SuggestRow but with a StarRow input
   body (no text/picker overlap with ChampDirectExpand). Owns its own
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
  label, currentValue, champ, allowHalf, starSize, suggestion, aUnCoach, submitting, onSubmit, isLast,
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
  /** La DERNIÈRE proposition sur ce champ, quel que soit son statut. */
  suggestion: AthleteSuggestion | undefined;
  aUnCoach: boolean;
  submitting: boolean;
  /** Called with the validated `proposed` number (always > 0). The
   *  caller does the stringify (String(int) for traits, toFixed(1)
   *  for cote) inside its own onSubmit closure. */
  onSubmit: (proposed: number) => Promise<void>;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(0);

  /* Surface repliée — crayon jaune, valeur COURANTE, puis l'état réel de la
     dernière proposition s'il y en a une. */
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
            {/* Un trait JAMAIS noté rend « — », pas cinq étoiles vides : une
                note absente n'est pas une note de zéro. La LECTURE ne ment
                pas ; c'est le geste de proposition, lui, qui reste ouvert. */}
            {currentValue > 0
              ? <StarRow value={currentValue} onChange={() => { /* read-only */ }} size={starSize > 24 ? 18 : 16} />
              : <span className="text-[13px] text-white/35">—</span>}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
        {suggestion && (
          <div className="px-4 pb-3 -mt-1">
            <PastilleStatut s={suggestion} valeur={`${suggestion.proposed_value}/5`} aUnCoach={aUnCoach} />
            {motifHumain(suggestion) && (
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                {motifHumain(suggestion)}
              </p>
            )}
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
/** Les libellés des badges d'une proposition de distinctions, relus depuis
 *  la valeur déposée. Rend une liste VIDE sur tout format inattendu : une
 *  pastille sans détail reste correcte, une exception casserait l'étape. */
function badgesProposes(valeur: string | null | undefined): string[] {
  if (!valeur) return [];
  try {
    const brut: unknown = JSON.parse(valeur);
    if (!Array.isArray(brut)) return [];
    return brut.flatMap((e) => {
      if (typeof e !== "object" || e === null) return [];
      const { badge, detail } = e as { badge?: unknown; detail?: unknown };
      if (typeof badge !== "string") return [];
      const cfg = BADGE_CONFIG[badge];
      const d = typeof detail === "string" ? detail.trim() : "";
      if (badge === "custom") return [d || "Personnalisée"];
      const base = cfg?.label ?? badge;
      return [d ? `${base} — ${d}` : base];
    });
  } catch {
    return [];
  }
}

function DistinctionsSuggestRow({
  athleteId, sportId, sportNom, currentDistinctions, suggestion, aUnCoach, submitting, onSubmit,
}: {
  athleteId: string | null;
  sportId: string | null;
  sportNom: string | null;
  currentDistinctions: DistinctionEntry[];
  suggestion: AthleteSuggestion | undefined;
  aUnCoach: boolean;
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
        {/* `ouvrir()` REFUSE de déplier quand la lecture des badges échoue —
            ouvrir sur une liste vide proposerait de tout retirer. Mais sans
            ce message, l'athlète appuyait et il ne se passait RIEN : un bouton
            mort, sans explication. La variable existait déjà et n'était pas
            rendue ; la rendre coûte deux lignes. */}
        {erreur && (
          <p className="px-4 pb-2 text-[12px] leading-relaxed text-[#E63946]">
            Impossible d&apos;ouvrir les distinctions : {erreur}
          </p>
        )}
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
        {/* EN ATTENTE — on liste ce qui a été proposé, pas juste « il y a
            quelque chose ». La pastille seule obligeait à rouvrir la rangée
            pour savoir ce qu'on avait demandé, et ce qu'on y voyait était le
            brouillon rechargé depuis la base, pas la proposition.

            `proposed_value` est le JSON envoyé au dépôt. Il est reparsé ici :
            si le format devait changer un jour, la liste disparaît au lieu de
            planter — d'où le try/catch et le repli sur la pastille nue. */}
        {suggestion && (
          <div className="px-4 pb-3 -mt-1 flex flex-wrap items-center gap-1.5">
            <PastilleStatut s={suggestion} aUnCoach={aUnCoach} />
            {badgesProposes(suggestion.proposed_value).map((lib, i) => (
              <span
                key={`${lib}-${i}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.05] border border-white/[0.08] text-white/70"
              >
                {lib}
              </span>
            ))}
            {motifHumain(suggestion) && (
              <p className="w-full mt-0.5 text-[11px] leading-relaxed text-white/45">
                {motifHumain(suggestion)}
              </p>
            )}
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

      {/* `entreesIncompletes` était calculée et jamais lue : un badge dont le
          détail est obligatoire (titre d'une distinction personnalisée, par
          ex.) partait quand même, et arrivait chez l'entraîneur sans son
          libellé. Elle garde maintenant le bouton, et le dit. */}
      {incomplets.length > 0 && (
        <p className="mt-2 text-[12px] leading-relaxed text-[#EAB308]">
          Complète {incomplets.length === 1 ? "le libellé manquant" : `les ${incomplets.length} libellés manquants`} avant de soumettre.
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-3 pb-2">
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); submit(); }}
          disabled={submitting || incomplets.length > 0}
          className="px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors bg-[#EAB308] text-[#111317] active:bg-[#D4A20A] disabled:opacity-40 disabled:bg-white/[0.06] disabled:text-white/40"
        >
          {submitting ? "..." : "Soumettre"}
        </button>
      </div>
    </div>
  );
}
