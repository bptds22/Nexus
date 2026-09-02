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
// TROIS RÈGLES D'AFFICHAGE, toutes décidées sur des chiffres réels :
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

import * as React from "react";
import type { EquipeSaison, MatchResume } from "@/lib/queries/schoolPage/saisonEnCours";

/** « 2026-09-04 » → « 4 sept. ». Rend '—' si la date manque. */
function jourCourt(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return "—";
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${j} ${MOIS[m - 1]}`;
}

function libelleEquipe(e: EquipeSaison): string {
  const bouts = [e.sport];
  if (e.genre) bouts.push(e.genre);
  if (e.division) bouts.push(e.division);
  return bouts.join(" · ");
}

function ficheTexte(f: NonNullable<EquipeSaison["fiche"]>): string {
  // Les nuls ne s'affichent que s'il y en a : « 2-0 », mais « 1-1-1 ».
  return f.n > 0 ? `${f.v}-${f.d}-${f.n}` : `${f.v}-${f.d}`;
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
          {m.issue} {m.pour}–{m.contre}
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
          {equipes.map((e) => (
            <details className="sn-row rv" key={e.teamId}>
              <summary className="sn-head">
                <span className="sn-nom">{libelleEquipe(e)}</span>

                <span className="sn-chiffres">
                  {e.fiche ? (
                    <span className="sn-fiche">{ficheTexte(e.fiche)}</span>
                  ) : (
                    <span className="sn-attente">Saison à venir</span>
                  )}
                  {e.rang && (
                    <span className="sn-rang">{e.rang.position}<sup>e</sup> sur {e.rang.sur}</span>
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
          ))}
        </div>

        {/* Attribution discrète, non cliquable — demandée telle quelle. */}
        <div className="sn-src">Données : RSEQ</div>
      </div>
    </section>
  );
}
