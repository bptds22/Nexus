/* ═══════════════════════════════════════════════════════════════
   cacheDossiers — l'optimiste des écritures de « Mon processus », pour
   TOUTES les lectures du processus à la fois (lot 2 de la 1.4.4).

   Avant le tableau blanc mobile, un seul cache portait le kanban mobile :
   ["pipeline", userId] (usePipelineCards, ses propres lignes). En mode
   unité, c'est ["pipeline", "unite", userId, sport, tout] (useProcessusUnite).
   Patcher la seule première clé laissait le kanban d'un Pro sans retour
   visuel jusqu'au rechargement. On patche donc tout ce qui commence par
   ["pipeline"] et porte des `cards`, et on remet chaque clé telle qu'elle
   était si la base refuse.
═══════════════════════════════════════════════════════════════ */

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";

export type InstantaneDossiers = Array<[QueryKey, PipelineData | undefined]>;

function estProcessus(d: unknown): d is PipelineData {
  return !!d && typeof d === "object" && Array.isArray((d as PipelineData).cards);
}

/** Applique `patch` à la carte de l'athlète dans chaque cache du processus.
 *  `patch` null retire la carte. Rend l'instantané pour `restaurerDossiers`. */
export async function patcherDossiers(
  queryClient: QueryClient,
  athleteId: string,
  patch: ((c: PipelineKanbanCard) => PipelineKanbanCard) | null,
): Promise<InstantaneDossiers> {
  await queryClient.cancelQueries({ queryKey: ["pipeline"] });
  const avant = queryClient.getQueriesData<PipelineData>({ queryKey: ["pipeline"] })
    .filter(([, d]) => estProcessus(d));
  for (const [cle, d] of avant) {
    if (!d) continue;
    queryClient.setQueryData<PipelineData>(cle, {
      ...d,
      cards: patch
        ? d.cards.map((c) => (c.id === athleteId ? patch(c) : c))
        : d.cards.filter((c) => c.id !== athleteId),
    });
  }
  return avant;
}

export function restaurerDossiers(queryClient: QueryClient, instantane: InstantaneDossiers | undefined): void {
  for (const [cle, d] of instantane ?? []) queryClient.setQueryData(cle, d);
}
