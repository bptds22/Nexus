/* ═══════════════════════════════════════════════════════════════
   rolesFiges — les rôles qui ne se CHOISISSENT jamais à l'inscription.

   Un PARENT (créé par le claim d'invitation), un PARTNER (créé par l'admin)
   et un ADMIN ont un rôle ATTRIBUÉ : aucun écran de choix de rôle, aucun
   paramètre ?role= ne doit l'écraser (décision BP 2026-09-29, après le cas
   d11e2688 : un parent passé ATHLETE en se connectant par Google).

   MIROIR de la base : needs_signup_role() et claim_signup_role() ouvrent sur
   la même liste (migration 20260929150639). Toute modification se fait des
   deux côtés.
═══════════════════════════════════════════════════════════════ */

export const ROLES_FIGES = ["PARENT", "PARTNER", "ADMIN"] as const;

export function estRoleFige(role: string | null | undefined): boolean {
  return !!role && (ROLES_FIGES as readonly string[]).includes(role);
}
