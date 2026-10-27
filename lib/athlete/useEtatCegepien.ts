"use client";

/* État « cégep » de l'athlète connecté (lot C1 cégep) : interrupteur lancement_collegial, type de
   son école d'ancrage, équipe de cégep ou non, cégep tapé à la main, année de fin. Lu une fois au
   montage, relu par `recharger()` (après un rattachement). Lecture seule ; échec = rien d'affiché. */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lireLancementCollegial } from "@/lib/config/lancementCollegial";

export type EtatCegepien = {
  lancementCollegial: boolean;
  athleteId: string | null;
  typeEcole: string | null;
  dansEquipeDeCegep: boolean;
  ecoleNonListee: string | null;
  anneeDiplomation: number | null;
};

const VIDE: EtatCegepien = {
  lancementCollegial: false, athleteId: null, typeEcole: null,
  dansEquipeDeCegep: false, ecoleNonListee: null, anneeDiplomation: null,
};

const un = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null));

export function useEtatCegepien(): { etat: EtatCegepien; charge: boolean; recharger: () => void } {
  const [etat, setEtat] = useState<EtatCegepien>(VIDE);
  const [charge, setCharge] = useState(false);
  const [tour, setTour] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const on = await lireLancementCollegial(supabase);
      // OFF : rien à montrer, rien à lire de plus.
      if (!on) { if (alive) { setEtat(VIDE); setCharge(true); } return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (alive) { setEtat({ ...VIDE, lancementCollegial: true }); setCharge(true); } return; }
      const { data } = await supabase
        .from("athletes")
        .select("id, annee_diplomation, ecole_non_listee, schools!school_id(type), team_athletes(teams!team_id(schools!school_id(type)))")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!alive) return;
      const r = (data ?? null) as Record<string, unknown> | null;
      const ta = un<Record<string, unknown>>(r?.team_athletes);
      const typeEquipe = un<{ type?: string }>(un<Record<string, unknown>>(ta?.teams)?.schools)?.type ?? null;
      setEtat({
        lancementCollegial: true,
        athleteId: (r?.id as string) ?? null,
        typeEcole: un<{ type?: string }>(r?.schools)?.type ?? null,
        dansEquipeDeCegep: typeEquipe === "CEGEP",
        ecoleNonListee: (r?.ecole_non_listee as string) ?? null,
        anneeDiplomation: (r?.annee_diplomation as number) ?? null,
      });
      setCharge(true);
    })().catch(() => { if (alive) { setEtat(VIDE); setCharge(true); } });
    return () => { alive = false; };
  }, [tour]);

  const recharger = useCallback(() => setTour((n) => n + 1), []);
  return { etat, charge, recharger };
}
