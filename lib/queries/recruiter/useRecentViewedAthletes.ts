/* ═══════════════════════════════════════════════════════════════
   useRecentViewedAthletes — TanStack hook (iter 6.0a)
   N derniers athlètes consultés par le recruteur courant (dédup
   par athlete_id si vues multiples). staleTime 2 min.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";

export interface RecentViewedAthlete {
  id: string;
  /** false = identité masquée par le serveur (Loi 25 ou tier FREE). */
  identityVisible: boolean;
  /** Déjà résolu par displayFullName() — ne jamais reconcaténer. */
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  sport: string | null;
  position: string | null;
  school: string | null;
  viewedAt: string;
}

export function useRecentViewedAthletes(limit = 3) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<RecentViewedAthlete[]>({
    queryKey: ["recentViewedAthletes", userId, limit],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      /* Temps 1 — les vues seules, embed athletes retiré. */
      const { data, error } = await supabase
        .from("recruiter_athlete_views")
        .select("athlete_id, viewed_at")
        .eq("recruiter_id", userId)
        .order("viewed_at", { ascending: false })
        .limit(limit * 3);
      if (error) throw error;

      /* Dédup AVANT la RPC : on ne résout que les athlètes qu'on gardera. */
      const seen = new Set<string>();
      const ordered: { id: string; viewedAt: string }[] = [];
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const aid = row.athlete_id as string;
        if (seen.has(aid)) continue;
        seen.add(aid);
        ordered.push({ id: aid, viewedAt: row.viewed_at as string });
        if (ordered.length >= limit) break;
      }

      /* Temps 2 — les cartes projetées. */
      const cardMap = await fetchRecruiterAthleteCards(supabase, ordered.map((o) => o.id));

      const out: RecentViewedAthlete[] = [];
      for (const o of ordered) {
        const card = cardMap.get(o.id) ?? null;
        // L'ancien code sautait la ligne quand l'embed rendait null
        // (athlète inactif) — la RPC filtre pareil, on conserve ce saut.
        if (!card) continue;
        out.push({
          id: card.id,
          identityVisible: card.identity_visible,
          fullName: displayFullName(card),
          firstName: card.first_name ?? "",
          lastName: card.last_name ?? "",
          photoUrl: card.photo_url ?? null,
          sport: card.sport_nom ?? null,
          position: card.position_abbr ?? null,
          school: card.school_name ?? null,
          viewedAt: o.viewedAt,
        });
      }
      return out;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}
