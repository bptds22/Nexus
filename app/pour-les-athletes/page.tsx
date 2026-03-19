"use client";

import { useState, useEffect, useRef } from "react";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import BrowserMockup from "@/components/ui/BrowserMockup";

/* ── Helpers ─────────────────────────────────────────────────── */

/** Animated count-up on scroll into view */
function useCountUp(target: number, suffix = "", duration = 1500) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState("0");
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3); // easeOut
            const current = Math.round(target * ease);
            setValue(current + suffix);
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, suffix, duration]);

  return { ref, value };
}

/** Split section for screenshot + text */
function ShowcaseSplit({
  eyebrow,
  title,
  body,
  imageSrc,
  imageAlt,
  fakeUrl,
  reversed = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  fakeUrl: string;
  reversed?: boolean;
}) {
  const textBlock = (
    <div className="flex flex-col justify-center">
      <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
        {eyebrow}
      </p>
      <h2 className="font-head text-2xl md:text-3xl font-black text-white leading-tight mb-4">
        {title}
      </h2>
      <p className="text-base text-[#9CA3AF] leading-relaxed max-w-[420px]">
        {body}
      </p>
    </div>
  );

  const imageBlock = (
    <BrowserMockup imageSrc={imageSrc} fakeUrl={fakeUrl} alt={imageAlt} />
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
      {reversed ? (
        <>
          <div className="lg:col-span-3 order-2 lg:order-1">{imageBlock}</div>
          <div className="lg:col-span-2 order-1 lg:order-2">{textBlock}</div>
        </>
      ) : (
        <>
          <div className="lg:col-span-3 order-2 lg:order-2">{imageBlock}</div>
          <div className="lg:col-span-2 order-1 lg:order-1">{textBlock}</div>
        </>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function PourLesAthletes() {
  const [toast, setToast] = useState(false);

  const stat1 = useCountUp(11, "x");
  const stat2 = useCountUp(3, "x");
  const stat3 = useCountUp(80, "%");

  function copyCoachLink() {
    navigator.clipboard.writeText("https://nexus-brown-zeta.vercel.app/pour-les-coachs");
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }

  return (
    <div className="hero-playbook bg-[#060A14] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      {/* ══════════ SECTION 1 — HERO ══════════ */}
      <section className="bg-transparent relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-9 gap-12 items-center">
            {/* Text — left */}
            <div className="lg:col-span-4">
              <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
                POUR LES ÉTUDIANTS-ATHLÈTES
              </p>
              <h1 className="font-head text-3xl sm:text-5xl font-black text-white uppercase leading-[1.05] tracking-tight mb-6">
                Les recruteurs
                <br />
                te cherchent.
                <br />
                <span className="text-[#E63946]">Es-tu visible?</span>
              </h1>
              <p className="text-lg text-[#9CA3AF] leading-relaxed mb-6 max-w-[480px]">
                Nexus donne à ton coach les outils pour créer un profil qui
                montre qui tu es vraiment. Pas juste un numéro — un athlète
                complet.
              </p>
              <p className="text-sm text-[#6B7280]">
                Ton coach crée ton profil. Toi, tu te fais repérer.
              </p>
            </div>

            {/* Player card — right (same as landing page) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="nx-v30-wrap relative" style={{ width: 340, paddingTop: 6, paddingBottom: 10 }}>

                {/* Red glow behind card */}
                <div className="absolute -inset-8 bg-[#E63946]/[0.25] blur-[70px] rounded-3xl pointer-events-none" />

                {/* Verified badge — 3D lapel pin */}
                <div className="nx-v30-badge absolute z-30" style={{ top: 12, right: -14 }}>
                  <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
                    <defs>
                      <radialGradient id="ath_bg_grad" cx="38%" cy="28%" r="68%">
                        <stop offset="0%" stopColor="#29AAFF"/>
                        <stop offset="55%" stopColor="#0094F0"/>
                        <stop offset="100%" stopColor="#0060C0"/>
                      </radialGradient>
                      <radialGradient id="ath_shine" cx="38%" cy="25%" r="55%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.32)"/>
                        <stop offset="60%" stopColor="rgba(255,255,255,0)"/>
                      </radialGradient>
                    </defs>
                    <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35"/>
                    <circle cx="27" cy="27" r="24" fill="url(#ath_bg_grad)"/>
                    <circle cx="27" cy="27" r="24" fill="url(#ath_shine)"/>
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
        </div>
      </section>

      {/* ══════════ SECTION 2 — STATS IMPACT BANNER ══════════ */}
      <section className="py-20 bg-[#1A1D24] relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6 text-center">
            <div>
              <span
                ref={stat1.ref}
                className="block font-head text-[72px] sm:text-[80px] font-black text-white leading-none"
              >
                {stat1.value}
              </span>
              <p className="text-base text-[#9CA3AF] mt-2">plus de vues</p>
            </div>
            <div>
              <span
                ref={stat2.ref}
                className="block font-head text-[72px] sm:text-[80px] font-black text-white leading-none"
              >
                {stat2.value}
              </span>
              <p className="text-base text-[#9CA3AF] mt-2">
                plus d&apos;engagements
              </p>
            </div>
            <div>
              <span
                ref={stat3.ref}
                className="block font-head text-[72px] sm:text-[80px] font-black text-[#E63946] leading-none"
              >
                {stat3.value}
              </span>
              <p className="text-base text-[#9CA3AF] mt-2">
                des athlètes vérifiés sont contactés
              </p>
            </div>
          </div>
          <p className="text-sm text-[#6B7280] text-center mt-10">
            Profils vérifiés vs profils incomplets sur Nexus
          </p>
        </div>
      </section>

      {/* ══════════ SECTION 3 — CE QUE LES RECRUTEURS VOIENT ══════════ */}
      <section className="py-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-6 space-y-24">
          {/* 3A — Coach Report */}
          <ShowcaseSplit
            eyebrow="RAPPORT DE L'ENTRAÎNEUR"
            title="La parole de ton coach vaut plus que ton CV"
            body="Leadership, discipline, coachabilité, intelligence de jeu — ton coach te note sur 8 critères. Les recruteurs font confiance aux coachs qui connaissent leurs joueurs. C'est ton meilleur argument."
            imageSrc="/preview-athlete-coach-report.png"
            imageAlt="Rapport de l'entraîneur avec évaluations par critère"
            fakeUrl="nexus.app/athlete/marc-antoine-tremblay#rapport"
            reversed
          />

          {/* 3B — Academic Profile */}
          <ShowcaseSplit
            eyebrow="PROFIL ACADÉMIQUE"
            title="Tu es un étudiant-athlète. Pas juste un athlète."
            body="Ta moyenne générale, ton programme recherché, si t'es ouvert à déménager — les recruteurs veulent savoir tout ça avant de te contacter. Ton dossier académique, c'est ce qui te distingue des autres prospects."
            imageSrc="/preview-athlete-academic.png"
            imageAlt="Profil académique avec moyenne, programme et préférences"
            fakeUrl="nexus.app/athlete/marc-antoine-tremblay#academique"
          />

          {/* 3C — Media & Links */}
          <ShowcaseSplit
            eyebrow="TES HIGHLIGHTS"
            title="30 secondes qui peuvent tout changer"
            body="Faits saillants, match complet, Hudl, YouTube, Instagram — tout est lié à ton profil. Un recruteur peut te voir jouer sans te connaître. C'est comme ça que ça commence."
            imageSrc="/preview-athlete-media-links.png"
            imageAlt="Liens médias: faits saillants, Hudl, YouTube, Instagram"
            fakeUrl="nexus.app/athlete/marc-antoine-tremblay#medias"
            reversed
          />
        </div>
      </section>

      {/* ══════════ SECTION 4 — BIENTÔT, TON PROPRE ESPACE ══════════ */}
      <section className="py-20 bg-[#1A1D24] relative z-10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
            À VENIR
          </p>
          <h2 className="font-head text-2xl md:text-3xl font-black text-white leading-tight mb-4">
            Ton tableau de bord personnel
          </h2>
          <p className="text-base text-[#9CA3AF] leading-relaxed max-w-[550px] mx-auto mb-12">
            Bientôt, tu pourras suivre qui regarde ton profil, recevoir des
            notifications quand un recruteur s&apos;intéresse à toi, et voir
            quels CÉGEPs correspondent à ton profil.
          </p>

          {/* Teaser card with blurred placeholder */}
          <div className="relative max-w-[700px] mx-auto">
            {/* Animated pulsing red glow border */}
            <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-br from-[#E63946]/30 via-[#E63946]/10 to-[#E63946]/30 animate-[glow-pulse_3s_ease-in-out_infinite] pointer-events-none" />

            <div className="relative bg-[#111317] rounded-xl overflow-hidden p-8 sm:p-10">
              {/* Blurred fake dashboard content */}
              <div className="space-y-6 blur-[6px] select-none pointer-events-none" aria-hidden>
                {/* KPI row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#1A1D24] rounded-lg p-4 h-20" />
                  <div className="bg-[#1A1D24] rounded-lg p-4 h-20" />
                  <div className="bg-[#E63946]/10 rounded-lg p-4 h-20" />
                </div>
                {/* Chart area */}
                <div className="bg-[#1A1D24] rounded-lg h-32 flex items-end px-6 pb-4 gap-3">
                  {[40, 65, 50, 80, 60, 75, 90].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[#E63946]/20 rounded-t"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                {/* Text lines */}
                <div className="space-y-3">
                  <div className="h-3 bg-[#1A1D24] rounded w-3/4" />
                  <div className="h-3 bg-[#1A1D24] rounded w-1/2" />
                  <div className="h-3 bg-[#1A1D24] rounded w-2/3" />
                </div>
              </div>

              {/* Overlay label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-[0.15em] animate-[label-pulse_2s_ease-in-out_infinite]">
                  Bientôt disponible
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 5 — FINAL CTA ══════════ */}
      <section className="py-24 bg-transparent relative">
        {/* Subtle red radial glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#E63946]/[0.07] blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          <h2 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-4">
            Prêt à te faire repérer?
          </h2>
          <p className="text-lg text-[#9CA3AF] mb-8 max-w-[500px] mx-auto">
            Parle à ton coach. S&apos;il n&apos;est pas encore sur Nexus,
            envoie-lui le lien — c&apos;est gratuit.
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={copyCoachLink}
              className="inline-flex items-center bg-[#E63946] hover:bg-[#FF5C58] text-white font-head font-bold text-[14px] uppercase tracking-[0.12em] rounded-lg px-8 py-4 transition-colors cursor-pointer"
            >
              Envoie ce lien à ton coach
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl animate-[fade-in_0.2s_ease-out]">
            Lien copié!
          </div>
        )}
      </section>

      {/* ══════════ CSS Keyframes ══════════ */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes label-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
