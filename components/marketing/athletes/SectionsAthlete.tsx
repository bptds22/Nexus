"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/config/appStores";

/* ─────────────────────────────────────────────────────────────────
   Page athlète v2 (BP 2026-10-20) — même langage que l'accueil v2 et
   la page recruteur : héros (carte de joueur de l'accueil), une section par
   fonction avec une capture bureau (données fictives, public/images/athlete/), étapes,
   gratuité, appel final. Tutoiement. Aucun chiffre, aucun témoignage.
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/** Image de la carte de joueur du héros — LE seul endroit où son chemin est écrit.
 *  Aujourd'hui : la carte du héros de l'accueil (app/page.tsx, `.nx-v30-wrap`) capturée telle
 *  quelle sur fond transparent (maquettes/pages-v2b/outils/carte.js). Pour la remplacer par une
 *  autre image, changer ce chemin et les dimensions ci-dessous. */
const CARTE_JOUEUR = { src: "/images/athlete/carte-joueur-accueil.webp", width: 760, height: 1052 } as const;

/** Captures bureau (données fictives), dans l'ordre de `fonctions.items`. */
const CAPTURES = [
  { src: "/images/athlete/profil-rapport.webp", width: 1200, height: 1462 },
  { src: "/images/athlete/equipe-postes.webp", width: 1240, height: 820 },
  { src: "/images/athlete/ambassadeur-web.webp", width: 1200, height: 820 },
] as const;

function Etiquette({ children, centre = false }: { children: React.ReactNode; centre?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-3 ${centre ? "justify-center" : ""}`}>
      <span className="w-10 h-px bg-[#E63946]" />
      <span className={`${label} text-[#E63946]`}>{children}</span>
    </div>
  );
}

export default function SectionsAthlete() {
  const { t } = useTranslation();
  const T = t.athleteLanding;

  return (
    <div className="relative z-10">
      {/* ── Héros ─────────────────────────────────────── */}
      <section aria-labelledby="athlete-heros" className="overflow-hidden border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-7">
              <Etiquette>{T.hero.eyebrow}</Etiquette>
              <h1 id="athlete-heros" className="nx-display uppercase leading-[0.9] tracking-tight mt-5 text-6xl sm:text-7xl lg:text-[88px]">
                <span className="block text-white">{T.hero.title1}</span>
                <span className="block text-[#E63946]">{T.hero.title2}</span>
              </h1>
              <p className="text-[17px] sm:text-[19px] text-white/75 leading-relaxed mt-6 max-w-[560px]">{T.hero.lede}</p>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <Link
                  href="/inscription?role=ATHLETE"
                  className="inline-flex items-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded"
                >
                  {T.hero.cta} <span aria-hidden>→</span>
                </Link>
                <Link href="/comment-ca-marche" className="text-sm font-semibold text-white/80 hover:text-white underline-offset-4 hover:underline">
                  {T.hero.ctaSecondary}
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[380px]">
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center, rgba(230,57,70,0.35) 0%, rgba(230,57,70,0.1) 45%, transparent 75%)", filter: "blur(60px)", transform: "scale(1.2)" }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- export statique : pas d'optimiseur d'images */}
                <img
                  src={CARTE_JOUEUR.src}
                  alt={T.hero.imageAlt}
                  width={CARTE_JOUEUR.width}
                  height={CARTE_JOUEUR.height}
                  decoding="async"
                  className="relative w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Une section par fonction ──────────────────── */}
      <section aria-labelledby="athlete-fonctions" className="border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 pt-24 lg:pt-32">
          <Etiquette>{T.fonctions.eyebrow}</Etiquette>
          <h2 id="athlete-fonctions" className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[80px]">
            <span className="block text-white">{T.fonctions.title1}</span>
            <span className="block text-[#E63946]">{T.fonctions.title2}</span>
          </h2>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 pb-12">
          {T.fonctions.items.map((f, i) => {
            const inverse = i % 2 === 1;
            return (
              <div key={f.title} className="grid gap-8 lg:gap-14 items-center py-16 lg:py-20 border-b border-white/[0.06] last:border-b-0 lg:grid-cols-12">
                <div className={`lg:col-span-6 ${inverse ? "lg:order-2" : ""}`}>
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
                <div className={`lg:col-span-6 ${inverse ? "lg:order-1" : ""} rounded-xl border border-white/[0.07] bg-[#111317] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.45)]`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- export statique : pas d'optimiseur d'images */}
                  <img
                    src={CAPTURES[i].src}
                    alt={f.alt}
                    width={CAPTURES[i].width}
                    height={CAPTURES[i].height}
                    loading="lazy"
                    decoding="async"
                    className="block w-full h-auto"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3 étapes ──────────────────────────────────── */}
      <section aria-labelledby="athlete-etapes" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{T.etapes.eyebrow}</Etiquette>
          <h2 id="athlete-etapes" className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[80px] text-white">{T.etapes.title}</h2>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {T.etapes.items.map((e, i) => (
              <div key={e.title}>
                <div className="nx-display text-[72px] leading-[0.9] text-[#E63946]">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="nx-display uppercase text-[28px] leading-none mt-2.5 text-white">{e.title}</h3>
                <p className="mt-2.5 text-[#9CA3AF] leading-relaxed">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gratuit + parents ─────────────────────────── */}
      <section aria-labelledby="athlete-gratuit" className="pb-24 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-[#1A1D24] px-7 py-10 lg:p-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 260px at 85% 50%, rgba(230,57,70,0.16), transparent 60%)" }} />
            <div className="relative max-w-[640px]">
              <Etiquette>{T.gratuit.eyebrow}</Etiquette>
              <h2 id="athlete-gratuit" className="nx-display uppercase leading-[0.92] tracking-tight mt-4 text-4xl sm:text-5xl lg:text-6xl">
                <span className="block text-white">{T.gratuit.title1}</span>
                <span className="block text-[#E63946]">{T.gratuit.title2}</span>
              </h2>
              <p className="mt-5 text-[16px] text-[#9CA3AF] leading-relaxed">{T.gratuit.body}</p>
            </div>
            <div className="relative">
              <p className="text-[15px] text-white/80">{T.gratuit.parentsLead}</p>
              <Link href="/pour-les-parents" className="mt-2 inline-flex items-center gap-2 font-head font-black text-[13px] uppercase tracking-widest text-[#E63946] hover:text-white transition-colors">
                {T.gratuit.parentsLink} <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Appel final ───────────────────────────────── */}
      <section aria-labelledby="athlete-final" className="pb-28 lg:pb-36 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette centre>{T.final.eyebrow}</Etiquette>
          <h2 id="athlete-final" className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[88px]">
            <span className="block text-white">{T.final.title1}</span>
            <span className="block text-[#E63946]">{T.final.title2}</span>
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={APP_STORE_URL} className="inline-flex items-center gap-2.5 h-14 px-5 rounded-[10px] bg-black border border-white/30 text-left">
              <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden><path fill="#fff" d="M18.3 13.8c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.6 1.1-4.6 1.1-.9 0-2.4-1.1-4-1-2 0-3.9 1.2-5 3-2.1 3.7-.5 9.2 1.5 12.2 1 1.5 2.2 3.1 3.8 3 1.5-.1 2.1-1 3.9-1s2.3 1 3.9 1c1.6 0 2.7-1.5 3.7-3 1.2-1.7 1.6-3.3 1.7-3.4-.1 0-3.1-1.2-3.1-4.9zM15.3 4.8c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.6.8-3.5 1.8-.8.9-1.4 2.3-1.3 3.7 1.4.1 2.7-.7 3.6-1.7z"/></svg>
              <span><small className="block text-[11px] text-[#D1D5DB] leading-none">{T.final.appStoreSmall}</small><strong className="block text-lg leading-tight text-white">App Store</strong></span>
            </a>
            {PLAY_STORE_URL && (
              <a href={PLAY_STORE_URL} className="inline-flex items-center gap-2.5 h-14 px-5 rounded-[10px] bg-black border border-white/30 text-left">
                <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden><path fill="#34A853" d="M1 1l11 11L1 23c-.4-.2-.7-.7-.7-1.3V2.3C.3 1.7.6 1.2 1 1z"/><path fill="#FBBC04" d="M16 8l-4 4 4 4 4.4-2.5c1.2-.7 1.2-2.3 0-3L16 8z"/><path fill="#EA4335" d="M1 23l11-11 4 4L2.9 23.5c-.6.4-1.3.3-1.9-.5z"/><path fill="#4285F4" d="M1 1c.6-.8 1.3-.9 1.9-.5L16 8l-4 4L1 1z"/></svg>
                <span><small className="block text-[11px] text-[#D1D5DB] leading-none">{T.final.playSmall}</small><strong className="block text-lg leading-tight text-white">Google Play</strong></span>
              </a>
            )}
          </div>
          <p className="mt-5">
            <Link href="/inscription?role=ATHLETE" className="text-sm font-semibold text-white/80 hover:text-white underline underline-offset-4">{T.final.web}</Link>
          </p>
          <p className="mt-6 text-[#9CA3AF]">{T.final.codeLead} <b className="text-white font-semibold">{T.final.code}</b></p>
        </div>
      </section>
    </div>
  );
}
