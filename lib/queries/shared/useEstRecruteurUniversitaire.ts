/* Le compte connecté est-il un recruteur universitaire (users.context, lot D3b cégep) ? Faux tant que le
   profil n'est pas lu. Hook à part : une page n'a pas à relire le profil entier pour cette seule question. */

import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { estRecruteurUniversitaire } from "@/lib/auth/recruteurUniversitaire";

export function useEstRecruteurUniversitaire(): boolean {
  const { data } = useCurrentUser();
  return estRecruteurUniversitaire(data?.profile);
}
