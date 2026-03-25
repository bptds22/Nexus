"use client";

import { useState } from "react";
import Link from "next/link";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

/* ═══════════════════════════════════════════════════════════════
   Tarifs — Public pricing page
   3 individual subscription plans + comparison table + FAQ
═══════════════════════════════════════════════════════════════ */

/* ── Plan data ─────────────────────────────────────────────── */

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  annualMonthlyEquiv: number; // what monthly would cost over 12 months
  subtitle: string;
  features: string[];
  icon: React.ReactNode;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "coach_pro",
    name: "Coach Pro",
    monthlyPrice: 14.99,
    annualPrice: 129,
    annualMonthlyEquiv: 179.88,
    subtitle: "Pour les entraîneurs qui veulent maximiser la visibilité de leurs athlètes",
    features: [
      "Profils athlètes illimités",
      "Évaluation détaillée (11 critères)",
      "Export PDF des profils",
      "Upload vidéo directement sur Nexus",
      "Statistiques de visibilité avancées",
      "Alertes recruteur en temps réel",
      "Badge « Coach Pro » visible par les recruteurs",
      "Support prioritaire",
    ],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "recruteur_pro",
    name: "Recruteur Pro",
    monthlyPrice: 29,
    annualPrice: 249,
    annualMonthlyEquiv: 348,
    subtitle: "Pour les recruteurs sérieux qui veulent les meilleurs athlètes en premier",
    featured: true,
    features: [
      "Pipeline illimité (50 max en gratuit)",
      "Favoris illimités (10 max en gratuit)",
      "Messagerie directe avec les coachs",
      "Consultation de profils illimitée (5/mois en gratuit)",
      "Analytique de recrutement avancée",
      "Listes de prospects personnalisées",
      "Export PDF des profils athlètes",
      "Messages groupés (bulk messaging)",
      "Badge « Recruteur Pro » visible par les coachs",
      "Support prioritaire",
    ],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: "athlete_pro",
    name: "Athlète Pro",
    monthlyPrice: 9.99,
    annualPrice: 79,
    annualMonthlyEquiv: 119.88,
    subtitle: "Pour les athlètes qui veulent savoir qui les regarde",
    features: [
      "Voir quels CÉGEPs consultent ton profil",
      "Alertes en temps réel (vues + favoris)",
      "Statistiques de visibilité détaillées",
      "Comparaison avec les autres athlètes de ton sport",
      "Suggestions de CÉGEPs compatibles",
      "Badge « Pro » sur ton profil",
      "Support prioritaire",
    ],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" />
        <path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" />
        <path d="M6 3h12v6a6 6 0 01-12 0V3z" />
        <path d="M12 15v3M8 21h8" />
      </svg>
    ),
  },
];

/* ── Comparison table ──────────────────────────────────────── */

type CellValue = string | boolean;

interface CompRow {
  label: string;
  gratuit: CellValue;
  coach: CellValue;
  recruteur: CellValue;
  athlete: CellValue;
}

interface CompGroup {
  category: string;
  rows: CompRow[];
}

const COMPARISON: CompGroup[] = [
  {
    category: "Profils & Données",
    rows: [
      { label: "Profils athlètes", gratuit: "5 max", coach: "Illimité", recruteur: "Vue seul.", athlete: "1 (le sien)" },
      { label: "Évaluation coach", gratuit: "Simplifiée (5 critères)", coach: "Détaillée (11 critères)", recruteur: "Vue seul.", athlete: "Vue seul." },
      { label: "Export PDF", gratuit: false, coach: true, recruteur: true, athlete: false },
      { label: "Upload vidéo", gratuit: "1 lien ext.", coach: "Upload direct + liens", recruteur: "Vue seul.", athlete: "1 lien ext." },
    ],
  },
  {
    category: "Recrutement",
    rows: [
      { label: "Pipeline", gratuit: "—", coach: "—", recruteur: "50 athlètes", athlete: "—" },
      { label: "Pipeline Pro", gratuit: "—", coach: "—", recruteur: "Illimité", athlete: "—" },
      { label: "Favoris", gratuit: "—", coach: "—", recruteur: "10 max", athlete: "—" },
      { label: "Favoris Pro", gratuit: "—", coach: "—", recruteur: "Illimité", athlete: "—" },
      { label: "Consultation profils", gratuit: "—", coach: "—", recruteur: "5/mois", athlete: "—" },
      { label: "Consultation Pro", gratuit: "—", coach: "—", recruteur: "Illimité", athlete: "—" },
      { label: "Messagerie", gratuit: "—", coach: "—", recruteur: false, athlete: "—" },
      { label: "Messagerie Pro", gratuit: "—", coach: "—", recruteur: true, athlete: "—" },
      { label: "Listes de prospects", gratuit: "—", coach: "—", recruteur: false, athlete: "—" },
      { label: "Listes Pro", gratuit: "—", coach: "—", recruteur: "Illimité", athlete: "—" },
    ],
  },
  {
    category: "Visibilité & Analytics",
    rows: [
      { label: "Vues du profil", gratuit: "Nombre total", coach: "Total + par semaine", recruteur: "—", athlete: "Nombre total" },
      { label: "Vues détaillées", gratuit: false, coach: false, recruteur: "—", athlete: "Quels CÉGEPs" },
      { label: "Alertes recruteur", gratuit: false, coach: "Temps réel", recruteur: "—", athlete: false },
      { label: "Alertes Pro", gratuit: false, coach: true, recruteur: "—", athlete: "Temps réel" },
      { label: "Analytics recrutement", gratuit: false, coach: false, recruteur: "Basique", athlete: false },
      { label: "Analytics Pro", gratuit: false, coach: false, recruteur: "Avancé", athlete: false },
    ],
  },
  {
    category: "Support",
    rows: [
      { label: "Support", gratuit: "Communautaire", coach: "Prioritaire", recruteur: "Prioritaire", athlete: "Prioritaire" },
    ],
  },
];

/* ── FAQ ───────────────────────────────────────────────────── */

const FAQ = [
  {
    q: "Est-ce que je peux essayer gratuitement?",
    a: "Oui! Tous nos plans Pro incluent un essai gratuit de 14 jours, sans carte de crédit requise. Tu peux explorer toutes les fonctionnalités Pro et décider si ça te convient avant de t'engager.",
  },
  {
    q: "Comment fonctionne la facturation?",
    a: "Tu choisis entre la facturation mensuelle ou annuelle. Le plan annuel te fait économiser l'équivalent de 2 mois. Le prélèvement se fait automatiquement via Stripe, notre processeur de paiement sécurisé.",
  },
  {
    q: "Est-ce que je peux annuler à tout moment?",
    a: "Absolument. Tu peux annuler ton abonnement à tout moment depuis tes paramètres. Tu conserves l'accès Pro jusqu'à la fin de ta période de facturation en cours.",
  },
  {
    q: "Qu'arrive-t-il à mes données si j'annule?",
    a: "Tes données sont conservées indéfiniment. Tu reviens simplement au plan Gratuit avec ses limitations. Si tu réactives ton abonnement plus tard, toutes tes données sont toujours là.",
  },
  {
    q: "Est-ce que les prix incluent les taxes?",
    a: "Les prix affichés sont avant taxes. La TPS (5%) et la TVQ (9,975%) du Québec s'appliquent au montant facturé.",
  },
  {
    q: "Est-ce que je peux changer de plan?",
    a: "Oui, tu peux passer d'un plan mensuel à annuel (ou inversement) à tout moment. Le changement prend effet à la prochaine période de facturation. Aucune pénalité.",
  },
  {
    q: "Comment payer?",
    a: "Nous acceptons Visa, Mastercard et American Express via Stripe, le leader mondial du paiement en ligne. Tes informations bancaires ne sont jamais stockées sur nos serveurs.",
  },
  {
    q: "Mon école ou mon CÉGEP peut-il payer pour moi?",
    a: "Pour les abonnements institutionnels (écoles et CÉGEPs), consultez la section Établissements de notre page d'accueil ou contactez-nous à ventes@nexus-sport.ca.",
  },
];

/* ── Helpers ────────────────────────────────────────────────── */

function formatPrice(n: number) {
  if (Number.isInteger(n)) return `${n}$`;
  return `${n.toFixed(2).replace(".", ",")}$`;
}

function CellContent({ value }: { value: CellValue }) {
  if (value === true) return <span className="text-[#22C55E] font-bold">&#10003;</span>;
  if (value === false) return <span className="text-[#6B7280]">&#10005;</span>;
  if (value === "—") return <span className="text-[#4a4d56]">—</span>;
  if (value === "Illimité" || value === "Avancé" || value === "Temps réel" || value === "Quels CÉGEPs")
    return <span className="text-white font-bold text-[12px]">{value}</span>;
  return <span className="text-[#9CA3AF] text-[12px]">{value}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */

export default function TarifsPage() {
  const [billing, setBilling] = useState<"mensuel" | "annuel">("mensuel");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen relative">
      <PlaybookBackground />
      <MarketingNav />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 sm:py-24">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="text-center mb-12">
          <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
            Tarification
          </p>
          <h1 className="font-head text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            Choisis le plan qui te convient
          </h1>
          <p className="text-[15px] text-[#9CA3AF] max-w-md mx-auto">
            Essai gratuit de 14 jours. Aucune carte requise.
          </p>
        </div>

        {/* ── Billing toggle ───────────────────────────────── */}
        <div className="flex items-center justify-center gap-1 mb-12">
          <div className="inline-flex bg-[#1A1D24] rounded-full p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setBilling("mensuel")}
              className={`px-5 py-2 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all ${
                billing === "mensuel"
                  ? "bg-[#E63946] text-white shadow-lg"
                  : "text-[#9CA3AF] hover:text-white"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBilling("annuel")}
              className={`px-5 py-2 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all ${
                billing === "annuel"
                  ? "bg-[#E63946] text-white shadow-lg"
                  : "text-[#9CA3AF] hover:text-white"
              }`}
            >
              Annuel
            </button>
          </div>
          {billing === "annuel" && (
            <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full bg-[#DAB65A]/15 text-[#DAB65A] text-[11px] font-bold uppercase tracking-wider animate-fade-in">
              Économise 2 mois
            </span>
          )}
        </div>

        {/* ── Pricing cards ────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 items-start">
          {PLANS.map((plan) => {
            const isFeatured = plan.featured;
            const price = billing === "mensuel" ? plan.monthlyPrice : plan.annualPrice;
            const period = billing === "mensuel" ? "/mois" : "/an";

            return (
              <div
                key={plan.id}
                className={`relative bg-[#1A1D24] rounded-xl overflow-hidden flex flex-col ${
                  isFeatured
                    ? "border-2 border-[#E63946] shadow-[0_0_40px_rgba(230,57,70,0.15)] md:-mt-4 md:mb-0"
                    : "border border-white/10"
                }`}
              >
                {/* Popular badge */}
                {isFeatured && (
                  <div className="bg-[#E63946] text-white text-center py-1.5 text-[11px] font-bold uppercase tracking-widest">
                    Populaire
                  </div>
                )}

                <div className="p-6 sm:p-8 flex flex-col flex-1">
                  {/* Icon + name */}
                  <div className={`mb-4 ${isFeatured ? "text-[#E63946]" : "text-[#6B7280]"}`}>
                    {plan.icon}
                  </div>
                  <h3 className={`font-head text-xl font-black uppercase tracking-tight mb-2 ${isFeatured ? "text-[#E63946]" : "text-white"}`}>
                    {plan.name}
                  </h3>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="font-head text-4xl font-black text-white leading-none">
                      {formatPrice(price)}
                    </span>
                    <span className="text-sm text-[#6B7280]">{period}</span>
                  </div>
                  {billing === "annuel" && (
                    <p className="text-[12px] text-[#6B7280] mb-3">
                      <span className="line-through">{formatPrice(plan.annualMonthlyEquiv)}/an</span>
                    </p>
                  )}

                  {/* Subtitle */}
                  <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-6">
                    {plan.subtitle}
                  </p>

                  {/* Divider */}
                  <div className="border-t border-white/5 mb-6" />

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span className="text-[13px] text-[#c8ccd4]">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    type="button"
                    onClick={() => showToast("Redirection vers Stripe Checkout (Phase 2)")}
                    className={`w-full h-12 rounded-lg font-head font-bold text-[13px] uppercase tracking-wider transition-colors ${
                      isFeatured
                        ? "bg-[#E63946] text-white hover:bg-[#D42B22]"
                        : "border border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10"
                    }`}
                  >
                    Essai gratuit 14 jours
                  </button>
                  <p className="text-center text-[11px] text-[#6B7280] mt-2">
                    Aucune carte requise
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Comparison table ─────────────────────────────── */}
        <div className="mb-20">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight text-center mb-8">
            Comparaison détaillée
          </h2>

          <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              {/* Header */}
              <thead>
                <tr className="border-b border-[#2D3748]">
                  <th className="text-left px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] w-[28%]">
                    Fonctionnalité
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B7280] text-center w-[18%]">
                    Gratuit
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white text-center w-[18%]">
                    Coach Pro
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#E63946] text-center w-[18%]">
                    Recruteur Pro
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white text-center w-[18%]">
                    Athlète Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((group) => (
                  <>
                    {/* Category header */}
                    <tr key={`cat-${group.category}`}>
                      <td colSpan={5} className="px-5 pt-5 pb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#E63946]">
                        {group.category}
                      </td>
                    </tr>
                    {group.rows.map((row, ri) => (
                      <tr key={`${group.category}-${ri}`} className={`${ri % 2 === 0 ? "bg-[#111317]/40" : ""} hover:bg-white/[0.02] transition-colors`}>
                        <td className="px-5 py-3 text-[13px] text-[#9CA3AF]">{row.label}</td>
                        <td className="px-4 py-3 text-center"><CellContent value={row.gratuit} /></td>
                        <td className="px-4 py-3 text-center"><CellContent value={row.coach} /></td>
                        <td className="px-4 py-3 text-center"><CellContent value={row.recruteur} /></td>
                        <td className="px-4 py-3 text-center"><CellContent value={row.athlete} /></td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight text-center mb-8">
            Questions fréquentes
          </h2>

          <div className="space-y-3">
            {FAQ.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-[14px] font-bold text-white pr-4">{item.q}</span>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"
                      className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5">
                      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom CTA ───────────────────────────────────── */}
        <div className="text-center pb-8">
          <h2 className="font-head text-2xl font-black text-white mb-3">
            Prêt à passer au niveau supérieur?
          </h2>
          <p className="text-[14px] text-[#9CA3AF] mb-6">
            14 jours gratuits. Aucune carte. Annule quand tu veux.
          </p>
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center h-12 px-8 rounded-lg bg-[#E63946] text-white font-head font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
          >
            Commencer gratuitement
          </Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}

      {/* Fade-in animation */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
