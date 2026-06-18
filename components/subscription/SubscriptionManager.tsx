"use client";

import { useEffect, useState } from "react";
import {
  getTiersForPersona,
  PERSONA_SAVINGS,
  type Persona,
  type Tier,
  type FeatureRow,
} from "@/lib/config/pricing";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   SubscriptionManager — unified, role-parameterized subscription UI.

   Replaces (Sprint 3) the 3 parallel implementations:
   RecruiterPricingSection (recruteur), CoachPricingSection (coach),
   SubscriptionSection (athlete).

   Source of truth:
   - Cards/prices: lib/config/pricing.ts (getTiersForPersona)
   - Current tier / billing / portal state: useSubscription()
   - Checkout/portal: /api/stripe/checkout + /api/stripe/portal
   WEB only — mobile Capacitor wrapping is a later sub-sprint.

   Design canon: gold #F59E0B, green checks #22C55E, surface #1A1D24,
   bg #111317, red #E63946, Outfit font.
═══════════════════════════════════════════════════════════════ */

export interface SubscriptionManagerProps {
  role: "RECRUTEUR" | "COACH" | "ATHLETE";
  /** COACH only — swaps "Mon École" style feature labels to "Ma Ligue". */
  isCivilCoach?: boolean;
  className?: string;
}

type TierKey = "free" | "pro" | "all_star";

/* Display tier id → checkout tier. SAME mapping app/tarifs/page.tsx
   handleCheckout uses (rec_pro→pro, *_allstar→all_star, …). */
const CHECKOUT_TIER: Record<string, "pro" | "all_star"> = {
  rec_pro: "pro",
  rec_allstar: "all_star",
  "coach-pro": "pro",
  coach_allstar: "all_star",
  ath_pro: "pro",
};

function personaFor(role: SubscriptionManagerProps["role"]): Persona {
  return role === "RECRUTEUR" ? "recruteur" : role === "COACH" ? "coach" : "athlete";
}

/** Canonical tier bucket from a pricing.ts display id. */
function tierKeyOf(displayId: string): TierKey {
  if (displayId.includes("allstar")) return "all_star";
  if (displayId.includes("pro")) return "pro";
  return "free";
}

/** Civil-league coaches: swap school vocabulary to league vocabulary.
    Ordered longest/most-specific first so partial overlaps don't clash. */
function civilizeLabel(label: string): string {
  return label
    .replace(/Mon École/g, "Ma Ligue")
    .replace(/Mon école/g, "Ma ligue")
    .replace(/Stats École/g, "Stats Ligue")
    .replace(/Stats école/g, "Stats ligue")
    .replace(/de l'école/gi, "de la ligue")
    .replace(/l'école/gi, "la ligue")
    .replace(/une école/gi, "une ligue")
    .replace(/d'école/gi, "de ligue")
    .replace(/École/g, "Ligue")
    .replace(/école/g, "ligue");
}

/* ── Price formatting (fr-CA) ─────────────────────────────────── */

function formatAmount(n: number, cycle: "monthly" | "annual"): string {
  if (n === 0) return "0 $";
  if (cycle === "annual") return `${Math.round(n)} $`;
  return `${n.toFixed(2).replace(".", ",")} $`;
}

/* ═══════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════ */

export default function SubscriptionManager({
  role,
  isCivilCoach = false,
  className = "",
}: SubscriptionManagerProps) {
  const {
    tier, billing, periodEnd, cancelAtPeriodEnd,
    tierLabel, refresh, loading,
  } = useSubscription();

  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [checkoutBusyTier, setCheckoutBusyTier] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Returning from Stripe (checkout or portal). Reflect the outcome, then
  // strip the query param so a manual reload doesn't replay it:
  //  - checkout=success → re-pull tier + confirmation toast
  //  - checkout=canceled → subtle "nothing happened" toast, no refetch
  //  - portal=return → re-pull tier (plan may have changed in the portal)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const checkout = q.get("checkout");
    const portal = q.get("portal");
    if (!checkout && portal !== "return") return;

    if (checkout === "success" || portal === "return") refresh();

    const msg =
      checkout === "success" ? "Abonnement activé" :
      checkout === "canceled" ? "Paiement annulé" :
      null;
    if (msg) {
      setToast(msg);
      setTimeout(() => setToast(null), 3500);
    }

    // Clean the URL so a refresh doesn't re-toast / re-refetch.
    q.delete("checkout");
    q.delete("portal");
    const qs = q.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [refresh]);

  if (loading) return null;

  const persona = personaFor(role);
  const tiers = getTiersForPersona(persona);
  const savingsPct = PERSONA_SAVINGS[persona];

  // Coach All Star is "Bientôt disponible" (not purchasable). A legacy/admin
  // all_star read collapses to "pro" for COACH so "Plan actuel" matches Pro.
  const currentTierKey: TierKey =
    role === "COACH" && tier === "all_star" ? "pro" : (tier as TierKey);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  /* ── Behavior ───────────────────────────────────────────────── */

  async function handleCheckout(displayTierId: string) {
    const mappedTier = CHECKOUT_TIER[displayTierId];
    if (!mappedTier || checkoutBusyTier) return;
    setCheckoutBusyTier(displayTierId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: mappedTier, cycle }),
      });
      if (res.status === 401) { window.location.href = "/auth"; return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[SubscriptionManager] checkout error:", err);
        showToast(err.error || "Erreur lors de la création du paiement. Réessayez.");
        return;
      }
      const { url } = await res.json();
      if (url) { window.location.href = url; return; }
    } catch (err) {
      console.error("[SubscriptionManager] checkout error:", err);
      showToast("Erreur lors de la création du paiement. Réessayez.");
    } finally {
      setCheckoutBusyTier(null);
    }
  }

  async function handlePortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 401) { window.location.href = "/auth"; return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[SubscriptionManager] portal error:", err);
        showToast(err.error || "Erreur lors de l'ouverture du portail. Réessayez.");
        return;
      }
      const { url } = await res.json();
      if (url) { window.location.href = url; return; }
    } catch (err) {
      console.error("[SubscriptionManager] portal error:", err);
      showToast("Erreur lors de l'ouverture du portail. Réessayez.");
    } finally {
      setPortalBusy(false);
    }
  }

  /* ── Render. School/CÉGEP admin status is independent of the Stripe
        subscription and does NOT appear here — admins see the exact
        same plan banner + pricing cards as everyone else, reflecting
        their real tier. ──────────────────────────────────────────── */
  const isPaid = currentTierKey !== "free";

  return (
    <div className={`space-y-6 ${className}`}>
      <SectionHeader />

      {/* 1. Current plan banner */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          {/* Per-tier dot color : matches the canon sidebar/tier-card
              accents (free = green active dot, Pro = gold ★, All Star =
              red ★★, same red #E63946 used by the "ALL STAR" pill on
              the tier card below). Stops the pill from reading as "Pro"
              when the actual plan is All Star. */}
          <span className={`w-2.5 h-2.5 rounded-full ${
            currentTierKey === "all_star" ? "bg-[#E63946]"
              : currentTierKey === "pro" ? "bg-[#F59E0B]"
              : "bg-[#22C55E]"
          }`} />
          <span className="text-[14px] font-bold text-white">
            Plan actuel : <span className="uppercase">{tierLabel()}</span>
            {isPaid && billing && (
              <span className="text-[#9CA3AF] font-normal"> ({billing === "annual" ? "annuel" : "mensuel"})</span>
            )}
          </span>
        </div>
        {!isPaid && (
          <p className="text-[13px] text-[#9CA3AF] mt-1 ml-[18px]">
            Passe à un plan payant pour débloquer tout le potentiel de Nexus.
          </p>
        )}
      </div>

      {/* 2. Manage block — paid, non-admin only */}
      {isPaid && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <div className="space-y-2 mb-4">
            <Row label="Plan" value={tierLabel()} />
            <Row label="Cycle" value={billing === "annual" ? "Annuel" : "Mensuel"} />
            {/* Renouvellement only when the plan is NOT ending — otherwise it
                contradicts the "se termine le" line below (same date). */}
            {!cancelAtPeriodEnd && (
              <Row label="Renouvellement" value={fmtDate(periodEnd)} />
            )}
          </div>
          {/* Cancellation notice shows IN ADDITION to the portal button (not
              instead of it) — a canceled user still needs the portal to
              reactivate / update card / see invoices. */}
          {cancelAtPeriodEnd && (
            <p className="text-[13px] text-[#E63946] mb-3">
              Ton abonnement se termine le {fmtDate(periodEnd)}.
            </p>
          )}
          {/* Portal button: always available while paid. The portal route
              resolves stripe_customer_id server-side. */}
          <button
            type="button"
            onClick={handlePortal}
            disabled={portalBusy}
            className={`h-10 px-5 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors ${portalBusy ? "opacity-60 cursor-wait" : ""}`}
          >
            {portalBusy ? "Ouverture..." : "Gérer mon abonnement"}
          </button>
          <p className="text-[11px] text-[#4a4d56] mt-3">
            Annulation, mode de paiement et factures sont gérés dans le portail sécurisé Stripe.
          </p>
        </div>
      )}

      {/* 3. Billing cycle toggle */}
      <BillingCycleToggle cycle={cycle} onChange={setCycle} savingsPct={savingsPct} />

      {/* 4. Pricing cards */}
      <div className={`grid grid-cols-1 gap-5 ${tiers.length === 2 ? "md:grid-cols-2 max-w-[680px] mx-auto" : "md:grid-cols-3"}`}>
        {tiers.map((t) => (
          <TierCard
            key={t.id}
            tier={t}
            cycle={cycle}
            isCivilCoach={isCivilCoach && role === "COACH"}
            currentTierKey={currentTierKey}
            checkoutBusyTier={checkoutBusyTier}
            onCheckout={handleCheckout}
            isPaid={isPaid}
            onManage={handlePortal}
            portalBusy={portalBusy}
          />
        ))}
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════ */

function SectionHeader() {
  return (
    <div>
      <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Abonnement</h2>
      <p className="text-[14px] text-[#6b7280] mt-1">Gère ton plan et ta facturation</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-[#9CA3AF]">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
}

function BillingCycleToggle({
  cycle, onChange, savingsPct,
}: {
  cycle: "monthly" | "annual";
  onChange: (c: "monthly" | "annual") => void;
  savingsPct: number;
}) {
  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={`px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${cycle === "monthly" ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"}`}
        >
          Mensuel
        </button>
        <button
          type="button"
          onClick={() => onChange("annual")}
          className={`px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${cycle === "annual" ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"}`}
        >
          Annuel
          {savingsPct > 0 && <span className="text-[10px] font-normal ml-1 opacity-80">(économise {savingsPct}%)</span>}
        </button>
      </div>
    </div>
  );
}

function TierCard({
  tier, cycle, isCivilCoach, currentTierKey, checkoutBusyTier, onCheckout,
  isPaid, onManage, portalBusy,
}: {
  tier: Tier;
  cycle: "monthly" | "annual";
  isCivilCoach: boolean;
  currentTierKey: TierKey;
  checkoutBusyTier: string | null;
  onCheckout: (displayTierId: string) => void;
  /** Already on a paid plan → other tiers route to the portal (clean swap
   *  with proration) instead of a fresh checkout (which would STACK a 2nd
   *  Stripe subscription / double-bill). */
  isPaid: boolean;
  onManage: () => void;
  portalBusy: boolean;
}) {
  const key = tierKeyOf(tier.id);
  const isCurrent = key === currentTierKey;
  const isFree = key === "free";
  const comingSoon = Boolean(tier.comingSoon);
  const amount = cycle === "annual" ? tier.annual : tier.monthly;
  const busy = checkoutBusyTier === tier.id;

  return (
    <div className={`relative bg-[#1A1D24] rounded-xl border ${tier.border} ${tier.glow} p-6 flex flex-col`}>
      {/* Badge: coming-soon overrides the marketing badge */}
      {comingSoon ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#6B7280] text-white">
          Bientôt disponible
        </span>
      ) : tier.badge ? (
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${tier.badge.bg} ${tier.badge.fg}`}>
          {tier.badge.label}
        </span>
      ) : null}

      {/* Name */}
      <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight mt-1">
        {key !== "free" && <span className="text-[#F59E0B] mr-1">{key === "pro" ? "★" : "★★"}</span>}
        {tier.name}
      </h3>

      {/* Price — hidden for comingSoon */}
      <div className="mt-3 min-h-[52px]">
        {comingSoon ? (
          <p className="text-[14px] text-[#9CA3AF] font-bold">Bientôt disponible</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-[32px] font-black text-white leading-none">{formatAmount(amount, cycle)}</span>
              {amount > 0 && <span className="text-[14px] text-[#6b7280]">{cycle === "annual" ? "/an" : "/mois"}</span>}
            </div>
            {amount > 0 && cycle === "annual" && tier.annualMonthlyEq != null && (
              <p className="text-[12px] text-[#22C55E] mt-1 font-bold">
                ≈ {tier.annualMonthlyEq.toFixed(2).replace(".", ",")} $/mois
              </p>
            )}
            {amount > 0 && cycle === "monthly" && tier.annual > 0 && (
              <p className="text-[11px] text-[#6b7280] mt-1">ou {Math.round(tier.annual)} $/an</p>
            )}
          </>
        )}
      </div>

      <div className="h-px bg-[#2D3748] my-4" />

      {/* Features */}
      <div className="space-y-2.5 flex-1">
        {tier.featuresHeader && (
          <p className="text-[12px] font-bold text-[#F59E0B] uppercase tracking-wider">{tier.featuresHeader}</p>
        )}
        {tier.features.map((f, i) => (
          <FeatureLine key={i} row={f} isCivilCoach={isCivilCoach} />
        ))}
      </div>

      {/* CTA */}
      <div className="mt-5">
        {comingSoon ? (
          <button type="button" disabled className="w-full py-2.5 rounded-lg text-[13px] font-bold bg-[#2D3748] text-[#6b7280] cursor-not-allowed">
            Bientôt disponible
          </button>
        ) : isCurrent ? (
          <button type="button" disabled className="w-full py-2.5 rounded-lg text-[13px] font-bold bg-[#2D3748] text-[#6b7280] cursor-not-allowed">
            Plan actuel
          </button>
        ) : isFree ? (
          <button type="button" disabled className="w-full py-2.5 rounded-lg text-[13px] font-bold bg-[#2D3748] text-[#6b7280] cursor-not-allowed">
            Gratuit
          </button>
        ) : isPaid ? (
          // Already paying → a different paid tier is a PLAN CHANGE, handled
          // by the Stripe portal (swap + proration), never a new checkout.
          <button
            type="button"
            onClick={onManage}
            disabled={portalBusy}
            className={`w-full py-2.5 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${tier.ctaClass} ${portalBusy ? "opacity-60 cursor-wait" : ""}`}
          >
            {portalBusy ? "Ouverture..." : "Changer de plan"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCheckout(tier.id)}
            disabled={busy}
            className={`w-full py-2.5 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${tier.ctaClass} ${busy ? "opacity-60 cursor-wait" : ""}`}
          >
            {busy ? "Redirection..." : tier.ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureLine({ row, isCivilCoach }: { row: FeatureRow; isCivilCoach: boolean }) {
  if (row.kind === "section") {
    const label = isCivilCoach ? civilizeLabel(row.label) : row.label;
    return <p className="pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">{label}</p>;
  }
  const label = isCivilCoach ? civilizeLabel(row.label) : row.label;
  return (
    <div className="flex items-start gap-2">
      {row.included ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
      )}
      <span className={`text-[13px] ${row.included ? "text-[#e0e0e0]" : "text-[#4a4d56] line-through"}`}>{label}</span>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-xl">
      {msg}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}
