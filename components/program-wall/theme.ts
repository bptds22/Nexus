// components/program-wall/theme.ts
//
// Capacitor-safe color derivation for the 3-color ProgramWall (v4). Everything
// here is plain JS math on hex strings — NO css color-mix(), so the resolved
// colors drop straight into inline CSS custom properties and render inside a
// WebView safely.
//
// The coach owns THREE colors:
//   • primary   (c1) — the brand color (surfaces + pop)
//   • secondary (c2) — accent / ink
//   • tertiary  (c3) — the neutral / light (cream / white): breathing-room
//                      tiles, the logo plate, AND the fallback used whenever a
//                      brand color would go illegible on a surface.
// c3 replaces what used to be a hardcoded cream constant.

export interface ProgramWallTheme {
  /** primary, verbatim (brand) */
  c1: string;
  /** secondary, verbatim (accent / ink) */
  c2: string;
  /** tertiary, verbatim (neutral / light) */
  c3: string;
  /** primary darkened ~50% toward black (wall background) */
  c1Deep: string;
  /** primary darkened ~30% toward black (mid fills) */
  c1Mid: string;
  /** primary lightened ~42% toward white (soft highlights) */
  c1Glow: string;
  /** dark ink constant — text on light surfaces */
  ink: string;
  /** legible text / border color for a c2-filled tile */
  inkOnC2: string;
  /* v3 surface-aware accent floor (UNCHANGED logic). Each is `c2` when the
     secondary is bright+contrasty enough on that surface, else the neutral
     (c3 on dark surfaces, dark ink on light ones) so accents never go
     illegible. Bright secondaries (gold, orange…) always keep c2. */
  /** accent for c2-accents sitting on c1Deep */
  c2OnDeep: string;
  /** accent for c2-accents sitting on c1Mid (fill-deep tiles) */
  c2OnMid: string;
  /** accent for c2-accents sitting on c1 (fill-c1 tiles) */
  c2OnC1: string;
  /** brand pop on a c3 (cream) tile — c1 when legible on cream, else dark ink */
  c1OnC3: string;
  /** logo backing plate — contrast-derived light/ink so a logo always pops */
  plate: string;
  /** legible mark color ON the plate (for the initial-badge fallback): brand on
   *  a light plate, the light neutral on a dark plate. Never plate-on-plate. */
  plateInk: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const DARK_INK = "#10131A";

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Parse #rgb or #rrggbb; falls back to black on anything malformed. */
function parseHex(hex: string): Rgb {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) {
    return { r: 0, g: 0, b: 0 };
  }
  const int = parseInt(h, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Darken toward black by `fraction` (0..1). 0.5 = halfway to black. */
function darken(rgb: Rgb, fraction: number): Rgb {
  const k = 1 - fraction;
  return { r: rgb.r * k, g: rgb.g * k, b: rgb.b * k };
}

/** Lighten toward white by `fraction` (0..1). 0.4 = 40% toward white. */
function lighten(rgb: Rgb, fraction: number): Rgb {
  return {
    r: rgb.r + (255 - rgb.r) * fraction,
    g: rgb.g + (255 - rgb.g) * fraction,
    b: rgb.b + (255 - rgb.b) * fraction,
  };
}

/** Relative luminance normalized to 0..1 (per ticket: 0.299/0.587/0.114). */
function luminance({ r, g, b }: Rgb): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/* ---- WCAG-ish contrast, for the surface-aware accent floor ---- */

const CONTRAST_MIN = 3.0; // WCAG AA large-text ratio
const DARK_SECONDARY = 0.35; // secondaries below this always floor on dark surfaces

/**
 * Wall-only floor for display-scale type (30px+ rendered); below WCAG 3.0
 * large-text by deliberate product decision — decorative marketing surface,
 * vibrancy prioritized; app chrome keeps 3.0. Chosen so neon-green (contrast
 * ~2.2) flips to legible ink while mid-tone brands like orange (~2.6) keep the
 * reference's cream/brand text.
 */
export const WALL_DISPLAY_MIN_CONTRAST = 2.4;

/** sRGB channel → linear light (WCAG). */
function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (linearized). */
function wcagLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** WCAG contrast ratio between two colors (1..21). */
function contrastRatio(a: Rgb, b: Rgb): number {
  const la = wcagLuminance(a);
  const lb = wcagLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const INK_RGB = parseHex(DARK_INK);

/** Best guaranteed-legible NEUTRAL for a surface: the coach's light neutral
 *  (c3) on dark surfaces, dark ink on light ones — whichever contrasts more. */
function pickNeutralOn(surface: Rgb, lightRgb: Rgb, lightHex: string): string {
  return contrastRatio(lightRgb, surface) >= contrastRatio(INK_RGB, surface)
    ? lightHex
    : DARK_INK;
}

/**
 * v3 accent floor: keep the secondary when it is bright enough AND contrasty
 * enough on `surface`; otherwise substitute the neutral that reads best. Bright
 * secondaries (gold, orange…) always keep c2, so those walls are untouched.
 */
function pickAccentOn(
  surface: Rgb,
  secondary: Rgb,
  secondaryHex: string,
  lightRgb: Rgb,
  lightHex: string,
  { minContrast = CONTRAST_MIN }: { minContrast?: number } = {},
): string {
  const c2IsFine =
    luminance(secondary) >= DARK_SECONDARY &&
    contrastRatio(secondary, surface) >= minContrast;
  if (c2IsFine) return secondaryHex;
  return pickNeutralOn(surface, lightRgb, lightHex);
}

/** Brand accent on a LIGHT surface (cream tile). No brightness floor here — on
 *  a light surface a dark brand color is exactly what pops; only contrast
 *  matters. Falls back to dark ink for near-white primaries. */
function pickBrandOnLight(surface: Rgb, brand: Rgb, brandHex: string): string {
  return contrastRatio(brand, surface) >= CONTRAST_MIN ? brandHex : DARK_INK;
}

export function deriveTheme(
  primary: string,
  secondary: string,
  tertiary: string,
): ProgramWallTheme {
  const p = parseHex(primary);
  const s = parseHex(secondary);
  const t = parseHex(tertiary);

  const deep = darken(p, 0.5);
  const mid = darken(p, 0.3);

  return {
    c1: primary,
    c2: secondary,
    c3: tertiary,
    c1Deep: toHex(deep),
    c1Mid: toHex(mid),
    c1Glow: toHex(lighten(p, 0.42)),
    ink: DARK_INK,
    // text on c2 fills: dark ink on a light secondary, else the light neutral.
    inkOnC2: luminance(s) > 0.6 ? DARK_INK : tertiary,
    c2OnDeep: pickAccentOn(deep, s, secondary, t, tertiary),
    c2OnMid: pickAccentOn(mid, s, secondary, t, tertiary),
    c2OnC1: pickAccentOn(p, s, secondary, t, tertiary),
    c1OnC3: pickBrandOnLight(t, p, primary),
    ...derivePlate(primary, p, t, tertiary),
  };
}

/* ============================================================================
 * v7 WALL THEME — 3 coach colors → the reference's CSS var set.
 * Reuses the SAME v3 floor (pickAccentOn: lum ≥ 0.35 AND contrast ≥ 3.0) so
 * --on-c1 flips cream→dark exactly where the wall needs it (neon green, and any
 * primary whose contrast with cream drops below AA-large). One floor, one
 * threshold, everywhere. NO color-mix() — pure JS hex math (Capacitor-safe).
 * ========================================================================== */

export interface WallTheme {
  /** primary, verbatim — the reference's --red */
  red: string;
  /** primary darkened toward black — --red-deep (roundel bg, p-tri, p-check-mini) */
  redDeep: string;
  /** colorDarker, verbatim — --ink (mosaic background) */
  ink: string;
  /** darker, lightened a hair — --char (f-ink / b-vert / p-fleurs fills) */
  char: string;
  /** colorNeutral, verbatim — --cream */
  cream: string;
  /** warm tint of neutral — --kraft (b-kraft anchor) */
  kraft: string;
  /** warmer/darker tint of neutral — --beige (b-fleur) */
  beige: string;
  /** ink/text that reads ON the primary surface: cream if legible, else char */
  onC1: string;
  /** primary AS TEXT on cream: primary if legible, else the deep variant */
  c1OnCream: string;
  /** glyphe sur tuile CLAIRE quand une claire custom est définie : la claire
   *  assombrie ~38% (×0.62/canal) → lisible sur la tuile claire. Consommé
   *  conditionnellement (school.lightDefined) pour ne pas toucher le fixture. */
  tileGlyph: string;
  /** foam-finger recolor: hue-rotate(Δ from #A6192E) + saturate — rule #5 */
  foamFilter: string;
  /** Texte garanti lisible SUR la foncée (--ink). Même plancher que `onC1` :
   *  la claire de l'école si elle contraste assez, sinon l'encre sombre.
   *  Une école dont la « foncée » est en fait claire garde donc un texte
   *  lisible au lieu d'une rangée blanc-sur-blanc. */
  onInk: string;
}

const REF_PRIMARY = "#A6192E"; // the foam PNG's native red — Δ reference hue

/** RGB → HSL (h in degrees 0..360, s & l in 0..1). */
function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

/** HSL → RGB (h degrees, s & l 0..1). */
function hslToRgb(h: number, s: number, l: number): Rgb {
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: hue(hn + 1 / 3) * 255, g: hue(hn) * 255, b: hue(hn - 1 / 3) * 255 };
}

/** Per-school foam recolor. Grasset (Δ0) → identity; others rotate the red PNG
 *  toward their primary hue and match its saturation. (Revert path — kept if the
 *  colorize chain tints the cream linework.) */
function foamFilterFor(p: Rgb): string {
  const ref = rgbToHsl(parseHex(REF_PRIMARY));
  const cur = rgbToHsl(p);
  let dh = cur.h - ref.h;
  while (dh > 180) dh -= 360;
  while (dh < -180) dh += 360;
  const sat = ref.s > 0 ? cur.s / ref.s : 1;
  // LUMINOSITÉ — `hue-rotate` est une approximation matricielle qui ne touche
  // PAS la clarté : le PNG source est un rouge sombre (L≈37%), donc une école
  // à la primaire claire recevait un doigt brun/olive au lieu de sa couleur.
  // Cas réel : or #d0a62d (L≈50%) → Δh ≈ +55° sur un rouge sombre = brun.
  // On rattrape l'écart de clarté, borné pour ne pas cramer le lettrage crème
  // (déjà proche du blanc) ni noircir le corps.
  const lum = ref.l > 0 ? Math.min(1.6, Math.max(0.75, cur.l / ref.l)) : 1;
  return `hue-rotate(${Math.round(dh)}deg) saturate(${sat.toFixed(2)}) brightness(${lum.toFixed(2)})`;
}

// NOTE: a deterministic colorize chain (grayscale→sepia→saturate→hue-rotate→
// brightness) was tried to get a truer target hue. It produced a cleaner orange
// BODY but, because grayscale(1) destroys the cream linework's low saturation and
// the chain then re-colorizes every lightness toward one hue, the cream #1/outline
// picked up a light-orange tint. Per the product decision (preserve linework over
// body-hue accuracy) it was reverted to the raw hue-rotate below. Deviation logged.

/** Warm shade of the neutral — per-channel multipliers tuned so the reference
 *  neutral #F1EBDD reproduces its --kraft #E6DBC2 / --beige #D9CCAE exactly, and
 *  any other neutral gets a proportional warm-darken (blue pulled down most). */
function warmShade(n: Rgb, kr: number, kg: number, kb: number): string {
  return toHex({ r: n.r * kr, g: n.g * kg, b: n.b * kb });
}

export function deriveWallTheme(
  primary: string,
  darker: string,
  neutral: string,
  minContrast: number = WALL_DISPLAY_MIN_CONTRAST,
): WallTheme {
  const p = parseHex(primary);
  const d = parseHex(darker);
  const n = parseHex(neutral);

  // redDeep: HSL darken (L×0.74, S×1.05) — matches the reference --red-deep set
  // ~exactly (avg ΔE 4.5), keeping saturation that an RGB-multiply would wash out.
  const pHsl = rgbToHsl(p);
  const redDeep = toHex(hslToRgb(pHsl.h, Math.min(1, pHsl.s * 1.05), pHsl.l * 0.74));
  const char = toHex(lighten(d, 0.03));
  const charRgb = parseHex(char);

  // --on-c1: reuse the v3 floor at the wall's display-scale threshold — keep
  // cream on the primary if legible, else the school's own dark (char). Red +
  // orange pass at 2.4; neon-green (~2.2) flips.
  const onC1 = pickAccentOn(p, n, neutral, charRgb, char, { minContrast });
  // primary as text on cream: same threshold, deep-variant fallback.
  const c1OnCream = contrastRatio(p, n) >= minContrast ? primary : redDeep;

  return {
    red: primary,
    redDeep,
    ink: darker,
    char,
    cream: neutral,
    kraft: warmShade(n, 0.954, 0.932, 0.878),
    beige: warmShade(n, 0.9, 0.868, 0.787),
    onC1,
    c1OnCream,
    tileGlyph: toHex(darken(n, 0.38)), // claire × 0.62/canal
    foamFilter: foamFilterFor(p),
    // Réutilise pickNeutralOn — le même choix que derivePlate fait pour sa
    // plaque sombre. Pas de second plancher de contraste dans le projet.
    onInk: pickNeutralOn(d, n, neutral),
  };
}

/** The logo plate + the mark color that reads on it. The plate is whichever
 *  neutral contrasts most with the primary (so a logo pops, never brand-on-
 *  brand); the mark is the brand on a light plate, the light neutral on a dark
 *  plate (so the initial-badge fallback is never plate-on-plate). */
function derivePlate(
  primary: string,
  p: Rgb,
  t: Rgb,
  tertiary: string,
): { plate: string; plateInk: string } {
  const light = contrastRatio(t, p) >= contrastRatio(INK_RGB, p);
  const plate = light ? tertiary : DARK_INK;
  const plateRgb = light ? t : INK_RGB;
  const plateInk = light
    ? pickBrandOnLight(plateRgb, p, primary)
    : pickNeutralOn(plateRgb, t, tertiary);
  return { plate, plateInk };
}
