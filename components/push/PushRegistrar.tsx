"use client";

import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { attachPushListeners, registerPush } from "@/lib/push/registerPush";

/**
 * PushRegistrar — deux effets, deux timings, volontairement disjoints.
 * Natif uniquement (les deux fonctions sont des no-op sur web) ; ne rend rien.
 *
 * ── Effet 1 : les ÉCOUTEURS, au boot, sans condition ────────────────
 * Aucun jeton n'est demandé ni lu ici. Le seul but est qu'un écouteur
 * existe le plus tôt possible, y compris pour un usager déconnecté :
 * les deux plateformes retiennent l'événement de tap jusqu'à ce qu'un
 * écouteur s'attache, mais un événement retenu que personne n'attache
 * jamais reste retenu pour rien — c'était le cas quand l'attache
 * dépendait de l'auth.
 *
 * ── Effet 2 : le JETON, inchangé ────────────────────────────────────
 * Timing (Option A — post-onboarding) : la permission push n'est demandée
 * QUE lorsque l'utilisateur a terminé son onboarding, càd quand
 * users.onboarding_complete === true. C'est le MÊME signal que celui qui
 * pilote la redirection onboarding→dashboard (postLoginDispatch + garde de
 * layout athlète + RPC de fin de wizard), donc le push se déclenche pile au
 * passage sur le dashboard, jamais sur le 1er écran. `=== true` explicite car
 * le champ est nullable (DEFAULT false). doneRef garantit un seul appel par
 * session, y compris quand le flag passe false→true en cours de session.
 *
 * La garde de l'effet 2 est la MÊME qu'avant la scission, à la ligne près.
 * Elle est doublée d'une garde de session dans persistToken() : même si un
 * `tokenReceived` arrivait avant toute connexion, rien ne serait écrit.
 */
export function PushRegistrar() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const onboardingComplete = currentUser?.profile.onboarding_complete === true;
  const doneRef = useRef(false);
  const listenersRef = useRef(false);

  // 1. Écouteurs — au montage, sans condition d'auth.
  useEffect(() => {
    if (listenersRef.current) return;
    listenersRef.current = true;
    void attachPushListeners();
  }, []);

  // 2. Jeton — post-auth ET post-onboarding, comme avant.
  useEffect(() => {
    if (!userId || !onboardingComplete || doneRef.current) return;
    doneRef.current = true;
    void registerPush();
  }, [userId, onboardingComplete]);

  return null;
}
