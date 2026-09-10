"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachFicheActionsMobile — le FAB du coach et sa feuille d'actions,
   sur la fiche athlète mobile (Lot D3).

   ── CE QUI MEURT AVEC CE COMPOSANT ──────────────────────────────
   Une barre collée en bas portant trois boutons : Message (contour
   vert), Transférer (contour bleu, ICÔNE SEULE) et Modifier le profil
   (plein rouge). Trois couleurs pour trois actions dont aucune n'est un
   statut. Et « Transférer » avait perdu son libellé faute de largeur —
   il ne vivait plus que dans son aria-label.

   Le bleu #3B82F6 était en prime un faux signal : c'est la marque du
   profil vérifié, et on est sur une fiche d'athlète. Un seul accent
   rouge règle les deux problèmes d'un coup.

   ── POURQUOI UN COMPOSANT SÉPARÉ, ET PAS DU JSX DE PLUS ─────────
   AthleteRecruiterProfileBodyMobile ouvre par
   `if (viewerMode !== "recruiter") return null;` AVANT ses hooks —
   l'inverse du canon du dépôt. Ses 97 hooks sont donc tous
   « conditionnels » aux yeux d'eslint. Y déclarer l'état d'ouverture de
   la feuille en aurait fait un 98ᵉ : de la dette ajoutée à de la dette.
   Ici l'état est chez lui, et le parent n'y gagne aucun hook.

   (La faute de fond — le retour anticipé devant les hooks — reste
   entière dans le parent. Elle demande son propre chantier ; ce n'est
   pas celui-ci.)

   Le FAB ne s'escamote PAS au scroll : 56px dans un coin ne masquent
   rien, contrairement à une barre pleine largeur. La machinerie
   `actionBarVisible` reste au parent, où la barre RECRUTEUR — 160px
   avec le bandeau RSEQ — en a toujours besoin.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { createPortal } from "react-dom";
import { triggerHaptic } from "@/lib/haptics";

export interface CoachFicheAction {
  /** Libellé écrit, jamais une icône seule. */
  libelle: string;
  /** La ligne de contexte sous le libellé — ce que la barre ne pouvait pas dire. */
  contexte: string;
  icone: React.ReactNode;
  onTap: () => void;
}

export default function CoachFicheActionsMobile({
  athleteName,
  actions,
  masque = false,
}: {
  athleteName: string;
  /** Une action absente ne s'affiche pas — plutôt que de s'afficher désactivée. */
  actions: CoachFicheAction[];
  /** Efface le FAB quand une autre surface flottante occupe l'écran. */
  masque?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);

  if (actions.length === 0) return null;

  return (
    <>
      {typeof document !== "undefined" && createPortal(
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); setOuverte(true); }}
          aria-label="Actions"
          aria-haspopup="dialog"
          className="fixed z-30 w-14 h-14 rounded-full bg-[#E63946] text-white flex items-center justify-center active:bg-[#D42B22] shadow-[0_0_20px_rgba(230,57,70,0.3)]"
          style={{
            right: 16,
            bottom: "calc(env(safe-area-inset-bottom) + 80px)",
            /* Deux surfaces flottantes en même temps, c'est une de trop. */
            opacity: masque ? 0 : 1,
            pointerEvents: masque ? "none" : "auto",
            transition: "opacity 200ms ease",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </button>,
        document.body,
      )}

      {/* Patron repris tel quel de la feuille « Contacter » de la fiche :
          poignée, titre, sous-titre, rangées icône + libellé + ligne de
          contexte, Annuler. Rien d'inventé. */}
      {ouverte && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOuverte(false)} />
          <div className="relative w-full max-w-[520px] bg-[#1A1D24] border-t border-white/[0.08] rounded-t-3xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Actions</h3>
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
