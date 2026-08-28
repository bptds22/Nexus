/* Génère le splash natif iOS aux couleurs Nexus.
 *
 * Pourquoi un script et pas `capacitor-assets generate` : l'outil officiel
 * régénère AUSSI les icônes d'app et le splash Android, or les deux sont
 * déjà faits et réglés à la main (itér. 7.55 côté Android, où la taille de
 * l'icône est calée sur le X de SplashAnimMobile). Un run global les
 * écraserait pour corriger un défaut qui n'existe que sur iOS.
 *
 * Ce qu'il produit : un carré 2732×2732 de fond #111317 avec le X-flamme
 * rouge centré — les mêmes deux éléments que le splash Android et que la
 * frame 0 de SplashAnimMobile, pour que le passage natif → React ne se voie
 * pas.
 *
 * LA TAILLE DU X, ET POURQUOI 400 px.
 * LaunchScreen.storyboard affiche l'image en scaleAspectFill. Sur un écran
 * portrait, une image carrée est donc mise à l'échelle par sa HAUTEUR :
 * facteur = hauteur_écran / 2732. Une largeur W dans l'image se rend donc à
 * W × hauteur_écran / 2732 points.
 * Cible : ~124 pt, la largeur du X de SplashAnimMobile (SVG_WIDTH=360,
 * X ≈ 124 px) — la même cible que celle qui a donné 180dp côté Android.
 * Sur un iPhone 14 (844 pt de haut) : W = 124 × 2732 / 844 ≈ 401 → 400.
 * Le rendu suit la hauteur de l'écran (≈98 pt sur un SE, ≈137 pt sur un
 * Pro Max) : le X respire un peu plus sur les grands écrans, ce qui est le
 * comportement voulu, pas une dérive.
 *
 * Lancement : node scripts/gen-splash-ios.mjs
 */

import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const SIZE = 2732;
const BG = { r: 0x11, g: 0x13, b: 0x17, alpha: 1 }; // #111317
const X_WIDTH = 400;

const svg = readFileSync("public/brand/icon-red.svg");
const x = await sharp(svg, { density: 900 }).resize({ width: X_WIDTH }).png().toBuffer();
const xMeta = await sharp(x).metadata();

const out = await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: BG },
})
  .composite([{
    input: x,
    left: Math.round((SIZE - xMeta.width) / 2),
    top: Math.round((SIZE - xMeta.height) / 2),
  }])
  .png()
  .toBuffer();

/* Les trois fichiers de l'imageset portent le même contenu (1x/2x/3x) :
 * c'est la convention posée par Capacitor pour ce splash, on la garde.
 * assets/splash*.png sont les SOURCES que capacitor-assets relirait — les
 * mettre à jour évite qu'un futur run réintroduise le défaut bleu. */
const targets = [
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
  "assets/splash.png",
  "assets/splash-dark.png",
];
for (const t of targets) {
  writeFileSync(t, out);
  console.log("écrit:", t, out.length, "octets");
}
console.log("X rastérisé:", `${xMeta.width}x${xMeta.height}`, "dans", `${SIZE}x${SIZE}`);
