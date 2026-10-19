/* ═══════════════════════════════════════════════════════════════
   Barre du bas PERSONNALISABLE (BP 2026-10-19 : « laisser tout le monde
   déplacer les features qu'il veut dans la barre »).

   Chacun choisit jusqu'à 4 onglets (le 5e reste « Plus ») parmi ceux de son
   rôle, dans l'ordre voulu. Le choix est rangé dans les métadonnées du compte
   (auth user_metadata.barre_nav[rôle]) : il suit la personne d'un appareil à
   l'autre, sans migration. Aucun choix (ou un choix illisible) → la barre par
   défaut. Ce n'est qu'un raccourci : chaque écran garde sa propre porte (Pro…).
═══════════════════════════════════════════════════════════════ */

export const MAX_ONGLETS = 4;
export const EVENEMENT_BARRE_PERSO = "nx-barre-perso";
export const EVENEMENT_OUVRIR_BARRE_PERSO = "nx-ouvrir-barre-perso";

export type RoleBarre = "recruteur" | "partenaire";

/** Les onglets choisis, dans l'ordre ; les clés inconnues ou en double sont ignorées. Rien → le défaut. */
export function resoudreBarre<T extends { key: string }>(choix: readonly string[] | null | undefined, pool: readonly T[], defaut: readonly T[]): T[] {
  if (!choix || choix.length === 0) return [...defaut];
  const parCle = new Map(pool.map((t) => [t.key, t]));
  const r: T[] = [];
  for (const k of choix) {
    const t = parCle.get(k);
    if (t && !r.includes(t)) r.push(t);
    if (r.length === MAX_ONGLETS) break;
  }
  return r.length > 0 ? r : [...defaut];
}

/** Le choix rangé pour ce rôle dans user_metadata, ou null. */
export function lireChoixBarre(meta: Record<string, unknown> | null | undefined, role: RoleBarre): string[] | null {
  const b = meta?.barre_nav as Record<string, unknown> | undefined;
  const v = b?.[role];
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]).slice(0, MAX_ONGLETS) : null;
}

/** Les métadonnées à écrire : le choix de ce rôle remplacé (null = revenir au défaut), les autres gardés. */
export function avecChoixBarre(meta: Record<string, unknown> | null | undefined, role: RoleBarre, choix: readonly string[] | null): Record<string, unknown> {
  const avant = (meta?.barre_nav as Record<string, unknown> | undefined) ?? {};
  const apres = { ...avant };
  if (choix && choix.length > 0) apres[role] = [...new Set(choix)].slice(0, MAX_ONGLETS);
  else delete apres[role];
  return { barre_nav: apres };
}
