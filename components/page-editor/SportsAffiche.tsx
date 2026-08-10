"use client";

// components/page-editor/SportsAffiche.tsx — S2 « L'affiche » (AUTO)
//
// Dérivé des équipes RÉELLES de l'école connectée — verrouillé, rien à éditer.
//
// Affichait auparavant la constante SPORTS_AFFICHE (4 rangées de Grasset) sous
// un bandeau « DÉRIVÉ DE TES ÉQUIPES » qui était faux pour tous les collèges.
// On branche maintenant la MÊME fonction que la page publique —
// `sportsFromTeams` — sur la même requête `teams`. Une seule source, donc
// l'éditeur et la page publiée ne peuvent plus diverger.

import * as React from "react";
import { useEditor } from "./editorContext";
import { sportsFromTeams, type TeamRowForGrid } from "@/lib/queries/schoolPage/dbToProgramPage";
import type { Sport } from "@/components/program-page/content";

type Etat =
  | { s: "load" }
  | { s: "err"; msg: string }
  | { s: "ok"; sports: Sport[] };

export default function SportsAffiche() {
  const { client, schoolId } = useEditor();
  const [etat, setEtat] = React.useState<Etat>({ s: "load" });

  React.useEffect(() => {
    let annule = false;
    (async () => {
      const { data, error } = await client
        .from("teams")
        .select("id, division, gender, sports:sport_id(nom)")
        .eq("school_id", schoolId);
      if (annule) return;
      if (error) { setEtat({ s: "err", msg: error.message }); return; }
      const teams: TeamRowForGrid[] = ((data ?? []) as unknown as {
        id: string; division: string | null; gender: string | null; sports: { nom: string } | null;
      }[]).map((t) => ({
        id: t.id, sport: t.sports?.nom ?? "", division: t.division, gender: t.gender,
      }));
      setEtat({ s: "ok", sports: sportsFromTeams(schoolId, teams) });
    })();
    return () => { annule = true; };
  }, [client, schoolId]);

  /** Pastilles d'une rangée, dérivées des équipes du sport : divisions
   *  distinctes, genres distincts, décompte. Aucune valeur inventée — un sport
   *  sans division n'affiche pas de pastille de division. */
  const pills = (sp: Sport): string[] => {
    const divs = [...new Set(sp.equipes.map((e) => e.division).filter(Boolean) as string[])].sort();
    const genres = [...new Set(sp.equipes.map((e) => e.genre))];
    const n = sp.equipes.length;
    return [
      ...(divs.length ? [divs.join(" · ")] : []),
      genres.join(" · "),
      `${n} ÉQUIPE${n > 1 ? "S" : ""}`,
    ];
  };

  return (
    <section className="sec">
      <div className="sech"><span className="num">2</span><h2>Sports — « L&apos;affiche »</h2><span className="tag auto">AUTO</span></div>
      <div className="cols">
        <div className="panel">
          <div className="pt">DÉRIVÉ DE TES ÉQUIPES — RIEN À FAIRE ICI</div>

          {etat.s === "load" && <div className="note">Lecture de tes équipes…</div>}
          {etat.s === "err" && <div className="note">Impossible de lire tes équipes — {etat.msg}</div>}

          {etat.s === "ok" && etat.sports.length === 0 && (
            <div className="fact" style={{ display: "block" }}>
              <b>Aucune équipe rattachée à ton collège pour l&apos;instant.</b>
              <span style={{ display: "block", marginTop: 8, lineHeight: 1.55 }}>
                Tant qu&apos;aucune équipe n&apos;existe, la section « L&apos;affiche »
                n&apos;apparaît pas sur ta page publique.
              </span>
            </div>
          )}

          {etat.s === "ok" && etat.sports.length > 0 && (
            <div className="aff">
              {etat.sports.map((sp) => (
                <div className="affrow" key={sp.nom}>
                  <span className="s">{sp.nom.toUpperCase()}</span>
                  {pills(sp).map((p, i) => <span className="pill" key={i}>{p}</span>)}
                </div>
              ))}
            </div>
          )}

          {/* Aucun lien « Gérer mes équipes » : /coach/equipes est fermé aux
              rôles non-COACH par la garde de app/coach/layout.tsx, et il n'y a
              pas d'équivalent côté recruteur. Mieux vaut aucun lien qu'un lien
              qui redirige silencieusement. */}
          <div className="note">
            Les rangées, divisions et genres viennent de <b>tes équipes</b> (seed RSEQ +
            Mes équipes). Ajouter ou retirer un sport = gérer l&apos;équipe, la page suit
            toute seule.
          </div>
        </div>
        <div className="pv"><div className="panel">
          <div className="pvhead">UNE ÉQUIPE MANQUE OU EST EN TROP ?</div>
          <div className="fact" style={{ display: "block" }}>
            <b>La page suit tes équipes, automatiquement.</b>
            <span style={{ display: "block", marginTop: 8, lineHeight: 1.55 }}>Un <b style={{ color: "#EDEFF3" }}>coach ou directeur</b> de ton collège crée (ou corrige) l&apos;équipe dans <b style={{ color: "#EDEFF3" }}>Mes équipes</b> → elle apparaît ici toute seule. La plupart des équipes RSEQ sont déjà chargées par Nexus — vérifie avant de créer, le système te proposera d&apos;adopter l&apos;existante.</span>
          </div>
        </div></div>
      </div>
    </section>
  );
}
