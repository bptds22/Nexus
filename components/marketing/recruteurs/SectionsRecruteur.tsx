"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";

/* ─────────────────────────────────────────────────────────────────
   Page recruteur v2 (BP 2026-10-20) — le héros et une section par
   fonction, avec une vraie capture (données fictives, public/images/
   recruteur/). Remplace les sections 1 à 7 de l'ancienne page ;
   tarification, FAQ et appel final restent ceux de la page.
   Vouvoiement, comme le reste de la page recruteur.
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/** Les captures, dans l'ordre du dictionnaire. `mobile` : capture d'appli, cadrée comme un téléphone. */
const CAPTURES = [
  { src: "recherche", w: 1400, h: 875 },
  { src: "processus", w: 1400, h: 875 },
  { src: "en-direct", w: 600, h: 1298, mobile: true },
  { src: "calendrier", w: 1400, h: 875 },
  { src: "prospects", w: 1400, h: 875 },
  { src: "listes", w: 1400, h: 875 },
  { src: "non-contact", w: 1200, h: 835 },
] as const;

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="w-10 h-px bg-[#E63946]" />
      <span className={`${label} text-[#E63946]`}>{children}</span>
    </div>
  );
}

export default function SectionsRecruteur() {
  const { t } = useTranslation();
  const V = t.recruiterLanding.v2;
  const H = t.recruiterLanding.hero;

  return (
    <>
      {/* ── Héros ─────────────────────────────────────── */}
      <section id="hero" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-2">
              <Etiquette>{V.hero.eyebrow}</Etiquette>
              <h1 className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[68px]">
                <span className="block text-white">{V.hero.title1}</span>
                <span className="block text-[#E63946]">{V.hero.title2}</span>
              </h1>
              <p className="text-[17px] sm:text-[18px] text-white/75 leading-relaxed mt-6">{V.hero.lede}</p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded"
                >
                  {V.hero.cta} <span aria-hidden>→</span>
                </Link>
                <a href="#fonctions" className="text-sm font-semibold text-white/80 hover:text-white underline-offset-4 hover:underline">
                  {V.hero.ctaSecondary}
                </a>
              </div>
            </div>

            {/* La démo vidéo de la page d'avant, gardée. */}
            <div id="demo-video" className="lg:col-span-3">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center, rgba(230,57,70,0.45) 0%, rgba(230,57,70,0.15) 45%, transparent 80%)", filter: "blur(90px)", transform: "scale(1.3)" }}
                />
                <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-white/[0.08]" aria-label={H.videoAriaLabel}>
                  <iframe
                    src="https://www.youtube.com/embed/zioDKPq5fmc?rel=0&modestbranding=1&playsinline=1"
                    title="Nexus — Démo recruteurs"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    className="w-full h-full"
                  />
                </div>
              </div>
              <p className="mt-4 text-[14px] text-white/55 text-center">{H.videoCaption}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Une section par fonction ──────────────────── */}
      <section id="fonctions" aria-labelledby="recruteur-fonctions" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 pt-24 lg:pt-32">
          <Etiquette>{V.fonctions.eyebrow}</Etiquette>
          <h2 id="recruteur-fonctions" className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[80px]">
            <span className="block text-white">{V.fonctions.title1}</span>
            <span className="block text-[#E63946]">{V.fonctions.title2}</span>
          </h2>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 pb-12">
          {V.fonctions.items.map((f, i) => {
            const c = CAPTURES[i];
            const inverse = i % 2 === 1;
            const mobile = "mobile" in c && c.mobile;
            return (
              <div key={f.title} className="grid gap-8 lg:gap-14 items-center py-16 lg:py-20 border-b border-white/[0.06] last:border-b-0 lg:grid-cols-12">
                <div className={`lg:col-span-5 ${inverse ? "lg:order-2" : ""}`}>
                  <div className={`${label} text-[#E63946]`}>{String(i + 1).padStart(2, "0")} · {f.kicker}</div>
                  <h3 className="nx-display uppercase leading-[0.95] mt-3 text-4xl lg:text-[52px] text-white">{f.title}</h3>
                  <ul className="mt-6 space-y-3">
                    {f.points.map((pt) => (
                      <li key={pt} className="flex gap-3 text-[16px] text-[#9CA3AF] leading-relaxed">
                        <span aria-hidden className="text-[#E63946]">→</span><span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`lg:col-span-7 ${inverse ? "lg:order-1" : ""} ${mobile ? "flex justify-center rounded-xl border border-white/[0.07] bg-[#1A1D24] pt-8 overflow-hidden max-h-[520px]" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- export statique : pas d'optimiseur d'images */}
                  <img
                    src={`/images/recruteur/${c.src}.webp`}
                    alt={f.alt}
                    width={c.w}
                    height={c.h}
                    loading="lazy"
                    decoding="async"
                    className={mobile
                      ? "w-[280px] h-auto self-start rounded-t-[22px] border border-b-0 border-white/[0.1]"
                      : "w-full h-auto rounded-xl border border-white/[0.08] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
