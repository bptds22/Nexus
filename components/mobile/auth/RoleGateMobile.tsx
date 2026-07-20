"use client";

/* ═══════════════════════════════════════════════════════════════
   RoleGateMobile — interstitiel de role post-OAuth.

   PAS un second parcours de selection : une coquille autour du composant
   partage RolePickerMobile (le meme que SignupMobile ecran 0). Les 4 cartes,
   le choix scolaire/ligue-civile du coach et la derivation `collegial` du
   recruteur viennent de la, pas d'ici.

   Monte par app/inscription/role/page.tsx. Y arrivent :
     - le natif : SocialButtonsMobile, apres un signInWithIdToken reussi,
       quand needs_signup_role() est vrai et qu'aucun role n'etait connu
       (taps Google/Apple depuis Welcome ou Login) ;
     - le web : /auth/callback, meme condition (filet de securite ; le flow
       web normal transmet toujours ?role depuis son propre picker et ne
       passe donc jamais ici).

   Gardes au mount :
     - pas de session          -> /auth
     - needs_signup_role false -> on ne demande RIEN et on dispatche
       normalement (utilisateur existant : son role n'est jamais touche).

   Apres la reclamation, on appelle postLoginDispatch — JAMAIS un router.push
   code en dur. C'est ce qui preserve le gate Loi 25 : computeDispatchDestination
   teste needsConsent AVANT l'onboarding, donc un nouveau compte social sans
   date de naissance part sur /consentements, exactement comme aujourd'hui.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";
import { needsSignupRole, claimSignupRole, type ClaimableRole, type ClaimableContext } from "@/lib/auth/claimSignupRole";
import { RolePickerMobile } from "./RolePickerMobile";

type Phase = "checking" | "picking" | "claiming";

export function RoleGateMobile() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);

  /* ── Garde au mount ────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        router.replace("/auth");
        return;
      }

      const needs = await needsSignupRole(supabase);
      if (cancelled) return;

      if (!needs) {
        // Utilisateur existant (ou role deja reclame) : on ne demande rien,
        // on ne touche a rien, on dispatche.
        await postLoginDispatch(supabase, session.user, router);
        return;
      }

      setPhase("picking");
    })();
    return () => { cancelled = true; };
  }, [router]);

  /* ── Reclamation ───────────────────────────────────────────── */
  const claim = useCallback(
    async (role: ClaimableRole, context?: ClaimableContext) => {
      setPhase("claiming");
      setError(null);

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/auth");
        return;
      }

      const res = await claimSignupRole(supabase, role, context ?? null);
      if (!res.ok) {
        setError("Impossible d'enregistrer ton rôle. Réessaie.");
        setPhase("picking");
        return;
      }

      // Le role est pose en DB -> postLoginDispatch relit le profil et route
      // sur le bon wizard (/onboarding pour coach+recruteur,
      // /athlete/onboarding pour athlete), ou sur /consentements si Loi 25.
      await postLoginDispatch(supabase, session.user, router);
    },
    [router],
  );

  const handlePickAthlete = useCallback(() => {
    // Athlete : AUCUN contexte ici. Il est pose a /athlete/onboarding.
    claim("ATHLETE");
  }, [claim]);

  const handlePickPro = useCallback(
    (picked: "scolaire" | "collegial" | "ligue_civile") => {
      if (picked === "collegial") {
        claim("RECRUTEUR", "collegial");
        return;
      }
      claim("COACH", picked);
    },
    [claim],
  );

  if (phase === "checking" || phase === "claiming") {
    return (
      <div className="min-h-screen bg-[#111317] flex items-center justify-center">
        <span className="text-[13px] text-white/40">
          {phase === "claiming" ? "Enregistrement…" : "Chargement…"}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col pt-10 pb-6">
      {error && (
        <p className="mx-6 mb-2 text-[13px] text-[#EF4444] text-center">{error}</p>
      )}
      <RolePickerMobile
        onPickAthlete={handlePickAthlete}
        onPickPro={handlePickPro}
        title="Tu es ?"
        subtitle="Dis-nous qui tu es pour adapter ton compte."
      />
    </div>
  );
}
