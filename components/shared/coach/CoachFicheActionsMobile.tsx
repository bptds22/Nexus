"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachFicheActionsMobile — les boutons flottants du coach sur la
   fiche athlète mobile.

   ── DEUX BOUTONS, EMPILÉS ───────────────────────────────────────
   MODIFIER (56px, plein rouge, crayon) porte la gestion : au tap, une
   feuille à deux entrées — Modifier le profil, Transférer.
   MESSAGE (48px, fond sombre + bordure fine, enveloppe) agit
   DIRECTEMENT : écrire à l'athlète est un geste fréquent, le faire
   traverser une feuille lui coûtait deux taps pour rien.

   EMPILÉS, pas côte à côte. La tab bar est une pilule flottante qui
   court de `left:14` à `right:14` : une paire horizontale posée dessus
   se lirait comme une seconde barre d'outils en concurrence. Empilés,
   les deux boutons tiennent une seule colonne alignée sur la gouttière
   de page (EDGE_X = 16), et la hiérarchie se lit à la TAILLE (56 vs 48)
   autant qu'à la couleur — le secondaire n'a donc pas besoin de crier.
   Le principal est en bas, le plus près du pouce.

   ── DÉGAGEMENT DE LA TAB BAR ────────────────────────────────────
   Elle est posée à `bottom: safe + 10` et fait TABBAR_HEIGHT (64) de
   haut : son bord supérieur est donc à safe + 74. L'ancien FAB était à
   safe + 80 — SIX pixels de marge, et en z-30 sous une barre en z-40 :
   les ombres se chevauchaient. Le principal part maintenant de
   safe + 74 + 16 de respiration.

   ── L'ANNEAU ────────────────────────────────────────────────────
   Un liseré noir à faible opacité, plus une ombre portée sombre. La
   fiche affiche des cartes et des pastilles rouges : sans lui, un
   bouton rouge posé sur un fond rouge perd son contour. L'anneau ne se
   voit pas sur fond sombre et sauve la lisibilité sur fond clair ou
   coloré.

   ── LE ⋮ EST MORT ───────────────────────────────────────────────
   Il ne reste aucun menu « trois points » sur cette fiche : les gestes
   sont nommés, ou ils n'existent pas.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { createPortal } from "react-dom";
import { triggerHaptic } from "@/lib/haptics";
import { TABBAR_HEIGHT, EDGE_X } from "@/lib/config/mobileTokens";

/** Bord supérieur de la tab bar (elle est décollée de 10px du bas). */
const TABBAR_TOP = TABBAR_HEIGHT + 10;
/** Respiration entre la barre et le premier bouton. */
const RESPIRATION = 16;

const ANNEAU = "0 0 0 1px rgba(0,0,0,0.55)";

export interface CoachFicheAction {
  /** Libellé écrit, jamais une icône seule. */
  libelle: string;
  /** La ligne de contexte sous le libellé. */
  contexte: string;
  icone: React.ReactNode;
  onTap: () => void;
}

export interface CoachFicheActionDirecte {
  libelle: string;
  icone: React.ReactNode;
  onTap: () => void;
}

export default function CoachFicheActionsMobile({
  athleteName,
  actions,
  actionDirecte,
  masque = false,
}: {
  athleteName: string;
  /** Les gestes de GESTION, derrière le bouton principal. Une action
   *  absente ne s'affiche pas — plutôt que de s'afficher grisée. */
  actions: CoachFicheAction[];
  /** Le geste FRÉQUENT, au tap direct, sans feuille. */
  actionDirecte?: CoachFicheActionDirecte;
  /** Efface les boutons quand une autre surface flottante occupe l'écran. */
  masque?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);

  if (actions.length === 0 && !actionDirecte) return null;

  return (
    <>
      {typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-30 flex flex-col items-end gap-3"
          style={{
            right: EDGE_X,
            bottom: `calc(env(safe-area-inset-bottom) + ${TABBAR_TOP + RESPIRATION}px)`,
            opacity: masque ? 0 : 1,
            pointerEvents: masque ? "none" : "auto",
            transition: "opacity 200ms ease",
          }}
        >
          {/* SECONDAIRE — action directe, 48px, sombre à bordure fine. */}
          {actionDirecte && (
            <button
              type="button"
              onClick={() => { void triggerHaptic("Light"); actionDirecte.onTap(); }}
              aria-label={actionDirecte.libelle}
              className="w-12 h-12 rounded-full bg-[#1A1D24] border border-white/[0.14] text-white flex items-center justify-center active:bg-white/[0.06]"
              style={{ boxShadow: `${ANNEAU}, 0 6px 18px rgba(0,0,0,0.45)` }}
            >
              {actionDirecte.icone}
            </button>
          )}

          {/* PRINCIPAL — ouvre la feuille de gestion, 56px, plein rouge. */}
          {actions.length > 0 && (
            <button
              type="button"
              onClick={() => { void triggerHaptic("Light"); setOuverte(true); }}
              aria-label="Gérer l'athlète"
              aria-haspopup="dialog"
              className="w-14 h-14 rounded-full bg-[#E63946] text-white flex items-center justify-center active:bg-[#D42B22]"
              style={{ boxShadow: `${ANNEAU}, 0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(230,57,70,0.3)` }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          )}
        </div>,
        document.body,
      )}

      {/* Patron repris tel quel de la feuille « Contacter » de la fiche :
          poignée, titre, sous-titre, rangées icône + libellé + ligne de
          contexte, Annuler. */}
      {ouverte && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOuverte(false)} />
          <div className="relative w-full max-w-[520px] bg-[#1A1D24] border-t border-white/[0.08] rounded-t-3xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Gérer</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-4">{athleteName || "Cet athlète"}</p>
            <div className="space-y-3">
              {actions.map((act) => (
                <button
                  key={act.libelle}
                  type="button"
                  onClick={() => { setOuverte(false); act.onTap(); }}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-[#111317] border border-[#2D3748] active:bg-[#E63946]/[0.06] transition-colors text-left"
                >
                  <span className="w-10 h-10 rounded-lg bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                    {act.icone}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold text-white">{act.libelle}</span>
                    <span className="block text-[12px] text-[#6b7280]">{act.contexte}</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOuverte(false)}
              className="mt-4 w-full rounded-xl px-4 py-3 text-[13px] font-bold text-[#9CA3AF] active:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
