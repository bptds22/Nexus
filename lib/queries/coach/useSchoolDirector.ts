/* ═══════════════════════════════════════════════════════════════
   useSchoolDirector — statut « directeur d'école » du user courant.

   Un directeur (school_coaches.role ∈ {DIRECTEUR, DIRECTEUR_INTERIM})
   a, côté DB (oversight Part A), le droit de LIRE toutes les équipes /
   évaluations de SON école. Ce hook expose ce statut au front pour
   débloquer les surfaces « supervision » (liste d'équipes de l'école,
   vue directeur sur le détail d'une équipe).

   Deux formes :
     • useSchoolDirector()  — hook TanStack (cache infini, comme
       useCurrentUser : le rôle ne change pas au cours d'une visite).
     • loadSchoolDirectorStatus(supabase, userId) — version impérative
       pour les pages qui chargent en direct via supabase (equipes,
       detail d'équipe) sans passer par les hooks.

   NB : source de vérité = school_coaches.role, réconcilié avec
   users.is_school_admin par la migration director_role_sync (Part A).
   On ne lit donc PAS is_school_admin ici (ça inclurait les admins
   CÉGEP, hors périmètre — cf. scope COACH-only).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export type DirectorRole = "DIRECTEUR" | "DIRECTEUR_INTERIM";

export interface SchoolDirectorStatus {
  isDirector: boolean;
  role: DirectorRole | null;
  /** École dont le user est directeur (null si non-directeur). */
  schoolId: string | null;
}

const NOT_DIRECTOR: SchoolDirectorStatus = { isDirector: false, role: null, schoolId: null };

/** Version impérative — pour les loaders qui utilisent déjà un client
 *  supabase (pages equipes / detail). Ne throw jamais : retombe sur
 *  NOT_DIRECTOR en cas d'erreur/absence de ligne. */
export async function loadSchoolDirectorStatus(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<SchoolDirectorStatus> {
  if (!userId) return NOT_DIRECTOR;
  const { data } = await supabase
    .from("school_coaches")
    .select("school_id, role")
    .eq("coach_id", userId)
    .in("role", ["DIRECTEUR", "DIRECTEUR_INTERIM"])
    .limit(1)
    .maybeSingle();
  if (!data) return NOT_DIRECTOR;
  return {
    isDirector: true,
    role: (data as { role: DirectorRole }).role,
    schoolId: (data as { school_id: string | null }).school_id ?? null,
  };
}

export function useSchoolDirector() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<SchoolDirectorStatus>({
    queryKey: ["school-director", userId],
    queryFn: () => loadSchoolDirectorStatus(createClient(), userId),
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
