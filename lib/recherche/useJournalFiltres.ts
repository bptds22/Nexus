"use client";

/* ═══════════════════════════════════════════════════════════════
   useJournalFiltres — télémétrie d'usage des filtres de recherche.

   Écrit dans `search_filter_events` (migration 20260917140000). But unique :
   savoir quels filtres servent VRAIMENT avant d'en cacher dans une barre
   saturée. Aucune lecture côté client — l'analyse se fait en SQL, sous admin.

   ── CE QUI EST JOURNALISÉ ───────────────────────────────────────
   · Un filtre qui passe à une valeur NON défaut (activation ou changement).
     Le retour au défaut ne l'est PAS : les purges automatiques des écrans
     (sport vidé → position vidée, axe devenu mono-valeur → Organisation
     vidée) produiraient des « désactivations » que personne n'a faites.
     Vaut aussi pour `sortBy` : le retour à « Meilleure cote » n'est pas
     écrit. Sinon « Réinitialiser », qui remet le tri au défaut, laisserait
     un faux choix de tri derrière son propre événement.
   · « Réinitialiser » — un seul événement, via `journaliserReinitialisation`.
     Sans cet appel explicite, un reset serait invisible (tout revient au
     défaut, donc rien ne s'écrit).
   · L'ouverture et la fermeture du panneau « Filtres avancés ».

   ── CE QUI NE L'EST JAMAIS ──────────────────────────────────────
   · Le TEXTE de la recherche. Il contient des noms d'athlètes, souvent
     mineurs. `search` s'écrit « on » quand le champ passe de vide à rempli,
     et c'est tout — la frappe suivante n'écrit rien.
   · Les libellés de programmes : `progFilterIds` s'écrit comme un NOMBRE.
   · Les filtres restaurés au montage (URL, retour depuis une fiche). La
     référence est posée au premier rendu : ce qui est déjà là n'est pas un
     geste de l'utilisateur.

   ── nb_resultats ────────────────────────────────────────────────
   Le changement est mis EN ATTENTE et n'est écrit qu'une fois la liste
   stabilisée (`pret` vrai, puis 1 s sans nouveau changement). Le compte
   écrit est donc celui que l'utilisateur a réellement vu. Plusieurs
   changements rapprochés partent ensemble, avec le même compte.
   Démontage avant l'écriture (clic sur une fiche dans la seconde) : le lot
   part quand même, sans compte (`null`) — un filtre utilisé compte plus
   qu'un nombre manquant.

   ── NE JAMAIS CASSER L'ÉCRAN ────────────────────────────────────
   Insert sans attente, sans retour (`return=minimal`, donc aucun droit de
   SELECT requis). Un échec — RLS, réseau, table absente avant l'apply prod —
   se journalise en console.warn et s'arrête là.

   WEB SEULEMENT. Ce hook n'est PAS appelé depuis `useFiltresRecherche`, que
   le mobile partage : le branchement mobile attend son lot (protocole
   web-d'abord).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { changementsAJournaliser, type JeuDeFiltres } from "@/lib/recherche/journalFiltres";

export type SurfaceRecherche = "recruteur_recherche" | "coach_athletes";

interface Evenement {
  surface: SurfaceRecherche;
  filtre: string;
  valeur: string | null;
  nb_resultats: number | null;
}

interface Options<F extends JeuDeFiltres<F>> {
  surface: SurfaceRecherche;
  filtres: F;
  /** Valeurs par défaut, clé pour clé — ce qui n'est PAS une activation.
   *  `NoInfer` : F se déduit de `filtres` seul. Le coach passe FILTRES_DEFAUT,
   *  sur-ensemble de ses propres clés. */
  defauts: NoInfer<F>;
  /** Nombre de résultats affichés. */
  nbResultats: number;
  /** Faux tant que la liste se charge ou se recharge. */
  pret: boolean;
}

const DELAI_STABLE_MS = 1000;

function ecrire(evenements: Evenement[]) {
  if (evenements.length === 0) return;
  void createClient()
    .from("search_filter_events")
    .insert(evenements)
    .then(({ error }) => {
      if (error) console.warn("[journal filtres] écriture refusée :", error.message);
    });
}

export function useJournalFiltres<F extends JeuDeFiltres<F>>({
  surface, filtres, defauts, nbResultats, pret,
}: Options<F>) {
  const reference = useRef<F>(filtres);
  const enAttente = useRef(new Map<string, string>());
  const nbRef = useRef(nbResultats);
  useEffect(() => { nbRef.current = nbResultats; }, [nbResultats]);

  /* Détection des changements. Chaque rendu où `filtres` change compare à la
     référence précédente, puis la déplace. */
  useEffect(() => {
    const avant = reference.current;
    if (avant === filtres) return;
    for (const [cle, valeur] of changementsAJournaliser(avant, filtres, defauts)) {
      enAttente.current.set(cle, valeur);
    }
    reference.current = filtres;
  }, [filtres, defauts]);

  /* Écriture différée : liste prête + 1 s de calme. Tout nouveau changement
     de filtre, de compte ou d'état de chargement relance l'attente. */
  useEffect(() => {
    if (!pret || enAttente.current.size === 0) return;
    const minuteur = setTimeout(() => {
      const lot = [...enAttente.current].map(([filtre, valeur]) => ({
        surface, filtre, valeur, nb_resultats: nbRef.current,
      }));
      enAttente.current.clear();
      ecrire(lot);
    }, DELAI_STABLE_MS);
    return () => clearTimeout(minuteur);
  }, [filtres, nbResultats, pret, surface]);

  /* Démontage : ce qui attend part sans compte. */
  useEffect(() => {
    const attente = enAttente.current;
    return () => {
      ecrire([...attente].map(([filtre, valeur]) => ({
        surface, filtre, valeur, nb_resultats: null,
      })));
      attente.clear();
    };
  }, [surface]);

  const journaliserReinitialisation = useCallback(() => {
    // Les changements en attente sont absorbés par le reset : ils n'ont
    // produit aucun résultat que l'utilisateur ait gardé.
    enAttente.current.clear();
    ecrire([{ surface, filtre: "reinitialiser", valeur: null, nb_resultats: nbRef.current }]);
  }, [surface]);

  const journaliserPanneauAvance = useCallback((ouvert: boolean) => {
    ecrire([{
      surface, filtre: "panneau_avance",
      valeur: ouvert ? "ouvert" : "ferme", nb_resultats: nbRef.current,
    }]);
  }, [surface]);

  return { journaliserReinitialisation, journaliserPanneauAvance };
}
