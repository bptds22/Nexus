"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play,
  Search,
  UserCircle2,
  LayoutGrid,
  CheckCircle2,
  BadgeCheck,
  Check,
  X as XIcon,
  Heart,
  Eye,
  Zap,
  ChevronDown,
  Star,
  Shield,
  Award,
  User,
} from "lucide-react";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { useTranslation } from "@/lib/i18n/useTranslation";

/* ═══════════════════════════════════════════════════════════════
   Pour les recruteurs — B2B landing page
   Identity: Stripe/Linear-style SaaS, outcome-driven, vouvoiement.
   Distinct from athlete (emotional) and coach (reputation) pages.
═══════════════════════════════════════════════════════════════ */

/* ── Pillar visual config (icon + color band, keyed by index) ── */

type PillarColor = "red" | "blue" | "amber" | "blueCheck";

const PILLAR_VISUALS: { icon: React.ReactNode; color: PillarColor }[] = [
  { icon: <Search size={22} strokeWidth={2.2} />, color: "red" },
  { icon: <UserCircle2 size={22} strokeWidth={2.2} />, color: "blue" },
  { icon: <LayoutGrid size={22} strokeWidth={2.2} />, color: "amber" },
  { icon: <BadgeCheck size={40} strokeWidth={2} />, color: "blueCheck" },
];

const PILLAR_STYLES: Record<PillarColor, { bg: string; fg: string }> = {
  red: { bg: "bg-[#E63946]/15", fg: "text-[#E63946]" },
  blue: { bg: "bg-[#3B82F6]/15", fg: "text-[#3B82F6]" },
  amber: { bg: "bg-[#F59E0B]/15", fg: "text-[#F59E0B]" },
  blueCheck: { bg: "bg-[#3B82F6]/15", fg: "text-[#3B82F6]" },
};

/* ── Pricing visual config (order matches dictionary tiers) ──── */

type PricingVisual = {
  priceColor: string;
  checkColor: string;
  highlighted?: boolean;
  buttonVariant: "outline-red" | "filled-red" | "outline-amber";
  borderClass: string;
};

const PRICING_VISUALS: PricingVisual[] = [
  {
    priceColor: "text-[#22C55E]",
    checkColor: "text-[#22C55E] bg-[#22C55E]/15",
    buttonVariant: "outline-red",
    borderClass: "border border-white/[0.06]",
  },
  {
    priceColor: "text-white",
    checkColor: "text-[#E63946] bg-[#E63946]/15",
    highlighted: true,
    buttonVariant: "filled-red",
    borderClass: "border-2 border-[#E63946]",
  },
  {
    priceColor: "text-white",
    checkColor: "text-[#F59E0B] bg-[#F59E0B]/15",
    buttonVariant: "outline-amber",
    borderClass: "border border-[#F59E0B]/40",
  },
];

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] sm:text-[14px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[26px] sm:text-[32px] font-extrabold text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

/* ── FAQ accordion item ─────────────────────────────────────── */

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#1A1D24] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open ? "true" : "false"}
      >
        <span className="text-[15px] sm:text-[16px] font-bold text-white leading-snug">
          {q}
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-white/55 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 text-[14px] text-white/75 leading-relaxed border-t border-white/[0.04]">
          <p className="pt-5">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function PourLesRecruteursPage() {
  const { t } = useTranslation();
  const T = t.recruiterLanding;
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO (two-column, video right) ───── */}
        <section id="hero" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — copy */}
              <div>
                <RedLabel>{T.hero.eyebrow}</RedLabel>
                <h1 className="nx-display text-[38px] sm:text-[44px] lg:text-[48px] font-extrabold leading-[1.05] tracking-tight mt-4">
                  {T.hero.titleLine1}<br />
                  {T.hero.titleLine2}<br />
                  <span className="text-[#E63946]">{T.hero.titleLine3}</span>
                </h1>
                <p className="text-[17px] sm:text-[18px] text-white/75 leading-relaxed mt-6">
                  {T.hero.lede}
                </p>
                <p className="text-[14px] sm:text-[15px] text-white/55 mt-4">
                  {T.hero.ledeSmall}
                </p>
                <div className="mt-8">
                  <a
                    href="#demo-video"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors text-[14px] px-7 py-[13px]"
                  >
                    <Play size={14} strokeWidth={2.5} fill="currentColor" />
                    {T.hero.cta}
                  </a>
                  <p className="text-[13px] text-white/55 mt-3">
                    {T.hero.ctaSubtitle}
                  </p>
                </div>
              </div>

              {/* Right — video placeholder */}
              <div id="demo-video">
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="group relative block w-full aspect-video bg-[#0d0f12] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl hover:border-[#E63946]/40 transition-colors"
                  aria-label={T.hero.videoAriaLabel}
                >
                  {/* Gradient overlay */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-[#E63946]/10 via-transparent to-[#3B82F6]/5"
                  />
                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E63946] shadow-[0_0_40px_rgba(230,57,70,0.5)] group-hover:scale-110 transition-transform">
                      <Play size={32} strokeWidth={2.5} className="text-white ml-1" fill="currentColor" />
                    </span>
                  </div>
                  {/* Top-left duration badge */}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E63946]" />
                      {T.hero.videoBadge}
                    </span>
                  </div>
                </button>
                <p className="mt-4 text-[14px] text-white/55 text-center">
                  {T.hero.videoCaption}
                </p>
                {videoOpen && (
                  <p className="mt-2 text-[12px] text-[#E63946] text-center">
                    {T.hero.videoComing}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 2 — STATS BAR (static 4-col grid) ────── */}
        <section id="stats" className="bg-[#0d0f12] border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-14">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0">
              {T.stats.map((s, i) => (
                <div
                  key={s.value}
                  className={`text-center lg:px-6 ${
                    i > 0 ? "lg:border-l lg:border-white/[0.08]" : ""
                  }`}
                >
                  <p className="nx-display text-[28px] sm:text-[36px] font-extrabold text-white leading-none tracking-tight">
                    {s.value}
                  </p>
                  <p className="text-[12px] sm:text-[13px] text-white/55 mt-3 leading-snug">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — PAIN / SOLUTION ──────────────────── */}
        <section id="probleme" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[780px]">
              <RedLabel>{T.problem.eyebrow}</RedLabel>
              <SectionTitle>
                {T.problem.title}
              </SectionTitle>
              <p className="text-[15px] sm:text-[16px] text-white/75 leading-relaxed mt-5">
                {T.problem.lede}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-14">
              {/* Sans Nexus */}
              <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/55">
                  {T.problem.statusQuoEyebrow}
                </p>
                <h3 className="nx-display text-[20px] font-extrabold text-white/85 mt-2">
                  {T.problem.statusQuoTitle}
                </h3>
                <ul className="space-y-3.5 mt-6">
                  {T.problem.pains.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[14px] text-white/70 leading-snug">
                      <span className="shrink-0 mt-0.5 w-[20px] h-[20px] rounded-full bg-white/5 text-white/40 flex items-center justify-center">
                        <XIcon size={13} strokeWidth={2.5} />
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Avec Nexus */}
              <div className="bg-[#1A1D24] border-2 border-[#E63946]/40 rounded-2xl p-7 relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#E63946]">
                  {T.problem.reinventedEyebrow}
                </p>
                <h3 className="nx-display text-[20px] font-extrabold text-white mt-2">
                  {T.problem.reinventedTitlePrefix}<span className="text-[#E63946]">{T.problem.reinventedTitleBrand}</span>
                </h3>
                <ul className="space-y-3.5 mt-6">
                  {T.problem.solutions.map((s) => (
                    <li key={s} className="flex items-start gap-3 text-[14px] text-white/85 leading-snug">
                      <span className="shrink-0 mt-0.5 w-[20px] h-[20px] rounded-full bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center">
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4 — 4 CORE PILLARS ───────────────────── */}
        <section id="pilliers" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>{T.pillars.eyebrow}</RedLabel>
              <SectionTitle>
                {T.pillars.title}
              </SectionTitle>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
              {T.pillars.items.map((p, i) => {
                const v = PILLAR_VISUALS[i];
                const s = PILLAR_STYLES[v.color];
                const boxSize = v.color === "blueCheck" ? "w-14 h-14" : "w-11 h-11";
                return (
                  <div
                    key={p.title}
                    className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-8"
                  >
                    <div className={`${boxSize} rounded-xl flex items-center justify-center ${s.bg} ${s.fg}`}>
                      {v.icon}
                    </div>
                    <h3 className="nx-display text-[20px] font-extrabold text-white tracking-tight mt-5">
                      {p.title}
                    </h3>
                    <p className="text-[14px] text-white/75 leading-relaxed mt-3">
                      {p.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 5 — VERIFICATION / BLUE CHECK ────────── */}
        <section id="verification" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12 items-center">
              {/* Text left (2/5) */}
              <div className="lg:col-span-2">
                <RedLabel>{T.verification.eyebrow}</RedLabel>
                <SectionTitle>
                  {T.verification.title}
                </SectionTitle>
                <div className="space-y-4 mt-6 text-[14px] sm:text-[15px] text-white/75 leading-relaxed">
                  <p>{T.verification.p1}</p>
                  <p>{T.verification.p2}</p>
                  <p>{T.verification.p3}</p>
                </div>
              </div>

              {/* Mockup right (3/5) */}
              <div className="lg:col-span-3">
                <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-7 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 px-3 py-1.5">
                      <CheckCircle2 size={14} className="text-[#3B82F6]" strokeWidth={2.5} />
                      <span className="text-[12px] font-bold uppercase tracking-wider text-[#3B82F6]">
                        {T.verification.verifiedPill}
                      </span>
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} size={16} fill="#F59E0B" className="text-[#F59E0B]" />
                      ))}
                      <span className="ml-2 text-[13px] font-bold text-white tabular-nums">5.0</span>
                    </div>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/45 mt-6">
                    {T.verification.verifiedByLabel}
                  </p>
                  <p className="text-[16px] font-bold text-white mt-1.5">
                    {T.verification.verifiedByName} · <span className="text-white/70 font-semibold">{T.verification.verifiedBySchool}</span>
                  </p>

                  <blockquote className="mt-5 pl-4 border-l-2 border-[#E63946] text-[14px] italic text-white/85 leading-relaxed">
                    {T.verification.quote}
                  </blockquote>

                  <div className="flex flex-wrap gap-2 mt-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      <Shield size={11} strokeWidth={2.5} />
                      {T.verification.badgeCaptain}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      <Star size={11} strokeWidth={2.5} />
                      {T.verification.badgeAllstar}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      <Award size={11} strokeWidth={2.5} />
                      {T.verification.badgeLeader}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6 — COACH RELIABILITY ────────────────── */}
        <section id="fiabilite" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            {/* Header + intro */}
            <div className="text-center max-w-[720px] mx-auto">
              <RedLabel>{T.reliability.eyebrow}</RedLabel>
              <SectionTitle>
                {T.reliability.title}
              </SectionTitle>
              <p className="text-[15px] sm:text-[16px] text-white/75 leading-relaxed mt-6">
                {T.reliability.lede}
              </p>
            </div>

            {/* Split: left copy 2/5, right mockup 3/5 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12 items-start mt-14">
              <div className="lg:col-span-2">
                <h3 className="nx-display text-[20px] sm:text-[22px] font-extrabold text-white tracking-tight leading-tight">
                  {T.reliability.subTitle}
                </h3>
                <div className="space-y-4 mt-5 text-[14px] sm:text-[15px] text-white/75 leading-relaxed">
                  <p>{T.reliability.p1}</p>
                  <p>{T.reliability.p2}</p>
                  <p>{T.reliability.p3}</p>
                </div>
              </div>

              {/* Coach reputation mockup */}
              <div className="lg:col-span-3">
                <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/50">
                      <User size={22} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[17px] font-bold text-white leading-tight">
                        {T.reliability.coachName}
                      </p>
                      <p className="text-[13px] text-white/55 mt-0.5">
                        {T.reliability.coachSchool}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 mt-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Star key={i} size={16} fill="#F59E0B" className="text-[#F59E0B]" />
                    ))}
                    <Star size={16} className="text-[#4a4d56]" />
                    <span className="ml-2 text-[14px] font-bold text-white tabular-nums">
                      4.2 <span className="text-white/45 font-semibold">/ 5</span>
                    </span>
                  </div>
                  <p className="text-[12px] text-white/55 mt-2">
                    {T.reliability.reliabilityCaption}
                  </p>

                  <div className="h-px bg-white/[0.06] my-6" />

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-[13px] mb-1.5">
                        <span className="text-white/75">{T.reliability.precisionLabel}</span>
                        <span className="text-[#22C55E] font-bold tabular-nums">87%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#2D3748] overflow-hidden">
                        <div className="h-full rounded-full bg-[#22C55E] w-[87%]" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white/75">{T.reliability.placedLabel}</span>
                      <span className="text-white font-bold tabular-nums">12</span>
                    </div>

                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white/75">{T.reliability.responseLabel}</span>
                      <span className="text-white font-bold tabular-nums">6h</span>
                    </div>
                  </div>

                  <div className="h-px bg-white/[0.06] my-6" />

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#22C55E]">
                      {T.reliability.pillRecommended}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#3B82F6]">
                      {T.reliability.pillFastResponse}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      {T.reliability.pillPlacer}
                    </span>
                  </div>

                  <p className="text-[11px] text-white/45 mt-6">
                    {T.reliability.lastEvaluated}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION 7 — COMPETITIVE INTELLIGENCE ─────────── */}
        <section id="intelligence" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              {/* Mockup left */}
              <div className="order-2 lg:order-1">
                {/* Red glow wrapper + inner card */}
                <div className="relative bg-[#15171c] border border-white/[0.08] rounded-xl p-6 shadow-[0_0_80px_-10px_rgba(230,57,70,0.35)]">
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 items-start">
                    {/* Left 40% — tilted player card */}
                    <div className="sm:col-span-2 flex justify-center sm:justify-start">
                      <div className="relative -rotate-3 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
                        <div className="relative w-[180px] rounded-xl overflow-hidden border border-white/15 bg-[#111317]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/preview-athlete-player-card.png"
                            alt={T.intelligence.cardAlt}
                            className="w-full h-auto block"
                          />
                          {/* Blue verified check top-right */}
                          <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#3B82F6] border-2 border-[#111317] flex items-center justify-center shadow-lg">
                            <CheckCircle2 size={16} className="text-white" strokeWidth={3} />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right 60% — stats + intelligence */}
                    <div className="sm:col-span-3 space-y-4 min-w-0">
                      {/* Name + jersey */}
                      <div>
                        <p className="nx-display text-[18px] sm:text-[20px] font-extrabold text-white uppercase tracking-tight leading-tight">
                          Alexandre Tremblay{" "}
                          <span className="text-[#E63946]">#7</span>
                        </p>
                        <p className="text-[11px] text-white/45 uppercase tracking-[0.2em] mt-1">
                          {T.intelligence.cardCategory}
                        </p>
                      </div>

                      {/* Metrics row */}
                      <div className="grid grid-cols-4 divide-x divide-white/[0.06] border-t border-b border-white/[0.06] py-3">
                        <div className="px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Eye size={12} className="text-white/55" strokeWidth={2.2} />
                            <span className="text-[15px] font-black text-white tabular-nums">47</span>
                          </div>
                          <p className="text-[9px] text-white/45 uppercase tracking-wider mt-0.5">{T.intelligence.viewsLabel}</p>
                        </div>
                        <div className="px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Heart size={12} fill="currentColor" className="text-[#E63946]" />
                            <span className="text-[15px] font-black text-[#E63946] tabular-nums">3</span>
                          </div>
                          <p className="text-[9px] text-white/45 uppercase tracking-wider mt-0.5">{T.intelligence.favoritesLabel}</p>
                        </div>
                        <div className="px-2 text-center">
                          <p className="text-[9px] text-white/45 uppercase tracking-wider">{T.intelligence.myStatusLabel}</p>
                          <p className="text-[11px] font-bold text-white mt-0.5 leading-tight">{T.intelligence.myStatusValue}</p>
                        </div>
                        <div className="px-2 text-center">
                          <p className="text-[9px] text-white/45 uppercase tracking-wider">{T.intelligence.recruitmentLabel}</p>
                          <span className="inline-flex items-center rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#F59E0B] mt-0.5">
                            {T.intelligence.recruitmentValue}
                          </span>
                        </div>
                      </div>

                      {/* Read annotation — explains the gap between Mon statut and Recrutement global */}
                      <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5">
                        <p className="flex items-start gap-2 text-[11px] text-white/70 leading-relaxed">
                          <Zap size={13} className="shrink-0 mt-0.5 text-[#E63946]" strokeWidth={2.2} />
                          <span>
                            <span className="font-bold text-white">{T.intelligence.annotationLead}</span>{" "}
                            {T.intelligence.annotationBody}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text right */}
              <div className="order-1 lg:order-2">
                <RedLabel>{T.intelligence.eyebrow}</RedLabel>
                <SectionTitle>
                  {T.intelligence.title}
                </SectionTitle>
                <div className="space-y-4 mt-6 text-[14px] sm:text-[15px] text-white/75 leading-relaxed">
                  <p>{T.intelligence.p1}</p>
                  <p>
                    {T.intelligence.p2Pre}<span className="text-white font-semibold">{T.intelligence.p2YourStatus}</span>{T.intelligence.p2Mid}<span className="text-white font-semibold">{T.intelligence.p2GlobalStatus}</span>{T.intelligence.p2Post}
                  </p>
                  <p>{T.intelligence.p3}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 8 — TARIFICATION ─────────────────────── */}
        <section id="tarification" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>{T.pricing.eyebrow}</RedLabel>
              <SectionTitle>{T.pricing.title}</SectionTitle>
              <p className="text-[14px] sm:text-[15px] text-white/75 leading-relaxed mt-5 max-w-[640px] mx-auto">
                {T.pricing.lede}
              </p>
            </div>

            <div className="mt-14 mx-auto max-w-[1000px] flex flex-col md:flex-row items-stretch gap-4">
              {T.pricing.tiers.map((tier, i) => {
                const v = PRICING_VISUALS[i];
                const btnClass =
                  v.buttonVariant === "filled-red"
                    ? "bg-[#E63946] text-white hover:bg-[#D42B22] border border-[#E63946]"
                    : v.buttonVariant === "outline-amber"
                    ? "border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10"
                    : "border border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10";
                return (
                  <div
                    key={tier.name}
                    className={`relative flex-1 bg-[#1A1D24] rounded-xl flex flex-col min-h-[640px] p-8 ${v.borderClass}`}
                  >
                    {tier.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex px-3 py-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold uppercase tracking-wider">
                        {tier.badge}
                      </span>
                    )}

                    <h3 className="text-[20px] font-bold text-white">{tier.name}</h3>

                    <div className="mt-4 flex items-baseline gap-1.5 flex-wrap">
                      <span className={`nx-display text-[32px] sm:text-[36px] font-extrabold leading-none ${v.priceColor}`}>
                        {tier.price}
                      </span>
                      {tier.priceSuffix && (
                        <span className="text-[15px] text-white/55 font-semibold">{tier.priceSuffix}</span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/55 mt-2">{tier.subtitle}</p>

                    <div className="h-px bg-white/[0.06] my-6" />

                    <div className="flex-1">
                      {tier.subheader && (
                        <p className="text-[13px] text-white/55 mb-3">{tier.subheader}</p>
                      )}
                      <ul className="space-y-2.5">
                        {tier.bullets.map((b) => (
                          <li
                            key={b}
                            className="flex items-start gap-3 text-[14px] text-white/85 leading-snug"
                          >
                            <span
                              className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ${v.checkColor}`}
                            >
                              <Check size={11} strokeWidth={3} />
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      href="/inscription"
                      className={`mt-8 inline-flex items-center justify-center w-full rounded-lg font-bold uppercase tracking-wider text-[13px] py-3 px-5 transition-colors ${btnClass}`}
                    >
                      {tier.buttonLabel}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 9 — FAQ ──────────────────────────────── */}
        <section id="faq" className="border-b border-white/[0.06]">
          <div className="max-w-[860px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>{T.faq.eyebrow}</RedLabel>
              <SectionTitle>{T.faq.title}</SectionTitle>
            </div>

            <div className="space-y-3 mt-12">
              {T.faq.items.map((item, i) => (
                <FaqItem
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 10 — FINAL CTA ───────────────────────── */}
        <section id="cta" className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[820px] mx-auto px-6 py-24 text-center">
            <span className="inline-block w-10 h-[2px] bg-[#E63946] mb-8" />

            <h2 className="nx-display text-[38px] sm:text-[52px] font-extrabold text-white leading-[1.05] tracking-tight">
              {T.cta.title1}<span className="text-[#E63946]">{T.cta.title2}</span>{T.cta.title3}
            </h2>

            <p className="text-[15px] sm:text-[17px] text-white/75 leading-relaxed mt-6 max-w-[560px] mx-auto">
              {T.cta.body}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/inscription"
                className="inline-flex items-center justify-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors text-[15px] px-9 py-[15px]"
              >
                {T.cta.button}
              </Link>
            </div>

            <p className="text-[13px] text-white/55 mt-8">
              {T.cta.footer}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
