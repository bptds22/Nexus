"use client";

/* Les évaluations partenaires d'un lot de cartes, lues UNE fois par la page
   (useCotesPartenaires → cotes_partenaires_athletes, toutes les pages) puis
   distribuées aux cartes par contexte : aucune requête par carte, aucun
   passage de props à travers colonnes et panneaux. Hors fournisseur, une
   carte ne voit rien du partenaire (Loi 25 : le défaut est le silence). */

import { createContext, useContext, type ReactNode } from "react";
import type { CotePartenaire } from "@/lib/evaluations/coteCarte";

const CotesPartenairesContext = createContext<ReadonlyMap<string, CotePartenaire[]> | undefined>(undefined);

export function CotesPartenairesProvider({ cotes, children }: { cotes: ReadonlyMap<string, CotePartenaire[]> | undefined; children: ReactNode }) {
  return <CotesPartenairesContext.Provider value={cotes}>{children}</CotesPartenairesContext.Provider>;
}

export function useCotesPartenairesDe(athleteId: string | null | undefined): CotePartenaire[] | undefined {
  const cotes = useContext(CotesPartenairesContext);
  return athleteId ? cotes?.get(athleteId) : undefined;
}
