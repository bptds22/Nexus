/* ═══════════════════════════════════════════════════════════════
   useDashboardHeader — TanStack hook (iter 5.2)
   Reproduit le bloc "Profile + school" du useEffect dashboard.
   Retourne { headerName, headerSchool } prêts à afficher.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface DashboardHeader {
  headerName: string;
  headerSchool: string;
}

export function useDashboardHeader() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<DashboardHeader>({
    queryKey: ["dashboard", "header", userId],
    queryFn: async () => {
      if (!currentUser) return { headerName: "", headerSchool: "" };
      const supabase = createClient();
      const profile = currentUser.profile;
      const headerName = `${profile.first_name || ""}`;
      let headerSchool = "";
      if (profile.school_id) {
        const { data: school } = await supabase
          .from("schools")
          .select("name")
          .eq("id", profile.school_id)
          .single();
        const div = profile.division ? `, ${profile.division}` : "";
        headerSchool = `${school?.name || ""}${div}`;
      }
      return { headerName, headerSchool };
    },
    enabled: !!userId,
  });
}
