"use client";

/* Ce que le partenaire a posé sur les cartes AFFICHÉES — évaluations ET badges —,
   lu PAR PAQUETS d'environ 50, au fil du défilement (décision BP 1.4.5) : jamais
   pour tous les résultats d'un coup. Chaque carte se déclare visible (marge de
   300 px) ; les déclarations d'une courte fenêtre sont regroupées en paquets de
   TAILLE_PAQUET, un appel groupé (cotes_partenaires_athletes,
   badges_partenaires_athletes — toutes les pages, aucun plafond de 1 000) par
   paquet. Un paquet lu n'est jamais relu pour rien : il est immuable.

   Hors fournisseur, une carte ne montre rien du partenaire (Loi 25 : le défaut
   est le silence ; la lecture serveur, athlète par athlète, ne rend rien sans
   opt-in partenaire actif). */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { chargerCotesPartenaires, type CotePartenaire } from "@/lib/evaluations/coteCarte";
import { chargerBadgesPartenairesLot, type BadgePartenaire } from "@/lib/badges/partenaire";
import { CotesPartenairesProvider } from "@/lib/evaluations/CotesPartenairesContext";

/** Taille d'un paquet : ce qu'on lit d'un coup côté serveur. */
export const TAILLE_PAQUET = 50;
/** Regroupe les déclarations d'une courte fenêtre en paquets (ms). */
const FENETRE_REGROUPEMENT_MS = 120;

interface Visibilite {
  /** Observe un élément ; rend le nettoyage. Déclenche la lecture de `id` quand il approche de l'écran. */
  observer: (el: Element, id: string) => () => void;
}

const BadgesPartenairesContext = createContext<ReadonlyMap<string, BadgePartenaire[]> | undefined>(undefined);
const VisibiliteContext = createContext<Visibilite | undefined>(undefined);

export function useBadgesPartenairesDe(athleteId: string | null | undefined): BadgePartenaire[] | undefined {
  const badges = useContext(BadgesPartenairesContext);
  return athleteId ? badges?.get(athleteId) : undefined;
}

/** Une carte se déclare à l'approche de l'écran ; la lecture de ses badges et de sa cote part avec le paquet. */
export function useDeclarerCarteVisible(athleteId: string | null | undefined) {
  const vis = useContext(VisibiliteContext);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !athleteId || !vis) return;
    return vis.observer(el, athleteId);
  }, [athleteId, vis]);
  return ref;
}

/** Ceinture : un paquet qui ne serait pas une Map (cache réhydraté, voir
 *  lib/queries/persistance.ts) est ignoré au lieu de faire planter l'écran. */
export function fusionner<T>(parts: readonly unknown[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const m of parts) if (m instanceof Map) for (const [k, v] of m as Map<string, T[]>) out.set(k, v);
  return out;
}

export default function PartenaireCartesProvider({ children }: { children: ReactNode }) {
  const [paquets, setPaquets] = useState<string[][]>([]);
  const demandes = useRef(new Set<string>());
  const file = useRef<string[]>([]);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const demander = useCallback((id: string) => {
    if (!id || demandes.current.has(id)) return;
    demandes.current.add(id);
    file.current.push(id);
    if (minuteur.current) return;
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      const ids = file.current.splice(0);
      const nouveaux: string[][] = [];
      for (let i = 0; i < ids.length; i += TAILLE_PAQUET) nouveaux.push(ids.slice(i, i + TAILLE_PAQUET));
      if (nouveaux.length) setPaquets((p) => [...p, ...nouveaux]);
    }, FENETRE_REGROUPEMENT_MS);
  }, []);

  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);

  /* UN observateur pour toutes les cartes. */
  const observateur = useRef<IntersectionObserver | null>(null);
  const idDe = useRef(new WeakMap<Element, string>());
  const visibilite = useMemo<Visibilite>(() => ({
    observer(el, id) {
      if (typeof IntersectionObserver === "undefined") { demander(id); return () => {}; }
      if (!observateur.current) {
        observateur.current = new IntersectionObserver((entrees) => {
          for (const e of entrees) {
            if (!e.isIntersecting) continue;
            const eid = idDe.current.get(e.target);
            if (eid) demander(eid);
            observateur.current?.unobserve(e.target);
          }
        }, { rootMargin: "300px 0px" });
      }
      idDe.current.set(el, id);
      observateur.current.observe(el);
      return () => { observateur.current?.unobserve(el); idDe.current.delete(el); };
    },
  }), [demander]);
  useEffect(() => () => { observateur.current?.disconnect(); observateur.current = null; }, []);

  const cotes = useQueries({
    queries: paquets.map((ids) => {
      const tries = [...ids].sort();
      return {
        queryKey: ["cotes-partenaires", tries],
        queryFn: () => chargerCotesPartenaires(createClient(), tries),
        staleTime: 5 * 60 * 1000,
      };
    }),
    combine: (rs) => fusionner<CotePartenaire>(rs.map((r) => r.data)),
  });
  const badges = useQueries({
    queries: paquets.map((ids) => {
      const tries = [...ids].sort();
      return {
        queryKey: ["badges-partenaires-lot", tries],
        queryFn: () => chargerBadgesPartenairesLot(createClient(), tries),
        staleTime: 5 * 60 * 1000,
      };
    }),
    combine: (rs) => fusionner<BadgePartenaire>(rs.map((r) => r.data)),
  });

  return (
    <VisibiliteContext.Provider value={visibilite}>
      <CotesPartenairesProvider cotes={cotes}>
        <BadgesPartenairesContext.Provider value={badges}>{children}</BadgesPartenairesContext.Provider>
      </CotesPartenairesProvider>
    </VisibiliteContext.Provider>
  );
}
