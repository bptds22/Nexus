"use client";

import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { useTranslation } from "@/lib/i18n/useTranslation";

/* ═══════════════════════════════════════════════════════════════
   Roadmap — phased timeline, dots + text only (no cards)
═══════════════════════════════════════════════════════════════ */

type PhaseTone = "amber" | "blue" | "red" | "white";

// Tone per phase (order matches the dictionary's phases array).
const PHASE_TONES: PhaseTone[] = ["amber", "blue", "red", "white"];

/* ── Tone → classes ────────────────────────────────────────── */

const TONE_HEADER: Record<PhaseTone, { dot: string; label: string }> = {
  amber: { dot: "bg-[#F59E0B]",       label: "text-[#F59E0B]" },
  blue:  { dot: "bg-[#3B82F6]",       label: "text-[#3B82F6]" },
  red:   { dot: "bg-[#E63946]",       label: "text-[#E63946]" },
  white: { dot: "bg-white",           label: "text-white" },
};

const TONE_FEATURE_DOT: Record<PhaseTone, string> = {
  amber: "bg-[#F59E0B]/60",
  blue:  "bg-[#3B82F6]/60",
  red:   "bg-[#E63946]/60",
  white: "bg-white/60",
};

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] sm:text-[14px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function RoadmapPage() {
  const { t } = useTranslation();
  const T = t.roadmap;

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── HERO ──────────────────────────────────────────── */}
        <section>
          <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-12 text-center">
            <RedLabel>{T.hero.eyebrow}</RedLabel>
            <h1 className="nx-display text-[40px] sm:text-[48px] font-extrabold text-white leading-[1.05] tracking-tight mt-4">
              {T.hero.title}
            </h1>
            <p className="text-[16px] text-white/60 leading-[1.7] mt-5 max-w-[640px] mx-auto">
              {T.hero.lede}
            </p>
          </div>
        </section>

        {/* ─── TIMELINE ──────────────────────────────────────── */}
        <section className="pb-16">
          <div className="max-w-[800px] mx-auto px-6">
            <div className="relative border-l-2 border-white/10 ml-[7px]">
              {T.phases.map((phase, pi) => {
                const tone = PHASE_TONES[pi] ?? "white";
                const header = TONE_HEADER[tone];
                const featureDot = TONE_FEATURE_DOT[tone];
                return (
                  <div key={phase.code} className={pi > 0 ? "pt-[60px]" : ""}>
                    {/* Phase header */}
                    <div className="relative pl-10 pb-2">
                      <span
                        aria-hidden="true"
                        className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-[#111317] ${header.dot}`}
                      />
                      <p className={`text-[12px] sm:text-[13px] font-bold tracking-[0.25em] uppercase ${header.label}`}>
                        {phase.code} · {phase.label}
                      </p>
                    </div>

                    {/* Features */}
                    <ul className="list-none space-y-[32px] mt-6">
                      {phase.items.map((f) => (
                        <li
                          key={f.title}
                          className="relative pl-10 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[5px] top-[10px] w-2 h-2 rounded-full ring-4 ring-[#111317] ${featureDot}`}
                          />
                          <p className="text-[16px] sm:text-[17px] font-bold text-white leading-snug">
                            {f.title}
                          </p>
                          <p className="text-[14px] sm:text-[15px] text-white/60 leading-relaxed mt-1.5">
                            {f.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── BOTTOM — Suggestion ───────────────────────────── */}
        <section className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[600px] mx-auto px-6 py-16 sm:py-20 text-center">
            <h3 className="nx-display text-[24px] sm:text-[28px] font-extrabold text-white tracking-tight">
              {T.bottom.title}
            </h3>
            <p className="text-[15px] text-white/65 leading-relaxed mt-4">
              {T.bottom.body}
            </p>
            <Link
              href="/a-propos"
              className="inline-block mt-6 text-[14px] font-bold uppercase tracking-wider text-[#E63946] hover:text-[#FF5C58] transition-colors"
            >
              {T.bottom.cta}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
