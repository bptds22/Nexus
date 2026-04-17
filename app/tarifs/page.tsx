"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

/* ═══════════════════════════════════════════════════════════════
   Tarifs — Unified pricing (Recruteur / Coach / Athlète)
═══════════════════════════════════════════════════════════════ */

type Persona = "recruteur" | "coach" | "athlete";
type Billing = "monthly" | "annual";

type FeatureRow =
  | { kind: "item"; label: string; included: boolean }
  | { kind: "section"; label: string };

interface Tier {
  id: string;
  name: string;
  nameColor: string;
  monthly: number;
  annual: number;
  annualMonthlyEq: number | null;
  border: string;
  glow: string;
  badge: { label: string; bg: string; fg: string } | null;
  featuresHeader?: string;
  features: FeatureRow[];
  ctaLabel: string;
  ctaClass: string;
  ctaHref: string;
}

/* ── RECRUITER ──────────────────────────────────────────────── */

const RECRUITER_TIERS: Tier[] = [
  {
    id: "rec_free",
    name: "Gratuit",
    nameColor: "text-[#9CA3AF]",
    monthly: 0,
    annual: 0,
    annualMonthlyEq: null,
    border: "border border-white/10",
    glow: "",
    badge: null,
    features: [
      { kind: "item", label: "Recherche par sport, région, année, école, position", included: true },
      { kind: "item", label: "Étoiles, cote globale, badge vérifié", included: true },
      { kind: "item", label: "École, sport, promotion, moyenne", included: true },
      { kind: "item", label: "Taille / poids", included: true },
      { kind: "item", label: "Évaluations simplifiées (3 groupes)", included: true },
      { kind: "item", label: "10 résultats par recherche", included: true },
      { kind: "item", label: "10 favoris max", included: true },
      { kind: "item", label: "Filtres avancés", included: false },
      { kind: "item", label: "Identité de l'athlète (nom, photo, jersey)", included: false },
      { kind: "item", label: "Vidéos et parcours académique", included: false },
      { kind: "item", label: "Messagerie coach", included: false },
      { kind: "item", label: "Pipeline de recrutement", included: false },
    ],
    ctaLabel: "Commencer gratuitement →",
    ctaClass: "border border-white/30 text-white hover:bg-white/5",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
  {
    id: "rec_pro",
    name: "Pro",
    nameColor: "text-[#F59E0B]",
    monthly: 15.99,
    annual: 149,
    annualMonthlyEq: 12.42,
    border: "border-2 border-[#F59E0B]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    badge: { label: "Populaire", bg: "bg-[#F59E0B]", fg: "text-black" },
    featuresHeader: "Tout du plan Gratuit, plus :",
    features: [
      { kind: "item", label: "Filtres avancés (taille, poids, cote globale)", included: true },
      { kind: "item", label: "Résultats de recherche illimités", included: true },
      { kind: "item", label: "Nom, photo, numéro de jersey révélés", included: true },
      { kind: "item", label: "Vidéos faits saillants", included: true },
      { kind: "item", label: "Commentaires du coach", included: true },
      { kind: "item", label: "Parcours académique complet", included: true },
      { kind: "item", label: "Coordonnées du coach (email, tel)", included: true },
      { kind: "item", label: "Messagerie coach (10/mois)", included: true },
      { kind: "item", label: "Auto-intro / templates", included: true },
      { kind: "item", label: "Favoris illimités", included: true },
      { kind: "item", label: "Pipeline de recrutement (50 athlètes)", included: true },
      { kind: "item", label: "Activity feed (18 événements)", included: true },
      { kind: "item", label: "Coach reviews — lire et rédiger", included: true },
    ],
    ctaLabel: "Passer à Pro →",
    ctaClass: "bg-[#F59E0B] text-black hover:bg-[#FBBF24]",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
  {
    id: "rec_allstar",
    name: "All Star",
    nameColor: "text-[#E63946]",
    monthly: 29.99,
    annual: 269,
    annualMonthlyEq: 22.42,
    border: "border-2 border-[#E63946]",
    glow: "shadow-[0_0_24px_rgba(230,57,70,0.1)]",
    badge: null,
    featuresHeader: "Tout du plan Pro, plus :",
    features: [
      { kind: "item", label: "Évaluations détaillées (11 critères)", included: true },
      { kind: "item", label: "Statut de recrutement global", included: true },
      { kind: "item", label: "Voir qui a consulté l'athlète", included: true },
      { kind: "item", label: "Messagerie illimitée", included: true },
      { kind: "item", label: "Pipeline illimité", included: true },
      { kind: "item", label: "Pipeline analytics (conversion, temps par statut)", included: true },
      { kind: "item", label: "Listes de prospects custom", included: true },
      { kind: "item", label: "Taux de réponse coaches", included: true },
      { kind: "item", label: "Signaux de compétition", included: true },
      { kind: "item", label: "Gestion CÉGEP", included: true },
    ],
    ctaLabel: "Devenir All Star →",
    ctaClass: "bg-[#E63946] text-white hover:bg-[#D42B22]",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
];

/* ── COACH ──────────────────────────────────────────────────── */

const COACH_TIERS: Tier[] = [
  {
    id: "coach_free",
    name: "Gratuit",
    nameColor: "text-[#9CA3AF]",
    monthly: 0,
    annual: 0,
    annualMonthlyEq: null,
    border: "border border-white/10",
    glow: "",
    badge: null,
    features: [
      { kind: "item", label: "Créer profils athlètes", included: true },
      { kind: "item", label: "Évaluations simplifiées et détaillées", included: true },
      { kind: "item", label: "Vérifier les athlètes", included: true },
      { kind: "item", label: "Recevoir messages des recruteurs", included: true },
      { kind: "item", label: "Rejoindre une école", included: true },
      { kind: "item", label: "Mon école (dashboard)", included: false },
      { kind: "item", label: "Stats école", included: false },
      { kind: "item", label: "Placement", included: false },
      { kind: "item", label: "Ma réputation", included: false },
      { kind: "item", label: "Analytics", included: false },
    ],
    ctaLabel: "Commencer gratuitement →",
    ctaClass: "border border-white/30 text-white hover:bg-white/5",
    ctaHref: "/inscription?role=COACH",
  },
  {
    id: "coach-pro",
    name: "Pro",
    nameColor: "text-[#F59E0B]",
    monthly: 14.99,
    annual: 139,
    annualMonthlyEq: 11.58,
    border: "border-2 border-[#F59E0B]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    badge: { label: "Populaire", bg: "bg-[#F59E0B]", fg: "text-black" },
    featuresHeader: "Tout du plan Gratuit, plus :",
    features: [
      { kind: "item", label: "Mon école — dashboard de l'école", included: true },
      { kind: "item", label: "Stats école — vues, placements, activité", included: true },
      { kind: "item", label: "Placement — suivi des placements en CÉGEP", included: true },
      { kind: "item", label: "Ma réputation — score, avis recruteurs, badges", included: true },
      { kind: "item", label: "Analytics — tendances, recruteurs actifs", included: true },
      { kind: "item", label: "Voir quels recruteurs regardent tes athlètes", included: true },
      { kind: "item", label: "Notifications d'intérêt recruteur", included: true },
      { kind: "item", label: "Multi-équipe (gérer plusieurs sports)", included: true },
    ],
    ctaLabel: "Passer à Pro →",
    ctaClass: "bg-[#F59E0B] text-black hover:bg-[#FBBF24]",
    ctaHref: "/inscription?role=COACH",
  },
];

/* ── ATHLETE ────────────────────────────────────────────────── */

const ATHLETE_TIERS: Tier[] = [
  {
    id: "ath_free",
    name: "Gratuit",
    nameColor: "text-[#9CA3AF]",
    monthly: 0,
    annual: 0,
    annualMonthlyEq: null,
    border: "border border-white/10",
    glow: "",
    badge: null,
    features: [
      { kind: "section", label: "Mon profil" },
      { kind: "item", label: "Créer et gérer mon profil complet", included: true },
      { kind: "item", label: "Photo, bio, parcours académique", included: true },
      { kind: "item", label: "Vidéos faits saillants + match complet", included: true },
      { kind: "item", label: "Stats et mesures physiques", included: true },
      { kind: "item", label: "Badge vérifié par le coach", included: true },
      { kind: "item", label: "Cote globale visible aux recruteurs", included: true },
      { kind: "section", label: "Ma visibilité" },
      { kind: "item", label: "Nombre de vues ce mois / total", included: true },
      { kind: "item", label: "Nombre de recruteurs en favori", included: true },
      { kind: "item", label: "Graphique de vues par semaine", included: true },
      { kind: "item", label: "D'où viennent les recruteurs (régions)", included: true },
      { kind: "item", label: "Nom des recruteurs qui consultent", included: false },
      { kind: "item", label: "Nom des CÉGEPs qui regardent", included: false },
      { kind: "item", label: "Quels recruteurs t'ont mis en favori", included: false },
      { kind: "section", label: "Outils" },
      { kind: "item", label: "Consentement parental numérique", included: true },
      { kind: "item", label: "Statut de recrutement", included: true },
      { kind: "item", label: "Confirmation d'engagement", included: true },
    ],
    ctaLabel: "Créer mon profil gratuitement →",
    ctaClass: "border border-white/30 text-white hover:bg-white/5",
    ctaHref: "/inscription?role=ATHLETE",
  },
  {
    id: "ath_pro",
    name: "Pro",
    nameColor: "text-[#F59E0B]",
    monthly: 4.99,
    annual: 49,
    annualMonthlyEq: 4.08,
    border: "border-2 border-[#F59E0B]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    badge: { label: "Recommandé", bg: "bg-[#F59E0B]", fg: "text-black" },
    featuresHeader: "Tout du plan Gratuit, plus :",
    features: [
      { kind: "item", label: "Voir le nom des recruteurs qui consultent ton profil", included: true },
      { kind: "item", label: "Voir quels CÉGEPs s'intéressent à toi", included: true },
      { kind: "item", label: "Savoir quels recruteurs t'ont ajouté en favori (nom + CÉGEP)", included: true },
      { kind: "item", label: "Classement détaillé des vues par CÉGEP", included: true },
      { kind: "item", label: "Notifications d'intérêt avec noms", included: true },
    ],
    ctaLabel: "Passer à Pro →",
    ctaClass: "bg-[#F59E0B] text-black hover:bg-[#FBBF24]",
    ctaHref: "/inscription?role=ATHLETE",
  },
];

/* ── Savings shown in toggle label per persona (Pro-tier representative) ─ */
const PERSONA_SAVINGS: Record<Persona, number> = {
  recruteur: 22,
  coach: 23,
  athlete: 18,
};

/* ── Helpers ────────────────────────────────────────────────── */

function formatPrice(n: number): string {
  if (n === 0) return "0$";
  const s = n.toString().replace(".", ",");
  return `${s}$`;
}

function isValidPersona(v: string | null): v is Persona {
  return v === "recruteur" || v === "coach" || v === "athlete";
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function TarifsPage() {
  const [persona, setPersona] = useState<Persona>("recruteur");
  const [billing, setBilling] = useState<Billing>("monthly");

  useEffect(() => {
    console.log("[Tarifs] Page rendered");
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
    console.log("[Tarifs] Active persona:", persona);
  }, [persona]);

  useEffect(() => {
    console.log("[Tarifs] Billing toggle:", billing);
  }, [billing]);

  const tiers =
    persona === "recruteur" ? RECRUITER_TIERS : persona === "coach" ? COACH_TIERS : ATHLETE_TIERS;
  const savingsPct = PERSONA_SAVINGS[persona];

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      {/* ─── SECTION 1 — HEADER ───────────────────────────── */}
      <section>
        <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-10 text-center">
          <p className="text-[12px] sm:text-[13px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
            Tarifs
          </p>
          <h1 className="font-head text-[40px] sm:text-[48px] font-black text-white uppercase leading-[1.05] tracking-tight mt-4">
            Choisis ton plan
          </h1>
          <p className="text-[15px] sm:text-[16px] text-[#9CA3AF] leading-relaxed mt-5 max-w-[600px] mx-auto">
            Commence gratuitement. Passe à Pro quand tu es prêt.
          </p>
        </div>
      </section>

      {/* ─── SECTION 2 — PERSONA TOGGLE ───────────────────── */}
      <section>
        <div className="max-w-[1200px] mx-auto px-6 flex justify-center">
          <div className="inline-flex items-center gap-1 bg-[#1A1D24] rounded-full p-1.5 border border-white/[0.06]">
            {([
              { key: "recruteur", label: "Recruteur" },
              { key: "coach", label: "Coach" },
              { key: "athlete", label: "Athlète" },
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
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                billing === "annual" ? "bg-[#2A2D34] text-white" : "text-[#9CA3AF] hover:text-white"
              }`}
            >
              Annuel <span className="text-[10px] font-normal ml-1 opacity-80">(économise {savingsPct}%)</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4 — PRICING CARDS ────────────────────── */}
      <section>
        <div className="max-w-[1200px] mx-auto px-6 pt-10 pb-12">
          {tiers.length === 2 ? (
            /* 2 tiers (Coach or Athlète) — centered */
            <div className="max-w-[820px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              <PricingCard tier={tiers[1]} billing={billing} orderCls="order-1 md:order-2" />
              <PricingCard tier={tiers[0]} billing={billing} orderCls="order-2 md:order-1" />
            </div>
          ) : (
            /* 3 tiers (Recruteur) */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              <PricingCard tier={tiers[1]} billing={billing} orderCls="order-1 md:order-2" />
              <PricingCard tier={tiers[0]} billing={billing} orderCls="order-2 md:order-1" />
              <PricingCard tier={tiers[2]} billing={billing} orderCls="order-3 md:order-3" />
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
                <h3 className="text-[16px] font-semibold text-white">Forfait CÉGEP — plusieurs recruteurs?</h3>
                <p className="text-[14px] text-[#9CA3AF] mt-1.5 leading-relaxed">
                  Votre programme a plus d&apos;un recruteur? Contactez l&apos;équipe Nexus pour un forfait organisationnel adapté à votre CÉGEP avec tarification de groupe et gestion centralisée.
                </p>
              </div>
              <Link
                href="/contact"
                className="shrink-0 inline-flex items-center h-11 px-5 rounded-lg border border-[#E63946] text-[#E63946] text-[12px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
              >
                Contacter l&apos;équipe Nexus →
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
              Pourquoi Pro?
            </p>
            <h2 className="font-head text-[28px] sm:text-[34px] font-black text-white uppercase leading-tight tracking-tight mt-3">
              Tu sais que tu es regardé. Maintenant, sache par qui.
            </h2>
            <p className="text-[15px] text-[#9CA3AF] leading-relaxed mt-5 max-w-[640px] mx-auto">
              Chaque mois, ton profil est consulté par des recruteurs de partout au Québec. Avec Pro, tu vois leurs noms, leurs CÉGEPs, et combien de fois ils reviennent.
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
              Hébergé au Québec
            </span>
            <span className="hidden sm:inline text-[#475569]">·</span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} strokeWidth={2} className="text-[#9CA3AF]" />
              Conforme Loi 25
            </span>
            <span className="hidden sm:inline text-[#475569]">·</span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck size={16} strokeWidth={2} className="text-[#9CA3AF]" />
              Profils vérifiés
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
}: {
  tier: Tier;
  billing: Billing;
  orderCls: string;
}) {
  const showAnnual = billing === "annual" && tier.annual > 0;
  const priceDisplay = showAnnual
    ? `${tier.annual}$`
    : tier.monthly === 0
    ? "0$"
    : formatPrice(tier.monthly);
  const periodShort =
    tier.monthly === 0 ? "" : showAnnual ? "/an" : "/mois";
  const periodNote =
    tier.monthly === 0
      ? "pour toujours"
      : showAnnual && tier.annualMonthlyEq != null
      ? `soit ${formatPrice(tier.annualMonthlyEq)}/mois`
      : "facturé mensuellement";

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
        {tier.monthly > 0 && (
          <span className="text-[14px] text-[#9CA3AF]">{periodShort}</span>
        )}
      </div>
      <p className="text-[12px] text-[#9CA3AF] mt-2">{periodNote}</p>

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
