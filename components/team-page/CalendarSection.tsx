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
  const events = team.events ?? [];
  const caraRef = React.useRef<HTMLDivElement>(null);
  const today = todayISO();
  const firstUpcoming = events.findIndex((e) => !isPast(e, today));

  // défaut : positionner la rangée sur le 1ᵉʳ événement à venir (0 → déjà en tête).
  React.useEffect(() => {
    const el = caraRef.current;
    if (!el || firstUpcoming <= 0) return;
    const card = el.children[firstUpcoming] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: Math.max(0, card.offsetLeft - 8), behavior: "auto" });
  }, [firstUpcoming, team.id]);

  if (events.length === 0) return null; // pas d'événement → pas de section

  const season = `${team.season}-${String((team.season + 1) % 100).padStart(2, "0")}`;
  const scroll = (dir: number) =>
    caraRef.current?.scrollBy({ left: dir * 268, behavior: "smooth" });

  return (
    <section className="cal rv">
      {/* .sec-in = le contenant 1180px de la page école (parité de rythme) */}
      <div className="sec-in">
        <div className="cal-head">
          <div>
            <div className="kick">SAISON {season}</div>
            <div className="h2">Le <em>calendrier</em></div>
            <div className="pbar" />
          </div>
          <div className="cara-nav">
            <button type="button" onClick={() => scroll(-1)} aria-label="Précédent">‹</button>
            <button type="button" onClick={() => scroll(1)} aria-label="Suivant">›</button>
          </div>
        </div>

        <div className="cal-row" ref={caraRef}>
          {events.map((e, i) => (
            <EventCard key={i} e={e} today={today} />
          ))}
        </div>
      </div>
    </section>
  );
}

function EventCard({ e, today }: { e: TeamEvent; today: string }) {
  const d = parseEventDate(e.date);

  if (e.type === "camp") {
    // Événement spécial : couleur primaire, texte crème. Date en gros + lieu (rien d'autre).
    return (
      <article className="ev camp">
        <div className="ev-tag">Camp de sélection</div>
        <div className="ev-date">
          <span className="d">{d.day}</span>
          <span className="m">{d.mon}</span>
        </div>
        <div className="ev-lieu">{e.lieu}</div>
      </article>
    );
  }

  // Match : tuile foncée (domicile) / claire (extérieur). Passé = atténué, sans score.
  const past = isPast(e, today);
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
      <div className="ev-meta">{e.heure} · {e.lieu}</div>
    </article>
  );
}
