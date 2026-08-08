/* ═══════════════════════════════════════════════════════════════
   useCurrentUser — TanStack hook (iter 5.2)
   Factorise auth.getUser() + public.users profile lookup. Utilisé
   par toutes les queries qui ont besoin de l'userId courant ou de
   metadata de profil (first_name, school_id, role, etc.).

   staleTime/gcTime infinis : la session utilisateur ne change pas
   au cours d'une visite. Au logout, le QueryClient est vidé
   (geste explicite à appeler côté flow auth).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface CurrentUserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  school_id: string | null;
  division: string | null;
  sport: string | null;
  /** users.onboarding_complete — nullable (DEFAULT false). Lu par PushRegistrar
      pour ne demander la permission push qu'une fois l'onboarding terminé. */
  onboarding_complete: boolean | null;
  /** ÉLÉVATION PLATEFORME — le compte fondateur, indépendant de l'enum de rôle.
   *  C'est EXACTEMENT le prédicat que teste can_edit_school_page côté base :
   *  l'éditeur de page collège s'en sert pour ouvrir le mode admin. Ne pas le
   *  remplacer par role='ADMIN' / is_admin() — ce sont d'autres prédicats, et
   *  l'interface proposerait alors ce que la RLS refuse. */
  is_platform_admin: boolean | null;
}

export interface CurrentUserData {
  authUser: User;
  profile: CurrentUserProfile;
}

export function useCurrentUser() {
  return useQuery<CurrentUserData>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, first_name, last_name, school_id, division, sport, onboarding_complete, is_platform_admin")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;

      return { authUser: user, profile: profile as CurrentUserProfile };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
