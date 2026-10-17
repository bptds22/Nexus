"use client";

/* La ligne « Ton entraîneur-chef : X » (lecture seule) pour une équipe donnée —
   point 9, option A. Lit coachs_nommables_equipe (filtre RSEQ en base) ; aucun
   entraîneur-chef nommable, équipe absente ou erreur → rien n'est rendu.
   Web (onboarding, paramètres) par le composant ; appli (paramètres) par le
   hook ; l'onboarding de l'appli, qui a déjà la liste chargée, appelle
   directement entraineurChefNommable. */

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { chargerCoachsNommablesEquipe } from "@/lib/queries/athlete/coachsNommables";
import { entraineurChefNommable, texteEntraineurChef } from "@/lib/athlete/entraineurChef";

/** Le nom de l'entraîneur-chef nommable de l'équipe, ou null. */
export function useEntraineurChef(teamId: string | null | undefined): string | null {
  // Le résultat garde l'équipe lue : changer d'équipe n'affiche jamais le chef de l'ancienne.
  const [lu, setLu] = useState<{ teamId: string; nom: string | null } | null>(null);
  useEffect(() => {
    if (!teamId) return;
    let annule = false;
    void chargerCoachsNommablesEquipe(createClient(), teamId).then((coachs) => {
      if (!annule) setLu({ teamId, nom: entraineurChefNommable(coachs) });
    });
    return () => { annule = true; };
  }, [teamId]);
  return teamId && lu?.teamId === teamId ? lu.nom : null;
}

export default function EntraineurChefLecture({ teamId, className, titre, conteneurClassName }: {
  teamId: string | null | undefined;
  className?: string;
  /** Titre de section, rendu SEULEMENT avec la ligne (sinon la section entière disparaît). */
  titre?: ReactNode;
  conteneurClassName?: string;
}) {
  const nom = useEntraineurChef(teamId);
  if (!nom) return null;
  const ligne = <p className={className} data-testid="entraineur-chef">{texteEntraineurChef(nom)}</p>;
  if (!titre && !conteneurClassName) return ligne;
  return <div className={conteneurClassName}>{titre}{ligne}</div>;
}
