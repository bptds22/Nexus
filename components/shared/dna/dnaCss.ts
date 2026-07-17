// components/shared/dna/dnaCss.ts
//
// ADN VISUEL PARTAGÉ — source de vérité UNIQUE du vocabulaire décoratif Nexus
// (mots fantômes, motifs masqués, craie playbook, marque Nexus, grain, damier).
//
// Extrait verbatim de la page école (.pp) — mêmes valeurs, mêmes assets, zéro
// redessin. Consommé par la page école ET la page équipe : les deux ajoutent la
// classe `nx-dna` sur leur racine et injectent DNA_CSS.
//
// Contrat côté consommateur — 2 tokens à mapper sur la racine :
//   --dna-mark : la couleur de marque de la page (école → var(--red),
//                équipe → var(--team)). Peint .gm / .nxmask / .pbar.
//   --dna-ink  : l'encre claire (craie / fantômes chauds).
//
// Règles : opacity-only, aucun color-mix(), aucune rotation animée sur un
// élément ancré (les rotations ici sont statiques, posées à la construction).

export const DNA_CSS = `
/* ── couche 0 : conteneur de fantômes ─────────────────────────────────────── */
.nx-dna .nx-ghosts{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}

/* ── mots fantômes — 3 voix : Anton contour / Playfair italique / marqueur ── */
.nx-dna .gwd{position:absolute;pointer-events:none;font-family:'Anton';text-transform:uppercase;color:transparent;-webkit-text-stroke:1.4px rgba(237,239,243,.06);white-space:nowrap;z-index:0;line-height:1}
.nx-dna .gwi{position:absolute;pointer-events:none;font-family:'Playfair Display';font-style:italic;font-weight:700;color:rgba(237,239,243,.05);white-space:nowrap;z-index:0;line-height:1}
.nx-dna .gmk{position:absolute;pointer-events:none;font-family:'Permanent Marker';color:rgba(237,239,243,.06);white-space:nowrap;z-index:0;line-height:1}

/* ── motifs masqués — peints à la couleur de marque de la page ────────────── */
.nx-dna .gm{position:absolute;pointer-events:none;background:var(--dna-mark);z-index:0}
.nx-dna .gm-fleur{-webkit-mask:url(/logos/fleur-de-lys.png) center/contain no-repeat;mask:url(/logos/fleur-de-lys.png) center/contain no-repeat}
.nx-dna .gm-maple{-webkit-mask:url(/logos/maple-leaf.png) center/contain no-repeat;mask:url(/logos/maple-leaf.png) center/contain no-repeat}
.nx-dna .gm-nx{-webkit-mask:url(/logos/nexus-x.png) center/contain no-repeat;mask:url(/logos/nexus-x.png) center/contain no-repeat}
.nx-dna .grseq{position:absolute;pointer-events:none;z-index:0;filter:grayscale(1) brightness(2.6);opacity:.045}

/* ── playbook (craie) — X/O, flèches pointillées, routes ──────────────────── */
.nx-dna .gchalk{position:absolute;pointer-events:none;color:var(--dna-ink);opacity:.05;z-index:0}
.nx-dna .spine{position:absolute;pointer-events:none;color:var(--dna-ink);opacity:.05;z-index:0}
.nx-dna .xo{position:absolute;pointer-events:none;color:var(--dna-ink);opacity:.07;z-index:0}

/* ── marque Nexus (X masqué) ──────────────────────────────────────────────── */
.nx-dna .nxmask{background:var(--dna-mark);filter:brightness(1.25);-webkit-mask:url(/logos/nexus-x.png) center/contain no-repeat;mask:url(/logos/nexus-x.png) center/contain no-repeat}

/* ── grain global ─────────────────────────────────────────────────────────── */
.nx-dna .pgrain{position:fixed;inset:0;z-index:1;pointer-events:none;mix-blend-mode:overlay;opacity:.18}

/* ── barre damier (sous les titres de section) ────────────────────────────── */
.nx-dna .pbar{width:100px;height:9px;background:repeating-conic-gradient(var(--dna-mark) 0 25%,transparent 0 50%) 0 0/9px 9px;margin:14px 0 8px}
`;
