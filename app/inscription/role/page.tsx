"use client";

/* ═══════════════════════════════════════════════════════════════
   /inscription/role — interstitiel de selection de role post-OAuth.

   PAGE (pas un route handler) : elle est donc incluse dans le build mobile
   output:'export' et fonctionne dans l'app native, contrairement a
   /auth/callback qui en est exclu.

   Route et non etat local, pour trois raisons :
     - le natif y arrive par router.replace apres signInWithIdToken ;
     - le web y arrive par une redirection depuis /auth/callback (le flow
       OAuth web est une redirection navigateur : le composant appelant est
       demonte, un callback onNeedsRole ne pourrait jamais se declencher) ;
     - un kill de l'app pendant l'ecran ne perd rien : role_claimed_at est
       toujours NULL, l'utilisateur y revient au prochain login.
═══════════════════════════════════════════════════════════════ */

import { RoleGateMobile } from "@/components/mobile/auth/RoleGateMobile";

export default function InscriptionRolePage() {
  return <RoleGateMobile />;
}
