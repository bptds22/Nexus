'use client';

import { useEffect, useRef, useCallback } from 'react';
import { DefsPlaybook, TUILES_PLAYBOOK, marqueursPlaybook } from './playbookTiles';

/* ─────────────────────────────────────────────────────────────────────
   Fond ANIMÉ de la page d'accueil. Les dessins vivent dans
   ./playbookTiles (partagés avec le fond statique de /app) ; ce composant
   ne porte que l'animation de tracé.
   Identifiants de pointes de flèche : préfixe vide → « ah » / « ah2 »,
   les identifiants historiques, à l'identique.
───────────────────────────────────────────────────────────────────── */
const MARQUEURS     = marqueursPlaybook();
const TILES_CONTENT = TUILES_PLAYBOOK.map((tuile) => tuile(MARQUEURS.refs));
const TILE_COUNT    = TILES_CONTENT.length;

/* ─────────────────────────────────────────────────────────────────── */

export default function PlaybookBackground() {
  const svgRefs  = useRef<(SVGSVGElement | null)[]>(Array(TILE_COUNT).fill(null));
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevLight = useRef<boolean | null>(null);

  const animate = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    document.body.classList.remove('playbook-drawn');

    /* Reset all tiles */
    svgRefs.current.forEach(svg => {
      if (!svg) return;
      Array.from(svg.querySelectorAll<SVGElement>('path, line, circle, rect, text')).forEach(el => {
        el.style.transition = 'none';
        if (el.tagName === 'circle') {
          el.style.opacity   = '0';
          el.style.transform = 'scale(0)';
        } else if (el.hasAttribute('stroke-dasharray')) {
          el.style.opacity = '0';
        } else {
          const len = (el as unknown as SVGGeometryElement).getTotalLength?.() ?? 200;
          el.style.strokeDasharray  = String(len);
          el.style.strokeDashoffset = String(len);
        }
      });
    });

    document.body.getBoundingClientRect(); // force reflow

    /* Animate all tiles simultaneously — text & diagrams in parallel */
    let maxDelay = 0;
    svgRefs.current.forEach(svg => {
      if (!svg) return;
      const allEls = Array.from(svg.querySelectorAll<SVGElement>('path, line, circle, rect, text'));
      const diagramEls = allEls.filter(el => el.tagName !== 'text');
      const textEls    = allEls.filter(el => el.tagName === 'text');

      /* Diagram elements — circles, lines, paths, rects */
      let dDelay = 61;
      diagramEls.forEach(el => {
        const hasDash = el.hasAttribute('stroke-dasharray');
        const d = dDelay;
        if (el.tagName === 'circle') {
          const id = setTimeout(() => {
            el.style.transition    = 'opacity 0.19s ease, transform 0.29s cubic-bezier(0.34,1.56,0.64,1)';
            el.style.opacity       = '';
            el.style.transform     = 'scale(1)';
          }, d);
          timeouts.current.push(id);
          dDelay += 65;
        } else if (hasDash) {
          const id = setTimeout(() => {
            el.style.transition = 'opacity 0.38s ease-in-out';
            el.style.opacity    = '';
          }, d);
          timeouts.current.push(id);
          dDelay += 92;
        } else {
          const len = (el as unknown as SVGGeometryElement).getTotalLength?.() ?? 200;
          const dur = Math.min(1.08, Math.max(0.22, len / 455));
          const id  = setTimeout(() => {
            el.style.transition       = `stroke-dashoffset ${dur}s ease-in-out`;
            el.style.strokeDashoffset = '0';
          }, d);
          timeouts.current.push(id);
          dDelay += Math.round(dur * 459) + 68;
        }
      });

      /* Text elements — animate concurrently, starting at the same base delay */
      let tDelay = 61;
      textEls.forEach(el => {
        const len = (el as unknown as SVGGeometryElement).getTotalLength?.() ?? 300;
        const dur = Math.min(2.15, Math.max(0.9, len / 155));
        const id = setTimeout(() => {
          el.style.transition       = `stroke-dashoffset ${dur}s ease-in-out`;
          el.style.strokeDashoffset = '0';
        }, tDelay);
        timeouts.current.push(id);
        tDelay += Math.round(dur * 382) + 153;
      });

      maxDelay = Math.max(maxDelay, dDelay, tDelay);
    });

    const doneId = setTimeout(() => document.body.classList.add('playbook-drawn'), maxDelay + 300);
    timeouts.current.push(doneId);
  }, []);

  useEffect(() => {
    prevLight.current = document.body.classList.contains('light-mode');
    animate();
    const observer = new MutationObserver(() => {
      const isLight = document.body.classList.contains('light-mode');
      if (isLight !== prevLight.current) {
        prevLight.current = isLight;
        animate();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => { observer.disconnect(); timeouts.current.forEach(clearTimeout); };
  }, [animate]);

  return (
    <div
      aria-hidden
      className="playbook-bg absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {TILES_CONTENT.map((content, i) => (
        <svg
          key={i}
          ref={(el: SVGSVGElement | null) => { svgRefs.current[i] = el; }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          width="100%"
          style={{ display: 'block' }}
        >
          {/* Markers defined once in tile 0; global IDs resolve across all inline SVGs */}
          {i === 0 && <DefsPlaybook ids={MARQUEURS.ids} />}
          {content}
        </svg>
      ))}
    </div>
  );
}
