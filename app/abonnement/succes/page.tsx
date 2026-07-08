"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/* ═══════════════════════════════════════════════════════════════
   /abonnement/succes — page de remerciement post-paiement.

   Page TERMINALE autonome : elle s'affiche dans le popup browser
   (in-app Capacitor Browser ou onglet web) ouvert pour le checkout
   Stripe. L'utilisateur ne "navigue" pas dans l'app ici — il lit le
   message puis ferme la fenêtre et retourne dans l'app. C'est tout
   l'intérêt : éviter de recharger l'app complète (vide) dans le popup.

   Volontairement SANS chrome d'app : pas de sidebar, pas de nav, et
   aucune dépendance au SubscriptionProvider / gates / hooks d'abonnement.
   Message UNIQUE pour tous les rôles, tutoiement.

   Deux états via ?checkout= : success (check vert) | canceled (neutre).
═══════════════════════════════════════════════════════════════ */

function MerciContent() {
  const params = useSearchParams();
  const canceled = params.get("checkout") === "canceled";

  const handleClose = () => {
    // Best-effort : fonctionne pour les fenêtres ouvertes par script. En
    // in-app browser Capacitor, le chrome natif possède son propre bouton
    // de fermeture — V1 : on NE tente PAS de fermeture native programmatique.
    try { window.close(); } catch { /* no-op */ }
  };

  return (
    <div className="min-h-screen bg-[#111317] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-[#1A1D24] border border-[#2D3748] rounded-2xl p-8 text-center">
        {!canceled && (
          <div className="w-16 h-16 rounded-full bg-[#22C55E]/15 flex items-center justify-center mx-auto mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        )}
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          {canceled ? "Paiement annulé" : "Merci pour ton achat!"}
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-3 leading-relaxed">
          {canceled
            ? "Tu peux fermer cette fenêtre et retourner dans l'app."
            : "Ton abonnement est activé. Tu peux fermer cette fenêtre et retourner dans l'app."}
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="mt-6 inline-flex items-center justify-center w-full h-11 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-wider transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export default function SuccesPage() {
  // Suspense boundary required around useSearchParams (Next App Router).
  return (
    <Suspense fallback={null}>
      <MerciContent />
    </Suspense>
  );
}
