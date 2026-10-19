/* ═══════════════════════════════════════════════════════════════
   Miniatures des photos d'athlètes (BP 2026-10-19 : « better loading of
   image » dans la Recherche).

   Les avatars sont téléversés SANS redimensionnement (uploadAvatar) : une
   pastille de 48 px pouvait télécharger une photo de téléphone de plusieurs
   Mo. Une URL publique Supabase (/storage/v1/object/public/…) a une sœur
   redimensionnée (/storage/v1/render/image/public/…?width=…).

   Si le redimensionnement n'est pas offert par le projet (plan) : la miniature
   échoue, la photo d'origine est essayée, et si ELLE se charge, les miniatures
   s'éteignent pour la session (une seule requête perdue). Une photo absente
   (les deux en erreur) n'éteint rien.
═══════════════════════════════════════════════════════════════ */

const OBJET = "/storage/v1/object/public/";
const RENDU = "/storage/v1/render/image/public/";

let miniaturesActives = true;

/** L'URL redimensionnée (largeur en px CSS × 2 pour les écrans denses), ou l'URL telle quelle. */
export function urlMiniature(url: string | null | undefined, largeur: number): string | null {
  if (!url) return null;
  if (!miniaturesActives || !url.includes(OBJET)) return url;
  const l = Math.min(1200, Math.max(32, Math.round(largeur * 2)));
  const [base, requete] = url.split("?");
  const p = new URLSearchParams(requete ?? "");
  p.set("width", String(l));
  p.set("quality", "70");
  return `${base.replace(OBJET, RENDU)}?${p.toString()}`;
}

/** Une miniature a échoué : plus de miniatures pour cette session. */
export function eteindreMiniatures() {
  miniaturesActives = false;
}
