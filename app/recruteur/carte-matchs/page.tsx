"use client";

/* ═══════════════════════════════════════════════════════════════
   /recruteur/carte-matchs — CARTE DES MATCHS, lot A (décisions BP 2026-10-07).

   MODÈLE VISUEL : « Trouve ton cégep » (components/cegep-search/CegepSearch.tsx),
   repris à l'identique — sa coquille `.cs` et son CSS (CS_CSS), sa barre de
   filtres (FiltreBtn + ListeCases), sa liste (`.lc`), sa carte (MapPane) et
   ses états (chargement, vide). Rien n'est dessiné ici : les seuls ajouts de
   style habillent ce que le modèle n'a pas (bulle, bascule étroite, date),
   avec SES jetons, et sont signalés au rapport.

   Tout le calcul vit dans lib/carteMatchs (pur, testé, repris par le lot
   mobile) ; cette page lit useCalendrierUnite (les cibles de l'UNITÉ) et rend.

   · Pro, comme le Calendrier (FeatureGate : rien n'est demandé pour un gratuit).
   · Web seulement : sous Capacitor, renvoi vers /recruteur/calendrier.
═══════════════════════════════════════════════════════════════ */

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { List, Map as MapIcon } from "lucide-react";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useCalendrierUnite } from "@/lib/queries/recruiter/useCalendrierUnite";
import { downloadIcs } from "@/lib/calendar/generateCalendarLinks";
import Link from "next/link";
import { useOrigineCarte } from "@/lib/carteMatchs/useOrigineCarte";
import { useProfilsMatchs } from "@/lib/carteMatchs/useProfilsMatchs";
import { CS_CSS, FiltreBtn, ListeCases } from "@/components/cegep-search/CegepSearch";
import {
  matchsDuJour, terrainsDuJour, optionsFiltres, lienItineraire, evenementMatch, titreMatch, jourDecale,
  nomSuivi, terrainDuMatch, heureQuebec, libelleDivision, matchsBulle, libelleProfils, libelleDontSuivis,
  LIEU_NON_PRECISE, FILTRES_VIDES, type FiltresCarte, type MatchCarte, type ProfilsMatch,
} from "@/lib/carteMatchs/carteMatchs";
import type { MapBulle, MapFocus, MapPoint } from "@/components/cegep-search/MapPane";

const MapPane = dynamic(() => import("@/components/cegep-search/MapPane"), { ssr: false });
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Même seuil que le @media du modèle (CS_CSS, max-width:1000px). */
const ETROIT = "(max-width: 1000px)";

const initialesDe = (nom: string) =>
  nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase();

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
  const { data, isLoading, isError } = useCalendrierUnite(actif);
  const { data: origine } = useOrigineCarte(actif);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [hauteur, setHauteur] = React.useState("100dvh");

  const aujourdhui = React.useMemo(() => jourDecale(new Date(), 0), []);
  const demain = React.useMemo(() => jourDecale(new Date(), 1), []);
  const [date, setDate] = React.useState(aujourdhui);
  const [filtres, setFiltres] = React.useState<FiltresCarte>(FILTRES_VIDES);
  const [sportInitialise, setSportInitialise] = React.useState(false);
  /** Terrain choisi (ses lignes sont mises en évidence) et match cliqué (en tête de bulle). */
  const [selection, setSelection] = React.useState<string | null>(null);
  const [premierMatch, setPremierMatch] = React.useState<string | null>(null);
  const [bulle, setBulle] = React.useState<MapBulle | null>(null);
  const [survol, setSurvol] = React.useState<string | null>(null);
  const [focus, setFocus] = React.useState<MapFocus | null>(null);
  const jeton = React.useRef(0);
  const [etroit, setEtroit] = React.useState(false);
  const [vue, setVue] = React.useState<"liste" | "carte">("liste");
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
  }, [data]);

  React.useEffect(() => {
    const mq = window.matchMedia(ETROIT);
    const maj = () => { setEtroit(mq.matches); setResizeToken((t) => t + 1); };
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);

  // Sport par défaut = celui de l'unité (décision BP), posé une fois.
  React.useEffect(() => {
    if (sportInitialise || !origine) return;
    setFiltres((f) => ({ ...f, sport: origine.sportUnite ?? "" }));
    setSportInitialise(true);
  }, [origine, sportInitialise]);

  const calendrier = React.useMemo(() => ({ games: data?.games ?? [], targets: data?.targets ?? [] }), [data]);
  const matchs = React.useMemo(() => matchsDuJour(calendrier, date, filtres), [calendrier, date, filtres]);
  // Profils Nexus (lot A+) : UN appel par journée, sur ses matchs AVANT les
  // filtres de catégorie / division / ligue (un filtre ne relance rien).
  const idsDuJour = React.useMemo(
    () => matchsDuJour(calendrier, date, FILTRES_VIDES).map((m) => m.game.id), [calendrier, date]);
  const suivisUnite = React.useMemo(() => new Set(calendrier.targets.map((t) => t.athleteId)), [calendrier]);
  const { parMatch: profils } = useProfilsMatchs(idsDuJour, suivisUnite, actif);
  const terrains = React.useMemo(() => terrainsDuJour(matchs), [matchs]);
  const options = React.useMemo(() => optionsFiltres(calendrier, date, filtres.sport), [calendrier, date, filtres.sport]);
  const terrainDe = (m: MatchCarte) => terrainDuMatch(m)?.id ?? null;

  const points: MapPoint[] = React.useMemo(
    () => terrains.map((t) => ({ id: t.id, nom: t.nom, lat: t.lat, lng: t.lon, riche: true, cible: false })),
    [terrains],
  );

  const viser = React.useCallback((type: MapFocus["type"], ids: string[]) => {
    jeton.current += 1;
    setFocus({ token: jeton.current, type, ids });
  }, []);

  // Nouvelle journée ou nouveaux filtres : bulle fermée, la carte cadre tous les terrains.
  React.useEffect(() => {
    setSelection(null); setPremierMatch(null); setBulle(null);
    if (terrains.length > 0) viser("bounds", terrains.map((t) => t.id));
  }, [terrains, viser]);

  /** Ouvre la bulle d'un terrain (flyTo du modèle), `matchId` en tête. */
  const ouvrir = React.useCallback((terrainId: string, matchId: string | null) => {
    setSelection(terrainId);
    setPremierMatch(matchId);
    const zoomer = () => {
      jeton.current += 1;
      setBulle({ id: terrainId, token: jeton.current });
      viser("fly", [terrainId]);
    };
    // Fenêtre étroite, vue liste : la carte est masquée (0 × 0). On l'affiche,
    // Leaflet se re-mesure, PUIS on zoome — sinon le flyTo vise un cadre vide.
    if (etroit && vue === "liste") {
      setVue("carte"); setResizeToken((t) => t + 1);
      window.setTimeout(zoomer, 80);
    } else zoomer();
  }, [viser, etroit, vue]);
  const ouvrirPoint = React.useCallback((terrainId: string) => ouvrir(terrainId, null), [ouvrir]);
  const fermerBulle = React.useCallback(() => setBulle(null), []);

  // Clic sur un point : sa première ligne revient dans la liste (comme le modèle).
  React.useEffect(() => {
    if (!selection) return;
    listRef.current?.querySelector(`[data-terrain="${CSS.escape(selection)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selection]);

  const basculer = () => {
    const suivante = vue === "liste" ? "carte" : "liste";
    setVue(suivante);
    setResizeToken((t) => t + 1);
    // La carte était masquée : on recadre la journée une fois re-mesurée.
    if (suivante === "carte" && !bulle && terrains.length > 0) {
      window.setTimeout(() => viser("bounds", terrains.map((t) => t.id)), 80);
    }
  };

  const changerFiltre = (cle: keyof FiltresCarte, valeur: string) =>
    setFiltres((f) => (cle === "sport" ? { ...FILTRES_VIDES, sport: valeur } : { ...f, [cle]: valeur }));

  const terrainBulle = bulle ? terrains.find((t) => t.id === bulle.id) ?? null : null;
  const sansLieu = matchs.filter((m) => !m.lieuOk).length;

  if (isError) {
    return <div className="cs" ref={rootRef}><style dangerouslySetInnerHTML={{ __html: CS_CSS }} /><div className="cs-load cs-err">Les matchs n&apos;ont pas pu être chargés.</div></div>;
  }
  if (isLoading || !data) {
    return <div className="cs" ref={rootRef}><style dangerouslySetInnerHTML={{ __html: CS_CSS }} /><div className="cs-load">Chargement des matchs…</div></div>;
  }

  const filtre = (cle: keyof FiltresCarte, label: string, valeurs: string[], lib?: (v: string) => string) => {
    const valeur = filtres[cle];
    // Une seule valeur (ou aucune) : présent mais grisé, jamais caché (décision BP).
    // Une valeur posée absente du jour reste modifiable, pour pouvoir la retirer.
    const desactive = valeurs.length <= 1 && (!valeur || valeurs.includes(valeur));
    return (
      <FiltreBtn label={label} compteur={valeur ? 1 : 0} onClear={() => changerFiltre(cle, "")}
        desactive={desactive} titre={desactive ? "Une seule valeur ce jour-là" : undefined}>
        {() => (
          <ListeCases
            items={valeur && !valeurs.includes(valeur) ? [...valeurs, valeur] : valeurs}
            labels={lib ? Object.fromEntries(valeurs.map((v) => [v, lib(v)])) : undefined}
            selection={valeur ? [valeur] : []}
            onToggle={(v) => changerFiltre(cle, v === valeur ? "" : v)}
          />
        )}
      </FiltreBtn>
    );
  };

  return (
    <div className={"cs cm vue-" + vue} ref={rootRef} style={{ ["--cs-h" as string]: hauteur }} data-testid="carte-matchs">
      <style dangerouslySetInnerHTML={{ __html: CS_CSS + CM_CSS }} />

      <div className="topbar">
        <div className="brand"><span className="k">MATCHS DES ATHLÈTES SUIVIS</span><b>Carte des matchs</b></div>

        {/* Journée — le modèle n'a pas de date : mêmes boutons .fbtn. */}
        <span data-testid="choix-journee" style={{ display: "contents" }}>
          <span className={"fbtn" + (date === aujourdhui ? " on" : "")}>
            <span className="lbl" role="button" aria-pressed={date === aujourdhui} onClick={() => setDate(aujourdhui)}>Aujourd&apos;hui</span>
          </span>
          <span className={"fbtn" + (date === demain ? " on" : "")}>
            <span className="lbl" role="button" aria-pressed={date === demain} onClick={() => setDate(demain)}>Demain</span>
          </span>
          <span className={"fbtn" + (date !== aujourdhui && date !== demain ? " on" : "")}>
            <label className="lbl">
              <input type="date" className="cm-date" value={date} min={aujourdhui} aria-label="Date"
                onChange={(e) => e.target.value && setDate(e.target.value)} data-testid="date-carte" />
            </label>
          </span>
        </span>

        <span data-testid="filtres-carte" style={{ display: "contents" }}>
          {filtre("sport", "Sport", options.sports)}
          {filtre("categorie", "Catégorie", options.categories)}
          {filtre("division", "Division", options.divisions, libelleDivision)}
          {filtre("ligue", "Ligue", options.ligues)}
        </span>
      </div>

      <div className="main">
        <div className="list">
          <div className="count" data-testid="resume-journee">
            <b>{matchs.length} match{matchs.length > 1 ? "s" : ""}</b>
            {` · ${terrains.length} terrain${terrains.length > 1 ? "s" : ""}`}
            {sansLieu > 0 ? ` · ${sansLieu} au lieu non précisé` : ""}
          </div>
          <div className="cards" ref={listRef} data-testid="liste-matchs">
            {matchs.map((m) => {
              const tid = terrainDe(m);
              const g = m.game;
              const suivis = [...m.suivisDomicile, ...m.suivisVisiteur];
              const cote = m.suivisDomicile.length ? g.homeName : g.visitorName;
              return (
                <div
                  key={g.id} data-testid="ligne-match" data-terrain={tid ?? undefined} data-match={g.id}
                  className={"lc" + (tid && tid === selection ? " sel" : "") + (tid ? "" : " cm-sanslieu")}
                  onClick={tid ? () => ouvrir(tid, g.id) : undefined}
                  onMouseEnter={() => setSurvol(tid)}
                  onMouseLeave={() => setSurvol(null)}
                  aria-disabled={tid ? undefined : true}
                >
                  <div className="crest">{initialesDe(cote)}</div>
                  <div className="lcinfo">
                    <div className="lctitre"><b>{titreMatch(g)}</b></div>
                    <div className="m" data-testid="lieu-match">
                      {heureQuebec(g.gameTime)} · {m.lieuOk ? (g.venue.trim() || LIEU_NON_PRECISE) : LIEU_NON_PRECISE}
                    </div>
                    <div className="m" data-testid="suivis-match">
                      Suivis : {suivis.map((t) => `${nomSuivi(t)}${t.prospect ? " (prospect)" : ""}`).join(", ")}
                    </div>
                    <PastilleProfils p={profils.get(g.id)} />
                  </div>
                </div>
              );
            })}
            {matchs.length === 0 && (
              <div className="vide" data-testid="aucun-match">Aucun match d&apos;un athlète suivi ce jour-là. Change de date ou retire un filtre.</div>
            )}
          </div>
        </div>

        <div className="maparea" data-testid="carte">
          <MapPane
            points={points} selectedId={selection} hoveredId={survol} focus={focus} onSelect={ouvrirPoint}
            onHover={setSurvol} resizeToken={resizeToken} ariaLabel="Carte des matchs"
            bulle={bulle && terrainBulle ? bulle : null}
            onFermerBulle={fermerBulle}
            contenuBulle={terrainBulle ? <Bulle matchs={matchsBulle(terrainBulle, premierMatch)} terrain={terrainBulle.nom} profils={profils} /> : null}
          />
        </div>
      </div>

      {/* Bascule liste ↔ carte en fenêtre étroite — celle du modèle mobile (RechercheMobile). */}
      {etroit && (
        <button className="vtoggle" onClick={basculer} data-testid="bascule-vue">
          {vue === "liste" ? <MapIcon size={16} aria-hidden /> : <List size={16} aria-hidden />}
          <span>{vue === "liste" ? "Carte" : "Liste"}</span>
        </button>
      )}
    </div>
  );
}

/** « 4 profils Nexus · dont 1 suivi » — rien si aucun profil. */
function PastilleProfils({ p }: { p: ProfilsMatch | undefined }) {
  const total = libelleProfils(p);
  if (!total) return null;
  const dont = libelleDontSuivis(p);
  return (
    <div className="cm-profils">
      <span className="b" data-testid="pastille-profils">{dont ? `${total} · ${dont}` : total}</span>
    </div>
  );
}

/** Contenu de la bulle : tous les matchs du terrain, le cliqué en premier. */
function Bulle({ matchs, terrain, profils }: { matchs: MatchCarte[]; terrain: string; profils: Map<string, ProfilsMatch> }) {
  return (
    <div className="cm-bulle" data-testid="bulle">
      <div className="ptag">{terrain}</div>
      {matchs.map((m) => {
        const g = m.game;
        const e = evenementMatch(g);
        const suivis = [...m.suivisDomicile, ...m.suivisVisiteur];
        const niveau = [g.category, libelleDivision(g.division)].filter(Boolean).join(" · ");
        return (
          <div key={g.id} className="cm-bm" data-testid="bulle-match" data-match={g.id}>
            <div className="cm-bh">{heureQuebec(g.gameTime)}</div>
            <b>{titreMatch(g)}</b>
            {niveau && <div className="m">{niveau}</div>}
            {g.leagueName && <div className="m">{g.leagueName}</div>}
            <div className="m">Suivis : {suivis.map((t) => `${nomSuivi(t)}${t.prospect ? " (prospect)" : ""}`).join(", ")}</div>
            <ListeProfils p={profils.get(g.id)} domicile={g.homeName} visiteur={g.visitorName} />
            <div className="cm-ba" data-testid="actions-match">
              <a className="btn page" href={lienItineraire(g.venueLat!, g.venueLon!)} target="_blank" rel="noopener noreferrer">Itinéraire</a>
              <div className="ptag">AJOUTER À MON AGENDA</div>
              <div className="cm-agenda">
                <a className="b" href={e.googleUrl} target="_blank" rel="noopener noreferrer">Google</a>
                <a className="b" href={e.outlookUrl} target="_blank" rel="noopener noreferrer">Outlook</a>
                <button type="button" className="b" onClick={() => downloadIcs(e.icsBlob, `match-${g.gameDate}.ics`)}>.ics</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Profils Nexus d'un match (suivis d'abord) : lien vers la fiche, position,
 *  promotion, équipe. Les suivis portent la pastille verte du modèle (.b.need). */
function ListeProfils({ p, domicile, visiteur }: { p: ProfilsMatch | undefined; domicile: string; visiteur: string }) {
  if (!p || p.total === 0) return null;
  return (
    <div className="cm-pl" data-testid="liste-profils">
      <div className="ptag">PROFILS NEXUS ({p.total})</div>
      {p.profils.map((a) => (
        <div key={a.athleteId} className="trow" data-testid="profil-nexus">
          <span className="tsport">
            <Link href={`/recruteur/athletes/${a.athleteId}`}>{`${a.prenom} ${a.nom}`.trim()}</Link>
            {a.suivi && <span className="b need">Suivi</span>}
          </span>
          <span className="tmeta">
            <span>{[a.position, a.promotion ? `Promo ${a.promotion}` : null].filter(Boolean).join(" · ") || "—"}</span>
            <span>{a.cote === "DOMICILE" ? domicile : visiteur}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* Ce que le modèle n'a pas, avec SES jetons (.cs) : la bulle reprend le
   panneau .preview (fond, bordure, rayon, ombre) ; la bascule reprend
   .vtoggle de RechercheMobile ; le pin reprend l'effet de sélection du web. */
const CM_CSS = `
.cs.cm{position:relative}
.cs .lc.cm-sanslieu{cursor:default}
.cs .lc.cm-sanslieu:hover{border-color:var(--line2);background:var(--card)}
.cs .lc .m + .m{margin-top:2px}
.cs .cm-date{background:none;border:0;outline:none;color:inherit;font:inherit;color-scheme:dark;cursor:pointer}
.cs .cs-bulle .leaflet-popup-content-wrapper{background:#171B22F7;backdrop-filter:blur(10px);border:1px solid var(--line2);border-radius:18px;color:var(--txt);box-shadow:0 18px 54px #000B;padding:0}
.cs .cs-bulle .leaflet-popup-content{margin:16px 18px;font-family:var(--f-body);font-size:13.5px;line-height:1.4;max-height:min(420px,60vh);overflow-y:auto}
.cs .cs-bulle .leaflet-popup-tip{background:#171B22F7;box-shadow:none}
.cs .cs-bulle a.leaflet-popup-close-button{color:var(--soft);top:8px;right:8px}
.cs .cs-bulle a.leaflet-popup-close-button:hover{color:var(--nexus)}
.cs .cm-bulle{display:flex;flex-direction:column;gap:12px;padding-right:12px}
.cs .cm-bm{display:flex;flex-direction:column;gap:4px;padding-top:12px;border-top:1px solid #23293380}
.cs .cm-bm:first-of-type{border-top:0;padding-top:0}
.cs .cm-bh{font-family:var(--f-title);font-size:19px;color:var(--nexus);line-height:1.1}
.cs .cm-bm b{font-size:15px;font-weight:800;color:var(--txt)}
.cs .cm-bm .m{font-size:12.5px;color:var(--soft)}
.cs .cm-ba{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.cs .cm-ba .btn{padding:11px;font-size:14px;color:#fff}
.cs .cm-agenda{display:flex;gap:6px;flex-wrap:wrap}
.cs .cm-agenda .b{cursor:pointer;text-decoration:none}
.cs .cm-agenda .b:hover{border-color:var(--nexus);color:var(--txt)}
.cs .cm-profils{margin-top:7px}
.cs .cm-pl{display:flex;flex-direction:column;margin-top:6px}
.cs .cm-pl .ptag{margin-bottom:2px}
.cs .cm-pl .trow{padding:8px 0;font-size:13.5px}
.cs .cm-pl .tsport a{color:var(--txt);text-decoration:none}
.cs .cm-pl .tsport a:hover{color:var(--nexus)}
.cs .cm-pl .tmeta{font-size:12px}
.cs .vtoggle{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);height:42px;padding:0 18px;border-radius:21px;
  background:rgba(26,29,36,.94);backdrop-filter:blur(14px);border:1px solid var(--line2);
  display:flex;align-items:center;gap:8px;cursor:pointer;z-index:950;box-shadow:0 8px 26px rgba(0,0,0,.6);
  font-size:14px;font-weight:600;color:#fff;white-space:nowrap}
.cs .vtoggle svg{stroke:#fff}
@media(max-width:1000px){
  .cs.cm .main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr)}
  .cs.cm .list{max-height:none;border-bottom:0}
  .cs.cm.vue-liste .maparea{display:none}
  .cs.cm.vue-carte .list{display:none}
  .cs.cm .cards{padding-bottom:76px}
}
`;
