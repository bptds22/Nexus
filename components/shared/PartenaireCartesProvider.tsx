"use client";

/* Ce que le partenaire a posé sur un LOT de cartes — évaluations ET badges —,
   lu UNE fois par la page (deux RPC groupées, toutes les pages) puis distribué
   aux cartes par contexte : aucune requête par carte. Hors fournisseur, une
   carte ne montre rien du partenaire (Loi 25 : le défaut est le silence ;
   la lecture serveur ne rend rien sans opt-in partenaire actif). */

import { createContext, useContext, type ReactNode } from "react";
import { useCotesPartenaires } from "@/lib/queries/shared/useCotesPartenaires";
import { useBadgesPartenairesLot } from "@/lib/queries/shared/useBadgesPartenairesLot";
import { CotesPartenairesProvider } from "@/lib/evaluations/CotesPartenairesContext";
import type { BadgePartenaire } from "@/lib/badges/partenaire";

const BadgesPartenairesContext = createContext<ReadonlyMap<string, BadgePartenaire[]> | undefined>(undefined);

export function useBadgesPartenairesDe(athleteId: string | null | undefined): BadgePartenaire[] | undefined {
  const badges = useContext(BadgesPartenairesContext);
  return athleteId ? badges?.get(athleteId) : undefined;
}

export default function PartenaireCartesProvider({ ids, children }: { ids: readonly string[]; children: ReactNode }) {
  const { data: cotes } = useCotesPartenaires(ids);
  const { data: badges } = useBadgesPartenairesLot(ids);
  return (
    <CotesPartenairesProvider cotes={cotes}>
      <BadgesPartenairesContext.Provider value={badges}>{children}</BadgesPartenairesContext.Provider>
    </CotesPartenairesProvider>
  );
}
