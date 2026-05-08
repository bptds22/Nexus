"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   TeamCreateForm — pure-presentation form for creating a civil
   league_team. Standalone component for 5.4g-ii; not yet wired
   into the onboarding wizard (that's 5.4g-iv).

   Pure-presentation by design (Option C from 5.4g-ii discovery):
   the form collects {team_name, age_group, gender, league_input,
   league_id_if_existing, season} and emits via onSubmit. The caller
   owns the find-or-create logic (5.4g-iii will add a UNIQUE
   constraint on leagues + ON CONFLICT DO NOTHING semantics; 5.4g-iv
   wires the caller).

   League autocomplete:
   - On mount, fetch all civil leagues for the chosen sport
     (level='Civil', sport_id=props.sportId). Civil league count
     stays small enough that load-all-upfront + client-side filter
     is the right shape.
   - Free-text mode: typing a value not in the suggestion list
     leaves league_id_if_existing as null. Caller treats null as
     "create new league".
   - Picking from suggestions sets both league_input (the league's
     name) and league_id_if_existing (its id). Editing the field
     after a selection diverges from the cached name → reset
     league_id_if_existing to null so the caller does find-or-create
     against the new free-text value.

   Season default is hardcoded to "2025-2026" pending the season
   helper P3 (lib/utils/season.ts) — see post-launch-bugs.md. The
   form keeps it editable to handle off-season onboarding.

   Gender values match the DB CHECK constraint
   (league_teams_gender_check): lowercase, no accents — "masculin",
   "feminin", "mixte". The toggle shows capitalized labels for UX
   ("Masculin"/"Féminin"/"Mixte") but emits the lowercase value so
   the caller can write it straight into league_teams.gender without
   a transform. Display surfaces (TeamSearchOrCreate result rows,
   CoachConfirmation recap) capitalize for human display.
═══════════════════════════════════════════════════════════════ */

export type Gender = "masculin" | "feminin" | "mixte";

export interface TeamFormData {
  team_name: string;
  age_group: string;
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

const AGE_GROUPS = ["U13", "U15", "U17", "U18", "Senior", "Autre"];
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "masculin", label: "Masculin" },
  { value: "feminin", label: "Féminin" },
  { value: "mixte", label: "Mixte" },
];
const DEFAULT_SEASON = "2025-2026";

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
  const [gender, setGender] = useState<Gender | "">("");
  const [season, setSeason] = useState(DEFAULT_SEASON);

  // League autocomplete state
  const [leagueOptions, setLeagueOptions] = useState<LeagueOption[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [leagueInput, setLeagueInput] = useState("");
  const [leagueIdIfExisting, setLeagueIdIfExisting] = useState<string | null>(null);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const leagueWrapperRef = useRef<HTMLDivElement | null>(null);

  // Fetch civil leagues for this sport on mount.
  useEffect(() => {
    if (!sportId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("sport_id", sportId)
        .eq("level", "Civil")
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

  const canSubmit =
    teamName.trim().length > 0 &&
    ageGroup !== "" &&
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
      age_group: ageGroup,
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
          {AGE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
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
                aria-pressed={selected ? "true" : "false"}
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
