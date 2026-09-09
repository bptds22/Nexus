"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { useTranslation } from "@/lib/i18n/useTranslation";

/* ═══════════════════════════════════════════════════════════════
   Pour les parents — page vitrine publique.

   Jumelle visuelle de /pour-les-coachs et /pour-les-recruteurs :
   mêmes primitives (RedLabel, SectionTitle, GlowFrame), même nav,
   même fond, même hero centré. Le contenu vient du dictionnaire
   (`t.parentLanding`), FR et EN — jamais de texte en dur, sinon le
   sélecteur de langue laisse une page à moitié traduite.

   VOUVOIEMENT en français, écart ASSUMÉ avec le tutoiement des pages
   coach et athlète : c'est le registre juste pour cette audience.

   PAS DE CTA « Créer mon compte parent », nulle part. Un parent ne
   peut pas s'inscrire de lui-même : le portail est sur invitation,
   déclenchée par l'inscription de l'enfant (/parent/claim?token=…,
   courriel verrouillé sur l'adresse fournie). La page en fait un
   argument — l'invitation EST le mécanisme de sécurité — au lieu de
   le contourner par un bouton qui mènerait à un rôle inexistant :
   /inscription ne propose que ATHLETE, RECRUTEUR et COACH.

   Le hero ne montre PAS de capture du portail parent mais un mock
   JSX, même procédé que le widget messagerie de /pour-les-coachs.
   Aucune donnée identifiante : ni nom d'enfant, ni recruteur, ni
   école — cohérent avec la page Activité, qui est anonyme par
   conception.
═══════════════════════════════════════════════════════════════ */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[26px] sm:text-[30px] font-extrabold text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

function GlowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-60px",
          background:
            "radial-gradient(ellipse at center, rgba(230, 57, 70, 0.35) 0%, rgba(230, 57, 70, 0.12) 45%, transparent 75%)",
          borderRadius: "32px",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0 mt-[3px]" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* ── Mock du tableau de bord parent ────────────────────────────
   Barres du graphe en pourcentages FIXES : c'est une illustration,
   pas une donnée. Un aléatoire redonnerait un rendu différent à
   chaque build et rendrait toute capture non reproductible.         */
const BARS = [28, 42, 35, 58, 47, 66, 54, 72, 61, 84, 76, 92];

function ParentDashboardMockup({
  label, activityTitle, activityCaption,
  consentTitle, consentValue,
  notificationTitle, notificationBody,
}: {
  label: string; activityTitle: string; activityCaption: string;
  consentTitle: string; consentValue: string;
  notificationTitle: string; notificationBody: string;
}) {
  return (
    <div className="bg-[#15171c] rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl text-left">
      <div className="px-6 sm:px-7 py-5 border-b border-white/[0.05] bg-[#1A1D24]">
        <p className="text-[12px] font-bold text-[#6b7280] uppercase tracking-[0.2em]">{label}</p>
      </div>

      <div className="p-5 sm:p-7 grid gap-4 sm:grid-cols-2">
        {/* Activité — graphe hebdo stylisé */}
        <div className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-[#111317] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-bold text-white">{activityTitle}</p>
            <p className="text-[11px] text-[#6b7280] uppercase tracking-wider">{activityCaption}</p>
          </div>
          <div className="mt-4 flex items-end gap-[6px] h-[86px]" aria-hidden="true">
            {BARS.map((h, i) => (
              <div key={i} className="flex-1 rounded-t-[3px] bg-[#E63946]"
                style={{ height: `${h}%`, opacity: 0.35 + (i / BARS.length) * 0.65 }} />
            ))}
          </div>
        </div>

        {/* Consentements */}
        <div className="rounded-xl border border-white/[0.06] bg-[#111317] p-5">
          <p className="text-[11px] font-bold text-[#6b7280] uppercase tracking-[0.18em]">{consentTitle}</p>
          <div className="flex items-center gap-2 mt-2.5">
            <CheckIcon />
            <p className="text-[15px] font-bold text-white">{consentValue}</p>
          </div>
        </div>

        {/* Notification */}
        <div className="rounded-xl border border-[#E63946]/25 bg-[#E63946]/[0.06] p-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E63946]" aria-hidden="true" />
            <p className="text-[11px] font-bold text-[#E63946] uppercase tracking-[0.18em]">{notificationTitle}</p>
          </div>
          <p className="text-[14px] text-white/80 mt-2 leading-snug">{notificationBody}</p>
        </div>
      </div>
    </div>
  );
}

/* ── FAQ accordéon ─────────────────────────────────────────────
   <details>/<summary> natifs : ouverture sans JavaScript, lisibles
   par les lecteurs d'écran et par un crawler — une FAQ vitrine doit
   être indexable même quand le JS ne s'exécute pas.                */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-white/[0.07] py-5">
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
        <span className="text-[16px] font-bold text-white">{q}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF"
          strokeWidth="2.4" strokeLinecap="round"
          className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <p className="text-[15px] text-white/70 leading-relaxed mt-3 max-w-[760px]">{a}</p>
    </details>
  );
}

export default function PourLesParentsPage() {
  // Exclue du build mobile, comme les trois autres pages vitrine.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t } = useTranslation();
  const T = t.parentLanding;

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── HERO ─────────────────────────────────────────── */}
        {/* `overflow-x: clip` — le halo de GlowFrame déborde volontairement de
            60px de chaque côté du mock. Sous 768px ce débordement dépassait le
            viewport et créait une barre de défilement horizontale de 36px sur
            TOUTE la page. On le rogne ici, au niveau de la section, plutôt que
            sur GlowFrame : le halo garde sa diffusion dans les marges du
            conteneur (rendu desktop inchangé) et n'est coupé qu'au bord de
            l'écran. `clip` et non `hidden` : `hidden` ferait de la section un
            conteneur de défilement et casserait le `sticky` de la nav. */}
        <section id="hero" className="border-b border-white/[0.06] [overflow-x:clip]">
          <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-28 text-center">
            <RedLabel>{T.hero.eyebrow}</RedLabel>
            <h1 className="nx-display text-[36px] sm:text-[48px] font-extrabold leading-[1.05] tracking-tight mt-4">
              {T.hero.titleLine1}<br />
              <span className="text-[#E63946]">{T.hero.titleLine2}</span>
            </h1>
            <p className="text-[18px] text-white/75 leading-relaxed mt-6 max-w-[640px] mx-auto">
              {T.hero.lede}
            </p>
            <p className="text-[15px] text-white/55 mt-4 max-w-[640px] mx-auto">
              {T.hero.ledeSmall}
            </p>

            <div className="flex items-center justify-center gap-3 mt-9 flex-wrap">
              <Link
                href="/pour-les-etudiant-athlete"
                className="inline-flex items-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                style={{ fontSize: 16, padding: "14px 32px" }}
              >
                {T.hero.cta}
              </Link>
            </div>

            <div className="mt-16 max-w-[900px] mx-auto">
              <GlowFrame>
                <ParentDashboardMockup {...T.hero.mockup} />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── COMMENT ÇA FONCTIONNE ────────────────────────── */}
        <section id="comment-ca-fonctionne" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>{T.howItWorks.eyebrow}</RedLabel>
              <SectionTitle>{T.howItWorks.title}</SectionTitle>
            </div>

            <div className="grid gap-5 mt-10 md:grid-cols-3">
              {T.howItWorks.steps.map((s) => (
                <div key={s.num} className="rounded-2xl border border-white/[0.07] bg-[#15171c] p-6">
                  <div className="flex items-center gap-3">
                    <span className="nx-display text-[28px] font-extrabold text-[#E63946] leading-none">{s.num}</span>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">{s.role}</span>
                  </div>
                  <p className="text-[17px] font-bold text-white mt-4">{s.title}</p>
                  <p className="text-[15px] text-white/70 leading-relaxed mt-2">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CE QUE VOUS VOYEZ ────────────────────────────── */}
        <section id="ce-que-vous-voyez" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>{T.whatYouSee.eyebrow}</RedLabel>
              <SectionTitle>{T.whatYouSee.title}</SectionTitle>
            </div>

            <div className="grid gap-5 mt-10 sm:grid-cols-2">
              {T.whatYouSee.items.map((it) => (
                <div key={it.title} className="rounded-2xl border border-white/[0.07] bg-[#15171c] p-6">
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">
                    {T.whatYouSee.tag}
                  </span>
                  <p className="text-[17px] font-bold text-white mt-3">{it.title}</p>
                  <p className="text-[15px] text-white/70 leading-relaxed mt-2">{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── QUI DÉCIDE ? VOUS. (section signature, encadrée) */}
        <section id="qui-decide" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="rounded-2xl border border-[#E63946]/40 bg-[#E63946]/[0.04] p-7 sm:p-10">
              <RedLabel>{T.whoDecides.eyebrow}</RedLabel>
              <SectionTitle>{T.whoDecides.title}</SectionTitle>

              <ul className="grid gap-3.5 mt-7 sm:grid-cols-2">
                {T.whoDecides.checks.map((c) => (
                  <li key={c} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-[15px] text-white/85 leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-xl border border-white/[0.08] bg-[#111317] p-5">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF]">
                  {T.whoDecides.calloutTitle}
                </p>
                <p className="text-[15px] text-white/70 leading-relaxed mt-2 max-w-[760px]">
                  {T.whoDecides.calloutBody}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ──────────────────────────────────────────── */}
        <section id="faq" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>{T.faq.eyebrow}</RedLabel>
              <SectionTitle>{T.faq.title}</SectionTitle>
            </div>
            <div className="mt-8 max-w-[860px]">
              {T.faq.items.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL ────────────────────────────────────── */}
        <section id="cta" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-24 text-center">
            <h2 className="nx-display text-[28px] sm:text-[34px] font-extrabold text-white leading-tight tracking-tight">
              {T.finalCta.title}
            </h2>
            <p className="text-[17px] text-white/75 leading-relaxed mt-5 max-w-[640px] mx-auto">
              {T.finalCta.line}
            </p>

            <div className="flex items-center justify-center mt-9">
              <Link
                href="/pour-les-etudiant-athlete"
                className="inline-flex items-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                style={{ fontSize: 16, padding: "14px 32px" }}
              >
                {T.finalCta.cta}
              </Link>
            </div>

            <ul className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap mt-7">
              {T.finalCta.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-[14px] text-white/65">
                  <CheckIcon />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
