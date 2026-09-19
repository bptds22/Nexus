/* ═══════════════════════════════════════════════════════════════
   Fond « playbook » STATIQUE — les mêmes dessins que l'accueil
   (./playbookTiles), figés. Composant SERVEUR : aucun 'use client', aucun
   hook, aucun JavaScript envoyé au navigateur.

   Pourquoi pas PlaybookBackground (l'accueil) sur une page de transit :
   mesuré le 2026-09-18 (iPhone émulé, CPU ×4), son animation de tracé dure
   8,4 s et coûte ~740 ms de travail navigateur (+649 recalculs de style,
   +396 mises en page) — pile pendant que la vue Instagram tente d'ouvrir
   le store. Une seule tuile figée : ~1,3 Ko compressés, zéro coût après
   l'affichage.

   `preserveAspectRatio="xMidYMid slice"` : sur un téléphone en portrait, la
   tuile est AGRANDIE puis recadrée au centre, au lieu d'être réduite à ~27 %
   de sa largeur (où les traits de 2,2 deviennent des filets illisibles).

   Opacité 0,28 comme l'accueil (.playbook-bg), mais SANS cette classe : elle
   porte la dérive animée (playbookDrift, 55 s, infinie). Aucune animation ici.

   À poser dans un parent `.hero-playbook` (globals.css) : `isolation:
   isolate` garde le zIndex -1 au-dessus du fond du parent, et son ::after
   porte le halo rouge de l'accueil.
   ═══════════════════════════════════════════════════════════════ */

import { DefsPlaybook, TUILES_PLAYBOOK, marqueursPlaybook } from "./playbookTiles";

type Props = {
  /** Préfixe OBLIGATOIRE des identifiants des pointes de flèche : les ids SVG
   *  sont globaux au document, deux fonds sans préfixe entreraient en
   *  collision avec ceux de l'accueil (« ah » / « ah2 »). */
  prefixe: string;
  /** Laquelle des quatre tuiles de l'accueil (0 à 3). */
  tuile?: 0 | 1 | 2 | 3;
};

export default function PlaybookStatique({ prefixe, tuile = 0 }: Props) {
  const { ids, refs } = marqueursPlaybook(prefixe);
  return (
    <div
      aria-hidden
      className="playbook-statique pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: -1, opacity: 0.28 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <DefsPlaybook ids={ids} />
        {TUILES_PLAYBOOK[tuile](refs)}
      </svg>
    </div>
  );
}
