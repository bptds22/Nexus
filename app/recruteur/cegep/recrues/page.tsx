"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import CegepGate from "@/components/subscription/CegepGate";
import { createClient } from "@/lib/supabase/client";
import StarRating from "@/components/ui/StarRating";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";

/* ── Types ── */

interface RecrueCegep {
  athleteId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  verified: boolean;
  sport: string;
  position: string;
  sourceSchool: string;
  sourceRegion: string;
  coteGlobale: number;
  recruitmentStatus: string;
  recruiterName: string;
  stage: string;
  updatedAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  ENGAGE: "Engagé",
  LETTRE_SIGNEE: "Lettre signée",
};

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ENGAGE: { bg: "rgba(59,130,246,0.10)", text: "#3B82F6", border: "rgba(59,130,246,0.25)" },
  LETTRE_SIGNEE: { bg: "rgba(34,197,94,0.10)", text: "#22C55E", border: "rgba(34,197,94,0.25)" },
};

/* ── Page ── */

export default function RecrusCegepWrapper() {
  return <CegepGate><RecrusCegepPage /></CegepGate>;
}

function RecrusCegepPage() {
  const [sportFilter, setSportFilter] = useState("Tous");
  const [recruits, setRecruits] = useState<RecrueCegep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: currentUser } = await supabase.from("users").select("school_id").eq("id", user.id).single();
      if (!currentUser?.school_id) { setLoading(false); return; }

      const { data: team } = await supabase.from("users").select("id, first_name, last_name").eq("school_id", currentUser.school_id);
      const teamIds = team?.map((t) => t.id) || [];
      const teamNameMap = new Map(team?.map((t) => [t.id, `${t.first_name || ""} ${t.last_name || ""}`]) || []);

      if (teamIds.length === 0) { setLoading(false); return; }

      const { data: recrueData } = await supabase
        .from("recruiter_pipeline")
        .select(`
          stage, updated_at, recruiter_id,
          athletes!athlete_id(
            id, first_name, last_name, verified, cote_globale_entraineur,
            recruitment_status, numero_jersey,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region)
          )
        `)
        .in("recruiter_id", teamIds)
        .in("stage", ["ENGAGE", "LETTRE_SIGNEE"])
        .order("updated_at", { ascending: false });

      console.log("[Recrues] loaded", recrueData?.length, "confirmed recruits");

      const mapped: RecrueCegep[] = (recrueData || []).map((row) => {
        const ath = row.athletes as unknown as {
          id: string; first_name: string; last_name: string; verified: boolean;
          cote_globale_entraineur: number | null; recruitment_status: string | null; numero_jersey: string | null;
          sports?: { nom?: string } | { nom?: string }[] | null;
          positions?: { nom?: string; abreviation?: string } | { nom?: string; abreviation?: string }[] | null;
          schools?: { name?: string; region?: string } | { name?: string; region?: string }[] | null;
        } | null;

        const sportRel = ath?.sports; const sportObj = Array.isArray(sportRel) ? sportRel[0] : sportRel;
        const posRel = ath?.positions; const posObj = Array.isArray(posRel) ? posRel[0] : posRel;
        const schoolRel = ath?.schools; const schoolObj = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;

        return {
          athleteId: ath?.id || "",
          firstName: ath?.first_name || "",
          lastName: ath?.last_name || "",
          jerseyNumber: (ath?.numero_jersey as string) || "",
          verified: ath?.verified === true,
          sport: sportObj?.nom || "",
          position: posObj?.abreviation || "",
          sourceSchool: schoolObj?.name || "",
          sourceRegion: schoolObj?.region || "",
          coteGlobale: (ath?.cote_globale_entraineur as number) || 0,
          recruitmentStatus: (ath?.recruitment_status as string) || "OUVERT",
          recruiterName: teamNameMap.get(row.recruiter_id) || "",
          stage: (row.stage as string) || "",
          updatedAt: (row.updated_at as string) || "",
        };
      });

      setRecruits(mapped);
      setLoading(false);
    }
    load();
  }, []);

  const sports = useMemo(
    () => ["Tous", ...Array.from(new Set(recruits.map((r) => r.sport).filter(Boolean)))],
    [recruits],
  );

  const filtered = useMemo(
    () => sportFilter === "Tous" ? recruits : recruits.filter((r) => r.sport === sportFilter),
    [sportFilter, recruits],
  );

  const count = filtered.length;

  const selectClass =
    "bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="flex items-center gap-2 text-[22px] font-bold uppercase tracking-wide text-white"
            style={{ fontFamily: "var(--wl-font-head, Outfit, sans-serif)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#E63946" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 019 0V7H7.5v6zM7.5 7H4a1 1 0 00-1 1v1a4 4 0 004 4h.5m9-6H20a1 1 0 011 1v1a4 4 0 01-4 4h-.5" />
            </svg>
            Recrues confirm&eacute;es
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {loading ? "Chargement..." : `${recruits.length} athlète${recruits.length !== 1 ? "s" : ""} recruté${recruits.length !== 1 ? "s" : ""} cette saison`}
          </p>
        </div>

        {/* KPI circle */}
        <div
          className="w-20 h-20 rounded-full border-2 border-[#E63946] flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: "0 0 20px rgba(230,57,70,0.4), 0 0 40px rgba(230,57,70,0.15)" }}
        >
          <span
            className="text-[48px] font-bold text-[#E63946] leading-none"
            style={{
              fontFamily: "var(--wl-font-head, Outfit, sans-serif)",
              textShadow: "0 0 12px rgba(230,57,70,0.6), 0 0 24px rgba(230,57,70,0.3)",
            }}
          >
            {recruits.length}
          </span>
        </div>
      </div>

      {/* ── Sport filter ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)} aria-label="Filtrer par sport" className={selectClass}>
          {sports.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* ── Table or empty state ──────────────────────────── */}
      {count > 0 ? (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-[#13151a]">
                  {["Athlète", "#", "Sport", "Position", "École d'origine", "Cote", "Statut", "Recruteur", "Stage", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.2em] uppercase text-[#6B7280] text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const stageCfg = STAGE_COLORS[r.stage] || STAGE_COLORS.ENGAGE;
                  return (
                    <tr key={`${r.athleteId}-${i}`} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                      {/* Athlète */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/recruteur/athletes/${r.athleteId}`} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors whitespace-nowrap">
                            {r.firstName} {r.lastName}
                          </Link>
                          {r.verified && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" stroke="none" className="shrink-0">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </svg>
                          )}
                        </div>
                      </td>
                      {/* Jersey */}
                      <td className="px-4 py-3">
                        {r.jerseyNumber ? (
                          <span className="text-[13px] font-bold text-[#E63946]">#{r.jerseyNumber}</span>
                        ) : (
                          <span className="text-[12px] text-[#4a4d56]">—</span>
                        )}
                      </td>
                      {/* Sport */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-semibold text-[#9CA3AF]">{r.sport || "—"}</span>
                      </td>
                      {/* Position */}
                      <td className="px-4 py-3">
                        {r.position ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#2D3748]/50 text-[#9CA3AF] border border-[#2D3748]">
                            {r.position}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#4a4d56]">—</span>
                        )}
                      </td>
                      {/* École */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#9CA3AF] whitespace-nowrap">{r.sourceSchool || "—"}</span>
                        {r.sourceRegion && <span className="text-[10px] text-[#4a4d56] block">{r.sourceRegion}</span>}
                      </td>
                      {/* Cote */}
                      <td className="px-4 py-3">
                        {r.coteGlobale > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <StarRating rating={r.coteGlobale} size="sm" showNumber={false} />
                            <span className="text-[12px] font-bold text-white">{r.coteGlobale.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#4a4d56]">—</span>
                        )}
                      </td>
                      {/* Statut global */}
                      <td className="px-4 py-3">
                        <RecruitmentStatusBadge status={r.recruitmentStatus as GlobalRecruitmentStatus} size="sm" />
                      </td>
                      {/* Recruteur */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-semibold text-[#9CA3AF] whitespace-nowrap">{r.recruiterName || "—"}</span>
                      </td>
                      {/* Stage */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                          style={{ backgroundColor: stageCfg.bg, color: stageCfg.text, border: `1px solid ${stageCfg.border}` }}
                        >
                          {STAGE_LABELS[r.stage] || r.stage}
                        </span>
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#6B7280] whitespace-nowrap">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] py-16 flex flex-col items-center justify-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="#6B7280" strokeWidth={1.5} className="opacity-50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 019 0V7H7.5v6zM7.5 7H4a1 1 0 00-1 1v1a4 4 0 004 4h.5m9-6H20a1 1 0 011 1v1a4 4 0 01-4 4h-.5" />
          </svg>
          <p className="text-[14px] text-[#6B7280] text-center max-w-md">
            Aucune recrue confirm&eacute;e pour cette s&eacute;lection.
          </p>
        </div>
      )}
    </div>
  );
}
