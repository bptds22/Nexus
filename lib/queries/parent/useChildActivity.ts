"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   useChildActivity — l'activité anonyme de l'enfant, en un seul endroit.

   Extrait TEL QUEL de app/parent/(app)/activite/page.tsx : même préambule
   (get_my_children → premier enfant), même RPC get_child_activity, même
   traitement d'erreur. AUCUNE nouvelle RPC, aucune agrégation ajoutée —
   les bornes de semaines et le comptage restent entièrement côté serveur.

   Factorisé parce que la carte Résumé de l'accueil affiche le même graphe :
   deux copies de la même lecture auraient divergé au premier changement de
   bornes, et le graphe de l'accueil aurait silencieusement cessé de dire la
   même chose que la page Activité.

   ⚠️ PREMIER ENFANT SEULEMENT — `rows[0]`. C'est la convention de TOUT le
   portail parent (accueil, activité, consentements, notifications font le
   même choix), pas une décision prise ici. Il n'existe aucun sélecteur
   multi-enfants : un parent de deux athlètes n'en voit qu'un, sans que rien
   ne le signale. Dette connue, à traiter dans un lot dédié — le jour où le
   sélecteur arrive, c'est ICI qu'il se branche, plus dans cinq copies.
   ═══════════════════════════════════════════════════════════════ */

export interface ChildActivity {
  views_total: number;
  favorites_total: number;
  weekly: { week_start: string; count: number }[];
  error?: string;
}

export interface UseChildActivityResult {
  data: ChildActivity | null;
  loading: boolean;
  /** Message prêt à afficher, ou null. Même libellés que la page Activité. */
  loadError: string | null;
  /** athlete_id résolu — évite aux appelants de refaire get_my_children. */
  athleteId: string | null;
}

export function useChildActivity(): UseChildActivityResult {
  const [data, setData] = useState<ChildActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: kids } = await supabase.rpc("get_my_children");
      if (cancelled) return;
      const aid = ((kids as Array<{ athlete_id: string }> | null) ?? [])[0]?.athlete_id ?? null;
      if (!aid) {
        setLoadError("Aucun enfant associé à ce compte.");
        setLoading(false);
        return;
      }
      setAthleteId(aid);
      const { data: res, error } = await supabase.rpc("get_child_activity", { p_athlete_id: aid });
      if (cancelled) return;
      const a = res as ChildActivity;
      if (error || a?.error) {
        setLoadError("Impossible de charger l'activité.");
        setLoading(false);
        return;
      }
      setData(a);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, loadError, athleteId };
}
