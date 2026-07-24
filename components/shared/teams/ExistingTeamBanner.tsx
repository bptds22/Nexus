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
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectExistingTeam, type DetectedTeam } from "@/lib/queries/coach/detectExistingTeam";

export interface ExistingTeamBannerProps {
  supabase: SupabaseClient;
  /** Create context — the owning school/club. Null → banner stays hidden. */
  schoolId?: string | null;
  /** Selected sport. Null → hidden. */
  sportId?: string | null;
  /** Current form values (FINAL, i.e. "Autre" already substituted). */
  ageGroup?: string;
  gender?: string;
  division?: string;
  /** Adopt the surfaced team (join flow). */
  onAdopt: (team: DetectedTeam) => void;
  /** Optional busy flag while the parent runs the join. */
  adopting?: boolean;
}

export function ExistingTeamBanner({
  supabase, schoolId, sportId, ageGroup, gender, division, onAdopt, adopting,
}: ExistingTeamBannerProps) {
  const [match, setMatch] = useState<DetectedTeam | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    // Gate : hide until the full identity is present.
    if (!schoolId || !sportId || !ageGroup?.trim() || !gender?.trim() || !division?.trim()) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    timer.current = setTimeout(async () => {
      const found = await detectExistingTeam(supabase, { schoolId, sportId, ageGroup, gender, division });
      if (!cancelled) setMatch(found);
    }, 300);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [supabase, schoolId, sportId, ageGroup, gender, division]);

  if (!match) return null;

  const meta = [match.ageGroup, match.gender, match.division].filter(Boolean).join(" · ");

  return (
    <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/[0.08] px-4 py-3">
      <p className="text-[13px] leading-snug text-[#F5C77E]">
        <span className="font-bold">⚠️ Cette équipe existe déjà :</span>{" "}
        <span className="text-white">{match.name}</span>
        {meta && <span className="text-white/70"> · {meta}</span>}
      </p>
      <button
        type="button"
        onClick={() => onAdopt(match)}
        disabled={adopting}
        className="mt-2 h-11 w-full rounded-2xl bg-[#F59E0B] text-[13px] font-bold uppercase tracking-wider text-[#111317] transition-opacity active:opacity-90 disabled:opacity-60"
      >
        {adopting ? "Adoption…" : "Adopter cette équipe"}
      </button>
    </div>
  );
}
