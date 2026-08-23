/* ═══════════════════════════════════════════════════════════════
   useConversations — TanStack hook (iter 5.2)
   Liste des conversations du recruteur courant + dernier message
   par conversation. Reproduit fidèlement le useEffect ligne 146 de
   app/recruteur/messages/page.tsx.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import { fetchServiceIdentity, SERVICE_IDENTITY_FALLBACK, SERVICE_IDENTITY_ROLE_LABEL } from "@/lib/messaging/serviceIdentity";

export interface ThreadData {
  id: string;
  /** 'RECRUTEUR_COACH' (about an athlete, counterparty = coach) |
      'RECRUTEUR_ATHLETE' (DIRECT, counterparty = athlete). */
  conversationType: string;
  coachName: string;
  coachInitials: string;
  coachSchool: string;
  coachId: string;
  coachPhotoUrl: string | null;
  athleteName: string;
  /**
   * Initiales de l'athlète — VIDE sous identité réservée.
   *
   * Ce n'est pas un oubli : deux lettres recoupées à l'école et à la
   * position réidentifient. Les consommateurs doivent lire
   * `athleteIdentityVisible` et rendre LockedIdentityPlaceholder, jamais
   * retomber sur ces initiales ni les redériver depuis athleteName —
   * qui vaut « Identité réservée » et donnerait « IR ».
   */
  athleteInitials: string;
  /** Décision SERVEUR (identity_visible de la RPC). false = nom, photo et
   *  dossard sont ABSENTS de la réponse, pas juste cachés à l'écran.
   *  À lire TOUJOURS avec athleteCardMissing — false seul ne dit pas
   *  laquelle des deux causes s'applique. */
  athleteIdentityVisible: boolean;
  /**
   * La RPC n'a rendu AUCUNE ligne pour cet athlète.
   *
   * Troisième état, distinct du masquage : la RPC filtre `status = 'ACTIF'`,
   * donc un athlète EN_ATTENTE/DESACTIVE/DIPLOME — ou une conversation sans
   * athlete_id (GROUP, COACH_COACH) — sort du périmètre sans que rien ne soit
   * verrouillé. Confondre les deux affichait le cadenas « Identité réservée »
   * sur un athlète public : cause fausse, et sur /recruteur/messages ça a
   * suffi à déclencher le placeholder qui recouvrait la liste entière.
   */
  athleteCardMissing: boolean;
  athleteId: string;
  athletePhotoUrl: string | null;
  athletePosition: string;
  athleteVerified: boolean;
  athleteStars: number;
  athleteRecruitmentStatus: string;
  lastMessage: string;
  lastMessageAt: string;
  /** sender_id du DERNIER message du fil (null si aucun message). Sert au
      filtre "Sans réponse" : lastSenderId === recruteur courant → en attente. */
  lastSenderId: string | null;
  unreadCount: number;
  status: string;
}

export function useConversations() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<ThreadData[]>({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, conversation_type, status, last_message_at, unread_count, created_at,
          coach:users!coach_id(id, first_name, last_name, photo_url, avatar_url, school_id, schools!school_id(name)),
          athlete_id, admin_id
        `)
        .eq("recruiter_id", userId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // ADMIN_USER — l'identité de service. Fetch séparé : `conversations`
      // porte déjà un embed users!coach_id, un second embed users!admin_id
      // déclencherait l'ambiguïté de FK PostgREST.
      const hasAdminThread = data.some((c: Record<string, unknown>) => c.conversation_type === "ADMIN_USER");
      const serviceIdentity = hasAdminThread
        ? (await fetchServiceIdentity(supabase)) ?? SERVICE_IDENTITY_FALLBACK
        : SERVICE_IDENTITY_FALLBACK;

      // Récupérer le dernier message par conversation
      const convIds = data.map((c: Record<string, unknown>) => c.id as string);
      const lastMsgMap = new Map<string, string>();
      const lastSenderMap = new Map<string, string>();
      if (convIds.length > 0) {
        const { data: msgData } = await supabase
          .from("messages")
          .select("conversation_id, content, sender_id")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });
        if (msgData) {
          // Premier vu par conversation = le plus récent (ordre desc) → contenu + expéditeur.
          for (const m of msgData as { conversation_id: string; content: string; sender_id: string }[]) {
            if (!lastMsgMap.has(m.conversation_id)) {
              lastMsgMap.set(m.conversation_id, m.content);
              lastSenderMap.set(m.conversation_id, m.sender_id);
            }
          }
        }
      }

      /* Temps 2 — les cartes projetées, résolues par lot.
         Le coach reste en embed : `users` n'est pas `athletes`, la
         projection Loi 25 ne le concerne pas. Seul l'athlète bascule. */
      const cardMap = await fetchRecruiterAthleteCards(
        supabase,
        data.map((c: Record<string, unknown>) => c.athlete_id as string).filter(Boolean),
      );

      // Mapping identique à la page existante
      return data.map((c: Record<string, unknown>): ThreadData => {
        const coachRaw = c.coach;
        const coach = (Array.isArray(coachRaw) ? coachRaw[0] : coachRaw) as Record<string, unknown> | null;
        const coachSchoolRaw = coach?.schools;
        const coachSchool = (Array.isArray(coachSchoolRaw) ? coachSchoolRaw[0] : coachSchoolRaw) as { name?: string } | null;

        // `?? null` explicite : la RPC ne rend rien pour un athlète inactif
        // ou supprimé, et un `undefined` interpolé écrirait "undefined".
        const card = cardMap.get(c.athlete_id as string) ?? null;
        /* `?? false` fait échouer VERS LE MASQUAGE, ce qui est le bon défaut
           quand la question est « a-t-on le droit d'afficher ». Mais il écrase
           deux causes en une : d'où cardMissing à côté, pour que l'UI dise la
           vraie raison au lieu d'inventer un verrou Loi 25. */
        const cardMissing = card === null;
        const identityVisible = card?.identity_visible ?? false;

        const isNexus = (c.conversation_type as string) === "ADMIN_USER";
        const coachFirst = (coach?.first_name as string) || "";
        const coachLast = (coach?.last_name as string) || "";
        const athFirst = card?.first_name ?? "";
        const athLast = card?.last_name ?? "";

        return {
          id: c.id as string,
          conversationType: (c.conversation_type as string) || "RECRUTEUR_COACH",
          /* ADMIN_USER : la contrepartie est l'identité de service. Sans
             cette branche le repli « Coach » s'afficherait — une fausse
             identité, exactement ce que la policy « service identity
             readable » existe pour éviter. */
          coachName: isNexus ? serviceIdentity.name : `${coachFirst} ${coachLast}`.trim() || "Coach",
          coachInitials: isNexus ? serviceIdentity.initials : `${coachFirst[0] || ""}${coachLast[0] || ""}`.toUpperCase(),
          coachSchool: isNexus ? SERVICE_IDENTITY_ROLE_LABEL : coachSchool?.name || "",
          coachId: isNexus ? ((c.admin_id as string) || "") : (coach?.id as string) || "",
          coachPhotoUrl: isNexus ? serviceIdentity.photoUrl : (coach?.photo_url as string) || (coach?.avatar_url as string) || null,
          // displayFullName porte les trois cas (carte absente, masquée, nom
          // partiel). Le repli « Athlète » a disparu : il inventait un nom
          // pour cacher un nom absent.
          athleteName: displayFullName(card),
          // Sous masquage athFirst/athLast sont vides -> initiales vides,
          // volontairement. Voir le commentaire du type.
          athleteInitials: `${athFirst[0] || ""}${athLast[0] || ""}`.toUpperCase(),
          athleteIdentityVisible: identityVisible,
          athleteCardMissing: cardMissing,
          athleteId: (c.athlete_id as string) || "",
          athletePhotoUrl: card?.photo_url ?? null,
          athletePosition: card?.position_abbr ?? "",
          athleteVerified: !!card?.verified,
          athleteStars: card?.cote_globale ?? 0,
          athleteRecruitmentStatus: card?.recruitment_status ?? "OUVERT",
          lastMessage: lastMsgMap.get(c.id as string) || "",
          lastMessageAt: (c.last_message_at as string) || (c.created_at as string) || "",
          lastSenderId: lastSenderMap.get(c.id as string) ?? null,
          unreadCount: (c.unread_count as number) || 0,
          status: (c.status as string) || "ACTIVE",
        };
      });
    },
    enabled: !!userId,
  });
}
