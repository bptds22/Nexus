"use client";

/* Les noms des cégeps connus (schools type CEGEP), pour ressembleACegep().
   Une seule lecture par écran ; un échec rend une liste vide, et la
   détection se rabat sur les seuls mots collégiaux (« cégep », « DEC »…). */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useNomsCegeps(actif: boolean = true): string[] {
  const [noms, setNoms] = useState<string[]>([]);
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    (async () => {
      const { data, error } = await createClient()
        .from("schools").select("name").eq("type", "CEGEP");
      if (!vivant || error) return;
      setNoms((data ?? []).map((r) => (r as { name: string }).name).filter(Boolean));
    })();
    return () => { vivant = false; };
  }, [actif]);
  return noms;
}
