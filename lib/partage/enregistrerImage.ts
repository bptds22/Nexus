/* enregistrerImage — sauver une image générée dans l'appli (PNG en data URL).

   - Web : le lien <a download>, le navigateur écrit dans Téléchargements.
   - Appli : <a download> n'écrit que dans le bac à sable de la WebView, que
     personne n'atteint. On écrit le fichier dans Directory.Cache (privé à
     l'appli : aucune permission Android 10+, aucune clé Info.plist), puis
     Share.share({ files }) ouvre la feuille système, où l'on choisit
     « Enregistrer dans Photos / Fichiers » ou une appli.
   Imports dynamiques : le build web ne résout jamais les plugins Capacitor.
   Extrait de MonParcoursMobile (B-3a), qui l'utilise aussi. */

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export type IssueEnregistrement = "enregistre" | "partage" | "echec";

export async function enregistrerImage(opts: {
  dataUrl: string;
  nomFichier: string;
  /** Titre de la feuille de partage (appli). */
  titre: string;
  dialogue?: string;
}): Promise<IssueEnregistrement> {
  if (!IS_CAPACITOR) {
    const lien = document.createElement("a");
    lien.download = opts.nomFichier;
    lien.href = opts.dataUrl;
    lien.click();
    return "enregistre";
  }
  try {
    // Filesystem veut le base64 brut, sans l'en-tête `data:image/png;base64,`.
    const base64 = opts.dataUrl.split(",")[1];
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const ecrit = await Filesystem.writeFile({ path: opts.nomFichier, data: base64, directory: Directory.Cache });
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: opts.titre, files: [ecrit.uri], dialogTitle: opts.dialogue ?? opts.titre });
    return "partage";
  } catch (e) {
    const msg = (e as { message?: string } | null)?.message ?? String(e);
    // Feuille fermée par l'utilisateur : ce n'est pas un échec.
    if (/cancel|annul|abort/i.test(msg)) return "partage";
    console.error(`[enregistrerImage] ${msg}`);
    return "echec";
  }
}

/** html-to-image dans la WebView (Safari/WKWebView) rate souvent les images
 *  embarquées au 1er rendu : on « réchauffe » une fois, on garde le 2e. */
export function rendusNecessaires(): 1 | 2 {
  return IS_CAPACITOR ? 2 : 1;
}
