/* ═══════════════════════════════════════════════════════════════
   /ma-story — taxonomie sport → positions, et catalogue des badges.

   DONNÉES LOCALES, ZÉRO RÉSEAU. La page est 100 % client et le reste :
   rien ici n'est lu en base, rien n'en sort. C'est une table figée,
   volontairement, et c'est elle que le futur mode connecté remplacera
   par le vrai profil de l'athlète (sports.nom, positions.nom, et les
   badges réellement attribués sur sa fiche). D'ici là elle vit seule.

   POURQUOI UN FICHIER VOISIN. MaStoryClient.tsx porte déjà le pipeline
   canvas et les dix gabarits. Une table de données de 250 lignes au
   milieu ne se relit pas — et elle va grossir, sport par sport, bien
   après que le rendu se sera stabilisé.

   RÈGLES D'ÉCRITURE
   · Libellés en français québécois, abréviations standard (QB, WR, PG).
   · Les noms de sport doivent correspondre EXACTEMENT à `sports.nom` en
     base : c'est par ce nom que BADGE_SPORTS rattache les badges, et
     c'est par lui que le futur mode connecté fera la jointure. « Flag
     football » et non « Flag-football ».
═══════════════════════════════════════════════════════════════ */

/** Valeur sentinelle du choix « Autre » — dans le sélecteur de sport
 *  comme dans celui de position. Elle révèle un champ texte libre et
 *  n'est jamais peinte telle quelle. */
export const AUTRE = "__autre__";

/** `[abréviation, libellé]`. Le libellé est ce que le canvas peint ;
 *  l'abréviation ne sert qu'à situer l'option dans la liste. */
export type PositionDef = [string, string];

export type SportDef = {
  /** Ce que le canvas peint, la valeur de l'option, et la clé de
   *  rattachement des badges. Doit égaler `sports.nom` en base. */
  nom: string;
  positions: PositionDef[];
};

/* Baseball et softball partagent leurs positions — même jeu, deux
   fédérations. Nommé une fois, référencé deux fois : les faire diverger
   par copier-coller serait la première dette de cette table. */
const POS_BALLE: PositionDef[] = [
  ["L", "Lanceur"],
  ["R", "Receveur"],
  ["1B", "Premier but"],
  ["2B", "Deuxième but"],
  ["3B", "Troisième but"],
  ["AC", "Arrêt-court"],
  ["CH", "Champ extérieur"],
];

export const SPORT_TAXONOMY: SportDef[] = [
  {
    nom: "Football",
    positions: [
      ["QB", "Quart-arrière"],
      ["RB", "Porteur de ballon"],
      ["WR", "Receveur"],
      ["TE", "Ailier rapproché"],
      ["OL", "Ligne offensive"],
      ["DL", "Ligne défensive"],
      ["LB", "Secondeur"],
      ["DB", "Demi défensif"],
      ["K", "Botteur"],
    ],
  },
  /* Flag football n'était pas dans la v2.1. Il entre parce que la table
     de liaison badge_sports lui rattache six badges : sans lui, ces six
     badges n'auraient été proposables à personne. */
  {
    nom: "Flag football",
    positions: [
      ["QB", "Quart-arrière"],
      ["C", "Centre"],
      ["WR", "Receveur"],
      ["RUSH", "Rusher"],
      ["DB", "Demi défensif"],
    ],
  },
  {
    nom: "Basketball",
    positions: [
      ["PG", "Meneur"],
      ["SG", "Arrière"],
      ["SF", "Ailier"],
      ["PF", "Ailier fort"],
      ["C", "Centre"],
    ],
  },
  {
    nom: "Soccer",
    positions: [
      ["G", "Gardien"],
      ["DÉF", "Défenseur"],
      ["MIL", "Milieu"],
      ["ATT", "Attaquant"],
    ],
  },
  {
    nom: "Hockey",
    positions: [
      ["G", "Gardien"],
      ["D", "Défenseur"],
      ["C", "Centre"],
      ["AD", "Ailier droit"],
      ["AG", "Ailier gauche"],
    ],
  },
  {
    nom: "Volleyball",
    positions: [
      ["PAS", "Passeur"],
      ["ATT", "Attaquant"],
      ["CTR", "Central"],
      ["PP", "Pointu"],
      ["LIB", "Libéro"],
    ],
  },
  { nom: "Baseball", positions: POS_BALLE },
  { nom: "Softball", positions: POS_BALLE },
  {
    nom: "Rugby",
    positions: [
      ["PIL", "Pilier"],
      ["TAL", "Talonneur"],
      ["2L", "Deuxième ligne"],
      ["3L", "Troisième ligne"],
      ["DM", "Demi de mêlée"],
      ["DO", "Demi d'ouverture"],
      ["CTR", "Centre"],
      ["AIL", "Ailier"],
      ["AR", "Arrière"],
    ],
  },
  {
    nom: "Athlétisme",
    positions: [
      ["SPR", "Sprint"],
      ["DF", "Demi-fond"],
      ["FD", "Fond"],
      ["HAI", "Haies"],
      ["SAU", "Sauts"],
      ["LAN", "Lancers"],
      ["COM", "Épreuves combinées"],
    ],
  },
  {
    nom: "Natation",
    positions: [
      ["LIB", "Style libre"],
      ["DOS", "Dos"],
      ["BRA", "Brasse"],
      ["PAP", "Papillon"],
      ["QN", "Quatre nages"],
    ],
  },
  {
    nom: "Cheerleading",
    positions: [
      ["BAS", "Base"],
      ["VOL", "Voltige"],
      ["ARR", "Arrière"],
      ["GYM", "Gymnaste"],
    ],
  },
];

/** Le sport choisi, ou `undefined` si le champ est vide ou sur
 *  « Autre » — les deux cas où position et badges de sport retombent au
 *  plus petit dénominateur. */
export function sportDef(nom: string): SportDef | undefined {
  return SPORT_TAXONOMY.find((s) => s.nom === nom);
}

/* ═══ LE CATALOGUE DES 22 BADGES ═════════════════════════════════════════
   LES MÊMES QUE L'APPLICATION. La géométrie est celle de
   public/badges/ ; la story lit public/story-badges/, qui en est GÉNÉRÉ
   (contre-formes percées — voir badgeSvg plus bas). Aucun dessin à la
   main, aucun export manuel : une divergence de DESSIN entre la story et
   la fiche serait pire qu'une ressemblance.

   ── POURQUOI CETTE TABLE EST RECOPIÉE ICI ────────────────────────────
   La vérité vit en base (`public.badges` + `public.badge_sports`), lue
   par lib/config/badgeCatalogue.ts. `/ma-story` ne peut pas s'en servir :
   elle est zéro-réseau par contrat, et une requête Supabase au montage
   casserait la seule promesse que la page fait à l'athlète — rien ne
   sort de l'appareil.

   Les valeurs ci-dessous sont recopiées des migrations, pas devinées :
     libellés   → 20260825134921_badges_libelles_du_catalogue_final.sql
     familles   → 20260825014323_badges_seed_22.sql
     sports     → 20260825130731_badges_sports_table_de_liaison.sql
   Elles-mêmes alignées sur badges-catalogue-final.json, qui fait foi.

   ── LA DETTE, NOMMÉE ─────────────────────────────────────────────────
   Deux sources pour une même question : si la base change (libellé
   renommé, badge ajouté, rattachement de sport étendu), CETTE TABLE NE
   LE SAURA PAS. Elle ne se plaindra pas non plus — elle affichera
   simplement l'ancien libellé. Au prochain chantier badges, la revérifier
   contre les migrations. Le jour où /ma-story lira le vrai profil de
   l'athlète connecté, elle disparaît.

   ── LE CONTEXTE : CE QU'ELLE PORTE, ET CE QU'ELLE N'EXIGE PAS ────────
   Cette table a longtemps refusé tout contexte hors « Custom », au motif
   qu'il donnerait à une déclaration la PRÉCISION d'un dossier. v2.3.2
   revient sur la moitié de ce raisonnement, et il faut dire laquelle.

   CE QUI NE CHANGE PAS : `requiert_contexte`. En base, les cinq honneurs
   EXIGENT leur contexte — un `MVP` sans millésime ne s'enregistre pas
   (trigger badge_contexte_requis). La story ne l'exige PAS et ne
   l'exigera pas : elle ne peut rien vérifier, refuser une story pour un
   millésime manquant serait une rigueur de façade. Le champ est
   OPTIONNEL ici, vide ne peint rien (ÉCART 3).

   CE QUI CHANGE : `contexte_forme`. Dans l'application, un honneur PORTE
   son contexte — « MVP — Saison 2025 », « Leader de la ligue — 1 245
   verges » (getBadgeLabel dans DistinctionBadge.tsx, `${libelle} —
   ${detail}`). La story peignait le libellé nu. C'était un écart de
   CONTENU avec la fiche, pas une garantie de plus : le millésime ne rend
   pas la déclaration vérifiée, il la rend juste lisible. La forme est
   donc recopiée de la base — voir `contexteForme` plus bas — et elle
   sert exactement à ce qu'elle sert côté fiche : choisir le placeholder,
   jamais un `if` sur un code.

   `nexus-x` (« Custom ») reste à part, et pour la même raison qu'avant :
   son contexte n'est pas un millésime, c'est le NOM de la distinction —
   sans lui le badge ne dit rien, ni ici ni sur la fiche, qui peint elle
   aussi ce texte SEUL à la place du libellé du catalogue. Les quatre
   autres honneurs ajoutent une ligne SOUS leur libellé ; Custom
   REMPLACE le sien. Voir l'ÉCART 4 de MaStoryClient.tsx.

   Une seule borne pour les deux : MAX_CONTEXTE.
════════════════════════════════════════════════════════════════════════ */

export type BadgeFamille = "universel" | "sport" | "honneur";

/** Les trois formes de contexte du catalogue. Recopiées telles quelles de
 *  `public.badges.contexte_forme` (migration
 *  20260825144302_badges_contexte_forme_et_suggestions_vers_athlete_badges),
 *  et du type `ContexteForme` de lib/config/badgeCatalogue.ts. */
export type ContexteForme = "stat_annee" | "annee" | "libre";

export type BadgeDef = {
  /** Code du catalogue. Nomme aussi le fichier : badge-{code}.svg. */
  code: string;
  libelle: string;
  famille: BadgeFamille;
  /** Vide pour `universel` et `honneur` : ils valent pour tous les
   *  sports. Rempli pour `sport`, par nom de sport. */
  sports: string[];
  /** La forme du contexte, quand le badge en porte un. `null` partout
   *  ailleurs — la base pose la même cohérence par contrainte
   *  (`badges_contexte_forme_coherente`).
   *
   *  C'est une DONNÉE, pas un `if` sur les codes : ajouter un honneur au
   *  catalogue ne doit rien recâbler dans le formulaire ni dans le rendu.
   *  Même règle que côté fiche. */
  contexteForme?: ContexteForme | null;
};

export const BADGES_CATALOGUE: BadgeDef[] = [
  // ── universels (5) : tous sports
  { code: "capitaine", libelle: "Leadership", famille: "universel", sports: [] },
  { code: "qi", libelle: "IQ", famille: "universel", sports: [] },
  { code: "clutch", libelle: "Clutch", famille: "universel", sports: [] },
  { code: "costaud", libelle: "Joueur physique", famille: "universel", sports: [] },
  { code: "disponibilite", libelle: "Disponibilité", famille: "universel", sports: [] },

  // ── sport (12) : 20 rattachements, 3 sports seulement
  { code: "finisseur", libelle: "Finisseur", famille: "sport", sports: ["Basketball"] },
  { code: "3-points", libelle: "3 points", famille: "sport", sports: ["Basketball"] },
  {
    code: "insaisissable",
    libelle: "Insaisissable",
    famille: "sport",
    sports: ["Basketball", "Football", "Flag football"],
  },
  {
    code: "verrou",
    libelle: "Défensive impeccable",
    famille: "sport",
    sports: ["Basketball", "Football"],
  },
  { code: "fusee", libelle: "Explosif", famille: "sport", sports: ["Football", "Flag football"] },
  {
    code: "dans-la-mire",
    libelle: "Précision extrême",
    famille: "sport",
    sports: ["Football", "Flag football"],
  },
  { code: "vitesse", libelle: "Vitesse", famille: "sport", sports: ["Football", "Flag football"] },
  {
    code: "mains-sures",
    libelle: "Mains sûres",
    famille: "sport",
    sports: ["Football", "Flag football"],
  },
  { code: "inarretable", libelle: "Inarrêtable", famille: "sport", sports: ["Football"] },
  { code: "force-de-frappe", libelle: "Force de frappe", famille: "sport", sports: ["Football"] },
  { code: "rempart", libelle: "Bloqueur", famille: "sport", sports: ["Football"] },
  {
    code: "radar",
    libelle: "Vision du jeu",
    famille: "sport",
    sports: ["Football", "Flag football"],
  },

  // ── honneurs (5) : tous sports, et les seuls à porter un contexte.
  //    Les formes viennent de la migration citée sur ContexteForme.
  { code: "mvp", libelle: "MVP", famille: "honneur", sports: [], contexteForme: "annee" },
  {
    code: "leader-equipe",
    libelle: "Leader d'équipe",
    famille: "honneur",
    sports: [],
    contexteForme: "stat_annee",
  },
  {
    code: "leader-ligue",
    libelle: "Leader de la ligue",
    famille: "honneur",
    sports: [],
    contexteForme: "stat_annee",
  },
  {
    code: "equipe-etoiles",
    libelle: "Équipe d'étoiles",
    famille: "honneur",
    sports: [],
    contexteForme: "annee",
  },
  { code: "nexus-x", libelle: "Custom", famille: "honneur", sports: [], contexteForme: "libre" },
];

/** Le badge « Custom » du catalogue — le seul dont le libellé peint n'est
 *  pas celui du catalogue mais un texte de l'athlète. Nommé plutôt que
 *  répété : la fiche a payé pour avoir laissé ce code en dur (voir le
 *  commentaire de getBadgeLabel dans DistinctionBadge.tsx). */
export const CODE_CUSTOM = "nexus-x";

/** Longueur d'un contexte de badge, EN CARACTÈRES. UNE seule borne pour
 *  les cinq honneurs — le libellé de Custom comme le millésime de MVP.
 *
 *  Reprise de la fiche : `MAX_DETAIL_LENGTH` de lib/config/badges.ts, la
 *  contrainte déclarée pour `athlete_badges.contexte`. Recopiée et non
 *  importée — ce fichier est la table locale de /ma-story, qui ne dépend
 *  de rien (voir l'en-tête). Revérifiée contre la fiche le 2026-09-15 au
 *  moment d'étendre le champ aux quatre autres honneurs : toujours 30,
 *  toujours une seule colonne `contexte`, donc rien à diviser en deux
 *  bornes. C'est la même dette que les libellés ci-dessus, et elle se
 *  résout le même jour, quand la page lira le vrai profil.
 *
 *  À SAVOIR : côté fiche, cette limite n'est PLUS APPLIQUÉE. Les quatre
 *  surfaces qui l'importaient sont passées à BadgePicker, dont le champ
 *  de contexte n'a pas de `maxLength`, et la colonne est un `text` sans
 *  borne. La story la respecte quand même — 30 caractères est ce que la
 *  composition peut peindre sous un badge héros sans le réduire à rien. */
export const MAX_CONTEXTE = 30;

/* Les MÊMES placeholders que le champ de contexte de la fiche
   (PLACEHOLDER_CONTEXTE dans lib/config/badgeCatalogue.ts). Deux champs
   pour une même donnée ne doivent pas suggérer deux formats : un coach qui
   écrit « Plaqués · 2026 » sur la fiche doit reconnaître le champ ici.

   Côté fiche, la forme n'est plus CONTRAINTE — trois champs là où une
   phrase suffit, un millésime borné qui refuse « 2025-26 ». Elle ne
   choisit que le placeholder. Ici non plus, et pour la même raison. */
export const PLACEHOLDER_CONTEXTE: Record<ContexteForme, string> = {
  stat_annee: "Ex. : 1 245 verges · 2026",
  annee: "Ex. : Saison 2026",
  libre: "Ex. : Joueur défensif de la ligue",
};

/** Le placeholder du champ de contexte, par forme. */
export function placeholderContexte(forme: ContexteForme | null | undefined): string {
  return PLACEHOLDER_CONTEXTE[forme ?? "libre"];
}

const BADGE_PAR_CODE = new Map(BADGES_CATALOGUE.map((b) => [b.code, b]));

export function badgeDef(code: string): BadgeDef | undefined {
  return BADGE_PAR_CODE.get(code);
}

/** L'URL same-origin du SVG d'un badge, VERSION STORY.
 *
 *  C'est le MÊME dessin que public/badges/, à une chose près : les
 *  contre-formes du glyphe — l'intérieur des anneaux d'une cible, le trou
 *  de serrure d'un cadenas, le champ d'un panneau STOP — y sont PERCÉES
 *  au lieu d'être peintes en `#131519`.
 *
 *  POURQUOI DEUX DOSSIERS. Ce sombre est invisible sur la fiche, dont le
 *  fond est charbon : la contre-forme s'y confond avec la page et lit
 *  comme un trou. Posé sur une photo, il devient un aplat noir au milieu
 *  du badge. Les percer côté fiche ferait apparaître le fond de la carte
 *  dans le glyphe — le défaut inverse. Un dossier par contexte, donc, et
 *  une seule GÉOMÉTRIE : public/story-badges/ est GÉNÉRÉ depuis
 *  public/badges/ par scripts/gen-story-badges.mjs, jamais dessiné à la
 *  main. Un badge qui change de dessin change toujours partout — il faut
 *  seulement relancer le script.
 *
 *  Le sélecteur du formulaire tire de CE dossier, lui aussi : la vignette
 *  qu'on touche doit être le badge qui sera peint. */
export function badgeSvg(code: string): string {
  return `/story-badges/badge-${code}.svg`;
}

/** Ordre d'affichage des sections du sélecteur. Les honneurs en dernier,
 *  comme dans l'application. */
export const ORDRE_FAMILLES: BadgeFamille[] = ["universel", "sport", "honneur"];

/* Les MÊMES titres que le sélecteur de la fiche (TITRE_SECTION dans
   lib/config/badgeCatalogue.ts). « Propres au sport » disait la même chose
   avec un autre mot : deux sélecteurs pour un même catalogue ne doivent
   pas nommer leurs sections différemment. */
export const TITRE_FAMILLE: Record<BadgeFamille, string> = {
  universel: "Universels",
  sport: "Spécifiques au sport",
  honneur: "Honneurs",
};

/**
 * Les badges proposables pour un sport donné.
 *
 * DÉGRADATION VOULUE, reprise telle quelle de `badgesPourSport()` côté
 * application : sport vide, « Autre », ou sport sans rattachement → les
 * universels et les honneurs SEULEMENT, jamais le catalogue entier. Sans
 * cette règle, un nageur se verrait proposer « Bloqueur ».
 *
 * Conséquence à connaître : seuls Football, Flag football et Basketball
 * ont des badges de sport en base. Pour les huit autres sports de la
 * table, la liste s'arrête aux dix universels + honneurs. C'est l'état
 * du catalogue, pas une lacune de ce fichier.
 */
export function badgesPourSport(nom: string): BadgeDef[] {
  return BADGES_CATALOGUE.filter(
    (b) => b.famille !== "sport" || (!!nom && b.sports.includes(nom)),
  );
}
