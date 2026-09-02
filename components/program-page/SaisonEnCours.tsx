// components/program-page/SaisonEnCours.tsx
//
// Section #saison — « Saison en cours ». Une ligne par équipe du cégep :
// sport / genre / division, fiche V-D-N, rang au classement. Dépliable sur les
// derniers résultats et les prochains matchs.
//
// Alimentée par la veille RSEQ (rseq_standings + games), rafraîchie chaque
// mercredi. AUCUNE saisie éditoriale : ce bloc ne passe pas par l'éditeur.
//
// CE QU'IL NE CONTIENT PAS : rien de nominatif. Pas un nom d'athlète, pas une
// statistique individuelle. C'est structurel — ni `rseq_standings` ni `games`
// ne portent la moindre colonne d'athlète, et la ligne rouge de la collecte
// interdit d'en importer.
//
// ── TROIS RÈGLES D'AFFICHAGE, toutes décidées sur des chiffres réels ────────
//
//   1. Zéro match joué → NI fiche NI rang, seulement « À venir ». RSEQ publie
//      un rang même pour une équipe qui n'a rien joué (Sainte-Foy volleyball
//      F D2 : « 11e sur 12 » avec 0 match) — c'est un artefact de tirage. Au
//      2026-09-02, 77 % des équipes sont dans ce cas ; les afficher classées
//      serait faux sur les trois quarts du bloc.
//
//   2. Pas de rang publié → la fiche s'affiche SEULE, et le titre de la
//      section ne change pas. Une équipe sans classement reste une équipe.
//
//   3. Aucune équipe → la section disparaît. « Pas de coquille vide » vise le
//      cégep sans équipe (12 sur 70), pas l'équipe sans résultat : celle-là
//      garde sa place avec ses matchs à venir.
//
// ── HABILLAGE (passe du 2026-09-02) ────────────────────────────────────────
//
// LA FICHE NE DOIT PAS SE LIRE COMME UN SCORE. « 3-1 » sur une page de sport
// se lit spontanément « 3 à 1 ». D'où « 3 V · 1 D » : les lettres portent le
// sens, les chiffres portent le poids typographique. Les nuls n'apparaissent
// que s'il y en a.
//
// AUCUN PICTOGRAMME DE SPORT, et ce n'est pas un manque de temps. Vérifié :
// `public.sports` n'a pas de colonne d'icône, il n'existe aucun asset de sport
// dans `public/`, `lib/config/sportBadges.ts` écrit noir sur blanc qu'« en
// inventer une serait pire qu'aucune », et `SportsGrid` — la section juste
// au-dessus — s'annonce comme une « liste éditoriale de rangées, AUCUNE
// icône ». La respiration vient du rythme vertical et du survol.
//
// LA DÉFAITE N'EST PAS UNE ALERTE. Le rouge #EF4444 est réservé aux alertes
// critiques (CLAUDE.md) ; une défaite sportive utilise un rouge désaturé.

import * as React from "react";
import type { EquipeSaison, MatchResume } from "@/lib/queries/schoolPage/saisonEnCours";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * « 2026-08-29 » → « ven. 29 août ». Le jour de semaine est ce qui manquait :
 * un calendrier sportif se lit par jour de match, pas par quantième.
 * Construit en UTC pour qu'un fuseau négatif ne recule pas la date d'un jour.
 */
function jourCourt(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return "—";
  const d = new Date(Date.UTC(a, m - 1, j));
  return `${JOURS[d.getUTCDay()]} ${j} ${MOIS[m - 1]}`;
}

/** Lecture vocale de la fiche — « 3 victoires, 1 défaite ». */
function ficheAria(f: NonNullable<EquipeSaison["fiche"]>): string {
  const bouts = [
    `${f.v} victoire${f.v > 1 ? "s" : ""}`,
    `${f.d} défaite${f.d > 1 ? "s" : ""}`,
  ];
  if (f.n > 0) bouts.push(`${f.n} nul${f.n > 1 ? "s" : ""}`);
  return bouts.join(", ");
}

function Fiche({ f }: { f: NonNullable<EquipeSaison["fiche"]> }) {
  return (
    <span className="sn-fiche" aria-label={ficheAria(f)}>
      <b>{f.v}</b><i>V</i>
      <span className="sn-sep">·</span>
      <b>{f.d}</b><i>D</i>
      {f.n > 0 && (<><span className="sn-sep">·</span><b>{f.n}</b><i>N</i></>)}
    </span>
  );
}

function LigneMatch({ m }: { m: MatchResume }) {
  return (
    <li className="sn-m">
      <span className="sn-m-date">{jourCourt(m.date)}</span>
      <span className="sn-m-lieu" aria-label={m.domicile ? "à domicile" : "à l'extérieur"}>
        {m.domicile ? "dom." : "ext."}
      </span>
      <span className="sn-m-adv">{m.adversaire}</span>
      {m.issue ? (
        <span className={`sn-m-score sn-${m.issue}`}>
          <i>{m.issue}</i> {m.pour}<span className="sn-tiret">–</span>{m.contre}
        </span>
      ) : (
        <span className="sn-m-score sn-A">à venir</span>
      )}
    </li>
  );
}

export default function SaisonEnCours({ equipes }: { equipes?: EquipeSaison[] }) {
  if (!equipes || equipes.length === 0) return null;

  return (
    <section id="saison">
      <div className="sec-in">
        <div className="kick">SAISON EN COURS</div>
        <h2 className="sec-h">Où en sont les équipes</h2>
        <div className="pbar" />

        <div className="sn-list">
          {equipes.map((e) => {
            const meta = [e.genre, e.division].filter(Boolean).join(" · ");
            return (
              <details className="sn-row rv" key={e.teamId}>
                <summary className="sn-head">
                  <span className="sn-ident">
                    <span className="sn-sport">{e.sport}</span>
                    {meta && <span className="sn-meta">{meta}</span>}
                  </span>

                  <span className="sn-chiffres">
                    {e.fiche
                      ? <Fiche f={e.fiche} />
                      : <span className="sn-attente">Saison à venir</span>}
                    {e.rang && (
                      <span
                        className="sn-rang"
                        aria-label={`${e.rang.position}e position sur ${e.rang.sur}`}
                      >
                        {e.rang.position}<sup>e</sup> / {e.rang.sur}
                      </span>
                    )}
                  </span>

                  <span className="sn-chev" aria-hidden="true">›</span>
                </summary>

                <div className="sn-detail">
                  {e.derniers.length > 0 && (
                    <div className="sn-bloc">
                      <div className="sn-bloc-t">Derniers résultats</div>
                      <ul className="sn-ms">
                        {e.derniers.map((m, i) => <LigneMatch m={m} key={`d${i}`} />)}
                      </ul>
                    </div>
                  )}

                  {e.aVenir.length > 0 && (
                    <div className="sn-bloc">
                      <div className="sn-bloc-t">À venir</div>
                      <ul className="sn-ms">
                        {e.aVenir.map((m, i) => <LigneMatch m={m} key={`v${i}`} />)}
                      </ul>
                    </div>
                  )}

                  {e.derniers.length === 0 && e.aVenir.length === 0 && (
                    <div className="sn-bloc-t">Calendrier non publié.</div>
                  )}
                </div>
              </details>
            );
          })}
        </div>

        {/* Attribution discrète, non cliquable — demandée telle quelle. */}
        <div className="sn-src">Données : RSEQ</div>
      </div>
    </section>
  );
}
