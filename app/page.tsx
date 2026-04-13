import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import PlaybookBackground from "./components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Landing Page
   Inspired by: College Football 25 UI · ESPN · Nike College
   Dark navy · chalk playbook · condensed bold · OVR card aesthetic
───────────────────────────────────────────────────────────────────*/

const STEPS = [
  {
    n: "01",
    role: "ENTRAÎNEUR",
    title: "Inscris tes athlètes",
    body: "Crée les profils de tes joueurs avec statistiques, vidéos et parcours académique vérifiés — tout en un seul endroit.",
  },
  {
    n: "02",
    role: "ATHLÈTE",
    title: "Mets leur profil en valeur",
    body: "Faits saillants, références et bio personnelle. Les stats se mettent à jour automatiquement chaque saison.",
  },
  {
    n: "03",
    role: "RECRUTEUR",
    title: "Découvre les prospects",
    body: "Filtre, sauvegarde et contacte directement les coaches pour discuter des athlètes qui correspondent à ton programme CÉGEP.",
  },
];

const COACH_FEATURES   = ["Profils complets pour chaque joueur", "Stats, vidéos et parcours académique", "Visibilité maximale auprès des CÉGEP"];
const RECRUIT_FEATURES = ["200+ profils d'athlètes vérifiés", "Filtres avancés : sport, région, GPA", "Contact direct sans intermédiaire"];

const CEGEPS = [
  { name: "Sainte-Foy",         city: "Québec",        sport: "Football · Basketball" },
  { name: "Garneau",            city: "Québec",        sport: "Football · Soccer"     },
  { name: "Montmorency",        city: "Laval",         sport: "Football · Basketball" },
  { name: "Édouard-Montpetit",  city: "Longueuil",     sport: "Football · Hockey"     },
  { name: "Lionel-Groulx",      city: "Ste-Thérèse",   sport: "Football · Basketball" },
  { name: "Sherbrooke",         city: "Sherbrooke",    sport: "Football · Hockey"     },
  { name: "Trois-Rivières",     city: "Trois-Rivières", sport: "Football · Soccer"    },
  { name: "André-Laurendeau",   city: "LaSalle",       sport: "Football · Basketball" },
];

/* shared micro-label style */
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
    name: "Twitter / X",
    href: "#",
    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    name: "LinkedIn",
    href: "#",
    d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
];

export default function Home() {
  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />

      <MarketingNav />

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-transparent">
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-16 xl:gap-24 items-start">

          {/* ── Left: copy ── */}
          <div>
            {/* Eyebrow — game tag style */}
            <div className="inline-flex items-center gap-3 mb-8">
              <span className="w-6 h-px bg-wl-red"/>
              <span className={`${label} text-wl-red`}>Plateforme officielle · Québec 2026</span>
              <span className="w-6 h-px bg-wl-red"/>
            </div>

            {/* Headline — condensed, all-caps game style */}
            <h1 className="font-head text-6xl xl:text-7xl font-black text-white uppercase leading-[0.92] tracking-tight mb-6">
              La Plateforme{" "}
              <span className="text-wl-red">#1</span>
              <br />
              de Recrutement
              <br />
              d&apos;Athlètes au
              <br />
              Québec
            </h1>

            <p className="font-sans text-base text-[#9AA3B2] leading-relaxed max-w-[420px] mb-10">
              Nexus connecte les entraîneurs du secondaire avec les recruteurs des CÉGEP. Profils vérifiés, stats en temps réel, communication directe.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-14">
              <button className="nx-ghost-btn h-12 px-8 border font-head font-black text-sm uppercase tracking-widest">
                Je suis un Coach →
              </button>
              <button className="nx-ghost-btn h-12 px-8 border font-head font-black text-sm uppercase tracking-widest">
                Je suis un Recruteur
              </button>
            </div>

            {/* Stats — OVR-style with pipe separators */}
            <div className="flex divide-x divide-[#1E2D4A]">
              {[
                { num: "200", label: "Athlètes" },
                { num: "50",  label: "Écoles secondaires" },
                { num: "30",  label: "Recruteurs CÉGEP" },
              ].map((s) => (
                <div key={s.label} className="px-7 first:pl-0 last:pr-0">
                  <div className="nx-stat-num font-head text-4xl font-black text-white leading-none">
                    {s.num}<span className="text-wl-red">+</span>
                  </div>
                  <div className={`${label} text-[#9AA3B2] mt-1.5`}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Athlete Card v30 ── */}
          <div className="flex justify-center lg:justify-end lg:pt-[52px]">
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

              {/* Main card */}
              <div className="nx-v30-card relative overflow-visible" style={{ width: 340, borderRadius: 10 }}>

                {/* Photo area */}
                <div className="relative overflow-hidden" style={{ width: 340, height: 500, borderRadius: 10, background: '#2F3440' }}>
                  <div
                    className="absolute inset-0 z-[1]"
                    style={{
                      backgroundImage: "url('/player_card%20image%20Bruno%207.png')",
                      backgroundSize: 'cover',
                      backgroundPosition: 'center top -40px',
                    }}
                  />
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
                  style={{ bottom: -16, right: -26, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex" style={{ width: 364 }}>

                    {/* Left — dark navy */}
                    <div
                      className="flex flex-col justify-between"
                      style={{ background: '#1E2128', padding: '14px 16px 14px 18px', minWidth: 109, gap: 5 }}
                    >
                      {[
                        { lbl: "Sport", val: "Football" },
                        { lbl: "Pos", val: "QB" },
                        { lbl: "No.", val: "#12" },
                      ].map((r) => (
                        <div key={r.lbl}>
                          <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 2 }}>
                            {r.lbl}
                          </div>
                          <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 18, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>
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

                    {/* Right — white with dark star pill */}
                    <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '14px 18px' }}>
                      <svg width="150" height="22" viewBox="0 0 150 22" fill="none" style={{ display: 'block', marginBottom: 8 }}>
                        {[0, 30, 60, 90, 120].map((x) => (
                          <path key={x} d="M11,0L13.5,8L22,8L15.5,13L18,21L11,16.2L4,21L6.5,13L0,8L8.5,8Z" fill="#F59E0B" transform={`translate(${x},0)`}/>
                        ))}
                      </svg>
                      <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1E2128', marginBottom: 2 }}>
                        École secondaire Saint-Jean-Eudes
                      </div>
                      <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>
                        Québec, QC
                      </div>
                      <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E63946', marginTop: 2 }}>
                        Promotion 2026
                      </div>
                    </div>

                    {/* Stub */}
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        background: '#E63946',
                        width: 26,
                        writingMode: 'vertical-rl',
                        fontFamily: 'var(--font-bebas), sans-serif',
                        fontSize: 11,
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
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          CEGEP PARTNERS — trust strip
      ══════════════════════════════════════════ */}
      <section className="bg-[#060A14]/80">
        <div className="max-w-6xl mx-auto px-6 py-10">

          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="w-6 h-px bg-wl-red"/>
            <span className={`${label} text-wl-red`}>Programmes CÉGEP partenaires</span>
            <span className="w-6 h-px bg-wl-red"/>
          </div>

          <div className="nx-cegep-grid grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-[#1E2D4A] divide-x divide-[#1E2D4A]">
            {CEGEPS.map((c) => (
              <div key={c.name} className="group px-4 py-5 flex flex-col items-center text-center hover:bg-white/[0.04] transition-colors cursor-default">
                {/* Red top accent on hover */}
                <div className="w-full h-px bg-wl-red scale-x-0 group-hover:scale-x-100 transition-transform origin-left mb-3"/>
                <div className="font-head text-xs font-black text-white/55 group-hover:text-white uppercase tracking-wider transition-colors leading-tight mb-1">
                  {c.name}
                </div>
                <div className={`${label} text-[#3D5578] group-hover:text-[#9AA3B2] transition-colors`} style={{ fontSize: "8px" }}>
                  {c.city}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Diagonal separator */}
      <div className="nx-sep relative h-14 bg-[#060A14]/60 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#0A1020]/60" style={{ clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }}/>
      </div>

      {/* ══════════════════════════════════════════
          HOW IT WORKS — game mode list style
      ══════════════════════════════════════════ */}
      <section id="how" className="bg-[#0A1020]/75 pb-24 pt-16">
        <div className="max-w-6xl mx-auto px-6">

          <div className="mb-14">
            <div className={`${label} text-wl-red mb-3`}>Comment ça marche</div>
            <h2 className="font-head text-5xl font-black text-white uppercase leading-[1] tracking-tight">
              Du Secondaire au CÉGEP<br/>
              <span className="text-wl-red">en 3 étapes</span>
            </h2>
          </div>

          {/* Steps — bordered columns like CF25 game mode list */}
          <div className="nx-steps-grid grid grid-cols-1 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="nx-step-card group px-8 py-10 first:pl-0 last:pr-0 hover:bg-white/[0.06] transition-colors relative">

                {/* Hover accent line */}
                <div className="absolute top-0 left-8 right-8 md:left-0 md:right-auto md:top-0 md:bottom-0 md:w-px md:h-full h-px bg-wl-red scale-0 group-hover:scale-100 transition-transform origin-top-left" aria-hidden/>

                {/* Giant watermark step number */}
                <div className="nx-step-num font-head text-8xl font-black text-white/30 leading-none mb-3 select-none" aria-hidden>
                  {step.n}
                </div>

                <div className={`${label} text-wl-red mb-3`}>{step.role}</div>
                <h3 className="font-head text-2xl font-black text-white uppercase leading-tight mb-3">
                  {step.title}
                </h3>
                <p className="font-sans text-sm text-[#D8E1EA] leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Diagonal separator reverse */}
      <div className="nx-sep relative h-14 bg-[#0A1020]/60 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[#060A14]/60" style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}/>
      </div>

      {/* ══════════════════════════════════════════
          CHOOSE YOUR JOURNEY — CF25 selection style
      ══════════════════════════════════════════ */}
      <section id="roles" className="bg-[#060A14]/75 pb-24 pt-8">
        <div className="max-w-6xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-16">
            <div className={`${label} text-wl-red mb-4`}>Rejoins Nexus</div>
            <h2 className="font-head text-6xl font-black text-white uppercase tracking-tight leading-[1]">
              Choisis ton Parcours
            </h2>
          </div>

          {/* Cards — touching, no gap, like CF25 journey selection */}
          <div className="grid grid-cols-1 md:grid-cols-2">

            {/* COACH */}
            <div className="relative overflow-hidden bg-[#0A1428] border border-[#1E2D4A] p-12 group hover:bg-[#0D1A38] transition-colors cursor-pointer">

              {/* Giant watermark number */}
              <div className="absolute -right-8 -bottom-4 font-head text-[220px] font-black text-white/[0.03] leading-none select-none pointer-events-none" aria-hidden>
                01
              </div>

              {/* Red top accent bar — appears on hover */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-wl-red scale-x-0 group-hover:scale-x-100 transition-transform origin-left"/>

              <span className={`${label} text-wl-red`}>Coach / Entraîneur</span>

              <h3 className="font-head text-5xl font-black text-white uppercase leading-[1] mt-4 mb-2">
                Valorise
                <br />
                tes Athlètes
              </h3>

              {/* Thin rule */}
              <div className="w-12 h-0.5 bg-wl-red my-6"/>

              <ul className="space-y-3 mb-10">
                {COACH_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span className="w-6 h-px bg-wl-red flex-shrink-0"/>
                    <span className="font-sans text-sm text-[#9AA3B2]">{f}</span>
                  </li>
                ))}
              </ul>

              <a href="/auth/pro" className="inline-flex items-center h-11 px-8 bg-wl-red text-white font-head font-black text-xs uppercase tracking-widest hover:bg-wl-red-hover transition-colors">
                Créer mon Compte →
              </a>
            </div>

            {/* RECRUITER */}
            <div className="relative overflow-hidden bg-[#070D1C] border border-[#1E2D4A] md:border-l-0 p-12 group hover:bg-[#0A1228] transition-colors cursor-pointer">

              <div className="absolute -right-8 -bottom-4 font-head text-[220px] font-black text-white/[0.03] leading-none select-none pointer-events-none" aria-hidden>
                02
              </div>

              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2E3D55] scale-x-0 group-hover:scale-x-100 transition-transform origin-left"/>

              <span className={`${label} text-[#9AA3B2]`}>Recruteur CÉGEP</span>

              <h3 className="font-head text-5xl font-black text-white uppercase leading-[1] mt-4 mb-2">
                Découvre
                <br />
                les Meilleurs
              </h3>

              <div className="w-12 h-0.5 bg-[#2E3D55] my-6"/>

              <ul className="space-y-3 mb-10">
                {RECRUIT_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span className="w-6 h-px bg-[#2E3D55] flex-shrink-0"/>
                    <span className="font-sans text-sm text-[#9AA3B2]">{f}</span>
                  </li>
                ))}
              </ul>

              <a href="/auth?mode=signup" className="nx-ghost-btn h-11 px-8 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
                Explorer les Athlètes →
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA STRIP
      ══════════════════════════════════════════ */}
      <section className="bg-[#060A14]/75">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className={`${label} text-wl-red mb-3`}>Prêt à jouer?</div>
            <h2 className="font-head text-4xl font-black text-white uppercase leading-tight">
              Commence à recruter aujourd&apos;hui
            </h2>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a href="/auth?mode=signup" className="inline-flex items-center h-12 px-8 bg-wl-red text-white font-head font-black text-xs uppercase tracking-widest hover:bg-wl-red-hover transition-colors hover:shadow-[0_8px_28px_rgba(232,72,72,0.38)] hover:-translate-y-0.5">
              Explorer les Athlètes →
            </a>
            <a href="/auth/pro" className="nx-ghost-btn h-12 px-8 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
              Je suis Coach
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
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
              <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Confidentialité</Link>
              <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Contact</Link>
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

          <p className={`${label} text-[#2E3D55] text-center pt-5`}>© 2026 Nexus — Propulsé par <img src="/brand/White%20red@4x.png" alt="WeLead" style={{height:16}} /></p>

        </div>
      </footer>

    </div>
  );
}
