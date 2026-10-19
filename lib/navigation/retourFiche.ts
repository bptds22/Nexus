/* ═══════════════════════════════════════════════════════════════
   Retour d'une fiche d'athlète vers LA PAGE D'OÙ L'ON VIENT (BP 2026-10-19 :
   « quand je back d'un profil de joueur, ça me ramène pas au mode recherche,
   ça me ramène à la page où j'étais »).

   MemoireRetour (monté une fois, à la racine) note chaque page visitée qui
   N'EST PAS une fiche ; la flèche de la fiche y retourne. On reconstruit la
   destination (pas de history.back : l'appli recharge une fiche, et un
   retour d'historique peut sortir de l'appli) — même choix qu'avant, avec
   la vraie page d'origine au lieu d'une liste d'onglets connus.
═══════════════════════════════════════════════════════════════ */

export const CLE_RETOUR_FICHE = "nexus.retourFiche";

const FICHE = /^\/(recruteur|partenaire)\/athletes\/[^/]+\/?$/;

export function estFiche(chemin: string): boolean {
  return FICHE.test(chemin.split("?")[0]);
}

/** Note la page courante (chemin + requête), sauf une fiche. */
export function noterPage(chemin: string, stockage: Pick<Storage, "setItem"> | null = sessionStorageSur()): void {
  if (!chemin || estFiche(chemin)) return;
  try { stockage?.setItem(CLE_RETOUR_FICHE, chemin); } catch { /* privé / quota */ }
}

/** La page d'origine si elle est de cet espace (« /recruteur », « /partenaire »), sinon le défaut. */
export function lireRetourFiche(espace: string, defaut: string, stockage: Pick<Storage, "getItem"> | null = sessionStorageSur()): string {
  try {
    const v = stockage?.getItem(CLE_RETOUR_FICHE) ?? "";
    return v.startsWith(espace + "/") || v === espace ? v : defaut;
  } catch {
    return defaut;
  }
}

function sessionStorageSur(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}
