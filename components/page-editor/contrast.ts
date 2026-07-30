// components/page-editor/contrast.ts
//
// Contrast helpers — 1:1 port of the mock's lum()/ratio() (docs/reference/
// editeur-page-cegep-mock.html). VOLONTAIREMENT non standard : l'exposant gamma
// est 2.4 (pas 2.2) et le plancher d'affichage est 2.4, pour laisser passer les
// rouges d'école sombres tout en protégeant la lisibilité sur le fond Nexus.
// NE PAS « corriger » vers du WCAG strict — le mock est la spec.

export function lum(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function ratio(h1: string, h2: string): number {
  const a = lum(h1);
  const b = lum(h2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Plancher de contraste (Principale ↔ fond Nexus #111317). Sous ce seuil, la
// couleur est « éclaircie automatiquement » à l'affichage public (Bloc 2).
export const CONTRAST_FLOOR = 2.4;
