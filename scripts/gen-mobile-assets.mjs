// One-shot generator for assets/source/icon.png + assets/source/splash.png.
// Composes brand icon-red.png onto Nexus dark background at the dimensions
// @capacitor/assets requires (1024 for icon, 2732 for splash).
//
// Usage: node scripts/gen-mobile-assets.mjs
// Re-run any time the brand source changes.

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SRC_ICON = path.join(root, 'public/brand/icon-red.png');
const OUT_ICON = path.join(root, 'assets/source/icon.png');
const OUT_SPLASH = path.join(root, 'assets/source/splash.png');

const BG = { r: 0x11, g: 0x13, b: 0x17, alpha: 1 };

async function genIcon() {
  // Resize icon-red to ~800px (leaves ~10% padding inside 1024) on opaque dark bg.
  const resized = await sharp(SRC_ICON)
    .resize({ width: 800, height: 800, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(OUT_ICON);
  console.log('wrote', OUT_ICON);
}

async function genSplash() {
  // Centered logo at ~30% of width (820 of 2732).
  const resized = await sharp(SRC_ICON)
    .resize({ width: 820, height: 820, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(OUT_SPLASH);
  console.log('wrote', OUT_SPLASH);
}

await genIcon();
await genSplash();
