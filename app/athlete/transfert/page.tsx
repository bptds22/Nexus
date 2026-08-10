"use client";

import { useState } from "react";
import MonEquipeSection from "@/components/athlete/MonEquipeSection";

/* ═══════════════════════════════════════════════════════════════════════════
   /athlete/transfert — l'écran de transfert d'équipe, sorti des paramètres.

   ── POURQUOI IL A DÉMÉNAGÉ ──────────────────────────────────────────────────
   Il vivait dans un onglet de /athlete/parametres, ce qui posait deux
   problèmes.
     · Sur MOBILE il n'existait pas du tout : la page des paramètres branche sur
       AthleteParametresMobile (une implémentation distincte), qui n'a jamais
       porté cet onglet. Le transfert était donc web-seulement, sans que ce soit
       une décision.
     · Le lien du courriel d'invitation visait /athlete/parametres?tab=transfert,
       un paramètre que PERSONNE ne lisait — la page tenait son onglet dans un
       useState initialisé en dur sur « compte ». L'athlète atterrissait sur
       « Compte » et devait trouver l'onglet lui-même.
   Une route à part règle les deux d'un coup : même URL, même composant, sur les
   deux plateformes — cette page n'a PAS de branche IS_CAPACITOR, et c'est le
   point.

   ── DÉPLACEMENT, PAS RÉÉCRITURE ─────────────────────────────────────────────
   MonEquipeSection est monté tel quel. Ses trois enfants tournent déjà en
   Capacitor : JoinCodeField et TransferConfirmDialog sont montés par
   AthleteOnboardingMobile, et SchoolSelect est un composant client sans
   dépendance serveur. Rien n'est dupliqué.

   ── CE QUI N'EST PAS FAIT ICI ───────────────────────────────────────────────
   Le préremplissage depuis `?t=<jeton>` n'est PAS câblé. Le courriel transporte
   le jeton, la page l'ignore pour l'instant — l'athlète voit le bon écran et
   saisit son code à la main. C'était déjà le cas avant ce déplacement ; le
   brancher est un ticket à part.
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AthleteTransfertPage() {
  /* Même mécanique de toast que la page des paramètres d'où l'écran vient :
     MonEquipeSection ne rend aucun toast lui-même, il notifie par onToast. */
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
          Mon équipe
        </h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Rejoins une équipe avec un code, ou cherche-la toi-même.
        </p>
      </header>

      <MonEquipeSection onToast={showToast} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] rounded-lg bg-[#1A1D24] border border-[#2D3748] px-5 py-3 shadow-lg">
          <span className="text-[13px] font-bold text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}
