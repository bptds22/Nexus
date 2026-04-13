"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────────── */

interface SchoolStat {
  id: string;
  name: string;
  athletes: number;
  verified: number;
  verifiedPct: string;
  views: number;
}

interface SportStat {
  id: string;
  nom: string;
  athletes: number;
  avgRating: string;
}

interface CoachStat {
  id: string;
  name: string;
  school: string;
  athletes: number;
  evaluated: number;
  verified: number;
}

interface PipelineStageStat {
  stage: string;
  count: number;
}

interface RecruiterStat {
  id: string;
  name: string;
  cegep: string;
  favorites: number;
  contacts: number;
}

const STAGES = [
  "IDENTIFIE",
  "CONTACTE",
  "EN_DISCUSSION",
  "VISITE_PLANIFIEE",
  "ENGAGE",
  "LETTRE_SIGNEE",
];

const STAGE_LABELS: Record<string, string> = {
  IDENTIFIE: "Identifié",
  CONTACTE: "Contacté",
  EN_DISCUSSION: "En discussion",
  VISITE_PLANIFIEE: "Visite planifiée",
  ENGAGE: "Engagé",
  LETTRE_SIGNEE: "Lettre signée",
  OUVERT: "Ouvert",
};

const sectionTitle = "text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]";

export default function AdminAnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);

  const [bySchool, setBySchool] = useState<SchoolStat[]>([]);
  const [bySport, setBySport] = useState<SportStat[]>([]);
  const [byCoach, setByCoach] = useState<CoachStat[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStageStat[]>([]);
  const [overrideStats, setOverrideStats] = useState<PipelineStageStat[]>([]);
  const [byRecruiter, setByRecruiter] = useState<RecruiterStat[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [
        schoolsRes,
        athletesRes,
        profileViewsRes,
        sportsRes,
        evaluationsRes,
        usersRes,
        pipelineRes,
        favoritesRes,
      ] = await Promise.all([
        supabase.from("schools").select("id,name,type").order("name"),
        supabase
          .from("athletes")
          .select("id,school_id,sport_id,coach_id,verified,cote_globale_entraineur,statut_recrutement_override"),
        supabase.from("profile_views").select("athlete_id"),
        supabase.from("sports").select("id,nom").order("nom"),
        supabase.from("evaluations").select("coach_id,athlete_id,cote_globale"),
        supabase.from("users").select("id,first_name,last_name,role,school_id"),
        supabase.from("recruiter_pipeline").select("recruiter_id,athlete_id,stage"),
        supabase.from("recruiter_favorites").select("recruiter_id"),
      ]);

      const schools = (schoolsRes.data || []) as Array<{ id: string; name: string; type: string }>;
      const athletes =
        (athletesRes.data || []) as Array<{
          id: string;
          school_id: string | null;
          sport_id: string | null;
          coach_id: string | null;
          verified: boolean;
          cote_globale_entraineur: number | null;
          statut_recrutement_override: string | null;
        }>;
      const profileViews = (profileViewsRes.data || []) as Array<{ athlete_id: string }>;
      const sports = (sportsRes.data || []) as Array<{ id: string; nom: string }>;
      const evaluations =
        (evaluationsRes.data || []) as Array<{
          coach_id: string;
          athlete_id: string;
          cote_globale: number | null;
        }>;
      const users =
        (usersRes.data || []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          role: string;
          school_id: string | null;
        }>;
      const pipeline =
        (pipelineRes.data || []) as Array<{ recruiter_id: string; athlete_id: string; stage: string }>;
      const favorites = (favoritesRes.data || []) as Array<{ recruiter_id: string }>;

      // Section 1 — Par école
      const viewsPerAthlete = new Map<string, number>();
      for (const v of profileViews) {
        viewsPerAthlete.set(v.athlete_id, (viewsPerAthlete.get(v.athlete_id) || 0) + 1);
      }
      const schoolStatsMap = new Map<string, { athletes: number; verified: number; views: number }>();
      for (const a of athletes) {
        if (!a.school_id) continue;
        const s = schoolStatsMap.get(a.school_id) || { athletes: 0, verified: 0, views: 0 };
        s.athletes += 1;
        if (a.verified) s.verified += 1;
        s.views += viewsPerAthlete.get(a.id) || 0;
        schoolStatsMap.set(a.school_id, s);
      }
      const schoolStats: SchoolStat[] = schools
        .map((s) => {
          const st = schoolStatsMap.get(s.id) || { athletes: 0, verified: 0, views: 0 };
          return {
            id: s.id,
            name: s.name,
            athletes: st.athletes,
            verified: st.verified,
            verifiedPct: st.athletes > 0 ? `${Math.round((st.verified / st.athletes) * 100)}%` : "—",
            views: st.views,
          };
        })
        .filter((s) => s.athletes > 0)
        .sort((a, b) => b.athletes - a.athletes);

      // Section 2 — Par sport
      const evalByAthlete = new Map<string, number>();
      for (const e of evaluations) {
        if (e.cote_globale != null) evalByAthlete.set(e.athlete_id, Number(e.cote_globale));
      }
      const sportAgg = new Map<string, { athletes: number; sum: number; count: number }>();
      for (const a of athletes) {
        if (!a.sport_id) continue;
        const s = sportAgg.get(a.sport_id) || { athletes: 0, sum: 0, count: 0 };
        s.athletes += 1;
        const rating = evalByAthlete.get(a.id) ?? (a.cote_globale_entraineur != null ? Number(a.cote_globale_entraineur) : null);
        if (rating != null && !Number.isNaN(rating)) {
          s.sum += rating;
          s.count += 1;
        }
        sportAgg.set(a.sport_id, s);
      }
      const sportStats: SportStat[] = sports
        .map((sp) => {
          const s = sportAgg.get(sp.id) || { athletes: 0, sum: 0, count: 0 };
          return {
            id: sp.id,
            nom: sp.nom,
            athletes: s.athletes,
            avgRating: s.count > 0 ? (s.sum / s.count).toFixed(2) : "—",
          };
        })
        .sort((a, b) => b.athletes - a.athletes);

      // Section 3 — Par coach
      const schoolMap = new Map(schools.map((s) => [s.id, s.name]));
      const coaches = users.filter((u) => u.role === "COACH");
      const coachAgg = new Map<string, { athletes: number; verified: number; athleteIds: Set<string> }>();
      for (const a of athletes) {
        if (!a.coach_id) continue;
        const s = coachAgg.get(a.coach_id) || { athletes: 0, verified: 0, athleteIds: new Set<string>() };
        s.athletes += 1;
        if (a.verified) s.verified += 1;
        s.athleteIds.add(a.id);
        coachAgg.set(a.coach_id, s);
      }
      const evalPerCoach = new Map<string, Set<string>>();
      for (const e of evaluations) {
        if (e.cote_globale == null) continue;
        const set = evalPerCoach.get(e.coach_id) || new Set<string>();
        set.add(e.athlete_id);
        evalPerCoach.set(e.coach_id, set);
      }
      const coachStats: CoachStat[] = coaches
        .map((c) => {
          const s = coachAgg.get(c.id) || { athletes: 0, verified: 0, athleteIds: new Set<string>() };
          const evalSet = evalPerCoach.get(c.id) || new Set<string>();
          let evaluated = 0;
          for (const aid of s.athleteIds) if (evalSet.has(aid)) evaluated += 1;
          const name =
            [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "(sans nom)";
          return {
            id: c.id,
            name,
            school: c.school_id ? schoolMap.get(c.school_id) || "—" : "—",
            athletes: s.athletes,
            evaluated,
            verified: s.verified,
          };
        })
        .filter((c) => c.athletes > 0)
        .sort((a, b) => b.athletes - a.athletes);

      // Section 4 — Pipeline
      const pipelineCounts = new Map<string, number>();
      for (const p of pipeline) {
        pipelineCounts.set(p.stage, (pipelineCounts.get(p.stage) || 0) + 1);
      }
      const pipelineArr: PipelineStageStat[] = STAGES.map((st) => ({
        stage: st,
        count: pipelineCounts.get(st) || 0,
      }));
      const overrideCounts = new Map<string, number>();
      for (const a of athletes) {
        const st = a.statut_recrutement_override || "OUVERT";
        overrideCounts.set(st, (overrideCounts.get(st) || 0) + 1);
      }
      const overrideArr: PipelineStageStat[] = Array.from(overrideCounts.entries())
        .map(([stage, count]) => ({ stage, count }))
        .sort((a, b) => b.count - a.count);

      // Section 5 — Recruteurs
      const recruiters = users.filter((u) => u.role === "RECRUTEUR");
      const favByRec = new Map<string, number>();
      for (const f of favorites) favByRec.set(f.recruiter_id, (favByRec.get(f.recruiter_id) || 0) + 1);
      const contactByRec = new Map<string, Set<string>>();
      for (const p of pipeline) {
        if (p.stage === "IDENTIFIE") continue;
        const set = contactByRec.get(p.recruiter_id) || new Set<string>();
        set.add(p.athlete_id);
        contactByRec.set(p.recruiter_id, set);
      }
      const recruiterStats: RecruiterStat[] = recruiters
        .map((r) => ({
          id: r.id,
          name:
            [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "(sans nom)",
          cegep: r.school_id ? schoolMap.get(r.school_id) || "—" : "—",
          favorites: favByRec.get(r.id) || 0,
          contacts: contactByRec.get(r.id)?.size || 0,
        }))
        .sort((a, b) => b.favorites + b.contacts - (a.favorites + a.contacts));

      setBySchool(schoolStats);
      setBySport(sportStats);
      setByCoach(coachStats);
      setPipelineStats(pipelineArr);
      setOverrideStats(overrideArr);
      setByRecruiter(recruiterStats);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Analytique globale
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Vue d&apos;ensemble de la plateforme — données en direct
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      ) : (
        <>
          {/* Section 1 — Par école */}
          <section className="space-y-3">
            <h2 className={sectionTitle}>Par école</h2>
            <p className="text-[12px] text-[#6b7280]">
              Athlètes, taux de vérification et vues par établissement.
            </p>
            <SimpleTable
              headers={["École", "# Athlètes", "# Vérifiés", "% Vérifiés", "# Vues total"]}
              rows={bySchool.map((s) => [
                s.name,
                String(s.athletes),
                String(s.verified),
                s.verifiedPct,
                String(s.views),
              ])}
              aligns={["left", "right", "right", "right", "right"]}
              emptyLabel="Aucune donnée"
            />
          </section>

          {/* Section 2 — Par sport */}
          <section className="space-y-3">
            <h2 className={sectionTitle}>Par sport</h2>
            <p className="text-[12px] text-[#6b7280]">
              Athlètes inscrits et cote moyenne (évaluations coach prioritaires).
            </p>
            <SimpleTable
              headers={["Sport", "# Athlètes", "Cote moyenne"]}
              rows={bySport.map((s) => [s.nom, String(s.athletes), s.avgRating])}
              aligns={["left", "right", "right"]}
              emptyLabel="Aucune donnée"
            />
          </section>

          {/* Section 3 — Par coach */}
          <section className="space-y-3">
            <h2 className={sectionTitle}>Par coach</h2>
            <p className="text-[12px] text-[#6b7280]">
              Coachs actifs et leurs athlètes (évalués = cote_globale non nulle dans evaluations).
            </p>
            <SimpleTable
              headers={["Coach", "École", "# Athlètes", "# Évalués", "# Vérifiés"]}
              rows={byCoach.map((c) => [
                c.name,
                c.school,
                String(c.athletes),
                String(c.evaluated),
                String(c.verified),
              ])}
              aligns={["left", "left", "right", "right", "right"]}
              emptyLabel="Aucune donnée"
            />
          </section>

          {/* Section 4 — Pipeline global */}
          <section className="space-y-3">
            <h2 className={sectionTitle}>Pipeline global (recruiter_pipeline)</h2>
            <p className="text-[12px] text-[#6b7280]">
              Répartition des athlètes dans le pipeline des recruteurs.
            </p>
            <SimpleTable
              headers={["Étape", "Nombre"]}
              rows={pipelineStats.map((p) => [STAGE_LABELS[p.stage] || p.stage, String(p.count)])}
              aligns={["left", "right"]}
              emptyLabel="Aucune donnée"
            />

            <h3 className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] pt-3">
              Override athlète (statut_recrutement_override)
            </h3>
            <SimpleTable
              headers={["Statut", "Nombre"]}
              rows={overrideStats.map((p) => [STAGE_LABELS[p.stage] || p.stage, String(p.count)])}
              aligns={["left", "right"]}
              emptyLabel="Aucune donnée"
            />
          </section>

          {/* Section 5 — Recruteurs */}
          <section className="space-y-3">
            <h2 className={sectionTitle}>Recruteurs</h2>
            <p className="text-[12px] text-[#6b7280]">
              # Contacts = athlètes distincts avec une étape pipeline ≠ IDENTIFIE.
            </p>
            <SimpleTable
              headers={["Recruteur", "CÉGEP", "# Favoris", "# Contacts"]}
              rows={byRecruiter.map((r) => [
                r.name,
                r.cegep,
                String(r.favorites),
                String(r.contacts),
              ])}
              aligns={["left", "left", "right", "right"]}
              emptyLabel="Aucune donnée"
            />
          </section>
        </>
      )}
    </div>
  );
}

/* ── Simple read-only table ───────────────────────────────── */

function SimpleTable({
  headers,
  rows,
  aligns,
  emptyLabel,
}: {
  headers: string[];
  rows: string[][];
  aligns?: Array<"left" | "right" | "center">;
  emptyLabel: string;
}) {
  return (
    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg overflow-x-auto">
      <table className="w-full text-[13px] text-[#E0E0E0]">
        <thead>
          <tr className="bg-[#13151a] border-b border-[#2D3748]">
            {headers.map((h, i) => (
              <th
                key={h}
                className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]"
                style={{ textAlign: aligns?.[i] || "left" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-[#6b7280]">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-[#2D3748] hover:bg-[#22252D]">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className="px-4 py-2.5 tabular-nums"
                    style={{ textAlign: aligns?.[j] || "left" }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
