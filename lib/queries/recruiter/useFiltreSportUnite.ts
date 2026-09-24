/* ═══════════════════════════════════════════════════════════════
   useFiltreSportUnite — le filtre « sport de l'unité » de Mon CÉGEP (lot A).

   Charge les recruteurs du cégep avec leur users.sport_id, propose un sport
   par sport présent, et démarre sur le sport de l'admin (décision BP
   2026-09-24). Le choix est mémorisé pour la session de navigation
   (sessionStorage, commodité par spectateur) : il suit l'admin d'une page
   Mon CÉGEP à l'autre sans passer par l'URL.

   Les pages consomment `ids` : null = pas de filtre (Tous), sinon l'ensemble
   des recruteurs retenus. `pret` passe à vrai quand le choix est connu —
   une page qui charge ses données selon l'équipe doit l'attendre.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import {
  optionsSport, choixEffectif, idsRetenus, menuUtile,
  type MembreCegep, type OptionSport,
} from "@/lib/cegep/filtreSportUnite";

const CLE = "nx:cegep:sport-unite";

function lireMemorise(): string | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage.getItem(CLE); } catch { return null; }
}
function ecrireMemorise(v: string) {
  try { window.sessionStorage.setItem(CLE, v); } catch { /* navigation privée : le choix ne survit pas, c'est tout */ }
}

export interface FiltreSportUnite {
  pret: boolean;
  choix: string;
  setChoix: (v: string) => void;
  options: OptionSport[];
  /** Le menu offre-t-il un vrai choix (≥ 2 groupes) ? */
  visible: boolean;
  /** null = Tous ; sinon les recruteurs retenus. */
  ids: Set<string> | null;
}

export function useFiltreSportUnite(): FiltreSportUnite {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.profile.id;
  const schoolId = currentUser?.profile.school_id;

  const { data, isSuccess } = useQuery({
    queryKey: ["cegep-sport-unite", userId, schoolId],
    enabled: !!userId && !!schoolId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: moi }, { data: membres }, { data: sports }] = await Promise.all([
        supabase.from("users").select("sport_id").eq("id", userId!).single(),
        supabase.from("users").select("id, sport_id").eq("school_id", schoolId!).eq("role", "RECRUTEUR"),
        supabase.from("sports").select("id, nom"),
      ]);
      return {
        monSportId: (moi?.sport_id as string | null) ?? null,
        membres: (membres ?? []) as MembreCegep[],
        // Données SÉRIALISABLES seulement : le cache TanStack est persisté
        // (sessionStorage) et une Map en ressort en objet vide.
        sports: (sports ?? []) as { id: string; nom: string }[],
      };
    },
  });

  const [memorise, setMemorise] = useState<string | null>(lireMemorise);
  const setChoix = useCallback((v: string) => { setMemorise(v); ecrireMemorise(v); }, []);

  return useMemo(() => {
    const membres = data?.membres ?? [];
    const monSportId = data?.monSportId ?? null;
    const noms = new Map((data?.sports ?? []).map((s) => [s.id, s.nom]));
    const options = data ? optionsSport(membres, noms, monSportId) : [];
    const choix = choixEffectif(memorise, options, monSportId);
    return {
      pret: isSuccess,
      choix,
      setChoix,
      options,
      visible: menuUtile(options),
      ids: data ? idsRetenus(membres, choix) : null,
    };
  }, [data, isSuccess, memorise, setChoix]);
}
