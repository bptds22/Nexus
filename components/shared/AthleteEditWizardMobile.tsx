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
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AthleteSuggestion } from "@/lib/types/models";
import { Card, InlineEditRow, PickerRow, ReadOnlyRow } from "@/components/shared/wizard/rows";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import { WizardPills } from "@/components/shared/wizard/WizardPills";
import { GREEN, YELLOW, RED, PencilIcon, LockIcon } from "@/components/shared/wizard/modeIcons";

/* ═══════════════════════════════════════════════════════════════
   Loaded athlete shape — narrowed to the fields B-1 actually reads.
   Other fields (academic, sport, eval) are not consumed in B-1 ;
   B-2/B-3 will widen this interface as those sections come online.
═══════════════════════════════════════════════════════════════ */
interface LoadedAthlete {
  id: string;
  /** Resolved coach FK ; used for athlete_suggestions.coach_id. */
  coachId: string | null;
  firstName: string;
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
  /* ── Civil/école derivation (deferred render to B-2 Identité) ── */
  isCivil: boolean;
  schoolName: string;
  teamName: string | undefined;
  leagueName: string | undefined;
  /** Cached _raw row for valeur_actuelle lookup at suggest time
   *  (mirrors page.tsx submitSuggestion's a._raw read). */
  raw: Record<string, unknown>;
}

const STEP_LABELS = ["Identité", "Académique", "Physique", "Sport", "Médias"] as const;
const STEP_MODES = ["LOCKED", "LOCKED", "SUGGEST", "SUGGEST", "DIRECT"] as const;
const STEP_ACCENTS: (string | undefined)[] = [RED, RED, YELLOW, YELLOW, GREEN];

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
  inputType: "text" | "picker";
  pickerOptions?: PickerOption[];
  numericMode?: "numeric" | "decimal";
  submitting: boolean;
  onSubmit: (proposed: string, message: string) => Promise<void>;
  onCancel: () => void;
}

function SuggestExpand({
  champ, currentValue, initialProposed, inputType, pickerOptions, numericMode,
  submitting, onSubmit, onCancel,
}: SuggestExpandProps) {
  const [proposed, setProposed] = useState(initialProposed);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

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
          placeholder="Ex: 6'2&quot;"
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
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
          onClick={() => onSubmit(trimmed, message)}
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
  inputType: "text" | "picker";
  pickerOptions?: PickerOption[];
  numericMode?: "numeric" | "decimal";
  submitting: boolean;
  onSubmit: (champ: string, proposed: string, message: string, currentValue: string) => Promise<void>;
  isLast?: boolean;
}

function SuggestRow({
  label, value, champ, pending, inputType, pickerOptions, numericMode,
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
        onClick={() => setExpanded(true)}
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
          pickerOptions={pickerOptions}
          numericMode={numericMode}
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
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Show Médias by default (step 4) — Sprint B-1's most useful real
  // content. User can navigate back to Physique via the pill chrome.
  // (Other steps render a placeholder this sprint.)
  useEffect(() => { setStep(4); }, []);

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
        positions!position_id(nom, abreviation),
        schools!school_id(name, region, city, type),
        team_athletes(team_id, teams!team_id(name)),
        evaluations(vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination, vision_du_jeu, sens_tactique, leadership, discipline, coachabilite, intelligence_jeu, competitivite, esprit_equipe, resilience, attitude_mentalite, cote_globale, rapport_entraineur, distinctions),
        users!athletes_coach_id_fkey(first_name, last_name)
      `)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!raw) return;

    // Civil / école derivation (verbatim from page.tsx :971-974).
    // Used in B-2 Identité ; derived now so the state shape is ready.
    const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
    const taRel = Array.isArray(raw.team_athletes) ? raw.team_athletes[0] : raw.team_athletes;
    const teamRelRaw = (taRel as { teams?: unknown } | null)?.teams;
    const teamRel = (Array.isArray(teamRelRaw) ? teamRelRaw[0] : teamRelRaw) as { name?: string } | null;
    const schoolType = (schoolRel as { type?: string } | null)?.type;
    const isCivil = !raw.school_id || schoolType === "LIGUE_CIVILE";
    const schoolName = isCivil ? "" : (schoolRel?.name || "");
    const teamName = isCivil ? teamRel?.name : undefined;
    const leagueName = isCivil && !teamRel?.name ? "Ligue Civile" : undefined;

    const heightDisplay = raw.taille_pieds
      ? `${raw.taille_pieds}'${raw.taille_pouces || 0}"`
      : "";
    const weightDisplay = raw.poids_lbs ? `${raw.poids_lbs} lbs` : "";

    setA({
      id: raw.id as string,
      coachId: (raw.coach_id as string) || null,
      firstName: (raw.first_name as string) || "",
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
      highlightVideoUrl: (raw.video_faits_saillants_url as string) || "",
      fullGameUrl: (raw.video_match_complet_url as string) || "",
      hudlUrl: (raw.hudl_url as string) || "",
      youtubeUrl: (raw.youtube_url as string) || "",
      instagramUrl: (raw.instagram_url as string) || "",
      isCivil,
      schoolName,
      teamName,
      leagueName,
      raw: raw as Record<string, unknown>,
    });

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
  const getPending = useCallback((champ: string) => pendingSugs.find((s) => s.field === champ), [pendingSugs]);

  /* ── DIRECT save (Médias) — verbatim from page.tsx :1224-1236.
        UPDATE athletes set col=value where id=athleteId. Same dbMap
        keys → columns. */
  const saveDirect = useCallback(async (column: string, value: string) => {
    if (!a) return;
    const supabase = createClient();
    await supabase.from("athletes").update({ [column]: value || null }).eq("id", a.id);
    await load();
  }, [a, load]);

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
      <div className="min-h-screen bg-[#111317] flex items-center justify-center">
        <p className="text-[13px] text-[#9CA3AF]">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317]" style={{ overflowY: "auto", height: "100dvh" }}>
      <WizardPills
        labels={[...STEP_LABELS]}
        active={step}
        onSelect={setStep}
        accentColors={STEP_ACCENTS}
        eyebrow="Étape"
        title={a.firstName ? `Mon profil — ${a.firstName}` : "Mon profil"}
        onBack={() => router.back()}
      />

      <div className="px-4 pt-4 pb-32 space-y-5">
        {/* ── Step 0 : Identité (LOCKED, deferred to B-2) ── */}
        {step === 0 && (
          <DeferredStepPlaceholder
            heading="Identité"
            mode="LOCKED"
            description="Section verrouillée — ton coach gère ces informations. Affichage complet en Sprint B-2."
          />
        )}

        {/* ── Step 1 : Académique (deferred to B-2) ── */}
        {step === 1 && (
          <DeferredStepPlaceholder
            heading="Académique"
            mode="LOCKED"
            description="Profil académique en lecture seule sur le web. Affichage complet en Sprint B-2."
          />
        )}

        {/* ── Step 2 : Physique (SUGGEST) ── */}
        {step === 2 && <PhysiqueStep a={a} getPending={getPending} submitting={submitting} onSubmit={submitSuggestion} />}

        {/* ── Step 3 : Sport (deferred to B-2) ── */}
        {step === 3 && (
          <DeferredStepPlaceholder
            heading="Sport"
            mode="SUGGEST"
            description="Sport principal, position, numéro — Sprint B-2."
          />
        )}

        {/* ── Step 4 : Médias (DIRECT) ── */}
        {step === 4 && <MediasStep a={a} onDirect={saveDirect} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DeferredStepPlaceholder — small visual stub for steps B-1 doesn't
   wire yet. Renders the mode indicator + a "à venir" copy so the
   wizard feels coherent end-to-end.
═══════════════════════════════════════════════════════════════ */
function DeferredStepPlaceholder({
  heading, mode, description,
}: {
  heading: string;
  mode: "DIRECT" | "SUGGEST" | "LOCKED";
  description: string;
}) {
  const color = mode === "DIRECT" ? GREEN : mode === "SUGGEST" ? YELLOW : RED;
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2 px-1" style={{ color }}>
        {heading} · {mode}
      </p>
      <Card>
        <div className="px-4 py-5 flex items-start gap-3">
          {mode === "LOCKED" ? <LockIcon size={16} /> : <PencilIcon color={color} size={16} />}
          <p className="text-[13px] text-white/70 leading-relaxed">{description}</p>
        </div>
      </Card>
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
          <SuggestRow label="Taille"          value={a.heightDisplay}   champ="Taille"          pending={getPending("Taille")}          inputType="text" numericMode="numeric" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Poids"           value={a.weightDisplay}   champ="Poids"           pending={getPending("Poids")}           inputType="text" numericMode="decimal" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Envergure"       value={a.wingspan}        champ="Envergure"       pending={getPending("Envergure")}       inputType="text" numericMode="numeric" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Main dominante"  value={a.dominantHand}    champ="Main dominante"  pending={getPending("Main dominante")}  inputType="picker" pickerOptions={HAND_OPTIONS} submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Pied dominant"   value={a.dominantFoot}    champ="Pied dominant"   pending={getPending("Pied dominant")}   inputType="picker" pickerOptions={FOOT_OPTIONS} submitting={submitting} onSubmit={onSubmit} isLast />
        </Card>
      </div>

      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/45 mb-2 px-1">
          Tests athlétiques
        </p>
        <Card>
          <SuggestRow label="40 verges"        value={a.fortyYard}      champ="40 yards"         pending={getPending("40 yards")}         inputType="text" numericMode="decimal" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Saut vertical"    value={a.verticalJump}   champ="Saut vertical"    pending={getPending("Saut vertical")}    inputType="text" numericMode="decimal" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Saut en longueur" value={a.broadJump}      champ="Saut longueur"    pending={getPending("Saut longueur")}    inputType="text" numericMode="decimal" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Développé couché" value={a.benchPress}     champ="Développé couché" pending={getPending("Développé couché")} inputType="text" numericMode="decimal" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Navette"          value={a.shuttleAgility} champ="Navette"          pending={getPending("Navette")}          inputType="text" numericMode="decimal" submitting={submitting} onSubmit={onSubmit} />
          <SuggestRow label="Sprint 100m"      value={a.sprint100m}     champ="Sprint 100m"      pending={getPending("Sprint 100m")}      inputType="text" numericMode="decimal" submitting={submitting} onSubmit={onSubmit} isLast />
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
