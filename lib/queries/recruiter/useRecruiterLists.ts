/* ═══════════════════════════════════════════════════════════════
   useRecruiterLists — TanStack hook (iter 7.15 Sprint 1)
   Charge les listes du recruteur courant + count membres + sport
   dominant en UN seul round-trip via embed PostgREST. Calculs
   d'agrégation faits client-side (count, sport dominant).
   queryKey ["recruiter-lists", userId].

   TABLEAU BLANC (lot 2 de la 1.4.4, registre §38) : pour un Pro, les listes
   de l'UNITÉ (cégep × sport), comme le web (useListesUnite) — les siennes,
   et celles de ses collègues de la même unité, avec leur auteur. Un gratuit
   garde les siennes. La RLS décide de ce qui est lisible ; le filtre
   d'unité garde l'admin cégep sur SON sport (les autres sports relèvent du
   lot 3). Clé inchangée : useCreateList / useDeleteList la patchent.
   Tableau partagé : staleTime 0 en mode unité (rechargé à chaque affichage).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { nomAuteur, type AuteurUnite } from "@/lib/queries/recruiter/useProcessusUnite";

export interface RecruiterListSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  athleteCount: number;
  /** Nom du sport le plus représenté dans la liste (null si vide ou aucun sport). */
  dominantSport: string | null;
  /** Tableau blanc : l'auteur de la liste (absent sur un ajout optimiste). */
  recruiterId?: string;
  /** Nom de l'auteur si ce n'est PAS moi (« Créée par … »), sinon null. */
  auteur?: string | null;
  /** Vrai si la liste est lue en mode unité (Pro) : la supprimer la
   *  supprime pour toute l'unité. */
  enUnite?: boolean;
}

interface ListRow {
  recruiter_id: string;
  unite_cegep_id: string | null;
  unite_sport_id: string | null;
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  recruiter_list_members: Array<{
    athlete_id: string | null;
    athletes:
      | { sports: { nom: string | null } | { nom: string | null }[] | null }
      | { sports: { nom: string | null } | { nom: string | null }[] | null }[]
      | null;
  }> | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function computeDominantSport(members: ListRow["recruiter_list_members"]): string | null {
  if (!members || members.length === 0) return null;
  const counts = new Map<string, number>();
  members.forEach((m) => {
    const athlete = pickOne(m.athletes);
    if (!athlete) return;
    const sport = pickOne(athlete.sports);
    const nom = sport?.nom;
    if (!nom) return;
    counts.set(nom, (counts.get(nom) ?? 0) + 1);
  });
  if (counts.size === 0) return null;
  let topSport: string | null = null;
  let topCount = 0;
  counts.forEach((count, nom) => {
    if (count > topCount) {
      topCount = count;
      topSport = nom;
    }
  });
  return topSport;
}

export function useRecruiterLists() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const monCegep = currentUser?.profile.school_id ?? null;
  const { tier, loading: tierLoading } = useSubscription();
  const modeUnite = !tierLoading && (tier === "pro" || tier === "all_star");

  return useQuery<RecruiterListSummary[]>({
    queryKey: ["recruiter-lists", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      let requete = supabase
        .from("recruiter_lists")
        .select(`
          id, name, description, color, created_at, updated_at,
          recruiter_id, unite_cegep_id, unite_sport_id,
          recruiter_list_members(
            athlete_id,
            athletes(sports!sport_id(nom))
          )
        `)
        .order("updated_at", { ascending: false });
      if (!modeUnite) requete = requete.eq("recruiter_id", userId);
      const [{ data, error }, auteursRes] = await Promise.all([
        requete,
        modeUnite ? supabase.rpc("unite_auteurs") : Promise.resolve({ data: [] as AuteurUnite[], error: null }),
      ]);
      if (error) throw error;
      const auteurs: Record<string, AuteurUnite> = {};
      for (const a of ((auteursRes.data ?? []) as AuteurUnite[])) auteurs[a.id] = a;
      const monSport = auteurs[userId]?.sport_id ?? null;
      // Les miennes, et celles de MON unité (pas les autres sports d'un admin).
      const rows = ((data as ListRow[] | null) ?? []).filter((r) =>
        r.recruiter_id === userId
        || (modeUnite && !!monCegep && !!monSport && r.unite_cegep_id === monCegep && r.unite_sport_id === monSport));
      return rows.map((r) => ({
        recruiterId: r.recruiter_id,
        enUnite: modeUnite,
        auteur: r.recruiter_id === userId ? null : nomAuteur(auteurs[r.recruiter_id]),
        id: r.id,
        name: r.name,
        description: r.description,
        color: r.color || "#E63946",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        athleteCount: r.recruiter_list_members?.length ?? 0,
        dominantSport: computeDominantSport(r.recruiter_list_members),
      }));
    },
    enabled: !!userId && !tierLoading,
    staleTime: modeUnite ? 0 : 30 * 1000,
  });
}
