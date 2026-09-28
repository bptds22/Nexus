"use client";

/* ═══════════════════════════════════════════════════════════════
   useBasculeFavori — le cœur du web, favori d'UNITÉ (lot B2, étape 2).

   Un seul chemin pour les trois écrans web qui portent un cœur (recherche,
   fiche, Mes favoris) :
   - AJOUTER : definirFavori, inchangé — la ligne de l'acteur, signée par lui ;
   - RETIRER, gratuit : definirFavori(false), sa propre ligne, inchangé ;
   - RETIRER, Pro : unite_retirer_favori — le cœur part pour TOUTE l'unité,
     UNE ligne de journal signée par l'acteur (B2-0). Si des collègues l'ont
     aussi mis en favori, une confirmation les NOMME d'abord (décision BP 3,
     la même que le retrait du processus). Seul à l'avoir : pas de modale,
     comme avant.

   `basculer` rend une promesse : le résultat de l'écriture, ou `null` si la
   confirmation a été annulée (rien n'a été écrit). L'appelant rend
   `modale` quelque part dans son arbre.

   Web seulement : l'app 1.4.3 ne retire que son propre favori jusqu'à la
   1.4.4 (registre §38).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { definirFavori, retirerFavoriUnite, type ResultatFavori } from "@/lib/queries/shared/definirFavori";
import { useFavorisUnite, joindreNoms, type FavorisUnite } from "@/lib/queries/recruiter/useFavorisUnite";

interface EnAttente {
  athleteId: string;
  nomAthlete: string;
  collegues: string[];
  resoudre: (r: ResultatFavori | null) => void;
}

/** Texte de la confirmation (décision BP 3 : nommer les collègues). */
export function messageRetraitFavori(collegues: string[]): string {
  const ce = collegues.length === 1 ? "ce collègue" : "ces collègues";
  return `Aussi en favori chez ${joindreNoms(collegues)}. Le cœur sera retiré pour toute l'unité — pour ${ce} aussi.`;
}

export function useBasculeFavori(): {
  favoris: FavorisUnite;
  basculer: (athleteId: string, estFavori: boolean, nomAthlete?: string) => Promise<ResultatFavori | null>;
  modale: ReactNode;
} {
  const queryClient = useQueryClient();
  const favoris = useFavorisUnite();
  const [attente, setAttente] = useState<EnAttente | null>(null);
  const enCours = useRef(false);

  const basculer = useCallback(
    async (athleteId: string, estFavori: boolean, nomAthlete?: string): Promise<ResultatFavori | null> => {
      if (!estFavori) return definirFavori(queryClient, athleteId, true);
      if (!favoris.modeUnite) return definirFavori(queryClient, athleteId, false);
      const collegues = favoris.collegues(athleteId);
      if (collegues.length === 0) return retirerFavoriUnite(queryClient, athleteId);
      return new Promise<ResultatFavori | null>((resoudre) => {
        setAttente({ athleteId, nomAthlete: nomAthlete || "cet athlète", collegues, resoudre });
      });
    },
    [queryClient, favoris],
  );

  const annuler = useCallback(() => {
    attente?.resoudre(null);
    setAttente(null);
  }, [attente]);

  const confirmer = useCallback(async () => {
    if (!attente || enCours.current) return;
    enCours.current = true;
    const r = await retirerFavoriUnite(queryClient, attente.athleteId);
    enCours.current = false;
    attente.resoudre(r);
    setAttente(null);
  }, [attente, queryClient]);

  const modale = attente ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={annuler} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
          Retirer {attente.nomAthlete} des favoris ?
        </h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{messageRetraitFavori(attente.collegues)}</p>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={annuler} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => void confirmer()} className="px-5 py-2 text-white text-[13px] font-bold rounded-lg bg-[#EF4444] hover:bg-[#DC2626] transition-colors">
            Retirer pour l&apos;unité
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { favoris, basculer, modale };
}
