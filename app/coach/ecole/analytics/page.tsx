"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCoachAthleteScope } from "@/lib/queries/coach/getCoachAthletes";
import { calculateProfileCompletion } from "@/lib/utils/calculateProfileCompletion";

/* ═══════════════════════════════════════════════════════════════
   Coach Analytics — PRO feature
   Shows visibility metrics, CÉGEP interest, funnel, attention alerts.
═══════════════════════════════════════════════════════════════ */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const SPORT_COLORS: Record<string, string> = {
  Football: "#3B82F6", Hockey: "#8B5CF6", Basketball: "#F97316",
  Volleyball: "#22C55E", Soccer: "#06B6D4",
};

const ATTENTION_STYLES: Record<string, { border: string; label: string; labelColor: string }> = {
  zero_views: { border: "border-l-[#EAB308]", label: "0 vues en 14+ jours", labelColor: "text-[#EAB308]" },
  incomplete: { border: "border-l-[#EF4444]", label: "Profil incomplet", labelColor: "text-[#EF4444]" },
  unverified: { border: "border-l-[#6B7280]", label: "Non vérifié depuis 30+ jours", labelColor: "text-[#9CA3AF]" },
  viewed_not_contacted: { border: "border-l-[#3B82F6]", label: "Vu mais pas contacté", labelColor: "text-[#3B82F6]" },
};

function TrendArrow({ trend, pct }: { trend: "up" | "down" | "flat"; pct: number }) {
  if (trend === "up") return <span className="text-[#22C55E] text-[11px] font-bold">↑ +{pct}%</span>;
  if (trend === "down") return <span className="text-[#E63946] text-[11px] font-bold">↓ {pct}%</span>;
  return <span className="text-[#6B7280] text-[11px] font-bold">→ {pct > 0 ? "+" : ""}{pct}%</span>;
}

const FRENCH_MONTHS_SHORT = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sep.", "oct.", "nov.", "déc."];

function getWeekLabels(count: number): string[] {
  const labels: string[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - (i * 7));
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    labels.push(`${monday.getDate()} ${FRENCH_MONTHS_SHORT[monday.getMonth()]}`);
  }
  return labels;
}

/* ── types for the analytics data shape ── */

interface AnalyticsData {
  kpis: { total_athletes: number; athletes_visible: number; athletes_favorited: number; athletes_contacted: number };
  views_weekly: number[];
  week_labels: string[];
  athlete_performance: { name: string; pos: string; grad: number; completion: number; views: number; trend: "up" | "down" | "flat"; trend_pct: number; favorites: number; contacts: number }[];
  cegeps_interested: { name: string; athleteCount: number; sports: string[] }[];
  funnel: { label: string; count: number; color: string }[];
  placement_rate: number;
  attention_needed: { name: string; pos: string; grad: number; type: string; detail: string; missing?: string }[];
  sports_breakdown: {
    athletes: { sport: string; count: number; percent: number }[];
    views: { sport: string; views: number; percent: number }[];
  };
}

export default function CoachAnalyticsWrapper() {
  return <CoachAnalyticsPage />;
}

function CoachAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    async function fetchData() {
      const weekLabels = getWeekLabels(12);
      const emptyData: AnalyticsData = {
        kpis: { total_athletes: 0, athletes_visible: 0, athletes_favorited: 0, athletes_contacted: 0 },
        views_weekly: Array(12).fill(0),
        week_labels: weekLabels,
        athlete_performance: [],
        cegeps_interested: [],
        funnel: [],
        placement_rate: 0,
        attention_needed: [],
        sports_breakdown: { athletes: [], views: [] },
      };

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setD(emptyData); setLoading(false); return; }

      // 1. Resolve my school_id — try the junction table first, fall back to users.school_id.
      //    Coaches can be linked to a school via either:
      //      (a) school_coaches (new multi-team model), or
      //      (b) users.school_id (legacy single-school link)
      const { data: scRow, error: scErr } = await supabase
        .from("school_coaches")
        .select("school_id")
        .eq("coach_id", user.id)
        .limit(1)
        .maybeSingle();

      let mySchoolId = (scRow?.school_id as string | undefined) || null;
      if (!mySchoolId) {
        const { data: userRow } = await supabase
          .from("users")
          .select("school_id")
          .eq("id", user.id)
          .maybeSingle();
        mySchoolId = (userRow?.school_id as string | undefined) || null;
      }

      if (!mySchoolId) {
        setD(emptyData);
        setLoading(false);
        return;
      }

      // 2. Périmètre canonique — source unique get_coach_athletes (directeur →
      //    école ∪ équipes ; ACTIF+EN_ATTENTE, DESACTIVE/DIPLOME exclus). Le
      //    scope école captait déjà les coach_id NULL ; le RPC ajoute les
      //    athlètes d'équipe et applique enfin le filtre statut.
      const { ids: scopeIds } = await loadCoachAthleteScope(supabase);
      if (!scopeIds.length) { setD(emptyData); setLoading(false); return; }
      const { data: athletes, error: athleteErr } = await supabase
        .from("athletes")
        // Every column calculateProfileCompletion needs, plus the evaluations join it looks at.
        // profile_completion (the denormalized field) is deliberately NOT used anymore — it's
        // stale for athletes that were edited without the trigger firing.
        .select(`
          id, first_name, last_name, sport_id, coach_id, verified, annee_diplomation, position_id,
          photo_url, date_naissance, genre, telephone, school_id,
          numero_jersey, taille_pieds, taille_pouces, poids_lbs, main_dominante, pied_dominant,
          video_faits_saillants_url, video_match_complet_url, video_entrainement_url,
          hudl_url, youtube_url, instagram_url,
          moyenne_generale, programme_cegep_vise, programmes_vises, matieres_fortes, regions_cegep_preferees,
          cote_globale_entraineur,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          team_athletes(team_id),
          evaluations(leadership, discipline, coachabilite, intelligence_jeu, competitivite, esprit_equipe, resilience, attitude_mentalite, cote_globale, rapport_entraineur, distinctions, updated_at)
        `)
        .in("id", scopeIds);

      const athleteList = athletes || [];
      const totalAthletes = athleteList.length;

      if (totalAthletes === 0) {
        setD(emptyData);
        setLoading(false);
        return;
      }

      const athleteIds = athleteList.map(a => a.id);

      // 4. Pull all recruiter-interest signals in parallel. No date filter — the
      //    page shows lifetime totals (the weekly chart buckets viewed_at itself).
      //    .limit(10000) overrides PostgREST's default 1000-row cap.

      const [pipelineRes, viewsRes, favoritesRes, convsRes] = await Promise.all([
        supabase.from("recruiter_pipeline").select("id, athlete_id, recruiter_id, stage", { count: "exact" }).in("athlete_id", athleteIds).limit(10000),
        // recruiter_athlete_views is the authoritative view-tracking table (matches the
        // counter shown on the recruiter-side athlete profile page).
        supabase.from("recruiter_athlete_views").select("athlete_id, recruiter_id, viewed_at", { count: "exact" }).in("athlete_id", athleteIds).limit(10000),
        supabase.from("recruiter_favorites").select("athlete_id, recruiter_id", { count: "exact" }).in("athlete_id", athleteIds).limit(10000),
        supabase.from("conversations").select("athlete_id, recruiter_id", { count: "exact" }).in("athlete_id", athleteIds).limit(10000),
      ]);
      const pipeline = pipelineRes.data || [];
      const profileViews = viewsRes.data || [];
      const favorites = favoritesRes.data || [];
      const conversations = convsRes.data || [];

      // `count` is the true row count PostgREST saw (before any .limit()); `data.length` is what
      // was returned after pagination. If they differ for any query, we're being paginated.

      // Per-athlete breakdown so we can spot mismatches vs. the recruiter-side counter.
      const perAthleteViewTotals: Record<string, number> = {};
      profileViews.forEach(v => {
        const aid = v.athlete_id as string;
        perAthleteViewTotals[aid] = (perAthleteViewTotals[aid] || 0) + 1;
      });

      // 5. Get sport names
      const sportIds = [...new Set(athleteList.map(a => a.sport_id).filter(Boolean))];
      const sportsMap: Record<string, string> = {};
      if (sportIds.length > 0) {
        const { data: sports } = await supabase.from("sports").select("id, nom").in("id", sportIds);
        if (sports) sports.forEach(s => { sportsMap[s.id] = s.nom; });
      }

      // ── Per-athlete maps from real tables ─────────────────────
      const viewsByAthlete: Record<string, number> = {};
      const athletesViewed = new Set<string>();
      profileViews.forEach(v => {
        const aid = v.athlete_id as string;
        viewsByAthlete[aid] = (viewsByAthlete[aid] || 0) + 1;
        athletesViewed.add(aid);
      });

      const favoritesByAthlete: Record<string, number> = {};
      const athletesFavorited = new Set<string>();
      favorites.forEach(f => {
        const aid = f.athlete_id as string;
        favoritesByAthlete[aid] = (favoritesByAthlete[aid] || 0) + 1;
        athletesFavorited.add(aid);
      });

      const contactsByAthlete: Record<string, number> = {};
      const athletesContacted = new Set<string>();
      conversations.forEach(c => {
        const aid = c.athlete_id as string;
        contactsByAthlete[aid] = (contactsByAthlete[aid] || 0) + 1;
        athletesContacted.add(aid);
      });

      // ── Views weekly — bucket recruiter_athlete_views.viewed_at into 12 weekly bins ──
      const views_weekly = Array(12).fill(0) as number[];
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      let bucketedIn12wk = 0;
      let bucketedOlderThan12wk = 0;
      let bucketedInvalidDate = 0;
      profileViews.forEach(v => {
        if (!v.viewed_at) { bucketedInvalidDate++; return; }
        const ts = new Date(v.viewed_at as string).getTime();
        if (!Number.isFinite(ts)) { bucketedInvalidDate++; return; }
        const weeksAgo = Math.floor((now - ts) / weekMs);
        if (weeksAgo >= 0 && weeksAgo < 12) {
          // weekLabels[0] = oldest (11 weeks ago), weekLabels[11] = this week.
          views_weekly[11 - weeksAgo] += 1;
          bucketedIn12wk++;
        } else {
          bucketedOlderThan12wk++;
        }
      });

      // ── Athlete performance (real views/favorites/contacts + live completion) ──
      const athlete_performance = athleteList.map(a => {
        const posRaw = a.positions;
        const posObj = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { nom?: string; abreviation?: string } | null;
        const completion = calculateProfileCompletion(a as Record<string, unknown>);
        return {
          name: `${a.first_name} ${a.last_name}`,
          pos: posObj?.abreviation || posObj?.nom || "—",
          grad: (a.annee_diplomation as number) || 0,
          completion,
          views: viewsByAthlete[a.id] || 0,
          trend: "flat" as const,
          trend_pct: 0,
          favorites: favoritesByAthlete[a.id] || 0,
          contacts: contactsByAthlete[a.id] || 0,
        };
      });

      // ── CÉGEPs interested — union of pipeline + favorites + conversations recruiter ids ──
      const activePipeline = pipeline.filter(p => p.stage !== "NONE" && p.stage !== "RETIRE");
      type InterestRow = { athlete_id: string; recruiter_id: string };
      const interestRows: InterestRow[] = [
        ...activePipeline
          .filter((p): p is typeof p & { recruiter_id: string } => !!p.recruiter_id)
          .map(p => ({ athlete_id: p.athlete_id as string, recruiter_id: p.recruiter_id as string })),
        ...favorites
          .filter((f): f is typeof f & { recruiter_id: string } => !!f.recruiter_id)
          .map(f => ({ athlete_id: f.athlete_id as string, recruiter_id: f.recruiter_id as string })),
        ...conversations
          .filter((c): c is typeof c & { recruiter_id: string } => !!c.recruiter_id)
          .map(c => ({ athlete_id: c.athlete_id as string, recruiter_id: c.recruiter_id as string })),
      ];
      const interestRecruiterIds = [...new Set(interestRows.map(r => r.recruiter_id))];
      let cegeps_interested: AnalyticsData["cegeps_interested"] = [];
      if (interestRecruiterIds.length > 0) {
        const { data: recruiterUsers } = await supabase.from("users").select("id, school_id").in("id", interestRecruiterIds);
        const cegepSchoolIds = [...new Set((recruiterUsers || []).map((r: Record<string, unknown>) => r.school_id).filter(Boolean))] as string[];
        const schoolsMap: Record<string, string> = {};
        if (cegepSchoolIds.length > 0) {
          const { data: schools } = await supabase.from("schools").select("id, name").in("id", cegepSchoolIds);
          if (schools) schools.forEach((s: { id: string; name: string }) => { schoolsMap[s.id] = s.name; });
        }
        const cegepData: Record<string, { athletes: Set<string>; sports: Set<string> }> = {};
        interestRows.forEach(row => {
          const rec = (recruiterUsers || []).find((r: Record<string, unknown>) => r.id === row.recruiter_id) as { school_id?: string } | undefined;
          if (!rec?.school_id) return;
          const schoolName = schoolsMap[rec.school_id] || rec.school_id;
          if (!cegepData[schoolName]) cegepData[schoolName] = { athletes: new Set(), sports: new Set() };
          cegepData[schoolName].athletes.add(row.athlete_id);
          const ath = athleteList.find(a => a.id === row.athlete_id);
          if (ath) cegepData[schoolName].sports.add(sportsMap[ath.sport_id] || "Inconnu");
        });
        cegeps_interested = Object.entries(cegepData)
          .map(([name, g]) => ({ name, athleteCount: g.athletes.size, sports: Array.from(g.sports) }))
          .sort((a, b) => b.athleteCount - a.athleteCount);
      }

      // ── Funnel ─────────────────────────────────────────────────
      const verifiedCount = athleteList.filter(a => a.verified).length;
      const DISCUSSION_PLUS = ["EN_DISCUSSION", "VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"];
      const VISITE_PLUS = ["VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"];

      const distinctAthletesByStatuses = (statuses: string[]) => {
        const set = new Set<string>();
        pipeline.forEach(p => { if (statuses.includes(p.stage)) set.add(p.athlete_id); });
        return set.size;
      };

      const funnelData = [
        { label: "Créés",          count: totalAthletes,                              color: "#3B82F6" },
        { label: "Vérifiés",       count: verifiedCount,                              color: "#22C55E" },
        { label: "Profils vus",    count: athletesViewed.size,                        color: "#06B6D4" },
        { label: "Favoris",        count: athletesFavorited.size,                     color: "#8B5CF6" },
        { label: "Contactés",      count: athletesContacted.size,                     color: "#F59E0B" },
        { label: "En discussion",  count: distinctAthletesByStatuses(DISCUSSION_PLUS), color: "#F97316" },
        { label: "Visite",         count: distinctAthletesByStatuses(VISITE_PLUS),     color: "#EC4899" },
        { label: "Placés",         count: distinctAthletesByStatuses(["LETTRE_SIGNEE"]), color: "#E63946" },
      ];
      const placedCount = distinctAthletesByStatuses(["LETTRE_SIGNEE"]);
      const placementRate = totalAthletes > 0 ? Math.round((placedCount / totalAthletes) * 100) : 0;

      // ── KPIs — every KPI card on this page uses the pattern (numerator / denominator * 100).
      //    Denominator is always totalAthletes (atheletes at this school).
      const kpis = {
        total_athletes: totalAthletes,
        athletes_visible: athletesViewed.size,       // distinct athletes with ≥1 recruiter_athlete_views row
        athletes_favorited: athletesFavorited.size,  // distinct athletes with ≥1 recruiter_favorites row
        athletes_contacted: athletesContacted.size,  // distinct athletes with ≥1 conversations row
      };
      const pctOrZero = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);

      // ── Attention needed ──
      const attention_needed: AnalyticsData["attention_needed"] = [];
      athleteList.forEach(a => {
        const posRaw = a.positions;
        const posObj = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { nom?: string; abreviation?: string } | null;
        const pos = posObj?.abreviation || posObj?.nom || "—";
        const grad = (a.annee_diplomation as number) || 0;
        const completion = calculateProfileCompletion(a as Record<string, unknown>);

        if (completion < 60) {
          const missing: string[] = [];
          if (completion < 30) missing.push("photo, vidéo, bio");
          else missing.push("informations manquantes");
          attention_needed.push({ name: `${a.first_name} ${a.last_name}`, pos, grad, type: "incomplete", detail: `Profil à ${completion}% — compléter pour augmenter la visibilité`, missing: missing.join(", ") });
        } else if (!a.verified) {
          attention_needed.push({ name: `${a.first_name} ${a.last_name}`, pos, grad, type: "unverified", detail: "Profil non vérifié — soumettre pour vérification" });
        }
      });

      // ── Sports breakdown — athletes per sport + views per sport ──
      const sportCountMap: Record<string, number> = {};
      athleteList.forEach(a => {
        const sportName = sportsMap[a.sport_id] || "Inconnu";
        sportCountMap[sportName] = (sportCountMap[sportName] || 0) + 1;
      });
      const maxSportCount = Math.max(...Object.values(sportCountMap), 1);
      const sportsAthletes = Object.entries(sportCountMap).map(([sport, count]) => ({
        sport, count, percent: totalAthletes > 0 ? Math.round((count / totalAthletes) * 100) : 0,
      }));

      // Aggregate recruiter_athlete_views rows by the athlete's sport.
      // Build athlete_id → sport_name lookup, then bucket every view row into that sport.
      const athleteIdToSport: Record<string, string> = {};
      athleteList.forEach(a => {
        athleteIdToSport[a.id as string] = sportsMap[a.sport_id] || "Inconnu";
      });
      const sportViewCountMap: Record<string, number> = {};
      Object.keys(sportCountMap).forEach(sport => { sportViewCountMap[sport] = 0; });
      profileViews.forEach(v => {
        const sport = athleteIdToSport[v.athlete_id as string];
        if (!sport) return;
        sportViewCountMap[sport] = (sportViewCountMap[sport] || 0) + 1;
      });
      const totalViews = Object.values(sportViewCountMap).reduce((s, n) => s + n, 0);
      const sportsViews = Object.entries(sportViewCountMap).map(([sport, views]) => ({
        sport,
        views,
        percent: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
      }));

      setD({
        kpis, views_weekly, week_labels: weekLabels, athlete_performance, cegeps_interested,
        funnel: funnelData, placement_rate: placementRate,
        attention_needed, sports_breakdown: { athletes: sportsAthletes, views: sportsViews },
      });
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading || !d) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const k = d.kpis;
  const weeklyViews = d.views_weekly || Array.from({ length: 12 }, () => 0);
  const weekLabels = d.week_labels || getWeekLabels(12);
  const maxWeekly = Math.max(...weeklyViews, 1);
  const sportsViewsArr = d.sports_breakdown?.views || [];
  const sportsAthletesArr = d.sports_breakdown?.athletes || [];
  const maxSportViews = Math.max(...sportsViewsArr.map((s) => s.views), 1);
  const maxSportCount = Math.max(...sportsAthletesArr.map((s) => s.count), 1);
  const funnelArr = d.funnel || [];
  const maxFunnel = funnelArr.length > 0 ? funnelArr[0].count : 1;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Analytique</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Performance de visibilité de tes athlètes — 30 derniers jours</p>
      </div>

      {/* ── Section 1: KPI Cards — conversion rates ── */}
      {(() => {
        const total = k.total_athletes || 0;
        const safePct = (n: number) => total > 0 ? Math.round(((n || 0) / total) * 100) : 0;
        const cards = [
          { pct: safePct(k.athletes_visible), num: k.athletes_visible || 0, lbl: "Taux de visibilité", sub: `vus par un recruteur`, iconBg: "rgba(156,163,175,0.15)",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> },
          { pct: safePct(k.athletes_favorited), num: k.athletes_favorited || 0, lbl: "Taux de favoris", sub: `en favoris`, iconBg: "rgba(230,57,70,0.15)",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> },
          { pct: safePct(k.athletes_contacted), num: k.athletes_contacted || 0, lbl: "Taux de contact", sub: `contactés`, iconBg: "rgba(34,197,94,0.15)",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
        ];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map((c, i) => (
              <div key={i} className="group bg-[#1A1D24] rounded-xl border border-[#1e2128] hover:border-[#E63946]/20 p-5 relative overflow-hidden transition-all">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: c.iconBg }}>{c.icon}</div>
                <p className="font-head font-black text-[28px] text-white leading-none">{c.pct}%</p>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6B7280] mt-1">{c.lbl}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Section 2: Views trend chart — week labels as dates ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Vues de tes athlètes — 12 dernières semaines</h2>
        <div className="flex items-end gap-1.5 h-[140px]">
          {weeklyViews.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-[#6B7280]">{val}</span>
              <div className="w-full rounded-t-sm bg-[#E63946]" style={{ height: `${(val / maxWeekly) * 110}px`, minHeight: 4 }} />
              <span className="text-[7px] text-[#4a4d56] whitespace-nowrap">{weekLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Athlete performance table ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Performance par athlète</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a4d56]">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Athlète</th>
                <th className="py-2 pr-3">Pos.</th>
                <th className="py-2 pr-3">Grad</th>
                <th className="py-2 pr-3">Profil</th>
                <th className="py-2 pr-3">Vues</th>
                <th className="py-2 pr-3">Tend.</th>
                <th className="py-2 pr-3">Favoris</th>
                <th className="py-2">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {(d.athlete_performance || []).map((a, i) => {
                const compColor = a.completion >= 70 ? "#3B82F6" : a.completion >= 40 ? "#6B7280" : "#EF4444";
                return (
                  <tr key={i} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                    <td className="py-2.5 pr-3 text-[12px] text-[#6B7280]">{i + 1}</td>
                    <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{a.name}</td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.pos}</td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.grad}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-[#2A2D35] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${a.completion}%`, backgroundColor: compColor }} /></div>
                        <span className="text-[11px] font-bold" style={{ color: compColor }}>{a.completion}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{a.views}</td>
                    <td className="py-2.5 pr-3"><TrendArrow trend={a.trend} pct={a.trend_pct} /></td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.favorites}</td>
                    <td className="py-2.5 text-[12px]" style={{ color: a.contacts > 0 ? "#22C55E" : "#6B7280" }}>{a.contacts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: CÉGEPs interested ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Quels CÉGEPs regardent tes athlètes?</h2>
        {(d.cegeps_interested || []).length === 0 ? (
          <div className="py-8 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 22V12h6v10" /><path d="M3 10h18" />
            </svg>
            <p className="text-[13px] text-[#6B7280]">Aucun CÉGEP n&apos;a encore consulté vos athlètes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a4d56]">
                  <th className="py-2 pr-3">CÉGEP</th>
                  <th className="py-2 pr-3">Athlètes</th>
                  <th className="py-2">Sports</th>
                </tr>
              </thead>
              <tbody>
                {(d.cegeps_interested || []).map((c, i) => (
                  <tr key={i} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                    <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{c.name}</td>
                    <td className="py-2.5 pr-3 text-[13px] text-[#9CA3AF]">{c.athleteCount} athlète{c.athleteCount > 1 ? "s" : ""}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1">{c.sports.map((s) => <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-[#9CA3AF]">{s}</span>)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 5: TRUE Recruitment funnel ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Entonnoir de recrutement</h2>
        <div className="space-y-2">
          {funnelArr.map((step, i) => {
            const widthPct = maxFunnel > 0 ? Math.max((step.count / maxFunnel) * 100, 6) : 6;
            const pct = maxFunnel > 0 ? Math.round((step.count / maxFunnel) * 100) : 0;
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="text-[11px] text-[#9CA3AF] w-24 text-right shrink-0">{step.label}</span>
                <div className="flex-1 h-7 bg-[#2A2D35] rounded overflow-hidden">
                  <div className="h-full rounded flex items-center px-3 transition-all" style={{ width: `${widthPct}%`, backgroundColor: step.color }}>
                    {step.count > 0 && <span className="text-[11px] font-bold text-white">{step.count}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-[#6B7280] w-10 shrink-0 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-[#9CA3AF] mt-4 pt-3 border-t border-[#1e2128]">
          <span className="font-bold text-white">{d.placement_rate}%</span> de tes athlètes ont été placés cette saison
        </p>
      </div>

      {/* ── Section 6: Attention needed ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Athlètes qui ont besoin d&apos;attention</h2>
        {(d.attention_needed || []).length === 0 ? (
          <p className="text-[13px] text-[#6B7280] py-4 text-center">Tous les profils sont en bon état.</p>
        ) : (
          <div className="space-y-3">
            {(d.attention_needed || []).map((a, i) => {
              const style = ATTENTION_STYLES[a.type];
              return (
                <div key={i} className={`bg-[#111317] rounded-lg border-l-4 ${style.border} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold text-white">{a.name}</span>
                        <span className="text-[11px] text-[#6B7280]">{a.pos} · {a.grad}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${style.labelColor}`}>{style.label}</span>
                      <p className="text-[12px] text-[#9CA3AF] mt-1">{a.detail}</p>
                      {a.missing && <p className="text-[11px] text-[#6B7280] mt-0.5">Manque : {a.missing}</p>}
                    </div>
                    <button type="button" className="shrink-0 text-[11px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors whitespace-nowrap">
                      Améliorer le profil →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 7: Sport breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className={`${label} text-[#6B7280] mb-4`}>Athlètes par sport</h2>
          <div className="space-y-3">
            {sportsAthletesArr.map((s) => (
              <div key={s.sport}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-white">{s.sport}</span>
                  <span className="text-[12px] text-[#9CA3AF]">{s.count} ({s.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-[#2A2D35] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.count / maxSportCount) * 100}%`, backgroundColor: SPORT_COLORS[s.sport] || "#6B7280" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className={`${label} text-[#6B7280] mb-4`}>Vues par sport</h2>
          <div className="space-y-3">
            {sportsViewsArr.map((s) => (
              <div key={s.sport}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-white">{s.sport}</span>
                  <span className="text-[12px] text-[#9CA3AF]">{s.views} vues ({s.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-[#2A2D35] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.views / maxSportViews) * 100}%`, backgroundColor: SPORT_COLORS[s.sport] || "#6B7280" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
