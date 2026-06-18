"use client";

import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import Footer from "@/components/marketing/Footer";
import { useTranslation } from "@/lib/i18n/useTranslation";

import { notFound } from "next/navigation";
/* ═══════════════════════════════════════════════════════════════
   Comment ça marche — Manifesto + credibility page
   Public marketing, no auth, no Supabase, static content.
═══════════════════════════════════════════════════════════════ */

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

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={i < count ? "#F59E0B" : "#4a4d56"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

/* ── Data (non-translatable structural data) ────────────────── */

// Badge keys + visual config stay in code; the localizable name/desc/detail
// come from the dictionary so the badge order/identity is centrally controlled.
const BADGE_KEYS = [
  "captain",
  "allstar",
  "progression",
  "team_leader",
  "league_leader",
  "mvp",
  "custom",
] as const;

// Pairs each persona persona card with its target href; the question, line,
// and label live in the dictionary array (same order).
const PERSONA_HREFS = [
  "/pour-les-etudiant-athlete",
  "/pour-les-coachs",
  "/pour-les-recruteurs",
];

// Reputation badge visual config — colors stay in code, names/thresholds
// come from t.howItWorks.reputation.badges.
const REPUTATION_BADGE_VISUALS = [
  { border: "border-white/10", iconColor: "text-[#9CA3AF]" },
  { border: "border-white/25", iconColor: "text-white" },
  { border: "border-[#F59E0B]/40", iconColor: "text-[#F59E0B]" },
  { border: "border-[#E63946]/50", iconColor: "text-[#E63946]" },
];

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function CommentCaMarche() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t } = useTranslation();
  const T = t.howItWorks;

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO (manifesto opening) ──────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-16 text-center">
            <RedLabel>{T.hero.eyebrow}</RedLabel>
            <h1 className="nx-display text-[42px] sm:text-[52px] font-[800] text-white leading-[1.05] tracking-tight mt-4">
              {T.hero.title}
            </h1>
            <p className="text-[18px] text-white/75 leading-[1.7] mt-8 max-w-[720px] mx-auto">
              {T.hero.lede}
            </p>
            <p className="text-[14px] text-white/40 mt-10">{T.hero.discoverHint}</p>
          </div>
        </section>

        {/* ─── SECTION 2 — POURQUOI NEXUS EXISTE ─────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[800px] mx-auto px-6 py-20">
            <RedLabel>{T.why.eyebrow}</RedLabel>
            <SectionTitle>{T.why.title}</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7]">
              <p>{T.why.p1}</p>
              <p>{T.why.p2}</p>
              <p>{T.why.p3}</p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — LA VÉRIFICATION ───────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <RedLabel>{T.verification.eyebrow}</RedLabel>
            <SectionTitle>{T.verification.title}</SectionTitle>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-5 max-w-[800px]">
              {T.verification.lede}
            </p>

            {/* Two check cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
              {/* Gray check */}
              <div className="bg-[#1A1D24] rounded-2xl border border-white/10 p-8">
                <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="font-head text-[17px] font-black text-white tracking-tight">{T.verification.grayTitle}</h3>
                <p className="text-[14px] text-white/65 leading-relaxed mt-3">
                  {T.verification.grayBody}
                </p>
              </div>

              {/* Blue check */}
              <div className="bg-[#1A1D24] rounded-2xl border border-[#3B82F6]/40 p-8">
                <div className="w-12 h-12 rounded-full bg-[#3B82F6] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="font-head text-[17px] font-black text-white tracking-tight">{T.verification.blueTitle}</h3>
                <p className="text-[14px] text-white/65 leading-relaxed mt-3">
                  {T.verification.blueBody}
                </p>
              </div>
            </div>

            {/* Explainer box */}
            <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8 mt-6">
              <h3 className="font-head text-[17px] font-black text-white tracking-tight">{T.verification.perishableTitle}</h3>
              <p className="text-[14px] text-white/65 leading-relaxed mt-3">
                {T.verification.perishableBody}
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4 — LES ÉTOILES ──────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-20">
            <RedLabel>{T.stars.eyebrow}</RedLabel>
            <SectionTitle>{T.stars.title}</SectionTitle>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-5 max-w-[800px]">
              {T.stars.lede}
            </p>

            {/* Star rows — count derived from index (5..1) */}
            <div className="mt-10 space-y-3">
              {T.stars.definitions.map((text, i) => {
                const count = 5 - i;
                return (
                  <div key={count} className="flex items-start gap-5 bg-[#1A1D24] rounded-xl border border-white/[0.06] p-5">
                    <div className="shrink-0 pt-0.5">
                      <Stars count={count} />
                    </div>
                    <p className="text-[14px] text-white/75 leading-relaxed">{text}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-[15px] text-white/65 leading-relaxed mt-8 italic">
              {T.stars.closing}
            </p>
          </div>
        </section>

        {/* ─── SECTION 5 — POURQUOI PAS JUSTE DES STATS ─────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-20">
            <RedLabel>{T.philosophy.eyebrow}</RedLabel>
            <SectionTitle>{T.philosophy.title}</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7] max-w-[800px]">
              <p>{T.philosophy.p1}</p>
              <p>{T.philosophy.p2}</p>
              <p>{T.philosophy.p3}</p>
            </div>

            <h3 className="nx-display text-[20px] font-extrabold text-white tracking-tight mt-12">
              {T.philosophy.badgesTitle}
            </h3>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-4 max-w-[800px]">
              {T.philosophy.badgesLede}
            </p>

            {/* Badge showcase — 4 top, 3 centered below */}
            <div className="mt-10">
              <div className="flex flex-wrap justify-center gap-4">
                {BADGE_KEYS.slice(0, 4).map((key, i) => {
                  const detail =
                    key === "team_leader" ? T.philosophy.badgeDetails.team_leader :
                    key === "league_leader" ? T.philosophy.badgeDetails.league_leader :
                    key === "custom" ? T.philosophy.badgeDetails.custom :
                    undefined;
                  return <DistinctionBadge key={key} badge={key} detail={detail} size="lg" index={i} />;
                })}
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {BADGE_KEYS.slice(4).map((key, i) => {
                  const detail =
                    key === "team_leader" ? T.philosophy.badgeDetails.team_leader :
                    key === "league_leader" ? T.philosophy.badgeDetails.league_leader :
                    key === "custom" ? T.philosophy.badgeDetails.custom :
                    undefined;
                  return <DistinctionBadge key={key} badge={key} detail={detail} size="lg" index={i + 4} />;
                })}
              </div>
            </div>

            <p className="text-[15px] text-white/65 leading-relaxed mt-10">
              {T.philosophy.badgesClosing}
            </p>
          </div>
        </section>

        {/* ─── SECTION 6 — LA RÉPUTATION DES COACHS ──────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[900px] mx-auto px-6 py-20">
            <RedLabel>{T.reputation.eyebrow}</RedLabel>
            <SectionTitle>{T.reputation.title}</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7] max-w-[800px]">
              <p>{T.reputation.p1}</p>
              <p>{T.reputation.p2}</p>
            </div>

            {/* 4 badge cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
              {T.reputation.badges.map((b, i) => {
                const v = REPUTATION_BADGE_VISUALS[i];
                return (
                  <div key={b.name} className={`bg-[#1A1D24] rounded-xl border ${v.border} p-5 text-center`}>
                    <p className={`font-head text-[14px] font-black uppercase tracking-wide ${v.iconColor}`}>{b.name}</p>
                    <p className="text-[11px] text-white/45 mt-1">{b.threshold}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-[16px] text-white/75 leading-[1.7] max-w-[800px]">
              <p>{T.reputation.closing}</p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 7 — LA COMMUNICATION ──────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[800px] mx-auto px-6 py-20">
            <RedLabel>{T.communication.eyebrow}</RedLabel>
            <SectionTitle>{T.communication.title}</SectionTitle>

            <div className="mt-8 space-y-6 text-[16px] text-white/75 leading-[1.7]">
              <p>{T.communication.p1}</p>
              <p>{T.communication.p2}</p>
              <p>{T.communication.p3}</p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 8 — CE QUI EST TOUJOURS GRATUIT ──────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <RedLabel>{T.engagement.eyebrow}</RedLabel>
            <SectionTitle>{T.engagement.title}</SectionTitle>
            <p className="text-[16px] text-white/75 leading-[1.7] mt-5 max-w-[800px]">
              {T.engagement.lede}
            </p>

            {/* 3 principle cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
              <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="font-head text-[15px] font-black text-white">{T.engagement.principleAthleteTitle}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed mt-2">
                  {T.engagement.principleAthleteBody}
                </p>
              </div>

              <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 text-[#3B82F6] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3 className="font-head text-[15px] font-black text-white">{T.engagement.principleVisibilityTitle}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed mt-2">
                  {T.engagement.principleVisibilityBody}
                </p>
              </div>

              <div className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                <div className="w-10 h-10 rounded-xl bg-[#E63946]/15 text-[#E63946] flex items-center justify-center mb-5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="font-head text-[15px] font-black text-white">{T.engagement.principleCoachTitle}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed mt-2">
                  {T.engagement.principleCoachBody}
                </p>
              </div>
            </div>

            <p className="text-[15px] text-white/65 leading-relaxed mt-8">
              {T.engagement.closing}
            </p>
          </div>
        </section>

        {/* ─── SECTION 9 — POURQUOI LE SPORT ─────────────────── */}
        <section className="bg-[#0d0f12] border-b border-white/[0.06]">
          <div className="max-w-[720px] mx-auto px-6 py-24 text-center">
            <RedLabel>{T.conviction.eyebrow}</RedLabel>
            <h2 className="nx-display text-[30px] sm:text-[36px] font-extrabold text-white leading-tight tracking-tight mt-3">
              {T.conviction.title}
            </h2>

            <div className="mt-10 space-y-6 text-[17px] text-white/75 leading-[1.7] text-left">
              <p>{T.conviction.p1}</p>
              <p>{T.conviction.p2}</p>
              <p>{T.conviction.p3}</p>
              <p>{T.conviction.p4}</p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 10 — TRIPLE CTA ───────────────────────── */}
        <section className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {T.personas.map((p, i) => {
                const href = PERSONA_HREFS[i];
                return (
                  <div key={href} className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8 flex flex-col">
                    <h3 className="font-head text-[18px] font-black text-white">{p.question}</h3>
                    <p className="text-[14px] text-white/60 leading-relaxed mt-3 flex-1">{p.line}</p>
                    <Link href={href} className="inline-flex items-center gap-1 mt-6 text-[13px] font-bold text-[#E63946] hover:text-[#FF5C58] transition-colors">
                      {p.label}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
