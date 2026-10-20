"use client";

import Link from "next/link";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import { useTranslation } from "@/lib/i18n/useTranslation";

/* ─────────────────────────────────────────────────────────────────
   /comment-ca-marche v2 (BP 2026-10-20) — même langage que l'accueil
   v2 et la page recruteur : titres nx-display en deux lignes (blanc +
   rouge), étiquette rouge précédée d'un trait, cartes #1A1D24.
   Le héros et « Notre conviction » sont la voix de BP : textes gardés.
   Aucun chiffre inventé, aucun témoignage.
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/** Badges du catalogue montrés en vitrine, dans l'ordre de `distinctions.labels`. */
const BADGES_VITRINE = ["capitaine", "mvp", "leader-ligue", "equipe-etoiles", "clutch", "nexus-x"] as const;

/** Liens des trois rôles, dans l'ordre de `personas.items`. */
const PERSONAS_LIENS = ["/pour-les-etudiant-athlete", "/pour-les-coachs", "/pour-les-recruteurs"] as const;

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
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

function Section({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`py-20 lg:py-28 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">{children}</div>
    </section>
  );
}

function Crochet({ bleu }: { bleu: boolean }) {
  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bleu ? "bg-[#3B82F6]" : "border-2 border-white/30"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={bleu ? "#fff" : "rgba(255,255,255,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

function Etoiles({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${n} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < n ? "#F59E0B" : "#4a4d56"} aria-hidden>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function SectionsCommentCaMarche() {
  const { t } = useTranslation();
  const T = t.howItWorks;

  return (
    <>
      {/* ── Héros : la voix de BP ─────────────────────── */}
      <section aria-labelledby="ccm-heros" className="pt-20 pb-16 lg:pt-28 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{T.hero.eyebrow}</Etiquette>
          <Titre id="ccm-heros" as="h1" l1={T.hero.title1} l2={T.hero.title2} taille="text-6xl sm:text-7xl lg:text-[112px]" />
          <p className="mt-8 max-w-[760px] text-lg sm:text-[21px] text-[#D1D5DB] leading-relaxed">{T.hero.lede}</p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              href="/inscription?role=ATHLETE"
              className="inline-flex items-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded"
            >
              {T.hero.cta} <span aria-hidden>→</span>
            </Link>
            <a href="#etapes" className="inline-flex items-center min-h-[44px] text-sm font-semibold text-white/80 hover:text-white underline-offset-4 hover:underline">
              {T.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </section>

      {/* ── Pourquoi Nexus existe ─────────────────────── */}
      <Section id="ccm-pourquoi">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Etiquette>{T.why.eyebrow}</Etiquette>
            <Titre id="ccm-pourquoi" l1={T.why.title1} l2={T.why.title2} taille="text-5xl sm:text-6xl lg:text-[60px]" />
          </div>
          <div className="lg:col-span-7 lg:pt-12 space-y-5 text-[17px] text-[#9CA3AF] leading-relaxed">
            {T.why.paragraphs.map((p, i) => (
              <p key={i} className={i === T.why.paragraphs.length - 1 ? "text-white font-semibold" : ""}>{p}</p>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Comment ça marche : trois rôles ───────────── */}
      <section id="etapes" aria-labelledby="ccm-etapes" className="py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{T.etapes.eyebrow}</Etiquette>
          <Titre id="ccm-etapes" l1={T.etapes.title1} l2={T.etapes.title2} />
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {T.etapes.items.map((e, i) => (
              <div key={e.title}>
                <div className="nx-display text-[72px] leading-[0.9] text-[#E63946]">{String(i + 1).padStart(2, "0")}</div>
                <div className={`${label} text-[#9CA3AF] mt-3`}>{e.kicker}</div>
                <h3 className="nx-display uppercase text-[28px] leading-none mt-2 text-white">{e.title}</h3>
                <p className="mt-3 text-[#9CA3AF] leading-relaxed">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── La vérification ───────────────────────────── */}
      <Section id="ccm-verification">
        <Etiquette>{T.verification.eyebrow}</Etiquette>
        <Titre id="ccm-verification" l1={T.verification.title1} l2={T.verification.title2} />
        <p className="mt-6 max-w-[760px] text-lg text-[#D1D5DB] leading-relaxed">{T.verification.lede}</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {([false, true] as const).map((bleu) => (
            <div key={String(bleu)} className={`rounded-lg border bg-[#1A1D24] p-7 lg:p-8 ${bleu ? "border-[#3B82F6]/40" : "border-white/[0.07]"}`}>
              <Crochet bleu={bleu} />
              <h3 className="nx-display uppercase text-[26px] leading-none mt-5 text-white">{bleu ? T.verification.blueTitle : T.verification.grayTitle}</h3>
              <p className="mt-3 text-[15px] text-[#9CA3AF] leading-relaxed">{bleu ? T.verification.blueBody : T.verification.grayBody}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-white/[0.07] border-l-[3px] border-l-[#E63946] bg-[#1A1D24] p-7 lg:p-8">
          <h3 className="nx-display uppercase text-[26px] leading-none text-white">{T.verification.perishableTitle}</h3>
          <p className="mt-3 max-w-[860px] text-[15px] text-[#9CA3AF] leading-relaxed">{T.verification.perishableBody}</p>
        </div>
      </Section>

      {/* ── L'évaluation du coach : l'échelle des étoiles ── */}
      <Section id="ccm-etoiles">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Etiquette>{T.stars.eyebrow}</Etiquette>
            <Titre id="ccm-etoiles" l1={T.stars.title1} l2={T.stars.title2} taille="text-5xl sm:text-6xl lg:text-[60px]" />
            <p className="mt-6 text-[17px] text-[#D1D5DB] leading-relaxed">{T.stars.lede}</p>
            <p className="mt-5 text-[15px] text-[#9CA3AF] leading-relaxed">{T.stars.detail}</p>
          </div>
          <div className="lg:col-span-7">
            <ul className="space-y-2.5">
              {T.stars.definitions.map((d, i) => (
                <li key={d} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5 rounded-md border border-white/[0.07] bg-[#1A1D24] px-5 py-4">
                  <span className="shrink-0"><Etoiles n={5 - i} /></span>
                  <span className="text-[15px] text-white/85 leading-snug">{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-lg border border-white/[0.07] bg-[#1A1D24] p-6 lg:p-7">
              <h3 className="nx-display uppercase text-[24px] leading-none text-white">{T.stars.question.title}</h3>
              <p className="mt-3 text-[15px] text-[#9CA3AF] leading-relaxed">{T.stars.question.body}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Les distinctions ──────────────────────────── */}
      <Section id="ccm-distinctions">
        <Etiquette>{T.distinctions.eyebrow}</Etiquette>
        <Titre id="ccm-distinctions" l1={T.distinctions.title1} l2={T.distinctions.title2} />
        <p className="mt-6 max-w-[760px] text-lg text-[#D1D5DB] leading-relaxed">{T.distinctions.lede}</p>
        <div className="mt-12 grid grid-cols-3 gap-y-8 sm:grid-cols-6 rounded-lg border border-white/[0.07] bg-[#1A1D24] px-4 py-10">
          {BADGES_VITRINE.map((code, i) => (
            <div key={code} className="flex justify-center">
              <DistinctionBadge
                badge={code}
                libelle={T.distinctions.labels[i]}
                detail={code === "nexus-x" ? T.distinctions.labels[i] : undefined}
                size="lg"
                index={i}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Le contact ────────────────────────────────── */}
      <Section id="ccm-contact">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Etiquette>{T.communication.eyebrow}</Etiquette>
            <Titre id="ccm-contact" l1={T.communication.title1} l2={T.communication.title2} taille="text-5xl sm:text-6xl lg:text-[60px]" />
          </div>
          <ul className="lg:col-span-7 lg:pt-12 space-y-5">
            {T.communication.paragraphs.map((p) => (
              <li key={p} className="flex gap-3 text-[17px] text-[#9CA3AF] leading-relaxed">
                <span aria-hidden className="text-[#E63946]">→</span><span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── L'engagement ──────────────────────────────── */}
      <Section id="ccm-engagement">
        <Etiquette>{T.engagement.eyebrow}</Etiquette>
        <Titre id="ccm-engagement" l1={T.engagement.title1} l2={T.engagement.title2} />
        <div className="mt-12 grid gap-3 lg:grid-cols-3">
          {T.engagement.items.map((it, i) => (
            <div key={it.title} className="rounded-md border border-white/[0.07] border-t-[3px] border-t-[#E63946] bg-[#1A1D24] px-6 py-7">
              <div className="nx-display text-[40px] leading-none text-[#E63946]/40">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="nx-display uppercase text-[26px] leading-none mt-3 text-white">{it.title}</h3>
              <p className="mt-3 text-[15px] text-[#9CA3AF] leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Notre conviction : la voix de BP ──────────── */}
      <Section id="ccm-conviction">
        <div className="max-w-[860px]">
          <Etiquette>{T.conviction.eyebrow}</Etiquette>
          <Titre id="ccm-conviction" l1={T.conviction.title1} l2={T.conviction.title2} />
          <div className="mt-10 space-y-6 text-[17px] sm:text-[18px] text-[#D1D5DB] leading-relaxed">
            {T.conviction.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-8 nx-display uppercase text-3xl sm:text-4xl leading-none text-[#E63946]">{T.conviction.closing}</p>
        </div>
      </Section>

      {/* ── Choisis ton côté ──────────────────────────── */}
      <Section id="ccm-personas" className="pb-28 lg:pb-36">
        <Etiquette>{T.personas.eyebrow}</Etiquette>
        <Titre id="ccm-personas" l1={T.personas.title1} l2={T.personas.title2} />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {T.personas.items.map((p, i) => (
            <Link
              key={p.question}
              href={PERSONAS_LIENS[i]}
              className="group flex flex-col rounded-lg border border-white/[0.07] bg-[#1A1D24] p-7 lg:p-8 transition-colors hover:border-[#E63946]/60"
            >
              <h3 className="nx-display uppercase text-[32px] leading-none text-white">{p.question}</h3>
              <span className="mt-5 block h-px w-10 bg-[#E63946]" />
              <p className="mt-5 text-[15px] text-[#9CA3AF] leading-relaxed flex-1">{p.line}</p>
              <span className="mt-8 inline-flex items-center gap-2 font-head font-black text-[13px] uppercase tracking-widest text-[#E63946] group-hover:text-white transition-colors">
                {p.label} <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
