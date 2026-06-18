/* ═══════════════════════════════════════════════════════════════
   useCreateList — TanStack mutation (iter 7.15 Sprint 1)
   INSERT recruiter_lists (name, description, color). Optimistic add
   en tête de ["recruiter-lists", userId] (sorted by updated_at DESC).
   Revert au snapshot si erreur DB.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { RecruiterListSummary } from "@/lib/queries/recruiter/useRecruiterLists";

export interface CreateListInput {
  name: string;
  description: string | null;
  color?: string;
}

export function useCreateList() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async (input: CreateListInput): Promise<RecruiterListSummary> => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const payload = {
        recruiter_id: userId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color || "#E63946",
      };
      const { data, error } = await supabase
        .from("recruiter_lists")
        .insert(payload)
        .select("id, name, description, color, created_at, updated_at")
        .single();
      if (error) throw error;
      return {
        id: data.id as string,
        name: data.name as string,
        description: (data.description as string | null) ?? null,
        color: (data.color as string) || "#E63946",
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
        athleteCount: 0,
        dominantSport: null,
      };
    },
    onMutate: async (input) => {
      const queryKey = ["recruiter-lists", userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RecruiterListSummary[]>(queryKey);
      const optimistic: RecruiterListSummary = {
        id: `temp-${Math.floor(Math.random() * 1e9)}`,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color || "#E63946",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        athleteCount: 0,
        dominantSport: null,
      };
      queryClient.setQueryData<RecruiterListSummary[]>(queryKey, (prev) => [
        optimistic,
        ...(prev ?? []),
      ]);
      return { previous, queryKey };
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: (newList, _input, context) => {
      // Iter 7.22 — remplace IMMÉDIATEMENT le temp-id de l'item optimistic par
      // la vraie row DB. Avant : si l'utilisateur tappait sur la nouvelle carte
      // entre onMutate et le refetch de onSettled (~100-500ms), router.push
      // emportait l'id "temp-XXX" dans l'URL → useDynamicParam le ressortait →
      // useListAthletes/useAddListNote envoyaient "temp-XXX" comme list_id à
      // Postgres → erreur "invalid input syntax for type uuid" + skeleton infini.
      // setQueryData ici garantit que dès la résolution de l'INSERT, le cache
      // contient le vrai UUID, même AVANT le refetch.
      if (!context?.queryKey) return;
      queryClient.setQueryData<RecruiterListSummary[]>(
        context.queryKey,
        (prev) => (prev ?? []).map((l) => (l.id.startsWith("temp-") ? newList : l)),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter-lists", userId] });
    },
  });
}
