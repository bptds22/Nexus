"use client";

/* ═══════════════════════════════════════════════════════════════
   TeamCreateFormBlock — structured team-create form.

   Single source of truth for the team create UI : adopted by web
   manual create modal, web detail Informations edit, the new
   mobile teams pages, AND both onboarding wizards. All structured
   selects (age, division, gender, season) come from
   lib/config/civilVocab so every surface offers the same choices.

   Fields :
   - Nom         : free text (required)
   - Sport       : <select> from props.sports (required)
   - Catégorie d'âge : MobilePicker → AGE_OPTIONS (Autre escape)
   - Division   : MobilePicker → DIVISION_OPTIONS (Autre escape)
   - Genre      : 3-pill row → GENDER_OPTIONS
   - Ligue      : FREE TEXT (default "RSEQ" via initialValues)
   - Saison     : <select> SEASON_OPTIONS

   The "Autre" sentinel from AGE_OPTIONS / DIVISION_OPTIONS reveals
   a required text input ; the typed value substitutes the sentinel
   on submit. Never written to the DB as-is.

   Controlled : parent owns the values via the onChange callback.
   The form computes `isValid` (name + sport required ; age/division
   "Autre" requires the free-text counterpart) and emits it.

   PURE : no fetching, no router. Sports list is passed by the
   parent (every team create surface already loads it).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { MobilePicker, type PickerOption } from "@/components/mobile/MobilePicker";
import {
  AGE_OPTIONS, DIVISION_OPTIONS, GENDER_OPTIONS, SEASON_OPTIONS, AUTRE_VALUE,
} from "@/lib/config/civilVocab";

export interface SportOption {
  id: string;
  nom: string;
}

export interface TeamFormValues {
  name: string;
  sportId: string;
  /** Final age value (substituted from ageOther when ageGroup === AUTRE_VALUE). */
  ageGroup: string;
  /** Free-text input revealed when ageGroup === AUTRE_VALUE. */
  ageOther: string;
  division: string;
  divisionOther: string;
  gender: string;
  league: string;
  season: string;
}

export interface TeamCreateFormBlockProps {
  sports: SportOption[];
  /** Initial values — defaults blank with league="RSEQ" and season=current. */
  initialValues?: Partial<TeamFormValues>;
  /** Fires on EVERY change with the latest form state + computed isValid. */
  onChange: (values: TeamFormValues, isValid: boolean) => void;
  /** "Mobile" variant uses the MobilePicker bottom sheet for age/division.
   *  "Desktop" falls back to native <select> elements (no Capacitor APIs).
   *  Defaults to "mobile" — covers the new mobile teams + both onboardings.
   *  Web manual create modal can pass "desktop". */
  variant?: "mobile" | "desktop";
  /** Hide the Sport select — civil onboarding sets sport globally
   *  at slide 1 and doesn't want it duplicated on the team form. */
  hideSport?: boolean;
  /** Hide the Ligue free-text — civil onboarding derives league from
   *  the chosen club. */
  hideLeague?: boolean;
  /** Hide the Saison select — onboarding wizards keep the season
   *  default (RPC NULL → DB default applies). */
  hideSeason?: boolean;
}

const AGE_PICKER_OPTIONS: PickerOption[] = AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const DIVISION_PICKER_OPTIONS: PickerOption[] = DIVISION_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

function defaultSeason(): string {
  /* getCurrentSeason() lives in lib/utils ; we hard-code the rolling
     default here to avoid the import dependency at the block level. */
  return SEASON_OPTIONS[0]?.value ?? "2025-2026";
}

const EMPTY: TeamFormValues = {
  name: "", sportId: "",
  ageGroup: "", ageOther: "",
  division: "", divisionOther: "",
  gender: "",
  league: "RSEQ",
  season: defaultSeason(),
};

/* ── Resolve final age/division (Autre → typed text) ─────────── */

export function resolveTeamFinalValues(v: TeamFormValues): {
  finalAge: string;
  finalDivision: string;
} {
  const finalAge = v.ageGroup === AUTRE_VALUE ? v.ageOther.trim() : v.ageGroup;
  const finalDivision = v.division === AUTRE_VALUE ? v.divisionOther.trim() : v.division;
  return { finalAge, finalDivision };
}

function computeValid(v: TeamFormValues, opts?: {
  hideSport?: boolean;
}): boolean {
  if (!v.name.trim()) return false;
  /* Sport is required unless the parent provides it externally
     (civil onboarding sets sport globally at slide 1). */
  if (!opts?.hideSport && !v.sportId) return false;
  const { finalAge, finalDivision } = resolveTeamFinalValues(v);
  /* Age/division/gender are recommended for the structured search /
     dedup ; the civil onboarding required all three. We mirror that
     gate here so every surface produces consistent rows. */
  if (!finalAge) return false;
  if (!finalDivision) return false;
  if (!v.gender) return false;
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function TeamCreateFormBlock({
  sports, initialValues, onChange, variant = "mobile",
  hideSport = false, hideLeague = false, hideSeason = false,
}: TeamCreateFormBlockProps) {
  const [values, setValues] = useState<TeamFormValues>(() => ({
    ...EMPTY,
    ...initialValues,
  }));

  const [ageSheetOpen, setAgeSheetOpen] = useState(false);
  const [divSheetOpen, setDivSheetOpen] = useState(false);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [seasonSheetOpen, setSeasonSheetOpen] = useState(false);

  // Sport options for mobile picker — derived from props.sports.
  const sportPickerOptions: PickerOption[] = useMemo(
    () => sports.map((s) => ({ value: s.id, label: s.nom })),
    [sports],
  );
  const SEASON_PICKER_OPTIONS: PickerOption[] = SEASON_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  const selectedSportLabel = sports.find((s) => s.id === values.sportId)?.nom ?? "";

  useEffect(() => {
    onChange(values, computeValid(values, { hideSport }));
  }, [values, onChange, hideSport]);

  const update = useCallback(<K extends keyof TeamFormValues>(key: K, val: TeamFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const labelCls = "block text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5";
  const inputCls = "w-full bg-[#111317] border border-white/[0.10] rounded-2xl px-4 py-3 text-[15px] text-white placeholder:text-white/40 outline-none focus:border-[#E63946]/40";
  const pickerBtnCls = "w-full flex items-center justify-between bg-[#111317] border border-white/[0.10] rounded-2xl px-4 py-3 active:bg-white/[0.04] transition-colors text-left min-h-[52px]";

  return (
    <div className="space-y-4">
      {/* Nom */}
      <div>
        <label className={labelCls}>Nom de l&apos;équipe *</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Ex: Phénix M18"
          className={inputCls}
        />
      </div>

      {/* Sport — civil onboarding sets it globally, hideSport hides it.
          Mobile : dark MobilePicker (parity with age/division). Desktop :
          native <select>. */}
      {!hideSport && (
        <div>
          <label className={labelCls}>Sport *</label>
          {variant === "mobile" ? (
            <>
              <button
                type="button"
                onClick={() => setSportSheetOpen(true)}
                className={pickerBtnCls}
              >
                <span className={`text-[15px] truncate ${selectedSportLabel ? "text-white" : "text-white/40"}`}>
                  {selectedSportLabel || "Sélectionner un sport"}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0 ml-2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <MobilePicker
                open={sportSheetOpen}
                onClose={() => setSportSheetOpen(false)}
                title="Sport"
                options={sportPickerOptions}
                value={values.sportId || null}
                onChange={(v) => update("sportId", (v as string) ?? "")}
              />
            </>
          ) : (
            <select
              title="Sport"
              value={values.sportId}
              onChange={(e) => update("sportId", e.target.value)}
              className={`${inputCls} appearance-none`}
            >
              <option value="">Sélectionner un sport</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Catégorie d'âge */}
      <div>
        <label className={labelCls}>Catégorie d&apos;âge *</label>
        {variant === "mobile" ? (
          <>
            <button
              type="button"
              onClick={() => setAgeSheetOpen(true)}
              className={pickerBtnCls}
            >
              <span className={`text-[15px] truncate ${values.ageGroup ? "text-white" : "text-white/40"}`}>
                {values.ageGroup || "Sélectionner…"}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0 ml-2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <MobilePicker
              open={ageSheetOpen}
              onClose={() => setAgeSheetOpen(false)}
              title="Catégorie d'âge"
              options={AGE_PICKER_OPTIONS}
              value={values.ageGroup || null}
              onChange={(v) => update("ageGroup", (v as string) ?? "")}
            />
          </>
        ) : (
          <select
            title="Catégorie d'âge"
            value={values.ageGroup}
            onChange={(e) => update("ageGroup", e.target.value)}
            className={`${inputCls} appearance-none`}
          >
            <option value="">Sélectionner…</option>
            {AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {values.ageGroup === AUTRE_VALUE && (
          <input
            type="text"
            placeholder="Précise la catégorie d'âge"
            value={values.ageOther}
            onChange={(e) => update("ageOther", e.target.value)}
            className={`${inputCls} mt-2`}
          />
        )}
      </div>

      {/* Division */}
      <div>
        <label className={labelCls}>Division *</label>
        {variant === "mobile" ? (
          <>
            <button
              type="button"
              onClick={() => setDivSheetOpen(true)}
              className={pickerBtnCls}
            >
              <span className={`text-[15px] truncate ${values.division ? "text-white" : "text-white/40"}`}>
                {values.division || "Sélectionner…"}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0 ml-2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <MobilePicker
              open={divSheetOpen}
              onClose={() => setDivSheetOpen(false)}
              title="Division"
              options={DIVISION_PICKER_OPTIONS}
              value={values.division || null}
              onChange={(v) => update("division", (v as string) ?? "")}
            />
          </>
        ) : (
          <select
            title="Division"
            value={values.division}
            onChange={(e) => update("division", e.target.value)}
            className={`${inputCls} appearance-none`}
          >
            <option value="">Sélectionner…</option>
            {DIVISION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {values.division === AUTRE_VALUE && (
          <input
            type="text"
            placeholder="Précise la division"
            value={values.divisionOther}
            onChange={(e) => update("divisionOther", e.target.value)}
            className={`${inputCls} mt-2`}
          />
        )}
      </div>

      {/* Genre */}
      <div>
        <span className={labelCls}>Genre *</span>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map((opt) => {
            const selected = values.gender === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("gender", opt.value)}
                className={`flex-1 h-11 rounded-2xl text-[12px] font-bold uppercase tracking-wider transition-all ${
                  selected
                    ? "bg-[rgba(230,57,70,0.12)] border border-[#E63946] text-white"
                    : "bg-[#111317] border border-white/10 text-[#9CA3AF] active:bg-white/[0.04]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ligue — FREE TEXT (decision : keep as-is, no LEAGUE_OPTIONS).
          Civil onboarding hides it (derived from chosen club). */}
      {!hideLeague && (
        <div>
          <label className={labelCls}>Ligue</label>
          <input
            type="text"
            value={values.league}
            onChange={(e) => update("league", e.target.value)}
            placeholder="Ex: RSEQ Capitale-Nationale"
            className={inputCls}
          />
        </div>
      )}

      {/* Saison — onboarding wizards hide it (RPC NULL → DB default).
          Mobile : dark MobilePicker (parity). Desktop : native <select>. */}
      {!hideSeason && (
        <div>
          <label className={labelCls}>Saison</label>
          {variant === "mobile" ? (
            <>
              <button
                type="button"
                onClick={() => setSeasonSheetOpen(true)}
                className={pickerBtnCls}
              >
                <span className={`text-[15px] truncate ${values.season ? "text-white" : "text-white/40"}`}>
                  {values.season || "Sélectionner…"}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" className="flex-shrink-0 ml-2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <MobilePicker
                open={seasonSheetOpen}
                onClose={() => setSeasonSheetOpen(false)}
                title="Saison"
                options={SEASON_PICKER_OPTIONS}
                value={values.season || null}
                onChange={(v) => update("season", (v as string) ?? "")}
              />
            </>
          ) : (
            <select
              title="Saison"
              value={values.season}
              onChange={(e) => update("season", e.target.value)}
              className={`${inputCls} appearance-none`}
            >
              {SEASON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
