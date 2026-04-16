"use client";

import { useEffect } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Pour les coachs — public marketing landing page
   Own identity: no scrolling ticker, 4-step process, full-width
   reputation section, no ressources/guide.
═══════════════════════════════════════════════════════════════ */

const HOW_STEPS = [
  {
    n: "01",
    role: "Inscription",
    title: "Inscris-toi",
    body: "Crée ton compte en 2 minutes et associe-toi à ton école. C'est gratuit.",
  },
  {
    n: "02",
    role: "Vérification",
    title: "Vérifie tes athlètes",
    body: "Tes joueurs remplissent leur profil eux-mêmes. Tu confirmes leurs infos et tu ajoutes ton évaluation. Leur profil passe de visible à crédible.",
  },
  {
    n: "03",
    role: "Réputation",
    title: "Bâtis ta réputation",
    body: "Chaque vérification et chaque placement comptent. Tes badges Coach Élite et Placeur disent aux recruteurs que tu connais tes joueurs.",
  },
  {
    n: "04",
    role: "Contact",
    title: "Deviens le point de contact",
    body: "Selon les règles du RSEQ, les recruteurs CÉGEP communiquent d'abord avec l'entraîneur — pas directement avec l'athlète mineur. Sur Nexus, tu gères cette communication via la messagerie intégrée. Tu facilites le lien entre tes joueurs et les programmes CÉGEP, dans le respect des règles.",
  },
];

type TierKey = "FREE" | "PRO";
const FEATURES: { title: string; body: string; tier: TierKey }[] = [
  { title: "Compte entraîneur",      body: "Crée ton compte, associe-toi à ton école.",                                   tier: "FREE" },
  { title: "Gestion des athlètes",   body: "Crée et gère les profils. Ajout illimité.",                                    tier: "FREE" },
  { title: "Vérification",           body: "Vérifie les profils. Badge bleu = crédibilité.",                                tier: "FREE" },
  { title: "Évaluation simplifiée",  body: "Évalue sur les critères essentiels. Visible par les recruteurs.",               tier: "FREE" },
  { title: "Messagerie entrante",    body: "Reçois les messages des recruteurs intéressés par tes joueurs.",                tier: "FREE" },
  { title: "Notifications",          body: "Sois alerté quand un recruteur consulte un de tes athlètes.",                  tier: "FREE" },
  { title: "Mon école",              body: "Page complète de ton école — tous les sports, tous les athlètes, tous les coachs.", tier: "PRO" },
  { title: "Stats école",            body: "Vues, profils consultés, tendances par sport.",                                 tier: "PRO" },
  { title: "Placement",              body: "Suis tes athlètes — qui est recruté, par quel CÉGEP.",                          tier: "PRO" },
  { title: "Ma réputation",          body: "Tes badges, ton historique, ta crédibilité.",                                   tier: "PRO" },
  { title: "Analytics",              body: "Tendances, activité recruteurs, performance pipeline.",                         tier: "PRO" },
];

type PricingTier = {
  name: string;
  price: string;
  priceSuffix?: string;
  priceColor: string;
  subtitle: string;
  subheader?: string;
  bullets: string[];
  checkColor: string;
  highlighted?: boolean;
  badge?: string;
  note?: string;
  buttonVariant: "outline-red" | "filled-red" | "outline-amber";
};

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Gratuit",
    price: "0$",
    priceColor: "text-[#22C55E]",
    subtitle: "Pour commencer",
    bullets: [
      "Créer un compte et rejoindre une école",
      "Créer et gérer les profils athlètes",
      "Évaluations simplifiées (5 critères)",
      "Vérifier les profils (badge bleu)",
      "Recevoir les messages de recruteurs",
      "Notifications d'activité",
    ],
    checkColor: "text-[#22C55E] bg-[#22C55E]/15",
    buttonVariant: "outline-red",
  },
  {
    name: "Pro",
    price: "14,99$",
    priceSuffix: "/mois",
    priceColor: "text-white",
    subtitle: "ou 139$/an — économise 23%",
    subheader: "Tout ce qui est gratuit, plus :",
    bullets: [
      "Accès à Mon école (page complète de ton école)",
      "Stats école (vues, tendances, activité)",
      "Placement (suivi de tes athlètes recrutés)",
      "Ma réputation (badges et historique)",
      "Analytics avancé (tendances et performance)",
    ],
    checkColor: "text-[#E63946] bg-[#E63946]/15",
    highlighted: true,
    badge: "Populaire",
    buttonVariant: "filled-red",
  },
];

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-head text-[26px] sm:text-[30px] font-black text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

function TierPill({ tier }: { tier: TierKey }) {
  if (tier === "FREE") return <span className="inline-flex px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">Gratuit</span>;
  if (tier === "PRO")  return <span className="inline-flex px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[10px] font-bold uppercase tracking-wider">Pro · 14,99$/mois</span>;
  // "ALLSTAR" tier is retained in the FEATURES typing for backward compat but
  // coach has only 2 tiers — collapse any ALLSTAR pill to the Pro label.
  return <span className="inline-flex px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[10px] font-bold uppercase tracking-wider">Pro · 14,99$/mois</span>;
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
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
          filter: "blur(12px)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%" }}>{children}</div>
    </div>
  );
}

/* ── Messaging mockup (fake names) ──────────────────────────── */

function MessagesMockup() {
  const items = [
    { name: "Jean-François L.", org: "Collège André-Grasset",    preview: "Bonjour coach, j'aimerais discuter du profil d'Alexandre…", time: "2h", dot: "bg-[#E63946]", unread: true  },
    { name: "Caroline M.",      org: "CÉGEP de Sherbrooke",      preview: "Merci pour l'évaluation. On planifie une visite…",         time: "1j", dot: "bg-[#2563EB]", unread: false },
    { name: "Philippe D.",      org: "Campus Notre-Dame-de-Foy", preview: "Est-ce qu'Émilie serait disponible pour…",                   time: "3j", dot: "bg-white/20",  unread: false },
  ];
  return (
    <div className="bg-[#15171c] rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl">
      <div className="px-7 py-5 border-b border-white/[0.05] bg-[#1A1D24]">
        <p className="text-[12px] font-bold text-[#6b7280] uppercase tracking-[0.2em]">Messagerie</p>
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {items.map((m) => (
          <li key={m.name} className={`flex items-start gap-4 px-7 py-5 ${m.unread ? "bg-[#E63946]/[0.04]" : ""}`}>
            <span className={`shrink-0 mt-2 w-2.5 h-2.5 rounded-full ${m.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[16px] font-bold text-white truncate">
                  {m.name} <span className="text-[#6b7280] font-semibold">· {m.org}</span>
                </p>
                <span className="text-[13px] text-[#6b7280] shrink-0">{m.time}</span>
              </div>
              <p className="text-[15px] text-white/75 leading-snug mt-1.5 truncate">{m.preview}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Reputation badges (full-width horizontal) ──────────────── */

type ReputationBadge = {
  name: string;
  threshold: string;
  border: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
};

const REPUTATION_BADGES: ReputationBadge[] = [
  {
    name: "Évalué",
    threshold: "3 évaluations",
    border: "border-white/10",
    iconBg: "bg-white/5",
    iconColor: "text-[#9CA3AF]",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
    ),
  },
  {
    name: "Recommandé",
    threshold: "5 évaluations",
    border: "border-white/25",
    iconBg: "bg-white/10",
    iconColor: "text-white",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    name: "Coach Élite",
    threshold: "15 évaluations",
    border: "border-[#F59E0B]/40",
    iconBg: "bg-[#F59E0B]/15",
    iconColor: "text-[#F59E0B]",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 20h18L17 4l-5 8-3-5-6 13z" />
      </svg>
    ),
  },
  {
    name: "Placeur",
    threshold: "5 athlètes avec lettre signée",
    border: "border-[#E63946]/50",
    iconBg: "bg-[#E63946]/15",
    iconColor: "text-[#E63946]",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 4h10v3a5 5 0 01-5 5 5 5 0 01-5-5V4z" />
        <path d="M5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 13h4v3h-4z" />
        <path d="M8 19h8v2H8z" />
      </svg>
    ),
  },
];

const REPUTATION_STATS: { label: string; value: string }[] = [
  { label: "Temps de réponse moyen", value: "2h" },
  { label: "Athlètes placés",        value: "8"  },
  { label: "Profils complétés",      value: "87%" },
];

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function PourLesCoachsPage() {
  useEffect(() => {
    console.log("Coach page loaded");
  }, []);

  const progressVar = { "--bar-w": "80%" } as React.CSSProperties;

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO (centered, full-width mockup below) */}
        <section id="hero" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-28 text-center">
            <RedLabel>Pour les entraîneurs du secondaire</RedLabel>
            <h1 className="font-head text-[42px] sm:text-[48px] font-black leading-[1.05] tracking-tight mt-4">
              Tes joueurs méritent d&apos;être vus.<br />
              <span className="text-[#E63946]">Ta réputation aussi.</span>
            </h1>
            <p className="text-[18px] text-white/75 leading-relaxed mt-6 max-w-[640px] mx-auto">
              Vérifie tes athlètes, ajoute ton évaluation, et bâtis ta réputation comme entraîneur. Les recruteurs CÉGEP font confiance aux coachs qui connaissent leurs joueurs.
            </p>
            <p className="text-[15px] text-white/55 mt-4 max-w-[640px] mx-auto">
              Tes joueurs s&apos;inscrivent. Tu les vérifies. Tout le monde y gagne.
            </p>
            <div className="flex items-center justify-center gap-3 mt-9 flex-wrap">
              <Link
                href="/inscription"
                className="inline-flex items-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                style={{ fontSize: 16, padding: "14px 32px" }}
              >
                Sois le Nex
              </Link>
            </div>

            <div className="mt-16 max-w-[1200px] mx-auto">
              <GlowFrame>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Image/Coach%20Dashboard.png"
                  alt="Tableau de bord entraîneur — Mes athlètes"
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)" }}
                />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — COMMENT ÇA MARCHE (4 STEPS) ──────── */}
        <section id="comment-ca-marche" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>Comment ça marche</RedLabel>
              <SectionTitle>4 étapes. Un impact réel.</SectionTitle>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 mt-14">
              {HOW_STEPS.map((step, i) => (
                <div
                  key={step.n}
                  className={`relative pl-6 py-4 ${
                    i === 0 ? "border-l-[3px] border-[#E63946]/30" : "border-l-[3px] border-white/[0.04]"
                  }`}
                >
                  <span className="font-head text-[56px] sm:text-[64px] font-black leading-none text-white/[0.08] tracking-tighter block">
                    {step.n}
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#E63946] mt-5">
                    {step.role}
                  </p>
                  <h3 className="font-head text-[18px] font-black uppercase text-white tracking-tight mt-2.5">
                    {step.title}
                  </h3>
                  <p className="text-[14px] text-white/75 leading-relaxed mt-3">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 4 — TON ÉVALUATION (stacked) ─────────── */}
        <section id="evaluation" className="border-b border-white/[0.06]">
          <div className="max-w-[1300px] mx-auto px-6 py-20 text-center">
            <RedLabel>Ton évaluation</RedLabel>
            <SectionTitle>Ton évaluation, c&apos;est ce qui fait la différence.</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[600px] mx-auto">
              N&apos;importe quel athlète peut dire qu&apos;il est bon. Quand tu le vérifies et que tu l&apos;évalues sur 8 critères — leadership, discipline, coachabilité, intelligence de jeu, compétitivité, esprit d&apos;équipe, résilience, attitude — les recruteurs savent que c&apos;est vrai. Ton rapport est lu par chaque recruteur qui consulte le profil.
            </p>
            <Link href="/inscription" className="inline-flex items-center gap-1 mt-6 text-[13px] font-bold text-[#E63946] hover:text-[#FF5C58] transition-colors">
              Sois le Nex →
            </Link>
            <div className="mt-12 max-w-[1200px] mx-auto">
              <GlowFrame>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Image/Screenshot%202026-04-15%20164443.png"
                  alt="Profil athlète vérifié avec évaluation du coach"
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85)" }}
                />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 5 — MA RÉPUTATION (FULL WIDTH) ───────── */}
        <section id="reputation" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-24 text-center">
            <RedLabel>Ma réputation</RedLabel>
            <SectionTitle>Ta réputation te précède.</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[700px] mx-auto">
              Chaque vérification et chaque placement comptent. Quand un recruteur clique sur ton nom, il voit ta page de réputation — ton historique, tes évaluations, tes badges. C&apos;est ce qui te distingue.
            </p>

            {/* Badge row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-14">
              {REPUTATION_BADGES.map((b) => (
                <div
                  key={b.name}
                  className={`bg-[#1A1D24] rounded-2xl border ${b.border} p-6 text-left flex flex-col gap-3`}
                >
                  <div className={`w-11 h-11 rounded-xl ${b.iconBg} ${b.iconColor} flex items-center justify-center`}>
                    {b.icon}
                  </div>
                  <div>
                    <p className="font-head text-[15px] font-black uppercase tracking-wide text-white">
                      {b.name}
                    </p>
                    <p className="text-[11px] text-white/55 mt-1">{b.threshold}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Stat pills */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {REPUTATION_STATS.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-2 bg-[#1A1D24] border border-white/[0.06] rounded-full px-4 py-2 text-[12px]"
                >
                  <span className="text-white/55 uppercase tracking-wider font-bold text-[10px]">{s.label}</span>
                  <span className="font-head font-black text-white text-[13px] tabular-nums">{s.value}</span>
                </span>
              ))}
            </div>

            {/* Progress strip */}
            <div className="mt-8 max-w-[640px] mx-auto bg-[#1A1D24] border border-white/[0.06] rounded-xl p-5 text-left">
              <div className="flex items-center justify-between text-[12px] mb-2">
                <span className="text-white font-bold">Prochain badge — Coach Élite</span>
                <span className="text-[#F59E0B] font-bold tabular-nums">12 / 15</span>
              </div>
              <div className="h-2 rounded-full bg-[#2D3748] overflow-hidden">
                {/* eslint-disable-next-line react/forbid-dom-props -- width is dynamic */}
                <div className="h-full rounded-full bg-[#F59E0B] w-[var(--bar-w)]" style={progressVar} />
              </div>
              <p className="text-[11px] text-white/55 mt-2">Coach Élite dans 3 évaluations.</p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6 — MES ATHLÈTES (stacked) ───────────── */}
        <section id="mes-athletes" className="border-b border-white/[0.06]">
          <div className="max-w-[1300px] mx-auto px-6 py-20 text-center">
            <RedLabel>Mes athlètes</RedLabel>
            <SectionTitle>Tous tes joueurs. Un seul endroit.</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[600px] mx-auto">
              Vois d&apos;un coup d&apos;œil qui est vérifié, qui a un profil complet, qui est en processus de recrutement. Gère ton équipe sans tableur et sans papier.
            </p>
            <div className="mt-12 max-w-[1200px] mx-auto">
              <GlowFrame>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Image/Mes%20ath%20(2).png"
                  alt="Tableau de bord entraîneur — gestion des athlètes"
                  style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)" }}
                />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 7 — MESSAGERIE (stacked) ─────────────── */}
        <section id="messagerie" className="border-b border-white/[0.06]">
          <div className="max-w-[1300px] mx-auto px-6 py-20 text-center">
            <RedLabel>Messagerie</RedLabel>
            <SectionTitle>Tu es le premier point de contact.</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-5 max-w-[600px] mx-auto">
              Quand un recruteur s&apos;intéresse à un de tes joueurs, il te contacte via Nexus — pas le parent, pas l&apos;athlète. Tu contrôles la communication. Tu facilites le processus. C&apos;est ton rôle.
            </p>
            <div className="mt-12 max-w-[1200px] mx-auto">
              <GlowFrame>
                <MessagesMockup />
              </GlowFrame>
            </div>
          </div>
        </section>

        {/* ─── SECTION 8 — FONCTIONNALITÉS ──────────────────── */}
        <section id="fonctionnalites" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>Fonctionnalités</RedLabel>
              <SectionTitle>Tout ce qu&apos;il te faut pour gérer tes athlètes.</SectionTitle>
              <p className="text-[14px] text-white/75 leading-relaxed mt-4">
                Crée des profils et vérifie tes athlètes gratuitement. Débloque l&apos;intelligence avec Pro.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-8">
                  <div className="flex items-center justify-between mb-4">
                    <TierPill tier={f.tier} />
                  </div>
                  <h3 className="font-head text-[18px] font-black text-white">{f.title}</h3>
                  <p className="text-[14px] text-white/75 leading-relaxed mt-2">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 9 — PRIX (3-tier comparison) ─────────── */}
        <section id="prix" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>Prix</RedLabel>
              <SectionTitle>Un seul objectif — tes joueurs.</SectionTitle>
            </div>

            <div className="mt-14 mx-auto max-w-[1000px] flex flex-col md:flex-row items-stretch gap-4">
              {PRICING_TIERS.map((t) => {
                const btnClass =
                  t.buttonVariant === "filled-red"
                    ? "bg-[#E63946] text-white hover:bg-[#D42B22] border border-[#E63946]"
                    : t.buttonVariant === "outline-amber"
                    ? "border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10"
                    : "border border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10";
                return (
                  <div
                    key={t.name}
                    className={`relative flex-1 bg-[#1A1D24] rounded-xl flex flex-col min-h-[620px] p-8 ${
                      t.highlighted ? "border-2 border-[#E63946]" : "border border-white/[0.06]"
                    }`}
                  >
                    {t.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex px-3 py-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold uppercase tracking-wider">
                        {t.badge}
                      </span>
                    )}

                    {/* Header */}
                    <h3 className="text-[20px] font-bold text-white">{t.name}</h3>

                    {/* Price */}
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className={`font-head text-[36px] font-black leading-none ${t.priceColor}`}>
                        {t.price}
                      </span>
                      {t.priceSuffix && (
                        <span className="text-[16px] text-white/55 font-semibold">{t.priceSuffix}</span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/55 mt-2">{t.subtitle}</p>

                    {/* Divider */}
                    <div className="h-px bg-white/[0.06] my-6" />

                    {/* Feature list */}
                    <div className="flex-1">
                      {t.subheader && (
                        <p className="text-[13px] text-white/55 mb-3">{t.subheader}</p>
                      )}
                      <ul className="space-y-2">
                        {t.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3 text-[14px] text-white/85 leading-snug">
                            <span className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ${t.checkColor}`}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      {t.note && (
                        <p className="text-[12px] text-white/55 mt-4 italic leading-snug">
                          {t.note}
                        </p>
                      )}
                    </div>

                    {/* Button pinned to bottom */}
                    <Link
                      href="/inscription"
                      className={`mt-8 inline-flex items-center justify-center w-full rounded-lg font-bold uppercase tracking-wider text-[13px] py-3 px-5 transition-colors ${btnClass}`}
                    >
                      Sois le Nex
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 11 — FINAL CTA ───────────────────────── */}
        <section id="cta" className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[820px] mx-auto px-6 py-28 text-center">
            <span className="inline-block w-10 h-[2px] bg-[#E63946] mb-8" />

            <h2 className="font-head text-[40px] sm:text-[56px] font-black text-white leading-[1.05] tracking-tight">
              Prêt à faire la <span className="text-[#E63946]">différence</span> pour tes joueurs?
            </h2>

            <p className="text-[16px] sm:text-[17px] text-white/75 leading-relaxed mt-6 max-w-[560px] mx-auto">
              Inscris-toi gratuitement. Vérifie tes athlètes. Bâtis ta réputation.
            </p>

            <div className="mt-10">
              <Link
                href="/inscription"
                className="inline-flex items-center justify-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                style={{ fontSize: 16, padding: "16px 40px" }}
              >
                Sois le Nex
              </Link>
            </div>

            <div className="mt-6 flex items-center justify-center gap-5 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                100% gratuit
              </span>
              <span className="w-px h-3 bg-white/15" />
              <span>Inscription en 2 min</span>
            </div>

            <p className="text-[13px] text-white/55 mt-10">
              Pas de joueurs inscrits?{" "}
              <Link href="/pour-les-athletes" className="text-[#E63946] font-semibold hover:underline">
                Envoie-leur ce lien →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
