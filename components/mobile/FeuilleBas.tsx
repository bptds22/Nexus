"use client";

/* ═══════════════════════════════════════════════════════════════
   FeuilleBas — LA fenêtre du bas partagée (BP, nuit du 2026-10-18).

   Trois bogues vus sur l'iPhone, corrigés ici une fois pour toutes :
   1. CLAVIER : le bouton principal (« Créer », « Enregistrer ») passait
      sous le clavier. La feuille se pose AU-DESSUS du clavier (bottom en
      ligne = recouvrement du clavier) ET se plafonne à l'espace restant ;
      le contenu défile, le PIED (bouton principal) reste toujours visible.
      Cause du « Créer » caché : une zone `flex-1 overflow-y-auto` SANS
      `min-h-0` ne rétrécit pas sous son contenu — la colonne débordait
      par le bas, pied compris. Ici la zone a `min-h-0`.
   2. ZONE SÛRE : jamais sous la barre d'état ni l'encoche, même clavier
      ouvert — la hauteur max retranche env(safe-area-inset-top).
   3. SUPERPOSITION : rendue en PORTAIL dans <body>, z-[80] — au-dessus de
      la barre d'onglets (z-40), de la barre d'actions de la fiche (z-30)
      et des feuilles existantes (z-55 à z-70). Une modale rendue dans
      l'arbre de la page (sous un ancêtre transformé, ex. AnimatedRoute)
      se plaçait en haut de la PAGE, invisible si on avait défilé.

   Variante : « auto » (défaut) = feuille du bas dans l'appli ou sur écran
   étroit (< 640 px), modale centrée sur le web large. « feuille » ou
   « modale » pour forcer.

   USAGE
     <FeuilleBas onFermer={…} titre="Ajouter un prospect" pied={<button…>Créer</button>}>
       …champs…
     </FeuilleBas>
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useKeyboardHeight } from "@/lib/hooks/useKeyboardHeight";
import { hauteurMaxFeuille } from "@/lib/mobile/feuilleBas";

export type VarianteFeuille = "auto" | "feuille" | "modale";

const ETROIT = "(max-width: 639px)";

function abonnerLargeur(rappel: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(ETROIT);
  mq.addEventListener("change", rappel);
  return () => mq.removeEventListener("change", rappel);
}

/** Vrai dans l'appli (html.is-capacitor) ou sur un écran étroit. Faux au rendu serveur. */
function estFeuilleAuto(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.classList.contains("is-capacitor") || window.matchMedia(ETROIT).matches;
}

export interface FeuilleBasProps {
  /** Faux : rien n'est rendu (pratique pour garder l'état du parent). */
  ouvert?: boolean;
  onFermer: () => void;
  /** En-tête avec le bouton Fermer. Absent : la feuille gère son propre en-tête dans `children`. */
  titre?: ReactNode;
  /** Sous-titre court sous le titre. */
  sousTitre?: ReactNode;
  /** Libellé accessible quand il n'y a pas de titre texte. */
  etiquette?: string;
  /** Le pied fixe : bouton principal, toujours visible au-dessus du clavier. */
  pied?: ReactNode;
  children: ReactNode;
  variante?: VarianteFeuille;
  /** Hauteur max clavier fermé (feuille). */
  hauteur?: string;
  /** Largeur max de la modale web, en px. */
  largeurModale?: number;
  /** Fond du panneau. */
  fond?: string;
  /** Un toucher sur le voile ferme (défaut vrai). */
  fermerSurVoile?: boolean;
  testId?: string;
  /** Classes de la zone défilante (marges intérieures). */
  classeContenu?: string;
  /** En-tête FIXE sur mesure (au-dessus de la zone qui défile), à la place de `titre`. */
  entete?: ReactNode;
}

export function FeuilleBas({
  ouvert = true, onFermer, titre, sousTitre, etiquette, pied, children,
  variante = "auto", hauteur = "92dvh", largeurModale = 520, fond = "#1A1D24",
  fermerSurVoile = true, testId, classeContenu = "px-4 pb-3", entete: enteteSurMesure,
}: FeuilleBasProps) {
  const monte = useSyncExternalStore(() => () => {}, () => true, () => false);
  const auto = useSyncExternalStore(abonnerLargeur, estFeuilleAuto, () => false);
  const feuille = variante === "feuille" || (variante === "auto" && auto);
  const clavier = useKeyboardHeight();
  const zone = useRef<HTMLDivElement>(null);

  // Le champ actif reste visible dans la zone défilante quand le clavier monte.
  const ramener = useCallback(() => {
    window.setTimeout(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el && zone.current?.contains(el) && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
        el.scrollIntoView({ block: "nearest" });
      }
    }, 300);
  }, []);
  useEffect(() => { if (clavier > 0) ramener(); }, [clavier, ramener]);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert, onFermer]);

  if (!monte || !ouvert) return null;

  const entete = enteteSurMesure ? (
    <div className="shrink-0 px-4 pb-3">{enteteSurMesure}</div>
  ) : titre ? (
    <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3">
      <div className="min-w-0">
        <h2 className="font-head text-[16px] font-black uppercase tracking-tight text-white">{titre}</h2>
        {sousTitre && <p className="mt-1 text-[12px] text-[#9CA3AF]">{sousTitre}</p>}
      </div>
      <button type="button" onClick={onFermer} aria-label="Fermer"
        className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-white/5 hover:bg-white/5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
      </button>
    </div>
  ) : null;

  const corps = (
    <>
      {entete}
      <div ref={zone} onFocus={ramener} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${classeContenu}`}
        style={{ overflowX: "hidden", touchAction: "pan-y" }}>
        {children}
      </div>
      {pied && <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3 pb-3">{pied}</div>}
    </>
  );

  const libelle = etiquette ?? (typeof titre === "string" ? titre : undefined);

  if (feuille) {
    return createPortal(
      <>
        <div className="fixed inset-0 z-[80] bg-black/60" style={{ animation: "nx-modal-fade 200ms ease-out forwards" }}
          onClick={fermerSurVoile ? onFermer : undefined} aria-hidden data-feuille-voile />
        <div role="dialog" aria-modal="true" aria-label={libelle} data-testid={testId} data-feuille-bas="feuille"
          className="fixed inset-x-0 z-[80] flex flex-col rounded-t-3xl"
          style={{
            background: fond,
            // En ligne : bat la règle globale `.fixed.bottom-0` (globals.css), une seule source.
            bottom: clavier,
            maxHeight: hauteurMaxFeuille(clavier, hauteur),
            // Clavier fermé : la safe-area du bas (home indicator). Ouvert, le clavier la couvre déjà.
            paddingBottom: clavier > 0 ? 0 : "env(safe-area-inset-bottom)",
            transition: "bottom 250ms ease-out, max-height 250ms ease-out",
            animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}>
          <div className="flex shrink-0 justify-center pt-3 pb-2" aria-hidden><div className="h-1 w-10 rounded-full bg-white/20" /></div>
          {corps}
        </div>
      </>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={fermerSurVoile ? onFermer : undefined} data-feuille-voile>
      <div role="dialog" aria-modal="true" aria-label={libelle} data-testid={testId} data-feuille-bas="modale"
        className="flex w-full flex-col rounded-xl border border-[#2D3748] pt-5 shadow-2xl"
        style={{ background: fond, maxWidth: largeurModale, maxHeight: "calc(100dvh - 32px)" }}
        onClick={(e) => e.stopPropagation()}>
        {corps}
      </div>
    </div>,
    document.body,
  );
}
