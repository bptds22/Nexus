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
import { useBasculerCalendrier, useMatchsRecherche, useSourcesMatchs, useSportsCarte, useSuggestionsCarte } from "@/lib/carteMatchs/useMatchsRecherche";
import SourceMatchLigne from "@/components/shared/SourceMatchLigne";
import type { SourceMatch } from "@/lib/calendar/sourceMatch";
import { CS_CSS, FiltreBtn, ListeCases } from "@/components/cegep-search/CegepSearch";
import {
  TYPES_MATCH, TYPES_PAR_DEFAUT, erreurPlage, optionsCatDiv, filtrerCatDiv, grouperParJour, libelleJour,
  terrainsCarte, terrainDe, etatCalendrier, heureQuebec, libelleDivision, lienItineraire, titreMatch, jourDecale,
  libelleProfils, libelleDontSuivis, dateSaisie, bornerFin, avisFinAjustee, matchsLisibles, dateCourte, dateCarte, enTeteJour, heureCarte, trierMatchs, ajouterPastille, parametresPastilles, LIEU_NON_PRECISE,
  type PastilleCarte,
  type MatchRecherche, type ProfilsMatch, type TypeMatch,
} from "@/lib/carteMatchs/carteMatchs";
import type { MapFocus, MapPoint } from "@/components/cegep-search/MapPane";

const MapPane = dynamic(() => import("@/components/cegep-search/MapPane"), { ssr: false });
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Même seuil que le @media du modèle (CS_CSS, max-width:1000px). */
const ETROIT = "(max-width: 1000px)";
const LIBELLES_TYPES = Object.fromEntries(TYPES_MATCH.map((t) => [t.v, t.label]));
const TOUS_LES_TYPES: TypeMatch[] = TYPES_MATCH.map((t) => t.v);


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
  /** « Période limitée à 31 jours — fin ajustée au … » : visible tant que les dates ne bougent pas. */
  const [avisPlage, setAvisPlage] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [texte, setTexte] = React.useState("");
  /** Pastilles Équipe / Terrain choisies dans les suggestions (BP 2026-10-09). */
  const [pastilles, setPastilles] = React.useState<PastilleCarte[]>([]);
  const [suggOuvert, setSuggOuvert] = React.useState(false);
  const [suggActif, setSuggActif] = React.useState(0);
  const saison = pastilles.length > 0;
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
  /** La carte n'est pas à l'écran (liste pleine largeur, ou vue liste en fenêtre
   *  étroite) : le panneau s'ouvre AU-DESSUS de la liste, sans revenir à la carte. */
  const carteMasquee = pleine || (etroit && vue === "liste");
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
    setSport(typeof origine.sportUnite === "string" ? origine.sportUnite : "");
    setSportInitialise(true);
  }, [origine, sportInitialise]);

  // Recherche texte : la base reçoit le texte 300 ms après la dernière frappe.
  React.useEffect(() => {
    const t = window.setTimeout(() => setTexte(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // Avec une pastille : la saison à venir entière, la date de fin ne compte plus.
  const erreur = saison ? null : erreurPlage(debut, fin || null);
  const { equipes, lieux } = parametresPastilles(pastilles);
  const { data, isLoading, isError, isFetching } = useMatchsRecherche(
    // Les filtres s'appliquent PARTOUT, pastille ou non (BP 2026-10-09). Avec une pastille,
    // la saison à venir entière, et le texte ne sert qu'à chercher la pastille suivante.
    saison
      ? { debut, fin: debut, sport, types, texte: "", equipes, lieux }
      : { debut, fin: fin || debut, sport, types, texte, equipes, lieux },
    actif && sportInitialise && !erreur,
  );
  // Plage refusée ou recherche en erreur : liste ET carte vides, ensemble — jamais
  // les marqueurs de la recherche précédente (BP 2026-10-09).
  const tous = React.useMemo(() => (erreur || isError ? [] : matchsLisibles(data)), [data, erreur, isError]);
  const options = React.useMemo(() => optionsCatDiv(tous), [tous]);
  const matchs = React.useMemo(
    () => trierMatchs(filtrerCatDiv(tous, categorie, division)),
    [tous, categorie, division],
  );
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

  /** Ouvre le panneau d'un match ; si la carte est à l'écran, zoome sur son
   *  terrain (flyTo du modèle). Carte masquée : on reste sur la liste. */
  const ouvrir = React.useCallback((m: MatchRecherche) => {
    setSelection(m.id);
    const t = terrainDe(m);
    if (t && !carteMasquee) viser("fly", [t.id]);
  }, [viser, carteMasquee]);

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

  /** Retour à la carte : Leaflet se re-mesure, PUIS on cadre le match ouvert
   *  (ou tous les terrains). */
  const revenirCarte = () => {
    const ids = terrainChoisi ? [terrainChoisi] : terrains.map((t) => t.id);
    if (ids.length > 0) window.setTimeout(() => viser(terrainChoisi ? "fly" : "bounds", ids), 80);
  };

  const basculerVue = () => {
    const suivante = vue === "liste" ? "carte" : "liste";
    setVue(suivante);
    setResizeToken((t) => t + 1);
    if (suivante === "carte") revenirCarte();
  };

  const choisirAffichage = (liste: boolean) => {
    if (liste === listePleine) return;
    setListePleine(liste);
    setResizeToken((t) => t + 1);
    if (!liste) revenirCarte();
  };

  /** Pose la plage ; au-delà de JOURS_MAX, la fin est ramenée et on le DIT. */
  const poserPlage = (d: string, f: string) => {
    const b = bornerFin(d, f);
    setDebut(d);
    setFin(b.fin);
    setAvisPlage(b.ajustee ? avisFinAjustee(b.fin) : null);
  };

  const enCours = basculer.isPending ? basculer.variables?.gameId ?? null : null;
  const basculerMatch = (m: MatchRecherche) => {
    const etat = etatCalendrier(m);
    if (etat === "SUIVI" || enCours) return;
    basculer.mutate({ gameId: m.id, ajouter: etat === "LIBRE" });
  };

  // Suggestions : sur le texte (déjà temporisé, 300 ms), avec les filtres en place. Une
  // pastille déjà posée n'est plus proposée.
  const { suggestions, pret: suggPret } = useSuggestionsCarte(texte, { sport, types, categorie, division }, actif && types.length > 0);
  const filtresPoses = !!sport || !!categorie || !!division || types.length < TOUS_LES_TYPES.length;
  /** « Retirer les filtres » : tous les sports, tous les types, toutes catégories et divisions. */
  const retirerFiltres = () => { setSport(""); setTypes(TOUS_LES_TYPES); setCategorie(""); setDivision(""); };
  const proposees = suggestions.filter((x) => !pastilles.some((y) => y.genre === x.genre && y.cle === x.cle));
  const menuVisible = suggOuvert && q.trim().length >= 2 && texte.trim().length >= 2 && (proposees.length > 0 || suggPret);
  /** Une suggestion devient une pastille ; le texte libre est vidé (sinon il
   *  filtrerait encore la saison de l'équipe choisie). */
  const choisirSuggestion = (x: PastilleCarte) => {
    setPastilles((l) => ajouterPastille(l, { genre: x.genre, cle: x.cle, libelle: x.libelle, detail: x.detail }));
    setQ(""); setTexte(""); setSuggOuvert(false); setSuggActif(0);
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

  const panneau = choisi && (
    <Panneau m={choisi} source={sources?.get(choisi.id)} suivis={suivisUnite} actif={actif} enCours={enCours}
      autres={terrainChoisi ? matchs.filter((x) => x.id !== choisi.id && terrainDe(x)?.id === terrainChoisi) : []}
      onCalendrier={basculerMatch} onOuvrir={ouvrir} onClose={() => setSelection(null)} />
  );

  return (
    <div className={"cs cm vue-" + vue + (pleine ? " pleine" : "")} ref={rootRef} style={{ ["--cs-h" as string]: hauteur }} data-testid="carte-matchs">
      <style dangerouslySetInnerHTML={{ __html: CS_CSS + CM_CSS }} />

      <div className="topbar">
        <div className="brand"><b>Carte des matchs</b></div>

        <div className="search cm-search">
          <svg className="sico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={q} placeholder="Équipe, terrain…" data-testid="recherche-texte"
            role="combobox" aria-expanded={menuVisible} aria-controls="cm-suggestions" aria-autocomplete="list"
            onChange={(e) => { setQ(e.target.value); setSuggOuvert(true); setSuggActif(0); }}
            onFocus={() => setSuggOuvert(true)}
            onBlur={() => setSuggOuvert(false)}
            onKeyDown={(e) => {
              if (!menuVisible) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setSuggActif((i) => Math.min(i + 1, proposees.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSuggActif((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter" && proposees[suggActif]) { e.preventDefault(); choisirSuggestion(proposees[suggActif]); }
              else if (e.key === "Escape") setSuggOuvert(false);
            }} />
          {q && <button className="clr" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(""); setTexte(""); }} aria-label="Effacer la recherche">✕</button>}
          {menuVisible && (
            <div className="cm-sugg" id="cm-suggestions" role="listbox" data-testid="suggestions"
              onMouseDown={(e) => e.preventDefault() /* garde le focus : le clic choisit avant le blur */}>
              {(["EQUIPE", "TERRAIN"] as const).map((g) => {
                const items = proposees.filter((x) => x.genre === g);
                if (!items.length) return null;
                return (
                  <div key={g} className="cm-sugg-groupe" data-testid={g === "EQUIPE" ? "suggestions-equipes" : "suggestions-terrains"}>
                    <div className="cm-sugg-tete">{g === "EQUIPE" ? "Équipes" : "Terrains"}</div>
                    {items.map((x) => {
                      const i = proposees.indexOf(x);
                      return (
                        <button key={x.genre + x.cle} type="button" role="option" aria-selected={i === suggActif}
                          className={"cm-sugg-item" + (i === suggActif ? " actif" : "")} data-testid="suggestion"
                          onMouseEnter={() => setSuggActif(i)} onClick={() => choisirSuggestion(x)}>
                          <b>{x.libelle}</b>
                          <span>{[x.detail, x.nb_matchs ? x.nb_matchs + " match" + (x.nb_matchs > 1 ? "s" : "") + " à venir" : null].filter(Boolean).join(" · ")}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {!proposees.length && suggPret && (filtresPoses ? (
                <div className="cm-sugg-vide" data-testid="suggestions-vide">
                  Aucune équipe ni terrain avec ces filtres.{" "}
                  <button type="button" className="cm-sugg-lien" data-testid="retirer-filtres" onClick={retirerFiltres}>Retirer les filtres</button>
                </div>
              ) : (
                <div className="cm-sugg-vide" data-testid="suggestions-vide">Aucune équipe ni aucun terrain avec un match à venir.</div>
              ))}
            </div>
          )}
        </div>

        {pastilles.length > 0 && (
          <span className="cm-pastilles" data-testid="pastilles">
            {pastilles.map((x) => (
              <button key={x.genre + x.cle} type="button" className="ddpill" data-testid="pastille" data-genre={x.genre}
                title={x.detail ?? undefined} onClick={() => setPastilles((l) => l.filter((y) => !(y.genre === x.genre && y.cle === x.cle)))}
                aria-label={"Retirer " + x.libelle}>
                <span className="cm-pastille-genre">{x.genre === "EQUIPE" ? "Équipe" : "Terrain"}</span>{x.libelle}<span className="x">✕</span>
              </button>
            ))}
          </span>
        )}

        {/* Dates — le modèle n'en a pas : mêmes boutons .fbtn. Une date, et un « au » facultatif. */}
        {/* Le champ natif reste (sélecteur, clavier) mais invisible : le navigateur
            l'écrirait selon SA locale (« 10/09/2026 », ambigu). On affiche « 9 oct. 2026 ». */}
        <span className="fbtn on cm-dchamp" data-testid="date-debut-zone">
          <label className="lbl">
            <span className="cm-dlib" data-testid="date-debut-libelle">{dateCourte(debut)}</span>
            <input type="date" className="cm-date" value={debut} aria-label="Date" onClick={ouvrirSelecteur}
              onChange={(e) => { const v = dateSaisie(e.target.value); if (v) poserPlage(v, fin); }} data-testid="date-debut" />
          </label>
        </span>
        {saison ? (
          <span className="fbtn on" data-testid="date-fin-zone" title="Une équipe ou un terrain est choisi : toute la saison à venir, sans limite de 31 jours.">
            <span className="lbl"><span>au</span><span className="cm-dlib" data-testid="date-fin-libelle">fin de saison</span></span>
          </span>
        ) : (
        <span className={"fbtn cm-dchamp" + (fin ? " on" : "")} data-testid="date-fin-zone">
          <label className="lbl">
            <span>au</span>
            <span className={"cm-dlib" + (fin ? "" : " cm-dlib-vide")} data-testid="date-fin-libelle">{fin ? dateCourte(fin) : "facultatif"}</span>
            <input type="date" className="cm-date" value={fin} min={debut} aria-label="Au (facultatif)" onClick={ouvrirSelecteur}
              onChange={(e) => { const v = e.target.value; if (!v) poserPlage(debut, ""); else { const d = dateSaisie(v); if (d) poserPlage(debut, d); } }} data-testid="date-fin" />
            {fin && <button className="clr" onClick={(e) => { e.preventDefault(); poserPlage(debut, ""); }} aria-label="Retirer la date de fin">✕</button>}
          </label>
        </span>
        )}

        <span data-testid="filtres-carte" style={{ display: "contents" }}>
          {filtreUnique("Sport", sport, Array.isArray(sports) ? sports : [], setSport, { toujoursActif: true })}
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
          {!saison && (erreur || avisPlage) && (
            <div className="cm-avis" role="status" data-testid="avis-plage">{erreur ?? avisPlage}</div>
          )}
          <div className="count" data-testid="resume">
            {erreur ? <span>Aucune recherche lancée.</span> : (
              <>
                <b>{matchs.length} match{matchs.length > 1 ? "s" : ""}</b>
                {` · ${terrains.length} terrain${terrains.length > 1 ? "s" : ""}`}
                {sansLieu > 0 ? ` · ${sansLieu} au lieu non précisé` : ""}
                {saison ? " · toute la saison à venir" : ""}
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
            {/* Un bloc par jour : l'en-tête colle en haut tant que son jour défile,
                puis le jour suivant le repousse. Cartes dessous — une colonne en
                mode Carte, une grille en mode Liste (même rendu, BP 2026-10-09). */}
            {!erreur && jours.map((j) => {
              const tete = enTeteJour(j.jour, aujourdhui, j.matchs.length);
              return (
                <section key={j.jour} className="cm-bloc" data-testid="bloc-jour" data-jour={j.jour}>
                  <h3 className="cm-jour" data-testid="jour">
                    <span className="cm-jour-boite">
                      <span className="cm-jour-nom">{tete.jour}</span>
                      <span className="cm-jour-n">{tete.compte}</span>
                    </span>
                  </h3>
                  <div className="cm-grille">
                    {j.matchs.map((m) => {
                      const t = terrainDe(m);
                      const heure = heureCarte(m.heure);
                      return (
                        <div
                          key={m.id} data-testid="ligne-match" data-match={m.id} data-terrain={t?.id}
                          className={"lc cm-lc" + (m.id === selection ? " sel" : "")}
                          onClick={() => ouvrir(m)}
                          onMouseEnter={() => setSurvol(t?.id ?? null)}
                          onMouseLeave={() => setSurvol(null)}
                        >
                          <div className="cm-quand">
                            <div className={"cm-heure" + (minutesConnues(m) ? "" : " tbc")} data-testid="heure-match">{heure}</div>
                            <div className="cm-date-carte" data-testid="date-match">{dateCarte(m.jour)}</div>
                          </div>
                          <div className="lcinfo">
                            <div className="lctitre"><b>{titreMatch(m)}</b></div>
                            <div className="m">{m.terrain || LIEU_NON_PRECISE}</div>
                          </div>
                          <BoutonCalendrier m={m} enCours={enCours === m.id} onClick={() => basculerMatch(m)} />
                          {/* Pleine largeur sous l'heure et les équipes : dans la colonne
                              étroite du mode Carte, elle s'enroulait sur 4-5 lignes. */}
                          <div className="cm-lc-src"><Source source={sources?.get(m.id)} /></div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {carteMasquee && panneau}
        <div className="maparea" data-testid="carte">
          <MapPane points={points} selectedId={terrainChoisi} hoveredId={survol} focus={focus} onSelect={ouvrirPoint}
            resizeToken={resizeToken} ariaLabel="Carte des matchs" />
          {!carteMasquee && panneau}
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

/** Le sélecteur natif s'ouvre au clic n'importe où sur le champ (le champ est
 *  invisible : seule l'icône l'aurait ouvert). */
function ouvrirSelecteur(e: React.MouseEvent<HTMLInputElement>) {
  try { e.currentTarget.showPicker?.(); } catch { /* déjà ouvert, ou navigateur sans showPicker */ }
}

const minutesConnues = (m: MatchRecherche) => heureCarte(m.heure) !== "Heure à confirmer";

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
.cs.cm .main{position:relative}
.cs .cm-search{position:relative}
.cs .cm-sugg{position:absolute;top:calc(100% + 6px);left:0;width:min(460px,92vw);z-index:1000;background:#20242D;border:1px solid var(--line2);
  border-radius:13px;padding:8px;box-shadow:0 18px 46px #000B;max-height:min(70vh,520px);overflow-y:auto}
.cs .cm-sugg-groupe+.cm-sugg-groupe{margin-top:6px;padding-top:6px;border-top:1px solid var(--line)}
.cs .cm-sugg-tete{padding:4px 8px 6px;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.cs .cm-sugg-item{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:none;border:0;border-radius:9px;padding:8px 10px;cursor:pointer;font:inherit}
.cs .cm-sugg-item b{font-size:14px;font-weight:700;color:var(--txt)}
.cs .cm-sugg-item span{font-size:12px;color:var(--mut)}
.cs .cm-sugg-item.actif{background:#2A2F3A}
.cs .cm-sugg-vide{padding:10px;font-size:12.5px;color:var(--mut)}
.cs .cm-sugg-lien{background:none;border:0;padding:0;font:inherit;font-weight:700;color:#fff;text-decoration:underline;cursor:pointer}
.cs .cm-sugg-lien:hover{color:var(--nexus)}
.cs .cm-pastilles{display:inline-flex;flex-wrap:wrap;gap:6px}
.cs .cm-pastille-genre{font-size:11px;font-weight:600;color:#E9909A}
.cs .cm-avis{margin:10px 14px 0;padding:9px 12px;border-radius:10px;border:1px solid #F59E0B66;background:#F59E0B1F;color:#FCD34D;font-size:13px;font-weight:600;line-height:1.35}
.cs .cm-date{background:none;border:0;outline:none;color:inherit;font:inherit;color-scheme:dark;cursor:pointer}
.cs.cm .cards{gap:0}
.cs .cm-bloc{display:flex;flex-direction:column;padding-bottom:14px}
.cs .cm-jour{position:sticky;top:0;z-index:6;margin:0 -12px 8px;padding:10px 16px 9px;background:var(--bg);
  display:flex;letter-spacing:0;text-transform:none}
/* Encadré rouge, texte blanc (BP 2026-10-09). #DC3441 plutôt que #E63946 : blanc / #DC3441 =
   4,55:1 (AA texte courant ≥ 4,5:1) ; #E63946 n'atteignait que 4,17:1. */
.cs .cm-jour-boite{flex:1;display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  background:#DC3441;border-radius:10px;padding:8px 12px;font-size:14.5px;font-weight:700}
.cs .cm-jour-nom{color:#fff}
.cs .cm-jour-n{font-size:12.5px;font-weight:500;color:#fff;white-space:nowrap}
.cs .cm-grille{display:flex;flex-direction:column;gap:8px}
.cs .cm-lc{display:grid;grid-template-columns:62px minmax(0,1fr) auto;column-gap:12px;align-items:start;scroll-margin-top:52px}
.cs .cm-lc .heart{align-self:center}
.cs .cm-lc-src{grid-column:1/-1}
.cs .cm-lc-src:empty{display:none}
.cs .cm-quand{min-width:0}
.cs .cm-date-carte{margin-top:3px;font-size:11.5px;font-weight:600;color:var(--mut);white-space:nowrap}
.cs .cm-heure{padding-top:1px;font-size:15px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
.cs .cm-heure.tbc{white-space:normal;font-size:11.5px;font-weight:600;line-height:1.3;color:var(--mut)}
.cs .cm-dchamp .lbl{position:relative}
.cs .cm-dchamp .cm-date{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.cs .cm-dchamp .clr{position:relative;z-index:1}
.cs .cm-dchamp:focus-within{border-color:#8FA3C8}
.cs .cm-dlib{white-space:nowrap}
.cs .cm-dlib.cm-dlib-vide{color:var(--mut);font-weight:600}
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
  .cs.cm.pleine .cards{padding:0 18px 18px}
  .cs.cm.pleine .cm-jour{margin:0 -18px 10px;padding:12px 22px 10px}
  .cs.cm.pleine .cm-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:8px}
}
@media(max-width:1000px){
  .cs.cm .main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr)}
  .cs.cm .list{max-height:none;border-bottom:0}
  .cs.cm.vue-liste .maparea{display:none}
  .cs.cm.vue-carte .list{display:none}
  .cs.cm .cards{padding-bottom:76px}
}
`;
