"use client";

import { useEffect } from "react";
import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import PlaybookBackground from "./components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Homepage (rewrite)
   Four sections only: Hero, Persona Cards, Trust Strip, Footer.
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const SOCIALS = [
  {
    name: "Instagram",
    href: "#",
    d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    name: "Facebook",
    href: "#",
    d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    name: "YouTube",
    href: "#",
    d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    name: "TikTok",
    href: "#",
    d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
];

export default function Home() {
  useEffect(() => {
    console.log("[Homepage] Hero section rendered");
    console.log("[Homepage] Persona cards section rendered");
    console.log("[Homepage] Trust strip rendered");
    console.log("[Homepage] Coach CTA button added");
  }, []);

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
          <span className="nx-particle red" style={{ top: '18%', right: '8%', fontSize: '24px' }}>→</span>
          <span className="nx-particle blue" style={{ top: '22%', right: '48%', fontSize: '28px' }}>X</span>
          <span className="nx-particle" style={{ top: '35%', right: '5%', fontSize: '22px' }}>O</span>
          <span className="nx-particle red" style={{ top: '50%', right: '42%', fontSize: '20px' }}>↗</span>
          <span className="nx-particle" style={{ top: '58%', right: '4%' }}>X</span>
          <span className="nx-particle" style={{ top: '72%', right: '38%', fontSize: '22px' }}>O</span>
          <span className="nx-particle blue" style={{ top: '80%', right: '12%', fontSize: '18px' }}>→</span>
          <span className="nx-particle red" style={{ top: '85%', right: '45%', fontSize: '16px' }}>X</span>
        </div>

        {/* ── Mobile-first stacking + absolute on lg ── */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-32 lg:pt-0 lg:pb-0 lg:min-h-[calc(100vh-72px)]">

          {/* ── Athlete card v30 — UNCHANGED, just repositioned ── */}
          <div className="flex justify-center mb-16 lg:mb-0 lg:absolute lg:top-1/2 lg:right-[3%] lg:-translate-y-1/2 lg:scale-125 lg:origin-right lg:z-20">
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
                      {[{ lbl: "Sport", val: "Football" }, { lbl: "Pos", val: "QB" }, { lbl: "No.", val: "#12" }].map((r) => (
                        <div key={r.lbl}>
                          <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 2 }}>{r.lbl}</div>
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
                      <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1E2128', marginBottom: 2 }}>École secondaire Saint-Jean-Eudes</div>
                      <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>Québec, QC</div>
                      <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E63946', marginTop: 2 }}>Promotion 2026</div>
                    </div>
                    <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#E63946', width: 26, writingMode: 'vertical-rl', fontFamily: 'var(--font-heading), sans-serif', fontSize: 11, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)' }}>NEXUS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Text cluster — bottom-left on lg, normal flow on mobile ── */}
          <div className="lg:absolute lg:bottom-24 lg:left-14 lg:max-w-2xl lg:z-30">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-10 h-px bg-[#E63946]" />
              <span className={`${label} text-[#E63946]`}>Plateforme officielle · Québec 2026</span>
            </div>

            <h1 className="nx-display text-6xl lg:text-8xl xl:text-[112px] font-black uppercase leading-[0.9] tracking-tight mb-6">
              <span className="block text-white">Fais-toi voir.</span>
              <span className="block text-[#E63946]">Fais-toi recruter.</span>
            </h1>

            <p className="font-sans text-base text-[#9CA3AF] leading-relaxed max-w-[480px] mb-8">
              <strong className="text-white/85 font-semibold">La plateforme #1 de recrutement d&apos;athlètes au Québec.</strong>{' '}
              Connecte les athlètes du secondaire aux programmes sport-études des CÉGEP.
            </p>

            <div className="flex flex-wrap items-center gap-6">
              <Link
                href="/inscription?role=ATHLETE"
                className="inline-flex items-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(230,57,70,0.4)] transition-all rounded"
              >
                Sois le next
                <span aria-hidden>→</span>
              </Link>

              <Link
                href="/comment-ca-marche"
                className="inline-flex items-center gap-3 text-white font-sans font-semibold text-sm group"
              >
                <span className="w-10 h-10 rounded-full border-[1.5px] border-white/35 inline-flex items-center justify-center group-hover:border-white group-hover:bg-white/5 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2 1 L10 6 L2 11 Z" fill="#fff"/></svg>
                </span>
                Voir comment ça marche
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2 — CHOISIS TON PARCOURS
      ══════════════════════════════════════════ */}
      <section id="roles" className="bg-[#111317]/75 pb-24 pt-16">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-12">
            <span className={`${label} text-[#E63946]`}>Choisis ton parcours</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Card 1 — Athlète ── */}
            <div className="relative overflow-hidden bg-[#1A1D24] border border-[#1E2D4A] rounded-lg p-10 lg:p-12 group">
              {/* Watermark number */}
              <div className="absolute -right-8 -bottom-4 nx-display text-[200px] font-black text-white/[0.03] leading-none select-none pointer-events-none" aria-hidden>
                01
              </div>

              <span className={`${label} text-[#E63946]`}>Athlète</span>

              <h3 className="nx-display text-5xl font-black text-white uppercase leading-[1] mt-4 mb-2">
                Fais-toi
                <br />
                remarquer
              </h3>

              <div className="w-12 h-0.5 bg-[#E63946] my-6" />

              <ul className="space-y-3 mb-10">
                {[
                  "Profil vérifié visible par tous les recruteurs CÉGEP",
                  "Vidéos, stats et parcours académique en un seul endroit",
                  "Gratuit",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span className="w-6 h-px bg-[#E63946] flex-shrink-0" />
                    <span className="font-sans text-sm text-[#9CA3AF]">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/inscription?role=ATHLETE"
                className="inline-flex items-center h-11 px-8 bg-[#E63946] text-white font-head font-black text-xs uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded"
              >
                Créer mon profil →
              </Link>
            </div>

            {/* ── Card 2 — Recruteur CÉGEP ── */}
            <div className="relative overflow-hidden bg-[#1A1D24] border border-[#1E2D4A] rounded-lg p-10 lg:p-12 group">
              <div className="absolute -right-8 -bottom-4 nx-display text-[200px] font-black text-white/[0.03] leading-none select-none pointer-events-none" aria-hidden>
                02
              </div>

              <span className={`${label} text-[#9CA3AF]`}>Recruteur CÉGEP</span>

              <h3 className="nx-display text-5xl font-black text-white uppercase leading-[1] mt-4 mb-2">
                Trouve ton
                <br />
                prochain joueur
              </h3>

              <div className="w-12 h-0.5 bg-[#E63946] my-6" />

              <ul className="space-y-3 mb-10">
                {[
                  "16 sports couverts — du RSEQ",
                  "Filtres avancés : sport, région, position, GPA",
                  "Contact direct avec les entraîneurs",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span className="w-6 h-px bg-[#2E3D55] flex-shrink-0" />
                    <span className="font-sans text-sm text-[#9CA3AF]">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/inscription?role=RECRUTEUR"
                className="nx-ghost-btn inline-flex items-center h-11 px-8 border font-head font-black text-xs uppercase tracking-widest rounded"
              >
                Explorer les athlètes →
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4 — FOOTER (unchanged)
      ══════════════════════════════════════════ */}
      <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">

            <div className="flex items-center gap-3">
              <NexusLogo variant="white" height={22} href="/" className="opacity-80" />
              <span className={`${label} text-[#475569]`}>
                Construit pour les étudiants-athlètes québécois
              </span>
            </div>

            <nav className="flex items-center gap-8">
              <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9CA3AF] transition-colors`}>Confidentialité</Link>
              <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9CA3AF] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9CA3AF] transition-colors`}>Contact</Link>
            </nav>

            <div className="flex items-center gap-5">
              {SOCIALS.map(({ name, href, d }) => (
                <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer"
                  className="nx-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={d} />
                  </svg>
                </a>
              ))}
            </div>

          </div>

          <p className={`${label} text-[#2E3D55] text-center pt-5 flex items-center justify-center gap-2`}>
            <span>© 2026 Nexus — Propulsé par</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-white-red.png" alt="WeLead" className="h-4 w-auto" />
          </p>

        </div>
      </footer>

    </div>
  );
}
