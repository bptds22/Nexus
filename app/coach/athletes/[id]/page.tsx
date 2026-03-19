"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MOCK_ATHLETES } from "@/lib/mock/athletes-mock-data";
import type { Athlete } from "@/lib/types/models";
import StarRating from "@/components/ui/StarRating";

/* ══════════════════════════════════════════════════════════════
   STYLE CONSTANTS
══════════════════════════════════════════════════════════════ */

const cardCls = "bg-[#1A1D24] rounded-[14px] border border-[#1e2128]";
const sectionTitle = "font-head font-bold text-[14px] tracking-[0.2em] uppercase text-white mb-5";
const labelCls = "text-[12px] text-[#6b7280]";
const valueCls = "text-[15px] font-semibold text-white";
const NOW = new Date("2026-03-09");

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

function age(dob: string): number {
  const d = new Date(dob);
  let a = NOW.getFullYear() - d.getFullYear();
  if (NOW.getMonth() < d.getMonth() || (NOW.getMonth() === d.getMonth() && NOW.getDate() < d.getDate())) a--;
  return a;
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const days = Math.floor((NOW.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

function nudge(a: Athlete): { text: string; color: string } {
  const p = a.profileCompletion;
  if (p >= 95) return { text: "Profil complet", color: "#22C55E" };
  if (p >= 70) {
    const missing = !a.hasVideo ? "une vidéo highlight" : !a.hasStats ? "les statistiques" : !a.hasPhoto ? "une photo" : "les détails manquants";
    return { text: `Presque complet — Ajouter ${missing}`, color: "#3B82F6" };
  }
  if (p >= 40) {
    const tip = !a.hasVideo ? "Ajouter une vidéo highlight" : !a.hasStats ? "Compléter les statistiques" : "Compléter le profil";
    return { text: tip, color: "#6B7280" };
  }
  return { text: "Profil incomplet", color: "#EF4444" };
}

function formatDob(dob: string): string {
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(dob);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function coachStars(rating: number): number {
  return Math.round(rating);
}

function sportQuickStats(a: Athlete): { icon: React.ReactNode; val: string; lbl: string }[] {
  const s = a.stats || {};
  const base: { icon: React.ReactNode; val: string; lbl: string }[] = [
    { icon: <RulerIcon />, val: a.heightCm ? `${a.heightCm} cm` : "—", lbl: "Taille" },
    { icon: <WeightIcon />, val: a.weightKg ? `${a.weightKg} kg` : "—", lbl: "Poids" },
    { icon: <CalendarIcon />, val: `${age(a.dateOfBirth)} ans`, lbl: "Âge" },
  ];
  switch (a.sport) {
    case "Football":
      base.push(
        { icon: <SpeedIcon />, val: String(s["40 verges"] || "—"), lbl: "40 verges" },
        { icon: <StrengthIcon />, val: String(s["Bench press"] || "—"), lbl: "Bench press" },
        { icon: <StrengthIcon />, val: String(s["Squat"] || "—"), lbl: "Squat" },
      );
      break;
    case "Soccer":
      base.push(
        { icon: <SpeedIcon />, val: String(s["Vitesse 30m"] || "—"), lbl: "Vitesse 30m" },
        { icon: <GameIcon />, val: String(s["Matchs joués"] || "—"), lbl: "Matchs joués" },
        { icon: <GoalIcon />, val: `${s["Buts"] || "—"} / ${s["Passes décisives"] || "—"}`, lbl: "Buts / Passes" },
      );
      break;
    case "Basketball":
      base.push(
        { icon: <JumpIcon />, val: String(s["Détente verticale"] || "—"), lbl: "Détente verticale" },
        { icon: <GoalIcon />, val: String(s["Points par match"] || "—"), lbl: "Points / match" },
        { icon: <GameIcon />, val: String(s["Passes par match"] || "—"), lbl: "Passes / match" },
      );
      break;
    case "Hockey":
      base.push(
        { icon: <SpeedIcon />, val: String(s["Vitesse de tir"] || "—"), lbl: "Vitesse de tir" },
        { icon: <GoalIcon />, val: String(s["Points (saison)"] || "—"), lbl: "Points (saison)" },
        { icon: <GameIcon />, val: String(s["+/-"] || "—"), lbl: "+/-" },
      );
      break;
    case "Volleyball":
      base.push(
        { icon: <JumpIcon />, val: String(s["Détente verticale"] || "—"), lbl: "Détente verticale" },
        { icon: <GoalIcon />, val: String(s["Attaques par match"] || "—"), lbl: "Attaques / match" },
        { icon: <StrengthIcon />, val: String(s["Blocs par match"] || "—"), lbl: "Blocs / match" },
      );
      break;
    default: break;
  }
  return base;
}

/* ══════════════════════════════════════════════════════════════
   MINI ICONS
══════════════════════════════════════════════════════════════ */

const sz = 18;
const RulerIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 3H3v7l9 4 9-4V3z" /><path d="M7 3v4M12 3v4M17 3v4" /></svg>;
const WeightIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="3" /><path d="M6.5 8a6.5 6.5 0 0011 0" /><path d="M3 21h18" /><path d="M5 21V11" /><path d="M19 21V11" /></svg>;
const CalendarIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
const SpeedIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
const StrengthIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4v16M18 4v16M6 12h12M2 8h4M18 8h4M2 16h4M18 16h4" /></svg>;
const GameIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>;
const GoalIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>;
const JumpIcon = () => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const HeartIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>;
const LockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
const PlayIcon = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
const ShareIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>;
const PdfIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M10 13H8v4h2a1 1 0 001-1v-2a1 1 0 00-1-1z" /></svg>;

/* ══════════════════════════════════════════════════════════════
   COMPLETION RING
══════════════════════════════════════════════════════════════ */

function CompletionRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const clr = pct >= 70 ? "#3B82F6" : pct >= 40 ? "#6B7280" : "#EF4444";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#2a2d36" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={clr} strokeWidth={stroke} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[16px] font-bold text-white">{pct}%</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATUS BADGE
══════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: Athlete["status"] }) {
  const cfg: Record<string, { dot: string; text: string; label: string }> = {
    actif: { dot: "#22C55E", text: "#22C55E", label: "Profil actif" },
    en_attente: { dot: "#f59e0b", text: "#f59e0b", label: "En attente" },
    brouillon: { dot: "#8a8d96", text: "#8a8d96", label: "Brouillon" },
    inactif: { dot: "#8a8d96", text: "#8a8d96", label: "Inactif" },
  };
  const c = cfg[status] || cfg.brouillon;
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {status === "actif" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: c.dot }} />}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: c.dot }} />
      </span>
      <span className="text-[12px] font-semibold" style={{ color: c.text }}>{c.label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATUS PILL — inline pill for hero header
══════════════════════════════════════════════════════════════ */

function StatusPill({ status }: { status: Athlete["status"] }) {
  const cfg: Record<string, { bg: string; dot: string; text: string; label: string }> = {
    actif: { bg: "rgba(16,185,129,0.12)", dot: "#22C55E", text: "#22C55E", label: "Actif" },
    en_attente: { bg: "rgba(245,158,11,0.12)", dot: "#f59e0b", text: "#f59e0b", label: "En attente" },
    brouillon: { bg: "rgba(138,141,150,0.12)", dot: "#8a8d96", text: "#8a8d96", label: "Brouillon" },
    inactif: { bg: "rgba(138,141,150,0.12)", dot: "#8a8d96", text: "#8a8d96", label: "Inactif" },
  };
  const c = cfg[status] || cfg.brouillon;
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: c.bg }}>
      <span className="relative flex h-2 w-2">
        {status === "actif" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: c.dot }} />}
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: c.dot }} />
      </span>
      <span className="text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: c.text }}>{c.label}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   V30 PLAYER CARD — exact same structure as homepage
══════════════════════════════════════════════════════════════ */

function PlayerCard({ a }: { a: Athlete }) {
  const stars = coachStars(a.coachRating);
  const posAbbr = a.position.length > 4 ? a.position.slice(0, 3).toUpperCase() : a.position.toUpperCase();

  return (
    <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 6, paddingBottom: 10 }}>

      {/* Verified badge (only if profile >= 50%) */}
      {a.profileCompletion >= 50 && (
        <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12 }}>
          <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
            <defs>
              <radialGradient id="pc_bg" cx="38%" cy="28%" r="68%">
                <stop offset="0%" stopColor="#29AAFF" />
                <stop offset="55%" stopColor="#0094F0" />
                <stop offset="100%" stopColor="#0060C0" />
              </radialGradient>
              <radialGradient id="pc_shine" cx="38%" cy="25%" r="55%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
                <stop offset="60%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>
            <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
            <circle cx="27" cy="27" r="24" fill="url(#pc_bg)" />
            <circle cx="27" cy="27" r="24" fill="url(#pc_shine)" />
            <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      )}

      {/* Main card */}
      <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>

        {/* Photo area */}
        <div className="relative overflow-hidden" style={{ width: 300, height: 420, borderRadius: 10, background: '#2F3440' }}>
          {/* Initials fallback (large centered) */}
          <div className="absolute inset-0 z-[1] flex items-center justify-center">
            <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 120, color: 'rgba(255,255,255,0.06)', letterSpacing: '0.05em', lineHeight: 1 }}>
              {a.firstName[0]}{a.lastName[0]}
            </span>
          </div>
          {/* Gradient fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]"
            style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }}
          />
          {/* Corner fold */}
          <div
            className="absolute top-0 right-0 z-20"
            style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 20px 20px 0', borderColor: 'transparent #1E2128 transparent transparent' }}
          />
        </div>

        {/* Ticket */}
        <div
          className="nx-v30-ticket absolute z-[999] overflow-hidden"
          style={{ bottom: -14, right: -22, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex" style={{ width: 322 }}>

            {/* Left — dark navy */}
            <div
              className="flex flex-col justify-between"
              style={{ background: '#1E2128', padding: '12px 14px 12px 16px', minWidth: 96, gap: 4 }}
            >
              {[
                { lbl: "Sport", val: a.sport },
                { lbl: "Pos", val: posAbbr },
                { lbl: "Div", val: "D1" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>
                    {r.lbl}
                  </div>
                  <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 16, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>
                    {r.val}
                  </div>
                </div>
              ))}
            </div>

            {/* Perforation */}
            <div
              className="nx-v30-perf flex flex-col items-center justify-center"
              style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}
            >
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
              ))}
            </div>

            {/* Right — cream */}
            <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '12px 16px' }}>
              {/* Stars */}
              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#1E2128', borderRadius: 4, padding: '3px 5px', marginBottom: 6, width: 'fit-content' }}>
                <StarRating rating={a.coachRating} size="md" showNumber={false} className="!gap-0.5" />
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2 }}>
                {a.schoolName}
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9CA3AF' }}>
                {a.city}
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#E63946', marginTop: 2 }}>
                Promotion {a.gradYear}
              </div>
            </div>

            {/* Stub */}
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                background: '#E63946',
                width: 24,
                writingMode: 'vertical-rl' as const,
                fontFamily: 'var(--font-bebas), sans-serif',
                fontSize: 10,
                letterSpacing: '0.22em',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              NEXUS
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   404 STATE
══════════════════════════════════════════════════════════════ */

function NotFoundState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-24 h-24 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center">
        <span className="text-[32px] text-[#6b7280]">?</span>
      </div>
      <div className="text-center">
        <h2 className="font-head font-bold text-xl text-white mb-2">Athlète introuvable</h2>
        <p className="text-[14px] text-[#6b7280]">Ce profil n&apos;existe pas ou a été supprimé.</p>
      </div>
      <Link
        href="/coach/athletes"
        className="px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] text-[14px] font-bold uppercase tracking-[0.1em] hover:bg-[#E63946] hover:text-white transition-all"
      >
        Retour à Mes Athlètes
      </Link>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
══════════════════════════════════════════════════════════════ */

export default function AthleteProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const athlete = useMemo(() => MOCK_ATHLETES.find((a) => a.id === id) ?? null, [id]);

  if (!athlete) return <div className="p-8"><NotFoundState /></div>;

  const a = athlete;
  const n = nudge(a);
  const quickStats = sportQuickStats(a);
  const stats = a.stats || {};
  const videos = a.videos || [];
  const timeline = a.timeline || [];
  const activity = a.recruiterActivity || [];
  const contact = a.coachContact;

  return (
    <div className="px-5 md:px-8 lg:px-10 py-8 max-w-[1320px] mx-auto animate-in fade-in duration-500">

      {/* ── Breadcrumb + Actions ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
          <Link href="/coach" className="hover:text-white transition-colors">Nexus</Link>
          <span>/</span>
          <Link href="/coach" className="hover:text-white transition-colors">Coach</Link>
          <span>/</span>
          <Link href="/coach/athletes" className="hover:text-white transition-colors">Mes Athlètes</Link>
          <span>/</span>
          <span className="text-white font-semibold">{a.firstName} {a.lastName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/coach/athletes/create?edit=${a.id}`}
            className="px-4 py-2 rounded-lg border border-[#2a2d36] text-[12px] font-bold uppercase tracking-[0.1em] text-[#e0e0e0] hover:border-[#E63946] hover:text-[#E63946] transition-all"
          >
            Modifier le profil
          </Link>
          <button className="w-9 h-9 rounded-lg border border-[#2a2d36] flex items-center justify-center text-[#8a8d96] hover:border-[#E63946] hover:text-[#E63946] transition-all">
            <ShareIcon />
          </button>
          <button className="w-9 h-9 rounded-lg border border-[#2a2d36] flex items-center justify-center text-[#8a8d96] hover:border-[#E63946] hover:text-[#E63946] transition-all">
            <PdfIcon />
          </button>
        </div>
      </div>

      {/* Back link */}
      <Link href="/coach/athletes" className="inline-flex items-center gap-2 text-[14px] text-[#6b7280] hover:text-white transition-colors mb-6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Retour
      </Link>

      {/* ── Hero Section with V30 Card ───────────────────────── */}
      <div className={`${cardCls} p-6 md:p-8 mb-6 overflow-visible`}>
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">

          {/* Left — V30 Player Card */}
          <div className="shrink-0 flex justify-center" style={{ minHeight: 480 }}>
            <PlayerCard a={a} />
          </div>

          {/* Right — Info block */}
          <div className="flex-1 flex flex-col justify-between text-center lg:text-left lg:py-4 gap-0">

            {/* Top: Name + Status pill inline */}
            <div>
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
                <h1 className="font-head font-black text-[32px] md:text-[40px] tracking-[0.04em] uppercase text-white leading-[0.95]">
                  {a.firstName} {a.lastName}
                </h1>
                <StatusPill status={a.status} />
              </div>

              {/* Sport pill */}
              <div className="inline-flex items-center rounded-full bg-[#E63946]/15 px-4 py-1.5">
                <span className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#E63946]">
                  {a.sport} — {a.position}
                </span>
              </div>

              {/* School + city + grad */}
              <p className="mt-3 text-[14px] text-[#8a8d96]">
                {a.schoolName} &middot; {a.city}
              </p>
              <p className="text-[14px] text-[#6b7280] mt-0.5">
                Promotion {a.gradYear}
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-[#1e2128] my-5" />

            {/* Quick stats grid inside hero */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {quickStats.map((s, i) => (
                <div key={i} className="bg-[#13151a] rounded-lg border border-[#1e2128] p-3 flex flex-col items-center gap-1.5 text-center">
                  <span className="text-[#6b7280]">{s.icon}</span>
                  <span className="text-[16px] font-bold text-white leading-none">{s.val}</span>
                  <span className="text-[12px] text-[#6b7280] uppercase tracking-wider">{s.lbl}</span>
                </div>
              ))}
            </div>

            {/* Completion + Vues + Favoris + Updated row */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <CompletionRing pct={a.profileCompletion} size={52} />
                <div>
                  <p className="text-[14px] font-bold text-white">{a.profileCompletion}%</p>
                  <p className="text-[12px] font-semibold" style={{ color: n.color }}>{n.text}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-[#1e2128]" />
              <div className="text-center lg:text-left">
                <p className="text-[20px] font-bold text-white leading-none">{a.recruiterViews}</p>
                <p className="text-[12px] text-[#6b7280] uppercase tracking-wider mt-0.5">Vues</p>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-[20px] font-bold text-white leading-none">{a.favoriteCount}</p>
                <p className="text-[12px] text-[#6b7280] uppercase tracking-wider mt-0.5">Favoris</p>
              </div>
              <div className="h-8 w-px bg-[#1e2128]" />
              <div className="text-center lg:text-left">
                <p className="text-[12px] font-semibold text-white leading-none">{relativeTime(a.updatedAt)}</p>
                <p className="text-[12px] text-[#6b7280] uppercase tracking-wider mt-0.5">Mis à jour</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-Column Layout ────────────────────────────────── */}
      <div className="flex flex-col-reverse lg:flex-row gap-6">

        {/* Left Column (main content) */}
        <div className="flex-1 lg:w-[65%] flex flex-col gap-6">

          {/* À propos */}
          <div className={`${cardCls} p-6`}>
            <h2 className={sectionTitle}>À propos</h2>
            <p className="text-[14px] leading-relaxed text-[#c4c7cd] whitespace-pre-line">
              {a.bio || "Aucune description ajoutée pour le moment."}
            </p>
            {a.traits && a.traits.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {a.traits.map((t) => (
                  <span key={t} className="px-3 py-1 rounded-full text-[12px] font-semibold uppercase tracking-wider bg-[#13151a] border border-[#2a2d36] text-[#8a8d96]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Statistiques */}
          <div className={`${cardCls} p-6`}>
            <h2 className={sectionTitle}>Statistiques</h2>

            <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Physique</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 mb-6">
              <div><p className={labelCls}>Taille</p><p className={valueCls}>{a.heightCm ? `${a.heightCm} cm` : "—"}</p></div>
              <div><p className={labelCls}>Poids</p><p className={valueCls}>{a.weightKg ? `${a.weightKg} kg` : "—"}</p></div>
              <div><p className={labelCls}>Âge</p><p className={valueCls}>{age(a.dateOfBirth)} ans</p></div>
            </div>

            {Object.keys(stats).length > 0 && (
              <>
                <div className="border-t border-[#1e2128] my-5" />
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Performance</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 mb-6">
                  {Object.entries(stats).map(([k, v]) => (
                    <div key={k}>
                      <p className={labelCls}>{k}</p>
                      <p className={valueCls}>{v || "—"}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-[#1e2128] my-5" />
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Académique</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <div><p className={labelCls}>Graduation</p><p className={valueCls}>{a.gradYear}</p></div>
            </div>
          </div>

          {/* Vidéos */}
          <div className={`${cardCls} p-6`}>
            <h2 className={sectionTitle}>Vidéos highlight</h2>
            {videos.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#13151a] border border-[#2a2d36] flex items-center justify-center mb-4">
                  <PlayIcon />
                </div>
                <p className="text-[14px] text-[#6b7280]">Aucune vidéo ajoutée</p>
                <p className="text-[13px] text-[#4b5563] mt-1">Ajoutez un lien Hudl ou YouTube pour mettre en valeur ce profil</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((v, i) => (
                  <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className="group block">
                    <div className="relative aspect-video rounded-lg bg-[#13151a] border border-[#2a2d36] overflow-hidden flex items-center justify-center group-hover:border-[#E63946]/50 transition-colors">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#1A1D24] to-[#0d0f13]" />
                      <div className="relative z-10 w-12 h-12 rounded-full bg-[#E63946]/90 flex items-center justify-center group-hover:bg-[#E63946] transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                      <span className="absolute bottom-2 right-2 z-10 text-[12px] bg-black/70 text-white px-1.5 py-0.5 rounded">{v.duration}</span>
                    </div>
                    <p className="text-[14px] font-semibold text-white mt-2 group-hover:text-[#E63946] transition-colors">{v.title}</p>
                    <p className="text-[12px] text-[#6b7280] mt-0.5 line-clamp-2">{v.description}</p>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Parcours sportif */}
          <div className={`${cardCls} p-6`}>
            <h2 className={sectionTitle}>Parcours sportif</h2>
            {timeline.length === 0 ? (
              <p className="text-[14px] text-[#6b7280]">Aucun parcours ajouté.</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-[#E63946]/30" />
                <div className="flex flex-col gap-8">
                  {timeline.map((t, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-6 top-1 w-[14px] h-[14px] rounded-full border-2 border-[#E63946] bg-[#1A1D24]" />
                      <p className="text-[12px] font-bold tracking-wider uppercase text-[#E63946]">{t.yearRange}</p>
                      <p className="text-[14px] font-semibold text-white mt-1">{t.team}</p>
                      <p className="text-[14px] text-[#8a8d96] mt-0.5">{t.role}</p>
                      {t.achievements && (
                        <p className="text-[12px] text-[#6b7280] mt-1 italic">{t.achievements}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (sidebar) */}
        <div className="lg:w-[35%] flex flex-col gap-6">

          {/* Informations personnelles */}
          <div className={`${cardCls} p-6`}>
            <h2 className={sectionTitle}>Informations</h2>
            <div className="flex flex-col gap-4">
              <div><p className={labelCls}>Date de naissance</p><p className={valueCls}>{formatDob(a.dateOfBirth)}</p></div>
              <div><p className={labelCls}>Âge</p><p className={valueCls}>{age(a.dateOfBirth)} ans</p></div>
              <div><p className={labelCls}>Genre</p><p className={valueCls}>{a.gender === "M" ? "Masculin" : "Féminin"}</p></div>
              <div><p className={labelCls}>Ville</p><p className={valueCls}>{a.city}, QC</p></div>
              <div><p className={labelCls}>Nationalité</p><p className={valueCls}>{a.nationality || "—"}</p></div>
              <div><p className={labelCls}>Langues</p><p className={valueCls}>{a.languages?.join(", ") || "—"}</p></div>
            </div>
          </div>

          {/* Académique */}
          <div className={`${cardCls} p-6`}>
            <h2 className={sectionTitle}>Académique</h2>
            <div className="flex flex-col gap-4">
              <div><p className={labelCls}>École actuelle</p><p className={valueCls}>{a.schoolName}</p></div>
              <div><p className={labelCls}>Année de graduation</p><p className={valueCls}>{a.gradYear}</p></div>
              <div><p className={labelCls}>Mention</p><p className={valueCls}>Étudiant-athlète</p></div>
            </div>
          </div>

          {/* Contact (coach only) */}
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`${sectionTitle} mb-0`}>Contact</h2>
              <span className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
                <LockIcon /> Visible par le coach
              </span>
            </div>
            {contact ? (
              <div className="flex flex-col gap-4">
                <div><p className={labelCls}>Coach</p><p className={valueCls}>{contact.name}</p></div>
                <div><p className={labelCls}>Email</p><p className={valueCls}>{contact.email}</p></div>
                <div><p className={labelCls}>Téléphone</p><p className={valueCls}>{contact.phone}</p></div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div><p className={labelCls}>Coach</p><p className={valueCls}>Jean Dupont</p></div>
                <div><p className={labelCls}>Email</p><p className={valueCls}>coach@example.com</p></div>
                <div><p className={labelCls}>Téléphone</p><p className={valueCls}>(450) 555-0123</p></div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-[#1e2128]">
              <p className="text-[12px] text-[#4b5563] italic">
                Les recruteurs doivent envoyer une demande pour obtenir les coordonnées
              </p>
            </div>
          </div>

          {/* Activité recruteurs */}
          <div className={`${cardCls} p-6`}>
            <h2 className={sectionTitle}>Activité recruteurs</h2>
            {activity.length === 0 ? (
              <p className="text-[14px] text-[#6b7280]">Aucune activité de recruteur pour le moment</p>
            ) : (
              <div className="flex flex-col gap-4">
                {activity.map((r, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#13151a] border border-[#2a2d36] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[12px] font-bold text-[#6b7280]">
                        {r.recruiterName.split(" ").map((w) => w[0]).join("")}
                      </span>
                    </div>
                    <div>
                      <p className="text-[14px] text-[#c4c7cd]">
                        <span className="font-semibold text-white">{r.recruiterName}</span>
                        {" — "}{r.cegepName} {r.action}
                      </p>
                      <p className="text-[12px] text-[#6b7280] mt-0.5">{r.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
