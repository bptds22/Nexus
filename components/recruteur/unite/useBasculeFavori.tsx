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

   RETIRER UN FAVORI PASSE LE DOSSIER EN « RETIRÉ » (BP 2026-10-18 ; avant : le supprimait).
   Et l'inverse : REMETTRE EN FAVORI un athlète retiré le sort de « Retiré » (Identifié) ;
   retirer depuis la fiche ou le processus enlève aussi le cœur (retirerDossier).
   Un dossier dans le processus demande la raison (Pourquoi ?) et va à l'étape RETIRE
   (unite_retirer), comme depuis Mon processus. Déjà retiré ou hors processus : le cœur seul.
   Historique (décision BP 2026-09-28, web) :
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
import { ChoixRaisonRetrait } from "@/components/recruteur/retraits/ChoixRaisonRetrait";
import { FeuilleBas } from "@/components/mobile/FeuilleBas";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
import { messageRetrait, resumeRetrait, retirerDossier, sortirDeRetire, versRetraits, cleRetrait, type RaisonRetrait, type Retrait } from "@/lib/retraits/retraits";
import { invaliderRetraits } from "@/lib/queries/recruiter/useRetraits";

/** Remettre en favori un athlète RETIRÉ (BP 2026-10-19) : on montre pourquoi il a été retiré, et on confirme. */
interface ARemettre {
  athleteId: string;
  nomAthlete: string;
  retrait: Retrait | null;
  resoudre: (r: ResultatFavori | null) => void;
}

/** La raison du retrait, lue AVANT tout geste : la base l'efface dès que le dossier quitte « Retiré ». */
async function lireRetrait(athleteId: string): Promise<Retrait | null> {
  const { data, error } = await createClient().rpc("unite_retraits").eq("athlete_id", athleteId);
  if (error) return null;
  return versRetraits(data as Record<string, unknown>[]).get(cleRetrait(athleteId, false)) ?? null;
}

async function remettreEnFavori(queryClient: QueryClient, athleteId: string): Promise<ResultatFavori> {
  const r = await definirFavori(queryClient, athleteId, true);
  if (!r.ok) return r;
  const err = await sortirDeRetire(createClient(), athleteId);
  void invaliderTableauBlanc(queryClient);
  void invaliderRetraits(queryClient);
  if (err) return { ok: false, message: `Favori ajouté, mais l'athlète est resté dans « Retiré ». ${messageRetrait(err)}` };
  return r;
}

interface EnAttente {
  athleteId: string;
  nomAthlete: string;
  collegues: string[];
  dossier: Dossier;
  resoudre: (r: ResultatFavori | null) => void;
}

/** Le dossier de l'unité pour l'athlète : absent, ou son étape. */
type Dossier = { etape: string } | null;

/** Un dossier actif (pas déjà retiré) : retirer le favori le passe en « Retiré », avec une raison. */
export function dossierActif(dossier: Dossier): boolean {
  return !!dossier && dossier.etape !== "RETIRE";
}

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
export function messageRetraitFavori(nomsCollegues: readonly (string | null | undefined)[], dossier: Dossier = null): string {
  // Un nom introuvable ne s'affiche pas : jamais « Aussi en favori chez . » (BP 2026-10-18).
  const collegues = nomsCollegues.map((n) => (n ?? "").trim()).filter(Boolean);
  const ce = collegues.length === 1 ? "ce collègue" : "ces collègues";
  const parts: string[] = [];
  if (estEtapeAvancee(dossier)) {
    parts.push(`Cet athlète est en ${libelleEtape(dossier!.etape)}. Retirer le favori le passera dans « Retiré » du processus de l'unité.`);
    if (collegues.length > 0) parts.push(`Aussi en favori chez ${joindreNoms(collegues)} — pour ${ce} aussi.`);
  } else {
    if (collegues.length > 0) {
      parts.push(`Aussi en favori chez ${joindreNoms(collegues)}. Le cœur sera retiré pour toute l'unité — pour ${ce} aussi.`);
      if (dossierActif(dossier)) parts.push("Il passera aussi dans « Retiré » du processus de l'unité.");
    }
  }
  if (parts.length === 0 && dossierActif(dossier)) parts.push("Il passera dans « Retiré » du processus de l'unité, avec sa raison.");
  return parts.join(" ");
}

/** Étape du dossier de l'unité (unite_pipeline, l'étape la plus avancée). */
async function lireDossier(athleteId: string): Promise<Dossier> {
  // Filtré EN BASE sur l'athlète (correctif 2026-10-16) : lire tout le
  // processus puis chercher l'athlète échouait au-delà de 1000 dossiers
  // (coupure PostgREST) — l'athlète passait pour « hors processus ».
  const { data, error } = await createClient().rpc("unite_pipeline").eq("athlete_id", athleteId);
  if (error) throw error;
  const ligne = ((data ?? []) as { athlete_id: string; stage: string | null }[])[0];
  return ligne ? { etape: (ligne.stage || "IDENTIFIE").toUpperCase() } : null;
}

/** Favori PUIS processus, dans cet ordre. Le dossier n'est plus supprimé : il passe en « Retiré ». */
async function retirerFavoriEtDossier(queryClient: QueryClient, athleteId: string, dossier: Dossier, raison: RaisonRetrait | null, note: string): Promise<ResultatFavori> {
  const r = await retirerFavoriUnite(queryClient, athleteId);
  if (!r.ok || !dossierActif(dossier) || !raison) return r;
  const err = await retirerDossier(createClient(), { id: athleteId, carte: false, raison, note });
  void invaliderTableauBlanc(queryClient);
  if (err) {
    return { ok: false, message: `Favori retiré, mais l'athlète est resté dans le processus. ${messageRetrait(err)}` };
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
  const [aRemettre, setARemettre] = useState<ARemettre | null>(null);
  const [raison, setRaison] = useState<RaisonRetrait | null>(null);
  const [note, setNote] = useState("");
  const enCours = useRef(false);

  const basculer = useCallback(
    async (athleteId: string, estFavori: boolean, nomAthlete?: string): Promise<ResultatFavori | null> => {
      if (!estFavori) {
        // Remettre en favori sort de « Retiré » (BP 2026-10-18, nuit) : retiré = jamais en favori.
        // BP 2026-10-19 : d'abord une fenêtre qui dit qu'il a été retiré, et pourquoi.
        let avant: Dossier = null;
        if (favoris.modeUnite) { try { avant = await lireDossier(athleteId); } catch { avant = null; } }
        if (avant?.etape !== "RETIRE") return definirFavori(queryClient, athleteId, true);
        const retrait = await lireRetrait(athleteId);
        return new Promise<ResultatFavori | null>((resoudre) => {
          setARemettre({ athleteId, nomAthlete: nomAthlete || "cet athlète", retrait, resoudre });
        });
      }
      if (!favoris.modeUnite) return definirFavori(queryClient, athleteId, false);
      const collegues = favoris.collegues(athleteId);
      let dossier: Dossier;
      try {
        dossier = await lireDossier(athleteId);
      } catch {
        return { ok: false, message: "Impossible de lire le processus de l'unité. Réessaie." };
      }
      // Sans dossier actif ni collègue : le cœur seul, sans question.
      if (collegues.length === 0 && !dossierActif(dossier)) {
        return retirerFavoriEtDossier(queryClient, athleteId, dossier, null, "");
      }
      return new Promise<ResultatFavori | null>((resoudre) => {
        setRaison(null); setNote("");
        setAttente({ athleteId, nomAthlete: nomAthlete || "cet athlète", collegues, dossier, resoudre });
      });
    },
    [queryClient, favoris],
  );

  const annulerRemise = useCallback(() => {
    aRemettre?.resoudre(null);
    setARemettre(null);
  }, [aRemettre]);

  const confirmerRemise = useCallback(async () => {
    if (!aRemettre || enCours.current) return;
    enCours.current = true;
    const r = await remettreEnFavori(queryClient, aRemettre.athleteId);
    enCours.current = false;
    aRemettre.resoudre(r);
    setARemettre(null);
  }, [aRemettre, queryClient]);

  const annuler = useCallback(() => {
    attente?.resoudre(null);
    setAttente(null);
  }, [attente]);

  const confirmer = useCallback(async () => {
    if (!attente || enCours.current) return;
    if (dossierActif(attente.dossier) && !raison) return;
    enCours.current = true;
    const r = await retirerFavoriEtDossier(queryClient, attente.athleteId, attente.dossier, raison, note);
    enCours.current = false;
    attente.resoudre(r);
    setAttente(null);
  }, [attente, queryClient, raison, note]);

  /* Une VRAIE fenêtre (BP 2026-10-18) : portail + au-dessus de tout, toujours à l'écran
     même si on a défilé — feuille du bas dans l'appli, modale centrée sur le web. */
  const modale = attente ? (
    <FeuilleBas
      onFermer={annuler}
      titre={`Retirer ${attente.nomAthlete} des favoris ?`}
      testId="fenetre-retrait-favori"
      largeurModale={400}
      pied={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={annuler} className="px-4 py-2 [@media(hover:none)]:min-h-[44px] text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => void confirmer()} disabled={dossierActif(attente.dossier) && !raison} className="disabled:opacity-40 px-5 py-2 [@media(hover:none)]:min-h-[44px] text-white text-[13px] font-bold rounded-lg bg-[#EF4444] hover:bg-[#DC2626] transition-colors">
            {estEtapeAvancee(attente.dossier) ? "Retirer" : "Retirer pour l’unité"}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{messageRetraitFavori(attente.collegues, attente.dossier)}</p>
      {dossierActif(attente.dossier) && (
        <ChoixRaisonRetrait mobile={IS_CAPACITOR} raison={raison} onRaison={setRaison} note={note} onNote={setNote} />
      )}
    </FeuilleBas>
  ) : aRemettre ? (
    <FeuilleBas
      onFermer={annulerRemise}
      titre={`${aRemettre.nomAthlete} a été retiré`}
      testId="fenetre-remettre-favori"
      largeurModale={400}
      pied={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={annulerRemise} className="px-4 py-2 [@media(hover:none)]:min-h-[44px] text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => void confirmerRemise()} className="px-5 py-2 [@media(hover:none)]:min-h-[44px] text-white text-[13px] font-bold rounded-lg bg-[#E63946] hover:bg-[#D42B22] transition-colors">
            Le remettre en favori
          </button>
        </div>
      }
    >
      {aRemettre.retrait ? (
        <p className="rounded-lg border border-[#2D3748] bg-[#111317] px-3 py-2.5 text-[13px] text-white/85 leading-relaxed" data-testid="remettre-raison">
          {resumeRetrait(aRemettre.retrait)}
        </p>
      ) : (
        <p className="text-[13px] text-[#9CA3AF] leading-relaxed">Il est dans « Retiré » du processus de l&apos;unité.</p>
      )}
      <p className="mt-3 text-[13px] text-[#9CA3AF] leading-relaxed">Es-tu sûr ? Il reviendra en favori et à l&apos;étape Identifié, pour toute l&apos;unité.</p>
    </FeuilleBas>
  ) : null;

  return { favoris, basculer, modale };
}
