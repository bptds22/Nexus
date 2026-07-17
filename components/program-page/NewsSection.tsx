// components/program-page/NewsSection.tsx
// Section #news — grille de cartes actualités (source + titre + lien article).
// Saisie manuelle (fixture MOCK — Bloc 2). 0 news → la section n'est pas rendue
// (jamais une grille vide).

import * as React from "react";
import type { NewsItem } from "./content";

export default function NewsSection({ news }: { news?: NewsItem[] }) {
  if (!news || news.length === 0) return null;

  return (
    <section id="news">
      <div className="sec-in">
        <div className="kick">ACTUALITÉS</div>
        <h2 className="sec-h">Ce qui bouge au collège</h2>
        <div className="pbar" />

        <div className="news-grid">
          {news.map((n, i) => (
            <article className="ncard rv" key={i}>
              <span className="n-src">{n.source}</span>
              <span className="n-title">{n.titre}</span>
              <a className="n-link" href={n.url} target="_blank" rel="noopener">
                Lire l&apos;article <span className="ar">→</span>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
