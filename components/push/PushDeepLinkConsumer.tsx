"use client";

/* ═══════════════════════════════════════════════════════════════
   PushDeepLinkConsumer — le tap qui ouvre le bon écran, APP VIVANTE.

   Couvre les cas 1 (premier plan) et 2 (arrière-plan → resume) : la
   session existe déjà, on navigue tout de suite.
   Les cas 3 (démarrage à froid) et 4 (déconnecté) ne passent PAS ici :
   ils sont consommés par postLoginDispatch, qui est l'entonnoir unique
   du boot ET du login. Une seule intention, deux consommateurs, et
   takePendingIntent() lit-et-efface pour qu'elle ne serve qu'une fois.

   Démarrage à froid (relevé émulateur 1.4.5) : l'événement de tap, retenu
   par le plugin, arrive PENDANT l'amorçage, sur /auth. Le consommer ici
   faisait une course perdue : ce composant poussait la carte, puis
   postLoginDispatch, ne trouvant plus rien, poussait l'accueil par-dessus.
   Sur une page d'amorçage (/, /auth), on laisse donc l'intention à
   postLoginDispatch ; et si elle est arrivée après lui, on la reprend dès
   que la page n'est plus une page d'amorçage.

   iOS affiche la bannière même au premier plan
   (presentationOptions: ['badge','sound','alert'] dans capacitor.config),
   donc le cas 1 EST un tap : même chemin que le cas 2, pas de mécanisme
   à part.

   Le rôle est lu à la demande, et SEULEMENT quand une intention est
   réellement là : useCurrentUser ne sélectionne pas users.role, et
   l'élargir pour un besoin aussi rare ferait grossir un cache partagé
   par toute l'app. Une requête d'une colonne, quelques fois par mois.

   Ne rend rien. No-op sur web (aucun événement n'y est jamais émis).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { createClient } from "@/lib/supabase/client";
import { PUSH_DEEPLINK_EVENT } from "@/lib/push/registerPush";
import { takePendingIntent, resolveDestination } from "@/lib/push/pushIntent";

/** Pages où postLoginDispatch n'a pas encore tranché la destination. */
export function estPageAmorcage(chemin: string): boolean {
  return chemin === "/" || chemin === "/auth" || chemin.startsWith("/auth/");
}

export function PushDeepLinkConsumer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id ?? null;

  // Le listener est monté une fois ; la session, elle, arrive plus tard.
  // Un ref évite de la capturer périmée dans la closure.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  // Un tap reçu AVANT que la session soit connue (fréquent au resume) ne
  // doit pas être perdu : on le note, et l'effet sur [userId] rejoue.
  const deferredRef = useRef(false);
  const pathname = usePathname();

  const consume = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid || estPageAmorcage(window.location.pathname)) {
      // Pas encore de session : l'intention reste en Preferences. Soit ce
      // composant la reprend quand la session arrive, soit — si l'app était
      // froide ou l'usager déconnecté — postLoginDispatch la trouvera au
      // bout du boot.
      deferredRef.current = true;
      return;
    }

    const intent = await takePendingIntent();
    if (!intent) return;
    deferredRef.current = false;

    const supabase = createClient();
    const { data: profile } = await supabase
      .from("users").select("role").eq("id", uid).maybeSingle();
    const role = (profile as { role?: string } | null)?.role ?? "";

    const dest = await resolveDestination(supabase, role, intent);
    if (dest) router.push(dest);
  }, [router]);

  useEffect(() => {
    const onDeepLink = () => { void consume(); };

    // Message arrivé au premier plan : aucune navigation (l'usager n'a
    // rien demandé), mais l'inbox et les badges cessent de mentir.
    const onReceived = () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };

    window.addEventListener(PUSH_DEEPLINK_EVENT, onDeepLink);
    window.addEventListener("nx-push-received", onReceived);
    return () => {
      window.removeEventListener(PUSH_DEEPLINK_EVENT, onDeepLink);
      window.removeEventListener("nx-push-received", onReceived);
    };
  }, [consume, queryClient]);

  // Rejoue le tap mis de côté dès que la session est connue et que
  // l'amorçage est fini (postLoginDispatch a eu sa chance d'abord).
  useEffect(() => {
    if (!userId || !deferredRef.current || estPageAmorcage(pathname ?? "")) return;
    void consume();
  }, [userId, pathname, consume]);

  return null;
}
