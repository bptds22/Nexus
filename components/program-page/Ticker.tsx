// components/program-page/Ticker.tsx
// Marquee of the wall vocabulary — content duplicated ×3, CSS translateX(-50%)
// loop (prefers-reduced-motion → static, handled in CSS).

import * as React from "react";
import type { TickerWord } from "./content";

export default function Ticker({ words }: { words: TickerWord[] }) {
  return (
    <div className="ticker">
      <div className="ticker-in">
        {[0, 1, 2].map((rep) =>
          words.map((w, i) => (
            <React.Fragment key={`${rep}-${i}`}>
              <span className={w.hot ? "g" : undefined}>{w.text}</span>
              <i>★</i>
            </React.Fragment>
          )),
        )}
      </div>
    </div>
  );
}
