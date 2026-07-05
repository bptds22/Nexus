// components/program-page/AboutSell.tsx
// S3 — À PROPOS : the coach sell text (mock carries <b>/<span class="hl">;
// coach-authored HTML would be moderated in Bloc 2 — TODO(bloc2)).

import * as React from "react";
import GhostLayer from "./GhostLayer";

export default function AboutSell({
  title,
  sellText,
}: {
  title: string;
  sellText: string;
}) {
  return (
    <section id="apropos">
      <GhostLayer section="apropos" />
      <div className="sec-in">
        <div className="kick">À PROPOS</div>
        <h2 className="sec-h">{title}</h2>
        <div className="pbar" />
        {/* TODO(bloc2): sellText is coach-authored — sanitize/moderate before render */}
        <p className="sell rvy" dangerouslySetInnerHTML={{ __html: sellText }} />
      </div>
    </section>
  );
}
