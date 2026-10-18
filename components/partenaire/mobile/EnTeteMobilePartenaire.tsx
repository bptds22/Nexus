"use client";

/* ═══════════════════════════════════════════════════════════════
   EnTeteMobilePartenaire — l'en-tête NATIF des écrans partenaire dans
   l'appli (1.4.5, demande BP : « un feeling natif, pas web »). Copie du
   canon recruteur (RecruteurFavorisMobile, RecruteurListesMobile) :
   collant, fond opaque #111317 (pas de flou), zone sûre du haut, grand
   titre Outfit 26 px en capitales ; action ronde à droite (ex. « + ») ;
   chevron de retour pour un écran de détail (navigation explicite, comme
   RecruteurListeDetailMobile — jamais router.back()).
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";

export default function EnTeteMobilePartenaire({ titre, sousTitre, action, retour, compact = false }: {
  titre: string;
  /** Une ligne courte sous le titre (facultative). */
  sousTitre?: ReactNode;
  /** Bouton(s) à droite : rond 44 px (voir BoutonRondPartenaire). */
  action?: ReactNode;
  /** Écran de détail : chevron vers cette route. */
  retour?: string;
  /** Titre 18 px tronqué (écran de détail), au lieu du grand titre. */
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }} data-entete-mobile-partenaire>
      <div className={`flex items-center gap-2 px-4 ${compact ? "h-14" : "pt-3 pb-2"}`}>
        {retour && (
          <button type="button" aria-label="Retour" onClick={() => { triggerHaptic("Light"); router.push(retour); }}
            className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center active:bg-white/[0.06] shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={compact
            ? "text-[18px] font-bold text-white truncate"
            : "font-head text-[26px] font-black text-white uppercase tracking-tight leading-tight"}>
            {titre}
          </h1>
          {sousTitre && <p className="text-[13px] text-white/50 mt-0.5 truncate">{sousTitre}</p>}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
    </header>
  );
}

/** Le bouton rond de l'en-tête (canon RecruteurListesMobile : « + » rouge 44 px). */
export function BoutonRondPartenaire({ libelle, onClick, children, principal = true }: {
  libelle: string;
  onClick: () => void;
  children: ReactNode;
  principal?: boolean;
}) {
  return (
    <button type="button" aria-label={libelle} onClick={() => { triggerHaptic("Medium"); onClick(); }}
      className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform ${principal ? "bg-[#E63946] shadow-[0_4px_16px_rgba(230,57,70,0.35)]" : "bg-white/[0.08]"}`}>
      {children}
    </button>
  );
}
