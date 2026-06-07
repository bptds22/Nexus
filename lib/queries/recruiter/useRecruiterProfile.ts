/* ═══════════════════════════════════════════════════════════════
   useRecruiterProfile — TanStack hook (iter 5.3a)
   Fetch les 13 colonnes du profil recruteur (séparé de
   useCurrentUser qui reste minimal). Utilisé par la page Mon Profil.
   staleTime 10 min — le profil change rarement.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface RecruiterProfile {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  school_id: string | null;
  photo_url: string | null;
  title: string | null;
  division: string | null;
  team_name: string | null;
  sport: string | null;
  region: string | null;
}

export function useRecruiterProfile() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<RecruiterProfile | null>({
    queryKey: ["recruiterProfile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("first_name, last_name, role, school_id, photo_url, title, division, team_name, sport, region")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data as RecruiterProfile;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}
