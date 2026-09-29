"use client";

/* Purge le sac de l'onboarding (nexus_user) une fois l'onboarding terminé,
   ou s'il appartient à un autre compte. Monté par les barres latérales des
   portails qui passent par l'onboarding (recruteur, coach). */

import { useEffect } from "react";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { purgerSacOnboarding } from "@/lib/auth/sacOnboarding";

export function usePurgeSacOnboarding(): void {
  const { data: moi } = useCurrentUser();
  useEffect(() => {
    if (moi) purgerSacOnboarding({ email: moi.authUser.email, onboardingComplete: moi.profile.onboarding_complete });
  }, [moi]);
}
