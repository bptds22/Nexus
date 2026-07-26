"use client";

// lib/queries/schoolPage/useSchoolTargets.ts
//
// Toggle « Ajouter à mes cibles » pour le collège affiché (Bloc 2 étape 4d).
// Client AUTHENTIFIÉ : seul un ATHLÈTE (athletes.user_id = auth.uid()) peut
// cibler — la RLS « Athletes manage own targets » applique le contrôle. Le
// compteur « suivent » (count_followers_by_school, rendu serveur) est ajusté
// optimistement (+/-1) au-dessus de la valeur initiale. Viewer non-athlète
// (recruteur, déconnecté) : canTarget=false, toggle no-op (aucun effet de bord).
// SSR intact (effets client only) → non-régression /page-test préservée.

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export interface SchoolTargetsState {
  inTargets: boolean;
  canTarget: boolean;
  followers: number;
  busy: boolean;
  toggle: () => void;
}

export function useSchoolTargets(schoolId: string, initialFollowers: number): SchoolTargetsState {
  const [athleteId, setAthleteId] = React.useState<string | null>(null);
  const [inTargets, setInTargets] = React.useState(false);
  const [followers, setFollowers] = React.useState(initialFollowers);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { setFollowers(initialFollowers); }, [initialFollowers]);

  // Résout l'athlète connecté + son état de ciblage pour ce collège.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: ath } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
      if (!ath || cancelled) return;
      const aid = ath.id as string;
      setAthleteId(aid);
      const { data: row } = await supabase.from("athlete_targets")
        .select("id").eq("athlete_id", aid).eq("school_id", schoolId).maybeSingle();
      if (!cancelled) setInTargets(!!row);
    })();
    return () => { cancelled = true; };
  }, [schoolId]);

  const toggle = React.useCallback(async () => {
    if (!athleteId || busy) return;
    setBusy(true);
    const next = !inTargets;
    setInTargets(next);
    setFollowers((f) => Math.max(0, f + (next ? 1 : -1)));
    try {
      const supabase = createClient();
      if (next) {
        const { error } = await supabase.from("athlete_targets").insert({ athlete_id: athleteId, school_id: schoolId });
        if (error && error.code !== "23505") throw error; // 23505 = déjà ciblé → idempotent
      } else {
        const { error } = await supabase.from("athlete_targets").delete().eq("athlete_id", athleteId).eq("school_id", schoolId);
        if (error) throw error;
      }
    } catch {
      // rollback optimiste
      setInTargets(!next);
      setFollowers((f) => Math.max(0, f + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }, [athleteId, busy, inTargets, schoolId]);

  return { inTargets, canTarget: !!athleteId, followers, busy, toggle };
}
