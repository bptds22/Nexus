/* ═══════════════════════════════════════════════════════════════
   filtres-url — le jeu de filtres de la recherche recruteur, et sa
   traduction depuis/vers les paramètres d'URL.

   POURQUOI L'URL ET PAS UN CONTEXTE REACT.
   Le symptôme à corriger : poser cinq filtres, ouvrir une fiche, revenir —
   tout est perdu. La cause est structurelle, pas accidentelle : les 21
   filtres vivaient en `useState` avec des valeurs par défaut codées en dur,
   sur DEUX écrans jumeaux (web + mobile), et ouvrir une fiche démonte le
   composant. Un contexte React aurait survécu au démontage, mais pas au
   rechargement, pas au partage d'un lien, et pas au retour natif de la
   WebView. L'URL survit aux trois.

   UN SEUL filtre lisait déjà l'URL (`?nouveau=true`) et aucun n'y
   réécrivait. On garde SA clé telle quelle — des liens existants la portent.

   LES DÉFAUTS NE S'ÉCRIVENT JAMAIS DANS L'URL. Sans cette règle, la barre
   d'adresse porterait 21 paramètres dès le premier rendu, dont 20 inutiles.
   `encoderFiltres` omet toute valeur égale au défaut ; `decoderFiltres`
   remet le défaut pour toute clé absente. Les deux sens sont donc
   symétriques, et une URL nue vaut « aucun filtre ».

   CE QUI N'EST PAS ICI, ET POURQUOI.
   `viewMode` (grille/liste) et `showAdvanced` / `showFilters` sont des
   PRÉFÉRENCES D'AFFICHAGE, pas des filtres : elles ne changent pas le jeu de
   résultats, et les porter dans l'URL polluerait tout lien partagé avec le
   goût de celui qui l'a copié. Elles vivent en localStorage —
   voir `usePreferenceLocale`.
   `progFilterOpen` est un état d'ouverture de tiroir : transitoire, jamais
   persisté nulle part.
═══════════════════════════════════════════════════════════════ */

export interface FiltresRecherche {
  /* Texte libre. Gelé côté serveur pour un recruteur free — le serveur
     neutralise `p_search` quoi qu'il arrive, ce n'est donc pas une règle de
     confidentialité portée ici. */
  search: string;
  sport: string;
  /** Genre d'ÉQUIPE (teams.gender), PAS athletes.genre. */
  genderFilter: string;
  position: string;
  region: string;
  promotion: string;
  orgType: string;
  minGpa: string;
  minRating: string;
  sortBy: string;
  verifiedOnly: boolean;
  withVideoOnly: boolean;
  withSportBadge: boolean;
  withAcademicBadge: boolean;
  hideFavorites: boolean;
  filterOuvertDemenager: boolean;
  filterOuvertPrive: boolean;
  filterOuvertAnglophone: boolean;
  offertParMonCegep: boolean;
  filterNewOnly: boolean;
  /** Libellés de programmes CÉGEP. La conversion libellé → programme se fait
   *  chez l'appelant, via le catalogue — pas ici. */
  progFilterIds: string[];
}

export const FILTRES_DEFAUT: FiltresRecherche = Object.freeze({
  search: "",
  sport: "",
  genderFilter: "",
  position: "",
  region: "",
  promotion: "",
  orgType: "",
  minGpa: "",
  minRating: "",
  sortBy: "rating_desc",
  verifiedOnly: false,
  withVideoOnly: false,
  withSportBadge: false,
  withAcademicBadge: false,
  hideFavorites: false,
  filterOuvertDemenager: false,
  filterOuvertPrive: false,
  filterOuvertAnglophone: false,
  offertParMonCegep: false,
  filterNewOnly: false,
  progFilterIds: [],
});

/* Clés d'URL — COURTES ET STABLES.
   Elles font partie du contrat public de tout lien partagé : les renommer
   casse les liens déjà copiés. `nouveau` conserve son nom d'origine pour
   cette raison précise. */
const CLES: Record<keyof FiltresRecherche, string> = {
  search: "q",
  sport: "sport",
  genderFilter: "genre",
  position: "pos",
  region: "region",
  promotion: "promo",
  orgType: "org",
  minGpa: "gpa",
  minRating: "note",
  sortBy: "tri",
  verifiedOnly: "verifie",
  withVideoOnly: "video",
  withSportBadge: "badge_sport",
  withAcademicBadge: "badge_aca",
  hideFavorites: "sans_favoris",
  filterOuvertDemenager: "demenager",
  filterOuvertPrive: "prive",
  filterOuvertAnglophone: "anglo",
  offertParMonCegep: "mon_cegep",
  filterNewOnly: "nouveau",
  progFilterIds: "prog",
};

/** Lecture seule, pour les tests et pour tout appelant qui doit fabriquer un
 *  lien à la main sans redéclarer les noms. */
export const CLES_FILTRES: Readonly<Record<keyof FiltresRecherche, string>> =
  Object.freeze({ ...CLES });

type SourceParams = Pick<URLSearchParams, "get"> | null | undefined;

/**
 * URL → filtres. Toute clé absente, vide ou illisible retombe sur son défaut :
 * une URL trafiquée à la main ne doit jamais produire un état incohérent, elle
 * doit produire « pas de filtre ».
 */
export function decoderFiltres(params: SourceParams): FiltresRecherche {
  if (!params) return { ...FILTRES_DEFAUT };
  const lire = (cle: string) => params.get(cle);

  const texte = (k: keyof FiltresRecherche): string =>
    lire(CLES[k]) ?? (FILTRES_DEFAUT[k] as string);

  /* Un booléen n'est VRAI que sur la chaîne exacte "true". Accepter "1" ou
     "on" élargirait la surface sans besoin, et `?verifie=` (vide) doit valoir
     faux, pas vrai. */
  const bool = (k: keyof FiltresRecherche): boolean =>
    lire(CLES[k]) === "true";

  return {
    search: texte("search"),
    sport: texte("sport"),
    genderFilter: texte("genderFilter"),
    position: texte("position"),
    region: texte("region"),
    promotion: texte("promotion"),
    orgType: texte("orgType"),
    minGpa: texte("minGpa"),
    minRating: texte("minRating"),
    sortBy: texte("sortBy"),
    verifiedOnly: bool("verifiedOnly"),
    withVideoOnly: bool("withVideoOnly"),
    withSportBadge: bool("withSportBadge"),
    withAcademicBadge: bool("withAcademicBadge"),
    hideFavorites: bool("hideFavorites"),
    filterOuvertDemenager: bool("filterOuvertDemenager"),
    filterOuvertPrive: bool("filterOuvertPrive"),
    filterOuvertAnglophone: bool("filterOuvertAnglophone"),
    offertParMonCegep: bool("offertParMonCegep"),
    filterNewOnly: bool("filterNewOnly"),
    /* Liste séparée par des virgules. On filtre les segments vides : "a,,b"
       et "a,b," ne doivent pas produire d'identifiant vide, qui ne
       correspondrait à rien au catalogue et fausserait le compteur de
       filtres actifs. */
    progFilterIds: (lire(CLES.progFilterIds) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * Filtres → chaîne de requête, DÉFAUTS OMIS.
 *
 * Rend la chaîne sans `?` (vide si aucun filtre actif), pour être concaténée
 * telle quelle par l'appelant.
 */
export function encoderFiltres(f: FiltresRecherche): string {
  const p = new URLSearchParams();

  const poserTexte = (k: keyof FiltresRecherche) => {
    const v = f[k] as string;
    if (v && v !== (FILTRES_DEFAUT[k] as string)) p.set(CLES[k], v);
  };
  const poserBool = (k: keyof FiltresRecherche) => {
    if (f[k] as boolean) p.set(CLES[k], "true");
  };

  poserTexte("search");
  poserTexte("sport");
  poserTexte("genderFilter");
  poserTexte("position");
  poserTexte("region");
  poserTexte("promotion");
  poserTexte("orgType");
  poserTexte("minGpa");
  poserTexte("minRating");
  poserTexte("sortBy");

  poserBool("verifiedOnly");
  poserBool("withVideoOnly");
  poserBool("withSportBadge");
  poserBool("withAcademicBadge");
  poserBool("hideFavorites");
  poserBool("filterOuvertDemenager");
  poserBool("filterOuvertPrive");
  poserBool("filterOuvertAnglophone");
  poserBool("offertParMonCegep");
  poserBool("filterNewOnly");

  if (f.progFilterIds.length) p.set(CLES.progFilterIds, f.progFilterIds.join(","));

  return p.toString();
}

/**
 * Combien de filtres sont actifs — pour la pastille « N » du bouton Filtres.
 * `sortBy` en est EXCLU : un tri est toujours posé (jamais vide), le compter
 * afficherait « 1 » en permanence sur une recherche vierge.
 */
export function compterFiltresActifs(f: FiltresRecherche): number {
  let n = 0;
  for (const k of Object.keys(FILTRES_DEFAUT) as (keyof FiltresRecherche)[]) {
    if (k === "sortBy") continue;
    const v = f[k];
    const d = FILTRES_DEFAUT[k];
    if (Array.isArray(v)) { if (v.length) n++; continue; }
    if (v !== d) n++;
  }
  return n;
}
