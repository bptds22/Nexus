"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  BadgeCheck,
  Check,
  X as XIcon,
} from "lucide-react";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import {
  type Persona,
  type Billing,
  type Tier,
  type TierCopy,
  PERSONA_SAVINGS,
  getTiersForPersona,
} from "@/lib/config/pricing";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Lang } from "@/lib/i18n/LanguageContext";

/* ═══════════════════════════════════════════════════════════════
   Tarifs — Unified pricing (Recruteur / Coach / Athlète)
   v2 (BP 2026-10-20) : présentation seulement — mêmes tiers (lib/config/
   pricing.ts), même paiement (/api/stripe/checkout), même ?role=.
═══════════════════════════════════════════════════════════════ */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="w-10 h-px bg-[#E63946]" />
      <span className={`${label} text-[#E63946]`}>{children}</span>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

/**
 * Price formatter. Two-decimal form for per-month values; pass
 * `{ whole: true }` for annual totals we display as integers. Zero always
 * collapses to a whole "0" so free tiers don't render "0.00".
 * FR : « 19,99 $ » (espace insécable) ; EN : « $19.99 ».
 */
function formatPrice(n: number, lang: Lang, opts: { whole?: boolean } = {}): string {
  const nombre = n === 0 || opts.whole ? String(Math.round(n)) : n.toFixed(2);
  return lang === "fr" ? `${nombre.replace(".", ",")}\u00a0$` : `$${nombre}`;
}

function isValidPersona(v: string | null): v is Persona {
  return v === "recruteur" || v === "coach" || v === "athlete";
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function TarifsPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t, lang } = useTranslation();
  const T = t.pricing;
  const [persona, setPersona] = useState<Persona>("recruteur");
  const [billing, setBilling] = useState<Billing>("monthly");

  useEffect(() => {
    // Read ?role= from URL on mount (avoids Suspense boundary with useSearchParams)
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("role");
      const normalized = (param || "").toLowerCase();
      if (isValidPersona(normalized)) {
        setPersona(normalized);
      }
    }
  }, []);

  useEffect(() => {
  }, [persona]);

  useEffect(() => {
  }, [billing]);

  const tiers = getTiersForPersona(persona);
  const savingsPct = PERSONA_SAVINGS[persona];
  /* Source unique de la bascule « offre payante » vs « tout gratuit ».
     On teste le tableau de tiers, jamais la persona en dur : le jour où une
     adhésion coach revient, repeupler COACH_TIERS rebascule toute la page. */
  const hasPaidTiers = tiers.length > 0;

  const handleCheckout = async (tierId: string, cycle: Billing) => {
    // Map tier ID → checkout tier value
    const tierMap: Record<string, string> = {
      rec_pro: "pro",
      rec_allstar: "all_star",
      "coach-pro": "pro",
      coach_allstar: "all_star",
      ath_pro: "pro",
    };
    const checkoutTier = tierMap[tierId];
    if (!checkoutTier) return;

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: checkoutTier, cycle }),
    });

    if (res.status === 401) {
      window.location.href = "/auth";
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[tarifs] checkout error:", err);
      alert(err.error || "Erreur lors de la création du paiement. Réessayez.");
      return;
    }

    const { url } = await res.json();
    if (url) window.location.href = url;
  };

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      {/* ─── HÉROS (style v2, BP 2026-10-20) ─────────────── */}
      <section aria-labelledby="tarifs-titre" className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 pt-20 lg:pt-28 pb-10">
          <Etiquette>{T.hero.eyebrow}</Etiquette>
          <h1 id="tarifs-titre" className="nx-display uppercase leading-[0.92] tracking-tight mt-5 text-5xl sm:text-6xl lg:text-[88px]">
            <span className="block text-white">{T.hero.title1}</span>
            <span className="block text-[#E63946]">{T.hero.title2}</span>
          </h1>
          <p className="mt-6 max-w-[680px] text-lg sm:text-xl text-[#D1D5DB] leading-relaxed">{T.hero.lede}</p>

          {/* ─── Sélecteur de persona, puis de cadence ─────── */}
          <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="inline-flex self-start rounded-md border border-white/[0.07] bg-[#1A1D24] p-1">
              {([
                { key: "recruteur", label: T.personaToggle.recruiter },
                { key: "coach", label: T.personaToggle.coach },
                { key: "athlete", label: T.personaToggle.athlete },
              ] as { key: Persona; label: string }[]).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPersona(p.key)}
                  aria-pressed={persona === p.key}
                  className={`h-11 px-4 sm:px-6 rounded font-head font-black text-[12px] sm:text-[13px] uppercase tracking-widest transition-colors ${
                    persona === p.key ? "bg-[#E63946] text-white" : "text-[#9CA3AF] hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Masqué quand la persona n'a aucun tier payant : un bascule
                mensuel/annuel devant une offre gratuite ne commande rien. */}
            {hasPaidTiers && (
              <div className="inline-flex self-start rounded-md border border-white/[0.07] bg-[#1A1D24] p-1">
                {(["monthly", "annual"] as Billing[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBilling(b)}
                    aria-pressed={billing === b}
                    className={`h-11 px-4 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      billing === b ? "bg-white text-[#111317]" : "text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    {b === "monthly" ? T.billingToggle.monthly : T.billingToggle.annual}
                    {b === "annual" && savingsPct > 0 && (
                      <span className="ml-1.5 font-normal normal-case tracking-normal opacity-80">
                        ({T.billingToggle.saveLabel} {savingsPct}%)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── CARTES ─────────────────────────────────────── */}
      <section className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 pt-4 pb-16">
          {!hasPaidTiers ? (
            /* Aucun tier payant (athlète, coach) — encadré mission puis
               liste de ce qui est inclus. Piloté par la LONGUEUR du tableau
               de tiers, pas par la persona : repeupler COACH_TIERS suffit
               à faire réapparaître les cartes, sans toucher à ce fichier. */
            <FreePersonaPanel
              items={persona === "coach" ? T.freePersona.coachItems : T.freePersona.athleteItems}
              missionBody={persona === "coach" ? T.freePersona.coachMissionBody : T.freePersona.athleteMissionBody}
              labels={T.freePersona}
              lang={lang}
            />
          ) : tiers.length === 2 ? (
            /* 2 tiers (Athlète — Pro + Free; All Star hidden for MVP) */
            <div className="max-w-[860px] grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <PricingCard tier={tiers[1]} copy={T.tiers[tiers[1].id]} billing={billing} orderCls="order-1 md:order-2" cardLabels={T.card} lang={lang} />
              <PricingCard tier={tiers[0]} copy={T.tiers[tiers[0].id]} billing={billing} orderCls="order-2 md:order-1" cardLabels={T.card} lang={lang} />
            </div>
          ) : (
            /* 3 tiers (Recruteur) — Pro centered, Free left, All Star right */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              <PricingCard tier={tiers[1]} copy={T.tiers[tiers[1].id]} billing={billing} orderCls="order-1 md:order-2" cardLabels={T.card} lang={lang} onCheckout={tiers[1].monthly > 0 ? handleCheckout : undefined} />
              <PricingCard tier={tiers[0]} copy={T.tiers[tiers[0].id]} billing={billing} orderCls="order-2 md:order-1" cardLabels={T.card} lang={lang} />
              <PricingCard tier={tiers[2]} copy={T.tiers[tiers[2].id]} billing={billing} orderCls="order-3 md:order-3" cardLabels={T.card} lang={lang} />
            </div>
          )}
        </div>
      </section>

      {/* ─── BANDEAU CÉGEP (recruteur seulement) ────────── */}
      {persona === "recruteur" && (
        <section className="relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 pb-20">
            <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-[#1A1D24] px-7 py-9 lg:px-12 lg:py-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 260px at 85% 50%, rgba(230,57,70,0.16), transparent 60%)" }} />
              <div className="relative max-w-[720px]">
                <h2 className="nx-display uppercase text-3xl sm:text-4xl leading-none text-white">{T.cegepBanner.title}</h2>
                <p className="mt-3 text-[15px] text-[#9CA3AF] leading-relaxed">{T.cegepBanner.body}</p>
              </div>
              <Link
                href="/contact"
                className="relative shrink-0 self-start lg:self-auto inline-flex items-center h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded"
              >
                {T.cegepBanner.cta}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── POURQUOI PRO (athlète seulement) ───────────────
          Ne s'affiche que s'il existe un tier payant à justifier. L'athlète
          étant entièrement gratuit, cette section reste montée mais inerte —
          elle revient telle quelle si une offre athlète est réintroduite. */}
      {persona === "athlete" && hasPaidTiers && (
        <section className="relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 pb-16">
            <Etiquette>{T.whyPro.eyebrow}</Etiquette>
            <h2 className="nx-display uppercase text-4xl sm:text-5xl leading-none text-white mt-5">{T.whyPro.title}</h2>
            <p className="text-[16px] text-[#9CA3AF] leading-relaxed mt-5 max-w-[640px]">{T.whyPro.lede}</p>
          </div>
        </section>
      )}

      {/* ─── CONFIANCE ──────────────────────────────────── */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 py-8">
          <div className={`flex flex-wrap items-center gap-x-8 gap-y-3 ${label} text-[#9CA3AF]`}>
            <span className="inline-flex items-center gap-2">
              <Building2 size={15} strokeWidth={2} className="text-[#E63946]" />
              {T.trust.quebecHost}
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={15} strokeWidth={2} className="text-[#E63946]" />
              {T.trust.loi25}
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck size={15} strokeWidth={2} className="text-[#E63946]" />
              {T.trust.verifiedProfiles}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── FreePersonaPanel ───────────────────────────────────────────
   Affiché à la place des cartes pour une persona sans tier payant :
   la mission à gauche, ce qui est inclus à droite. Aucune notion de
   prix : il n'y en a pas. */
function FreePersonaPanel({
  items,
  missionBody,
  labels,
  lang,
}: {
  items: string[];
  /** Corps de mission propre à la persona — choisi au site d'appel, comme
      `items`. Le coach et l'athlète n'ont ni le même propos ni le même
      registre (vouvoiement / tutoiement). */
  missionBody: string;
  labels: Dictionary["pricing"]["freePersona"];
  lang: Lang;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-5 rounded-lg border border-white/[0.07] border-t-[3px] border-t-[#E63946] bg-[#1A1D24] p-7 lg:p-9">
        <div className={`${label} text-[#E63946]`}>{labels.missionEyebrow}</div>
        <div className="nx-display uppercase text-[64px] leading-none text-white mt-3">{formatPrice(0, lang)}</div>
        <h2 className="nx-display uppercase text-3xl leading-none text-white mt-6">{labels.missionTitle}</h2>
        <p className="mt-3 text-[15px] text-[#9CA3AF] leading-relaxed">{missionBody}</p>
      </div>
      <div className="lg:col-span-7 rounded-lg border border-white/[0.07] bg-[#1A1D24] p-7 lg:p-9">
        <h3 className={`${label} text-white/55`}>{labels.checklistTitle}</h3>
        <ul className="mt-5 space-y-3">
          {items.map((item, idx) => (
            <li key={`free-${idx}-${item}`} className="flex gap-3 text-[15px] text-white/85 leading-relaxed">
              <span aria-hidden className="text-[#E63946]">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── PricingCard ────────────────────────────────────────────── */

function PricingCard({
  tier,
  copy,
  billing,
  orderCls,
  cardLabels,
  lang,
  onCheckout,
}: {
  tier: Tier;
  /* Textes du tier, résolus par `tier.id` dans le dictionnaire actif.
     Absent = tier non traduit : on ne rend rien plutôt que des trous. */
  copy: TierCopy | undefined;
  billing: Billing;
  orderCls: string;
  cardLabels: Dictionary["pricing"]["card"];
  lang: Lang;
  onCheckout?: (tier: string, cycle: Billing) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  /* Un tier sans traduction ne rend rien plutôt qu'une carte trouée. Le cas
     ne devrait pas survenir — l'interface Dictionary impose les trois clés
     recruteur dans les deux langues — mais `Record<string, TierCopy>` ne le
     garantit pas au type, et une carte à moitié vide serait pire qu'absente. */
  if (!copy) return null;
  const isFree = tier.monthly === 0;
  const showAnnual = billing === "annual" && tier.annual > 0;
  // Big price always follows the billing toggle so the user sees the actual
  // amount they'll be charged on that cadence. The two-line framing below
  // shows both options regardless of toggle for easy comparison.
  const priceDisplay = showAnnual
    ? formatPrice(tier.annual, lang, { whole: true })
    : formatPrice(tier.monthly, lang);
  const periodShort = isFree ? "" : showAnnual ? cardLabels.perYear : cardLabels.perMonth;

  return (
    <div className={`relative bg-[#1A1D24] rounded-lg ${tier.border} ${tier.glow} ${orderCls} p-7 lg:p-8 flex flex-col`}>
      {copy.badgeLabel && tier.badgeStyle && (
        <span
          className={`absolute -top-3 left-7 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${tier.badgeStyle.bg} ${tier.badgeStyle.fg}`}
        >
          {copy.badgeLabel}
        </span>
      )}

      <h2 className={`nx-display uppercase text-[34px] leading-none ${tier.nameColor}`}>
        {copy.name}
      </h2>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="nx-display text-[56px] text-white leading-none">
          {priceDisplay}
        </span>
        {!isFree && (
          <span className="text-[14px] text-[#9CA3AF]">{periodShort}</span>
        )}
      </div>
      {isFree ? (
        <p className="text-[13px] text-[#9CA3AF] mt-2">{cardLabels.forever}</p>
      ) : (
        <div className="mt-2 space-y-0.5">
          <p className="text-[13px] text-[#c8c8cc]">
            {cardLabels.fromPrefix}<span className="font-bold text-white">{formatPrice(tier.annualMonthlyEq ?? tier.monthly, lang)}{cardLabels.perMonth}</span>{cardLabels.fromSuffixAnnual}
          </p>
          <p className="text-[12px] text-[#6b7280]">
            {cardLabels.orPrefix}{formatPrice(tier.monthly, lang)}{cardLabels.perMonth}{cardLabels.orSuffixMonthly}
          </p>
        </div>
      )}

      <div className="h-px bg-white/[0.07] my-6" />

      {copy.featuresHeader && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
          {copy.featuresHeader}
        </p>
      )}

      <ul className="space-y-2.5 flex-1">
        {copy.features.map((f, idx) => {
          if (f.kind === "section") {
            return (
              <li
                key={`sec-${idx}-${f.label}`}
                className={`pt-3 pb-1 ${label} text-white/55`}
              >
                {f.label}
              </li>
            );
          }
          return (
            <li key={`item-${idx}-${f.label}`} className="flex items-start gap-2.5">
              {f.included ? (
                <span className="shrink-0 mt-0.5 w-[16px] h-[16px] rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                  <Check size={11} strokeWidth={3} />
                </span>
              ) : (
                <span className="shrink-0 mt-0.5 w-[16px] h-[16px] rounded-full bg-white/5 text-[#6b7280] flex items-center justify-center">
                  <XIcon size={11} strokeWidth={2.5} />
                </span>
              )}
              <span className={`text-[14px] leading-relaxed ${f.included ? "text-white/85" : "text-[#6b7280]"}`}>
                {f.label}
              </span>
            </li>
          );
        })}
      </ul>

      {onCheckout ? (
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await onCheckout(tier.id, billing);
            } finally {
              setLoading(false);
            }
          }}
          className={`mt-7 inline-flex items-center justify-center w-full h-12 rounded font-head font-black text-[13px] uppercase tracking-widest transition-colors disabled:opacity-50 ${tier.ctaClass}`}
        >
          {loading ? "Redirection..." : copy.ctaLabel}
        </button>
      ) : (
        <Link
          href={tier.ctaHref}
          className={`mt-7 inline-flex items-center justify-center w-full h-12 rounded font-head font-black text-[13px] uppercase tracking-widest transition-colors ${tier.ctaClass}`}
        >
          {copy.ctaLabel}
        </Link>
      )}
    </div>
  );
}
