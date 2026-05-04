"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Play,
  Search,
  UserCircle2,
  LayoutGrid,
  CheckCircle2,
  BadgeCheck,
  Check,
  X as XIcon,
  Heart,
  Eye,
  Zap,
  ChevronDown,
  Star,
  Shield,
  Award,
  User,
} from "lucide-react";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Pour les recruteurs — B2B landing page
   Identity: Stripe/Linear-style SaaS, outcome-driven, vouvoiement.
   Distinct from athlete (emotional) and coach (reputation) pages.

   TODO (copy review — flagged, not rewritten):
   - "drag-and-drop" (All Star tier) — anglicism, could be "glisser-déposer".
   - "Besoins de roster publiables (Roster Needs)" — English parenthetical
     is redundant; consider dropping "(Roster Needs)" or "Besoins en effectif".
   - FAQ Q4 "voir qui je scoute" — "scouter/scoute" is an anglicism;
     consider "qui je suis" or "sur qui j'ai l'œil".
   - "Kanban" kept as-is — standard international term in project management.
═══════════════════════════════════════════════════════════════ */

/* ── Data ───────────────────────────────────────────────────── */

const STATS = [
  { value: "70+ CÉGEPs", desc: "membres du RSEQ couverts" },
  { value: "16 sports", desc: "supportés par Nexus" },
  { value: "ROI", desc: "plus de signatures, moins de temps perdu" },
  { value: "Loi 25", desc: "hébergement au Québec" },
];

const PAIN_POINTS = [
  "Vous ne voyez que les athlètes de votre réseau de coachs",
  "Vos conversations sont dispersées — courriel, texto, Facebook, téléphone",
  "Aucune façon de savoir quels athlètes intéressent la concurrence",
  "Suivi des prospects dans un tableur Excel — ou simplement de mémoire",
  "Impossible d'évaluer un athlète du Saguenay depuis Montréal sans y passer la journée",
  "Les infos des athlètes varient selon le coach — stats, vidéos, évaluations",
];

const SOLUTIONS = [
  "Base de données de tous les athlètes vérifiés du Québec, filtrable en 10 secondes",
  "Messagerie intégrée par athlète — historique complet, zéro message perdu",
  "Visibilité complète sur le processus de chaque athlète — combien de recruteurs le suivent, quels CÉGEPs sont déjà en discussion, et à quelle étape chacun en est",
  "Gérez votre processus de recrutement pour chaque athlète — du moment où vous le repérez jusqu'à sa signature de lettre d'engagement",
  "Évaluez les athlètes de partout au Québec depuis votre bureau — peu importe l'heure, peu importe la région",
  "Chaque profil a la même structure, les mêmes critères, le même standard",
];

type PillarColor = "red" | "blue" | "amber" | "blueCheck";
const PILLARS: {
  icon: React.ReactNode;
  color: PillarColor;
  title: string;
  body: string;
}[] = [
  {
    icon: <Search size={22} strokeWidth={2.2} />,
    color: "red",
    title: "Recherche avancée",
    body: "Filtrez les athlètes par sport, position, région, année de diplomation, vérification, distinctions, et présence vidéo. Trouvez un QB de Sec. 5 en Mauricie en 10 secondes.",
  },
  {
    icon: <UserCircle2 size={22} strokeWidth={2.2} />,
    color: "blue",
    title: "Profils 30 secondes",
    body: "Chaque athlète a la même structure — physique, stats saison, vidéo, académique, évaluation coach. Décidez en 30 secondes si vous voulez contacter le coach.",
  },
  {
    icon: <LayoutGrid size={22} strokeWidth={2.2} />,
    color: "amber",
    title: "Suivi visuel",
    body: "Tableau Kanban: Découvert → Contacté → Visite → Lettre signée. Voyez votre entonnoir de recrutement d'un coup d'œil. Aucun prospect oublié.",
  },
  {
    icon: <BadgeCheck size={40} strokeWidth={2} />,
    color: "blueCheck",
    title: "Check bleu",
    body: "Chaque profil doit être validé par un entraîneur du secondaire. Le coach met sa réputation en jeu pour confirmer les informations — identité, stats, position, école. Ce qui signifie que tout ce que vous voyez a été vérifié par un adulte nommé et responsable.",
  },
];

const PILLAR_STYLES: Record<
  PillarColor,
  { bg: string; fg: string }
> = {
  red: { bg: "bg-[#E63946]/15", fg: "text-[#E63946]" },
  blue: { bg: "bg-[#3B82F6]/15", fg: "text-[#3B82F6]" },
  amber: { bg: "bg-[#F59E0B]/15", fg: "text-[#F59E0B]" },
  blueCheck: { bg: "bg-[#2563EB]/15", fg: "text-[#2563EB]" },
};

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
  buttonLabel: string;
  buttonHref: string;
  buttonVariant: "outline-red" | "filled-red" | "outline-amber";
  borderClass: string;
};

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Gratuit",
    price: "$0",
    priceColor: "text-[#22C55E]",
    subtitle: "Pour explorer la plateforme",
    bullets: [
      "Recherche d'athlètes (filtres de base)",
      "Profils complets des athlètes vérifiés",
      "5 messages/mois vers les coachs",
      "Favoris (max 25 athlètes)",
    ],
    checkColor: "text-[#22C55E] bg-[#22C55E]/15",
    buttonLabel: "Créer un compte",
    buttonHref: "/inscription",
    buttonVariant: "outline-red",
    borderClass: "border border-white/[0.06]",
  },
  {
    name: "Pro",
    price: "$19.99",
    priceSuffix: "/mois",
    priceColor: "text-white",
    subtitle: "Pour les recruteurs actifs",
    subheader: "Tout ce qui est gratuit, plus :",
    bullets: [
      "Recherche avancée (tous les filtres, badges, vidéo)",
      "Messages illimités aux coachs",
      "Favoris illimités + listes nommées",
      "Tableau de bord recruteur complet",
      "Notifications temps réel",
      "Historique des vues par athlète",
    ],
    checkColor: "text-[#E63946] bg-[#E63946]/15",
    highlighted: true,
    badge: "Populaire",
    buttonLabel: "Choisir Pro",
    buttonHref: "/inscription",
    buttonVariant: "filled-red",
    borderClass: "border-2 border-[#E63946]",
  },
  {
    name: "All Star",
    price: "$29.99",
    priceSuffix: "/mois",
    priceColor: "text-white",
    subtitle: "Pour les programmes compétitifs",
    subheader: "Tout ce qui est Pro, plus :",
    bullets: [
      "Tableau Kanban avec drag-and-drop",
      "Besoins de roster publiables (Roster Needs)",
      "Analytique de recrutement (conversion, temps moyen, etc.)",
      "Export CSV/Excel pour intégration CRM",
      "Multi-utilisateurs (entraîneur-chef + adjoints)",
      "Support prioritaire",
    ],
    checkColor: "text-[#F59E0B] bg-[#F59E0B]/15",
    buttonLabel: "Choisir All Star",
    buttonHref: "/inscription",
    buttonVariant: "outline-amber",
    borderClass: "border border-[#F59E0B]/40",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Comment Nexus respecte-t-elle la Loi 25?",
    a: "Toutes les données sont hébergées au Québec (OVHcloud Beauharnois). Le consentement parental est documenté pour chaque athlète mineur avant la mise en ligne du profil. Les recruteurs signent une entente de confidentialité à l'inscription. Le droit à l'effacement et à la portabilité est respecté selon les délais légaux.",
  },
  {
    q: "Comment Nexus respecte-t-elle le calendrier RSEQ?",
    a: "Nexus ne s'insère pas dans le processus de recrutement officiel du RSEQ — c'est votre responsabilité de connaître et respecter les périodes de recrutement de votre sport. Ce que Nexus fait : la communication avec un athlète mineur passe obligatoirement par son entraîneur du secondaire, conforme à l'esprit des règles RSEQ. L'entraîneur décide quand et comment impliquer l'athlète. Vous restez maître de votre démarche; Nexus ne vous bloque ni ne vous dicte quoi que ce soit côté calendrier.",
  },
  {
    q: "Est-ce que je peux contacter directement un athlète?",
    a: "Non. Pour les athlètes mineurs, toutes les communications passent par leur entraîneur du secondaire. C'est la règle RSEQ et c'est aussi une protection pour vous — l'entraîneur sert de filtre et de contexte. Vous évitez les malentendus et les situations inconfortables.",
  },
  {
    q: "Mes concurrents CÉGEP peuvent-ils voir qui je scoute?",
    a: "Par défaut, les coachs voient quels CÉGEPs ont consulté leurs athlètes (pour créer un signal d'intérêt utile). Vos concurrents directs ne voient PAS vos listes de favoris — seulement les coachs des athlètes concernés. Vous pouvez ajuster votre visibilité dans les paramètres.",
  },
  {
    q: "Comment Nexus différencie-t-elle un vrai recruteur d'un imposteur?",
    a: "Chaque recruteur doit compléter son profil avec son CÉGEP, son sport, sa division et son rôle. L'équipe Nexus est notifiée de chaque nouvelle inscription et valide l'affiliation déclarée. Les coachs du secondaire voient l'identité complète du recruteur — son nom, son CÉGEP, son sport — avant de répondre à tout message. En cas de profil suspect, l'équipe Nexus peut désactiver un compte à tout moment.",
  },
  {
    q: "Est-ce qu'il faut un engagement annuel?",
    a: "Les abonnements mensuels sont flexibles et peuvent être annulés en tout temps. Les abonnements annuels offrent une économie significative (~20-40% selon le tier) pour les recruteurs engagés sur la saison. Aucune pénalité d'annulation sur un plan mensuel.",
  },
];

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] sm:text-[14px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[26px] sm:text-[32px] font-black text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

/* ── FAQ accordion item ─────────────────────────────────────── */

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#1A1D24] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open ? "true" : "false"}
      >
        <span className="text-[15px] sm:text-[16px] font-bold text-white leading-snug">
          {q}
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-white/55 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 text-[14px] text-white/75 leading-relaxed border-t border-white/[0.04]">
          <p className="pt-5">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function PourLesRecruteursPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    console.log("Recruiter landing page loaded");
  }, []);

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO (two-column, video right) ───── */}
        <section id="hero" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — copy */}
              <div>
                <RedLabel>Pour les recruteurs CÉGEP</RedLabel>
                <h1 className="nx-display text-[38px] sm:text-[44px] lg:text-[48px] font-black leading-[1.05] tracking-tight mt-4">
                  Trouvez les athlètes<br />
                  que votre réseau<br />
                  <span className="text-[#E63946]">ne verra jamais.</span>
                </h1>
                <p className="text-[17px] sm:text-[18px] text-white/75 leading-relaxed mt-6">
                  Nexus donne aux recruteurs CÉGEP accès à tous les athlètes vérifiés du Québec — filtrés par sport, position, région, et année de diplomation. Peu importe l&apos;école. Peu importe le réseau.
                </p>
                <p className="text-[14px] sm:text-[15px] text-white/55 mt-4">
                  Plateforme 100% québécoise. Conforme Loi 25. Hébergée au Québec.
                </p>
                <div className="mt-8">
                  <a
                    href="#demo-video"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors text-[14px] px-7 py-[13px]"
                  >
                    <Play size={14} strokeWidth={2.5} fill="currentColor" />
                    Voir la plateforme en action
                  </a>
                  <p className="text-[13px] text-white/55 mt-3">
                    Découvrez Nexus en 2 minutes 30.
                  </p>
                </div>
              </div>

              {/* Right — video placeholder */}
              <div id="demo-video">
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="group relative block w-full aspect-video bg-[#0d0f12] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl hover:border-[#E63946]/40 transition-colors"
                  aria-label="Lancer la vidéo de démo"
                >
                  {/* Gradient overlay */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-[#E63946]/10 via-transparent to-[#3B82F6]/5"
                  />
                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E63946] shadow-[0_0_40px_rgba(230,57,70,0.5)] group-hover:scale-110 transition-transform">
                      <Play size={32} strokeWidth={2.5} className="text-white ml-1" fill="currentColor" />
                    </span>
                  </div>
                  {/* Top-left duration badge */}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E63946]" />
                      Démo · 2 min 30
                    </span>
                  </div>
                </button>
                <p className="mt-4 text-[14px] text-white/55 text-center">
                  Comment un recruteur CÉGEP utilise Nexus au quotidien
                </p>
                {videoOpen && (
                  <p className="mt-2 text-[12px] text-[#E63946] text-center">
                    La vidéo sera disponible sous peu.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 2 — STATS BAR (static 4-col grid) ────── */}
        <section id="stats" className="bg-[#0d0f12] border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-14">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0">
              {STATS.map((s, i) => (
                <div
                  key={s.value}
                  className={`text-center lg:px-6 ${
                    i > 0 ? "lg:border-l lg:border-white/[0.08]" : ""
                  }`}
                >
                  <p className="nx-display text-[28px] sm:text-[36px] font-black text-white leading-none tracking-tight">
                    {s.value}
                  </p>
                  <p className="text-[12px] sm:text-[13px] text-white/55 mt-3 leading-snug">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — PAIN / SOLUTION ──────────────────── */}
        <section id="probleme" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[780px]">
              <RedLabel>Le problème</RedLabel>
              <SectionTitle>
                Le recrutement CÉGEP roule sur 10-15 contacts personnels.
              </SectionTitle>
              <p className="text-[15px] sm:text-[16px] text-white/75 leading-relaxed mt-5">
                Vous connaissez les entraîneurs-chefs des grosses écoles de votre région. Vous assistez à leurs gros matchs. Vous appelez les mêmes numéros chaque année. Ce système fonctionne — mais il vous rend invisible aux talents hors de votre cercle.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-14">
              {/* Sans Nexus */}
              <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/55">
                  Le statu quo
                </p>
                <h3 className="nx-display text-[20px] font-black text-white/85 mt-2">
                  Sans Nexus
                </h3>
                <ul className="space-y-3.5 mt-6">
                  {PAIN_POINTS.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[14px] text-white/70 leading-snug">
                      <span className="shrink-0 mt-0.5 w-[20px] h-[20px] rounded-full bg-white/5 text-white/40 flex items-center justify-center">
                        <XIcon size={13} strokeWidth={2.5} />
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Avec Nexus */}
              <div className="bg-[#1A1D24] border-2 border-[#E63946]/40 rounded-2xl p-7 relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#E63946]">
                  Le recrutement réinventé
                </p>
                <h3 className="nx-display text-[20px] font-black text-white mt-2">
                  Avec <span className="text-[#E63946]">Nexus</span>
                </h3>
                <ul className="space-y-3.5 mt-6">
                  {SOLUTIONS.map((s) => (
                    <li key={s} className="flex items-start gap-3 text-[14px] text-white/85 leading-snug">
                      <span className="shrink-0 mt-0.5 w-[20px] h-[20px] rounded-full bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center">
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4 — 4 CORE PILLARS ───────────────────── */}
        <section id="pilliers" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="max-w-[700px]">
              <RedLabel>Ce que vous pouvez faire</RedLabel>
              <SectionTitle>
                Tout ce qu&apos;il faut pour recruter efficacement.
              </SectionTitle>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
              {PILLARS.map((p) => {
                const s = PILLAR_STYLES[p.color];
                const boxSize = p.color === "blueCheck" ? "w-14 h-14" : "w-11 h-11";
                return (
                  <div
                    key={p.title}
                    className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-8"
                  >
                    <div className={`${boxSize} rounded-xl flex items-center justify-center ${s.bg} ${s.fg}`}>
                      {p.icon}
                    </div>
                    <h3 className="nx-display text-[20px] font-black text-white tracking-tight mt-5">
                      {p.title}
                    </h3>
                    <p className="text-[14px] text-white/75 leading-relaxed mt-3">
                      {p.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 5 — VERIFICATION / BLUE CHECK ────────── */}
        <section id="verification" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12 items-center">
              {/* Text left (2/5) */}
              <div className="lg:col-span-2">
                <RedLabel>Le badge de vérification</RedLabel>
                <SectionTitle>
                  Chaque profil vérifié est appuyé par un coach nommé.
                </SectionTitle>
                <div className="space-y-4 mt-6 text-[14px] sm:text-[15px] text-white/75 leading-relaxed">
                  <p>
                    Sur Nexus, un athlète avec un badge de vérification n&apos;est pas juste un profil en ligne. C&apos;est un athlète dont un entraîneur du secondaire a révisé chaque champ — identité, stats, école, position — et a mis sa propre réputation en jeu pour confirmer que tout est vrai.
                  </p>
                  <p>
                    La vérification est mensuelle. Les athlètes inactifs ou dont les infos ne sont plus à jour perdent leur badge de vérification. Vous n&apos;évaluez jamais un profil zombie.
                  </p>
                  <p>
                    Quand vous voyez un badge de vérification, vous voyez la crédibilité du coach transférée à l&apos;athlète. C&apos;est du temps économisé et du risque réduit.
                  </p>
                </div>
              </div>

              {/* Mockup right (3/5) */}
              <div className="lg:col-span-3">
                <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-7 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 px-3 py-1.5">
                      <CheckCircle2 size={14} className="text-[#3B82F6]" strokeWidth={2.5} />
                      <span className="text-[12px] font-bold uppercase tracking-wider text-[#3B82F6]">
                        Vérifié
                      </span>
                    </span>
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} size={16} fill="#F59E0B" className="text-[#F59E0B]" />
                      ))}
                      <span className="ml-2 text-[13px] font-bold text-white tabular-nums">5.0</span>
                    </div>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/45 mt-6">
                    Vérifié par
                  </p>
                  <p className="text-[16px] font-bold text-white mt-1.5">
                    Coach Pelletier · <span className="text-white/70 font-semibold">É.S. De Mortagne</span>
                  </p>

                  <blockquote className="mt-5 pl-4 border-l-2 border-[#E63946] text-[14px] italic text-white/85 leading-relaxed">
                    « Joueur complet, très intelligent au jeu. Lit les défenses avant le snap. Leader naturel dans le vestiaire. Prêt pour le niveau CÉGEP division 1. »
                  </blockquote>

                  <div className="flex flex-wrap gap-2 mt-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      <Shield size={11} strokeWidth={2.5} />
                      Capitaine
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      <Star size={11} strokeWidth={2.5} />
                      Équipe d&apos;étoiles
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      <Award size={11} strokeWidth={2.5} />
                      Leader
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6 — COACH RELIABILITY ────────────────── */}
        <section id="fiabilite" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            {/* Header + intro */}
            <div className="text-center max-w-[720px] mx-auto">
              <RedLabel>La fiabilité des coachs</RedLabel>
              <SectionTitle>
                Un problème vieux comme le recrutement — et notre solution.
              </SectionTitle>
              <p className="text-[15px] sm:text-[16px] text-white/75 leading-relaxed mt-6">
                On vous le dit honnêtement : le recrutement sportif a toujours eu un défi de fiabilité. Comment savoir si un coach gonfle ses joueurs pour les aider à se placer? Comment évaluer la crédibilité de ce qu&apos;on vous raconte? Ce problème existait avant Nexus et continuera d&apos;exister hors de Nexus. La différence, c&apos;est qu&apos;ici, vous avez les outils pour le gérer.
              </p>
            </div>

            {/* Split: left copy 2/5, right mockup 3/5 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-12 items-start mt-14">
              <div className="lg:col-span-2">
                <h3 className="nx-display text-[20px] sm:text-[22px] font-black text-white tracking-tight leading-tight">
                  La réputation des coachs, construite par les recruteurs.
                </h3>
                <div className="space-y-4 mt-5 text-[14px] sm:text-[15px] text-white/75 leading-relaxed">
                  <p>
                    Sur Nexus, chaque coach a une réputation publique — visible à tous les recruteurs avant qu&apos;ils ne lisent une seule évaluation. Cette réputation est construite par vous et vos collègues recruteurs.
                  </p>
                  <p>
                    Après chaque interaction avec un coach — message, visite, recrutement — vous pouvez évaluer la qualité et la fiabilité de ses observations. Ces évaluations s&apos;accumulent au fil du temps. Un coach qui gonfle systématiquement ses joueurs verra sa réputation refléter cette tendance. Un coach qui évalue avec justesse devient une référence dans son réseau.
                  </p>
                  <p>
                    Le système se corrige lui-même. Pas par Nexus, mais par la communauté de recruteurs CÉGEP.
                  </p>
                </div>
              </div>

              {/* Coach reputation mockup */}
              <div className="lg:col-span-3">
                <div className="bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/50">
                      <User size={22} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[17px] font-bold text-white leading-tight">
                        Coach Pelletier
                      </p>
                      <p className="text-[13px] text-white/55 mt-0.5">
                        É.S. De Mortagne
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 mt-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Star key={i} size={16} fill="#F59E0B" className="text-[#F59E0B]" />
                    ))}
                    <Star size={16} className="text-[#4a4d56]" />
                    <span className="ml-2 text-[14px] font-bold text-white tabular-nums">
                      4.2 <span className="text-white/45 font-semibold">/ 5</span>
                    </span>
                  </div>
                  <p className="text-[12px] text-white/55 mt-2">
                    Note de fiabilité — basée sur 14 évaluations de recruteurs
                  </p>

                  <div className="h-px bg-white/[0.06] my-6" />

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-[13px] mb-1.5">
                        <span className="text-white/75">Précision des évaluations</span>
                        <span className="text-[#22C55E] font-bold tabular-nums">87%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#2D3748] overflow-hidden">
                        <div className="h-full rounded-full bg-[#22C55E] w-[87%]" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white/75">Athlètes placés en CÉGEP</span>
                      <span className="text-white font-bold tabular-nums">12</span>
                    </div>

                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white/75">Délai moyen de réponse</span>
                      <span className="text-white font-bold tabular-nums">6h</span>
                    </div>
                  </div>

                  <div className="h-px bg-white/[0.06] my-6" />

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#22C55E]">
                      Recommandé
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#3B82F6]">
                      Réponse rapide
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#E63946]/15 border border-[#E63946]/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E63946]">
                      Placeur
                    </span>
                  </div>

                  <p className="text-[11px] text-white/45 mt-6">
                    Évalué pour la dernière fois il y a 3 jours par un recruteur de Vanier
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION 7 — COMPETITIVE INTELLIGENCE ─────────── */}
        <section id="intelligence" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              {/* Mockup left */}
              <div className="order-2 lg:order-1">
                {/* Red glow wrapper + inner card */}
                <div className="relative bg-[#15171c] border border-white/[0.08] rounded-xl p-6 shadow-[0_0_80px_-10px_rgba(230,57,70,0.35)]">
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 items-start">
                    {/* Left 40% — tilted player card */}
                    <div className="sm:col-span-2 flex justify-center sm:justify-start">
                      <div className="relative -rotate-3 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
                        <div className="relative w-[180px] rounded-xl overflow-hidden border border-white/15 bg-[#111317]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/preview-athlete-player-card.png"
                            alt="Carte joueur Alexandre Tremblay"
                            className="w-full h-auto block"
                          />
                          {/* Blue verified check top-right */}
                          <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#3B82F6] border-2 border-[#111317] flex items-center justify-center shadow-lg">
                            <CheckCircle2 size={16} className="text-white" strokeWidth={3} />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right 60% — stats + intelligence */}
                    <div className="sm:col-span-3 space-y-4 min-w-0">
                      {/* Name + jersey */}
                      <div>
                        <p className="nx-display text-[18px] sm:text-[20px] font-black text-white uppercase tracking-tight leading-tight">
                          Alexandre Tremblay{" "}
                          <span className="text-[#E63946]">#7</span>
                        </p>
                        <p className="text-[11px] text-white/45 uppercase tracking-[0.2em] mt-1">
                          Football · POS LB · Promotion 2027
                        </p>
                      </div>

                      {/* Metrics row */}
                      <div className="grid grid-cols-4 divide-x divide-white/[0.06] border-t border-b border-white/[0.06] py-3">
                        <div className="px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Eye size={12} className="text-white/55" strokeWidth={2.2} />
                            <span className="text-[15px] font-black text-white tabular-nums">47</span>
                          </div>
                          <p className="text-[9px] text-white/45 uppercase tracking-wider mt-0.5">Vues</p>
                        </div>
                        <div className="px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Heart size={12} fill="currentColor" className="text-[#E63946]" />
                            <span className="text-[15px] font-black text-[#E63946] tabular-nums">3</span>
                          </div>
                          <p className="text-[9px] text-white/45 uppercase tracking-wider mt-0.5">Favoris</p>
                        </div>
                        <div className="px-2 text-center">
                          <p className="text-[9px] text-white/45 uppercase tracking-wider">Mon statut</p>
                          <p className="text-[11px] font-bold text-white mt-0.5 leading-tight">Visite planifiée</p>
                        </div>
                        <div className="px-2 text-center">
                          <p className="text-[9px] text-white/45 uppercase tracking-wider">Recrutement</p>
                          <span className="inline-flex items-center rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#F59E0B] mt-0.5">
                            En processus
                          </span>
                        </div>
                      </div>

                      {/* Read annotation — explains the gap between Mon statut and Recrutement global */}
                      <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2.5">
                        <p className="flex items-start gap-2 text-[11px] text-white/70 leading-relaxed">
                          <Zap size={13} className="shrink-0 mt-0.5 text-[#E63946]" strokeWidth={2.2} />
                          <span>
                            <span className="font-bold text-white">Le recrutement global avance.</span>{" "}
                            L&apos;athlète est en processus avec un CÉGEP — comparez à votre propre statut pour savoir si vous devez accélérer.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Text right */}
              <div className="order-1 lg:order-2">
                <RedLabel>Intelligence concurrentielle</RedLabel>
                <SectionTitle>
                  Sachez où vous en êtes — par rapport au reste.
                </SectionTitle>
                <div className="space-y-4 mt-6 text-[14px] sm:text-[15px] text-white/75 leading-relaxed">
                  <p>
                    Un recruteur sans Nexus apprend par la rumeur qu&apos;un athlète discute avec un autre CÉGEP. Sur Nexus, l&apos;information est sur le profil : le statut de recrutement de l&apos;athlète change dès qu&apos;il avance dans son processus.
                  </p>
                  <p>
                    Sur chaque profil, deux indicateurs côte à côte : <span className="text-white font-semibold">votre propre statut</span> avec cet athlète, et le <span className="text-white font-semibold">statut de recrutement global</span> qu&apos;il porte (Ouvert, En processus, Recruté). Si le statut global passe à « En processus » alors que vous êtes encore à « Identifié », l&apos;écart est visible.
                  </p>
                  <p>
                    Le nombre de recruteurs qui l&apos;ont mis en favori complète le portrait — combien de CÉGEPs s&apos;intéressent à lui en ce moment. Pas de noms par CÉGEP, pas d&apos;étapes par concurrent : juste les signaux qui comptent pour décider si vous devez accélérer.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 8 — TARIFICATION ─────────────────────── */}
        <section id="tarification" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>Tarification</RedLabel>
              <SectionTitle>Un prix selon votre niveau de recrutement.</SectionTitle>
              <p className="text-[14px] sm:text-[15px] text-white/75 leading-relaxed mt-5 max-w-[640px] mx-auto">
                Recrutement 100% québécois. Paiement en dollars canadiens. TPS/TVQ incluses dans les tarifs affichés.
              </p>
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
                    className={`relative flex-1 bg-[#1A1D24] rounded-xl flex flex-col min-h-[640px] p-8 ${t.borderClass}`}
                  >
                    {t.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex px-3 py-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold uppercase tracking-wider">
                        {t.badge}
                      </span>
                    )}

                    <h3 className="text-[20px] font-bold text-white">{t.name}</h3>

                    <div className="mt-4 flex items-baseline gap-1.5 flex-wrap">
                      <span className={`nx-display text-[32px] sm:text-[36px] font-black leading-none ${t.priceColor}`}>
                        {t.price}
                      </span>
                      {t.priceSuffix && (
                        <span className="text-[15px] text-white/55 font-semibold">{t.priceSuffix}</span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/55 mt-2">{t.subtitle}</p>

                    <div className="h-px bg-white/[0.06] my-6" />

                    <div className="flex-1">
                      {t.subheader && (
                        <p className="text-[13px] text-white/55 mb-3">{t.subheader}</p>
                      )}
                      <ul className="space-y-2.5">
                        {t.bullets.map((b) => (
                          <li
                            key={b}
                            className="flex items-start gap-3 text-[14px] text-white/85 leading-snug"
                          >
                            <span
                              className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ${t.checkColor}`}
                            >
                              <Check size={11} strokeWidth={3} />
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      href={t.buttonHref}
                      className={`mt-8 inline-flex items-center justify-center w-full rounded-lg font-bold uppercase tracking-wider text-[13px] py-3 px-5 transition-colors ${btnClass}`}
                    >
                      {t.buttonLabel}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 9 — FAQ ──────────────────────────────── */}
        <section id="faq" className="border-b border-white/[0.06]">
          <div className="max-w-[860px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>Questions fréquentes</RedLabel>
              <SectionTitle>Les réponses aux questions que vous vous posez.</SectionTitle>
            </div>

            <div className="space-y-3 mt-12">
              {FAQS.map((item, i) => (
                <FaqItem
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 10 — FINAL CTA ───────────────────────── */}
        <section id="cta" className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[820px] mx-auto px-6 py-24 text-center">
            <span className="inline-block w-10 h-[2px] bg-[#E63946] mb-8" />

            <h2 className="nx-display text-[38px] sm:text-[52px] font-black text-white leading-[1.05] tracking-tight">
              Prêt à voir tous les <span className="text-[#E63946]">talents</span> du Québec?
            </h2>

            <p className="text-[15px] sm:text-[17px] text-white/75 leading-relaxed mt-6 max-w-[560px] mx-auto">
              Créez votre compte gratuit. Explorez la plateforme. Mettez Pro à l&apos;épreuve pendant 14 jours sans frais.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/inscription"
                className="inline-flex items-center justify-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors text-[15px] px-9 py-[15px]"
              >
                Créer un compte gratuit
              </Link>
            </div>

            <p className="text-[13px] text-white/55 mt-8">
              Aucune carte de crédit requise. Configurez votre profil en 2 minutes.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
