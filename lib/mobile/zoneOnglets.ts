// lib/mobile/zoneOnglets.ts
//
// La zone que la barre d'onglets flottante de l'appli occupe en bas de l'écran
// (app/_components/mobile/MobileTabBar.tsx : bulle 64px + bottom 10px + marge),
// la même valeur que réservent les layouts athlète, recruteur et partenaire.
// Sous Capacitor seulement : hors appli, MobileTabBar ne rend rien.

export const ZONE_ONGLETS = "calc(env(safe-area-inset-bottom) + 88px)";

/** Hauteur d'un écran plein qui commence à `haut` px : tout le viewport sur le
 *  web, le viewport moins la barre d'onglets dans l'appli. */
export function hauteurSousOnglets(haut: number, appli: boolean): string {
  const h = Math.max(0, Math.round(haut));
  return appli ? `calc(100dvh - ${h}px - ${ZONE_ONGLETS})` : `calc(100dvh - ${h}px)`;
}
