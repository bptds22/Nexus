"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";

/* ─────────────────────────────────────────────────────────────────
   Page coach v2 (BP 2026-10-20) — même langage que l'accueil v2 et la
   page recruteur. Tutoiement, comme avant. Aucune statistique inventée,
   aucun nom de recruteur, aucune capture à données réelles : la seule
   image est la capture fictive du profil vu par un recruteur
   (public/images/athlete/profil.webp, partagée avec la page athlète).
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

function Etiquette({ children, centre = false }: { children: React.ReactNode; centre?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-3 ${centre ? "justify-center" : ""}`}>
      <span className="w-10 h-px bg-[#E63946]" />
      <span className={`${label} text-[#E63946]`}>{children}</span>
    </div>
  );
}

function Titre({ id, l1, l2, as = "h2", taille = "text-5xl sm:text-6xl lg:text-[80px]" }: { id: string; l1: string; l2: string; as?: "h1" | "h2"; taille?: string }) {
  const Tag = as;
  return (
    <Tag id={id} className={`nx-display uppercase leading-[0.92] tracking-tight mt-5 ${taille}`}>
      <span className="block text-white">{l1}</span>
      <span className="block text-[#E63946]">{l2}</span>
    </Tag>
  );
}

const bouton = "inline-flex items-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded";

export default function SectionsCoach() {
  const { t } = useTranslation();
  const T = t.coachLanding;

  return (
    <>
      {/* ── Héros ─────────────────────────────────────── */}
      <section id="hero" aria-labelledby="coach-heros" className="overflow-hidden border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-7">
              <Etiquette>{T.hero.eyebrow}</Etiquette>
              <Titre id="coach-heros" as="h1" l1={T.hero.title1} l2={T.hero.title2} taille="text-6xl sm:text-7xl lg:text-[88px]" />
              <p className="text-[17px] sm:text-[19px] text-white/75 leading-relaxed mt-6 max-w-[580px]">{T.hero.lede}</p>
              <p className="text-[15px] text-[#9CA3AF] mt-3">{T.hero.ledeSmall}</p>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <Link href="/inscription" className={bouton}>
                  {T.hero.cta} <span aria-hidden>→</span>
                </Link>
                <a href="#comment-ca-marche" className="text-sm font-semibold text-white/80 hover:text-white underline-offset-4 hover:underline">
                  {T.hero.ctaSecondary}
                </a>
              </div>
            </div>
            <div className="lg:col-span-5 flex justify-center rounded-xl border border-white/[0.07] bg-[#1A1D24] pt-8 overflow-hidden max-h-[520px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- export statique : pas d'optimiseur d'images */}
              <img
                src="/images/athlete/profil.webp"
                alt={T.hero.imageAlt}
                width={600}
                height={1298}
                decoding="async"
                className="w-[280px] h-auto self-start rounded-t-[22px] border border-b-0 border-white/[0.1]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 étapes ──────────────────────────────────── */}
      <section id="comment-ca-marche" aria-labelledby="coach-etapes" className="py-24 lg:py-32 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{T.etapes.eyebrow}</Etiquette>
          <Titre id="coach-etapes" l1={T.etapes.title1} l2={T.etapes.title2} />
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ── Ton évaluation ────────────────────────────── */}
      <section aria-labelledby="coach-evaluation" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{T.evaluation.eyebrow}</Etiquette>
          <Titre id="coach-evaluation" l1={T.evaluation.title1} l2={T.evaluation.title2} />
          <ul className="mt-10 grid gap-x-12 gap-y-4 lg:grid-cols-2 max-w-[1100px]">
            {T.evaluation.points.map((pt) => (
              <li key={pt} className="flex gap-3 text-[17px] text-[#9CA3AF] leading-relaxed">
                <span aria-hidden className="text-[#E63946]">→</span><span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Tes outils ────────────────────────────────── */}
      <section aria-labelledby="coach-outils" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{T.outils.eyebrow}</Etiquette>
          <Titre id="coach-outils" l1={T.outils.title1} l2={T.outils.title2} />
          <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {T.outils.items.map((o, i) => (
              <div key={o.title} className="rounded-md border border-white/[0.07] border-t-[3px] border-t-[#E63946] bg-[#1A1D24] px-6 py-7">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="nx-display text-[40px] leading-none text-[#E63946]/40">{String(i + 1).padStart(2, "0")}</div>
                  {o.note && <span className={`${label} text-[#9CA3AF]`}>{o.note}</span>}
                </div>
                <h3 className="nx-display uppercase text-[26px] leading-none mt-3 text-white">{o.title}</h3>
                <p className="mt-3 text-[15px] text-[#9CA3AF] leading-relaxed">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Le contact ────────────────────────────────── */}
      <section aria-labelledby="coach-contact" className="pb-24 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-[#1A1D24] px-7 py-10 lg:p-14 grid gap-6 lg:grid-cols-12 lg:items-center">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 260px at 85% 50%, rgba(230,57,70,0.16), transparent 60%)" }} />
            <div className="relative lg:col-span-6">
              <Etiquette>{T.contact.eyebrow}</Etiquette>
              <h2 id="coach-contact" className="nx-display uppercase leading-[0.92] tracking-tight mt-4 text-4xl sm:text-5xl lg:text-6xl">
                <span className="block text-white">{T.contact.title1}</span>
                <span className="block text-[#E63946]">{T.contact.title2}</span>
              </h2>
            </div>
            <p className="relative lg:col-span-6 text-[17px] text-[#D1D5DB] leading-relaxed">{T.contact.body}</p>
          </div>
        </div>
      </section>

      {/* ── Appel final ───────────────────────────────── */}
      <section id="cta" aria-labelledby="coach-final" className="pb-28 lg:pb-36 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette centre>{T.cta.eyebrow}</Etiquette>
          <h2 id="coach-final" className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[88px]">
            <span className="block text-white">{T.cta.title1}</span>
            <span className="block text-[#E63946]">{T.cta.title2}</span>
          </h2>
          <p className="mt-6 text-[17px] text-[#D1D5DB]">{T.cta.body}</p>
          <div className="mt-9 flex flex-col items-center gap-4">
            <Link href="/inscription" className={bouton}>
              {T.cta.button} <span aria-hidden>→</span>
            </Link>
            <span className="inline-flex items-center gap-2 text-[13px] text-[#9CA3AF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              {T.cta.trustFree}
            </span>
          </div>
          <p className="mt-10 text-[15px] text-[#9CA3AF]">
            {T.cta.noPlayersPrefix}
            <Link href="/pour-les-etudiant-athlete" className="font-semibold text-[#E63946] hover:text-white underline-offset-4 hover:underline">
              {T.cta.noPlayersLink} →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
