"use client";

// components/page-editor/SportsAffiche.tsx — S2 « L'affiche » (AUTO)
// Dérivé des équipes (seed RSEQ) — verrouillé, rien à éditer ici.

import * as React from "react";
import { SPORTS_AFFICHE } from "./fixture";
import { useToast } from "./toast";

export default function SportsAffiche() {
  const toast = useToast();
  return (
    <section className="sec">
      <div className="sech"><span className="num">2</span><h2>Sports — « L'affiche »</h2><span className="tag auto">AUTO</span></div>
      <div className="cols">
        <div className="panel">
          <div className="pt">DÉRIVÉ DE TES ÉQUIPES — RIEN À FAIRE ICI</div>
          <div className="aff">
            {SPORTS_AFFICHE.map((r) => (
              <div className="affrow" key={r.sport}>
                <span className="s">{r.sport}</span>
                {r.pills.map((p, i) => <span className="pill" key={i}>{p}</span>)}
              </div>
            ))}
          </div>
          {/* Bloc 2 : route réelle vers Mes équipes */}
          <a className="autolink" onClick={() => toast("Route vers Mes équipes")}>Gérer mes équipes →</a>
          <div className="note">Les rangées, divisions et genres viennent de <b>tes équipes</b> (seed RSEQ + Mes équipes). Ajouter/retirer un sport = gérer l'équipe, la page suit toute seule.</div>
        </div>
        <div className="pv"><div className="panel">
          <div className="pvhead">UNE ÉQUIPE MANQUE OU EST EN TROP ?</div>
          <div className="fact" style={{ display: "block" }}>
            <b>La page suit tes équipes, automatiquement.</b>
            <span style={{ display: "block", marginTop: 8, lineHeight: 1.55 }}>Un <b style={{ color: "#EDEFF3" }}>coach ou directeur</b> de ton collège crée (ou corrige) l'équipe dans <b style={{ color: "#EDEFF3" }}>Mes équipes</b> → elle apparaît ici toute seule. La plupart des équipes RSEQ sont déjà chargées par Nexus — vérifie avant de créer, le système te proposera d'adopter l'existante.</span>
          </div>
        </div></div>
      </div>
    </section>
  );
}
