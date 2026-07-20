"use client";

import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { registerPush } from "@/lib/push/registerPush";

/**
 * PushRegistrar — appelle registerPush() UNE FOIS, côté natif uniquement
 * (registerPush() est un no-op sur web). Monté dans l'arbre de providers
 * post-auth (sous SubscriptionProvider) ; ne rend rien.
 *
 * Timing (Option A — post-onboarding) : la permission push n'est demandée
 * QUE lorsque l'utilisateur a terminé son onboarding, càd quand
 * users.onboarding_complete === true. C'est le MÊME signal que celui qui
 * pilote la redirection onboarding→dashboard (postLoginDispatch + garde de
 * layout athlète + RPC de fin de wizard), donc le push se déclenche pile au
 * passage sur le dashboard, jamais sur le 1er écran. `=== true` explicite car
 * le champ est nullable (DEFAULT false). doneRef garantit un seul appel par
 * session, y compris quand le flag passe false→true en cours de session.
 */
export function PushRegistrar() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const onboardingComplete = currentUser?.profile.onboarding_complete === true;
  const doneRef = useRef(false);

  useEffect(() => {
    if (!userId || !onboardingComplete || doneRef.current) return;
    doneRef.current = true;
    void registerPush();
  }, [userId, onboardingComplete]);

  return null;
}
