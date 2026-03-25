"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   SubscriptionSection — Full subscription management panel
   Used in every portal's Paramètres page under "Abonnement" tab.
   Reads tier from localStorage. Shows plan, usage, invoices, referral.
═══════════════════════════════════════════════════════════════ */

type PortalType = "coach" | "recruteur" | "athlete";
type Tier = "free" | "coach_pro" | "recruteur_pro" | "athlete_pro";
type SubStatus = "active" | "trialing" | "past_due" | "canceled";

interface SubData {
  tier: Tier;
  status: SubStatus;
  billing_cycle: "monthly" | "annual" | null;
  current_period_end: string | null;
  trial_days_remaining: number | null;
  cancel_at_period_end: boolean;
}

const TIER_LABELS: Record<Tier, string> = {
  free: "Gratuit",
  coach_pro: "Coach Pro",
  recruteur_pro: "Recruteur Pro",
  athlete_pro: "Athlète Pro",
};

const TIER_PRICES: Record<string, { monthly: string; annual: string }> = {
  coach_pro: { monthly: "14,99 $/mois", annual: "129 $/an" },
  recruteur_pro: { monthly: "29,00 $/mois", annual: "249 $/an" },
  athlete_pro: { monthly: "9,99 $/mois", annual: "79 $/an" },
};

const FREE_LIMITS: Record<PortalType, { label: string; current: number; max: number }[]> = {
  recruteur: [
    { label: "Consultations ce mois", current: 3, max: 5 },
    { label: "Favoris", current: 7, max: 10 },
    { label: "Pipeline", current: 32, max: 50 },
  ],
  coach: [
    { label: "Profils créés", current: 4, max: 5 },
  ],
  athlete: [],
};

const FREE_LIMITATIONS: Record<PortalType, string[]> = {
  recruteur: [
    "5 consultations/mois",
    "10 favoris max",
    "50 pipeline max",
    "Pas de messagerie",
  ],
  coach: [
    "5 profils max",
    "Évaluation simplifiée (5 critères)",
    "Pas d'export PDF",
  ],
  athlete: [
    "Vues totales seulement",
    "Pas de détail recruteur",
    "Pas d'alertes temps réel",
  ],
};

const PRO_FEATURES: Record<PortalType, string[]> = {
  recruteur: [
    "Consultations de profils illimitées",
    "Favoris illimités",
    "Pipeline illimité",
    "Messagerie directe avec les coachs",
    "Analytique de recrutement avancée",
    "Listes de prospects personnalisées",
    "Export PDF des profils",
    "Messages groupés",
    "Support prioritaire",
  ],
  coach: [
    "Profils athlètes illimités",
    "Évaluation détaillée (11 critères)",
    "Export PDF des profils",
    "Upload vidéo directement sur Nexus",
    "Statistiques de visibilité avancées",
    "Alertes recruteur en temps réel",
    "Support prioritaire",
  ],
  athlete: [
    "Voir quels CÉGEPs consultent ton profil",
    "Alertes en temps réel (vues + favoris)",
    "Statistiques de visibilité détaillées",
    "Comparaison avec d'autres athlètes",
    "Suggestions de CÉGEPs compatibles",
    "Support prioritaire",
  ],
};

const MOCK_INVOICES = [
  { date: "15 mars 2026", desc: "Recruteur Pro — Mensuel", amount: "33,34 $", status: "Payé" },
  { date: "15 fév. 2026", desc: "Recruteur Pro — Mensuel", amount: "33,34 $", status: "Payé" },
  { date: "15 jan. 2026", desc: "Recruteur Pro — Mensuel", amount: "33,34 $", status: "Payé" },
];

function usageColor(pct: number) {
  if (pct >= 100) return "#E63946";
  if (pct >= 80) return "#EAB308";
  return "#22C55E";
}

export default function SubscriptionSection({ portal }: { portal: PortalType }) {
  const [sub, setSub] = useState<SubData>({ tier: "free", status: "active", billing_cycle: null, current_period_end: null, trial_days_remaining: null, cancel_at_period_end: false });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (user.subscription) setSub(user.subscription);
        else if (user.tier) setSub((prev) => ({ ...prev, tier: user.tier }));
        if (user.referral_code) setReferralCode(user.referral_code);
      }
    } catch { /* noop */ }
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const isFree = sub.tier === "free";
  const isTrial = sub.status === "trialing";
  const isPro = !isFree;
  const tierLabel = TIER_LABELS[sub.tier];
  const proTier: Tier = portal === "coach" ? "coach_pro" : portal === "recruteur" ? "recruteur_pro" : "athlete_pro";
  const prices = TIER_PRICES[proTier];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Abonnement</h2>
        <p className="text-[13px] text-[#9CA3AF]">Gère ton plan et ta facturation</p>
      </div>

      {/* ── Current plan card ──────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6">
        {/* Status pill */}
        <div className="flex items-center gap-3 mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${
            isTrial ? "bg-[#22C55E]/15 text-[#22C55E] animate-pulse-subtle" :
            isPro ? "bg-[#DAB65A]/15 text-[#DAB65A]" :
            "bg-[#6B7280]/15 text-[#6B7280]"
          }`}>
            {isPro && !isTrial && <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
            {isTrial ? "Essai gratuit" : tierLabel}
          </span>
        </div>

        {/* ── FREE tier ─────────────────────────────────── */}
        {isFree && !isTrial && (
          <>
            <p className="text-[15px] font-bold text-white mb-4">Tu utilises le plan Gratuit</p>
            <div className="space-y-2.5 mb-6">
              {FREE_LIMITATIONS[portal].map((lim) => (
                <div key={lim} className="flex items-center gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  <span className="text-[13px] text-[#6B7280]">{lim}</span>
                </div>
              ))}
            </div>
            <Link href="/tarifs" className="inline-flex items-center h-12 px-6 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
              Passer à Pro — Essai gratuit 14 jours →
            </Link>
            <p className="text-[11px] text-[#4a4d56] mt-2">Aucune carte requise pour l&apos;essai</p>
          </>
        )}

        {/* ── TRIAL tier ────────────────────────────────── */}
        {isTrial && (
          <>
            <p className="text-[15px] font-bold text-white mb-2">
              Il te reste {sub.trial_days_remaining ?? 8} jours d&apos;essai gratuit
            </p>
            <div className="mb-4">
              <div className="flex justify-between text-[11px] text-[#6b7280] mb-1">
                <span>{14 - (sub.trial_days_remaining ?? 8)} jours utilisés</span>
                <span>14 jours</span>
              </div>
              <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${((14 - (sub.trial_days_remaining ?? 8)) / 14) * 100}%` }} />
              </div>
            </div>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              Ton essai se termine le {sub.current_period_end ?? "31 mars 2026"}. Ajoute ta carte pour continuer.
            </p>
            <button type="button" onClick={() => showToast("Redirection vers Stripe Checkout (Phase 2)")} className="h-11 px-6 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
              Ajouter ma carte →
            </button>
            <p className="text-[11px] text-[#4a4d56] mt-2">Si tu n&apos;ajoutes pas de carte, tu passeras au plan Gratuit.</p>
          </>
        )}

        {/* ── PRO tier (active) ─────────────────────────── */}
        {isPro && !isTrial && (
          <>
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Plan</span><span className="text-white font-bold">{tierLabel} ({sub.billing_cycle === "annual" ? "annuel" : "mensuel"})</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Prix</span><span className="text-white font-bold">{prices ? (sub.billing_cycle === "annual" ? prices.annual : prices.monthly) : "—"}</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Prochain renouvellement</span><span className="text-white">{sub.current_period_end ?? "15 avril 2026"}</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Membre Pro depuis</span><span className="text-white">janvier 2026</span></div>
            </div>
            <div className="border-t border-[#2D3748]/40 pt-4 mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Fonctionnalités incluses</p>
              <div className="space-y-2">
                {PRO_FEATURES[portal].map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
                    <span className="text-[13px] text-white">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => showToast("Redirection Stripe Customer Portal (Phase 2)")} className="h-10 px-5 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors">
                Gérer mon abonnement
              </button>
              <Link href="/tarifs" className="h-10 px-5 rounded-lg text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:text-white transition-colors inline-flex items-center">
                Changer de plan
              </Link>
            </div>
            {!sub.cancel_at_period_end && (
              <button type="button" onClick={() => setCancelModal(true)} className="block mt-3 text-[11px] text-[#E63946]/60 hover:text-[#E63946] transition-colors">
                Annuler mon abonnement
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Usage stats (free tier) ────────────────────────── */}
      {isFree && !isTrial && FREE_LIMITS[portal].length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FREE_LIMITS[portal].map((u) => {
            const pct = Math.round((u.current / u.max) * 100);
            const color = usageColor(pct);
            return (
              <div key={u.label} className="bg-[#1A1D24] rounded-xl border border-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">{u.label}</p>
                <p className="text-[15px] font-bold text-white mb-2">{u.current} / {u.max}</p>
                <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                {pct >= 100 && (
                  <p className="text-[11px] font-bold text-[#E63946] mt-1">Limite atteinte · <Link href="/tarifs" className="underline">Passe à Pro →</Link></p>
                )}
                {pct >= 80 && pct < 100 && (
                  <p className="text-[11px] font-bold text-[#EAB308] mt-1">Presque atteint!</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invoice history (pro) ──────────────────────────── */}
      {isPro && !isTrial && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
          <button type="button" onClick={() => setInvoicesOpen(!invoicesOpen)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Historique de facturation</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${invoicesOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {invoicesOpen && (
            <div className="px-5 pb-5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2D3748]">
                    {["Date", "Description", "Montant", "Statut", "Facture"].map((h) => (
                      <th key={h} className="py-2 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_INVOICES.map((inv, i) => (
                    <tr key={i} className="border-b border-[#2D3748]/30">
                      <td className="py-3 text-[12px] text-[#9CA3AF]">{inv.date}</td>
                      <td className="py-3 text-[12px] text-white">{inv.desc}</td>
                      <td className="py-3 text-[12px] text-white font-bold">{inv.amount}</td>
                      <td className="py-3"><span className="text-[10px] font-bold text-[#22C55E]">{inv.status} ✓</span></td>
                      <td className="py-3"><button type="button" onClick={() => showToast("Téléchargement facture (Phase 2)")} className="text-[11px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">PDF ↓</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-[#4a4d56] mt-3">Les factures incluent TPS (5%) et TVQ (9,975%)</p>
            </div>
          )}
        </div>
      )}

      {/* ── Referral info ──────────────────────────────────── */}
      {referralCode && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-4 border-l-2 border-l-[#22C55E]">
          <p className="text-[13px] text-[#9CA3AF]">
            Tu as été référé par l&apos;ambassadeur <span className="text-white font-bold">{referralCode}</span>. Cet ambassadeur gagne des récompenses lorsque tu utilises Nexus!
          </p>
        </div>
      )}

      {/* ── Demo tier switcher ─────────────────────────────── */}
      <div className="pt-4 border-t border-[#2D3748]/20">
        <p className="text-[10px] text-[#4a4d56]/60 mb-2">DÉMO : Changer de plan</p>
        <div className="flex gap-2">
          {(["free", "trial", "pro"] as const).map((t) => {
            const isActive = t === "free" ? isFree && !isTrial : t === "trial" ? isTrial : isPro && !isTrial;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  const raw = localStorage.getItem("nexus_user");
                  const user = raw ? JSON.parse(raw) : {};
                  if (t === "free") {
                    user.subscription = { tier: "free", status: "active", billing_cycle: null, current_period_end: null, trial_days_remaining: null, cancel_at_period_end: false };
                    user.tier = "free";
                  } else if (t === "trial") {
                    user.subscription = { tier: proTier, status: "trialing", billing_cycle: "monthly", current_period_end: "2026-04-06", trial_days_remaining: 8, cancel_at_period_end: false };
                    user.tier = proTier;
                  } else {
                    user.subscription = { tier: proTier, status: "active", billing_cycle: "monthly", current_period_end: "2026-04-15", trial_days_remaining: null, cancel_at_period_end: false };
                    user.tier = proTier;
                  }
                  localStorage.setItem("nexus_user", JSON.stringify(user));
                  window.location.reload();
                }}
                className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${
                  isActive ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#4a4d56] hover:text-[#6b7280]"
                }`}
              >
                {t === "free" ? "Gratuit" : t === "trial" ? "Pro (Essai)" : "Pro (Actif)"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cancel modal ───────────────────────────────────── */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCancelModal(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md mx-4">
            <h3 className="font-head text-lg font-black text-white mb-2">Annuler ton abonnement?</h3>
            <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-5">
              Tu garderas l&apos;accès à toutes les fonctionnalités Pro jusqu&apos;au {sub.current_period_end ?? "15 avril 2026"}. Après, tu passeras au plan Gratuit.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCancelModal(false)} className="flex-1 h-10 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors">
                Garder mon plan
              </button>
              <button type="button" onClick={() => { setCancelModal(false); showToast("Annulation planifiée (Phase 2)"); }} className="flex-1 h-10 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
