"use client";

/* ═══════════════════════════════════════════════════════════════
   CarteMatchsMobile — la CARTE DES MATCHS dans l'appli (§77), recruteur ET
   partenaire. Deux pièces partagées, rien de recopié :
     · l'état et la logique : lib/carteMatchs/useCarteMatchsEtat (ceux du web,
       components/carte-matchs/CarteMatchs.tsx) — filtres, plage, pastilles,
       recherche, résultats, « + », joueurs d'un match ;
     · la coquille mobile : components/carte-mobile/CarteMobile (celle de la
       carte cégep des joueurs, RechercheMobile) — liste XOR carte, sheet
       filtre/aperçu, MapPane, mêmes marqueurs, zones sûres.
   Ce fichier ne fait que le rendu des matchs dans cette coquille.
═══════════════════════════════════════════════════════════════ */

import * as React from "react";
import Link from "next/link";
import { Search, X, Check, ChevronDown, CalendarDays } from "lucide-react";
import CarteMobile, { CarteMobileMessage, useCarteMobile } from "@/components/carte-mobile/CarteMobile";
import BoutonAbonnementAgenda from "@/components/recruteur/agenda/BoutonAbonnementAgenda";
import BoutonDepister from "@/components/game-on/BoutonDepister";
import SourceMatchLigne, { ouvrirDansLApp } from "@/components/shared/SourceMatchLigne";
import type { MapFocus } from "@/components/cegep-search/MapPane";
import type { ModeCarte } from "@/lib/carteMatchs/useMatchsRecherche";
import { useCarteMatchsEtat, useDetailsMatch, TEXTE_REFUS_PARTENAIRE } from "@/lib/carteMatchs/useCarteMatchsEtat";
import {
  TYPES_MATCH, terrainDe, etatCalendrier, heureQuebec, libelleDivision, lienItineraire, titreMatch, groupeMatch,
  libelleJour, libelleProfils, libelleDontSuivis, dateSaisie, dateCourte, dateCarte, enTeteJour, heureCarte, LIEU_NON_PRECISE,
  titreBoutonCalendrier, libelleCtaCalendrier, noteCalendrier, noteProfilsNonNommes,
  type MatchRecherche, type TypeMatch,
} from "@/lib/carteMatchs/carteMatchs";
import { tap, triggerHaptic } from "@/lib/haptics";

type CleFiltre = "sport" | "type" | "categorie" | "division";

const FILTRES: { k: CleFiltre; label: string }[] = [
  { k: "sport", label: "Sport" },
  { k: "type", label: "Type" },
  { k: "categorie", label: "Catégorie" },
  { k: "division", label: "Division" },
];

export default function CarteMatchsMobile({ mode }: { mode: ModeCarte }) {
  const e = useCarteMatchsEtat(mode);
  const etat = useCarteMobile<CleFiltre>();
  const { mode: modeFeuille, cle, courant, closeSheet } = etat;

  // Cadrage : nouveaux résultats → tous les terrains ; un match ouvert → son terrain.
  const [focus, setFocus] = React.useState<MapFocus | null>(null);
  const jeton = React.useRef(0);
  const viser = React.useCallback((type: MapFocus["type"], ids: string[]) => {
    jeton.current += 1;
    setFocus({ token: jeton.current, type, ids });
  }, []);
  React.useEffect(() => {
    if (e.terrains.length > 0) viser("bounds", e.terrains.map((t) => t.id));
  }, [e.terrains, viser, etat.view]);

  const choisi = e.matchs.find((m) => m.id === courant) ?? null;
  const terrainChoisi = choisi ? terrainDe(choisi)?.id ?? null : null;

  const ouvrirMatch = (m: MatchRecherche) => {
    void triggerHaptic("Light");
    e.setSelection(m.id);
    etat.showPreview(m.id);
    const t = terrainDe(m);
    if (t && etat.view === "carte") viser("fly", [t.id]);
  };
  const ouvrirPoint = (terrainId: string) => {
    const m = e.premierDuTerrain(terrainId);
    if (m) ouvrirMatch(m);
  };

  /* ── les filtres : valeurs, sélection, grisé — la règle du web (filtreUnique) ── */
  const valeursDe = (k: CleFiltre): { v: string; label: string }[] => {
    if (k === "sport") return (Array.isArray(e.sports) ? e.sports : []).map((s) => ({ v: s, label: s }));
    if (k === "type") return TYPES_MATCH.map((t) => ({ v: t.v, label: t.label }));
    const brutes = k === "categorie" ? e.options.categories : e.options.divisions;
    const posee = k === "categorie" ? e.categorie : e.division;
    const liste = posee && !brutes.includes(posee) ? [...brutes, posee] : brutes;
    return liste.map((v) => ({ v, label: k === "division" ? libelleDivision(v) : v }));
  };
  const selDe = (k: CleFiltre): string[] =>
    k === "sport" ? (e.sport ? [e.sport] : []) : k === "type" ? e.types
      : k === "categorie" ? (e.categorie ? [e.categorie] : []) : (e.division ? [e.division] : []);
  const basculerValeur = (k: CleFiltre, v: string) => {
    if (k === "type") { e.basculerType(v as TypeMatch); return; }
    const poser = k === "sport" ? e.setSport : k === "categorie" ? e.setCategorie : e.setDivision;
    poser(selDe(k)[0] === v ? "" : v);
  };
  const effacer = (k: CleFiltre) => {
    if (k === "type") e.setTypes([]);
    else (k === "sport" ? e.setSport : k === "categorie" ? e.setCategorie : e.setDivision)("");
  };
  /** Une seule valeur (ou aucune) : présent mais grisé, jamais caché (décision BP). */
  const grise = (k: CleFiltre) => {
    if (k === "sport" || k === "type") return false;
    const brutes = k === "categorie" ? e.options.categories : e.options.divisions;
    const posee = k === "categorie" ? e.categorie : e.division;
    return brutes.length <= 1 && (!posee || brutes.includes(posee));
  };

  if (e.partenaire && e.refuse) {
    return (
      <CarteMobileMessage css={CSS}>
        {TEXTE_REFUS_PARTENAIRE}{" "}
        <a href="mailto:info@nexussports.ca" style={{ color: "#fff", textDecoration: "underline" }}>info@nexussports.ca</a>.
      </CarteMobileMessage>
    );
  }

  /* ── recherche + suggestions (Équipe / Terrain) ── */
  const barreRecherche = (
    <div className="searchrow cm-recherche">
      <Search size={17} aria-hidden />
      <input
        type="search" value={e.q} placeholder="Équipe, terrain…" data-testid="recherche-texte"
        onChange={(ev) => { e.setQ(ev.target.value); e.setSuggOuvert(true); e.setSuggActif(0); }}
        onFocus={() => e.setSuggOuvert(true)}
        onBlur={() => e.setSuggOuvert(false)}
      />
      {e.q && (
        <button className="clr" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { void triggerHaptic("Light"); e.setQ(""); e.setTexte(""); }} aria-label="Effacer la recherche">
          <X size={14} aria-hidden />
        </button>
      )}
      {e.menuVisible && (
        <div className="cm-sugg" role="listbox" data-testid="suggestions" onMouseDown={(ev) => ev.preventDefault()}>
          {(["EQUIPE", "TERRAIN"] as const).map((g) => {
            const items = e.proposees.filter((x) => x.genre === g);
            if (!items.length) return null;
            return (
              <div key={g} className="cm-sugg-groupe">
                <div className="cm-sugg-tete">{g === "EQUIPE" ? "Équipes" : "Terrains"}</div>
                {items.map((x) => (
                  <button key={x.genre + x.cle} type="button" role="option" aria-selected={false} className="cm-sugg-item"
                    data-testid="suggestion" onClick={() => { void tap(); e.choisirSuggestion(x); }}>
                    <b>{x.libelle}</b>
                    <span>{[x.detail, x.nb_matchs ? x.nb_matchs + " match" + (x.nb_matchs > 1 ? "s" : "") + " à venir" : null].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            );
          })}
          {!e.proposees.length && e.suggPret && (e.filtresPoses ? (
            <div className="cm-sugg-vide">
              Aucune équipe ni terrain avec ces filtres.{" "}
              <button type="button" className="cm-sugg-lien" onClick={e.retirerFiltres}>Retirer les filtres</button>
            </div>
          ) : (
            <div className="cm-sugg-vide">Aucune équipe ni aucun terrain avec un match à venir.</div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── pilules : dates (sélecteur natif, aucun clavier), filtres, Mes matchs ── */
  const chips = (
    <div className="chips" data-testid="filtres-carte">
      <label className="chip has cm-dchip" data-testid="date-debut-zone">
        <CalendarDays size={14} aria-hidden />
        <span>{dateCourte(e.debut)}</span>
        <input type="date" className="cm-date" value={e.debut} aria-label="Date" data-testid="date-debut"
          onChange={(ev) => { const v = dateSaisie(ev.target.value); if (v) e.poserPlage(v, e.fin); }} />
      </label>
      {e.saison ? (
        <span className="chip has" data-testid="date-fin-zone">au fin de saison</span>
      ) : (
        <label className={"chip cm-dchip" + (e.fin ? " has" : "")} data-testid="date-fin-zone">
          <span>au {e.fin ? dateCourte(e.fin) : "facultatif"}</span>
          <input type="date" className="cm-date" value={e.fin} min={e.debut} aria-label="Au (facultatif)" data-testid="date-fin"
            onChange={(ev) => { const v = ev.target.value; if (!v) e.poserPlage(e.debut, ""); else { const d = dateSaisie(v); if (d) e.poserPlage(e.debut, d); } }} />
          {e.fin && (
            <button className="cm-dclr" onClick={(ev) => { ev.preventDefault(); e.poserPlage(e.debut, ""); }} aria-label="Retirer la date de fin">
              <X size={12} aria-hidden />
            </button>
          )}
        </label>
      )}
      {FILTRES.map(({ k, label }) => {
        const n = selDe(k).length;
        const live = modeFeuille === "filter" && cle === k;
        const off = grise(k);
        return (
          <button key={k} className={"chip" + (n ? " has" : "") + (live ? " live" : "") + (off ? " off" : "")}
            disabled={off} title={off ? "Une seule valeur dans ces résultats" : undefined} data-testid={`filtre-${k}`}
            onClick={() => { void triggerHaptic("Light"); if (live) closeSheet(); else etat.showFilter(k); }}>
            {label}
            {n > 0 && <span className="n">{n}</span>}
            <ChevronDown size={13} aria-hidden />
          </button>
        );
      })}
      {e.partenaire && (
        <button className={"chip" + (e.mesMatchs ? " has" : "")} aria-pressed={e.mesMatchs} data-testid="mes-matchs"
          onClick={() => { void tap(); e.setMesMatchs((v) => !v); e.setSelection(null); }}>
          {e.mesMatchs && <Check size={13} aria-hidden />}Mes matchs
        </button>
      )}
    </div>
  );

  const pastilles = e.pastilles.length > 0 && (
    <div className="cm-pastilles" data-testid="pastilles">
      {e.pastilles.map((x) => (
        <button key={x.genre + x.cle} type="button" className="chip has" data-testid="pastille" data-genre={x.genre}
          onClick={() => { void tap(); e.retirerPastille(x); }} aria-label={"Retirer " + x.libelle}>
          <span className="cm-pastille-genre">{x.genre === "EQUIPE" ? "Équipe" : "Terrain"}</span>{x.libelle}<X size={12} aria-hidden />
        </button>
      ))}
    </div>
  );

  const resume = e.erreur ? <span>Aucune recherche lancée.</span> : (
    <>
      <b>{e.matchs.length} match{e.matchs.length > 1 ? "s" : ""}</b>
      {` · ${e.terrains.length} terrain${e.terrains.length > 1 ? "s" : ""}`}
      {e.sansLieu > 0 ? ` · ${e.sansLieu} au lieu non précisé` : ""}
      {e.mesMatchs ? " · mes matchs" : ""}{e.saison ? " · toute la saison à venir" : ""}
      {e.isFetching && !e.isLoading ? " · …" : ""}
    </>
  );

  /* ── une ligne de match (liste, sheet de filtre) — COMPACTE (BP 2026-10-17) :
        heure et date, les deux équipes, catégorie · division · lieu, le « + ».
        Rien d'autre : la source, la description RSEQ et les liens de calendrier
        sont dans la fiche du match (Apercu), au toucher de la ligne.
        Deux zones de toucher SÉPARÉES, deux vrais boutons : « ouvrir la fiche »
        (toute la ligne sauf la colonne du « + ») et le « + » (44 px). Cause du
        « + » parasite (émulateur 2026-10-17) : la ligne n'était qu'un <article>
        dont le clic passe par React (écouteur à la racine) ; pour le WebView
        Android elle n'était pas cliquable, et son ajustement de toucher
        AIMANTAIT un toucher près du « + » sur le « + » — le match s'ajoutait au
        lieu d'ouvrir la fiche. Un vrai <button> pour la fiche reçoit son toucher. ── */
  const ligne = (m: MatchRecherche) => {
    const t = terrainDe(m);
    const heure = heureCarte(m.heure);
    return (
      <article key={m.id} className={"row cm-row" + (m.id === courant ? " sel" : "")} data-testid="ligne-match" data-match={m.id} data-terrain={t?.id}>
        <button type="button" className="cm-ouvrir" data-testid="ouvrir-match" aria-label={`Ouvrir la fiche : ${titreMatch(m)}`}
          onClick={() => ouvrirMatch(m)}>
          <span className="cm-quand">
            <span className={"cm-heure" + (heure === "Heure à confirmer" ? " tbc" : "")} data-testid="heure-match">{heure}</span>
            <span className="cm-date-carte">{dateCarte(m.jour)}</span>
          </span>
          <span className="rowmid">
            <span className="cm-titre">{titreMatch(m)}</span>
            <span className="rowmeta">{groupeMatch(m) ? `${groupeMatch(m)} · ` : ""}{m.terrain || LIEU_NON_PRECISE}</span>
          </span>
        </button>
        <div className="rowright cm-zone-plus">
          <BoutonCalendrier mode={mode} m={m} enCours={e.enCours === m.id} onClick={() => e.basculerMatch(m)} />
        </div>
      </article>
    );
  };

  const etatsListe = (
    <>
      {!e.erreur && e.types.length === 0 && <div className="empty"><b>Aucun type</b>Choisis au moins un type.</div>}
      {!e.erreur && e.isError && <div className="empty"><b>Erreur</b>Les matchs n&apos;ont pas pu être chargés.</div>}
      {!e.erreur && e.isLoading && e.types.length > 0 && <div className="empty"><b>Chargement…</b>Un instant.</div>}
      {!e.erreur && !e.isLoading && !e.isError && e.types.length > 0 && e.matchs.length === 0 && (
        <div className="empty" data-testid="aucun-match">
          <b>Aucun match</b>
          {e.mesMatchs
            ? "Aucun de tes matchs ne correspond. Ajoute des matchs avec « + », ou retire un filtre."
            : "Aucun match pour ces critères. Change de date ou retire un filtre."}
        </div>
      )}
    </>
  );

  const liste = (
    <div data-testid="liste-matchs">
      {etatsListe}
      {!e.erreur && e.jours.map((j) => {
        const tete = enTeteJour(j.jour, e.aujourdhui, j.matchs.length);
        return (
          <section key={j.jour} className="cm-bloc" data-testid="bloc-jour" data-jour={j.jour}>
            <h3 className="cm-jour" data-testid="jour"><span className="cm-jour-boite"><span className="cm-jour-nom">{tete.jour}</span><span className="cm-jour-n">{tete.compte}</span></span></h3>
            {j.matchs.map((m) => ligne(m))}
          </section>
        );
      })}
    </div>
  );

  const enTeteListe = (
    <>
      <div className="chrome solid">
        <div className="titlerow">
          <div className="kicker">{e.partenaire ? "Espace partenaire" : "Recrutement"}</div>
          <h1>Carte des matchs</h1>
        </div>
        {barreRecherche}
        {pastilles}
        {chips}
        {e.partenaire && <div className="cm-abo"><BoutonAbonnementAgenda mode="partenaire" /></div>}
      </div>
      {!e.saison && (e.erreur || e.avisPlage) && <div className="cm-avis" role="status" data-testid="avis-plage">{e.erreur ?? e.avisPlage}</div>}
      <div className="countline" data-testid="resume">{resume}</div>
    </>
  );

  const enTeteCarte = (
    <div className="chrome float">
      {barreRecherche}
      {pastilles}
      {chips}
      <div className="mapcount" aria-live="polite">
        {e.erreur ? "Aucune recherche lancée" : `${e.matchs.length} match${e.matchs.length > 1 ? "s" : ""} · ${e.terrains.length} terrain${e.terrains.length > 1 ? "s" : ""}`}
      </div>
    </div>
  );

  /* ── sheet : filtre ── */
  const feuilleFiltre = modeFeuille === "filter" && cle && (
    <>
      <div className="shHead" {...etat.prise}>
        <span className="kick">{FILTRES.find((f) => f.k === cle)?.label}</span>
        {selDe(cle).length > 0 && (
          <button className="txtbtn red" onClick={() => { void triggerHaptic("Light"); effacer(cle); }}>Effacer ({selDe(cle).length})</button>
        )}
        <button className="txtbtn soft" onClick={closeSheet}>Terminé</button>
      </div>
      <div className="shBody">
        <div className="optwrap">
          {valeursDe(cle).map((o) => (
            <div key={o.v} className={"opt" + (selDe(cle).includes(o.v) ? " on" : "")} data-testid="option-filtre"
              onClick={() => { void triggerHaptic("Light"); basculerValeur(cle, o.v); }}>
              {o.label}
              <span className="box"><Check size={12} aria-hidden /></span>
            </div>
          ))}
          {valeursDe(cle).length === 0 && <div className="empty"><b>Aucune option</b>Rien à filtrer ici.</div>}
        </div>
        {/* sélection LIVE : les résultats se recomposent sous les options */}
        <div className="livesep">
          <span className="l" />
          <span>{e.matchs.length} match{e.matchs.length > 1 ? "s" : ""}</span>
          <span className="l" />
        </div>
        <div className="rows">{etatsListe}{e.matchs.map((m) => ligne(m))}</div>
      </div>
    </>
  );

  /* ── sheet : aperçu d'un match ── */
  const feuilleApercu = modeFeuille === "preview" && choisi && (
    <Apercu mode={mode} m={choisi} prise={etat.prise} onClose={closeSheet} suivis={e.suivisUnite} actif={e.actif}
      enCours={e.enCours} sources={e.sources} onCalendrier={e.basculerMatch} onOuvrir={ouvrirMatch}
      autres={terrainChoisi ? e.matchs.filter((x) => x.id !== choisi.id && terrainDe(x)?.id === terrainChoisi) : []} />
  );

  return (
    <CarteMobile
      etat={etat}
      css={CSS}
      className="cm-mobile"
      enTeteListe={enTeteListe}
      enTeteCarte={enTeteCarte}
      liste={liste}
      points={e.points}
      selectedId={terrainChoisi}
      focus={focus}
      onSelectPoint={ouvrirPoint}
      ariaLabel="Carte des matchs"
      feuille={<>{feuilleFiltre}{feuilleApercu}</>}
    />
  );
}

/** La ligne « Source » du Calendrier (SourceMatchLigne) : le clic sur le LIEN
 *  reste au lien (navigateur intégré), ailleurs il ouvre le match. */
function Source({ m, sources }: { m: MatchRecherche; sources: ReturnType<typeof useCarteMatchsEtat>["sources"] }) {
  const source = sources?.get(m.id);
  if (!source) return null;
  return (
    <div className="cm-src" onClick={(ev) => { if ((ev.target as HTMLElement).closest("a")) ev.stopPropagation(); }}>
      <SourceMatchLigne source={source} className="mt-[6px] pt-[6px]" />
    </div>
  );
}

/** « + » / « ✓ » — le bouton rond de la coquille (.heart), libellés du web. */
function BoutonCalendrier({ mode, m, enCours, onClick }: { mode: ModeCarte; m: MatchRecherche; enCours: boolean; onClick: () => void }) {
  const etat = etatCalendrier(m);
  const titre = titreBoutonCalendrier(mode, etat);
  return (
    <button type="button" data-testid="bouton-calendrier" data-etat={etat}
      className={"heart cm-plus" + (etat === "LIBRE" ? "" : " on")}
      disabled={etat === "SUIVI" || enCours} title={titre} aria-label={titre}
      onClick={(ev) => { ev.stopPropagation(); void tap(); onClick(); }}>
      {etat === "LIBRE" ? "+" : "✓"}
    </button>
  );
}

/** L'aperçu d'un match : le panneau du web (mêmes données par useDetailsMatch,
 *  mêmes libellés), dans la sheet de la coquille. */
function Apercu({ mode, m, prise, onClose, suivis, actif, enCours, sources, autres, onCalendrier, onOuvrir }: {
  mode: ModeCarte; m: MatchRecherche; prise: ReturnType<typeof useCarteMobile>["prise"]; onClose: () => void;
  suivis: ReadonlySet<string>; actif: boolean; enCours: string | null;
  sources: ReturnType<typeof useCarteMatchsEtat>["sources"];
  autres: MatchRecherche[];
  onCalendrier: (m: MatchRecherche) => void; onOuvrir: (m: MatchRecherche) => void;
}) {
  const { partenaire, profils, pp, total, isLoading, etat, terrain: t, details } = useDetailsMatch(mode, m, suivis, actif);
  const lienFiche = (id: string) => (partenaire ? `/partenaire/athletes/${id}` : `/recruteur/athletes/${id}`);
  return (
    <>
      <div className="shHead" {...prise}>
        <button className="iconbtn" onClick={onClose} aria-label="Fermer"><X size={15} aria-hidden /></button>
        <span className="kick">Match</span>
        <BoutonCalendrier mode={mode} m={m} enCours={enCours === m.id} onClick={() => onCalendrier(m)} />
      </div>

      <div className="shBody" data-testid="panneau">
        <div className="cm-pvhead">
          <h2>{titreMatch(m)}</h2>
          {groupeMatch(m) && <p>{groupeMatch(m)}</p>}
          <p>{libelleJour(m.jour)} · {heureQuebec(m.heure)}</p>
        </div>
        <div className="cm-pvbody">
          {details.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="line"><span className="ln cm-k">{k}</span><span className="cm-v">{v}</span></div>
          ))}
          <Source m={m} sources={sources} />

          {total > 0 && (
            <div className="cm-pl" data-testid="liste-profils">
              <div className="kicker2" data-testid="titre-profils">
                {libelleProfils({ total })}{libelleDontSuivis(profils) ? ` · ${libelleDontSuivis(profils)}` : ""}
              </div>
              {isLoading && <div className="footnote">Chargement des joueurs…</div>}
              {partenaire && !isLoading && (
                <>
                  {pp.profils.map((a) => (
                    <Link key={a.athlete_id} className="line cm-joueur" href={lienFiche(a.athlete_id)} data-testid="profil-nexus">
                      <span className="ln"><b>{`${a.prenom ?? ""} ${a.nom ?? ""}`.trim()}</b>
                        <span className="cm-v">{[a.position, a.promotion ? `Promo ${a.promotion}` : null].filter(Boolean).join(" · ") || "—"}</span></span>
                      <span className="cm-v">{a.cote === "DOMICILE" ? m.domicile : m.visiteur}</span>
                    </Link>
                  ))}
                  {noteProfilsNonNommes(total, pp.profils.length) && (
                    <div className="footnote cm-gauche" data-testid="profils-non-nommes">{noteProfilsNonNommes(total, pp.profils.length)}</div>
                  )}
                </>
              )}
              {profils?.profils.map((a) => (
                <Link key={a.athleteId} className="line cm-joueur" href={lienFiche(a.athleteId)} data-testid="profil-nexus">
                  <span className="ln"><b>{`${a.prenom} ${a.nom}`.trim()}{a.suivi && <span className="cm-suivi">Suivi</span>}</b>
                    <span className="cm-v">{[a.position, a.promotion ? `Promo ${a.promotion}` : null].filter(Boolean).join(" · ") || "—"}</span></span>
                  <span className="cm-v">{a.cote === "DOMICILE" ? m.domicile : m.visiteur}</span>
                </Link>
              ))}
            </div>
          )}

          {autres.length > 0 && (
            <div data-testid="autres-matchs">
              <div className="kicker2">Autres matchs à ce terrain</div>
              {autres.map((x) => (
                <article key={x.id} className="row cm-row" data-testid="autre-match" data-match={x.id}>
                  {/* Deux vrais boutons, comme la ligne de la liste (ajustement de toucher du WebView). */}
                  <button type="button" className="cm-ouvrir" data-testid="ouvrir-match" aria-label={`Ouvrir la fiche : ${titreMatch(x)}`}
                    onClick={() => onOuvrir(x)}>
                    <span className="rowmid">
                      <span className="cm-titre">{titreMatch(x)}</span>
                      <span className="rowmeta">{groupeMatch(x) ? `${groupeMatch(x)} · ` : ""}{libelleJour(x.jour)} · {heureQuebec(x.heure)}</span>
                    </span>
                  </button>
                  <div className="rowright cm-zone-plus">
                    <BoutonCalendrier mode={mode} m={x} enCours={enCours === x.id} onClick={() => onCalendrier(x)} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shFoot">
        {/* Dépistage (BP 2026-10-18) : ouvre la séance avec ce match et ses deux équipes. Partenaire aussi (2026-10-19). */}
        <BoutonDepister gameId={m.id} equipeA={m.domicile} equipeB={m.visiteur} lieu={m.terrain} className="btn primary" mode={partenaire ? "partenaire" : "recruteur"} />
        <button className={"btn primary" + (etat === "LIBRE" ? "" : " on")} data-testid="panneau-calendrier" data-etat={etat}
          disabled={etat === "SUIVI" || enCours === m.id} onClick={() => { void tap(); onCalendrier(m); }}>
          {libelleCtaCalendrier(mode, etat)}
        </button>
        {t && (
          <a className="btn ghost" href={lienItineraire(t.lat, t.lon)} data-testid="itineraire"
            onClick={(ev) => { void ouvrirDansLApp(ev, lienItineraire(t.lat, t.lon)); }}>
            Itinéraire
          </a>
        )}
        <span className="footnote">{noteCalendrier(mode, etat)}</span>
      </div>
    </>
  );
}

/* ── CSS propre aux matchs, scopé `.rm.cm-mobile` — ajouté après celui de la coquille ── */
const CSS = `
.rm.cm-mobile .cm-recherche{position:relative}
.rm.cm-mobile .cm-sugg{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:70;background:#20242D;border:1px solid var(--line2);
  border-radius:13px;padding:8px;box-shadow:0 18px 46px #000B;max-height:min(55vh,420px);overflow-y:auto}
.rm.cm-mobile .cm-sugg-groupe+.cm-sugg-groupe{margin-top:6px;padding-top:6px;border-top:1px solid var(--line)}
.rm.cm-mobile .cm-sugg-tete{padding:4px 8px 6px;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.rm.cm-mobile .cm-sugg-item{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:none;border:0;border-radius:9px;padding:9px 10px;cursor:pointer;font:inherit;color:#fff}
.rm.cm-mobile .cm-sugg-item b{font-size:14.5px;font-weight:700}
.rm.cm-mobile .cm-sugg-item span{font-size:12.5px;color:var(--mut)}
.rm.cm-mobile .cm-sugg-vide{padding:10px;font-size:13px;color:var(--mut)}
.rm.cm-mobile .cm-sugg-lien{background:none;border:0;padding:0;font:inherit;font-weight:700;color:#fff;text-decoration:underline;cursor:pointer}
.rm.cm-mobile .cm-pastilles{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px}
.rm.cm-mobile .cm-pastille-genre{font-size:11px;font-weight:600;color:#E9909A}
.rm.cm-mobile .cm-dchip{position:relative}
.rm.cm-mobile .cm-date{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;color-scheme:dark}
.rm.cm-mobile .cm-dclr{position:relative;z-index:1;border:0;background:transparent;color:var(--mut);display:grid;place-items:center;padding:0;width:18px;height:18px}
.rm.cm-mobile .cm-abo{padding:0 0 11px}
.rm.cm-mobile .cm-avis{margin:0;padding:9px 16px;border-top:1px solid #F59E0B66;background:#F59E0B1F;color:#FCD34D;font-size:13px;font-weight:600;line-height:1.35}
/* En-tête de jour : l'encadré rouge du web (#DC3441, blanc 4,55:1). */
.rm.cm-mobile .cm-bloc{padding-bottom:6px}
.rm.cm-mobile .cm-jour{position:sticky;top:-10px;z-index:6;margin:0 -16px 9px;padding:10px 16px 0;background:var(--bg)}
.rm.cm-mobile .cm-jour-boite{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  background:#DC3441;border-radius:10px;padding:8px 12px;font-size:14.5px;font-weight:700}
.rm.cm-mobile .cm-jour-nom{color:#fff}
.rm.cm-mobile .cm-jour-n{font-size:12.5px;font-weight:500;color:#fff;white-space:nowrap}
.rm.cm-mobile .cm-row{align-items:stretch;gap:0;padding:0}
.rm.cm-mobile .cm-ouvrir{flex:1;min-width:0;display:flex;align-items:flex-start;gap:12px;padding:12px 8px 12px 12px;
  background:none;border:0;border-radius:16px 0 0 16px;color:inherit;font:inherit;text-align:left;cursor:pointer}
.rm.cm-mobile .cm-ouvrir .cm-quand,.rm.cm-mobile .cm-ouvrir .rowmid,.rm.cm-mobile .cm-ouvrir .cm-heure,
.rm.cm-mobile .cm-ouvrir .cm-date-carte,.rm.cm-mobile .cm-ouvrir .cm-titre,.rm.cm-mobile .cm-ouvrir .rowmeta{display:block}
.rm.cm-mobile .cm-zone-plus{justify-content:flex-start;padding:12px 12px 12px 4px}
.rm.cm-mobile .cm-quand{flex:0 0 58px;min-width:0}
.rm.cm-mobile .cm-heure{padding-top:1px;font-size:15px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
.rm.cm-mobile .cm-heure.tbc{white-space:normal;font-size:11.5px;font-weight:600;line-height:1.3;color:var(--mut)}
.rm.cm-mobile .cm-date-carte{margin-top:3px;font-size:11.5px;font-weight:600;color:var(--mut);white-space:nowrap}
.rm.cm-mobile .cm-titre{font-size:15.5px;font-weight:700;line-height:1.25;margin-bottom:3px}
.rm.cm-mobile .cm-row .rowmeta{white-space:normal}
.rm.cm-mobile .cm-plus{width:44px;height:44px;border-radius:22px;font-size:19px;font-weight:700;line-height:1}
.rm.cm-mobile .cm-plus.on{color:var(--green);border-color:rgba(34,197,94,.5)}
.rm.cm-mobile .cm-plus:disabled{opacity:1;cursor:default}
.rm.cm-mobile .cm-src{font-size:12.5px;color:var(--mut)}
.rm.cm-mobile .cm-pvhead{padding:14px 16px 10px}
.rm.cm-mobile .cm-pvhead h2{font-family:var(--font-anton),sans-serif;font-size:19px;line-height:1.15;text-transform:uppercase;margin-bottom:6px}
.rm.cm-mobile .cm-pvhead p{font-size:13.5px;color:var(--mut);margin-top:2px}
.rm.cm-mobile .cm-pvbody{padding:0 16px 18px;display:flex;flex-direction:column;gap:14px}
.rm.cm-mobile .line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;font-size:14px;
  border-bottom:1px solid rgba(255,255,255,.05);color:#fff;text-decoration:none}
.rm.cm-mobile .line .ln{min-width:0;display:flex;flex-direction:column;gap:2px}
.rm.cm-mobile .cm-k{color:var(--mut);font-weight:600}
.rm.cm-mobile .cm-v{color:var(--soft);font-size:13px;text-align:right}
.rm.cm-mobile .ln .cm-v{text-align:left}
.rm.cm-mobile .cm-suivi{margin-left:8px;font-size:11px;font-weight:700;padding:1px 6px;border-radius:5px;background:rgba(230,57,70,.16);color:#F3A3AA}
.rm.cm-mobile .cm-gauche{text-align:left}
`;
