/* imageInjoignable — une photo qui ne se charge pas (404, CORS, réseau) est
   SAUTÉE à l'export de carte, au lieu de faire échouer toute l'image.

   html-to-image remplace une image qu'il n'arrive pas à lire par
   `imagePlaceholder` ; sans lui, il pose une source vide, l'<img> du clone
   échoue et `toPng` rejette — et il garde cet échec en cache jusqu'au
   rechargement de la page. Un pixel transparent laisse la carte telle quelle,
   sans la photo.

   Partagé par les trois exports : Mon parcours (web et appli) et le
   téléchargement de la fiche partenaire (web et appli). */

/** PNG 1×1 transparent. */
export const IMAGE_INJOIGNABLE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** À étaler dans les options de `toPng`. */
export const OPTIONS_IMAGE_INJOIGNABLE = { imagePlaceholder: IMAGE_INJOIGNABLE } as const;
