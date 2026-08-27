"use client";

/* ═══════════════════════════════════════════════════════════════
   useFiltresRecherche — un seul jeu de filtres pour les DEUX écrans de
   recherche recruteur (web `app/recruteur/recherche/page.tsx` et mobile
   `components/shared/RecruteurRechercheMobile.tsx`).

   AVANT : 21 `useState` dupliqués des deux côtés, valeurs par défaut codées
   en dur, aucune écriture dans l'URL. Ouvrir une fiche démontait l'écran et
   effaçait tout. Avec cinq filtres posés, le va-et-vient recherche ↔ fiche
   était inutilisable.

   ── L'ÉTAT EST LA SOURCE, L'URL EST LA TRACE ────────────────────
   On lit l'URL UNE fois, au montage, pour reconstituer les filtres ; ensuite
   c'est l'état React qui fait foi et l'URL qui suit, en différé.

   L'inverse — dériver les filtres de `useSearchParams()` à chaque rendu —
   paraît plus pur et ne tient pas : chaque frappe dans le champ texte
   provoquerait une navigation, et le champ rendrait la valeur d'un rendu en
   retard. On aurait échangé un bug de persistance contre un bug de saisie.

   ── replace, PAS push ───────────────────────────────────────────
   `router.replace` ne crée aucune entrée d'historique : le retour depuis une
   fiche revient à la recherche AVEC ses filtres, et un second retour sort de
   la recherche. Avec `push`, chaque filtre coché empilerait une entrée et il
   aurait fallu appuyer sur Retour douze fois pour quitter l'écran.

   ── Le différé est de 300 ms, et il porte sur l'URL SEULE ───────
   L'écran réagit immédiatement (l'état change tout de suite) ; seule
   l'écriture dans la barre d'adresse attend. Sans ce délai, `search`
   déclencherait une navigation par caractère tapé.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  compterFiltresActifs,
  decoderFiltres,
  encoderFiltres,
  FILTRES_DEFAUT,
  type FiltresRecherche,
} from "@/lib/recherche/filtres-url";

export { compterFiltresActifs } from "@/lib/recherche/filtres-url";
export type { FiltresRecherche } from "@/lib/recherche/filtres-url";

export interface ApiFiltresRecherche {
  filtres: FiltresRecherche;
  /** Pose un filtre. Typé par clé : `setFiltre("sport", "Football")`. */
  setFiltre: <K extends keyof FiltresRecherche>(cle: K, valeur: FiltresRecherche[K]) => void;
  /**
   * Pose PLUSIEURS filtres en une seule mise à jour.
   *
   * Existe pour le bouton « Réinitialiser », qui en remet 18 d'un coup :
   * dix-huit `setFiltre` enchaînés, c'est dix-huit dépendances à déclarer chez
   * l'appelant, et le `useCallback` finit avec un tableau que personne ne
   * maintiendra juste. Ici : une dépendance, une mise à jour.
   *
   * Volontairement PARTIEL — les clés absentes ne bougent pas. C'est ce qui
   * permet de réinitialiser les filtres sans toucher au champ de recherche.
   */
  poserPlusieurs: (partiel: Partial<FiltresRecherche>) => void;
  /** Remet tout à zéro, y compris dans l'URL. */
  reinitialiser: () => void;
  /** Nombre de filtres actifs (tri exclu) — pour la pastille du bouton. */
  actifs: number;
}

export function useFiltresRecherche(): ApiFiltresRecherche {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  /* Initialiseur PARESSEUX : `decoderFiltres` ne tourne qu'au premier rendu.
     Sans la forme fonction, il serait rejoué à chaque rendu pour rien. */
  const [filtres, setFiltres] = useState<FiltresRecherche>(() =>
    decoderFiltres(searchParams),
  );

  const setFiltre = useCallback(
    <K extends keyof FiltresRecherche>(cle: K, valeur: FiltresRecherche[K]) => {
      setFiltres((f) => (Object.is(f[cle], valeur) ? f : { ...f, [cle]: valeur }));
    },
    [],
  );

  const poserPlusieurs = useCallback((partiel: Partial<FiltresRecherche>) => {
    setFiltres((f) => ({ ...f, ...partiel }));
  }, []);

  const reinitialiser = useCallback(() => {
    setFiltres({ ...FILTRES_DEFAUT, progFilterIds: [] });
  }, []);

  /* ── Écriture différée dans l'URL ──────────────────────────────
     `premierRendu` évite une navigation inutile au montage : à ce moment
     l'URL décrit DÉJÀ l'état (on vient d'en sortir les filtres). Sans ce
     garde, chaque arrivée sur la recherche déclencherait un `replace` qui
     réécrirait la même chose — et normaliserait au passage une URL que
     l'utilisateur vient peut-être de coller. */
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const minuteur = setTimeout(() => {
      const qs = encoderFiltres(filtres);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(minuteur);
  }, [filtres, pathname, router]);

  return {
    filtres,
    setFiltre,
    poserPlusieurs,
    reinitialiser,
    actifs: compterFiltresActifs(filtres),
  };
}

/* ═══════════════════════════════════════════════════════════════
   usePreferenceLocale — une préférence d'AFFICHAGE, pas un filtre.

   `viewMode` (grille/liste) et l'ouverture du panneau de filtres ne changent
   pas le jeu de résultats. Les mettre dans l'URL polluerait tout lien
   partagé avec le goût de celui qui l'a copié ; les laisser en `useState`
   les perdrait à chaque navigation. localStorage est le bon niveau.

   ⚠ useSyncExternalStore, PAS un useState + useEffect. Le serveur n'a pas de
   localStorage : lire pendant le rendu produirait un HTML serveur différent
   du premier rendu client, donc une erreur d'hydratation. La parade naïve
   — rendre le défaut puis corriger dans un effet — fonctionne mais provoque
   un rendu en cascade, que `react-hooks/set-state-in-effect` refuse à juste
   titre. `useSyncExternalStore` est l'outil prévu pour exactement ce cas :
   `getServerSnapshot` sert le défaut pendant l'hydratation, `getSnapshot`
   lit le stockage ensuite, sans effet et sans cascade.

   L'ÉVÉNEMENT `storage` NE SUFFIT PAS : il ne se déclenche que dans les
   AUTRES onglets, jamais dans celui qui écrit. Sans le jeu d'abonnés
   ci-dessous, changer la vue ne repeindrait pas l'écran qui vient de la
   changer. C'est la moitié que ce genre de hook oublie systématiquement.
═══════════════════════════════════════════════════════════════ */

const abonnesPreference = new Set<() => void>();

function souscrirePreference(surChangement: () => void): () => void {
  abonnesPreference.add(surChangement);
  window.addEventListener("storage", surChangement);
  return () => {
    abonnesPreference.delete(surChangement);
    window.removeEventListener("storage", surChangement);
  };
}

export function usePreferenceLocale<T extends string>(
  cle: string,
  defaut: T,
  valides: readonly T[],
): [T, (v: T) => void] {
  /* Rend une PRIMITIVE : React compare par Object.is, donc une valeur
     inchangée ne provoque aucun rendu, même si la fonction est recréée. */
  const lire = useCallback((): T => {
    try {
      const brut = window.localStorage.getItem(cle);
      return brut && (valides as readonly string[]).includes(brut) ? (brut as T) : defaut;
    } catch {
      /* Safari en navigation privée lève sur localStorage. Une préférence
         d'affichage ne justifie pas de casser l'écran : on garde le défaut. */
      return defaut;
    }
  }, [cle, defaut, valides]);

  const lireServeur = useCallback(() => defaut, [defaut]);

  const valeur = useSyncExternalStore(souscrirePreference, lire, lireServeur);

  const poser = useCallback(
    (v: T) => {
      try {
        window.localStorage.setItem(cle, v);
      } catch {
        /* La préférence ne survivra pas, l'écran fonctionne quand même. */
      }
      /* Réveille CET onglet — `storage` ne le fera pas. */
      for (const surChangement of abonnesPreference) surChangement();
    },
    [cle],
  );

  return [valeur, poser];
}
