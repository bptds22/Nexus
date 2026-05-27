"use client";

import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { useTranslation } from "@/lib/i18n/useTranslation";

import { notFound } from "next/navigation";
/* ═══════════════════════════════════════════════════════════════
   Pour les coachs — public marketing landing page
   Own identity: no scrolling ticker, 4-step process, full-width
   reputation section, no ressources/guide.
═══════════════════════════════════════════════════════════════ */

type TierKey = "FREE" | "PRO";

// Tier per feature card — order matches t.coachLanding.features.items
const FEATURE_TIERS: TierKey[] = [
  "FREE", "FREE", "FREE", "FREE", "FREE", "FREE",
  "PRO", "PRO", "PRO", "PRO", "PRO",
];

// Visual config for the pricing cards (order matches dictionary tiers)
type PricingVisual = {
  priceColor: string;
  checkColor: string;
  highlighted?: boolean;
  buttonVariant: "outline-red" | "filled-red" | "outline-amber";
};

const PRICING_VISUALS: PricingVisual[] = [
  {
    priceColor: "text-[#22C55E]",
    checkColor: "text-[#22C55E] bg-[#22C55E]/15",
    buttonVariant: "outline-red",
  },
  {
    priceColor: "text-white",
    checkColor: "text-[#E63946] bg-[#E63946]/15",
    highlighted: true,
    buttonVariant: "filled-red",
  },
  {
    priceColor: "text-white",
    checkColor: "text-[#F59E0B] bg-[#F59E0B]/15",
    buttonVariant: "outline-amber",
  },
];

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[26px] sm:text-[30px] font-extrabold text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

function TierPill({ tier, freeLabel, proLabel }: { tier: TierKey; freeLabel: string; proLabel: string }) {
  if (tier === "FREE") return <span className="inline-flex px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">{freeLabel}</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[10px] font-bold uppercase tracking-wider">{proLabel}</span>;
}

function GlowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-60px",
          background:
            "radial-gradient(ellipse at center, rgba(230, 57, 70, 0.35) 0%, rgba(230, 57, 70, 0.12) 45%, transparent 75%)",
          borderRadius: "32px",
          zIndex: 0,
          pointerEvents: "none",
          filter: "blur(12px)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%" }}>{children}</div>
    </div>
  );
}

/* ── Messaging mockup (fake names) ──────────────────────────── */

function MessagesMockup({
  mockupLabel,
  items,
}: {
  mockupLabel: string;
  items: { name: string; org: string; preview: string; time: string }[];
}) {
  // First item is the "unread" highlight by convention.
  return (
    <div className="bg-[#15171c] rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl">
      <div className="px-7 py-5 border-b border-white/[0.05] bg-[#1A1D24]">
        <p className="text-[12px] font-bold text-[#6b7280] uppercase tracking-[0.2em]">{mockupLabel}</p>
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {items.map((m, i) => {
          const unread = i === 0;
          const dot = unread ? "bg-[#E63946]" : "bg-white/20";
          return (
            <li key={m.name} className={`flex items-start gap-4 px-7 py-5 ${unread ? "bg-[#E63946]/[0.04]" : ""}`}>
              <span className={`shrink-0 mt-2 w-2.5 h-2.5 rounded-full ${dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[16px] font-bold text-white truncate">
                    {m.name} <span className="text-[#6b7280] font-semibold">· {m.org}</span>
                  </p>
                  <span className="text-[13px] text-[#6b7280] shrink-0">{m.time}</span>
                </div>
                <p className="text-[15px] text-white/75 leading-snug mt-1.5 truncate">{m.preview}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Reputation badges (full-width horizontal) ──────────────── */

type ReputationBadgeVisual = {
  border: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
};

const REPUTATION_BADGE_VISUALS: ReputationBadgeVisual[] = [
  {
    border: "border-white/10",
    iconBg: "bg-white/5",
    iconColor: "text-[#9CA3AF]",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
    ),
  },
  {
    border: "border-white/25",
    iconBg: "bg-white/10",
    iconColor: "text-white",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    border: "border-[#F59E0B]/40",
    iconBg: "bg-[#F59E0B]/15",
    iconColor: "text-[#F59E0B]",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 20h18L17 4l-5 8-3-5-6 13z" />
      </svg>
    ),
  },
  {
    border: "border-[#E63946]/50",
    iconBg: "bg-[#E63946]/15",
    iconColor: "text-[#E63946]",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 4h10v3a5 5 0 01-5 5 5 5 0 01-5-5V4z" />
        <path d="M5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 13h4v3h-4z" />
        <path d="M8 19h8v2H8z" />
      </svg>
    ),
  },
];

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function PourLesCoachsPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t } = useTranslation();
  const T = t.coachLanding;
  const progressVar = { "--bar-w": "80%" } as React.CSSProperties;

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO (centered, full-width mockup below) */}
        <section id="hero" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-28 text-center">
            <RedLabel>{T.hero.eyebrow}</RedLabel>
            <h1 className="nx-display text-[42px] sm:text-[48px] font-extrabold leading-[1.05] tracking-tight mt-4">
              {T.hero.titleLine1}<br />
              <span className="text-[#E63946]">{T.hero.titleLine2}</span>
            </h1>
            <p className="text-[18px] text-white/75 leading-relaxed mt-6 max-w-[640px] mx-auto">
              {T.hero.lede}
            </p>
            <p className="text-[15px] text-white/55 mt-4 max-w-[640px] mx-auto">
              {T.hero.ledeSmall}
            </p>
            <div className="flex items-center justify-center gap-3 mt-9 flex-wrap">
              <Link
                href="/inscription"
                className="inline-flex items-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                style={{ fontSize: 16, padding: "14px 32px" }}
              >
                {T.hero.cta}
              </Link>
            </div>

            <div className="mt-16 max-w-[1200px] mx-auto">
              <GlowFrame>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Image/Coach%20Dashboard.png"
                  alt={T.hero.mockupAlt}
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)" }}
                />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — COMMENT ÇA MARCHE (4 STEPS) ──────── */}
        <section id="comment-ca-marche" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>{T.howItWorks.eyebrow}</RedLabel>
              <SectionTitle>{T.howItWorks.title}</SectionTitle>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 mt-14">
              {T.howItWorks.steps.map((step, i) => {
                const n = String(i + 1).padStart(2, "0");
                return (
                  <div
                    key={n}
                    className={`relative pl-6 py-4 ${
                      i === 0 ? "border-l-[3px] border-[#E63946]/30" : "border-l-[3px] border-white/[0.04]"
                    }`}
                  >
                    <span className="nx-display text-[56px] sm:text-[64px] font-black leading-none text-white/25 tracking-tighter block">
                      {n}
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#E63946] mt-5">
                      {step.role}
                    </p>
                    <h3 className="nx-display text-[18px] font-extrabold uppercase text-white tracking-tight mt-2.5">
                      {step.title}
                    </h3>
                    <p className="text-[14px] text-white/75 leading-relaxed mt-3">
                      {step.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 4 — TON ÉVALUATION (stacked) ─────────── */}
        <section id="evaluation" className="border-b border-white/[0.06]">
          <div className="max-w-[1300px] mx-auto px-6 py-20 text-center">
            <RedLabel>{T.evaluation.eyebrow}</RedLabel>
            <SectionTitle>{T.evaluation.title}</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[600px] mx-auto">
              {T.evaluation.body}
            </p>
            <Link href="/inscription" className="inline-flex items-center gap-1 mt-6 text-[13px] font-bold text-[#E63946] hover:text-[#FF5C58] transition-colors">
              {T.evaluation.cta}
            </Link>
            <div className="mt-12 max-w-[1200px] mx-auto">
              <GlowFrame>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Image/Screenshot%202026-04-15%20164443.png"
                  alt={T.evaluation.mockupAlt}
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85)" }}
                />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 5 — MA RÉPUTATION (FULL WIDTH) ───────── */}
        <section id="reputation" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-24 text-center">
            <RedLabel>{T.reputation.eyebrow}</RedLabel>
            <SectionTitle>{T.reputation.title}</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[700px] mx-auto">
              {T.reputation.lede}
            </p>

            {/* Badge row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-14">
              {T.reputation.badges.map((b, i) => {
                const v = REPUTATION_BADGE_VISUALS[i];
                return (
                  <div
                    key={b.name}
                    className={`bg-[#1A1D24] rounded-2xl border ${v.border} p-6 text-left flex flex-col gap-3`}
                  >
                    <div className={`w-11 h-11 rounded-xl ${v.iconBg} ${v.iconColor} flex items-center justify-center`}>
                      {v.icon}
                    </div>
                    <div>
                      <p className="nx-display text-[15px] font-extrabold uppercase tracking-wide text-white">
                        {b.name}
                      </p>
                      <p className="text-[11px] text-white/55 mt-1">{b.threshold}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stat pills */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {T.reputation.stats.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-2 bg-[#1A1D24] border border-white/[0.06] rounded-full px-4 py-2 text-[12px]"
                >
                  <span className="text-white/55 uppercase tracking-wider font-bold text-[10px]">{s.label}</span>
                  <span className="nx-display font-extrabold text-white text-[13px] tabular-nums">{s.value}</span>
                </span>
              ))}
            </div>

            {/* Progress strip */}
            <div className="mt-8 max-w-[640px] mx-auto bg-[#1A1D24] border border-white/[0.06] rounded-xl p-5 text-left">
              <div className="flex items-center justify-between text-[12px] mb-2">
                <span className="text-white font-bold">{T.reputation.progressTitle}</span>
                <span className="text-[#F59E0B] font-bold tabular-nums">12 / 15</span>
              </div>
              <div className="h-2 rounded-full bg-[#2D3748] overflow-hidden">
                {/* eslint-disable-next-line react/forbid-dom-props -- width is dynamic */}
                <div className="h-full rounded-full bg-[#F59E0B] w-[var(--bar-w)]" style={progressVar} />
              </div>
              <p className="text-[11px] text-white/55 mt-2">{T.reputation.progressFooter}</p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6 — MES ATHLÈTES (stacked) ───────────── */}
        <section id="mes-athletes" className="border-b border-white/[0.06]">
          <div className="max-w-[1300px] mx-auto px-6 py-20 text-center">
            <RedLabel>{T.myAthletes.eyebrow}</RedLabel>
            <SectionTitle>{T.myAthletes.title}</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[600px] mx-auto">
              {T.myAthletes.body}
            </p>
            <div className="mt-12 max-w-[1200px] mx-auto">
              <GlowFrame>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Image/Mes%20ath%20(2).png"
                  alt={T.myAthletes.mockupAlt}
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)" }}
                />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 7 — MESSAGERIE (stacked) ─────────────── */}
        <section id="messagerie" className="border-b border-white/[0.06]">
          <div className="max-w-[1300px] mx-auto px-6 py-20 text-center">
            <RedLabel>{T.messaging.eyebrow}</RedLabel>
            <SectionTitle>{T.messaging.title}</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[600px] mx-auto">
              {T.messaging.body}
            </p>
            <div className="mt-12 max-w-[1200px] mx-auto">
              <GlowFrame>
                <MessagesMockup mockupLabel={T.messaging.mockupLabel} items={T.messaging.items} />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 8 — FONCTIONNALITÉS ──────────────────── */}
        <section id="fonctionnalites" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>{T.features.eyebrow}</RedLabel>
              <SectionTitle>{T.features.title}</SectionTitle>
              <p className="text-[14px] text-white/75 leading-relaxed mt-4">
                {T.features.lede}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
              {T.features.items.map((f, i) => {
                const tier = FEATURE_TIERS[i] ?? "PRO";
                return (
                  <div key={f.title} className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                    <div className="flex items-center justify-between mb-4">
                      <TierPill tier={tier} freeLabel={T.features.tierFree} proLabel={T.features.tierPro} />
                    </div>
                    <h3 className="nx-display text-[18px] font-extrabold text-white">{f.title}</h3>
                    <p className="text-[14px] text-white/75 leading-relaxed mt-2">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 9 — PRIX (3-tier comparison) ─────────── */}
        <section id="prix" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>{T.pricing.eyebrow}</RedLabel>
              <SectionTitle>{T.pricing.title}</SectionTitle>
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
                    className={`relative flex-1 bg-[#1A1D24] rounded-xl flex flex-col min-h-[620px] p-8 ${
                      v.highlighted ? "border-2 border-[#E63946]" : "border border-white/[0.06]"
                    }`}
                  >
                    {tier.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex px-3 py-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold uppercase tracking-wider">
                        {tier.badge}
                      </span>
                    )}

                    {/* Header */}
                    <h3 className="text-[20px] font-bold text-white">{tier.name}</h3>

                    {/* Price */}
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className={`nx-display text-[36px] font-extrabold leading-none ${v.priceColor}`}>
                        {tier.price}
                      </span>
                      {tier.priceSuffix && (
                        <span className="text-[16px] text-white/55 font-semibold">{tier.priceSuffix}</span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/55 mt-2">{tier.subtitle}</p>

                    {/* Divider */}
                    <div className="h-px bg-white/[0.06] my-6" />

                    {/* Feature list */}
                    <div className="flex-1">
                      {tier.subheader && (
                        <p className="text-[13px] text-white/55 mb-3">{tier.subheader}</p>
                      )}
                      <ul className="space-y-2">
                        {tier.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3 text-[14px] text-white/85 leading-snug">
                            <span className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ${v.checkColor}`}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Button pinned to bottom */}
                    <Link
                      href="/inscription"
                      className={`mt-8 inline-flex items-center justify-center w-full rounded-lg font-bold uppercase tracking-wider text-[13px] py-3 px-5 transition-colors ${btnClass}`}
                    >
                      {T.pricing.cta}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 11 — FINAL CTA ───────────────────────── */}
        <section id="cta" className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[820px] mx-auto px-6 py-28 text-center">
            <span className="inline-block w-10 h-[2px] bg-[#E63946] mb-8" />

            <h2 className="nx-display text-[40px] sm:text-[56px] font-extrabold text-white leading-[1.05] tracking-tight">
              {T.cta.title1}<span className="text-[#E63946]">{T.cta.title2}</span>{T.cta.title3}
            </h2>

            <p className="text-[16px] sm:text-[17px] text-white/75 leading-relaxed mt-6 max-w-[560px] mx-auto">
              {T.cta.body}
            </p>

            <div className="mt-10">
              <Link
                href="/inscription"
                className="inline-flex items-center justify-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                style={{ fontSize: 16, padding: "16px 40px" }}
              >
                {T.cta.button}
              </Link>
            </div>

            <div className="mt-6 flex items-center justify-center gap-5 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                {T.cta.trustFree}
              </span>
              <span className="w-px h-3 bg-white/15" />
              <span>{T.cta.trustQuick}</span>
            </div>

            <p className="text-[13px] text-white/55 mt-10">
              {T.cta.noPlayersPrefix}
              <Link href="/pour-les-etudiant-athlete" className="text-[#E63946] font-semibold hover:underline">
                {T.cta.noPlayersLink}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
