/* ═══════════════════════════════════════════════════════════════
   uploadImage — helper d'upload photo PARTAGÉ (compression client).

   Pur : validate → compress (canvas natif) → upload Storage → retourne
   l'URL publique. NE fait AUCUN write DB — chaque caller garde sa
   post-action (update users.photo_url / media_partners.logo_url /
   setState / callback onboarding).

   Pourquoi : 17 surfaces dupliquées inline, cap 2 Mo qui rejetait les
   PNG (sans perte, 3-6 Mo). Ici on downscale + ré-encode → le poids
   n'est plus un problème, et le message d'erreur est uniforme.

   Compat : canvas + createImageBitmap → navigateur ET Capacitor WebView.
   - Avatars (preserveTransparency=false) → sortie JPEG (fond blanc aplati).
   - Logos  (preserveTransparency=true)  → sortie PNG (alpha préservé).
   Le helper CONTRÔLE l'extension : `pathBase` est fourni SANS extension,
   il pose .jpg ou .png selon le format de sortie (jamais un .png qui
   contient du JPEG).
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

export interface UploadImageOptions {
  /** Bucket Storage. Défaut 'avatars'. */
  bucket?: string;
  /** Chemin SANS extension, ex. `${uid}/avatar` ou `logos/schools/${id}`. */
  pathBase: string;
  /** Plus grand côté max (px). Défaut 1600. Pas d'upscale. */
  maxDimension?: number;
  /** Qualité JPEG 0..1. Défaut 0.88. Ignoré si preserveTransparency. */
  quality?: number;
  /** Plafond d'octets après compression. Défaut ~3 Mo. */
  maxBytes?: number;
  /** true → sortie PNG (logos, alpha). false (défaut) → JPEG (avatars). */
  preserveTransparency?: boolean;
  /** upsert Storage. Défaut true. */
  upsert?: boolean;
  /**
   * `Cache-Control: max-age` en secondes, en CHAÎNE. Défaut "3600".
   *
   * Ne relever cette valeur QUE si le chemin est unique par téléversement
   * (nom horodaté). Sur un chemin FIXE écrasé par `upsert`, l'URL ne
   * change pas : un long max-age fige l'ancienne image dans le navigateur
   * ET dans le CDN. C'est exactement le défaut constaté le 2026-08-31 sur
   * les logos partenaires, où 3600 suffisait déjà à servir une heure
   * d'image périmée après un remplacement.
   */
  cacheControl?: string;
}

/**
 * Chemin Storage d'une URL publique, ou null si l'URL n'appartient pas au
 * bucket. À utiliser pour PURGER un objet : on DÉRIVE le nom de ce qui est
 * stocké, on ne le devine jamais.
 *
 * C'est indispensable dès que les chemins sont horodatés : supprimer un
 * `logo.png` codé en dur ne toucherait pas `logo-1756...png`, et laisserait
 * le vrai fichier servable à son URL publique.
 *
 * Tolère un suffixe de requête et les caractères encodés.
 */
export function cheminStorageDepuisUrl(
  url: string | null | undefined,
  bucket: string,
): string | null {
  if (!url) return null;
  const marqueur = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marqueur);
  if (i === -1) return null;
  const brut = url.slice(i + marqueur.length).split("?")[0];
  if (!brut) return null;
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

export type UploadImageResult =
  | { ok: true; publicUrl: string; path: string; bytes: number; contentType: string }
  | {
      ok: false;
      code: "INVALID_TYPE" | "DECODE_FAILED" | "TOO_LARGE_AFTER_COMPRESS" | "UPLOAD_FAILED";
      message: string;
    };

const DEFAULTS = {
  bucket: "avatars",
  maxDimension: 1600,
  quality: 0.88,
  maxBytes: 3_000_000,
};

/** canvas.toBlob promisifié. */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export async function uploadImage(
  file: File,
  opts: UploadImageOptions,
): Promise<UploadImageResult> {
  const bucket = opts.bucket ?? DEFAULTS.bucket;
  const maxDimension = opts.maxDimension ?? DEFAULTS.maxDimension;
  const maxBytes = opts.maxBytes ?? DEFAULTS.maxBytes;
  const preserveTransparency = opts.preserveTransparency ?? false;
  const upsert = opts.upsert ?? true;
  const cacheControl = opts.cacheControl ?? "3600";

  // 1. Validation type — on accepte toute image (png inclus).
  if (!file.type.startsWith("image/")) {
    return { ok: false, code: "INVALID_TYPE", message: "Format non supporté — image requise (JPG, PNG…)." };
  }

  // 2. Décodage (imageOrientation: corrige l'EXIF des photos mobiles).
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, code: "DECODE_FAILED", message: "Image illisible ou corrompue." };
  }

  // 3. Downscale (jamais d'upscale) en conservant le ratio.
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { ok: false, code: "DECODE_FAILED", message: "Contexte canvas indisponible." };
  }
  // JPEG n'a pas d'alpha → fond blanc pour éviter un aplat noir sur transparence.
  if (!preserveTransparency) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // 4. Encodage.
  const contentType = preserveTransparency ? "image/png" : "image/jpeg";
  const ext = preserveTransparency ? "png" : "jpg";
  let blob: Blob | null = null;

  if (preserveTransparency) {
    // PNG : pas de qualité réglable. (Logos = petits ; si > maxBytes, échec explicite.)
    blob = await canvasToBlob(canvas, "image/png");
  } else {
    // JPEG : boucle de qualité dégressive jusqu'à passer sous maxBytes.
    let q = opts.quality ?? DEFAULTS.quality;
    blob = await canvasToBlob(canvas, "image/jpeg", q);
    while (blob && blob.size > maxBytes && q > 0.5) {
      q = Math.max(0.5, q - 0.08);
      blob = await canvasToBlob(canvas, "image/jpeg", q);
    }
  }

  if (!blob) {
    return { ok: false, code: "DECODE_FAILED", message: "Échec d'encodage de l'image." };
  }
  if (blob.size > maxBytes) {
    return {
      ok: false,
      code: "TOO_LARGE_AFTER_COMPRESS",
      message: "Image encore trop lourde après compression — essaie une image plus petite.",
    };
  }

  // 5. Upload Storage — le helper pose l'extension selon le format de sortie.
  const path = `${opts.pathBase}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert, contentType, cacheControl });
  if (error) {
    return { ok: false, code: "UPLOAD_FAILED", message: error.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { ok: true, publicUrl: data.publicUrl, path, bytes: blob.size, contentType };
}
