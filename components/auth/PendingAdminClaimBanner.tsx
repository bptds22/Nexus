"use client";

import { useEffect, useState } from "react";
import { useAdminClaim } from "@/lib/hooks/useAdminClaim";

/* ─────────────────────────────────────────────────────────────────
   PendingAdminClaimBanner — Item 11-Security

   Top-of-portal banner that surfaces the PENDING_VERIFICATION state
   to users whose Directeur / Interim claim is still being reviewed
   by a platform admin.

   Rendered from app/coach/layout.tsx + app/recruteur/layout.tsx
   (beneath PreMaintenanceBanner) so it persists across every route the
   pending user can reach. Suppressed for APPROVED / REJECTED / no-claim.

   The companion ReadOnlyIfPending wrapper disables mutation surfaces
   while this banner is visible.

   Mobile (Capacitor, overlaysWebView:true) : le haut de la colonne = bord
   physique sous le Dynamic Island. La bannière porte donc son propre
   padding-top safe-area (sinon le texte passe sous l'heure/batterie).

   Fermable : ✕ → dismissed en sessionStorage (PAS localStorage) → la
   bannière revient au prochain lancement tant que le compte est PENDING
   (on n'enterre pas une info de conformité Loi 25). Fail-safe : si
   sessionStorage est indisponible, la bannière reste visible.
───────────────────────────────────────────────────────────────── */

const DISMISS_KEY = "pending_admin_banner_dismissed";

export default function PendingAdminClaimBanner() {
  const { claim, loading } = useAdminClaim();
  const [dismissed, setDismissed] = useState(false);

  // Lecture sessionStorage APRÈS mount (évite tout mismatch d'hydratation).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* fail-safe : storage indispo → bannière visible */
    }
  }, []);

  if (loading || !claim || claim.status !== "PENDING" || dismissed) return null;

  const roleLabel = claim.claim_type === "DIRECTEUR" ? "Directeur sportif" : "Directeur intérimaire";
  const target = claim.school_name ? ` pour ${claim.school_name}` : "";

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* no-op : la fermeture reste effective pour le rendu courant */
    }
  }

  return (
    <div
      role="alert"
      className="bg-[#F59E0B]/10 border-b border-[#F59E0B]/30 px-4 py-3 text-[13px] text-[#FCD34D]"
      // overlaysWebView:true → le texte doit passer SOUS la status bar / island.
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      <div className="max-w-[1280px] mx-auto flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="leading-snug">
          <strong className="font-bold uppercase tracking-wider text-[12px]">Compte en attente d&apos;approbation</strong>{" "}
          <span>
            Ton rôle de {roleLabel}{target} est en révision (équipe Nexus, ~24h).
            Accès en lecture seule pendant la vérification.
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer cet avis"
          className="shrink-0 -mt-1 -mr-1 w-9 h-9 flex items-center justify-center rounded-full text-[#FCD34D]/70 hover:text-[#FCD34D] active:bg-[#F59E0B]/15 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
