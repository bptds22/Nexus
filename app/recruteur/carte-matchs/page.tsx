"use client";

/* ═══════════════════════════════════════════════════════════════
   /recruteur/carte-matchs — CARTE DES MATCHS, lot B (décisions BP 2026-10-07).

   MOTEUR DE RECHERCHE DE TOUS LES MATCHS (RPC matchs_recherche) : plus de
   mode « suivis » — le Calendrier reste l'endroit des matchs des athlètes
   suivis ; la carte sert à en trouver d'autres et à les y AJOUTER (« + »).

   MODÈLE VISUEL : « Trouve ton cégep » (components/cegep-search/CegepSearch.tsx),
   repris tel quel — coquille `.cs` et CS_CSS, barre de filtres (FiltreBtn +
   ListeCases), liste (`.lc`), carte (MapPane, marqueur « cible » à étoile),
   panneau de détails (`.preview`, celui de la fiche cégep). Rien n'est
   dessiné ici ; les ajouts (dates, bascule étroite) reprennent ses jetons.

   · Pro, comme le Calendrier (FeatureGate : rien n'est demandé pour un gratuit).
   · Web seulement : sous Capacitor, renvoi vers /recruteur/calendrier.
═══════════════════════════════════════════════════════════════ */

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { List, Map as MapIcon } from "lucide-react";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useCalendrierUnite } from "@/lib/queries/recruiter/useCalendrierUnite";
import { useOrigineCarte } from "@/lib/carteMatchs/useOrigineCarte";
import { useProfilsMatchs } from "@/lib/carteMatchs/useProfilsMatchs";
import { useBasculerCalendrier, useMatchsRecherche, useSourcesMatchs, useSportsCarte } from "@/lib/carteMatchs/useMatchsRecherche";
import SourceMatchLigne from "@/components/shared/SourceMatchLigne";
import type { SourceMatch } from "@/lib/calendar/sourceMatch";
import { CS_CSS, FiltreBtn, ListeCases } from "@/components/cegep-search/CegepSearch";
import {
  TYPES_MATCH, TYPES_PAR_DEFAUT, erreurPlage, optionsCatDiv, filtrerCatDiv, grouperParJour, libelleJour,
  terrainsCarte, terrainDe, etatCalendrier, heureQuebec, libelleDivision, lienItineraire, titreMatch, jourDecale,
  libelleProfils, libelleDontSuivis, dateSaisie, LIEU_NON_PRECISE,
  type MatchRecherche, type ProfilsMatch, type TypeMatch,
} from "@/lib/carteMatchs/carteMatchs";
import type { MapFocus, MapPoint } from "@/components/cegep-search/MapPane";

const MapPane = dynamic(() => import("@/components/cegep-search/MapPane"), { ssr: false });
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Même seuil que le @media du modèle (CS_CSS, max-width:1000px). */
const ETROIT = "(max-width: 1000px)";
const LIBELLES_TYPES = Object.fromEntries(TYPES_MATCH.map((t) => [t.v, t.label]));

export default function CarteMatchsPage() {
  const router = useRouter();
  React.useEffect(() => { if (IS_CAPACITOR) router.replace("/recruteur/calendrier"); }, [router]);
  if (IS_CAPACITOR) return null;
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      <CarteMatchsContenu />
    </FeatureGate>
  );
}

function CarteMatchsContenu() {
  const { tier, loading: tierLoading } = useSubscription();
  const actif = tier !== "free" && !tierLoading;
  const { data: origine } = useOrigineCarte(actif);
  const { data: sports } = useSportsCarte(actif);
  // Les cibles de l'unité : seulement pour « dont X suivi(s) » dans le panneau
  // (même cache que le Calendrier).
  const { data: unite } = useCalendrierUnite(actif);
  const suivisUnite = React.useMemo(() => new Set((unite?.targets ?? []).map((t) => t.athleteId)), [unite]);
  const basculer = useBasculerCalendrier();

  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [hauteur, setHauteur] = React.useState("100dvh");

  const aujourdhui = React.useMemo(() => jourDecale(new Date(), 0), []);
  const [debut, setDebut] = React.useState(aujourdhui);
  const [fin, setFin] = React.useState("");
  const [q, setQ] = React.useState("");
  const [texte, setTexte] = React.useState("");
  const [sport, setSport] = React.useState("");
  const [sportInitialise, setSportInitialise] = React.useState(false);
  const [types, setTypes] = React.useState<TypeMatch[]>(TYPES_PAR_DEFAUT);
  const [categorie, setCategorie] = React.useState("");
  const [division, setDivision] = React.useState("");
  const [selection, setSelection] = React.useState<string | null>(null);
  const [survol, setSurvol] = React.useState<string | null>(null);
  const [focus, setFocus] = React.useState<MapFocus | null>(null);
  const jeton = React.useRef(0);
  const [etroit, setEtroit] = React.useState(false);
  const [vue, setVue] = React.useState<"liste" | "carte">("liste");
  /** Grand écran : « Liste » masque la carte, la liste prend toute la largeur
   *  (BP 2026-10-09). En fenêtre étroite, c'est `vue` qui décide. */
  const [listePleine, setListePleine] = React.useState(false);
  const pleine = listePleine && !etroit;
  const [resizeToken, setResizeToken] = React.useState(0);

  // Hauteur disponible = viewport moins ce qui est au-dessus (même calcul que le modèle).
  React.useEffect(() => {
    const calc = () => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      setHauteur(`calc(100dvh - ${Math.max(0, Math.round(top))}px)`);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia(ETROIT);
    const maj = () => { setEtroit(mq.matches); setResizeToken((t) => t + 1); };
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);

  // Sport par défaut = celui de l'unité (décision BP), posé une fois ; modifiable.
  React.useEffect(() => {
    if (sportInitialise || !origine) return;
    setSport(origine.sportUnite ?? "");
    setSportInitialise(true);
  }, [origine, sportInitialise]);

  // Recherche texte : la base reçoit le texte 300 ms après la dernière frappe.
  React.useEffect(() => {
    const t = window.setTimeout(() => setTexte(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const erreur = erreurPlage(debut, fin || null);
  const { data, isLoading, isError, isFetching } = useMatchsRecherche(
    { debut, fin: fin || debut, sport, types, texte },
    actif && sportInitialise && !erreur,
  );
  const tous = React.useMemo(() => data ?? [], [data]);
  const options = React.useMemo(() => optionsCatDiv(tous), [tous]);
  const matchs = React.useMemo(() => filtrerCatDiv(tous, categorie, division), [tous, categorie, division]);
  const jours = React.useMemo(() => grouperParJour(matchs), [matchs]);
  const terrains = React.useMemo(() => terrainsCarte(matchs), [matchs]);
  const sansLieu = matchs.filter((m) => !terrainDe(m)).length;
  const { data: sources } = useSourcesMatchs(matchs.map((m) => m.id), actif);

  const points: MapPoint[] = React.useMemo(
    () => terrains.map((t) => ({ id: t.id, nom: t.nom, lat: t.lat, lng: t.lon, riche: false, cible: t.cible })),
    [terrains],
  );
  const choisi = matchs.find((m) => m.id === selection) ?? null;
  const terrainChoisi = choisi ? terrainDe(choisi)?.id ?? null : null;

  const viser = React.useCallback((type: MapFocus["type"], ids: string[]) => {
    jeton.current += 1;
    setFocus({ token: jeton.current, type, ids });
  }, []);

  // Nouveaux résultats : la carte cadre tous les terrains ; un match sorti des résultats ferme le panneau.
  React.useEffect(() => {
    if (terrains.length > 0) viser("bounds", terrains.map((t) => t.id));
  }, [terrains, viser]);
  React.useEffect(() => {
    if (selection && !matchs.some((m) => m.id === selection)) setSelection(null);
  }, [matchs, selection]);

  /** Ouvre le panneau d'un match et zoome sur son terrain (flyTo du modèle). */
  const ouvrir = React.useCallback((m: MatchRecherche) => {
    setSelection(m.id);
    const t = terrainDe(m);
    if (!t) return;
    // Fenêtre étroite, vue liste : la carte est masquée (0 × 0). On l'affiche,
    // Leaflet se re-mesure, PUIS on zoome.
    if (etroit && vue === "liste") {
      setVue("carte"); setResizeToken((x) => x + 1);
      window.setTimeout(() => viser("fly", [t.id]), 80);
    } else if (pleine) {
      // Liste pleine largeur : même geste — la carte revient, puis on zoome.
      setListePleine(false); setResizeToken((x) => x + 1);
      window.setTimeout(() => viser("fly", [t.id]), 80);
    } else viser("fly", [t.id]);
  }, [viser, etroit, vue, pleine]);

  // Clic sur un point : le premier match de ce terrain (même panneau).
  const ouvrirPoint = React.useCallback((terrainId: string) => {
    const t = terrains.find((x) => x.id === terrainId);
    const m = t ? matchs.find((x) => x.id === t.matchIds[0]) : null;
    if (m) { setSelection(m.id); viser("fly", [terrainId]); }
  }, [terrains, matchs, viser]);

  React.useEffect(() => {
    if (!selection) return;
    listRef.current?.querySelector(`[data-match="${selection}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selection]);

  const basculerVue = () => {
    const suivante = vue === "liste" ? "carte" : "liste";
    setVue(suivante);
    setResizeToken((t) => t + 1);
    if (suivante === "carte" && !selection && terrains.length > 0) {
      window.setTimeout(() => viser("bounds", terrains.map((t) => t.id)), 80);
    }
  };

  const choisirAffichage = (liste: boolean) => {
    if (liste === listePleine) return;
    setListePleine(liste);
    setResizeToken((t) => t + 1);
    if (!liste && !selection && terrains.length > 0) {
      window.setTimeout(() => viser("bounds", terrains.map((t) => t.id)), 80);
    }
  };

  const enCours = basculer.isPending ? basculer.variables?.gameId ?? null : null;
  const basculerMatch = (m: MatchRecherche) => {
    const etat = etatCalendrier(m);
    if (etat === "SUIVI" || enCours) return;
    basculer.mutate({ gameId: m.id, ajouter: etat === "LIBRE" });
  };

  const filtreUnique = (label: string, valeur: string, valeurs: string[], poser: (v: string) => void, opts?: { lib?: (v: string) => string; toujoursActif?: boolean }) => {
    // Une seule valeur (ou aucune) : présent mais grisé, jamais caché (décision BP).
    // Une valeur posée absente des résultats reste modifiable, pour pouvoir la retirer.
    const desactive = !opts?.toujoursActif && valeurs.length <= 1 && (!valeur || valeurs.includes(valeur));
    return (
      <FiltreBtn label={label} compteur={valeur ? 1 : 0} onClear={() => poser("")}
        desactive={desactive} titre={desactive ? "Une seule valeur dans ces résultats" : undefined}>
        {() => (
          <ListeCases
            items={valeur && !valeurs.includes(valeur) ? [...valeurs, valeur] : valeurs}
            labels={opts?.lib ? Object.fromEntries(valeurs.map((v) => [v, opts.lib!(v)])) : undefined}
            selection={valeur ? [valeur] : []}
            onToggle={(v) => poser(v === valeur ? "" : v)}
          />
        )}
      </FiltreBtn>
    );
  };

  return (
    <div className={"cs cm vue-" + vue + (pleine ? " pleine" : "")} ref={rootRef} style={{ ["--cs-h" as string]: hauteur }} data-testid="carte-matchs">
      <style dangerouslySetInnerHTML={{ __html: CS_CSS + CM_CSS }} />

      <div className="topbar">
        <div className="brand"><b>Carte des matchs</b></div>

        <div className="search">
          <svg className="sico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Équipe, terrain…" data-testid="recherche-texte" />
          {q && <button className="clr" onClick={() => setQ("")} aria-label="Effacer la recherche">✕</button>}
        </div>

        {/* Dates — le modèle n'en a pas : mêmes boutons .fbtn. Une date, et un « au » facultatif. */}
        <span className="fbtn on" data-testid="date-debut-zone">
          <label className="lbl">
            <input type="date" className="cm-date" value={debut} aria-label="Date"
              onChange={(e) => { const v = dateSaisie(e.target.value); if (v) setDebut(v); }} data-testid="date-debut" />
          </label>
        </span>
        <span className={"fbtn" + (fin ? " on" : "")}>
          <label className="lbl">
            <span>au</span>
            <input type="date" className="cm-date" value={fin} min={debut} aria-label="Au (facultatif)"
              onChange={(e) => { const v = e.target.value; if (!v) setFin(""); else { const d = dateSaisie(v); if (d) setFin(d); } }} data-testid="date-fin" />
            {fin && <button className="clr" onClick={(e) => { e.preventDefault(); setFin(""); }} aria-label="Retirer la date de fin">✕</button>}
          </label>
        </span>

        <span data-testid="filtres-carte" style={{ display: "contents" }}>
          {filtreUnique("Sport", sport, sports ?? [], setSport, { toujoursActif: true })}
          <FiltreBtn label="Type" compteur={types.length} onClear={() => setTypes([])}>
            {() => (
              <ListeCases items={TYPES_MATCH.map((t) => t.v)} labels={LIBELLES_TYPES} selection={types}
                onToggle={(v) => setTypes((x) => (x.includes(v as TypeMatch) ? x.filter((y) => y !== v) : [...x, v as TypeMatch]))} />
            )}
          </FiltreBtn>
          {filtreUnique("Catégorie", categorie, options.categories, setCategorie)}
          {filtreUnique("Division", division, options.divisions, setDivision, { lib: libelleDivision })}
        </span>

        {/* Carte | Liste — grand écran. En fenêtre étroite, la pastille du bas. */}
        {!etroit && (
          <span className="cm-seg" role="group" aria-label="Affichage" data-testid="bascule-affichage">
            <button type="button" className={"fbtn" + (!pleine ? " on" : "")} aria-pressed={!pleine}
              onClick={() => choisirAffichage(false)} data-testid="affichage-carte">
              <span className="lbl"><MapIcon size={15} aria-hidden />Carte</span>
            </button>
            <button type="button" className={"fbtn" + (pleine ? " on" : "")} aria-pressed={pleine}
              onClick={() => choisirAffichage(true)} data-testid="affichage-liste">
              <span className="lbl"><List size={15} aria-hidden />Liste</span>
            </button>
          </span>
        )}
      </div>

      <div className="main">
        <div className="list">
          <div className="count" data-testid="resume">
            {erreur ? <span>{erreur}</span> : (
              <>
                <b>{matchs.length} match{matchs.length > 1 ? "s" : ""}</b>
                {` · ${terrains.length} terrain${terrains.length > 1 ? "s" : ""}`}
                {sansLieu > 0 ? ` · ${sansLieu} au lieu non précisé` : ""}
                {isFetching && !isLoading ? " · …" : ""}
              </>
            )}
          </div>
          <div className="cards" ref={listRef} data-testid="liste-matchs">
            {!erreur && types.length === 0 && <div className="vide">Choisis au moins un type.</div>}
            {!erreur && isError && <div className="vide">Les matchs n&apos;ont pas pu être chargés.</div>}
            {!erreur && isLoading && types.length > 0 && <div className="vide">Chargement des matchs…</div>}
            {!erreur && !isLoading && !isError && types.length > 0 && matchs.length === 0 && (
              <div className="vide" data-testid="aucun-match">Aucun match pour ces critères. Change de date ou retire un filtre.</div>
            )}
            {!erreur && jours.map((j) => (
              <React.Fragment key={j.jour}>
                <div className="ptag cm-jour" data-testid="jour">{libelleJour(j.jour)}</div>
                {j.matchs.map((m) => {
                  const t = terrainDe(m);
                  return (
                    <div
                      key={m.id} data-testid="ligne-match" data-match={m.id} data-terrain={t?.id}
                      className={"lc" + (m.id === selection ? " sel" : "")}
                      onClick={() => ouvrir(m)}
                      onMouseEnter={() => setSurvol(t?.id ?? null)}
                      onMouseLeave={() => setSurvol(null)}
                    >
                      <div className="lcinfo">
                        <div className="lctitre"><b>{titreMatch(m)}</b></div>
                        <div className="m">{heureQuebec(m.heure)} · {m.terrain || LIEU_NON_PRECISE}</div>
                        <Source source={sources?.get(m.id)} />
                      </div>
                      <BoutonCalendrier m={m} enCours={enCours === m.id} onClick={() => basculerMatch(m)} />
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="maparea" data-testid="carte">
          <MapPane points={points} selectedId={terrainChoisi} hoveredId={survol} focus={focus} onSelect={ouvrirPoint}
            resizeToken={resizeToken} ariaLabel="Carte des matchs" />
          {choisi && (
            <Panneau m={choisi} source={sources?.get(choisi.id)} suivis={suivisUnite} actif={actif} enCours={enCours}
              autres={terrainChoisi ? matchs.filter((x) => x.id !== choisi.id && terrainDe(x)?.id === terrainChoisi) : []}
              onCalendrier={basculerMatch} onOuvrir={ouvrir} onClose={() => setSelection(null)} />
          )}
        </div>
      </div>

      {/* Bascule liste ↔ carte en fenêtre étroite — celle du modèle mobile (RechercheMobile). */}
      {etroit && (
        <button className="vtoggle" onClick={basculerVue} data-testid="bascule-vue">
          {vue === "liste" ? <MapIcon size={16} aria-hidden /> : <List size={16} aria-hidden />}
          <span>{vue === "liste" ? "Carte" : "Liste"}</span>
        </button>
      )}
    </div>
  );
}

/** La ligne « Source » du Calendrier (SourceMatchLigne), telle quelle. Seul le
 *  clic sur le LIEN reste au lien ; ailleurs sur la ligne, il ouvre le match. */
function Source({ source }: { source: SourceMatch | undefined }) {
  if (!source) return null;
  return (
    <div className="cm-src" data-testid="source-match"
      onClick={(e) => { if ((e.target as HTMLElement).closest("a")) e.stopPropagation(); }}>
      <SourceMatchLigne source={source} className="mt-[7px] pt-[7px]" />
    </div>
  );
}

/** « + » / « ✓ » — le bouton rond du modèle (.heart). */
function BoutonCalendrier({ m, enCours, onClick }: { m: MatchRecherche; enCours: boolean; onClick: () => void }) {
  const etat = etatCalendrier(m);
  const titre = etat === "SUIVI" ? "Au calendrier : un athlète suivi par ton unité y joue"
    : etat === "AJOUTE" ? "Au calendrier de ton unité — retirer" : "Ajouter au calendrier de ton unité";
  return (
    <button
      type="button" data-testid="bouton-calendrier" data-etat={etat}
      className={"heart cm-plus" + (etat === "LIBRE" ? "" : " on")}
      disabled={etat === "SUIVI" || enCours} title={titre} aria-label={titre}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >{etat === "LIBRE" ? "+" : "✓"}</button>
  );
}

/** Panneau de détails : celui de la fiche cégep du modèle (.preview). Les
 *  joueurs viennent de matchs_profils_nexus, appelée AU CLIC pour ce match. */
function Panneau({ m, source, suivis, actif, enCours, autres, onCalendrier, onOuvrir, onClose }: {
  m: MatchRecherche; source: SourceMatch | undefined; suivis: ReadonlySet<string>; actif: boolean; enCours: string | null;
  /** Les autres matchs du même terrain, dans les résultats affichés (BP 2026-10-08). */
  autres: MatchRecherche[];
  onCalendrier: (m: MatchRecherche) => void; onOuvrir: (m: MatchRecherche) => void; onClose: () => void;
}) {
  const { parMatch, isLoading } = useProfilsMatchs(m.nb_profils > 0 ? [m.id] : [], suivis, actif);
  const profils: ProfilsMatch | undefined = parMatch.get(m.id);
  const total = profils?.total ?? m.nb_profils;
  const etat = etatCalendrier(m);
  const t = terrainDe(m);
  const details: [string, string | null][] = [
    ["Terrain", m.terrain || LIEU_NON_PRECISE],
    ["Catégorie", m.categorie],
    ["Division", libelleDivision(m.division) || null],
    ["Ligue", m.ligue],
    ["Type", m.type ? LIBELLES_TYPES[m.type] : null],
  ];
  return (
    <div className="preview" data-testid="panneau">
      <button className="close" onClick={onClose} aria-label="Fermer">✕</button>
      <div className="ph">
        <div>
          <b>{titreMatch(m)}</b>
          <div className="m">{libelleJour(m.jour)} · {heureQuebec(m.heure)}</div>
        </div>
      </div>

      <div className="psec">
        {details.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="trow"><span className="tsport">{k}</span><span className="tmeta"><span>{v}</span></span></div>
        ))}
        <Source source={source} />
      </div>

      {total > 0 && (
        <div className="psec cm-pl" data-testid="liste-profils">
          <div className="ptag" data-testid="titre-profils">
            {libelleProfils({ total })}{libelleDontSuivis(profils) ? ` · ${libelleDontSuivis(profils)}` : ""}
          </div>
          {isLoading && <span className="note">Chargement des joueurs…</span>}
          {profils?.profils.map((a) => (
            <div key={a.athleteId} className="trow" data-testid="profil-nexus">
              <span className="tsport">
                <Link href={`/recruteur/athletes/${a.athleteId}`}>{`${a.prenom} ${a.nom}`.trim()}</Link>
                {a.suivi && <span className="b need">Suivi</span>}
              </span>
              <span className="tmeta">
                <span>{[a.position, a.promotion ? `Promo ${a.promotion}` : null].filter(Boolean).join(" · ") || "—"}</span>
                <span>{a.cote === "DOMICILE" ? m.domicile : m.visiteur}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="pcta">
        {t && <a className="btn page" href={lienItineraire(t.lat, t.lon)} target="_blank" rel="noopener noreferrer">Itinéraire</a>}
        <button className="btn target" data-testid="panneau-calendrier" data-etat={etat}
          disabled={etat === "SUIVI" || enCours === m.id} onClick={() => onCalendrier(m)}>
          {etat === "LIBRE" ? "+ Ajouter à mon calendrier" : etat === "AJOUTE" ? "✓ Dans mon calendrier — retirer" : "✓ Au calendrier"}
        </button>
        <span className="note">
          {etat === "SUIVI" ? "Un athlète suivi par ton unité joue dans ce match : il est déjà au Calendrier."
            : "Le calendrier est partagé avec ton unité."}
        </span>
      </div>

      {autres.length > 0 && (
        <div className="psec" data-testid="autres-matchs">
          <div className="ptag">Autres matchs à ce terrain</div>
          {autres.map((x) => (
            <div key={x.id} className="lc" data-testid="autre-match" data-match={x.id} onClick={() => onOuvrir(x)}>
              <div className="lcinfo">
                <div className="lctitre"><b>{titreMatch(x)}</b></div>
                <div className="m">{libelleJour(x.jour)} · {heureQuebec(x.heure)}</div>
              </div>
              <BoutonCalendrier m={x} enCours={enCours === x.id} onClick={() => onCalendrier(x)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Ce que le modèle n'a pas, avec SES jetons (.cs) : dates, en-tête de jour,
   « + » dans le bouton rond, bascule étroite (.vtoggle de RechercheMobile). */
const CM_CSS = `
.cs.cm{position:relative}
.cs .cm-date{background:none;border:0;outline:none;color:inherit;font:inherit;color-scheme:dark;cursor:pointer}
.cs .cm-jour{padding:10px 2px 2px}
.cs .heart.cm-plus{font-size:18px;font-weight:700;line-height:1}
.cs .heart.cm-plus:disabled{opacity:1;cursor:default}
.cs .cm-pl .tsport a{color:var(--txt);text-decoration:none}
.cs .cm-pl .tsport a:hover{color:var(--nexus)}
.cs .vtoggle{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);height:42px;padding:0 18px;border-radius:21px;
  background:rgba(26,29,36,.94);backdrop-filter:blur(14px);border:1px solid var(--line2);
  display:flex;align-items:center;gap:8px;cursor:pointer;z-index:950;box-shadow:0 8px 26px rgba(0,0,0,.6);
  font-size:14px;font-weight:600;color:#fff;white-space:nowrap}
.cs .vtoggle svg{stroke:#fff}
.cs .cm-seg{display:inline-flex;gap:6px;margin-left:auto}
.cs .cm-seg .fbtn{font-family:inherit}
.cs .cm-seg .fbtn .lbl{gap:6px}
@media(min-width:1001px){
  .cs.cm.pleine .main{grid-template-columns:1fr}
  .cs.cm.pleine .maparea{display:none}
  .cs.cm.pleine .list{border-right:0}
  .cs.cm.pleine .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));align-content:start;padding:0 18px 18px}
  .cs.cm.pleine .cm-jour{grid-column:1/-1}
}
@media(max-width:1000px){
  .cs.cm .main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr)}
  .cs.cm .list{max-height:none;border-bottom:0}
  .cs.cm.vue-liste .maparea{display:none}
  .cs.cm.vue-carte .list{display:none}
  .cs.cm .cards{padding-bottom:76px}
}
`;
