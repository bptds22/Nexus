"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentSeason } from "@/lib/utils/season";
import { AGE_OPTIONS, AUTRE_VALUE, DIVISION_OPTIONS } from "@/lib/config/civilVocab";

/* ═══════════════════════════════════════════════════════════════
   TeamCreateForm — pure-presentation form for creating a civil
   team.

   Phase 6.2: in the unified model, a "civil league" is a `schools`
   row with type='LIGUE_CIVILE'. This form's autocomplete therefore
   queries `schools` (filtered to LIGUE_CIVILE) rather than the
   retired `leagues` table. The shape of the emitted data is
   unchanged for caller compatibility — `league_input` and
   `league_id_if_existing` are now the LIGUE_CIVILE school's name
   and id respectively.

   Pure-presentation by design: the form collects {team_name,
   age_group, division, gender, league_input, league_id_if_existing,
   season} and emits via onSubmit. The caller owns the find-or-create
   logic.

   Constrained vocab : age_group + division both come from
   lib/config/civilVocab (single combined list across sports). Each
   has an "Autre" branch that reveals a required free-text input —
   the typed value is what gets emitted, never the literal "Autre".

   Gender : the form writes the canonical accented form
   ("Masculin"/"Féminin"/"Mixte") so new rows stop drifting against
   the RSEQ seed casing. Display normalization lives in
   lib/config/gender.ts (genderLabel) for any legacy lowercase rows.

   School (league) autocomplete:
   - On mount, fetch all LIGUE_CIVILE schools. Civil league count
     stays small enough that load-all-upfront + client-side filter
     is the right shape. Sport is no longer an attribute of the
     league — it lives on the team row.
   - Free-text mode: typing a value not in the suggestion list
     leaves league_id_if_existing as null. Caller treats null as
     "create new league".
   - Picking from suggestions sets both league_input (name) and
     league_id_if_existing (id). Editing the field after a selection
     diverges from the cached name → reset league_id_if_existing.

   Season default is derived from getCurrentSeason() (evaluated once
   at module load — see lib/utils/season.ts).
═══════════════════════════════════════════════════════════════ */

export type Gender = "Masculin" | "Féminin" | "Mixte";

export interface TeamFormData {
  team_name: string;
  age_group: string;
  division: string;
  gender: Gender;
  league_input: string;
  league_id_if_existing: string | null;
  season: string;
}

export interface TeamCreateFormProps {
  sportId: string;
  sportName: string;
  onSubmit: (data: TeamFormData) => void;
  onCancel: () => void;
  className?: string;
}

interface LeagueOption {
  id: string;
  name: string;
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "Masculin", label: "Masculin" },
  { value: "Féminin",  label: "Féminin" },
  { value: "Mixte",    label: "Mixte" },
];
const DEFAULT_SEASON = getCurrentSeason();

const inputCls =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";
const labelCls =
  "block text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF] mb-1.5";

export default function TeamCreateForm({
  sportId,
  sportName,
  onSubmit,
  onCancel,
  className = "",
}: TeamCreateFormProps) {
  const [teamName, setTeamName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [ageOther, setAgeOther] = useState("");
  const [division, setDivision] = useState("");
  const [divisionOther, setDivisionOther] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [season, setSeason] = useState(DEFAULT_SEASON);

  // League autocomplete state
  const [leagueOptions, setLeagueOptions] = useState<LeagueOption[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [leagueInput, setLeagueInput] = useState("");
  const [leagueIdIfExisting, setLeagueIdIfExisting] = useState<string | null>(null);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const leagueWrapperRef = useRef<HTMLDivElement | null>(null);

  // Fetch civil leagues on mount. Phase 6.2: leagues now live in
  // `schools` with type='LIGUE_CIVILE'. Sport is no longer an
  // attribute of the league — keep the sportId prop for caller
  // compatibility but don't filter on it here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .eq("type", "LIGUE_CIVILE")
        .order("name");
      if (!cancelled) {
        if (error) {
          console.error("[TeamCreateForm] league fetch failed:", error);
          setLeagueOptions([]);
        } else {
          setLeagueOptions((data ?? []) as LeagueOption[]);
        }
        setLeaguesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sportId]);

  // Close suggestion dropdown when clicking outside the wrapper.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (leagueWrapperRef.current && !leagueWrapperRef.current.contains(e.target as Node)) {
        setLeagueOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const trimmedLeagueInput = leagueInput.trim().toLowerCase();
  const filteredLeagues =
    trimmedLeagueInput.length === 0
      ? leagueOptions.slice(0, 8)
      : leagueOptions
          .filter((l) => l.name.toLowerCase().includes(trimmedLeagueInput))
          .slice(0, 10);

  const exactMatch = leagueOptions.find(
    (l) => l.name.toLowerCase() === trimmedLeagueInput
  );

  function handleLeagueChange(value: string) {
    setLeagueInput(value);
    // If the typed value diverges from the cached selection's name,
    // clear league_id_if_existing — the caller should treat the
    // result as a brand-new league (or find-or-create).
    if (leagueIdIfExisting) {
      const cached = leagueOptions.find((l) => l.id === leagueIdIfExisting);
      if (!cached || cached.name !== value) {
        setLeagueIdIfExisting(null);
      }
    }
    // If typed text exactly matches an existing league, snap the
    // id silently so the caller can reuse it without find-or-create.
    if (!leagueIdIfExisting) {
      const match = leagueOptions.find((l) => l.name.toLowerCase() === value.trim().toLowerCase());
      if (match) setLeagueIdIfExisting(match.id);
    }
  }

  function pickSuggestion(option: LeagueOption) {
    setLeagueInput(option.name);
    setLeagueIdIfExisting(option.id);
    setLeagueOpen(false);
  }

  // "Autre" handling : substitute the trimmed text-input value when
  // either select is on Autre. The substitution is the only way the
  // canSubmit guard accepts the form — blocks empty Autre text inputs.
  const ageOtherTrimmed = ageOther.trim();
  const divisionOtherTrimmed = divisionOther.trim();
  const ageValueForSubmit =
    ageGroup === AUTRE_VALUE ? ageOtherTrimmed : ageGroup;
  const divisionValueForSubmit =
    division === AUTRE_VALUE ? divisionOtherTrimmed : division;
  const ageValid = ageGroup !== "" && (ageGroup !== AUTRE_VALUE || ageOtherTrimmed.length > 0);
  const divisionValid = division !== "" && (division !== AUTRE_VALUE || divisionOtherTrimmed.length > 0);

  const canSubmit =
    teamName.trim().length > 0 &&
    ageValid &&
    divisionValid &&
    gender !== "" &&
    leagueInput.trim().length > 0 &&
    season.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    // canSubmit already guarantees gender !== "" but TS can't follow
    // the indirection. Pull a typed local to discharge the union.
    const finalGender = gender as Gender;
    onSubmit({
      team_name: teamName.trim(),
      age_group: ageValueForSubmit,
      division: divisionValueForSubmit,
      gender: finalGender,
      league_input: leagueInput.trim(),
      league_id_if_existing: leagueIdIfExisting,
      season: season.trim(),
    });
  }

  return (
    <div className={`space-y-5 ${className}`}>
      <div>
        <h3 className="font-head text-lg font-black text-white uppercase">Crée ta nouvelle équipe</h3>
        <p className="text-xs text-[#9CA3AF] mt-1">
          Sport: <span className="text-white font-bold">{sportName}</span>
        </p>
      </div>

      <div>
        <label htmlFor="team-name" className={labelCls}>
          Nom de l&apos;équipe <span className="text-[#EF4444]">*</span>
        </label>
        <input
          id="team-name"
          type="text"
          placeholder="Ex: Patriotes Senior, Cobras AAA"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="team-age-group" className={labelCls}>
          Catégorie d&apos;âge <span className="text-[#EF4444]">*</span>
        </label>
        <select
          id="team-age-group"
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value)}
          className={`${inputCls} appearance-none cursor-pointer`}
        >
          <option value="">Sélectionner...</option>
          {AGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {ageGroup === AUTRE_VALUE && (
          <input
            type="text"
            placeholder="Précise la catégorie d'âge"
            value={ageOther}
            onChange={(e) => setAgeOther(e.target.value)}
            className={`${inputCls} mt-2`}
            aria-label="Catégorie d'âge personnalisée"
            required
          />
        )}
      </div>

      <div>
        <label htmlFor="team-division" className={labelCls}>
          Division <span className="text-[#EF4444]">*</span>
        </label>
        <select
          id="team-division"
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          className={`${inputCls} appearance-none cursor-pointer`}
        >
          <option value="">Sélectionner...</option>
          {DIVISION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {division === AUTRE_VALUE && (
          <input
            type="text"
            placeholder="Précise la division"
            value={divisionOther}
            onChange={(e) => setDivisionOther(e.target.value)}
            className={`${inputCls} mt-2`}
            aria-label="Division personnalisée"
            required
          />
        )}
      </div>

      <div>
        <span className={labelCls}>
          Genre <span className="text-[#EF4444]">*</span>
        </span>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map((opt) => {
            const selected = gender === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(opt.value)}
                className={`flex-1 h-11 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  selected
                    ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white"
                    : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20"
                }`}
                aria-pressed={selected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={leagueWrapperRef} className="relative">
        <label htmlFor="team-league" className={labelCls}>
          Ligue <span className="text-[#EF4444]">*</span>
        </label>
        <input
          id="team-league"
          type="text"
          placeholder={leaguesLoading ? "Chargement des ligues..." : "Ex: LFL, LBQ, LCFQ"}
          value={leagueInput}
          onChange={(e) => handleLeagueChange(e.target.value)}
          onFocus={() => setLeagueOpen(true)}
          disabled={leaguesLoading}
          className={inputCls}
          autoComplete="off"
        />
        <p className="text-[10px] text-[#6B7280] mt-1">
          {leagueIdIfExisting
            ? "Ligue existante reconnue"
            : leagueInput.trim().length > 0 && !exactMatch
            ? "Nouvelle ligue — sera créée à la soumission"
            : "Sélectionne une ligue existante ou tape un nouveau nom"}
        </p>

        {leagueOpen && !leaguesLoading && filteredLeagues.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-[#1A1D24] border border-white/10 rounded-lg max-h-60 overflow-y-auto shadow-xl">
            {filteredLeagues.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => pickSuggestion(option)}
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="team-season" className={labelCls}>
          Saison
        </label>
        <input
          id="team-season"
          type="text"
          placeholder="Ex: 2025-2026"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-11 px-6 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Créer l&apos;équipe
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-5 text-[12px] text-[#9CA3AF] hover:text-white transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
