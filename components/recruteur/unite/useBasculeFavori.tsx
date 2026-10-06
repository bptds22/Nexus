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

   RETIRER UN FAVORI RETIRE AUSSI DU PROCESSUS (décision BP 2026-09-28, web) :
   - dossier à Identifié ou Contacté (ou retiré) : les deux partent, sans
     question — sauf la confirmation d'unité si des collègues l'ont en favori ;
   - dossier PLUS AVANCÉ (En discussion → Lettre signée) : confirmation
     explicite qui nomme l'étape, avant tout geste.
   Deux appels dans l'ordre, aucune fonction en base touchée :
   unite_retirer_favori PUIS unite_retirer_du_processus — chacun écrit sa
   ligne de journal signée par l'acteur. Si le second échoue, le favori est
   déjà parti : on le dit, le dossier se retire depuis Mon processus.
   Un gratuit (mode démo) garde l'ancien geste : son favori seulement.

   `basculer` rend une promesse : le résultat de l'écriture, ou `null` si la
   confirmation a été annulée (rien n'a été écrit). L'appelant rend
   `modale` quelque part dans son arbre.

   Partagé web + app depuis le lot 2 de la 1.4.4 (registre §38) : Mes
   favoris, la recherche et la fiche mobiles passent aussi par ici. Les
   boutons de la modale passent à 44 px sur écran tactile (hover:none).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { definirFavori, retirerFavoriUnite, type ResultatFavori } from "@/lib/queries/shared/definirFavori";
import { getStatusConfig, type RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { useFavorisUnite, joindreNoms, type FavorisUnite } from "@/lib/queries/recruiter/useFavorisUnite";

interface EnAttente {
  athleteId: string;
  nomAthlete: string;
  collegues: string[];
  dossier: Dossier;
  resoudre: (r: ResultatFavori | null) => void;
}

/** Le dossier de l'unité pour l'athlète : absent, ou son étape. */
type Dossier = { etape: string } | null;

/** Étapes au-delà de Contacté : le retrait demande une confirmation. */
const ETAPES_AVANCEES = new Set(["EN_DISCUSSION", "VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"]);

export function estEtapeAvancee(dossier: Dossier): boolean {
  return !!dossier && ETAPES_AVANCEES.has(dossier.etape);
}

function libelleEtape(etape: string): string {
  return getStatusConfig(etape.toLowerCase() as RecruitmentStatus)?.label || etape;
}

/** Texte de la confirmation : l'étape si elle dépasse Contacté, les
 *  collègues s'ils l'ont aussi en favori (décision BP 3). */
export function messageRetraitFavori(collegues: string[], dossier: Dossier = null): string {
  const ce = collegues.length === 1 ? "ce collègue" : "ces collègues";
  const parts: string[] = [];
  if (estEtapeAvancee(dossier)) {
    parts.push(`Cet athlète est en ${libelleEtape(dossier!.etape)}. Retirer le favori le retirera aussi du processus de l'unité.`);
    if (collegues.length > 0) parts.push(`Aussi en favori chez ${joindreNoms(collegues)} — pour ${ce} aussi.`);
  } else {
    parts.push(`Aussi en favori chez ${joindreNoms(collegues)}. Le cœur sera retiré pour toute l'unité — pour ${ce} aussi.`);
    if (dossier) parts.push("Il sera aussi retiré du processus de l'unité.");
  }
  return parts.join(" ");
}

/** Étape du dossier de l'unité (unite_pipeline, l'étape la plus avancée). */
async function lireDossier(athleteId: string): Promise<Dossier> {
  const { data, error } = await createClient().rpc("unite_pipeline");
  if (error) throw error;
  const ligne = ((data ?? []) as { athlete_id: string; stage: string | null }[]).find((l) => l.athlete_id === athleteId);
  return ligne ? { etape: (ligne.stage || "IDENTIFIE").toUpperCase() } : null;
}

/** Favori PUIS processus, dans cet ordre. */
async function retirerFavoriEtDossier(queryClient: QueryClient, athleteId: string, dossier: Dossier): Promise<ResultatFavori> {
  const r = await retirerFavoriUnite(queryClient, athleteId);
  if (!r.ok || !dossier) return r;
  const { error } = await createClient().rpc("unite_retirer_du_processus", { p_athlete_id: athleteId });
  void invaliderTableauBlanc(queryClient);
  if (error) {
    console.error(`[favoris] retrait du processus refusé — ${error.code ?? ""} ${error.message}`);
    return { ok: false, message: "Favori retiré, mais l'athlète est resté dans le processus. Retire-le depuis Mon processus." };
  }
  return r;
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
      let dossier: Dossier;
      try {
        dossier = await lireDossier(athleteId);
      } catch {
        return { ok: false, message: "Impossible de lire le processus de l'unité. Réessaie." };
      }
      if (collegues.length === 0 && !estEtapeAvancee(dossier)) {
        return retirerFavoriEtDossier(queryClient, athleteId, dossier);
      }
      return new Promise<ResultatFavori | null>((resoudre) => {
        setAttente({ athleteId, nomAthlete: nomAthlete || "cet athlète", collegues, dossier, resoudre });
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
    const r = await retirerFavoriEtDossier(queryClient, attente.athleteId, attente.dossier);
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
        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{messageRetraitFavori(attente.collegues, attente.dossier)}</p>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={annuler} className="px-4 py-2 [@media(hover:none)]:min-h-[44px] text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => void confirmer()} className="px-5 py-2 [@media(hover:none)]:min-h-[44px] text-white text-[13px] font-bold rounded-lg bg-[#EF4444] hover:bg-[#DC2626] transition-colors">
            {estEtapeAvancee(attente.dossier) ? "Retirer" : "Retirer pour l’unité"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { favoris, basculer, modale };
}
