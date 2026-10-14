"use client";

import { useEffect, useRef } from "react";

/* Encadré d'erreur d'enregistrement des assistants coach (créer / modifier un
   athlète). Remplace l'alert() natif qui affichait le message brut de la base
   (« Erreur lors de la sauvegarde: NEXUS: … »). Le texte arrive déjà mis en
   forme — voir lib/erreurs/messageErreurNexus.ts. */
export default function ErreurSauvegarde({ message, onFermer }: { message: string | null; onFermer: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [message]);

  if (!message) return null;
  return (
    <div ref={ref} role="alert" data-erreur-sauvegarde
      className="mt-4 flex items-start gap-3 bg-[#E63946]/[0.08] border border-[#E63946]/25 rounded-lg px-5 py-3">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
      {/* Pas de titre « rien n'a été enregistré » : saveAthleteEdit écrit
          l'évaluation AVANT les badges, un refus de badge peut donc suivre une
          écriture réussie. */}
      <p className="flex-1 text-[14px] text-[#e0e0e0] font-medium">{message}</p>
      <button type="button" onClick={onFermer} aria-label="Fermer le message"
        className="shrink-0 text-[#6b7280] hover:text-white transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/* Texte à afficher pour une erreur renvoyée par la couche d'enregistrement. */
export const MESSAGE_ERREUR_GENERIQUE =
  "L'enregistrement n'a pas fonctionné. Réessaie dans un instant ; si le problème persiste, écris-nous.";
