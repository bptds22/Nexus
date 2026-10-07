/* ═══════════════════════════════════════════════════════════════
   apercuHudl — ce que la fiche montre pour un lien Hudl (recette 1.4.4).

   Le verdict vient de la fonction `apercu-hudl` (supabase/functions) :
   elle seule peut suivre un lien court et savoir si la vidéo existe
   encore (CORS). Ici : l'appel, mémorisé, et la règle d'affichage.

   LA RÈGLE — jamais un lecteur vide : un lecteur n'est rendu QUE sur
   `genre: "video"`, que la fonction ne rend qu'après avoir vu `og:video`.
   Chargement, profil, vidéo supprimée, lien inconnu, fonction muette :
   une carte « Voir sur Hudl ».

   Relevé prod 2026-10-05, 73 liens Hudl : 19 vidéos lisibles (dont 14
   liens courts), 52 profils (49 avec photo), 1 vidéo supprimée chez Hudl,
   1 bibliothèque privée.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ApercuHudl =
  | { genre: "video"; embedUrl: string; vignette: string | null; titre: string | null }
  | { genre: "profil"; vignette: string | null; titre: string | null }
  | { genre: "introuvable" }
  | { genre: "autre" };

/** Même test d'hôte que plateformeDeUrl : le domaine racine, pas un
 *  `includes` qu'un `hudl.com.exemple.net` tromperait. */
export function estLienHudl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url.trim()).hostname.toLowerCase();
    return h === "hudl.com" || h.endsWith(".hudl.com");
  } catch {
    return false;
  }
}

/** Un lecteur n'est rendu que pour ce cas-là. */
export function estLisible(a: ApercuHudl | null): a is Extract<ApercuHudl, { genre: "video" }> {
  return a?.genre === "video" && /^https:\/\/www\.hudl\.com\/embed\/video\//.test(a.embedUrl);
}

/* Mémoire de la session : une fiche rouverte, ou le même lien dans deux
   sections, ne refait pas l'appel. Un ÉCHEC n'est pas mémorisé — la
   prochaine ouverture retente. */
const memoire = new Map<string, Promise<ApercuHudl | null>>();

export function chargerApercuHudl(supabase: SupabaseClient, url: string): Promise<ApercuHudl | null> {
  const cle = url.trim();
  const deja = memoire.get(cle);
  if (deja) return deja;
  const p = supabase.functions
    .invoke<ApercuHudl>("apercu-hudl", { body: { url: cle } })
    .then(({ data, error }) => {
      if (error || !data || typeof data !== "object" || !("genre" in data)) {
        memoire.delete(cle);
        return null;
      }
      return data;
    })
    .catch(() => { memoire.delete(cle); return null; });
  memoire.set(cle, p);
  return p;
}

/** Le lien de la colonne `hudl_url` à montrer EN PLUS des vidéos de la
 *  fiche — null s'il est vide, pas Hudl, ou déjà affiché comme vidéo
 *  (même lien collé deux fois). */
export function hudlEnPlus(hudlUrl: string | null | undefined, ...videos: (string | null | undefined)[]): string | null {
  const h = hudlUrl?.trim();
  if (!h || !estLienHudl(h)) return null;
  const norme = (u: string) => u.trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();
  return videos.some((v) => v && norme(v) === norme(h)) ? null : h;
}
