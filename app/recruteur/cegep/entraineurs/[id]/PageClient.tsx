"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import FeatureGate from "@/components/subscription/FeatureGate";
import CegepGate from "@/components/subscription/CegepGate";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { getCurrentSeason } from "@/lib/utils/season";
/* ═══════════════════════════════════════════════════════════════
   Recruiter Detail — Admin CÉGEP coaching tool
   Shows individual recruiter performance, pipeline, activity,
   benchmark comparisons, and placement history.
═══════════════════════════════════════════════════════════════ */

/* ── Mock Data ─────────────────────────────────────────────── */

interface RecruiterProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  sports: string[];
  division: string;
  email: string;
  phone?: string;
  status: "active" | "inactive" | "season_ended";
  lastLogin: string;
  memberSince: string;
  kpis: {
    favorites: number; favoritesTrend: number;
    messages30d: number; messagesTrend: number;
    responseRate: number; avgResponseHours: number;
    pipelineActive: number; pipelineCommitment: number;
    recrues: number;
    conversionRate: number;
  };
  pipeline: { identifie: number; contacte: number; discussion: number; visite: number; engage: number; lettre: number; retire: number };
  activityWeekly: { messages: number[]; profiles: number[] };
  sportsBreakdown: { sport: string; count: number; percent: number }[];
  regions: { name: string; count: number }[];
  recrues: { athlete: string; sport: string; position: string; school: string; signedAt: string; durationDays: number }[];
  pipelineAthletes: { id: string; athlete: string; sport: string; position: string; school: string; status: string; daysSince: number; note: string }[];
  stageTimings: { stage: string; avgDays: number; benchmark: number }[];
}

const PROFILES: Record<string, RecruiterProfile> = {
  "trainer-1": {
    id: "trainer-1", name: "Éric Bergeron", firstName: "Éric", lastName: "Bergeron",
    sports: ["Football", "Hockey"], division: "D1",
    email: "e.bergeron@cegep-garneau.qc.ca", phone: "418-555-0142",
    status: "active", lastLogin: "2026-03-24T14:30:00Z", memberSince: "2025-09",
    kpis: { favorites: 22, favoritesTrend: 4, messages30d: 22, messagesTrend: 8, responseRate: 78, avgResponseHours: 8, pipelineActive: 18, pipelineCommitment: 3, recrues: 5, conversionRate: 23 },
    pipeline: { identifie: 8, contacte: 4, discussion: 3, visite: 2, engage: 2, lettre: 1, retire: 2 },
    activityWeekly: { messages: [3, 5, 2, 4, 6, 3, 4, 5], profiles: [8, 12, 6, 10, 15, 9, 11, 14] },
    sportsBreakdown: [{ sport: "Football", count: 14, percent: 64 }, { sport: "Hockey", count: 8, percent: 36 }],
    regions: [{ name: "Capitale-Nationale", count: 10 }, { name: "Montérégie", count: 5 }, { name: "Montréal", count: 4 }, { name: "Saguenay", count: 3 }],
    recrues: [
      { athlete: "Marc-Antoine Tremblay", sport: "Football", position: "QB", school: "É.S. Saint-Jean-Eudes", signedAt: "2026-03-12", durationDays: 45 },
      { athlete: "Thomas Leclerc", sport: "Football", position: "RB", school: "É.S. De Mortagne", signedAt: "2026-02-25", durationDays: 62 },
      { athlete: "Samuel Côté", sport: "Football", position: "LB", school: "É.S. Roger-Comtois", signedAt: "2026-01-18", durationDays: 38 },
      { athlete: "Émile Bouchard", sport: "Hockey", position: "C", school: "É.S. De Rochebelle", signedAt: "2026-01-05", durationDays: 55 },
      { athlete: "Olivier Nadeau", sport: "Football", position: "OL", school: "É.S. De Mortagne", signedAt: "2025-12-15", durationDays: 71 },
    ],
    pipelineAthletes: [
      { id: "pa-1", athlete: "William Gagnon", sport: "Football", position: "WR", school: "É.S. Le Sommet", status: "engage", daysSince: 5, note: "Visite prévue vendredi" },
      { id: "pa-2", athlete: "Nathan Roy", sport: "Football", position: "DB", school: "É.S. Armand-Corbeil", status: "engage", daysSince: 8, note: "En attente de réponse parents" },
      { id: "pa-3", athlete: "Félix Bouchard", sport: "Hockey", position: "D", school: "É.S. Saint-Joseph", status: "visite", daysSince: 3, note: "" },
      { id: "pa-4", athlete: "Anthony Simard", sport: "Hockey", position: "G", school: "É.S. De Mortagne", status: "visite", daysSince: 12, note: "Hésite entre Garneau et Limoilou" },
      { id: "pa-5", athlete: "Charles Pelletier", sport: "Football", position: "TE", school: "É.S. Roger-Comtois", status: "discussion", daysSince: 7, note: "" },
      { id: "pa-6", athlete: "Raphaël Dubois", sport: "Football", position: "LB", school: "É.S. Le Tremplin", status: "discussion", daysSince: 15, note: "Peu réactif" },
      { id: "pa-7", athlete: "Maxime Lévesque", sport: "Football", position: "RB", school: "É.S. Curé-Antoine-Labelle", status: "discussion", daysSince: 22, note: "Relance envoyée" },
      { id: "pa-8", athlete: "Zachary Martin", sport: "Football", position: "OL", school: "É.S. Pierre-Laporte", status: "contacte", daysSince: 4, note: "" },
    ],
    stageTimings: [
      { stage: "Identifié → Contacté", avgDays: 3, benchmark: 5 },
      { stage: "Contacté → Discussion", avgDays: 7, benchmark: 6 },
      { stage: "Discussion → Visite", avgDays: 12, benchmark: 14 },
      { stage: "Visite → Engagé", avgDays: 5, benchmark: 8 },
    ],
  },
  "trainer-2": {
    id: "trainer-2", name: "Julie Lapointe", firstName: "Julie", lastName: "Lapointe",
    sports: ["Basketball"], division: "D1",
    email: "j.lapointe@cegep-garneau.qc.ca",
    status: "active", lastLogin: "2026-03-25T09:00:00Z", memberSince: "2025-08",
    kpis: { favorites: 8, favoritesTrend: 2, messages30d: 18, messagesTrend: 3, responseRate: 92, avgResponseHours: 3, pipelineActive: 10, pipelineCommitment: 2, recrues: 2, conversionRate: 18 },
    pipeline: { identifie: 4, contacte: 2, discussion: 2, visite: 1, engage: 1, lettre: 0, retire: 1 },
    activityWeekly: { messages: [2, 3, 4, 2, 3, 2, 3, 3], profiles: [5, 7, 6, 8, 6, 5, 7, 6] },
    sportsBreakdown: [{ sport: "Basketball", count: 10, percent: 100 }],
    regions: [{ name: "Capitale-Nationale", count: 6 }, { name: "Montréal", count: 4 }],
    recrues: [
      { athlete: "Karim Diallo", sport: "Basketball", position: "PG", school: "É.S. De Rochebelle", signedAt: "2026-02-10", durationDays: 40 },
      { athlete: "Jayden Williams", sport: "Basketball", position: "SF", school: "É.S. Saint-Jean-Eudes", signedAt: "2025-12-20", durationDays: 58 },
    ],
    pipelineAthletes: [
      { id: "pa-b1", athlete: "Malik Thompson", sport: "Basketball", position: "C", school: "É.S. Mont-Royal", status: "engage", daysSince: 6, note: "Très intéressé" },
      { id: "pa-b2", athlete: "Lucas Tremblay", sport: "Basketball", position: "SG", school: "É.S. Louis-Riel", status: "visite", daysSince: 10, note: "" },
    ],
    stageTimings: [
      { stage: "Identifié → Contacté", avgDays: 2, benchmark: 5 },
      { stage: "Contacté → Discussion", avgDays: 5, benchmark: 6 },
      { stage: "Discussion → Visite", avgDays: 10, benchmark: 14 },
      { stage: "Visite → Engagé", avgDays: 6, benchmark: 8 },
    ],
  },
  "trainer-3": {
    id: "trainer-3", name: "Alexandre Simard", firstName: "Alexandre", lastName: "Simard",
    sports: ["Hockey"], division: "D1",
    email: "a.simard@cegep-garneau.qc.ca",
    status: "active", lastLogin: "2026-03-25T07:45:00Z", memberSince: "2026-01",
    kpis: { favorites: 4, favoritesTrend: 4, messages30d: 15, messagesTrend: 15, responseRate: 65, avgResponseHours: 14, pipelineActive: 6, pipelineCommitment: 0, recrues: 0, conversionRate: 0 },
    pipeline: { identifie: 3, contacte: 2, discussion: 1, visite: 0, engage: 0, lettre: 0, retire: 0 },
    activityWeekly: { messages: [0, 0, 1, 2, 3, 3, 3, 3], profiles: [0, 2, 3, 5, 6, 7, 8, 9] },
    sportsBreakdown: [{ sport: "Hockey", count: 6, percent: 100 }],
    regions: [{ name: "Capitale-Nationale", count: 4 }, { name: "Chaudière-Appalaches", count: 2 }],
    recrues: [],
    pipelineAthletes: [
      { id: "pa-h1", athlete: "Mathis Fortin", sport: "Hockey", position: "C", school: "É.S. De Rochebelle", status: "discussion", daysSince: 8, note: "Premier contact positif" },
    ],
    stageTimings: [
      { stage: "Identifié → Contacté", avgDays: 6, benchmark: 5 },
      { stage: "Contacté → Discussion", avgDays: 9, benchmark: 6 },
    ],
  },
  "trainer-4": {
    id: "trainer-4", name: "Martin Dufour", firstName: "Martin", lastName: "Dufour",
    sports: ["Football", "Soccer"], division: "D2",
    email: "m.dufour@cegep-garneau.qc.ca", phone: "418-555-0198",
    status: "active", lastLogin: "2026-02-10T14:00:00Z", memberSince: "2025-10",
    kpis: { favorites: 3, favoritesTrend: -1, messages30d: 2, messagesTrend: -10, responseRate: 45, avgResponseHours: 36, pipelineActive: 4, pipelineCommitment: 0, recrues: 0, conversionRate: 0 },
    pipeline: { identifie: 2, contacte: 1, discussion: 1, visite: 0, engage: 0, lettre: 0, retire: 1 },
    activityWeekly: { messages: [3, 2, 1, 0, 0, 1, 0, 0], profiles: [5, 4, 2, 1, 0, 1, 0, 0] },
    sportsBreakdown: [{ sport: "Football", count: 2, percent: 50 }, { sport: "Soccer", count: 2, percent: 50 }],
    regions: [{ name: "Montérégie", count: 3 }, { name: "Montréal", count: 1 }],
    recrues: [],
    pipelineAthletes: [],
    stageTimings: [
      { stage: "Identifié → Contacté", avgDays: 10, benchmark: 5 },
      { stage: "Contacté → Discussion", avgDays: 14, benchmark: 6 },
    ],
  },
  "trainer-6": {
    id: "trainer-6", name: "Benoît Pelletier", firstName: "Benoît", lastName: "Pelletier",
    sports: ["Soccer"], division: "D3",
    email: "b.pelletier@cegep-garneau.qc.ca",
    status: "season_ended", lastLogin: "2026-02-15T16:00:00Z", memberSince: "2025-09",
    kpis: { favorites: 1, favoritesTrend: 0, messages30d: 0, messagesTrend: -3, responseRate: 70, avgResponseHours: 12, pipelineActive: 0, pipelineCommitment: 0, recrues: 0, conversionRate: 0 },
    pipeline: { identifie: 0, contacte: 0, discussion: 0, visite: 0, engage: 0, lettre: 0, retire: 3 },
    activityWeekly: { messages: [2, 1, 1, 0, 0, 0, 0, 0], profiles: [4, 3, 2, 1, 0, 0, 0, 0] },
    sportsBreakdown: [{ sport: "Soccer", count: 3, percent: 100 }],
    regions: [{ name: "Capitale-Nationale", count: 3 }],
    recrues: [],
    pipelineAthletes: [],
    stageTimings: [],
  },
};

/* ── Shared color maps ─────────────────────────────────────── */

const SPORT_COLORS: Record<string, string> = {
  Football: "bg-[#3B82F6]/20 text-[#60A5FA]",
  Hockey: "bg-[#8B5CF6]/20 text-[#A78BFA]",
  Basketball: "bg-[#F97316]/20 text-[#FB923C]",
  Volleyball: "bg-[#22C55E]/20 text-[#4ADE80]",
  Soccer: "bg-[#06B6D4]/20 text-[#22D3EE]",
};

const SPORT_BAR_COLORS: Record<string, string> = {
  Football: "#3B82F6", Hockey: "#8B5CF6", Basketball: "#F97316",
  Volleyball: "#22C55E", Soccer: "#06B6D4",
};

const STATUS_STYLES: Record<string, { dot: string; label: string; pillClass: string }> = {
  active: { dot: "#22C55E", label: "Actif", pillClass: "bg-[#22C55E]/15 text-[#22C55E]" },
  inactive: { dot: "#F59E0B", label: "Inactif", pillClass: "bg-[#F59E0B]/15 text-[#F59E0B]" },
  season_ended: { dot: "#6B7280", label: "Saison terminée", pillClass: "bg-[#6B7280]/15 text-[#9CA3AF]" },
};

const PIPELINE_LABELS: Record<string, { label: string; color: string }> = {
  identifie: { label: "Identifié", color: "#6B7280" },
  contacte: { label: "Contacté", color: "#6B7280" },
  discussion: { label: "Discussion", color: "#E63946" },
  visite: { label: "Visite", color: "#E63946" },
  engage: { label: "Engagé", color: "#E63946" },
  lettre: { label: "Lettre signée", color: "#E63946" },
};

/* ── Helpers ────────────────────────────────────────────────── */

function loginColor(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 7) return "#22C55E";
  if (days <= 30) return "#F59E0B";
  return "#E63946";
}

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

function frenchDate(iso: string): string {
  const months = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const d = new Date(iso);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Page ───────────────────────────────────────────────────── */

export default function Page() {
  return (
    <FeatureGate feature="cegep_management" requiredTier="all_star" adminBypass={true}>
      <RecruiterDetailWrapper />
    </FeatureGate>
  );
}

function RecruiterDetailWrapper() {
  return <CegepGate><RecruiterDetailPage /></CegepGate>;
}

function RecruiterDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const profile = PROFILES[id];
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { tier } = useSubscription();
  const canMessageCoach = tier === "pro" || tier === "all_star";

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  if (!profile) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto">
        <Link href="/recruteur/cegep/recruteurs" className="text-[13px] text-[#6B7280] hover:text-white transition-colors">← Retour aux recruteurs</Link>
        <div className="mt-12 text-center text-[#6B7280]">Recruteur introuvable</div>
      </div>
    );
  }

  const k = profile.kpis;
  const p = profile.pipeline;
  const pipelineTotal = p.identifie + p.contacte + p.discussion + p.visite + p.engage + p.lettre;
  const maxRegion = Math.max(...profile.regions.map((r) => r.count), 1);

  const statusStyle = STATUS_STYLES[profile.status];
  const initials = profile.firstName.charAt(0) + profile.lastName.charAt(0);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">

      {/* Breadcrumb */}
      <Link href="/recruteur/cegep/recruteurs" className="inline-flex items-center gap-1.5 text-[13px] text-[#6B7280] hover:text-white transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        Retour aux recruteurs
      </Link>

      {/* ── Profile Header Card ─────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-[#2A2D35] flex items-center justify-center text-[18px] font-bold text-[#9CA3AF] shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="font-head text-xl font-black text-white uppercase tracking-tight">{profile.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {profile.sports.map((s) => (
                  <span key={s} className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${SPORT_COLORS[s] || "bg-[#374151]/30 text-[#9CA3AF]"}`}>{s}</span>
                ))}
                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E63946]/15 text-[#E63946]">{profile.division}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusStyle.pillClass}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
                  {statusStyle.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px] text-[#6B7280]">
                <a href={`mailto:${profile.email}`} className="hover:text-[#E63946] transition-colors">{profile.email}</a>
                {profile.phone && <span>{profile.phone}</span>}
                <span>Sur Nexus depuis {profile.memberSince.replace("-", "/")}</span>
              </div>
              <div className="mt-1.5 text-[12px]" style={{ color: loginColor(profile.lastLogin) }}>
                Dernière connexion : {relativeTime(profile.lastLogin)}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {canMessageCoach && (
              <button type="button" onClick={() => showToast("Messagerie interne (Phase 2)")} className="px-4 h-9 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-[0.1em] hover:bg-[#D42B22] transition-colors">
                Envoyer un message
              </button>
            )}
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="w-9 h-9 rounded-lg border border-[#2a2d36] flex items-center justify-center text-[#6B7280] hover:text-white hover:border-white/20 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-[#1A1D24] border border-[#2a2d36] rounded-lg shadow-xl z-40 w-52 py-1">
                    <button type="button" onClick={() => { setMenuOpen(false); showToast("Réassignation (Phase 2)"); }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors">Réassigner ses athlètes</button>
                    <button type="button" onClick={() => { setMenuOpen(false); showToast("Recruteur désactivé (POC)"); }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#E63946] hover:bg-[#E63946]/10 transition-colors">Désactiver ce recruteur</button>
                    <button type="button" onClick={() => { setMenuOpen(false); showToast("Export PDF (Phase 2)"); }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#9CA3AF] hover:text-white hover:bg-white/5 transition-colors">Exporter les stats</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 5 KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { val: k.favorites, label: "Favoris actifs", trend: `+${k.favoritesTrend} ce mois`, trendColor: k.favoritesTrend > 0 ? "#22C55E" : "#E63946" },
          { val: k.messages30d, label: "Messages envoyés", trend: `${k.messagesTrend > 0 ? "+" : ""}${k.messagesTrend} vs mois dernier`, trendColor: k.messagesTrend > 0 ? "#22C55E" : "#E63946" },
          { val: k.pipelineActive, label: "Pipeline actif", trend: `${k.pipelineCommitment} en commitment`, trendColor: "#6B7280" },
          { val: k.recrues, label: "Recrues confirmées", trend: `Saison ${getCurrentSeason()}`, trendColor: "#6B7280", valColor: "#E63946" },
          { val: `${k.conversionRate}%`, label: "Taux de conversion", trend: "Identifié → Lettre", trendColor: "#6B7280" },
        ].map((c, i) => (
          <div key={i} className="group bg-[#1A1D24] rounded-xl border border-[#1e2128] hover:border-[#E63946]/20 p-4 overflow-hidden transition-all relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <p className="font-head font-black text-[28px] leading-none" style={{ color: (c as { valColor?: string }).valColor || "#FFFFFF" }}>{c.val}</p>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6B7280] mt-1">{c.label}</p>
            <p className="text-[10px] mt-1" style={{ color: c.trendColor }}>{c.trend}</p>
          </div>
        ))}
      </div>

      {/* ── Section 1: Pipeline Breakdown ───────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6 space-y-5">
        <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6B7280]">
          Pipeline de recrutement — {profile.firstName} {profile.lastName}
        </h2>

        {/* Funnel bar */}
        {pipelineTotal > 0 ? (
          <>
            <div className="flex items-center gap-1">
              {(["identifie", "contacte", "discussion", "visite", "engage", "lettre"] as const).map((key, i) => {
                const count = p[key];
                const cfg = PIPELINE_LABELS[key];
                const widthPct = Math.max((count / pipelineTotal) * 100, count > 0 ? 8 : 2);
                return (
                  <div key={key} className="flex items-center gap-1">
                    {i > 0 && <svg width="8" height="12" viewBox="0 0 8 12" className="shrink-0 text-[#2D3748]"><path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                    <div className="text-center" style={{ width: `${widthPct}%`, minWidth: 48 }}>
                      <div className="h-8 rounded flex items-center justify-center text-[12px] font-bold" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
                        {count}
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: cfg.color }}>{cfg.label}</p>
                    </div>
                  </div>
                );
              })}
              {p.retire > 0 && (
                <div className="ml-3 text-center" style={{ minWidth: 48 }}>
                  <div className="h-8 rounded flex items-center justify-center text-[12px] font-bold bg-[#374151]/30 text-[#6B7280]">{p.retire}</div>
                  <p className="text-[9px] font-bold uppercase tracking-wider mt-1 text-[#6B7280]">Retiré</p>
                </div>
              )}
            </div>

          </>
        ) : (
          <p className="text-[13px] text-[#6B7280]">Aucun athlète dans le pipeline actuellement.</p>
        )}
      </div>

      {/* ── Section 2: Athletes in Pipeline ─────────────────── */}
      {profile.pipelineAthletes.length > 0 && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6B7280]">Ses athlètes suivis</h2>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#E63946]/15 text-[#E63946] text-[11px] font-bold">{profile.pipelineAthletes.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a4d56]">
                  <th className="py-2 pr-3">Athlète</th>
                  <th className="py-2 pr-3">Sport / Pos.</th>
                  <th className="py-2 pr-3">École</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Depuis</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {profile.pipelineAthletes.slice(0, 10).map((a) => {
                  const cfg = PIPELINE_LABELS[a.status] || { label: a.status, color: "#6B7280" };
                  const daysColor = a.daysSince > 30 ? "#E63946" : a.daysSince > 14 ? "#F59E0B" : "#9CA3AF";
                  return (
                    <tr key={a.id} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                      <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{a.athlete}</td>
                      <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.sport} · {a.position}</td>
                      <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.school}</td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] font-semibold" style={{ color: daysColor }}>{a.daysSince}j</td>
                      <td className="py-2.5 text-[12px] text-[#6B7280] max-w-[180px] truncate">{a.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {profile.pipelineAthletes.length > 10 && (
            <p className="text-[12px] text-[#E63946] font-bold mt-3 cursor-pointer hover:text-[#D42B22]">Voir les {profile.pipelineAthletes.length} athlètes →</p>
          )}
        </div>
      )}

      {/* ── Section 3: Activity Chart (messages only) ────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-4">Messages envoyés — 8 dernières semaines</h2>
        <div className="flex items-end gap-2 h-[120px]">
          {profile.activityWeekly.messages.map((msg, i) => {
            const maxVal = Math.max(...profile.activityWeekly.messages, 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end justify-center" style={{ height: 100 }}>
                  <div className="w-[60%] rounded-t-sm bg-[#E63946]" style={{ height: `${(msg / maxVal) * 100}%`, minHeight: msg > 0 ? 4 : 0 }} title={`${msg} messages`} />
                </div>
                <span className="text-[9px] text-[#4a4d56]">S{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Recrues Confirmées ───────────────────── */}
      {profile.recrues.length > 0 && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-4">
            Recrues confirmées par {profile.firstName} {profile.lastName}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a4d56]">
                  <th className="py-2 pr-3">Athlète</th>
                  <th className="py-2 pr-3">Sport / Pos.</th>
                  <th className="py-2 pr-3">École d&apos;origine</th>
                  <th className="py-2">Date signature</th>
                </tr>
              </thead>
              <tbody>
                {profile.recrues.map((r, i) => (
                  <tr key={i} className="border-t border-[#1e2128]">
                    <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{r.athlete}</td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{r.sport} · {r.position}</td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{r.school}</td>
                    <td className="py-2.5 text-[12px] text-[#9CA3AF]">{frenchDate(r.signedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 5 + 6: Sport breakdown + Regions (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sport breakdown */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-4">Répartition par sport</h2>
          <div className="space-y-3">
            {profile.sportsBreakdown.map((s) => (
              <div key={s.sport}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-white">{s.sport}</span>
                  <span className="text-[12px] text-[#9CA3AF]">{s.count} athlètes ({s.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-[#2A2D35] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${s.percent}%`, backgroundColor: SPORT_BAR_COLORS[s.sport] || "#6B7280" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Regions */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mb-4">Régions sources</h2>
          <div className="space-y-3">
            {profile.regions.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-white">{r.name}</span>
                  <span className="text-[12px] text-[#9CA3AF]">{r.count} athlètes</span>
                </div>
                <div className="w-full h-2 bg-[#2A2D35] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#E63946] transition-all" style={{ width: `${(r.count / maxRegion) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#E63946]/30 text-white text-[13px] font-semibold px-5 py-3 rounded-lg shadow-xl z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
