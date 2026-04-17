"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  useSubscription,
  type SubscriptionTier,
  type SubscriptionStatus,
} from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   SubscriptionSection — 3-tier subscription management panel.
   Canonical taxonomy: tier = "free" | "pro" | "all_star",
   role is separate ("coach" | "recruiter" | "athlete").
   Source of truth: useSubscription() hook (DB-backed).
═══════════════════════════════════════════════════════════════ */

type PortalType = "coach" | "recruteur" | "athlete";

const TIER_PRICES: Record<PortalType, { pro?: { monthly: string; annual: string }; all_star?: { monthly: string; annual: string } }> = {
  coach: {
    pro:      { monthly: "5,99 $/mois",  annual: "29,99 $/an" },
    all_star: { monthly: "29,99 $/mois", annual: "200 $/an"   },
  },
  recruteur: {
    pro:      { monthly: "9,99 $/mois",  annual: "89 $/an"    },
    all_star: { monthly: "29,99 $/mois", annual: "269 $/an"   },
  },
  athlete: {
    pro:      { monthly: "9,99 $/mois",  annual: "79 $/an"    },
  },
};

const FREE_LIMITS_COACH = ["Mon école — Bloqué", "Stats école — Bloqué", "Placement — Bloqué", "Ma réputation — Bloqué", "Analytics — Bloqué"];
const FREE_LIMITS_RECRUITER = ["Messagerie — Bloqué", "Analytics — Bloqué", "Gestion CÉGEP — Bloqué"];
const FREE_LIMITS_ATHLETE = ["CÉGEPs intéressés — Anonyme", "Alertes temps réel — Bloqué", "Graphique de vues — Bloqué", "Classement sport — Bloqué"];

const PRO_FEATURES_COACH = ["Mon école — Tableau de bord", "Stats école", "Placements", "Ma réputation", "Analytics"];
const PRO_FEATURES_RECRUITER = ["Pipeline illimité", "Favoris illimités", "Messagerie directe", "Analytics recrutement"];
const PRO_FEATURES_ATHLETE = ["Quels CÉGEPs consultent ton profil", "Alertes temps réel", "Graphique vues/semaine", "Classement sport", "Badge Pro"];

const ALLSTAR_EXCLUSIVES_COACH = ["Accès complet à toute la plateforme"];
const ALLSTAR_EXCLUSIVES_RECRUITER = ["Gestion CÉGEP (Dashboard, Recruteurs, Stats)", "Messages groupés (bulk messaging)", "Export PDF/CSV"];

const MOCK_INVOICES = [
  { date: "15 mars 2026", desc: "Mensuel", amount: "33,34 $", status: "Payé" },
  { date: "15 fév. 2026", desc: "Mensuel", amount: "33,34 $", status: "Payé" },
  { date: "15 jan. 2026", desc: "Mensuel", amount: "33,34 $", status: "Payé" },
];

function usageColor(pct: number) { return pct >= 100 ? "#E63946" : pct >= 80 ? "#EAB308" : "#22C55E"; }

function TierPill({ tier, label }: { tier: SubscriptionTier; label: string }) {
  const bg =
    tier === "all_star" ? "bg-[#E63946]/15 text-[#E63946]" :
    tier === "pro"      ? "bg-[#DAB65A]/15 text-[#DAB65A]" :
                          "bg-[#6B7280]/15 text-[#6B7280]";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${bg}`}>
      {tier === "all_star" && <span>★</span>}
      {label}
    </span>
  );
}

function CheckItem({ text, ok }: { text: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {ok ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
      )}
      <span className={`text-[13px] ${ok ? "text-white" : "text-[#6B7280]"}`}>{text}</span>
    </div>
  );
}

/** Portals that have an All-Star tier (athlete does not). */
function portalHasAllStar(portal: PortalType): boolean {
  return portal !== "athlete";
}

/** Build the label shown inside the current-plan pill. */
function currentPlanLabel(portal: PortalType, tier: SubscriptionTier, isAdmin: boolean): string {
  if (isAdmin) return portal === "coach" ? "Admin École" : "Admin CÉGEP";
  if (tier === "free") return "Gratuit";
  const portalLabel = portal === "coach" ? "Coach" : portal === "recruteur" ? "Recruteur" : "Athlète";
  return tier === "all_star" ? `${portalLabel} All Star` : `${portalLabel} Pro`;
}

/** Price for a tier on a given portal, by billing cycle. */
function priceFor(portal: PortalType, tier: SubscriptionTier, cycle: "monthly" | "annual" | null): string {
  const fallback = cycle === "annual" ? "annuel" : "mensuel";
  if (tier === "free") return "0 $/" + fallback;
  const bucket = TIER_PRICES[portal];
  const slot = tier === "pro" ? bucket.pro : bucket.all_star;
  if (!slot) return "—";
  return cycle === "annual" ? slot.annual : slot.monthly;
}

export default function SubscriptionSection({ portal }: { portal: PortalType }) {
  const {
    tier, status, billing, isSchoolAdmin, periodEnd, trialDaysRemaining,
    cancelAtPeriodEnd, subscription, refresh, loading,
  } = useSubscription();
  const [toast, setToast] = useState<string | null>(null);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const isFree = tier === "free";
  const isPro = tier === "pro";
  const isAllStar = tier === "all_star";
  const isTrial = status === "trialing";
  const hasAllStar = portalHasAllStar(portal);
  const displayedTier: SubscriptionTier = isSchoolAdmin ? "all_star" : tier;

  const label = currentPlanLabel(portal, tier, isSchoolAdmin);
  const renewal = periodEnd ? new Date(periodEnd).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "—";

  const freeLimits = portal === "coach" ? FREE_LIMITS_COACH : portal === "recruteur" ? FREE_LIMITS_RECRUITER : FREE_LIMITS_ATHLETE;
  const proFeatures = portal === "coach" ? PRO_FEATURES_COACH : portal === "recruteur" ? PRO_FEATURES_RECRUITER : PRO_FEATURES_ATHLETE;
  const allstarExclusives = portal === "coach" ? ALLSTAR_EXCLUSIVES_COACH : ALLSTAR_EXCLUSIVES_RECRUITER;

  /* ── Demo tier switcher (dev mode) ───────────────────────────
     Writes canonical tier strings to the `subscriptions` table via
     Supabase. The admin option toggles `users.is_school_admin`.
     Only active in NODE_ENV === "development".
  ─────────────────────────────────────────────────────────────── */
  async function setDemoAccess(next: "free" | "pro" | "all_star" | "admin") {
    if (busy || !subscription) return;
    setBusy(true);
    const supabase = createClient();
    const userId = subscription.userId;

    if (next === "admin") {
      await supabase.from("users").update({ is_school_admin: true }).eq("id", userId);
      await supabase.from("subscriptions").upsert(
        { user_id: userId, tier: "free", status: "active", billing_cycle: "monthly" },
        { onConflict: "user_id" },
      );
    } else {
      await supabase.from("users").update({ is_school_admin: false }).eq("id", userId);
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          tier: next,
          status: "active",
          billing_cycle: next === "free" ? null : "monthly",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }
    await refresh();
    setBusy(false);
  }

  type DemoOpt = { key: string; label: string; kind: "free" | "pro" | "all_star" | "admin" };
  const demoOptions: DemoOpt[] = [
    { key: "free", label: "Gratuit",                                                          kind: "free" },
    { key: "pro",  label: `${portal === "coach" ? "Coach" : portal === "recruteur" ? "Recruteur" : "Athlète"} Pro`, kind: "pro"  },
  ];
  if (hasAllStar) {
    demoOptions.push({ key: "allstar", label: `${portal === "coach" ? "Coach" : "Recruteur"} All Star`, kind: "all_star" });
  }
  if (portal !== "athlete") {
    demoOptions.push({ key: "admin", label: portal === "coach" ? "Admin École" : "Admin CÉGEP", kind: "admin" });
  }

  const isDemoActive = (opt: DemoOpt): boolean => {
    if (opt.kind === "admin") return isSchoolAdmin;
    if (isSchoolAdmin) return false;
    return tier === opt.kind;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Abonnement</h2>
        <p className="text-[13px] text-[#9CA3AF]">Gère ton plan et ta facturation</p>
      </div>

      {/* ── Current plan card ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6">
        <div className="mb-4"><TierPill tier={displayedTier} label={label} /></div>

        {/* ADMIN */}
        {isSchoolAdmin && (
          <>
            <p className="text-[15px] font-bold text-white mb-2">👑 {portal === "coach" ? "Admin École" : "Admin CÉGEP"}</p>
            <p className="text-[13px] text-[#9CA3AF] mb-4">Accès All Star inclus gratuitement via ton rôle d&apos;administrateur.</p>
            <div className="space-y-2 mb-4">
              {proFeatures.map((f) => <CheckItem key={f} text={f} ok />)}
              {hasAllStar && allstarExclusives.map((f) => <CheckItem key={f} text={f} ok />)}
            </div>
            <p className="text-[11px] text-[#4a4d56]">Si tu quittes le rôle d&apos;administrateur, tu passeras au plan Gratuit sauf si tu souscris.</p>
          </>
        )}

        {/* FREE */}
        {isFree && !isTrial && !isSchoolAdmin && (
          <>
            <p className="text-[15px] font-bold text-white mb-4">Tu utilises le plan Gratuit</p>
            <div className="space-y-2.5 mb-6">
              {freeLimits.map((lim) => <CheckItem key={lim} text={lim} ok={false} />)}
            </div>
            {/* Dual CTAs */}
            <div className={`grid gap-3 ${hasAllStar ? "grid-cols-1 sm:grid-cols-2" : ""}`}>
              <Link href="/tarifs" className="flex flex-col items-center justify-center h-auto py-4 px-4 rounded-xl border border-[#DAB65A]/40 hover:bg-[#DAB65A]/10 transition-colors text-center">
                <span className="font-head font-bold text-[13px] text-[#DAB65A] uppercase">Passer à Pro</span>
                <span className="text-[11px] text-[#6B7280] mt-1">{priceFor(portal, "pro", "monthly")}</span>
              </Link>
              {hasAllStar && (
                <Link href="/tarifs" className="flex flex-col items-center justify-center h-auto py-4 px-4 rounded-xl bg-[#E63946] hover:bg-[#D42B22] transition-colors text-center relative">
                  <span className="absolute -top-2 px-2 py-0.5 bg-[#E63946] border border-[#D42B22] rounded-full text-[8px] font-bold text-white uppercase tracking-wider">Populaire</span>
                  <span className="font-head font-bold text-[13px] text-white uppercase">Passer à All Star</span>
                  <span className="text-[11px] text-white/70 mt-1">{priceFor(portal, "all_star", "monthly")}</span>
                </Link>
              )}
            </div>
            <p className="text-[11px] text-[#4a4d56] text-center mt-2">Essai gratuit 14 jours · Aucune carte requise</p>
          </>
        )}

        {/* TRIAL */}
        {isTrial && !isSchoolAdmin && (
          <>
            <p className="text-[15px] font-bold text-white mb-2">Il te reste {trialDaysRemaining ?? 8} jours d&apos;essai</p>
            <div className="mb-4">
              <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${((14 - (trialDaysRemaining ?? 8)) / 14) * 100}%` }} />
              </div>
            </div>
            <button type="button" onClick={() => showToast("Redirection Stripe Checkout (Phase 2)")} className="h-11 px-6 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
              Ajouter ma carte →
            </button>
          </>
        )}

        {/* PRO (active) */}
        {isPro && !isTrial && !isSchoolAdmin && (
          <>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Plan</span><span className="text-white font-bold">{label} ({billing === "annual" ? "annuel" : "mensuel"})</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Prix</span><span className="text-white font-bold">{priceFor(portal, "pro", billing)}</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Renouvellement</span><span className="text-white">{renewal}</span></div>
            </div>
            <div className="border-t border-[#2D3748]/40 pt-4 mb-4">
              <div className="space-y-2">
                {proFeatures.map((f) => <CheckItem key={f} text={f} ok />)}
              </div>
            </div>
            {hasAllStar && (
              <div className="border-t border-[#2D3748]/40 pt-4 mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">Exclusif All Star</p>
                <div className="space-y-2 mb-4">
                  {allstarExclusives.map((f) => <CheckItem key={f} text={f} ok={false} />)}
                </div>
                <Link href="/tarifs" className="inline-flex items-center h-10 px-5 rounded-lg bg-[#E63946] text-white font-head font-bold text-[11px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
                  Passer à All Star →
                </Link>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => showToast("Redirection Stripe Customer Portal (Phase 2)")} className="h-10 px-5 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors">
                Gérer mon abonnement
              </button>
            </div>
            {!cancelAtPeriodEnd && (
              <button type="button" onClick={() => setCancelModal(true)} className="block mt-3 text-[11px] text-[#E63946]/60 hover:text-[#E63946] transition-colors">Annuler</button>
            )}
          </>
        )}

        {/* ALL STAR (active) */}
        {isAllStar && !isTrial && !isSchoolAdmin && (
          <>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Plan</span><span className="text-white font-bold">{label} ({billing === "annual" ? "annuel" : "mensuel"})</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Prix</span><span className="text-white font-bold">{priceFor(portal, "all_star", billing)}</span></div>
              <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Renouvellement</span><span className="text-white">{renewal}</span></div>
            </div>
            <div className="border-t border-[#2D3748]/40 pt-4 mb-4">
              <div className="space-y-2">
                {proFeatures.map((f) => <CheckItem key={f} text={f} ok />)}
                {allstarExclusives.map((f) => <CheckItem key={f} text={f} ok />)}
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
            {!cancelAtPeriodEnd && (
              <button type="button" onClick={() => setCancelModal(true)} className="block mt-3 text-[11px] text-[#E63946]/60 hover:text-[#E63946] transition-colors">Annuler</button>
            )}
          </>
        )}
      </div>

      {/* ── Usage stats (free recruteur only) ── */}
      {isFree && !isTrial && !isSchoolAdmin && portal === "recruteur" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Consultations ce mois", current: 3, max: 5 },
            { label: "Favoris", current: 7, max: 10 },
            { label: "Pipeline", current: 32, max: 50 },
          ].map((u) => {
            const pct = Math.round((u.current / u.max) * 100);
            return (
              <div key={u.label} className="bg-[#1A1D24] rounded-xl border border-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">{u.label}</p>
                <p className="text-[15px] font-bold text-white mb-2">{u.current} / {u.max}</p>
                <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: usageColor(pct) }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invoice history ── */}
      {(isPro || isAllStar) && !isTrial && !isSchoolAdmin && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
          <button type="button" onClick={() => setInvoicesOpen(!invoicesOpen)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Historique de facturation</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${invoicesOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {invoicesOpen && (
            <div className="px-5 pb-5">
              <table className="w-full">
                <thead><tr className="border-b border-[#2D3748]">{["Date", "Description", "Montant", "Statut"].map((h) => <th key={h} className="py-2 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{h}</th>)}</tr></thead>
                <tbody>{MOCK_INVOICES.map((inv, i) => (
                  <tr key={i} className="border-b border-[#2D3748]/30">
                    <td className="py-3 text-[12px] text-[#9CA3AF]">{inv.date}</td>
                    <td className="py-3 text-[12px] text-white">{label} — {inv.desc}</td>
                    <td className="py-3 text-[12px] text-white font-bold">{inv.amount}</td>
                    <td className="py-3"><span className="text-[10px] font-bold text-[#22C55E]">{inv.status} ✓</span></td>
                  </tr>
                ))}</tbody>
              </table>
              <p className="text-[11px] text-[#4a4d56] mt-3">TPS (5%) et TVQ (9,975%) incluses</p>
            </div>
          )}
        </div>
      )}

      {/* ── Demo tier switcher (dev-mode only) ── */}
      {process.env.NODE_ENV === "development" && (
        <div className="pt-4 border-t border-[#2D3748]/20">
          <p className="text-[10px] text-[#4a4d56]/60 mb-2">DÉMO : Simuler un plan (écrit dans la DB)</p>
          <div className="flex flex-wrap gap-2">
            {demoOptions.map((opt) => {
              const active = isDemoActive(opt);
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={busy}
                  onClick={() => setDemoAccess(opt.kind)}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold transition-colors ${
                    active ? "bg-[#E63946]/15 text-[#E63946]" : "text-[#4a4d56] hover:text-[#6b7280]"
                  } ${busy ? "opacity-50 cursor-wait" : ""}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCancelModal(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md mx-4">
            <h3 className="font-head text-lg font-black text-white mb-2">Annuler ton abonnement?</h3>
            <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-5">
              Tu garderas l&apos;accès jusqu&apos;au {renewal}. Après, tu passeras au plan Gratuit.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCancelModal(false)} className="flex-1 h-10 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors">Garder</button>
              <button type="button" onClick={() => { setCancelModal(false); showToast("Annulation planifiée (Phase 2)"); }} className="flex-1 h-10 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>
      )}
    </div>
  );
}
