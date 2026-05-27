"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  ShieldCheck,
  BadgeCheck,
  GraduationCap,
  Check,
  X as XIcon,
} from "lucide-react";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import {
  type Persona,
  type Billing,
  type Tier,
  PERSONA_SAVINGS,
  getTiersForPersona,
} from "@/lib/config/pricing";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/* ═══════════════════════════════════════════════════════════════
   Tarifs — Unified pricing (Recruteur / Coach / Athlète)
═══════════════════════════════════════════════════════════════ */

/* ── Helpers ────────────────────────────────────────────────── */

/**
 * Price formatter. Defaults to two-decimal form ("$4.99") for per-month
 * values; pass `{ whole: true }` for annual totals we display as integers
 * ("$159"). Zero always collapses to "$0" so free tiers don't render
 * "$0.00".
 */
function formatPrice(n: number, opts: { whole?: boolean } = {}): string {
  if (n === 0) return "$0";
  if (opts.whole) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
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
  const { t } = useTranslation();
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

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      {/* ─── SECTION 1 — HEADER ───────────────────────────── */}
      <section>
        <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-10 text-center">
          <p className="text-[12px] sm:text-[13px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
            {T.hero.eyebrow}
          </p>
          <h1 className="nx-display text-[40px] sm:text-[48px] font-extrabold text-white uppercase leading-[1.05] tracking-tight mt-4">
            {T.hero.title}
          </h1>
          <p className="text-[15px] sm:text-[16px] text-[#9CA3AF] leading-relaxed mt-5 max-w-[600px] mx-auto">
            {T.hero.lede}
          </p>
        </div>
      </section>

      {/* ─── SECTION 2 — PERSONA TOGGLE ───────────────────── */}
      <section>
        <div className="max-w-[1200px] mx-auto px-6 flex justify-center">
          <div className="inline-flex items-center gap-1 bg-[#1A1D24] rounded-full p-1.5 border border-white/[0.06]">
            {([
              { key: "recruteur", label: T.personaToggle.recruiter },
              { key: "coach", label: T.personaToggle.coach },
              { key: "athlete", label: T.personaToggle.athlete },
            ] as { key: Persona; label: string }[]).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPersona(p.key)}
                className={`px-5 sm:px-6 py-2 rounded-full text-[12px] sm:text-[13px] font-bold uppercase tracking-wider transition-all ${
                  persona === p.key
                    ? "bg-[#2A2D34] text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
                    : "text-[#9CA3AF] hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3 — BILLING TOGGLE ───────────────────── */}
      <section>
        <div className="max-w-[1200px] mx-auto px-6 flex justify-center mt-5">
          <div className="inline-flex items-center gap-1 bg-[#1A1D24] rounded-full p-1 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                billing === "monthly" ? "bg-[#2A2D34] text-white" : "text-[#9CA3AF] hover:text-white"
              }`}
            >
              {T.billingToggle.monthly}
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                billing === "annual" ? "bg-[#2A2D34] text-white" : "text-[#9CA3AF] hover:text-white"
              }`}
            >
              {T.billingToggle.annual}
              {savingsPct > 0 && (
                <span className="text-[10px] font-normal ml-1 opacity-80">({T.billingToggle.saveLabel} {savingsPct}%)</span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4 — PRICING CARDS ────────────────────── */}
      <section>
        <div className="max-w-[1200px] mx-auto px-6 pt-10 pb-12">
          {tiers.length === 2 ? (
            /* 2 tiers (Athlète — Pro + Free; All Star hidden for MVP) */
            <div className="max-w-[820px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              <PricingCard tier={tiers[1]} billing={billing} orderCls="order-1 md:order-2" cardLabels={T.card} />
              <PricingCard tier={tiers[0]} billing={billing} orderCls="order-2 md:order-1" cardLabels={T.card} />
            </div>
          ) : (
            /* 3 tiers (Recruteur, Coach) — Pro centered, Free left, All Star right */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              <PricingCard tier={tiers[1]} billing={billing} orderCls="order-1 md:order-2" cardLabels={T.card} />
              <PricingCard tier={tiers[0]} billing={billing} orderCls="order-2 md:order-1" cardLabels={T.card} />
              <PricingCard tier={tiers[2]} billing={billing} orderCls="order-3 md:order-3" cardLabels={T.card} />
            </div>
          )}
        </div>
      </section>

      {/* ─── SECTION 5 — CÉGEP BANNER (recruiter only) ────── */}
      {persona === "recruteur" && (
        <section>
          <div className="max-w-[1200px] mx-auto px-6 pb-14">
            <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="shrink-0 w-12 h-12 rounded-full bg-[#E63946]/10 flex items-center justify-center">
                <GraduationCap size={22} className="text-[#E63946]" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-semibold text-white">{T.cegepBanner.title}</h3>
                <p className="text-[14px] text-[#9CA3AF] mt-1.5 leading-relaxed">
                  {T.cegepBanner.body}
                </p>
              </div>
              <Link
                href="/contact"
                className="shrink-0 inline-flex items-center h-11 px-5 rounded-lg border border-[#E63946] text-[#E63946] text-[12px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
              >
                {T.cegepBanner.cta}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── SECTION 6 — POURQUOI PRO (athlete only) ──────── */}
      {persona === "athlete" && (
        <section>
          <div className="max-w-[820px] mx-auto px-6 pb-14 text-center">
            <p className="text-[12px] sm:text-[13px] font-bold tracking-[0.25em] uppercase text-[#F59E0B]">
              {T.whyPro.eyebrow}
            </p>
            <h2 className="nx-display text-[28px] sm:text-[34px] font-extrabold text-white uppercase leading-tight tracking-tight mt-3">
              {T.whyPro.title}
            </h2>
            <p className="text-[15px] text-[#9CA3AF] leading-relaxed mt-5 max-w-[640px] mx-auto">
              {T.whyPro.lede}
            </p>
          </div>
        </section>
      )}

      {/* ─── TRUST STRIP ──────────────────────────────────── */}
      <section className="bg-[#111317]/80 border-t border-white/[0.06] border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[#9CA3AF] text-sm">
            <span className="inline-flex items-center gap-2">
              <Building2 size={16} strokeWidth={2} className="text-[#9CA3AF]" />
              {T.trust.quebecHost}
            </span>
            <span className="hidden sm:inline text-[#475569]">·</span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} strokeWidth={2} className="text-[#9CA3AF]" />
              {T.trust.loi25}
            </span>
            <span className="hidden sm:inline text-[#475569]">·</span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck size={16} strokeWidth={2} className="text-[#9CA3AF]" />
              {T.trust.verifiedProfiles}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── PricingCard ────────────────────────────────────────────── */

function PricingCard({
  tier,
  billing,
  orderCls,
  cardLabels,
}: {
  tier: Tier;
  billing: Billing;
  orderCls: string;
  cardLabels: Dictionary["pricing"]["card"];
}) {
  const isFree = tier.monthly === 0;
  const showAnnual = billing === "annual" && tier.annual > 0;
  // Big price always follows the billing toggle so the user sees the actual
  // amount they'll be charged on that cadence. The two-line framing below
  // shows both options regardless of toggle for easy comparison.
  const priceDisplay = showAnnual
    ? formatPrice(tier.annual, { whole: true })
    : isFree
    ? "$0"
    : formatPrice(tier.monthly);
  const periodShort = isFree ? "" : showAnnual ? cardLabels.perYear : cardLabels.perMonth;

  return (
    <div className={`relative bg-[#1A1D24] rounded-xl ${tier.border} ${tier.glow} ${orderCls} p-6 sm:p-7 flex flex-col`}>
      {tier.badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tier.badge.bg} ${tier.badge.fg}`}
        >
          {tier.badge.label}
        </span>
      )}

      <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${tier.nameColor}`}>
        {tier.name}
      </p>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-head text-[36px] sm:text-[40px] font-black text-white leading-none">
          {priceDisplay}
        </span>
        {!isFree && (
          <span className="text-[14px] text-[#9CA3AF]">{periodShort}</span>
        )}
      </div>
      {isFree ? (
        <p className="text-[12px] text-[#9CA3AF] mt-2">{cardLabels.forever}</p>
      ) : (
        <div className="mt-2 space-y-0.5">
          <p className="text-[12px] text-[#c8c8cc]">
            {cardLabels.fromPrefix}<span className="font-bold text-white">{formatPrice(tier.annualMonthlyEq ?? tier.monthly)}{cardLabels.perMonth}</span>{cardLabels.fromSuffixAnnual}
          </p>
          <p className="text-[11px] text-[#6b7280]">
            {cardLabels.orPrefix}{formatPrice(tier.monthly)}{cardLabels.perMonth}{cardLabels.orSuffixMonthly}
          </p>
        </div>
      )}

      <div className="h-px bg-white/[0.06] my-5" />

      {tier.featuresHeader && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
          {tier.featuresHeader}
        </p>
      )}

      <ul className="space-y-2.5 flex-1">
        {tier.features.map((f, idx) => {
          if (f.kind === "section") {
            return (
              <li
                key={`sec-${idx}-${f.label}`}
                className="pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55"
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
              <span className={`text-[13px] leading-relaxed ${f.included ? "text-white/85" : "text-[#6b7280]"}`}>
                {f.label}
              </span>
            </li>
          );
        })}
      </ul>

      <Link
        href={tier.ctaHref}
        className={`mt-6 inline-flex items-center justify-center w-full h-11 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${tier.ctaClass}`}
      >
        {tier.ctaLabel}
      </Link>
    </div>
  );
}
