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

export function deriveTheme(
  primary: string,
  secondary: string,
): ProgramWallTheme {
  const p = parseHex(primary);
  const s = parseHex(secondary);

  return {
    c1: primary,
    c2: secondary,
    c1Deep: toHex(darken(p, 0.5)),
    c1Mid: toHex(darken(p, 0.3)),
    c1Glow: toHex(lighten(p, 0.42)),
    cream: CREAM,
    ink: luminance(s) > 0.6 ? DARK_INK : CREAM,
  };
}
