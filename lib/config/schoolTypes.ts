/**
 * Type d'établissement — libellés d'affichage pour schools.type.
 *
 * La table `schools` sert de plomberie commune à trois réalités qui ne
 * sont PAS toutes des écoles : une école secondaire, un CÉGEP, et un
 * club / corporation de ligue civile. Dire « École » sur la ligne d'un
 * club civil est faux, et c'est exactement ce qui faisait lire un
 * rattachement légitime comme un onboarding inachevé dans le portail
 * admin.
 *
 * `schools.type` est NOT NULL et ne porte que ces trois valeurs en base
 * (vérifié au catalogue). Le `?? ` de secours dans schoolTypeLabel ne
 * couvre donc qu'un ajout futur non répercuté ici.
 *
 * Pattern calqué sur lib/config/civilVocab.ts : en-tête JSDoc, type en
 * haut, exports nommés, valeurs littérales inline (rien de piloté par la
 * base).
 */

export type SchoolType = "SECONDAIRE" | "CEGEP" | "LIGUE_CIVILE";

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  SECONDAIRE: "École secondaire",
  CEGEP: "CÉGEP",
  LIGUE_CIVILE: "Ligue / club",
};

/**
 * Libellé lisible pour un type d'établissement. Rend une chaîne vide si
 * le type est absent, pour que l'appelant puisse afficher le nom seul
 * plutôt qu'un « undefined » ou un type inventé.
 */
export function schoolTypeLabel(type: string | null | undefined): string {
  if (!type) return "";
  return SCHOOL_TYPE_LABELS[type as SchoolType] ?? type;
}

export interface EmbeddedSchool {
  name: string | null;
  type: string | null;
}

/**
 * Normalise l'embed PostgREST `schools!school_id(name,type)`.
 *
 * Sur une relation to-one PostgREST rend un objet, mais supabase-js le
 * type parfois en tableau ; /admin/recruteurs fait déjà ce
 * `Array.isArray(raw) ? raw[0] : raw` en ligne. Factorisé ici parce que
 * quatre surfaces admin en ont désormais besoin.
 */
export function embeddedSchool(raw: unknown): EmbeddedSchool | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "object") return null;
  const row = value as { name?: string | null; type?: string | null };
  return { name: row.name ?? null, type: row.type ?? null };
}
