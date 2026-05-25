"use client";

import Link from "next/link";
import PlaybookBackground from "./components/PlaybookBackground";
import PartnerCarousel from "./components/PartnerCarousel";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import { useTranslation } from "@/lib/i18n/useTranslation";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Homepage (rewrite)
   Four sections only: Hero, Persona Cards, Trust Strip, Footer.
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

export default function Home() {
  const { t } = useTranslation();
  return (
    <div className="hero-playbook bg-[#111317] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      {/* ══════════════════════════════════════════
          SECTION 1 — HERO (CityPunks layout)
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-transparent min-h-[calc(100vh-72px)] lg:min-h-[calc(100vh-72px)]">

        {/* Extra red atmospheric glow centered on card */}
        <div className="nx-hero-glow" aria-hidden />

        {/* Floating playbook particles */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <span className="nx-particle" style={{ top: '12%', right: '38%' }}>X</span>
          <span className="nx-particle red" style={{ top: '18%', right: '8%', fontSize: '24px' }}>O</span>
          <span className="nx-particle" style={{ top: '22%', right: '48%', fontSize: '28px' }}>X</span>
          <span className="nx-particle" style={{ top: '35%', right: '5%', fontSize: '22px' }}>O</span>
          <span className="nx-particle red" style={{ top: '50%', right: '42%', fontSize: '20px' }}>X</span>
          <span className="nx-particle" style={{ top: '58%', right: '4%' }}>X</span>
          <span className="nx-particle" style={{ top: '72%', right: '38%', fontSize: '22px' }}>O</span>
          <span className="nx-particle" style={{ top: '80%', right: '12%', fontSize: '18px' }}>O</span>
          <span className="nx-particle red" style={{ top: '85%', right: '45%', fontSize: '16px' }}>X</span>
        </div>

        {/* ── Mobile-first stacking + absolute on lg ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-32 lg:pt-0 lg:pb-0 lg:min-h-[calc(100vh-72px)] flex flex-col lg:block">

          {/* ── Athlete card v30 — UNCHANGED, just repositioned ── */}
          <div className="order-2 flex justify-center mt-16 lg:mt-0 lg:absolute lg:top-1/2 lg:right-[3%] lg:-translate-y-1/2 lg:scale-125 lg:origin-right lg:z-20">
            <div className="nx-v30-wrap relative" style={{ width: 340, paddingTop: 6, paddingBottom: 10 }}>

              {/* Verified badge — 3D lapel pin */}
              <div className="nx-v30-badge absolute z-30" style={{ top: 12, right: -14 }}>
                <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
                  <defs>
                    <radialGradient id="bg_grad" cx="38%" cy="28%" r="68%">
                      <stop offset="0%" stopColor="#29AAFF"/>
                      <stop offset="55%" stopColor="#0094F0"/>
                      <stop offset="100%" stopColor="#0060C0"/>
                    </radialGradient>
                    <radialGradient id="shine" cx="38%" cy="25%" r="55%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.32)"/>
                      <stop offset="60%" stopColor="rgba(255,255,255,0)"/>
                    </radialGradient>
                  </defs>
                  <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35"/>
                  <circle cx="27" cy="27" r="24" fill="url(#bg_grad)"/>
                  <circle cx="27" cy="27" r="24" fill="url(#shine)"/>
                  <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                  <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>

              {/* Main card — keep exactly as-is */}
              <div className="nx-v30-card relative overflow-visible" style={{ width: 340, borderRadius: 10 }}>
                <div className="relative overflow-hidden" style={{ width: 340, height: 500, borderRadius: 10, background: '#2F3440' }}>
                  <div className="absolute inset-0 z-[1]" style={{ backgroundImage: "url('/player_card%20image%20Bruno%207.png')", backgroundSize: 'cover', backgroundPosition: 'center top -40px' }} />
                  <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
                  <div className="absolute top-0 right-0 z-20" style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 20px 20px 0', borderColor: 'transparent #1E2128 transparent transparent' }} />
                </div>

                <div className="nx-v30-ticket absolute z-[999] overflow-hidden" style={{ bottom: -16, right: -26, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex" style={{ width: 364 }}>
                    <div className="flex flex-col justify-between" style={{ background: '#1E2128', padding: '14px 16px 14px 18px', minWidth: 109, gap: 5 }}>
                      {[{ lbl: t.home.card.sportLabel, val: "Football" }, { lbl: t.home.card.positionLabel, val: "QB" }, { lbl: t.home.card.numberLabel, val: "#12" }].map((r) => (
                        <div key={r.lbl}>
                          <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 2 }}>{r.lbl}</div>
                          <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontSize: 18, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>{r.val}</div>
                        </div>
                      ))}
                    </div>
                    <div className="nx-v30-perf flex flex-col items-center justify-center" style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}>
                      {[...Array(8)].map((_, i) => (
                        <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
                      ))}
                    </div>
                    <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '14px 18px' }}>
                      <svg width="150" height="22" viewBox="0 0 150 22" fill="none" style={{ display: 'block', marginBottom: 8 }}>
                        {[0, 30, 60, 90, 120].map((x) => (
                          <path key={x} d="M11,0L13.5,8L22,8L15.5,13L18,21L11,16.2L4,21L6.5,13L0,8L8.5,8Z" fill="#F59E0B" transform={`translate(${x},0)`}/>
                        ))}
                      </svg>
                      <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1E2128', marginBottom: 2 }}>{t.home.card.schoolName}</div>
                      <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>{t.home.card.location}</div>
                      <div style={{ fontFamily: 'var(--font-heading), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E63946', marginTop: 2 }}>{t.home.card.promotion}</div>
                    </div>
                    <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#E63946', width: 26, writingMode: 'vertical-rl', fontFamily: 'var(--font-heading), sans-serif', fontSize: 11, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)' }}>NEXUS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Text cluster — bottom-left on lg, normal flow on mobile ── */}
          <div className="order-1 lg:absolute lg:bottom-24 lg:left-14 lg:max-w-2xl lg:z-30">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-10 h-px bg-[#E63946]" />
              <span className={`${label} text-[#E63946]`}>{t.home.hero.eyebrow}</span>
            </div>

            <h1 className="nx-display text-6xl lg:text-8xl xl:text-[112px] font-black uppercase leading-[0.9] tracking-tight mb-6">
              <span className="block text-white">{t.home.hero.titleLine1}</span>
              <span className="block text-[#E63946]">{t.home.hero.titleLine2}</span>
            </h1>

            <p className="font-sans text-base text-white/85 font-semibold leading-relaxed max-w-[480px] mb-3">
              {t.home.hero.ledeStrong}
            </p>
            <p className="font-sans text-base text-[#9CA3AF] leading-relaxed max-w-[480px] mb-8">
              {t.home.hero.lede}
            </p>

            <div className="flex flex-wrap items-center gap-6">
              <Link
                href="/inscription?role=ATHLETE"
                className="inline-flex items-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(230,57,70,0.4)] transition-all rounded"
              >
                {t.home.hero.ctaPrimary}
                <span aria-hidden>→</span>
              </Link>

              <Link
                href="/comment-ca-marche"
                className="inline-flex items-center gap-3 text-white font-sans font-semibold text-sm group"
              >
                <span className="w-10 h-10 rounded-full border-[1.5px] border-white/35 inline-flex items-center justify-center group-hover:border-white group-hover:bg-white/5 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2 1 L10 6 L2 11 Z" fill="#fff"/></svg>
                </span>
                {t.home.hero.ctaSecondary}
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2 — PARTNER CAROUSEL (live media_partners)
      ══════════════════════════════════════════ */}
      <PartnerCarousel />

      <Footer />

    </div>
  );
}
