// components/program-wall/theme.ts
//
// Capacitor-safe color derivation. Everything here is plain JS math on hex
// strings — NO css color-mix(), so the resolved colors can be dropped straight
// into inline CSS custom properties and rendered inside a WebView safely.

export interface ProgramWallTheme {
  /** primary, verbatim */
  c1: string;
  /** secondary, verbatim */
  c2: string;
  /** primary darkened ~50% toward black (wall background) */
  c1Deep: string;
  /** primary darkened ~30% toward black (mid fills) */
  c1Mid: string;
  /** primary lightened ~42% toward white (crest spotlight highlight) */
  c1Glow: string;
  /** shared cream */
  cream: string;
  /** readable ink for text sitting on secondary-filled tiles */
  ink: string;
  /* Surface-aware accent floor. Each is `c2` when the secondary is bright/
     contrasty enough on that surface, otherwise substituted (cream on dark
     surfaces, dark ink on light ones) so c2-accents never go illegible. */
  /** accent color for c2-accents sitting on c1Deep (crest badge) */
  c2OnDeep: string;
  /** accent color for c2-accents sitting on c1Mid (fill-deep tiles, rail) */
  c2OnMid: string;
  /** accent color for c2-accents sitting on c1 (fill-c1 tiles) */
  c2OnC1: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const CREAM = "#F4F1E9";
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

const CREAM_RGB = parseHex(CREAM);
const INK_RGB = parseHex(DARK_INK);

/**
 * Resolve the accent color for a `--c2` accent sitting on `surface`.
 * Keeps the secondary when it is bright enough AND contrasty enough on that
 * surface; otherwise substitutes whichever neutral (cream or dark ink) reads
 * best against the surface. Bright secondaries (gold, orange…) always keep c2,
 * so those walls are untouched.
 */
function pickAccentOn(surface: Rgb, secondary: Rgb, secondaryHex: string): string {
  const c2IsFine =
    luminance(secondary) >= DARK_SECONDARY &&
    contrastRatio(secondary, surface) >= CONTRAST_MIN;
  if (c2IsFine) return secondaryHex;
  // c2 illegible here → pick the neutral that contrasts most with the surface:
  // cream wins on dark surfaces, dark ink wins on light ones.
  return contrastRatio(CREAM_RGB, surface) >= contrastRatio(INK_RGB, surface)
    ? CREAM
    : DARK_INK;
}

export function deriveTheme(
  primary: string,
  secondary: string,
): ProgramWallTheme {
  const p = parseHex(primary);
  const s = parseHex(secondary);

  const deep = darken(p, 0.5);
  const mid = darken(p, 0.3);

  return {
    c1: primary,
    c2: secondary,
    c1Deep: toHex(deep),
    c1Mid: toHex(mid),
    c1Glow: toHex(lighten(p, 0.42)),
    cream: CREAM,
    ink: luminance(s) > 0.6 ? DARK_INK : CREAM,
    c2OnDeep: pickAccentOn(deep, s, secondary),
    c2OnMid: pickAccentOn(mid, s, secondary),
    c2OnC1: pickAccentOn(p, s, secondary),
  };
}
