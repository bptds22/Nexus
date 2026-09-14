/* ═══════════════════════════════════════════════════════════════
   plateformesLien — QUELLE plateforme se cache derrière une URL.

   ── POURQUOI CE MODULE ──────────────────────────────────────────
   Trois liens de l'athlète vivent dans des colonnes NOMMÉES —
   `hudl_url`, `youtube_url`, `instagram_url` — et là, la plateforme
   est connue d'avance : rien à deviner.

   Trois AUTRES sont des URL libres — `video_faits_saillants_url`,
   `video_match_complet_url`, `video_entrainement_url` — où l'athlète
   colle ce qu'il veut. Elles s'affichaient donc sous un libellé
   générique et une icône passe-partout, alors que l'URL dit la
   plateforme. Ce module la lit.

   ── LA DÉTECTION N'EST PAS NEUVE ────────────────────────────────
   `components/ui/VideoEmbed.tsx` reconnaît déjà YouTube et Hudl pour
   construire ses URL d'intégration. Ce module reprend les MÊMES tests
   de nom d'hôte et les expose pour l'affichage. Le jour où une
   plateforme s'ajoute, les deux fichiers doivent bouger ensemble —
   d'où ce rappel ici plutôt qu'un troisième jeu de règles ailleurs.

   ── UN REPLI, JAMAIS UN VIDE ────────────────────────────────────
   Une URL non reconnue rend `autre` avec son NOM D'HÔTE en libellé
   (« vimeo.com » plutôt que « Lien »). Un domaine inconnu reste une
   information ; « Lien » n'en est pas une.
═══════════════════════════════════════════════════════════════ */

export type ClePlateforme =
  | "hudl" | "youtube" | "instagram" | "vimeo"
  | "tiktok" | "x" | "facebook" | "drive" | "autre";

export interface Plateforme {
  cle: ClePlateforme;
  /** Ce qui s'affiche à l'écran. Pour `autre`, le nom d'hôte. */
  libelle: string;
}

/** Nom d'hôte sans `www.`, ou null si l'URL est inexploitable. */
function hote(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** La plateforme derrière une URL. `null` si l'URL est vide ou invalide —
 *  l'appelant décide alors de ne rien rendre du tout. */
export function plateformeDeUrl(url: string | null | undefined): Plateforme | null {
  const h = hote(url);
  if (!h) return null;

  /* Mêmes tests que VideoEmbed : `endsWith` sur le domaine racine plutôt
     qu'un `includes`, sinon « faux-youtube.com » passerait. */
  const est = (racine: string) => h === racine || h.endsWith(`.${racine}`);

  if (est("hudl.com")) return { cle: "hudl", libelle: "Hudl" };
  if (est("youtube.com") || h === "youtu.be") return { cle: "youtube", libelle: "YouTube" };
  if (est("instagram.com")) return { cle: "instagram", libelle: "Instagram" };
  if (est("vimeo.com")) return { cle: "vimeo", libelle: "Vimeo" };
  if (est("tiktok.com")) return { cle: "tiktok", libelle: "TikTok" };
  if (est("x.com") || est("twitter.com")) return { cle: "x", libelle: "X" };
  if (est("facebook.com") || est("fb.watch")) return { cle: "facebook", libelle: "Facebook" };
  if (est("drive.google.com")) return { cle: "drive", libelle: "Google Drive" };

  return { cle: "autre", libelle: h };
}

/** Pour les colonnes NOMMÉES, la plateforme est connue : pas de devinette.
 *  Sert à garder un seul vocabulaire d'affichage entre les deux familles. */
export const PLATEFORME_PAR_COLONNE: Record<string, Plateforme> = {
  hudl_url: { cle: "hudl", libelle: "Hudl" },
  youtube_url: { cle: "youtube", libelle: "YouTube" },
  instagram_url: { cle: "instagram", libelle: "Instagram" },
};

/** Teinte de marque, pour l'icône uniquement. `autre` reste gris : une
 *  couleur inventée sur un domaine inconnu serait un faux signal. */
export const TEINTE_PLATEFORME: Record<ClePlateforme, string> = {
  hudl: "#FF6300",
  youtube: "#FF0000",
  instagram: "#E1306C",
  vimeo: "#1AB7EA",
  tiktok: "#25F4EE",
  x: "#FFFFFF",
  facebook: "#1877F2",
  drive: "#FBBC04",
  autre: "#6B7280",
};
