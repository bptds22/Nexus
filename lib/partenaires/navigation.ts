"use client";

/* Navigation du portail partenaire — ce qui s'affiche, web et appli (1.4.5, B1).
   Depuis le 2026-10-18 (6.1), une seule entrée « Mes athlètes » (/partenaire/mes-athletes,
   pastilles En attente / Mes évaluations) ; /partenaire/prospects n'est plus qu'une redirection.

   « Mes évaluations » (/partenaire/mes-athletes) et « Mes athlètes » (/partenaire/prospects,
   ex-« Mes prospects ») — noms de la 1.4.5 — n'existent que pour un partenaire qui
   peut évaluer (`media_partners.peut_evaluer`). La barre latérale du web et la
   barre d'onglets de l'appli lisent la MÊME règle. Ce n'est qu'un affichage :
   les RPC de ces écrans refusent d'elles-mêmes un partenaire sans permission. */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const ENTREES_EVALUATION: readonly string[] = ["/partenaire/mes-athletes", "/partenaire/prospects"];

export function entreeVisible(href: string, peutEvaluer: boolean | null | undefined): boolean {
  return !ENTREES_EVALUATION.includes(href) || peutEvaluer === true;
}

/** `peut_evaluer` du partenaire connecté ; null tant que ce n'est pas lu. */
export function usePeutEvaluer(actif = true): boolean | null {
  const [peut, setPeut] = useState<boolean | null>(null);
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !vivant) return;
      const { data } = await supabase.from("media_partners").select("peut_evaluer").eq("user_id", user.id).maybeSingle();
      if (vivant) setPeut(data?.peut_evaluer === true);
    })();
    return () => { vivant = false; };
  }, [actif]);
  return peut;
}
