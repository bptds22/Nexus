"use client";

/* Init UNIQUE du plugin social au boot de l'app (étape 2). Idempotent +
   native-only (cf. lib/auth/socialInit). Rendu null — effet de bord seul. */

import { useEffect } from "react";
import { initSocialLogin } from "@/lib/auth/socialInit";

export function SocialLoginInit() {
  useEffect(() => {
    void initSocialLogin().catch(() => { /* erreur déjà loggée dans le helper */ });
  }, []);
  return null;
}
