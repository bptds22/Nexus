"use client";

/* ═══════════════════════════════════════════════════════════════
   Layout /college/* — REMONTE LA TAB BAR, ne garde RIEN.

   Pourquoi il existe : MobileTabBar n'est monté que dans les trois
   layouts de rôle (app/athlete, app/coach, app/recruteur). /college
   vit hors de ces trois → aucun layout, donc aucune tab bar. Un
   athlète qui tape « Accéder à la page » depuis /athlete/recherche
   quittait le layout athlète et perdait sa navigation.

   Ce layout N'EST PAS une garde : /college est une route PUBLIQUE
   (SEO, athlète non connecté, parent, recruteur). Il ne redirige
   jamais, ne masque jamais la page. Il décide seulement s'il y a une
   tab bar À AFFICHER, et laquelle.

   Règle : la tab bar n'a de sens que pour un compte qui a un portail.
     · pas de session, ou rôle sans portail (PARENT, PARTNER, ADMIN)
       → aucune tab bar : tous les onglets mèneraient à des routes
         gardées, ce serait une navigation en trompe-l'œil.
     · COACH / RECRUTEUR / ATHLETE → sa tab bar, son rôle.

   --tabzone suit CE QUI EST RÉELLEMENT MONTÉ, pas la plateforme :
   c'est le correctif du vide de 88px. Avant, les pages réservaient
   88px dès IS_CAPACITOR, pour une barre qui n'existait pas ici. La
   variable est posée sur <body> parce que la tab bar est portalée
   là ; les pages la lisent en héritage (var(--tabzone)).

   Le rôle vient de users.role (source de vérité), comme dans les
   trois layouts de rôle — la métadonnée JWT peut être en retard.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import MobileTabBar from "@/app/_components/mobile/MobileTabBar";
import { createClient } from "@/lib/supabase/client";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Les seuls rôles qui possèdent une tab bar. */
type TabRole = "coach" | "recruteur" | "athlete";
const ROLE_TO_TAB: Record<string, TabRole> = {
  COACH: "coach",
  RECRUTEUR: "recruteur",
  ATHLETE: "athlete",
};

/** ESPACE OCCUPÉ PAR LA TAB BAR, mesuré depuis le bas du viewport : la bulle
 *  est à bottom:10 et fait 64 de haut, soit 74, plus 6px d'écart = 80. C'est
 *  aussi le `bottom` de la pilule de cible, qui se pose juste au-dessus —
 *  d'où une variable partagée plutôt que deux constantes à réaligner. */
const BARRE_AVEC = "calc(env(safe-area-inset-bottom) + 80px)";
/** Sans tab bar : juste le home indicator. La pilule descend d'autant. */
const BARRE_SANS = "env(safe-area-inset-bottom)";
/** La pilule de cible : 65px mesurés + 10px de respiration. Elle FLOTTE
 *  au-dessus du contenu — sans cette réserve elle masquerait la fin de chaque
 *  onglet. */
const PILULE = "75px";

export default function CollegeLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<TabRole | null>(null);

  useEffect(() => {
    // Hors Capacitor, MobileTabBar rend null de toute façon : aucune requête.
    if (!IS_CAPACITOR) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const { data } = await supabase
          .from("users").select("role").eq("id", session.user.id).maybeSingle();
        if (cancelled) return;
        const r = ROLE_TO_TAB[(data as { role: string | null } | null)?.role ?? ""];
        if (r) setRole(r);
      } catch {
        // Lecture qui rate → pas de tab bar. La page publique, elle, vit.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --tabzone posée sur <body> : la tab bar y est portalée, et les pages
  // (.ppm / .tpm) lisent la variable en héritage. Nettoyée au démontage pour
  // ne jamais laisser une réservation derrière soi.
  useEffect(() => {
    if (!IS_CAPACITOR) return;
    const barre = role ? BARRE_AVEC : BARRE_SANS;
    document.body.style.setProperty("--barre-zone", barre);
    // --tabzone = la réserve TOTALE en bas de page : la tab bar plus la pilule.
    document.body.style.setProperty("--tabzone", `calc(${barre} + ${PILULE})`);
    return () => {
      document.body.style.removeProperty("--tabzone");
      document.body.style.removeProperty("--barre-zone");
    };
  }, [role]);

  return (
    <>
      {children}
      {role && <MobileTabBar role={role} />}
    </>
  );
}
