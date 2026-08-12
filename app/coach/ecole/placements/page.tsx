"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCoachAthleteScope } from "@/lib/queries/coach/getCoachAthletes";
import PlacementsTable from "@/components/director/PlacementsTable";
import SchoolGate from "@/components/subscription/SchoolGate";
import type { Placement } from "@/lib/types/models";

export default function PlacementsPageWrapper() {
  return <SchoolGate><PlacementsPage /></SchoolGate>;
}

function PlacementsPage() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlacements() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get my school
      const { data: mySchool } = await supabase
        .from("school_coaches")
        .select("school_id")
        .eq("coach_id", user.id)
        .limit(1)
        .single();

      if (!mySchool) { setLoading(false); return; }

      // Get all coaches at my school
      const { data: schoolCoaches } = await supabase
        .from("school_coaches")
        .select("coach_id")
        .eq("school_id", mySchool.school_id);

      if (!schoolCoaches || schoolCoaches.length === 0) { setLoading(false); return; }
      const coachIds = schoolCoaches.map(sc => sc.coach_id);

      // Périmètre canonique — source unique get_coach_athletes (directeur →
      // école ∪ équipes ; ACTIF+EN_ATTENTE). Remplace .in("coach_id", coachIds).
      // (coachIds reste utilisé plus bas pour les profils coachs.)
      const { ids: scopeIds } = await loadCoachAthleteScope(supabase);
      if (!scopeIds.length) { setLoading(false); return; }
      const { data: athletes } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, sport_id, coach_id, position_id, sports!sport_id(nom), positions!position_id(nom, abreviation)")
        .in("id", scopeIds);

      if (!athletes || athletes.length === 0) { setLoading(false); return; }
      const athleteIds = athletes.map(a => a.id);

      // Get pipeline entries with LETTRE_SIGNEE
      const { data: pipelineEntries } = await supabase
        .from("recruiter_pipeline")
        .select("id, athlete_id, recruiter_id, updated_at")
        .in("athlete_id", athleteIds)
        .eq("stage", "LETTRE_SIGNEE");

      if (!pipelineEntries || pipelineEntries.length === 0) {
        setPlacements([]);
        setLoading(false);
        return;
      }

      // Get recruiter profiles → school_id
      const recruiterIds = [...new Set(pipelineEntries.map(p => p.recruiter_id))];
      const { data: recruiterUsers } = await supabase
        .from("users")
        .select("id, first_name, last_name, school_id")
        .in("id", recruiterIds);

      // Get CÉGEP school names
      const cegepSchoolIds = [...new Set((recruiterUsers || []).map((r: { school_id: string | null }) => r.school_id).filter(Boolean))] as string[];
      const { data: cegepSchools } = cegepSchoolIds.length > 0
        ? await supabase.from("schools").select("id, name").in("id", cegepSchoolIds)
        : { data: [] };

      // Get coach user profiles
      const { data: coachUsers } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .in("id", coachIds);

      // Build Placement objects matching the shared type
      const mapped: Placement[] = pipelineEntries.map(pe => {
        const athlete = athletes.find(a => a.id === pe.athlete_id) as Record<string, unknown> | undefined;
        const recruiter = recruiterUsers?.find((r: { id: string }) => r.id === pe.recruiter_id) as Record<string, unknown> | undefined;
        const cegep = cegepSchools?.find((s: { id: string }) => s.id === (recruiter?.school_id as string)) as { name?: string } | undefined;
        const coach = coachUsers?.find((u: { id: string }) => u.id === (athlete?.coach_id as string)) as Record<string, unknown> | undefined;

        // Sport name from join
        const sportRaw = athlete?.sports;
        const sport = Array.isArray(sportRaw) ? sportRaw[0] : sportRaw;
        const sportObj = sport as { nom?: string } | null;

        // Position from join
        const posRaw = athlete?.positions;
        const pos = Array.isArray(posRaw) ? posRaw[0] : posRaw;
        const posObj = pos as { abreviation?: string; nom?: string } | null;

        return {
          id: pe.id,
          athleteId: (athlete?.id as string) || "",
          athleteName: athlete ? `${(athlete.first_name as string) || ""} ${(athlete.last_name as string) || ""}`.trim() : "—",
          sport: sportObj?.nom || "—",
          position: posObj?.abreviation || posObj?.nom || "—",
          destinationCegep: cegep?.name || "—",
          coachId: (athlete?.coach_id as string) || undefined,
          coachName: coach ? `${(coach.first_name as string) || ""} ${(coach.last_name as string) || ""}`.trim() : "—",
          recruiterId: (pe.recruiter_id as string) || undefined,
          recruiterName: recruiter ? `${(recruiter.first_name as string) || ""} ${(recruiter.last_name as string) || ""}`.trim() : undefined,
          signedAt: pe.updated_at || "",
        };
      });

      mapped.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());
      setPlacements(mapped);
      setLoading(false);
    }
    loadPlacements();
  }, []);

  const count = placements.length;

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="flex items-center gap-2 text-[22px] font-bold uppercase tracking-wide text-white"
            style={{ fontFamily: "var(--wl-font-head, Outfit, sans-serif)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
              <path d="M18 2H6v7a6 6 0 0012 0V2z" />
            </svg>
            Placements
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {count} athlètes recrutés cette saison
          </p>
        </div>

        <div className="w-20 h-20 rounded-full border-2 border-[#E63946] flex items-center justify-center flex-shrink-0">
          <span
            className="text-[48px] font-bold text-[#E63946] leading-none"
            style={{ fontFamily: "var(--wl-font-head, Outfit, sans-serif)" }}
          >
            {count}
          </span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      {count > 0 ? (
        <PlacementsTable placements={placements} variant="ecole" />
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] py-16 flex flex-col items-center justify-center gap-4">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
            <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
            <path d="M18 2H6v7a6 6 0 0012 0V2z" />
          </svg>
          <p className="text-[14px] text-[#6B7280] text-center max-w-md">
            Aucun placement cette saison. Les profils complets et vérifiés
            attirent plus de recruteurs!
          </p>
          <Link
            href="/coach/ecole/stats"
            className="mt-2 bg-[#E63946] hover:bg-[#D93C3C] text-white rounded-lg px-5 py-2.5 text-[13px] font-medium transition-colors"
          >
            Voir les stats
          </Link>
        </div>
      )}
    </div>
  );
}
