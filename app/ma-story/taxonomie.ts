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
   LES MÊMES QUE L'APPLICATION. Les fichiers sont ceux de public/badges/,
   dessinés au canvas depuis leur URL same-origin : aucun export, aucune
   copie, aucun actif dédié à la story. Une divergence de dessin entre la
   story et la fiche serait pire qu'une ressemblance.

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

   ── CE QU'ELLE NE PORTE PAS, DÉLIBÉRÉMENT ────────────────────────────
   `requiert_contexte`. Dans l'application, les cinq honneurs exigent un
   contexte (« MVP · 2026 ») parce qu'un honneur sans millésime ne veut
   rien dire dans un dossier. Sur une story, le badge est auto-déclaré et
   la ligne d'attribution renvoie au profil : ajouter un champ de
   contexte donnerait à la déclaration la PRÉCISION d'un dossier sans en
   avoir la valeur. Voir l'ÉCART 4 de MaStoryClient.tsx.
════════════════════════════════════════════════════════════════════════ */

export type BadgeFamille = "universel" | "sport" | "honneur";

export type BadgeDef = {
  /** Code du catalogue. Nomme aussi le fichier : badge-{code}.svg. */
  code: string;
  libelle: string;
  famille: BadgeFamille;
  /** Vide pour `universel` et `honneur` : ils valent pour tous les
   *  sports. Rempli pour `sport`, par nom de sport. */
  sports: string[];
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

  // ── honneurs (5) : tous sports
  { code: "mvp", libelle: "MVP", famille: "honneur", sports: [] },
  { code: "leader-equipe", libelle: "Leader d'équipe", famille: "honneur", sports: [] },
  { code: "leader-ligue", libelle: "Leader de la ligue", famille: "honneur", sports: [] },
  { code: "equipe-etoiles", libelle: "Équipe d'étoiles", famille: "honneur", sports: [] },
  { code: "nexus-x", libelle: "Custom", famille: "honneur", sports: [] },
];

const BADGE_PAR_CODE = new Map(BADGES_CATALOGUE.map((b) => [b.code, b]));

export function badgeDef(code: string): BadgeDef | undefined {
  return BADGE_PAR_CODE.get(code);
}

/** L'URL same-origin du SVG d'un badge. Même dossier que l'application :
 *  un badge qui change de dessin change partout à la fois. */
export function badgeSvg(code: string): string {
  return `/badges/badge-${code}.svg`;
}

/** Ordre d'affichage des sections du sélecteur. Les honneurs en dernier,
 *  comme dans l'application. */
export const ORDRE_FAMILLES: BadgeFamille[] = ["universel", "sport", "honneur"];

export const TITRE_FAMILLE: Record<BadgeFamille, string> = {
  universel: "Universels",
  sport: "Propres au sport",
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
