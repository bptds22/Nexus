/* partagerImage — « Partager » une image générée (carte partenaire, 6.6).

   - Appli : la feuille de partage système (même chemin qu'enregistrerImage :
     fichier dans Directory.Cache puis Share.share({ files })). On y choisit
     « Enregistrer l'image » (Photos), Messages, Instagram…
   - Web : l'API Web Share avec le fichier quand le navigateur la permet
     (Safari iOS, Chrome Android) ; sinon, repli sur le téléchargement.
   Aucun plugin ajouté : @capacitor/share et @capacitor/filesystem sont déjà là. */

import { enregistrerImage, type IssueEnregistrement } from "@/lib/partage/enregistrerImage";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

function versFichier(dataUrl: string, nom: string): File {
  const [tete, base64] = dataUrl.split(",");
  const type = /data:([^;]+)/.exec(tete)?.[1] ?? "image/png";
  const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([octets], nom, { type });
}

export async function partagerImage(opts: { dataUrl: string; nomFichier: string; titre: string }): Promise<IssueEnregistrement> {
  if (IS_CAPACITOR) return enregistrerImage({ ...opts, dialogue: "Partager la carte" });
  try {
    const fichier = versFichier(opts.dataUrl, opts.nomFichier);
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [fichier] })) {
      await nav.share({ files: [fichier], title: opts.titre });
      return "partage";
    }
  } catch (e) {
    const msg = (e as { message?: string; name?: string } | null);
    if (msg?.name === "AbortError") return "partage";
    console.error(`[partagerImage] ${msg?.message ?? String(e)}`);
  }
  // Navigateur sans partage de fichier : le téléchargement, comme « Enregistrer ».
  return enregistrerImage(opts);
}
