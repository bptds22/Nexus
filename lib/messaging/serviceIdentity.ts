/* ═══════════════════════════════════════════════════════════════
   serviceIdentity — l'expéditeur AFFICHÉ des fils ADMIN_USER.

   Une seule ligne de public.users porte is_service_identity (index
   unique partiel users_service_identity_uniq). C'est elle qui signe
   les messages de service, PAS l'admin humain qui a appuyé sur
   envoyer — les deux informations existent en base, mais seule
   celle-ci s'affiche (l'autre vit dans broadcasts.sender_id).

   POURQUOI UN FETCH SÉPARÉ, jamais un embed PostgREST
   ──────────────────────────────────────────────────
   `conversations` porte DÉJÀ plusieurs FK vers `users` (coach_id,
   coach_b_id, recruiter_id, parent_id, et maintenant admin_id).
   Ajouter un second embed `users!admin_id(...)` à côté d'un embed
   `users!coach_id(...)` déclenche l'ambiguïté de FK de PostgREST et
   la requête entière échoue — le piège est déjà documenté dans
   useAthleteConversations et useCoachConversations, qui résolvent le
   recruteur par une requête à part pour cette raison exacte. Même
   remède ici, et une seule requête pour TOUS les fils du lot : il n'y
   a qu'une identité de service.

   LISIBILITÉ : la policy « service identity readable » expose cette
   ligne — et elle seule — à tout compte authentifié. Sans elle le
   destinataire lirait zéro ligne et l'UI retomberait sur son libellé
   par défaut (« Entraîneur »), c'est-à-dire une FAUSSE identité, pire
   qu'un blanc. Le repli ci-dessous dit « Équipe Nexus », jamais un
   rôle emprunté.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** Nom affiché si la ligne n'est pas lisible (jamais un rôle emprunté). */
export const SERVICE_IDENTITY_FALLBACK_NAME = "Équipe Nexus";
/** Sous-titre du fil, à la place de « Entraîneur · École X ». */
export const SERVICE_IDENTITY_ROLE_LABEL = "Message de service";

export interface ServiceIdentity {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const raw = parts.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return raw || "N";
}

/** La ligne is_service_identity, ou null si elle n'est pas (encore) posée. */
export async function fetchServiceIdentity(
  supabase: ReturnType<typeof createClient>,
): Promise<ServiceIdentity | null> {
  const { data } = await supabase
    .from("users")
    .select("id, first_name, last_name, photo_url, avatar_url")
    .eq("is_service_identity", true)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const fn = (row.first_name as string) || "";
  const ln = (row.last_name as string) || "";
  const name = `${fn} ${ln}`.trim() || SERVICE_IDENTITY_FALLBACK_NAME;
  return {
    id: row.id as string,
    name,
    initials: initialsOf(name),
    photoUrl: (row.photo_url as string) || (row.avatar_url as string) || null,
  };
}

/** Repli d'affichage quand la ligne est illisible ou absente. L'id vide
    est volontaire : aucun code ne doit s'en servir pour écrire. */
export const SERVICE_IDENTITY_FALLBACK: ServiceIdentity = {
  id: "",
  name: SERVICE_IDENTITY_FALLBACK_NAME,
  initials: initialsOf(SERVICE_IDENTITY_FALLBACK_NAME),
  photoUrl: null,
};

/* Hook partagé — l'identité ne change jamais en cours de session, donc
   staleTime Infinity : une requête par session, pas une par fil. */
export function useServiceIdentity() {
  return useQuery<ServiceIdentity | null>({
    queryKey: ["service-identity"],
    queryFn: () => fetchServiceIdentity(createClient()),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
