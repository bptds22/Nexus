"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";

type PipelineStage =
  | "IDENTIFIE"
  | "CONTACTE"
  | "EN_DISCUSSION"
  | "VISITE_PLANIFIEE"
  | "ENGAGE"
  | "LETTRE_SIGNEE";

const STAGE_ORDER: PipelineStage[] = [
  "IDENTIFIE",
  "CONTACTE",
  "EN_DISCUSSION",
  "VISITE_PLANIFIEE",
  "ENGAGE",
  "LETTRE_SIGNEE",
];
const STAGE_LABEL: Record<PipelineStage, string> = {
  IDENTIFIE: "Identifié",
  CONTACTE: "Contacté",
  EN_DISCUSSION: "En discussion",
  VISITE_PLANIFIEE: "Visite planifiée",
  ENGAGE: "Engagé",
  LETTRE_SIGNEE: "Lettre signée",
};

interface Athlete {
  id: string;
  sport_id: string | null;
  school_id: string | null;
  coach_id: string | null;
  verified: boolean | null;
  profile_completion: number | null;
  cote_globale_entraineur: number | null;
  consentement_parental: boolean | null;
  consent_id: string | null;
  modified_since_verification: boolean | null;
  video_faits_saillants_url: string | null;
  video_match_complet_url: string | null;
  video_entrainement_url: string | null;
  created_at: string | null;
}

interface User {
  id: string;
  role: string | null;
  school_id: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  created_at: string | null;
}

interface PipelineEntry {
  id: string;
  recruiter_id: string | null;
  athlete_id: string | null;
  stage: string | null;
  moved_at: string | null;
  created_at: string | null;
}

interface Conversation {
  id: string;
  recruiter_id: string | null;
  coach_id: string | null;
}

interface Message {
  id: string;
  conversation_id: string | null;
  sender_id: string | null;
  created_at: string | null;
}

interface Sport { id: string; nom: string }
interface School { id: string; name: string | null; region: string | null }

interface CalibrationAlert { coachId: string; name: string; avg: number; direction: "au-dessus" | "en-dessous" }

interface WeakCoach { coachId: string; name: string; schoolName: string | null; avg: number; count: number }

interface SportRow { sportId: string; nom: string; supply: number; demand: number }
interface RegionRow { region: string; athletes: number; schools: number; recruiters: number }

export default function AdminAnalytiquePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, uRes, pRes, cRes, mRes, spRes, schRes] = await Promise.all([
        supabase
          .from("athletes")
          .select(
            "id,sport_id,school_id,coach_id,verified,profile_completion,cote_globale_entraineur,consentement_parental,consent_id,modified_since_verification,video_faits_saillants_url,video_match_complet_url,video_entrainement_url,created_at",
          ),
        supabase.from("users").select("id,role,school_id,first_name,last_name,status,created_at"),
        supabase.from("recruiter_pipeline").select("id,recruiter_id,athlete_id,stage,moved_at,created_at"),
        supabase.from("conversations").select("id,recruiter_id,coach_id"),
        supabase.from("messages").select("id,conversation_id,sender_id,created_at"),
        supabase.from("sports").select("id,nom").order("nom"),
        // Pagination obligatoire : ces régions alimentent des AGRÉGATS
        // (athlètes/écoles/recruteurs par région). Tronquée à 1000 lignes,
        // la table faisait sortir des athlètes du décompte régional sans
        // le moindre signe.
        fetchAllRows<School>((f, t) => supabase.from("schools").select("id,name,region").range(f, t), "AdminAnalytics"),
      ]);

      setAthletes((aRes.data || []) as Athlete[]);
      setUsers((uRes.data || []) as User[]);
      setPipeline((pRes.data || []) as PipelineEntry[]);
      setConversations((cRes.data || []) as Conversation[]);
      setMessages((mRes.data || []) as Message[]);
      setSports((spRes.data || []) as Sport[]);
      // schRes vient de fetchAllRows : c'est déjà un tableau, pas un { data }.
      setSchools(schRes);
      setLoading(false);
    })();
  }, [supabase]);

  // ─── Aggregates ────────────────────────────────────────────────
  const total = athletes.length;
  const verifiedCount = athletes.filter((a) => a.verified === true).length;
  const unverifiedCount = total - verifiedCount;
  const verifiedPct = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

  const coaches = users.filter((u) => u.role === "COACH");
  const coachIdsWithAthletes = new Set<string>();
  const coachAthletes = new Map<string, Athlete[]>();
  for (const a of athletes) {
    if (!a.coach_id) continue;
    coachIdsWithAthletes.add(a.coach_id);
    if (!coachAthletes.has(a.coach_id)) coachAthletes.set(a.coach_id, []);
    coachAthletes.get(a.coach_id)!.push(a);
  }
  const coachesWith = coaches.filter((c) => coachIdsWithAthletes.has(c.id)).length;
  const coachesWithout = coaches.length - coachesWith;

  // Recruiters — DB uses 'RECRUTEUR' (French) per confirmed schema
  const recruiters = users.filter((u) => u.role === "RECRUTEUR");
  const activeRecruiterIds = new Set<string>();
  for (const p of pipeline) if (p.recruiter_id) activeRecruiterIds.add(p.recruiter_id);
  const recruitersActive = recruiters.filter((r) => activeRecruiterIds.has(r.id)).length;
  const recruitersInactive = recruiters.length - recruitersActive;

  const avgCompletion = total > 0
    ? Math.round(athletes.reduce((s, a) => s + (a.profile_completion || 0), 0) / total)
    : 0;
  const completionColor = avgCompletion >= 75 ? "bg-green-500" : "bg-amber-500";

  const verificationColor = verifiedPct >= 60 ? "bg-green-500" : "bg-amber-500";

  const rated = athletes.filter((a) => typeof a.cote_globale_entraineur === "number");
  const ratedPct = total > 0 ? Math.round((rated.length / total) * 100) : 0;
  const ratedColor = ratedPct < 25 ? "bg-red-500" : ratedPct < 50 ? "bg-amber-500" : "bg-green-500";
  const platformRatingAvg = rated.length > 0
    ? rated.reduce((s, a) => s + (a.cote_globale_entraineur as number), 0) / rated.length
    : null;

  // ─── Alerts ────────────────────────────────────────────────────
  const now = Date.now();
  const DAY = 86_400_000;

  const consentIssue = athletes.filter((a) => a.consentement_parental !== true || !a.consent_id).length;
  const modifiedIssue = athletes.filter((a) => a.modified_since_verification === true).length;

  const coachesStale = coaches.filter((c) => {
    if (coachIdsWithAthletes.has(c.id)) return false;
    if (!c.created_at) return false;
    return now - new Date(c.created_at).getTime() >= 14 * DAY;
  }).length;

  const recruitersStale = recruiters.filter((r) => {
    if (activeRecruiterIds.has(r.id)) return false;
    if (!r.created_at) return false;
    return now - new Date(r.created_at).getTime() >= 14 * DAY;
  }).length;

  const stagnantPipeline = pipeline.filter((p) => {
    if (!p.moved_at) return false;
    return now - new Date(p.moved_at).getTime() > 30 * DAY;
  }).length;

  // Calibration — coaches whose athlete AVG rating deviates > 1.0 from platform
  const calibrationAlerts: CalibrationAlert[] = [];
  if (rated.length >= 10 && platformRatingAvg != null) {
    const usersById = new Map<string, User>();
    for (const u of users) usersById.set(u.id, u);
    for (const [coachId, list] of coachAthletes) {
      const coachRated = list.filter((a) => typeof a.cote_globale_entraineur === "number");
      if (coachRated.length === 0) continue;
      const coachAvg = coachRated.reduce((s, a) => s + (a.cote_globale_entraineur as number), 0) / coachRated.length;
      const diff = coachAvg - platformRatingAvg;
      if (Math.abs(diff) > 1.0) {
        const u = usersById.get(coachId);
        const name = u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Entraîneur" : "Entraîneur";
        calibrationAlerts.push({
          coachId,
          name,
          avg: coachAvg,
          direction: diff > 0 ? "au-dessus" : "en-dessous",
        });
      }
    }
  }

  // Unanswered recruiter messages (older than 48h)
  const convById = new Map<string, Conversation>();
  for (const c of conversations) convById.set(c.id, c);
  const messagesByConv = new Map<string, Message[]>();
  for (const m of messages) {
    if (!m.conversation_id) continue;
    if (!messagesByConv.has(m.conversation_id)) messagesByConv.set(m.conversation_id, []);
    messagesByConv.get(m.conversation_id)!.push(m);
  }
  for (const [, list] of messagesByConv) {
    list.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  }
  let unansweredMessages = 0;
  for (const [convId, list] of messagesByConv) {
    const conv = convById.get(convId);
    if (!conv) continue;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.sender_id !== conv.recruiter_id) continue;
      if (!m.created_at) continue;
      const ageMs = now - new Date(m.created_at).getTime();
      if (ageMs < 2 * DAY) continue;
      // Look for a subsequent coach message within 48h
      let replied = false;
      for (let j = i + 1; j < list.length; j++) {
        const n = list[j];
        if (n.sender_id !== conv.coach_id) continue;
        if (!n.created_at) continue;
        const gap = new Date(n.created_at).getTime() - new Date(m.created_at).getTime();
        if (gap <= 2 * DAY) { replied = true; break; }
      }
      if (!replied) unansweredMessages++;
    }
  }

  const activeAlerts =
    (consentIssue > 0 ? 1 : 0) +
    (modifiedIssue > 0 ? 1 : 0) +
    (coachesStale > 0 ? 1 : 0) +
    (recruitersStale > 0 ? 1 : 0) +
    (stagnantPipeline > 0 ? 1 : 0) +
    (calibrationAlerts.length > 0 ? 1 : 0) +
    (unansweredMessages > 0 ? 1 : 0);

  // ─── Profile quality ───────────────────────────────────────────
  const completionBuckets = [
    { label: "0 – 25%", tone: "red" as const, count: athletes.filter((a) => (a.profile_completion ?? 0) <= 25).length },
    { label: "26 – 50%", tone: "amber" as const, count: athletes.filter((a) => (a.profile_completion ?? 0) > 25 && (a.profile_completion ?? 0) <= 50).length },
    { label: "51 – 75%", tone: "amber" as const, count: athletes.filter((a) => (a.profile_completion ?? 0) > 50 && (a.profile_completion ?? 0) <= 75).length },
    { label: "76 – 100%", tone: "green" as const, count: athletes.filter((a) => (a.profile_completion ?? 0) > 75).length },
  ];

  const noVideoCount = athletes.filter((a) => !a.video_faits_saillants_url && !a.video_match_complet_url && !a.video_entrainement_url).length;
  const noVideoPct = total > 0 ? Math.round((noVideoCount / total) * 100) : 0;
  const noVideoColor = noVideoPct > 60 ? "bg-red-500" : noVideoPct > 40 ? "bg-amber-500" : "bg-green-500";

  const schoolsById = new Map<string, School>();
  for (const s of schools) schoolsById.set(s.id, s);
  const usersById = new Map<string, User>();
  for (const u of users) usersById.set(u.id, u);

  const weakCoaches: WeakCoach[] = [];
  for (const [coachId, list] of coachAthletes) {
    const avg = list.reduce((s, a) => s + (a.profile_completion || 0), 0) / list.length;
    if (avg < 40) {
      const u = usersById.get(coachId);
      const name = u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || "—" : "—";
      const schoolName = u?.school_id ? schoolsById.get(u.school_id)?.name || null : null;
      weakCoaches.push({ coachId, name, schoolName, avg, count: list.length });
    }
  }
  weakCoaches.sort((a, b) => a.avg - b.avg);
  const weakCoachesTop = weakCoaches.slice(0, 5);

  const verifiedUnrated = athletes.filter((a) => a.verified === true && a.cote_globale_entraineur == null).length;

  // ─── Growth intelligence ──────────────────────────────────────
  const sportsById = new Map<string, Sport>();
  for (const s of sports) sportsById.set(s.id, s);

  const supplyBySport = new Map<string, number>();
  for (const a of athletes) if (a.sport_id) supplyBySport.set(a.sport_id, (supplyBySport.get(a.sport_id) || 0) + 1);

  const athletesById = new Map<string, Athlete>();
  for (const a of athletes) athletesById.set(a.id, a);
  const demandBySport = new Map<string, Set<string>>();
  for (const p of pipeline) {
    if (!p.athlete_id || !p.recruiter_id) continue;
    const ath = athletesById.get(p.athlete_id);
    if (!ath?.sport_id) continue;
    if (!demandBySport.has(ath.sport_id)) demandBySport.set(ath.sport_id, new Set());
    demandBySport.get(ath.sport_id)!.add(p.recruiter_id);
  }
  const sportRows: SportRow[] = [];
  const sportIdsSeen = new Set<string>([...supplyBySport.keys(), ...demandBySport.keys()]);
  for (const sid of sportIdsSeen) {
    const sp = sportsById.get(sid);
    if (!sp) continue;
    sportRows.push({
      sportId: sid,
      nom: sp.nom,
      supply: supplyBySport.get(sid) || 0,
      demand: demandBySport.get(sid)?.size || 0,
    });
  }
  sportRows.sort((a, b) => b.demand - a.demand || b.supply - a.supply);

  // Regions
  const regionByAthlete = new Map<string, string>();
  for (const a of athletes) {
    if (!a.school_id) continue;
    const r = schoolsById.get(a.school_id)?.region;
    if (r) regionByAthlete.set(a.id, r);
  }
  const regionStats = new Map<string, { athletes: Set<string>; schools: Set<string>; recruiters: Set<string> }>();
  for (const a of athletes) {
    const region = a.school_id ? schoolsById.get(a.school_id)?.region : null;
    if (!region) continue;
    if (!regionStats.has(region)) regionStats.set(region, { athletes: new Set(), schools: new Set(), recruiters: new Set() });
    const s = regionStats.get(region)!;
    s.athletes.add(a.id);
    if (a.school_id) s.schools.add(a.school_id);
  }
  for (const p of pipeline) {
    if (!p.athlete_id || !p.recruiter_id) continue;
    const region = regionByAthlete.get(p.athlete_id);
    if (!region) continue;
    regionStats.get(region)?.recruiters.add(p.recruiter_id);
  }
  const regionRows: RegionRow[] = Array.from(regionStats.entries())
    .map(([region, s]) => ({ region, athletes: s.athletes.size, schools: s.schools.size, recruiters: s.recruiters.size }))
    .sort((a, b) => b.athletes - a.athletes);

  // Pipeline funnel
  const stageCounts: Record<PipelineStage, number> = {
    IDENTIFIE: 0, CONTACTE: 0, EN_DISCUSSION: 0, VISITE_PLANIFIEE: 0, ENGAGE: 0, LETTRE_SIGNEE: 0,
  };
  for (const p of pipeline) {
    if (p.stage && (STAGE_ORDER as string[]).includes(p.stage)) {
      stageCounts[p.stage as PipelineStage] += 1;
    }
  }
  const maxStage = Math.max(1, ...STAGE_ORDER.map((s) => stageCounts[s]));

  // Coach response time
  const responseDiffsHours: number[] = [];
  let unansweredActive = 0;
  let activeConvCount = 0;
  for (const [convId, list] of messagesByConv) {
    const conv = convById.get(convId);
    if (!conv) continue;
    activeConvCount++;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.sender_id !== conv.recruiter_id || !m.created_at) continue;
      let matched = false;
      for (let j = i + 1; j < list.length; j++) {
        const n = list[j];
        if (n.sender_id !== conv.coach_id || !n.created_at) continue;
        const diffH = (new Date(n.created_at).getTime() - new Date(m.created_at).getTime()) / 3_600_000;
        responseDiffsHours.push(diffH);
        matched = true;
        break;
      }
      if (!matched) unansweredActive++;
    }
  }
  const avgResponseH = responseDiffsHours.length > 0
    ? responseDiffsHours.reduce((s, v) => s + v, 0) / responseDiffsHours.length
    : null;

  // Debug logs
  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Analytique
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Santé globale de la plateforme</p>
      </div>

      {/* ─── SECTION 1 ─── */}
      <section className="space-y-4">
        <h2 className="font-head text-[13px] font-black text-white uppercase tracking-wide">Vue d&apos;ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            href="/admin/athletes"
            label="Athlètes"
            value={total}
            sub={`${verifiedCount} vérifiés · ${unverifiedCount} non vérifiés`}
            barPct={verifiedPct}
            barColor="bg-green-500"
          />
          <MetricCard
            href="/admin/athletes?filter=coach-sans-athletes"
            label="Entraîneurs"
            value={coaches.length}
            sub={`${coachesWith} avec athlètes · ${coachesWithout} sans athlètes`}
          />
          <MetricCard
            href="/admin/athletes?filter=recruteur-fantome"
            label="Recruteurs"
            value={recruiters.length}
            sub={`${recruitersActive} actifs dans le pipeline · ${recruitersInactive} sans activité`}
          />
          <MetricCard
            href="/admin/athletes?filter=completion-0-25"
            label="Complétude moyenne"
            value={`${avgCompletion}%`}
            sub="des profils sont remplis"
            barPct={avgCompletion}
            barColor={completionColor}
          />
          <MetricCard
            href="/admin/athletes?filter=non-verifie"
            label="Taux de vérification"
            value={`${verifiedPct}%`}
            sub={`${verifiedCount} / ${total} athlètes vérifiés`}
            barPct={verifiedPct}
            barColor={verificationColor}
          />
          <MetricCard
            href="/admin/athletes?filter=sans-evaluation"
            label="Taux d'évaluation"
            value={`${ratedPct}%`}
            sub={`${rated.length} / ${total} évalués par leur coach`}
            barPct={ratedPct}
            barColor={ratedColor}
          />
        </div>
      </section>

      {/* ─── SECTION 2 — Alerts ─── */}
      <section className="space-y-4">
        <h2 className="font-head text-[13px] font-black text-white uppercase tracking-wide">Alertes</h2>
        {activeAlerts === 0 ? (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[13px] text-green-300">Aucune alerte — tout est en ordre</p>
          </div>
        ) : (
          <div className="space-y-3">
            {consentIssue > 0 && (
              <AlertBanner tone="red">
                <span className="flex-1">⚠ {consentIssue} athlète(s) sans consentement parental valide</span>
                <Link href="/admin/conformite" className="text-[12px] text-white hover:underline shrink-0">Voir →</Link>
              </AlertBanner>
            )}
            {modifiedIssue > 0 && (
              <AlertBanner tone="amber">
                ⚠ {modifiedIssue} profil(s) modifié(s) depuis leur vérification — re-vérification nécessaire
              </AlertBanner>
            )}
            {coachesStale > 0 && (
              <AlertBanner tone="amber" href="/admin/athletes?filter=coach-sans-athletes">
                ⚠ {coachesStale} entraîneur(s) inscrit(s) depuis 14+ jours sans aucun athlète
              </AlertBanner>
            )}
            {recruitersStale > 0 && (
              <AlertBanner tone="amber" href="/admin/athletes?filter=recruteur-fantome">
                ⚠ {recruitersStale} recruteur(s) inscrit(s) sans aucune activité dans le pipeline
              </AlertBanner>
            )}
            {stagnantPipeline > 0 && (
              <AlertBanner tone="amber" href="/admin/athletes?filter=pipeline-stagnant">
                ⚠ {stagnantPipeline} athlète(s) stagnant(s) depuis 30+ jours dans le pipeline de recrutement
              </AlertBanner>
            )}
            {calibrationAlerts.map((ca) => (
              <AlertBanner key={ca.coachId} tone="amber">
                ⚠ L&apos;entraîneur {ca.name} évalue significativement {ca.direction} de la moyenne ({ca.avg.toFixed(1)} vs {(platformRatingAvg as number).toFixed(1)})
              </AlertBanner>
            ))}
            {unansweredMessages > 0 && (
              <AlertBanner tone="amber">
                ⚠ {unansweredMessages} message(s) de recruteurs sans réponse depuis 48h+
              </AlertBanner>
            )}
          </div>
        )}
      </section>

      {/* ─── SECTION 3 — Profile quality ─── */}
      <section className="space-y-4">
        <h2 className="font-head text-[13px] font-black text-white uppercase tracking-wide">Qualité des profils</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
            <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold mb-3">Distribution de complétude</h3>
            <ul className="space-y-1">
              {completionBuckets.map((b) => {
                const dot = b.tone === "green" ? "bg-green-500" : b.tone === "amber" ? "bg-amber-500" : "bg-red-500";
                const slug =
                  b.label === "0 – 25%" ? "completion-0-25" :
                  b.label === "26 – 50%" ? "completion-26-50" :
                  b.label === "51 – 75%" ? "completion-51-75" :
                  "completion-76-100";
                return (
                  <li key={b.label}>
                    <Link
                      href={`/admin/athletes?filter=${slug}`}
                      className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-[13px] text-[#E0E0E0]">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        {b.label}
                      </span>
                      <span className="text-[13px] text-white font-bold tabular-nums">{b.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <Link
            href="/admin/athletes?filter=sans-video"
            className="relative group bg-[#1A1D24] border border-white/10 rounded-xl p-5 block cursor-pointer hover:bg-[#1E2129] hover:border-white/20 transition-colors"
          >
            <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Profils sans vidéo</h3>
            <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{noVideoCount} / {total}</p>
            <div className="mt-3 h-1.5 bg-[#111317] rounded-full overflow-hidden">
              <div className={`h-full ${noVideoColor}`} style={{ width: `${noVideoPct}%` }} />
            </div>
            <p className="text-[12px] text-[#9CA3AF] mt-2">{noVideoPct}% des athlètes n&apos;ont aucune vidéo</p>
            <span className="absolute top-3 right-3 text-[#6b7280] opacity-0 group-hover:opacity-100 transition-opacity text-[14px]">→</span>
          </Link>

          <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
            <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold mb-3">Entraîneurs avec profils faibles</h3>
            {weakCoachesTop.length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF]">Tous les entraîneurs ont des profils au-dessus de 40%</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2D3748]">
                    <th className="text-left text-[10px] text-[#6b7280] uppercase tracking-wider font-bold py-1.5">Coach</th>
                    <th className="text-left text-[10px] text-[#6b7280] uppercase tracking-wider font-bold py-1.5">École</th>
                    <th className="text-right text-[10px] text-[#6b7280] uppercase tracking-wider font-bold py-1.5 w-16">Moy.</th>
                    <th className="text-right text-[10px] text-[#6b7280] uppercase tracking-wider font-bold py-1.5 w-12">#</th>
                  </tr>
                </thead>
                <tbody>
                  {weakCoachesTop.map((c) => (
                    <tr
                      key={c.coachId}
                      onClick={() => router.push("/admin/athletes?filter=coach-sans-athletes")}
                      className="border-b border-[#2D3748]/50 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <td className="py-1.5 text-[12px] text-white">{c.name}</td>
                      <td className="py-1.5 text-[12px] text-[#9CA3AF] truncate max-w-[140px]">{c.schoolName || "—"}</td>
                      <td className="py-1.5 text-[12px] text-right tabular-nums text-red-400 font-bold">{Math.round(c.avg)}%</td>
                      <td className="py-1.5 text-[12px] text-right tabular-nums text-[#E0E0E0]">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Link
            href="/admin/athletes?filter=verifie-sans-evaluation"
            className="relative group bg-[#1A1D24] border border-white/10 rounded-xl p-5 block cursor-pointer hover:bg-[#1E2129] hover:border-white/20 transition-colors"
          >
            <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Vérifiés sans évaluation</h3>
            <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{verifiedUnrated}</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">athlètes vérifiés mais non évalués par leur coach</p>
            <span className="absolute top-3 right-3 text-[#6b7280] opacity-0 group-hover:opacity-100 transition-opacity text-[14px]">→</span>
          </Link>
        </div>
      </section>

      {/* ─── SECTION 4 — Growth intelligence ─── */}
      <section className="space-y-4">
        <h2 className="font-head text-[13px] font-black text-white uppercase tracking-wide">Intelligence de croissance</h2>

        {/* Card A — Supply/demand per sport */}
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold mb-3">Offre / demande par sport</h3>
          {sportRows.length === 0 ? (
            <p className="text-[12px] text-[#6b7280]">Aucune donnée.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  <th className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2">Sport</th>
                  <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Athlètes</th>
                  <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Recruteurs</th>
                  <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-36">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {sportRows.map((s) => {
                  let badge: React.ReactNode;
                  if (s.demand === 0) badge = <span className="text-[#4a4d56]">—</span>;
                  else if (s.supply < s.demand * 3) badge = <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400">⚠ Déséquilibre</span>;
                  else badge = <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-500/20 text-green-400">✓ OK</span>;
                  return (
                    <tr
                      key={s.sportId}
                      onClick={() => router.push(`/admin/sports/${s.sportId}`)}
                      className="border-b border-[#2D3748]/50 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2 text-[13px] text-white font-bold">{s.nom}</td>
                      <td className="py-2 text-[13px] text-[#E0E0E0] text-right tabular-nums">{s.supply}</td>
                      <td className="py-2 text-[13px] text-[#E0E0E0] text-right tabular-nums">{s.demand}</td>
                      <td className="py-2 text-right">{badge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Card B — Regional coverage */}
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold mb-3">Couverture régionale</h3>
          {regionRows.length === 0 ? (
            <p className="text-[12px] text-[#6b7280]">Aucune donnée.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  <th className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2">Région</th>
                  <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Athlètes</th>
                  <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-24">Écoles</th>
                  <th className="text-right text-[11px] text-[#6b7280] uppercase tracking-wider font-bold py-2 w-28">Recruteurs</th>
                </tr>
              </thead>
              <tbody>
                {regionRows.map((r) => (
                  <tr key={r.region} className="border-b border-[#2D3748]/50">
                    <td className="py-2 text-[13px] text-white">{r.region}</td>
                    <td className="py-2 text-[13px] text-[#E0E0E0] text-right tabular-nums">{r.athletes}</td>
                    <td className="py-2 text-[13px] text-[#E0E0E0] text-right tabular-nums">{r.schools}</td>
                    <td className="py-2 text-[13px] text-[#E0E0E0] text-right tabular-nums">{r.recruiters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Card C — Recruitment funnel */}
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold mb-3">Entonnoir de recrutement</h3>
          <ul className="space-y-2">
            {STAGE_ORDER.map((stage, i) => {
              const count = stageCounts[stage];
              const prev = i === 0 ? null : stageCounts[STAGE_ORDER[i - 1]];
              const dropPct = prev != null && prev > 0 ? Math.round(((prev - count) / prev) * 100) : null;
              const widthPct = Math.round((count / maxStage) * 100);
              return (
                <li key={stage} className="flex items-center gap-3">
                  <span className="text-[12px] text-[#9CA3AF] w-36 shrink-0">{STAGE_LABEL[stage]}</span>
                  <div className="flex-1 h-6 bg-[#111317] rounded overflow-hidden relative">
                    <div className="h-full bg-[#E63946]/70" style={{ width: `${widthPct}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-[11px] text-white font-bold">{count}</span>
                  </div>
                  <span className="text-[11px] text-[#6b7280] w-24 text-right tabular-nums shrink-0">
                    {dropPct == null ? "" : dropPct > 0 ? `−${dropPct}%` : dropPct < 0 ? `+${Math.abs(dropPct)}%` : "0%"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Card D — Coach response time */}
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <h3 className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Réactivité des entraîneurs</h3>
          {activeConvCount === 0 ? (
            <p className="text-[12px] text-[#9CA3AF] mt-2">Aucune donnée de messagerie</p>
          ) : (
            <>
              <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">
                Temps de réponse moyen : {avgResponseH != null ? `${avgResponseH.toFixed(1)}h` : "—"}
              </p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">
                {activeConvCount} conversation{activeConvCount > 1 ? "s" : ""} active{activeConvCount > 1 ? "s" : ""} · {unansweredActive} message{unansweredActive > 1 ? "s" : ""} sans réponse
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label, value, sub, barPct, barColor, href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  barPct?: number;
  barColor?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">{label}</p>
      <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[12px] text-[#9CA3AF] mt-1">{sub}</p>}
      {barPct != null && (
        <div className="mt-3 h-1.5 bg-[#111317] rounded-full overflow-hidden">
          <div className={`h-full ${barColor || "bg-green-500"}`} style={{ width: `${Math.max(0, Math.min(100, barPct))}%` }} />
        </div>
      )}
      {href && (
        <span className="absolute top-3 right-3 text-[#6b7280] opacity-0 group-hover:opacity-100 transition-opacity text-[14px]">→</span>
      )}
    </>
  );
  const base = "relative bg-[#1A1D24] border border-white/10 rounded-xl p-5 block";
  if (href) {
    return (
      <Link href={href} className={`${base} group cursor-pointer hover:bg-[#1E2129] hover:border-white/20 transition-colors`}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

function AlertBanner({ tone, children, href }: { tone: "red" | "amber"; children: React.ReactNode; href?: string }) {
  const cls = tone === "red"
    ? "bg-red-500/10 border-red-500/30 text-red-300"
    : "bg-amber-500/10 border-amber-500/30 text-amber-300";
  const base = `flex items-center gap-3 border rounded-xl px-4 py-3 text-[13px] ${cls}`;
  if (href) {
    return (
      <Link href={href} className={`${base} hover:bg-opacity-20 hover:underline cursor-pointer transition-colors`}>
        {children}
      </Link>
    );
  }
  return <div className={base}>{children}</div>;
}
