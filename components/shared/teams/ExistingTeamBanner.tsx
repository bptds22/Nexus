"use client";

/* ═══════════════════════════════════════════════════════════════
   ExistingTeamBanner — attribute-match adoption prompt (Morceau 2).

   Drop-in banner rendered ABOVE a team-create button. Given the
   create context (school + sport) and the current form attributes
   (age / gender / division), it debounces a light detection query
   (detectExistingTeam — same normalized identity as the server guard)
   and, if a matching team already exists, shows :

     ⚠️ Cette équipe existe déjà : [Nom · Catégorie · Sexe · Division]
        [ Adopter cette équipe ]

   "Adopter" calls onAdopt(team) → the surface's existing join flow.
   The create button stays active (the server guard adopts anyway) —
   this only makes the adoption VISIBLE before submit. Renders null
   until the five identity fields are set and a match is found, so it
   is safe to mount unconditionally above any create form.

   Self-contained : the two shared create forms are pure-presentation,
   so detection + banner live here (one component, every surface).

   PLUSIEURS ÉQUIPES (BP 2026-10-09) : un club civil en aligne souvent
   plusieurs dans le même groupe (Diablos Blanc / Noir, Wildcats Est /
   Nord / Ouest). La bannière les liste TOUTES, chacune nommée avec son
   groupe et sa ZONE (« Atome Nord »), et le coach adopte la sienne : deux
   équipes de même nom dans des zones différentes ne sont jamais confondues.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectExistingTeams, type DetectedTeam } from "@/lib/queries/coach/detectExistingTeam";
import { nomGroupe } from "@/lib/civil/classementCivil";
import { triggerHaptic } from "@/lib/haptics";

export interface ExistingTeamBannerProps {
  supabase: SupabaseClient;
  /** Create context — the owning school/club. Null → banner stays hidden. */
  schoolId?: string | null;
  /** Selected sport. Null → hidden. */
  sportId?: string | null;
  /** Current form values (FINAL, i.e. "Autre" already substituted ;
   *  AUCUNE_DIVISION for an explicit « pas de niveau »). */
  ageGroup?: string;
  gender?: string;
  division?: string;
  /** Nom saisi : l'équipe qui le porte passe en tête. */
  name?: string;
  /** Adopt the surfaced team (join flow). */
  onAdopt: (team: DetectedTeam) => void;
  /** Optional busy flag while the parent runs the join. */
  adopting?: boolean;
}

/** « Atome Nord · Masculin », « Pee-Wee AAA Sud · Masculin ». */
function groupeDe(t: DetectedTeam): string {
  return [nomGroupe({ categorie: t.ageGroup, division: t.division, zone: t.zone }), t.gender]
    .map((v) => (v ?? "").trim()).filter(Boolean).join(" · ");
}

export function ExistingTeamBanner({
  supabase, schoolId, sportId, ageGroup, gender, division, name, onAdopt, adopting,
}: ExistingTeamBannerProps) {
  const [matches, setMatches] = useState<DetectedTeam[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    // Gate : hide until the full identity is present.
    if (!schoolId || !sportId || !ageGroup?.trim() || !gender?.trim() || !division?.trim()) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    timer.current = setTimeout(async () => {
      const found = await detectExistingTeams(supabase, { schoolId, sportId, ageGroup, gender, division, name });
      if (!cancelled) setMatches(found);
    }, 300);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [supabase, schoolId, sportId, ageGroup, gender, division, name]);

  if (matches.length === 0) return null;

  const bouton = (t: DetectedTeam, libelle: string) => (
    <button
      type="button"
      onClick={() => { void triggerHaptic("Light"); onAdopt(t); }}
      disabled={adopting}
      className="mt-2 h-11 w-full rounded-2xl bg-[#F59E0B] text-[13px] font-bold uppercase tracking-wider text-[#111317] transition-opacity active:opacity-90 disabled:opacity-60"
    >
      {adopting ? "Adoption…" : libelle}
    </button>
  );

  if (matches.length === 1) {
    const match = matches[0];
    const meta = groupeDe(match);
    return (
      <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/[0.08] px-4 py-3">
        <p className="text-[13px] leading-snug text-[#F5C77E]">
          <span className="font-bold">⚠️ Cette équipe existe déjà :</span>{" "}
          <span className="text-white">{match.name}</span>
          {meta && <span className="text-white/70"> · {meta}</span>}
        </p>
        {bouton(match, "Adopter cette équipe")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/[0.08] px-4 py-3" data-testid="equipes-existantes">
      <p className="text-[13px] leading-snug text-[#F5C77E]">
        <span className="font-bold">⚠️ {matches.length} équipes de ce groupe existent déjà.</span>{" "}
        Choisis la tienne plutôt que d&apos;en créer une autre :
      </p>
      <ul className="mt-2 space-y-3">
        {matches.map((t) => (
          <li key={t.id} className="border-t border-[#F59E0B]/20 pt-2 first:border-t-0 first:pt-0">
            <p className="text-[13px] leading-snug">
              <span className="text-white">{t.name}</span>
              {groupeDe(t) && <span className="text-white/70"> · {groupeDe(t)}</span>}
            </p>
            {bouton(t, "Adopter celle-ci")}
          </li>
        ))}
      </ul>
    </div>
  );
}
