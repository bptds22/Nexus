/* ═══════════════════════════════════════════════════════════════
   tabBarVisibility — source de vérité UNIQUE des routes où la
   MobileTabBar flottante est masquée (drill-down plein écran : thread
   de messagerie, wizard « nouveau », paramètres/réputation/équipes,
   onboarding).

   Consommée par :
     - MobileTabBar  → return null sur ces routes.
     - les layouts (coach/recruteur) → retirent le paddingBottom de 88px
       réservé à la tab bar (sinon le shell h-full d'un thread est court
       de 88px et le composer sticky flotte au-dessus du bas réel).

   En phase via cette fonction → pas de condition dupliquée en dur.
═══════════════════════════════════════════════════════════════ */

export type TabBarRole = "coach" | "recruteur" | "athlete";

/** trailingSlash:true → le pathname runtime porte un slash final. On le
 *  normalise pour les comparaisons EXACTES (parité avec MobileTabBar). */
export function normalizeTabPath(pathname: string | null | undefined): string {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/** True si la tab bar est masquée sur cette route (drill-down / wizard /
 *  onboarding plein écran). `normalizedPath` doit venir de
 *  normalizeTabPath(). */
export function isTabBarHidden(role: TabBarRole, normalizedPath: string): boolean {
  // Recruteur — drill-down messagerie (thread [id] + wizard nouveau).
  if (
    role === "recruteur" &&
    normalizedPath.startsWith("/recruteur/messages/") &&
    normalizedPath !== "/recruteur/messages"
  ) return true;

  // Coach — drill-down demandes (thread [id] + wizard nouveau).
  if (
    role === "coach" &&
    normalizedPath.startsWith("/coach/demandes/") &&
    normalizedPath !== "/coach/demandes"
  ) return true;

  // Athlète — drill-down messagerie (thread [id] + wizard nouveau).
  if (
    role === "athlete" &&
    normalizedPath.startsWith("/athlete/messages/") &&
    normalizedPath !== "/athlete/messages"
  ) return true;

  // Coach — drill-downs plein écran paramètres / réputation / équipes.
  if (role === "coach" && normalizedPath.startsWith("/coach/parametres/")) return true;
  if (role === "coach" && normalizedPath.startsWith("/coach/reputation/")) return true;
  if (role === "coach" && normalizedPath.startsWith("/coach/equipes/")) return true;

  // Onboarding plein écran (athlète / coach / recruteur).
  if (role === "athlete" && normalizedPath === "/athlete/onboarding") return true;
  if (role === "coach" && normalizedPath === "/onboarding") return true;
  if (role === "recruteur" && normalizedPath === "/onboarding") return true;

  return false;
}

/** Route de THREAD de conversation (détail [id], PAS la liste ni /nouveau).
 *  Cas spécial : la tab bar y est visible clavier FERMÉ et masquée clavier
 *  OUVERT (le composer colle alors au clavier). Les autres drill-downs
 *  d'isTabBarHidden restent masqués en permanence. */
export function isThreadRoute(role: TabBarRole, normalizedPath: string): boolean {
  if (
    role === "recruteur" &&
    normalizedPath.startsWith("/recruteur/messages/") &&
    normalizedPath !== "/recruteur/messages" &&
    normalizedPath !== "/recruteur/messages/nouveau"
  ) return true;
  if (
    role === "coach" &&
    normalizedPath.startsWith("/coach/demandes/") &&
    normalizedPath !== "/coach/demandes" &&
    normalizedPath !== "/coach/demandes/nouveau"
  ) return true;
  if (
    role === "athlete" &&
    normalizedPath.startsWith("/athlete/messages/") &&
    normalizedPath !== "/athlete/messages" &&
    normalizedPath !== "/athlete/messages/nouveau"
  ) return true;
  return false;
}
