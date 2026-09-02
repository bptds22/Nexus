"use client";

// components/page-editor/SaisonEnCoursSection.tsx — S2b « Saison en cours » (AUTO)
//
// Résultats et classements RSEQ de l'école connectée. VERROUILLÉ : rien à
// éditer, et c'est le point — ce bloc n'est pas de l'éditorial, c'est de la
// donnée vivante rafraîchie chaque mercredi par la veille RSEQ.
//
// Même discipline que SportsAffiche (S2) : on branche la MÊME fonction que la
// page publique — `loadSaisonEnCours` — sur la même base. Une seule source,
// donc l'éditeur et la page publiée ne peuvent pas diverger. Le recruteur voit
// exactement ce que verra un visiteur.
//
// `school_page_content` ne gagne AUCUNE colonne : il n'y a rien à sauver.
//
// Pas de VisibilityToggle : masquer ses résultats n'est pas une option
// éditoriale qu'on a décidé d'offrir. Si ça le devient un jour, ce sera une
// décision explicite, pas un oubli qu'on comble.

import * as React from "react";
import { useEditor } from "./editorContext";
import PreviewShell from "./PreviewShell";
import RealSaisonEnCours from "@/components/program-page/SaisonEnCours";
import { loadSaisonEnCours, saisonCourante, type EquipeSaison } from "@/lib/queries/schoolPage/saisonEnCours";

type Etat =
  | { s: "load" }
  | { s: "err"; msg: string }
  | { s: "ok"; equipes: EquipeSaison[] };

export default function SaisonEnCoursSection() {
  const { client, schoolId } = useEditor();
  const [etat, setEtat] = React.useState<Etat>({ s: "load" });

  React.useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const equipes = await loadSaisonEnCours(client, schoolId);
        if (annule) return;
        setEtat({ s: "ok", equipes });
      } catch (e) {
        if (annule) return;
        setEtat({ s: "err", msg: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { annule = true; };
  }, [client, schoolId]);

  const joue = etat.s === "ok" ? etat.equipes.filter((e) => e.matchsJoues > 0).length : 0;

  return (
    <section className="sec">
      <div className="sech">
        <span className="num">2b</span>
        <h2>Saison en cours</h2>
        <span className="tag auto">AUTO</span>
      </div>

      <div className="cols">
        <div className="panel">
          <div className="pt"><span className="n">1</span>RIEN À SAISIR</div>

          {etat.s === "load" && <p className="fl">Chargement des résultats…</p>}
          {etat.s === "err" && <p className="fl">Lecture impossible — {etat.msg}</p>}

          {etat.s === "ok" && (
            <>
              <p className="fl">
                {etat.equipes.length === 0
                  ? "Aucune équipe rattachée au RSEQ pour la saison " + saisonCourante() +
                    " : la section n'apparaîtra pas sur ta page."
                  : `${etat.equipes.length} équipe${etat.equipes.length > 1 ? "s" : ""} au calendrier, ` +
                    `dont ${joue} ayant déjà joué.`}
              </p>
              <p className="fl">
                Fiche et classement viennent du RSEQ et sont recopiés tels quels — position
                comprise, bris d&apos;égalité compris. Mise à jour automatique chaque mercredi.
              </p>
              {etat.equipes.length > joue && (
                <p className="fl">
                  Les équipes qui n&apos;ont pas encore joué affichent leurs prochains matchs, sans
                  fiche ni rang : le RSEQ publie un classement dès avant le premier match, et il
                  ne veut rien dire tant que personne n&apos;a joué.
                </p>
              )}
            </>
          )}
        </div>

        <div className="pv">
          <div className="pvhead">APERÇU LIVE — RENDU RÉEL</div>
          <PreviewShell>
            {etat.s === "ok" && etat.equipes.length > 0
              ? <RealSaisonEnCours equipes={etat.equipes} />
              : <div style={{ padding: 24, opacity: .6, fontSize: 14 }}>Section absente de la page.</div>}
          </PreviewShell>
        </div>
      </div>
    </section>
  );
}
