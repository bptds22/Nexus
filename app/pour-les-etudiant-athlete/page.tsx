"use client";

/* ═══════════════════════════════════════════════════════════════
   Pour les étudiants-athlètes — public marketing landing v2.

   Web-only: notFound() on the Capacitor build (mobile app has its own
   athlete flow). DO NOT remove the short-circuit below.

   Structure follows the athlete-landing mockup (13 sections). All copy
   flows from t.athleteLanding (strict i18n, FR/EN). Dark permanent.
   Background harmonized on #111317 (token wl-bg).

   Assets provided by BP (clean placeholders wired below):
     1. HERO_CARD_SRC — hero player-card image
     2. WOW_VIDEO_SRC — onboarding WOW video (phone frame)
     3. YT_VIDEO_ID   — YouTube id for the mobile section
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import FadeIn from "@/components/marketing/FadeIn";
import PlayerCard3D from "@/components/marketing/PlayerCard3D";
import YouTubeFacade from "@/components/marketing/YouTubeFacade";
import StarTiers from "@/components/marketing/StarTiers";
import ProgressRing from "@/components/marketing/ProgressRing";
import Marquee from "@/components/marketing/Marquee";
import LiveTicker from "@/components/marketing/LiveTicker";
import NxIcon from "@/components/ui/NxIcon";
import { motion } from "framer-motion";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { createClient } from "@/lib/supabase/client";

/* ── BP-provided assets (live) ────────────────────────────────── */
const HERO_CARD_SRC = "/nexus-card-flag-football-male.png"; // carte hero (1215×1818, 2/3)
const WOW_VIDEO_SRC = "/nexus-wow.mp4"; // effet WOW — muet/loop/playsinline
const YT_VIDEO_ID = "MDwFfag2FSc"; // section Mobile — youtube.com/watch?v=MDwFfag2FSc

/* Sports — mirror of the `sports` table (16 rows, excl. "Autre"). Seeds
   first paint + serves as fallback; the live list is fetched from the
   table on mount (see useEffect). NB: Golf/Tennis ne sont PAS des sports
   Nexus — la vraie liste inclut "Soccer intérieur". */
const SPORTS_SEED = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball", "Athlétisme",
  "Flag football", "Rugby", "Cheerleading", "Natation", "Badminton",
  "Cross-country", "Futsal", "Baseball", "Ultimate frisbee", "Soccer intérieur",
];

/* Icon keys per section (kept in code; only text flows from the dict). */
const PROBLEM_ICONS = ["eyeOff", "film", "gradCap"] as const;
const PARCOURS_ICONS = ["layers", "target", "calendar"] as const;
const PARTNER_ICONS = ["dumbbell", "shield", "activity"] as const;
const PARENTS_ICONS = ["wallet", "mapPin", "shield", "user"] as const;
const ROADMAP_ICONS = ["trophy", "calendar", "building", "target"] as const;

const REGISTER_HREF = "/inscription?role=ATHLETE";

export default function PourLesEtudiantAthletePage() {
  // Mobile build (Capacitor): page exclue. NE PAS retirer.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  const { t } = useTranslation();
  const T = t.athleteLanding;

  // Sports list sourced from the `sports` table (deliverable c), seeded
  // for SSR/first paint + fallback if anon RLS blocks the read.
  const [sports, setSports] = useState<string[]>(SPORTS_SEED);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("sports")
          .select("nom")
          .neq("nom", "Autre")
          .order("nom");
        if (!cancelled && !error && data && data.length) {
          setSports(data.map((s: { nom: string }) => s.nom));
        }
      } catch {
        /* keep the seed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-[#111317] min-h-screen text-white">
      <MarketingNav />

      {/* ── 1 · HERO ─────────────────────────────────────────── */}
      <section className="hero-playbook relative overflow-hidden">
        <PlaybookBackground />
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <FadeIn>
              <span className="inline-flex items-center gap-2 rounded-full border border-wl-red/30 bg-wl-red/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-wl-red">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wl-red opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-wl-red" />
                </span>
                {T.hero.livePill}
              </span>
            </FadeIn>
            <FadeIn delay={0.1}>
              <h1 className="nx-display mt-6 text-4xl sm:text-5xl lg:text-[56px] font-black uppercase leading-[0.95] tracking-tight">
                {T.hero.title}
              </h1>
            </FadeIn>
            <FadeIn delay={0.2}>
              <p className="mt-6 max-w-[520px] text-[18px] leading-relaxed text-[#9CA3AF]">
                {T.hero.subtitle}
              </p>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={REGISTER_HREF}
                  className="inline-flex items-center rounded-md bg-wl-red px-8 py-4 font-head text-[14px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#FF5C58]"
                >
                  {T.hero.ctaPrimary}
                  <span className="ml-2">&rarr;</span>
                </Link>
                <Link
                  href="/comment-ca-marche"
                  className="nx-ghost-btn inline-flex h-12 items-center border px-6 font-head text-xs font-bold uppercase tracking-widest"
                >
                  {T.hero.ctaSecondary}
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-[#6B7280]">{T.hero.microCopy}</p>
            </FadeIn>
          </div>

          {/* Hero card — BP image with CSS fallback */}
          <FadeIn delay={0.2} className="mx-auto w-full max-w-[340px]">
            <PlayerCard3D
              src={HERO_CARD_SRC}
              alt={T.playerCard.alt}
              fallback={<HeroCardFallback T={T} />}
            />
          </FadeIn>
        </div>
      </section>

      {/* ── 2 · SPORTS MARQUEE ───────────────────────────────── */}
      <section className="border-y border-white/5 py-8">
        <p className="mb-5 text-center text-[12px] font-bold uppercase tracking-[0.22em] text-[#6B7280]">
          {T.sports.eyebrow}
        </p>
        <Marquee items={sports} />
      </section>

      {/* ── 3 · STAT BAR ─────────────────────────────────────── */}
      <StatBar labels={T.stats.items.map((s) => s.label)} />

      {/* ── 4 · PROBLEM ──────────────────────────────────────── */}
      <Section eyebrow={T.problem.eyebrow} title={T.problem.title}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {T.problem.items.map((p, i) => (
            <FadeIn key={p.title} delay={i * 0.1}>
              <Card>
                <IconBubble name={PROBLEM_ICONS[i]} />
                <h3 className="nx-display mt-4 mb-2 text-[16px] font-bold text-white">{p.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#9CA3AF]">{p.description}</p>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* ── 5 · TA CARTE (WOW video, 9:16 frame, no crop) ────── */}
      <Section eyebrow={T.taCarte.eyebrow} title={T.taCarte.title}>
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <FadeIn>
            <p className="max-w-[460px] text-[16px] leading-relaxed text-[#9CA3AF]">{T.taCarte.body}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {T.taCarte.chips.map((c, i) => (
                <FloatingChip key={c} delay={i * 0.3}>
                  {c}
                </FloatingChip>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.15} className="relative mx-auto w-full max-w-[300px]">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[48px]"
              style={{
                background: "radial-gradient(closest-side, rgba(230,57,70,0.22), transparent 75%)",
                filter: "blur(10px)",
              }}
            />
            <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                className="block aspect-[9/16] h-full w-full object-contain"
                src={WOW_VIDEO_SRC}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* ── 6 · MON PARCOURS (progress ring) ─────────────────── */}
      <Section eyebrow={T.monParcours.eyebrow} title={T.monParcours.title}>
        <div className="grid items-center gap-12 lg:grid-cols-[auto,1fr]">
          <FadeIn className="mx-auto">
            <ProgressRing pct={100} size={200} sublabel={T.monParcours.ringSublabel} />
          </FadeIn>
          <div className="grid gap-4">
            {T.monParcours.items.map((it, i) => (
              <FadeIn key={it.title} delay={i * 0.1}>
                <Card className="flex items-start gap-4">
                  <IconBubble name={PARCOURS_ICONS[i]} />
                  <div>
                    <h3 className="nx-display mb-1 text-[16px] font-bold text-white">{it.title}</h3>
                    <p className="text-[14px] leading-relaxed text-[#9CA3AF]">{it.description}</p>
                  </div>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </Section>

      {/* ── 7 · VISIBILITY (centered, counter + ticker) ──────── */}
      <Section eyebrow={T.visibility.eyebrow} title={T.visibility.title} center>
        <FadeIn>
          <p className="mx-auto max-w-[560px] text-center text-[16px] leading-relaxed text-[#9CA3AF]">
            {T.visibility.body}
          </p>
        </FadeIn>
        <ViewsCounter label={T.visibility.viewsLabel} />
        <FadeIn delay={0.15} className="mx-auto mt-8 max-w-[560px]">
          <LiveTicker messages={T.visibility.tickerMessages} />
        </FadeIn>
      </Section>

      {/* ── 8 · MOBILE (YouTube 16:9, clean card) ────────────── */}
      <Section eyebrow={T.mobile.eyebrow} title={T.mobile.title} center>
        <FadeIn>
          <p className="mx-auto mb-6 max-w-[560px] text-center text-[16px] leading-relaxed text-[#9CA3AF]">
            {T.mobile.body}
          </p>
        </FadeIn>
        <FadeIn delay={0.1} className="relative mx-auto max-w-3xl">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[32px]"
            style={{
              background: "radial-gradient(closest-side, rgba(230,57,70,0.18), transparent 75%)",
              filter: "blur(10px)",
            }}
          />
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1A1D24] shadow-[0_20px_60px_-25px_rgba(0,0,0,0.7)]">
            <div className="h-[3px] w-full bg-wl-red" />
            <YouTubeFacade
              videoId={YT_VIDEO_ID}
              title={T.mobile.title}
              placeholderLabel={T.mobile.videoPlaceholder}
            />
          </div>
        </FadeIn>
        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2.5">
          {T.mobile.chips.map((c, i) => (
            <FloatingChip key={c} delay={i * 0.25}>
              {c}
            </FloatingChip>
          ))}
        </div>
      </Section>

      {/* ── 9 · COACH (cote globale / star tiers) ────────────── */}
      <Section eyebrow={T.coach.eyebrow} title={T.coach.title}>
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <FadeIn>
              <p className="max-w-[480px] text-[16px] leading-relaxed text-[#9CA3AF]">{T.coach.body}</p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p className="mt-6 max-w-[480px] border-l-2 border-wl-red pl-4 text-[18px] font-bold leading-snug text-white">
                {T.coach.badgeLine}
              </p>
            </FadeIn>
            <FadeIn delay={0.2}>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-wl-info/30 bg-wl-info/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-wl-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                {T.coach.verified}
              </span>
            </FadeIn>
          </div>
          <FadeIn delay={0.15}>
            <StarTiers
              tiers={T.starTiers.items.map((it, i) => ({
                stars: 5 - i, // items run 5★ → 1★
                label: it.label,
                description: it.description,
              }))}
            />
          </FadeIn>
        </div>
      </Section>

      {/* ── 10 · PARTNERS (generic, no logos) ────────────────── */}
      <Section eyebrow={T.partners.eyebrow} title={T.partners.title} center>
        <FadeIn>
          <p className="mx-auto mb-10 max-w-[560px] text-center text-[16px] leading-relaxed text-[#9CA3AF]">
            {T.partners.body}
          </p>
        </FadeIn>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {T.partners.items.map((it, i) => (
            <FadeIn key={it.title} delay={i * 0.1}>
              <Card className="text-center">
                <div className="flex justify-center">
                  <IconBubble name={PARTNER_ICONS[i]} />
                </div>
                <h3 className="nx-display mt-4 mb-2 text-[16px] font-bold text-white">{it.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#9CA3AF]">{it.description}</p>
              </Card>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.3}>
          <p className="mt-8 text-center text-[13px] uppercase tracking-[0.16em] text-[#6B7280]">{T.partners.soon}</p>
        </FadeIn>
      </Section>

      {/* ── 11 · PARENTS ─────────────────────────────────────── */}
      <Section eyebrow={T.parents.eyebrow} title={T.parents.title}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {T.parents.items.map((it, i) => (
            <FadeIn key={it.title} delay={(i % 2) * 0.1}>
              <Card className="flex items-start gap-4">
                <IconBubble name={PARENTS_ICONS[i]} />
                <div>
                  <h3 className="nx-display mb-1 text-[16px] font-bold text-white">{it.title}</h3>
                  <p className="text-[14px] leading-relaxed text-[#9CA3AF]">{it.description}</p>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* ── 12 · ROADMAP ─────────────────────────────────────── */}
      <Section eyebrow={T.roadmap.eyebrow} title={T.roadmap.title}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {T.roadmap.items.map((it, i) => (
            <FadeIn key={it.title} delay={i * 0.1}>
              <Card>
                <IconBubble name={ROADMAP_ICONS[i]} />
                <h3 className="nx-display mt-4 mb-2 text-[15px] font-bold text-white">{it.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#9CA3AF]">{it.description}</p>
              </Card>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.2}>
          <p className="mt-8 text-center text-[13px] uppercase tracking-[0.16em] text-[#6B7280]">{T.roadmap.note}</p>
        </FadeIn>
      </Section>

      {/* ── 13 · FINAL CTA ───────────────────────────────────── */}
      <section className="bg-gradient-to-b from-[#111317] to-[#1A1D24] py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <FadeIn>
            <p className="mb-4 text-[14px] font-head font-bold uppercase tracking-[0.2em] text-wl-red">
              {T.finalCta.eyebrow}
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="nx-display mb-8 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
              {T.finalCta.title}
            </h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <Link
              href={REGISTER_HREF}
              className="inline-flex items-center rounded-md bg-wl-red px-10 py-4 font-head text-[14px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#FF5C58]"
            >
              {T.finalCta.button}
              <span className="ml-2">&rarr;</span>
            </Link>
            <p className="mt-4 text-[13px] text-[#6B7280]">{T.finalCta.subtext}</p>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Local section primitives
═══════════════════════════════════════════════════════════════ */

function Section({
  eyebrow,
  title,
  center = false,
  children,
}: {
  eyebrow: string;
  title: string;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className={center ? "text-center" : ""}>
          <FadeIn>
            <p className="mb-4 text-[14px] font-head font-bold uppercase tracking-[0.2em] text-wl-red">
              {eyebrow}
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="nx-display mb-12 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
              {title}
            </h2>
          </FadeIn>
        </div>
        {children}
      </div>
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`h-full rounded-xl border border-[#1e2128] bg-[#1A1D24] p-6 ${className}`}>
      {children}
    </div>
  );
}

function IconBubble({ name }: { name: string }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-wl-red/10">
      <NxIcon name={name} size={22} className="text-wl-red" />
    </div>
  );
}

/* Floating feature pill — gentle idle float; static on reduced motion. */
function FloatingChip({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  const cls =
    "inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1A1D24] px-3.5 py-2 text-[12px] font-semibold text-[#D1D5DB]";
  const dot = <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-wl-red" aria-hidden />;
  if (reduced) {
    return (
      <span className={cls}>
        {dot}
        {children}
      </span>
    );
  }
  return (
    <motion.span
      className={cls}
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {dot}
      {children}
    </motion.span>
  );
}

/* Stat bar — red clip-path band with three count-up figures.
   Values (70 / 1163 / 100%) are data, not copy; labels come from i18n. */
function StatBar({ labels }: { labels: string[] }) {
  const a = useCountUp(70);
  const b = useCountUp(1163);
  const c = useCountUp(100);
  const stats = [
    { cu: a, suffix: "" },
    { cu: b, suffix: "" },
    { cu: c, suffix: "%" },
  ];
  return (
    <section className="py-10">
      <div
        className="bg-wl-red"
        style={{ clipPath: "polygon(0 14%, 100% 0, 100% 86%, 0 100%)" }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-14 text-center sm:grid-cols-3">
          {stats.map((s, i) => (
            <div key={i} ref={s.cu.ref}>
              <p className="nx-display text-5xl font-black text-white">
                {s.cu.value}
                {s.suffix}
              </p>
              <p className="mt-2 text-[13px] font-bold uppercase tracking-[0.14em] text-white/80">
                {labels[i]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Big animated views figure for the visibility section. */
function ViewsCounter({ label }: { label: string }) {
  const { value, ref } = useCountUp(127);
  return (
    <div ref={ref} className="mt-10 text-center">
      <p className="nx-display text-6xl font-black text-white sm:text-7xl">{value}</p>
      <p className="mt-2 text-[13px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">{label}</p>
    </div>
  );
}

/* CSS fallback card shown if the BP hero image is absent. Carries its
   own chrome: verified blue badge (wl-info), gold stars, OUVERT status. */
function HeroCardFallback({ T }: { T: ReturnType<typeof useTranslation>["t"]["athleteLanding"] }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#22262E] to-[#111317]">
      <div className="relative flex-1 bg-gradient-to-br from-[#2D3748] to-[#1A1D24]">
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-wl-info/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-wl-info">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          {T.playerCard.verified}
        </span>
        <span className="absolute right-3 top-3 flex items-center gap-0.5 rounded bg-black/60 px-1.5 py-1 backdrop-blur">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden>
              <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" />
            </svg>
          ))}
        </span>
      </div>
      <div className="p-4">
        <p className="nx-display text-lg font-black uppercase text-white">{T.playerCard.fallbackName}</p>
        <p className="text-[13px] text-[#9CA3AF]">{T.playerCard.fallbackPosition}</p>
        <p className="mt-1 text-[12px] text-[#6B7280]">{T.playerCard.fallbackSchool}</p>
        <span className="mt-3 inline-block rounded-full bg-wl-success/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-wl-success">
          {T.playerCard.fallbackStatus}
        </span>
      </div>
    </div>
  );
}
