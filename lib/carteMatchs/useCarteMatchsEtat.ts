"use client";

/* ═══════════════════════════════════════════════════════════════
   useCarteMatchsEtat — L'ÉTAT ET LA LOGIQUE de la carte des matchs, sortis de
   components/carte-matchs/CarteMatchs.tsx (web) pour être lus aussi par
   l'écran mobile (components/carte-matchs/CarteMatchsMobile.tsx). Les deux
   écrans ne diffèrent que par le rendu : filtres, plage, pastilles, recherche,
   résultats, sélection et « + » sont décidés ici, une seule fois.

   Ce qui reste dans l'écran : la mise en page (largeur, bascule liste/carte,
   hauteur), le cadrage de la carte (focus) et le survol.
═══════════════════════════════════════════════════════════════ */

import * as React from "react";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useCalendrierUnite } from "@/lib/queries/recruiter/useCalendrierUnite";
import { useOrigineCarte } from "@/lib/carteMatchs/useOrigineCarte";
import { useProfilsMatchs } from "@/lib/carteMatchs/useProfilsMatchs";
import {
  useBasculerCalendrier, useMatchsRecherche, useProfilsPartenaire, useSourcesMatchs, useSportsCarte, useSuggestionsCarte,
  type ModeCarte,
} from "@/lib/carteMatchs/useMatchsRecherche";
import {
  TYPES_MATCH, typesParDefautPour, erreurPlage, optionsCatDiv, filtrerCatDiv, grouperParJour,
  terrainsCarte, terrainDe, etatCalendrier, jourDecale, bornerFin, avisFinAjustee, matchsLisibles, trierMatchs,
  ajouterPastille, parametresPastilles, libelleDivision, LIEU_NON_PRECISE,
  type PastilleCarte, type MatchRecherche, type ProfilsMatch, type TypeMatch,
} from "@/lib/carteMatchs/carteMatchs";
import type { MapPoint } from "@/components/cegep-search/MapPane";

export const LIBELLES_TYPES: Record<string, string> = Object.fromEntries(TYPES_MATCH.map((t) => [t.v, t.label]));
export const TOUS_LES_TYPES: TypeMatch[] = TYPES_MATCH.map((t) => t.v);
/** Le refus de la base (42501) à un partenaire non approuvé ; suivi du courriel de contact. */
export const TEXTE_REFUS_PARTENAIRE = "La carte des matchs est réservée aux partenaires approuvés. Écris-nous à";

export function useCarteMatchsEtat(mode: ModeCarte) {
  const partenaire = mode === "partenaire";
  const { tier, loading: tierLoading } = useSubscription();
  // Partenaire : gratuit ; la base n'admet que les APPROVED (refus affiché par l'écran).
  const actif = partenaire || (tier !== "free" && !tierLoading);
  const { data: origine } = useOrigineCarte(actif && !partenaire);
  const { data: sports } = useSportsCarte(actif);
  // Les cibles de l'unité : seulement pour « dont X suivi(s) » dans le panneau
  // (même cache que le Calendrier). Jamais pour un partenaire.
  const { data: unite } = useCalendrierUnite(actif && !partenaire);
  const suivisUnite = React.useMemo(() => new Set((unite?.targets ?? []).map((t) => t.athleteId)), [unite]);
  const basculer = useBasculerCalendrier(mode);

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
  /** « Mes matchs » (partenaire) : seulement les matchs ajoutés, sur la saison à venir. */
  const [mesMatchs, setMesMatchs] = React.useState(false);
  const saison = pastilles.length > 0 || mesMatchs;
  const [sport, setSport] = React.useState("");
  // Partenaire : pas d'unité, donc pas de sport imposé — la recherche part tout de suite.
  const [sportInitialise, setSportInitialise] = React.useState(partenaire);
  // Recruteur universitaire (lot D3b) : Collégial coché par défaut, posé une fois le compte lu.
  const { data: moi } = useCurrentUser();
  const universitaire = !partenaire && moi?.profile.context === "universitaire";
  const typesDefaut = React.useMemo(() => typesParDefautPour(universitaire), [universitaire]);
  const [types, setTypes] = React.useState<TypeMatch[]>(() => typesParDefautPour(false));
  const [typesAjustes, setTypesAjustes] = React.useState(false);
  React.useEffect(() => {
    if (typesAjustes || !moi) return;
    setTypes(typesParDefautPour(universitaire));
    setTypesAjustes(true);
  }, [moi, universitaire, typesAjustes]);
  const [categorie, setCategorie] = React.useState("");
  const [division, setDivision] = React.useState("");
  const [selection, setSelection] = React.useState<string | null>(null);

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
  const { data, isLoading, isError, isFetching, error: erreurRecherche } = useMatchsRecherche(
    // Les filtres s'appliquent PARTOUT, pastille ou non (BP 2026-10-09). Avec une pastille,
    // la saison à venir entière, et le texte ne sert qu'à chercher la pastille suivante.
    saison
      ? { debut, fin: debut, sport, types, texte: pastilles.length ? "" : texte, equipes, lieux, mesMatchs }
      : { debut, fin: fin || debut, sport, types, texte, equipes, lieux },
    actif && sportInitialise && !erreur,
    mode,
  );
  /** La base refuse (42501) : partenaire non approuvé (SUSPENDED, REVOKED, en attente). */
  const refuse = isError && (erreurRecherche as { code?: string } | null)?.code === "42501";
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
  /** Les autres matchs du terrain du match choisi, dans les résultats affichés (BP 2026-10-08). */
  const autresDuTerrain = choisi && terrainChoisi
    ? matchs.filter((x) => x.id !== choisi.id && terrainDe(x)?.id === terrainChoisi) : [];

  // Un match sorti des résultats ferme le panneau.
  React.useEffect(() => {
    if (selection && !matchs.some((m) => m.id === selection)) setSelection(null);
  }, [matchs, selection]);

  /** Le premier match d'un terrain (clic sur un point de la carte). */
  const premierDuTerrain = React.useCallback((terrainId: string): MatchRecherche | null => {
    const t = terrains.find((x) => x.id === terrainId);
    return t ? matchs.find((x) => x.id === t.matchIds[0]) ?? null : null;
  }, [terrains, matchs]);

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
  /* Lot B4 cégep (décision BP 2026-10-26) : « Retirer les filtres » revient aux valeurs PAR DÉFAUT —
     Secondaire + Civil, Collégial décoché comme pour tous — et ne recoche plus le Collégial. Un filtre
     est donc « posé » quand les types s'écartent du défaut, pas quand il en manque un. */
  const typesParDefaut = types.length === typesDefaut.length && typesDefaut.every((t) => types.includes(t));
  const filtresPoses = !!sport || !!categorie || !!division || !typesParDefaut;
  /** « Retirer les filtres » : tous les sports, les types par défaut, toutes catégories et divisions. */
  const retirerFiltres = () => { setSport(""); setTypes([...typesDefaut]); setCategorie(""); setDivision(""); };
  const proposees = suggestions.filter((x) => !pastilles.some((y) => y.genre === x.genre && y.cle === x.cle));
  const menuVisible = suggOuvert && q.trim().length >= 2 && texte.trim().length >= 2 && (proposees.length > 0 || suggPret);
  /** Une suggestion devient une pastille ; le texte libre est vidé (sinon il
   *  filtrerait encore la saison de l'équipe choisie). */
  const choisirSuggestion = (x: PastilleCarte) => {
    setPastilles((l) => ajouterPastille(l, { genre: x.genre, cle: x.cle, libelle: x.libelle, detail: x.detail }));
    setQ(""); setTexte(""); setSuggOuvert(false); setSuggActif(0);
  };
  const retirerPastille = (x: PastilleCarte) =>
    setPastilles((l) => l.filter((y) => !(y.genre === x.genre && y.cle === x.cle)));
  const basculerType = (v: TypeMatch) =>
    setTypes((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]));

  return {
    partenaire, actif, sports, suivisUnite, aujourdhui,
    debut, fin, avisPlage, poserPlage, erreur, saison,
    q, setQ, texte, setTexte, pastilles, setPastilles, retirerPastille,
    suggOuvert, setSuggOuvert, suggActif, setSuggActif, suggPret, proposees, menuVisible, choisirSuggestion,
    mesMatchs, setMesMatchs, sport, setSport, types, setTypes, basculerType, categorie, setCategorie, division, setDivision,
    filtresPoses, retirerFiltres,
    isLoading, isError, isFetching, refuse, options, matchs, jours, terrains, sansLieu, sources, points,
    selection, setSelection, choisi, terrainChoisi, autresDuTerrain, premierDuTerrain,
    enCours, basculerMatch,
  };
}

/** Ce que le panneau (web) et l'aperçu (appli) d'un match affichent : les joueurs
 *  Nexus, AU CLIC pour ce match — matchs_profils_nexus (recruteur) ou
 *  matchs_profils_partenaire (partenaire : noms des seuls athlètes qui ont coché
 *  la visibilité partenaire) — et les lignes de détail. */
export function useDetailsMatch(mode: ModeCarte, m: MatchRecherche, suivis: ReadonlySet<string>, actif: boolean) {
  const partenaire = mode === "partenaire";
  const { parMatch, isLoading: chargeRecruteur } = useProfilsMatchs(!partenaire && m.nb_profils > 0 ? [m.id] : [], suivis, actif && !partenaire);
  const profils: ProfilsMatch | undefined = partenaire ? undefined : parMatch.get(m.id);
  const pp = useProfilsPartenaire(partenaire ? m.id : null, actif && partenaire && m.nb_profils > 0);
  const total = partenaire ? (pp.total || m.nb_profils) : (profils?.total ?? m.nb_profils);
  const isLoading = partenaire ? pp.isLoading : chargeRecruteur;
  const details: [string, string | null][] = [
    ["Terrain", m.terrain || LIEU_NON_PRECISE],
    ["Catégorie", m.categorie],
    ["Division", libelleDivision(m.division) || null],
    ["Zone", m.zone?.trim() || null],
    ["Ligue", m.ligue],
    ["Type", m.type ? LIBELLES_TYPES[m.type] : null],
  ];
  return { partenaire, profils, pp, total, isLoading, etat: etatCalendrier(m), terrain: terrainDe(m), details };
}
