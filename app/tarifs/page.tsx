"use client";

import { useState } from "react";
import Link from "next/link";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";

/* ═══════════════════════════════════════════════════════════════
   Tarifs — 7 tiers across 3 tabs (Coach / Recruiter / Athlete)
═══════════════════════════════════════════════════════════════ */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

type Tab = "coach" | "recruteur" | "athlete";

interface Plan {
  id: string;
  name: string;
  monthly: number;
  annual: number;
  annualFull: number; // monthly × 12
  subtitle: string;
  features: string[];
  featured?: boolean;
}

const COACH_PLANS: Plan[] = [
  {
    id: "free", name: "Gratuit", monthly: 0, annual: 0, annualFull: 0,
    subtitle: "L'essentiel pour commencer",
    features: [
      "Créer/gérer profils athlètes (illimité)",
      "Évaluations simplifiées (5 critères)",
      "Vérifier les profils (badge bleu)",
      "Recevoir messages des recruteurs",
      "Rejoindre une école",
    ],
  },
  {
    id: "coach_pro", name: "Pro", monthly: 5.99, annual: 29.99, annualFull: 71.88,
    subtitle: "Gère ton école et booste la visibilité",
    features: [
      "Tout du plan Gratuit",
      "Mon école — Tableau de bord",
      "Stats école — Visibilité détaillée",
      "Placements — Suivi des recrues",
      "Ma réputation — Évaluations recruteurs",
      "Analytics — Performance athlètes",
    ],
  },
  {
    id: "coach_allstar", name: "All Star", monthly: 29.99, annual: 200, annualFull: 359.88,
    subtitle: "Accès complet à toute la plateforme", featured: true,
    features: [
      "Tout du plan Pro",
      "Accès complet et illimité",
      "Support prioritaire",
      "Badge All Star visible",
      "Fonctionnalités futures incluses",
    ],
  },
];

const RECRUITER_PLANS: Plan[] = [
  {
    id: "free", name: "Gratuit", monthly: 0, annual: 0, annualFull: 0,
    subtitle: "Découvre la plateforme",
    features: [
      "Recherche basique (10 résultats)",
      "Pipeline de base (50 athlètes max)",
      "Favoris (10 max)",
      "Consultations limitées (5/mois)",
    ],
  },
  {
    id: "recruteur_pro", name: "Pro", monthly: 9.99, annual: 89, annualFull: 119.88,
    subtitle: "Recrute sans limites",
    features: [
      "Recherche illimitée",
      "Pipeline illimité",
      "Favoris illimités",
      "Messagerie directe avec les coachs",
      "Analytics de recrutement",
    ],
  },
  {
    id: "recruteur_allstar", name: "All Star", monthly: 29.99, annual: 269, annualFull: 359.88,
    subtitle: "Pilote le recrutement de ton CÉGEP", featured: true,
    features: [
      "Tout du plan Pro",
      "Gestion CÉGEP (Dashboard, Recruteurs, Stats)",
      "Messages groupés (bulk messaging)",
      "Export PDF/CSV",
      "Support prioritaire",
      "Fonctionnalités futures incluses",
    ],
  },
];

const ATHLETE_PLANS: Plan[] = [
  {
    id: "free", name: "Gratuit", monthly: 0, annual: 0, annualFull: 0,
    subtitle: "Sois visible des recruteurs",
    features: [
      "Créer/modifier ton profil",
      "Suggestions au coach",
      "Notifications de base",
      "Vues totales (nombre seul)",
    ],
  },
  {
    id: "athlete_pro", name: "Pro", monthly: 9.99, annual: 79, annualFull: 119.88,
    subtitle: "Sache qui te regarde", featured: true,
    features: [
      "Tout du plan Gratuit",
      "Quels CÉGEPs consultent ton profil",
      "Alertes en temps réel (vues + favoris)",
      "Graphique vues/semaine",
      "Classement dans ton sport",
      "Badge Pro sur ton profil",
      "Support prioritaire",
    ],
  },
];

/* ── Comparison tables per tab ── */
interface CompRow { feature: string; tiers: string[] }

const COACH_COMPARE: CompRow[] = [
  { feature: "Profils athlètes", tiers: ["Illimité", "Illimité", "Illimité"] },
  { feature: "Évaluation", tiers: ["Simplifiée (5)", "Simplifiée (5)", "Simplifiée (5)"] },
  { feature: "Vérification profils", tiers: ["✓", "✓", "✓"] },
  { feature: "Messages recruteurs", tiers: ["✓", "✓", "✓"] },
  { feature: "Mon école", tiers: ["✗", "✓", "✓"] },
  { feature: "Stats école", tiers: ["✗", "✓", "✓"] },
  { feature: "Placements", tiers: ["✗", "✓", "✓"] },
  { feature: "Réputation", tiers: ["✗", "✓", "✓"] },
  { feature: "Analytics", tiers: ["✗", "✓", "✓"] },
  { feature: "Accès complet", tiers: ["✗", "✗", "✓"] },
  { feature: "Support", tiers: ["Communautaire", "Standard", "Prioritaire"] },
];

const RECRUITER_COMPARE: CompRow[] = [
  { feature: "Recherche", tiers: ["10 résultats", "Illimité", "Illimité"] },
  { feature: "Pipeline", tiers: ["50 max", "Illimité", "Illimité"] },
  { feature: "Favoris", tiers: ["10 max", "Illimité", "Illimité"] },
  { feature: "Consultations profils", tiers: ["5/mois", "Illimité", "Illimité"] },
  { feature: "Messagerie", tiers: ["✗", "✓", "✓"] },
  { feature: "Analytics recrutement", tiers: ["✗", "✓", "✓"] },
  { feature: "Gestion CÉGEP", tiers: ["✗", "✗", "✓"] },
  { feature: "Messages groupés", tiers: ["✗", "✗", "✓"] },
  { feature: "Export PDF/CSV", tiers: ["✗", "✗", "✓"] },
  { feature: "Support", tiers: ["Communautaire", "Standard", "Prioritaire"] },
];

const ATHLETE_COMPARE: CompRow[] = [
  { feature: "Profil athlète", tiers: ["✓", "✓"] },
  { feature: "Suggestions coach", tiers: ["✓", "✓"] },
  { feature: "Vues totales", tiers: ["Nombre seul", "Détaillées"] },
  { feature: "Quels CÉGEPs regardent", tiers: ["✗", "✓"] },
  { feature: "Alertes temps réel", tiers: ["✗", "✓"] },
  { feature: "Graphique vues/semaine", tiers: ["✗", "✓"] },
  { feature: "Classement sport", tiers: ["✗", "✓"] },
  { feature: "Badge Pro", tiers: ["✗", "✓"] },
  { feature: "Support", tiers: ["Communautaire", "Prioritaire"] },
];

/* ── FAQ ── */
const FAQ = [
  { q: "Est-ce que je peux essayer gratuitement?", a: "Oui, tous les plans payants incluent un essai gratuit de 14 jours. Aucune carte de crédit requise pour commencer." },
  { q: "Comment fonctionne la facturation?", a: "Tu choisis un cycle mensuel ou annuel. Le paiement est automatique via Stripe. L'annuel offre jusqu'à 58% d'économies." },
  { q: "Est-ce que je peux annuler à tout moment?", a: "Oui, sans frais. Tu gardes l'accès jusqu'à la fin de ta période en cours." },
  { q: "Est-ce que les prix incluent les taxes?", a: "Les prix affichés sont avant taxes. TPS (5%) et TVQ (9,975%) s'appliquent." },
  { q: "Quelle est la différence entre Pro et All Star?", a: "Pro débloque les fonctionnalités avancées de ton rôle. All Star ajoute la gestion d'établissement, l'export et le support prioritaire." },
  { q: "Comment payer?", a: "Visa, Mastercard, Amex via Stripe. Le paiement est sécurisé et conforme PCI DSS." },
];

/* ═══════════════════════════════════════════════════════════════ */

export default function TarifsPage() {
  const [tab, setTab] = useState<Tab>("athlete");
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const plans = tab === "coach" ? COACH_PLANS : tab === "recruteur" ? RECRUITER_PLANS : ATHLETE_PLANS;
  const compare = tab === "coach" ? COACH_COMPARE : tab === "recruteur" ? RECRUITER_COMPARE : ATHLETE_COMPARE;
  const tierHeaders = tab === "athlete" ? ["Gratuit", "Pro (9,99$)"] : ["Gratuit", `Pro (${tab === "coach" ? "5,99" : "9,99"}$)`, "All Star (29,99$)"];

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen">
      <PlaybookBackground />
      <MarketingNav />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <span className={`${label} text-[#E63946] tracking-[0.2em]`}>Tarification</span>
          <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase tracking-tight mt-2">Choisis le plan qui te convient</h1>
          <p className="text-[15px] text-[#9CA3AF] mt-3 max-w-lg mx-auto">Essai gratuit de 14 jours. Aucune carte requise.</p>
        </div>

        {/* Tab navigation */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex border border-white/10 rounded-lg overflow-hidden">
            {([
              { key: "coach" as Tab, label: "Coachs" },
              { key: "recruteur" as Tab, label: "Recruteurs" },
              { key: "athlete" as Tab, label: "Athlètes" },
            ]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-6 sm:px-8 h-11 font-head font-bold text-xs uppercase tracking-widest transition-colors ${
                  tab === t.key ? "bg-[#E63946] text-white" : "text-[#9CA3AF] hover:text-white"
                }`}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center items-center gap-3 mb-10">
          <span className={`text-sm font-semibold ${!annual ? "text-white" : "text-[#6B7280]"}`}>Mensuel</span>
          <button type="button" aria-label="Basculer facturation annuelle" onClick={() => setAnnual(!annual)} className="relative w-14 h-7 rounded-full transition-colors" style={{ backgroundColor: annual ? "#E63946" : "#2D3748" }}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${annual ? "left-8" : "left-1"}`} />
          </button>
          <span className={`text-sm font-semibold ${annual ? "text-white" : "text-[#6B7280]"}`}>Annuel</span>
          {annual && <span className="text-[10px] font-bold text-[#DAB65A] bg-[#DAB65A]/15 px-2 py-0.5 rounded-full">Économise jusqu&apos;à 58%</span>}
        </div>

        {/* Plan cards */}
        <div className={`grid gap-5 mb-16 ${tab === "athlete" ? "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto" : "grid-cols-1 sm:grid-cols-3"}`}>
          {plans.map((plan) => {
            const price = annual ? plan.annual : plan.monthly;
            const isFree = plan.monthly === 0;
            const savingsPct = !isFree && plan.annualFull > 0 ? Math.round((1 - plan.annual / plan.annualFull) * 100) : 0;
            return (
              <div key={plan.id} className={`bg-[#1A1D24] rounded-xl p-6 sm:p-7 flex flex-col relative ${
                plan.featured ? "border-2 border-[#E63946] shadow-[0_0_30px_rgba(230,57,70,0.12)]" : "border border-white/10"
              }`}>
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E63946] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">Populaire</span>
                )}
                {annual && !isFree && savingsPct > 0 && (
                  <span className="absolute top-4 right-4 text-[10px] font-bold text-[#DAB65A] bg-[#DAB65A]/15 px-2 py-0.5 rounded-full">-{savingsPct}%</span>
                )}
                <h3 className="font-head font-black text-xl text-white uppercase">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-head font-black text-4xl text-white">{isFree ? "0" : price.toFixed(2).replace(".", ",")}$</span>
                  {!isFree && <span className="text-sm text-[#6B7280]">/{annual ? "an" : "mois"}</span>}
                </div>
                {annual && !isFree && (
                  <p className="text-[11px] text-[#6B7280] mt-1 line-through">{plan.annualFull.toFixed(2).replace(".", ",")}$/an</p>
                )}
                <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{plan.subtitle}</p>
                <div className="w-full h-px bg-white/10 my-4" />
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-[13px] text-[#9CA3AF]">{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => showToast(isFree ? "Tu es déjà sur le plan Gratuit" : "Redirection Stripe Checkout (Phase 2)")}
                  className={`mt-6 h-12 w-full rounded-lg font-head font-bold text-sm uppercase tracking-widest transition-all cursor-pointer ${
                    plan.featured
                      ? "bg-[#E63946] text-white hover:bg-[#D42B22] hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)] hover:-translate-y-0.5"
                      : isFree
                        ? "bg-white/5 text-[#9CA3AF] border border-white/10 hover:bg-white/10"
                        : "bg-transparent text-[#DAB65A] border border-[#DAB65A]/40 hover:bg-[#DAB65A]/10"
                  }`}
                >
                  {isFree ? "Plan actuel" : "Essai gratuit 14 jours"}
                </button>
                {!isFree && <p className="text-[10px] text-[#6B7280] text-center mt-2">Aucune carte requise</p>}
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="mb-16">
          <h2 className="font-head text-2xl font-black text-white uppercase text-center mb-6">Comparaison détaillée</h2>
          <div className="bg-[#1A1D24] rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6B7280]">Fonctionnalité</th>
                    {tierHeaders.map((h) => (
                      <th key={h} className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF] text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compare.map((row, i) => (
                    <tr key={row.feature} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"}`}>
                      <td className="px-5 py-3 text-[13px] text-[#9CA3AF]">{row.feature}</td>
                      {row.tiers.map((val, j) => (
                        <td key={j} className="px-5 py-3 text-center text-[13px]">
                          {val === "✓" ? <span className="text-[#22C55E] font-bold">✓</span>
                            : val === "✗" ? <span className="text-[#6B7280]">✗</span>
                            : val.includes("Illimité") ? <span className="text-white font-bold">{val}</span>
                            : <span className="text-[#9CA3AF]">{val}</span>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-16">
          <h2 className="font-head text-2xl font-black text-white uppercase text-center mb-6">Questions fréquentes</h2>
          <div className="space-y-2">
            {FAQ.map((faq, i) => (
              <div key={i} className="bg-[#1A1D24] rounded-lg border border-white/10 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-[14px] font-semibold text-white">{faq.q}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className={`shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[13px] text-[#9CA3AF] leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-[13px] text-[#6B7280] mb-4">Données hébergées au Québec · Conforme à la Loi 25</p>
          <Link href="/auth?mode=signup" className="inline-flex items-center h-12 px-8 bg-[#E63946] text-white font-head font-bold text-sm uppercase tracking-widest rounded-lg hover:bg-[#D42B22] transition-all hover:shadow-[0_8px_28px_rgba(230,57,70,0.38)]">
            Commencer gratuitement →
          </Link>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
