"use client";

// components/team-editor/CalendarCampsSection.tsx — S3 « Calendrier & camps »
// Matchs = AUTO (public.games, scores des matchs joués inclus) : lecture seule.
// Camps & essais = MANUEL (max MAX_TEAM_EVENTS) : canal de recrutement du collège,
// le RSEQ ne les connaît pas. Aperçu = le VRAI CalendarSection.

import * as React from "react";
import CalendarSection from "@/components/team-page/CalendarSection";
import TeamPreviewShell, { useDebounced } from "./PreviewShell";
import { previewTeam } from "./teamBridge";
import { useTeamEditor, type CalendrierEtat } from "./teamEditorContext";

/** Même distinction que le bloc record du hero : « pas encore lié » et « pas
 *  encore commencé » sont deux situations différentes, et une seule des deux
 *  demande une action. */
function messageCalendrier(c: CalendrierEtat): string {
  if (c.total === 0) {
    return "Calendrier RSEQ pas encore lié à ton équipe — les matchs apparaîtront ici automatiquement une fois le lien fait.";
  }
  const saison = c.saison ? ` ${c.saison}` : "";
  return c.joues === 0
    ? `Saison${saison} pas encore commencée — les matchs apparaîtront ici dès le début du calendrier.`
    : `Aucun match de la saison${saison} à afficher pour l'instant.`;
}
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";
import { useToast } from "@/components/page-editor/toast";
import { MAX_TEAM_EVENTS, type EditorCamp } from "@/lib/queries/teamPage/teamPageData";

const newUid = () => Math.random().toString(36).slice(2);

export default function CalendarCampsSection() {
  const toast = useToast();
  const ctx = useTeamEditor();
  const { identity, initial, initialCamps, initialPennants, initialNeeds, positions, games, commits, calendrier, report, assetUrl, hiddenSections } = ctx;
  const hidden = hiddenSections.includes("camps");

  const [camps, setCamps] = React.useState<(EditorCamp & { uid: string })[]>(
    () => initialCamps.map((c) => ({ ...c, uid: c.id ?? newUid() })),
  );

  React.useEffect(() => {
    report("camps", camps.map(({ id, titre, event_date, lieu }) => ({ id, titre, event_date, lieu })));
  }, [camps, report]);

  const add = () => {
    if (camps.length >= MAX_TEAM_EVENTS) { toast(`Maximum ${MAX_TEAM_EVENTS} événements`); return; }
    setCamps((c) => [...c, { uid: newUid(), titre: "", event_date: "", lieu: "" }]);
  };
  const patch = (i: number, p: Partial<EditorCamp>) =>
    setCamps((cs) => cs.map((c, k) => (k === i ? { ...c, ...p } : c)));

  const debKey = useDebounced(JSON.stringify(camps));
  const preview = React.useMemo(() => {
    const list = JSON.parse(debKey) as EditorCamp[];
    const team = previewTeam(identity, {
      content: initial, pennants: initialPennants, camps: hidden ? [] : list,
      needs: initialNeeds, positions, games, commits, hiddenSections,
      heroUrl: assetUrl(initial.hero_image_path), coachPhotoUrl: assetUrl(initial.headcoach_photo_path),
    });
    return <CalendarSection team={team} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debKey, hidden, identity, games]);

  // Matchs AUTO listés tels qu'ils sortent de la DB (scores compris).
  const rows = games.slice(0, 8).map((g) => {
    const home = g.home_team_id === identity.teamId;
    const played = g.is_played === true && g.home_score != null && g.visitor_score != null;
    const pour = home ? g.home_score : g.visitor_score;
    const contre = home ? g.visitor_score : g.home_score;
    return {
      date: g.game_date ?? "",
      vs: `${home ? "vs " : "@ "}${(home ? g.visitor_name_raw : g.home_name_raw) ?? "à confirmer"}`,
      score: played ? `${pour}-${contre}` : "—",
      win: played && (pour ?? 0) > (contre ?? 0),
      loss: played && (pour ?? 0) < (contre ?? 0),
    };
  });

  return (
    <section className="sec">
      <div className="sech">
        <span className="num">3</span><h2>Calendrier &amp; camps</h2>
        <span className="tag auto">AUTO</span><span className="tag man">CAMPS = MANUEL</span>
        <VisibilityToggle sectionKey="camps" label="Afficher les camps" />
      </div>
      <div className="cols">
        <div>
          <div className="panel aff" style={{ marginBottom: 14 }}>
            <div className="pt">MATCHS — RSEQ AUTOMATIQUE, RIEN À FAIRE</div>
            {rows.length === 0 ? (
              <div className="empty">{messageCalendrier(calendrier)}</div>
            ) : rows.map((r, i) => (
              <div key={i} className="calrow">
                <span className="d">{r.date}</span>
                <span className="vs">{r.vs}</span>
                <span className={"sc" + (r.win ? " w" : r.loss ? " l" : "")}>{r.score}</span>
              </div>
            ))}
            <div className="note">
              Dates, adversaires, lieux et <b>scores des matchs joués</b> viennent du calendrier RSEQ en DB (mise à jour saisonnière).
            </div>
          </div>

          {hidden ? <SectionHidden sectionKey="camps" /> : (
            <div className="panel">
              <div className="pt"><span className="n">1</span>CAMPS DE SÉLECTION &amp; ESSAIS (max {MAX_TEAM_EVENTS})</div>
              {camps.map((c, i) => (
                <div key={c.uid} className="nrow" style={{ gridTemplateColumns: "1.3fr .8fr 1fr auto" }}>
                  <input className="ti" maxLength={40} placeholder="Titre" value={c.titre} onChange={(e) => patch(i, { titre: e.target.value })} />
                  <input className="ti" type="date" value={c.event_date} onChange={(e) => patch(i, { event_date: e.target.value })} />
                  <input className="ti" maxLength={40} placeholder="Lieu" value={c.lieu} onChange={(e) => patch(i, { lieu: e.target.value })} />
                  <button className="xbtn" title="Retirer" onClick={() => setCamps((cs) => cs.filter((_, k) => k !== i))}>✕</button>
                </div>
              ))}
              <button className="addbtn" onClick={add}>+ Ajouter un camp / essai</button>
              <div className="note">Le RSEQ n&apos;a pas tes camps — c&apos;est TON canal de recrutement : titre, date, lieu.</div>
            </div>
          )}
        </div>

        <div className="pv">
          <div className="pvhead">APERÇU LIVE — LE VRAI CALENDRIER</div>
          <TeamPreviewShell>{preview}</TeamPreviewShell>
          <div className="note">Les camps apparaissent en <b>tuile mise en évidence</b> parmi les matchs.</div>
        </div>
      </div>
    </section>
  );
}
