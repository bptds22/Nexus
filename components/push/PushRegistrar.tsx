"use client";

import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { registerPush } from "@/lib/push/registerPush";

/**
 * PushRegistrar — appelle registerPush() UNE FOIS dès qu'un utilisateur
 * authentifié est disponible (useCurrentUser), côté natif uniquement
 * (registerPush() est un no-op sur web). Monté dans l'arbre de providers
 * post-auth (sous SubscriptionProvider) ; ne rend rien.
 *
 * ⚠️ Timing PROVISOIRE pour le test Phase 2B : la permission push est
 * demandée dès la 1re session authentifiée. En prod, le bon moment (après
 * onboarding / 1re action pertinente) sera calé plus tard — ce composant
 * sera alors relocalisé. Aucune logique métier ici, juste le déclencheur.
 */
export function PushRegistrar() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const doneRef = useRef(false);

  useEffect(() => {
    if (!userId || doneRef.current) return;
    doneRef.current = true;
    void registerPush();
  }, [userId]);

  return null;
}
