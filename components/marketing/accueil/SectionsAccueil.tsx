"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/config/appStores";

/* ─────────────────────────────────────────────────────────────────
   Accueil v2 (BP 2026-10-20) — les sections SOUS le héros et la
   bannière partenaires, qui restent inchangés. Même langage visuel que
   le héros : titres nx-display (Barlow Condensed) en majuscules,
   étiquette rouge précédée d'un trait, texte Outfit, fond #111317.
   Aucun chiffre, aucun témoignage, aucun logo.
───────────────────────────────────────────────────────────────────*/

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/** Les liens des trois rôles, dans l'ordre du dictionnaire (athlète, coach, recruteur). */
const PERSONAS_LIENS = [
  { cta: "/inscription?role=ATHLETE", plus: "/pour-les-etudiant-athlete" },
  { cta: "/inscription", plus: "/pour-les-coachs" },
  { cta: "/pour-les-recruteurs#cta", plus: "/pour-les-recruteurs" },
] as const;

/** Bord inférieur dentelé d'un reçu. */
const DENTS: React.CSSProperties = {
  WebkitMask: "conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/16px 100%",
  mask: "conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/16px 100%",
};

function Etiquette({ children, centre = false }: { children: React.ReactNode; centre?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-3 ${centre ? "justify-center" : ""}`}>
      <span className="w-10 h-px bg-[#E63946]" />
      <span className={`${label} text-[#E63946]`}>{children}</span>
    </div>
  );
}

function Titre({ id, l1, l2, className = "" }: { id: string; l1: string; l2?: string; className?: string }) {
  return (
    <h2 id={id} className={`nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[88px] ${className}`}>
      <span className="block text-white">{l1}</span>
      {l2 && <span className="block text-[#E63946]">{l2}</span>}
    </h2>
  );
}

export default function SectionsAccueil() {
  const { t } = useTranslation();
  const S = t.home.sections;

  return (
    <div className="relative z-10">
      {/* ── C'est quoi Nexus ? ─────────────────────────── */}
      <section aria-labelledby="accueil-quoi" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{S.quoi.eyebrow}</Etiquette>
          <Titre id="accueil-quoi" l1={S.quoi.title1} l2={S.quoi.title2} />
          <p className="mt-6 max-w-[760px] text-lg sm:text-2xl text-[#D1D5DB] leading-relaxed">{S.quoi.intro}</p>
          <div className="mt-12 grid gap-3 lg:grid-cols-5">
            {S.quoi.points.map((p, i) => (
              <div key={p.title} className="rounded-md border border-white/[0.07] border-t-[3px] border-t-[#E63946] bg-[#1A1D24] px-5 py-6">
                <div className="nx-display text-[40px] leading-none text-[#E63946]/40">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="nx-display uppercase text-2xl leading-none mt-3 text-white">{p.title}</h3>
                <p className="mt-2.5 text-[15px] text-[#9CA3AF] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Les reçus ─────────────────────────────────── */}
      <section aria-labelledby="accueil-recus" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{S.recus.eyebrow}</Etiquette>
          <Titre id="accueil-recus" l1={S.recus.title1} l2={S.recus.title2} />
          <div className="mt-12 grid gap-7 lg:grid-cols-2">
            {([["avant", "0001"], ["avec", "0002"]] as const).map(([cle, no]) => {
              const r = S.recus[cle];
              const avec = cle === "avec";
              return (
                <div key={cle} style={DENTS} className={`rounded px-6 pt-7 pb-12 text-[15px] ${avec ? "bg-white text-[#111317]" : "bg-[#E9E6DF] text-[#2A2A2A]"}`}>
                  <div className="flex items-baseline justify-between border-b-[1.5px] border-dashed border-current pb-3 mb-3">
                    <b className="nx-display uppercase text-[28px]">{r.label}</b>
                    <span className="text-[11px] tracking-[0.2em] uppercase opacity-60">{S.recus.receiptNo} {no}</span>
                  </div>
                  <ul>
                    {r.items.map((it) => (
                      <li key={it} className="flex justify-between gap-4 py-2.5 border-b border-dotted border-black/20">
                        <span>{it}</span><span aria-hidden>{avec ? "✓" : "✕"}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 flex justify-between border-t-[1.5px] border-dashed border-current nx-display uppercase text-[22px]">
                    <span>{S.recus.total}</span>
                    <span className={avec ? "text-[#E63946]" : "line-through opacity-60"}>{r.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Choisis ton rôle : athlète, coach, recruteur ── */}
      <section aria-labelledby="accueil-personas" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{S.personas.eyebrow}</Etiquette>
          <Titre id="accueil-personas" l1={S.personas.title1} l2={S.personas.title2} />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {S.personas.items.map((p, i) => (
              <article
                key={p.role}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-[#1A1D24] p-7 lg:p-8 transition-colors hover:border-[#E63946]/60"
              >
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: "radial-gradient(420px 220px at 50% 0%, rgba(230,57,70,0.14), transparent 70%)" }} />
                <div className={`${label} relative text-[#9CA3AF]`}>{S.personas.iAm}</div>
                <h3 className="nx-display relative uppercase leading-[0.9] mt-2 text-[56px] lg:text-[64px] text-white">{p.role}</h3>
                <span className="relative mt-5 block h-px w-10 bg-[#E63946]" />
                <p className="relative mt-5 text-xl font-semibold text-white">{p.title}</p>
                <ul className="relative mt-4 space-y-2.5">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-3 text-[15px] text-[#9CA3AF] leading-relaxed">
                      <span aria-hidden className="text-[#E63946]">→</span><span>{pt}</span>
                    </li>
                  ))}
                </ul>
                <div className="relative mt-auto pt-8 flex flex-col items-start gap-4">
                  <Link
                    href={PERSONAS_LIENS[i].cta}
                    className="inline-flex items-center gap-3 h-11 px-6 bg-[#E63946] text-white font-head font-black text-[13px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded"
                  >
                    {p.cta} <span aria-hidden>→</span>
                  </Link>
                  <Link href={PERSONAS_LIENS[i].plus} className="text-sm font-semibold text-white/80 hover:text-white underline-offset-4 hover:underline">
                    {p.more}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ─────────────────────────── */}
      <section aria-labelledby="accueil-etapes" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette>{S.etapes.eyebrow}</Etiquette>
          <Titre id="accueil-etapes" l1={S.etapes.title} />
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {S.etapes.items.map((e, i) => (
              <div key={e.title}>
                <div className="nx-display text-[72px] leading-[0.9] text-[#E63946]">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="nx-display uppercase text-[28px] leading-none mt-2.5 text-white">{e.title}</h3>
                <p className="mt-2.5 text-[#9CA3AF] leading-relaxed">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pour les recruteurs et les écoles ─────────── */}
      <section aria-labelledby="accueil-recruteurs" className="pb-24 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-[#1A1D24] px-7 py-10 lg:p-14 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 260px at 85% 50%, rgba(230,57,70,0.18), transparent 60%)" }} />
            <div className="relative">
              <Etiquette>{S.recruteurs.eyebrow}</Etiquette>
              <h2 id="accueil-recruteurs" className="nx-display uppercase leading-[0.92] tracking-tight mt-4 text-4xl sm:text-5xl lg:text-6xl">
                <span className="block text-white">{S.recruteurs.title1}</span>
                <span className="block text-[#E63946]">{S.recruteurs.title2}</span>
              </h2>
            </div>
            <Link
              href="/pour-les-recruteurs"
              className="relative inline-flex items-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded self-start lg:self-auto"
            >
              {S.recruteurs.cta}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Appel final ───────────────────────────────── */}
      <section aria-labelledby="accueil-final" className="pb-28 lg:pb-36 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
          <Etiquette centre>{S.final.eyebrow}</Etiquette>
          <h2 id="accueil-final" className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[88px]">
            <span className="block text-white">{S.final.title1}</span>
            <span className="block text-[#E63946]">{S.final.title2}</span>
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={APP_STORE_URL} className="inline-flex items-center gap-2.5 h-14 px-5 rounded-[10px] bg-black border border-white/30 text-left">
              <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden><path fill="#fff" d="M18.3 13.8c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.6 1.1-4.6 1.1-.9 0-2.4-1.1-4-1-2 0-3.9 1.2-5 3-2.1 3.7-.5 9.2 1.5 12.2 1 1.5 2.2 3.1 3.8 3 1.5-.1 2.1-1 3.9-1s2.3 1 3.9 1c1.6 0 2.7-1.5 3.7-3 1.2-1.7 1.6-3.3 1.7-3.4-.1 0-3.1-1.2-3.1-4.9zM15.3 4.8c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.6.8-3.5 1.8-.8.9-1.4 2.3-1.3 3.7 1.4.1 2.7-.7 3.6-1.7z"/></svg>
              <span><small className="block text-[11px] text-[#D1D5DB] leading-none">{S.final.appStoreSmall}</small><strong className="block text-lg leading-tight text-white">App Store</strong></span>
            </a>
            {PLAY_STORE_URL && (
              <a href={PLAY_STORE_URL} className="inline-flex items-center gap-2.5 h-14 px-5 rounded-[10px] bg-black border border-white/30 text-left">
                <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden><path fill="#34A853" d="M1 1l11 11L1 23c-.4-.2-.7-.7-.7-1.3V2.3C.3 1.7.6 1.2 1 1z"/><path fill="#FBBC04" d="M16 8l-4 4 4 4 4.4-2.5c1.2-.7 1.2-2.3 0-3L16 8z"/><path fill="#EA4335" d="M1 23l11-11 4 4L2.9 23.5c-.6.4-1.3.3-1.9-.5z"/><path fill="#4285F4" d="M1 1c.6-.8 1.3-.9 1.9-.5L16 8l-4 4L1 1z"/></svg>
                <span><small className="block text-[11px] text-[#D1D5DB] leading-none">{S.final.playSmall}</small><strong className="block text-lg leading-tight text-white">Google Play</strong></span>
              </a>
            )}
          </div>
          <p className="mt-6 text-[#9CA3AF]">{S.final.codeLead} <b className="text-white font-semibold">{S.final.code}</b></p>
        </div>
      </section>
    </div>
  );
}
