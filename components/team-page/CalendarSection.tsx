"use client";

// components/team-page/CalendarSection.tsx
// Section « Calendrier » (sous le hero, avant Présentation). Rangée scroll-snap
// de cards (‹ › comme le carousel campus école). Tuiles de match : DOMICILE =
// couleur foncée équipe (texte clair) · EXTÉRIEUR = tuile claire (texte foncé).
// Événement spécial (camp) = couleur primaire. Passé (date révolue) = atténué,
// SANS score. Le fade de bord vit sur le conteneur (mask), jamais sur les tuiles.
// 0 événement → section absente. MOCK, câblage Bloc 2.

import * as React from "react";
import { parseEventDate, isPast, todayISO, type TeamData, type TeamEvent } from "./content";

export default function CalendarSection({ team }: { team: TeamData }) {
  /* Repli sur `events` quand `seasons` est absent : mocks, fixtures et aperçu
     de l'éditeur continuent de fonctionner sans rien savoir des saisons. */
  const saisons = React.useMemo(() => {
    if (team.seasons?.length) return team.seasons;
    const courante = `${team.season}-${team.season + 1}`;
    return [{ saison: courante, teamId: team.id, division: null, events: team.events ?? [] }];
  }, [team.seasons, team.events, team.season, team.id]);

  const [choisie, setChoisie] = React.useState(saisons[0]?.saison ?? "");
  // La saison par défaut redevient la plus récente si l'équipe change.
  React.useEffect(() => { setChoisie(saisons[0]?.saison ?? ""); }, [team.id, saisons]);

  const active = saisons.find((s) => s.saison === choisie) ?? saisons[0];
  const events = active?.events ?? [];
  const caraRef = React.useRef<HTMLDivElement>(null);
  const today = todayISO();
  const firstUpcoming = events.findIndex((e) => !isPast(e, today));

  // défaut : positionner la rangée sur le 1ᵉʳ événement à venir (0 → déjà en tête).
  React.useEffect(() => {
    const el = caraRef.current;
    if (!el || firstUpcoming <= 0) return;
    const card = el.children[firstUpcoming] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: Math.max(0, card.offsetLeft - 8), behavior: "auto" });
  }, [firstUpcoming, team.id, choisie]);

  /* La section ne disparaît QUE si aucune saison n'a le moindre événement.
     Avant, `events.length === 0` la supprimait tout court — une équipe dont la
     saison courante n'est pas encore publiée perdait aussi son historique, et
     la page ne disait rien du tout. Désormais, tant qu'UNE saison a des
     matchs, la section reste et le sélecteur permet d'y aller. */
  if (saisons.every((s) => s.events.length === 0)) return null;

  // Division affichée sur les pills seulement si elle distingue les saisons.
  const divisionsDifferent = new Set(saisons.map((s) => s.division ?? "")).size > 1;
  // Une pill seule est du bruit : pas de sélecteur sous deux saisons.
  const avecSelecteur = saisons.length > 1;

  const scroll = (dir: number) =>
    caraRef.current?.scrollBy({ left: dir * 268, behavior: "smooth" });

  return (
    <section className="cal rv">
      {/* .sec-in = le contenant 1180px de la page école (parité de rythme) */}
      <div className="sec-in">
        <div className="cal-head">
          <div>
            <div className="kick">SAISON {active?.saison}</div>
            <div className="h2">Le <em>calendrier</em></div>
            <div className="pbar" />
          </div>
          {events.length > 0 && (
            <div className="cara-nav">
              <button type="button" onClick={() => scroll(-1)} aria-label="Précédent">‹</button>
              <button type="button" onClick={() => scroll(1)} aria-label="Suivant">›</button>
            </div>
          )}
        </div>

        {avecSelecteur && (
          <div className="cal-seasons" role="tablist" aria-label="Saison">
            {saisons.map((s) => (
              <button
                key={s.saison}
                type="button"
                role="tab"
                aria-selected={s.saison === choisie}
                className={"cal-pill" + (s.saison === choisie ? " on" : "")}
                onClick={() => setChoisie(s.saison)}
              >
                {s.saison}
                {divisionsDifferent && s.division ? <span className="div">{s.division}</span> : null}
              </button>
            ))}
          </div>
        )}

        {events.length === 0 ? (
          /* Saison sélectionnée sans match, alors qu'une autre en a. Le cas
             normal en début d'année : le RSEQ n'a pas publié l'alignement. On
             le DIT, au lieu de laisser un trou que l'utilisateur lit comme
             une panne. */
          <p className="cal-vide">
            Calendrier à venir — les matchs {active?.saison} ne sont pas encore publiés.
            {avecSelecteur ? " Choisis une autre saison pour voir l’historique." : ""}
          </p>
        ) : (
          <div className="cal-row" ref={caraRef}>
            {events.map((e, i) => (
              <EventCard key={`${choisie}-${i}`} e={e} today={today} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EventCard({ e, today }: { e: TeamEvent; today: string }) {
  const d = parseEventDate(e.date);

  if (e.type === "camp") {
    // Événement spécial : couleur primaire, texte crème. L'intitulé du collège
    // prend la place du libellé générique — « Camp de sélection » n'est plus
    // qu'un repli quand rien n'est saisi. Le lieu garde sa ligne et disparaît
    // s'il est vide (plus de ligne fantôme).
    const label = e.titre?.trim() || "Camp de sélection";
    return (
      <article className="ev camp">
        <div className="ev-tag" title={label}>{label}</div>
        <div className="ev-date">
          <span className="d">{d.day}</span>
          <span className="m">{d.mon}</span>
        </div>
        {e.lieu ? <div className="ev-lieu">{e.lieu}</div> : null}
      </article>
    );
  }

  // Match : tuile foncée (domicile) / claire (extérieur). Passé = atténué. Le
  // score n'apparaît QUE si la DB le fournit (match joué) — sinon la tuile est
  // rendue exactement comme avant (fixtures, matchs à venir).
  const past = isPast(e, today);
  const hasScore = e.scorePour != null && e.scoreContre != null;
  const win = hasScore && e.scorePour! > e.scoreContre!;
  const loss = hasScore && e.scorePour! < e.scoreContre!;
  return (
    <article className={`ev match ${e.domicile ? "home" : "away"}${past ? " past" : ""}`}>
      <div className="ev-date">
        <span className="d">{d.day}</span>
        <span className="m">{d.mon}</span>
      </div>
      <div className="ev-vs">
        {e.domicile ? "vs " : "à "}
        {e.adversaire}
      </div>
      {hasScore ? (
        <div className={`ev-score${win ? " w" : loss ? " l" : ""}`}>
          {e.scorePour}–{e.scoreContre}
        </div>
      ) : (
        <div className="ev-meta">{e.heure} · {e.lieu}</div>
      )}
    </article>
  );
}
