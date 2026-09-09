// Taxonomie d'équipe — ORGANISATION, LIGUE, DIVISION.
//
// Source unique des trois axes ajoutés aux moteurs de recherche d'athlètes
// (coach + directeur, recruteur, et un jour peut-être partenaire). Jumeau de
// `lib/config/gender.ts` : la donnée est PROJETÉE par le serveur, la
// normalisation et le filtrage vivent ici, côté lecture.
//
// ── LA NORMALISATION EST EN LECTURE, PAS EN BASE ─────────────────────────────
// Arbitrage BP du 2026-09-05. `teams.division` et `teams.league` sont du texte
// libre et le resteront : ces deux colonnes font partie de
// `teams_identity_unique (school_id, sport_id, name, age_group, division,
// gender, season, league)`. Réécrire « Division 1 » en « D1 » CHANGE L'IDENTITÉ
// d'une équipe et peut collisionner avec une ligne existante — sur 8 300
// équipes dont 7 943 pontées RSEQ, avec le re-run des scores de septembre en
// DO UPDATE. Nettoyer la base est donc un chantier de PONT RSEQ dédié, si
// jamais, et il est HORS SUJET pour les facettes. Ce module rend les facettes
// justes sans toucher à une seule ligne.
//
// ── CE QUE LES CHIFFRES RÉELS IMPOSENT (prod, 86 athlètes ACTIF) ─────────────
// Relevé le 2026-09-05 :
//   · 33 athlètes n'ont AUCUNE équipe          -> division inconnue (38 %)
//   · `teams.league` est vide sur 7 382 / 8 300 équipes (89 %)
//   · lecture naïve de teams.league  -> 61 athlètes « Non renseigné » (71 %)
//     après la règle RSEQ ci-dessous -> 35 athlètes « Non renseigné » (41 %)
// La règle RSEQ n'est pas un confort : elle est la différence entre une facette
// utilisable et une facette qui se trompe sur 26 athlètes.

import { taRows } from "@/lib/queries/shared/embeds";

/* ─────────────────────────────────────────────────────────────────────────────
   SENTINELLE « NON RENSEIGNÉ »

   Mêmes valeurs que `lib/pipeline/filterPipelineCards.ts` : « Non renseigné »
   est une VALEUR sélectionnable, jamais un trou. Un athlète sans équipe reste
   atteignable ; il ne disparaît pas d'une barre qui prétend tout montrer.
   ───────────────────────────────────────────────────────────────────────────── */

export const UNSET_VALUE = "__NON_RENSEIGNE__";
export const UNSET_LABEL = "Non renseigné";

/* ─────────────────────────────────────────────────────────────────────────────
   L'ENTRÉE — ce que chaque surface doit savoir fournir

   Volontairement PLAT et sans dépendance : ni type Supabase, ni type React.
   Le recruteur le remplit depuis les colonnes de la RPC, le coach depuis
   l'embed PostgREST `team_athletes(teams!team_id(...))`. Les deux passent par
   les mêmes règles — c'est tout l'intérêt d'avoir un seul module.
   ───────────────────────────────────────────────────────────────────────────── */

export type TaxonomySource = {
  /** `athletes.context` — 'scolaire' | 'ligue_civile' | null. */
  context: string | null;
  /** `schools.type` de l'école de l'athlète — 'SECONDAIRE' | 'CEGEP' | 'LIGUE_CIVILE'.
   *  null quand l'athlète n'a AUCUNE école rattachée. */
  schoolType: string | null;
  /** `teams.division` de l'équipe courante, brut. */
  teamDivision: string | null;
  /** `teams.league` de l'équipe courante, brut. */
  teamLeague: string | null;
  /** `teams.rseq_team_id IS NOT NULL` — l'équipe vient du pont RSEQ. */
  teamIsRseq: boolean;
  /** L'athlète est-il rattaché à UNE équipe ? Distinct de « son équipe n'a pas
   *  de ligue » : les trois champs ci-dessus valent `null`/`false` dans les DEUX
   *  cas, et le 4e repli de `leagueOf` a besoin de les séparer. Sans équipe,
   *  il n'y a pas de ligue à déduire — il y aurait une ligue à INVENTER. */
  hasTeam: boolean;
  /** `schools.type` de l'école de L'ÉQUIPE — pas celle de l'athlète.
   *  Les deux divergent déjà en prod (2 athlètes au 2026-09-07 : `school_id`
   *  nul côté athlète, équipe rattachée à un club civil). Utiliser
   *  `schoolType` comme approximation serait donc faux dès aujourd'hui. */
  teamSchoolType: string | null;
};

export type Organisation = "scolaire" | "ligue_civile";

/** Source « tout inconnu ». Repli explicite pour les fixtures mock, qui ne
 *  portent aucune taxonomie : elles se rangent alors en « Non renseigné »,
 *  ce qui est la vérité, plutôt que de faire planter un filtre. */
export const EMPTY_TAXONOMY: TaxonomySource = {
  context: null, schoolType: null,
  teamDivision: null, teamLeague: null, teamIsRseq: false,
  hasTeam: false, teamSchoolType: null,
};

/* ─────────────────────────────────────────────────────────────────────────────
   LECTURE D'UN EMBED PostgREST

   Jumeau exact de `firstTeamGender` dans `gender.ts`, et pour la même raison :
   la cardinalité de l'embed `athletes -> team_athletes` DÉPEND d'un détail de
   schéma (l'index UNIQUE (athlete_id)). Objet aujourd'hui, tableau si l'ancrage
   unique saute un jour. On passe donc par `taRows()`, qui absorbe les trois
   formes — et le jour où la cardinalité rebascule, rien ne bouge ici.

   Forme attendue côté `.select()` :
     context,
     schools!school_id(type),
     team_athletes(teams!team_id(division, league, rseq_team_id,
                                 schools!school_id(type)))
   ───────────────────────────────────────────────────────────────────────────── */

const asRecord = (v: unknown): Record<string, unknown> | null => {
  const one = Array.isArray(v) ? v[0] : v;
  return one && typeof one === "object" ? (one as Record<string, unknown>) : null;
};

const asText = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function taxonomyFromAthleteRow(row: Record<string, unknown>): TaxonomySource {
  const school = asRecord(row.schools);
  const team = asRecord(asRecord(taRows(row.team_athletes)[0])?.teams);
  const teamSchool = asRecord(team?.schools);

  return {
    context: asText(row.context),
    schoolType: asText(school?.type),
    teamDivision: asText(team?.division),
    teamLeague: asText(team?.league),
    // `rseq_team_id` non nul = équipe venue du pont. Un `undefined` (colonne
    // absente du select) vaut « pas pontée » : on ne DEVINE pas une origine.
    teamIsRseq: team?.rseq_team_id != null,
    hasTeam: team !== null,
    teamSchoolType: asText(teamSchool?.type),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   LECTURE D'UNE LIGNE DE `recruiter_search_athletes`

   Le recruteur ne lit pas un embed mais des colonnes PLATES, projetees par la
   RPC (migration 20260908015840). Meme contrat, autre forme :

     context, school_type,
     team_division, team_league, team_is_rseq, team_school_type

   `teams.school_id` etant NOT NULL, `team_school_type` non nul vaut « cet
   athlete a une equipe » — c'est ainsi que `hasTeam` se deduit ici, alors que
   le coach lit la presence de la ligne d'embed. Les deux surfaces produisent
   la MEME TaxonomySource, donc les memes reponses.
   ───────────────────────────────────────────────────────────────────────────── */

/** Les seules colonnes de `recruiter_search_athletes` qui nous concernent.
 *  Structurel et non `Record<string, unknown>` : `RpcSearchRow` est une
 *  `interface`, et TypeScript n'accorde d'index signature implicite qu'aux
 *  alias de type — un Record aurait force un cast au point d'appel. */
export type SearchRowTaxonomy = {
  context: string | null;
  school_type: string | null;
  team_division: string | null;
  team_league: string | null;
  team_is_rseq: boolean | null;
  team_school_type: string | null;
};

export function taxonomyFromSearchRow(row: SearchRowTaxonomy): TaxonomySource {
  const teamSchoolType = asText(row.team_school_type);
  return {
    context: asText(row.context),
    schoolType: asText(row.school_type),
    teamDivision: asText(row.team_division),
    teamLeague: asText(row.team_league),
    teamIsRseq: row.team_is_rseq === true,
    hasTeam: teamSchoolType !== null,
    teamSchoolType,
  };
}

export const ORGANISATION_LABELS: Record<Organisation, string> = {
  scolaire: "Scolaire",
  ligue_civile: "Ligue civile",
};

/* ─────────────────────────────────────────────────────────────────────────────
   AXE 1 — ORGANISATION

   ⚠ POURQUOI CETTE DÉFINITION-LÀ, ET PAS UNE DES QUATRE AUTRES.

   L'app portait CINQ définitions du même axe (diagnostic du 2026-09-05) :
     1. `athletes.context`                                      — déclaration
     2. `partner_athlete_profile.is_civil` : school_id IS NULL OR type=CIVILE
     3. recherche partenaire : school_id IS NULL, seul
     4. `useAthleteSearch:340` : !school_id -> undefined, sinon type
     5. `teams.league` / présence de `rseq_team_id`

   Arbitrage BP : la déclaration de l'athlète d'abord, repli sur le type
   d'école. Vérifié en prod : 1 et 2 ne se contredisent JAMAIS là où 1 est
   renseignée (47/47 scolaire, 21/21 civil) — le repli n'invente donc rien,
   il ne fait que compléter.

   ── L'ORDRE DES REPLIS ───────────────────────────────────────────────────────
       contexte déclaré
         >  type d'école de L'ATHLÈTE
         >  ligue d'équipe NOMMÉE (jamais RSEQ)
         >  type d'école de L'ÉQUIPE, côté civil seulement
         >  null  (« Non renseigné »)
   Du plus intentionnel au plus circonstanciel. On ne descend d'un cran que
   lorsque le cran du dessus est muet. Et sans équipe, on s'arrête au 2e cran :
   les deux derniers replis lisent l'ÉQUIPE, il n'y a rien à lire.

   ⚠ LE TROISIÈME REPLI NE LIT QUE LES LIGUES CIVILES NOMMÉES (arbitrage BP du
   2026-09-06). Une donnée qu'on POSSÈDE ne doit pas s'afficher « Non
   renseigné » : un athlète sans contexte ni école, mais dont l'équipe joue en
   LFMM, est en ligue civile — l'information est là, il suffit de la lire.
   La réciproque est INTERDITE ici : `RSEQ` n'implique PAS « scolaire » par ce
   chemin. RSEQ arrive aussi bien du texte tapé à la main que de la clé du
   pont, et déduire une organisation d'une ligue qu'on a soi-même déduite
   empilerait deux inférences. Tant que ce n'est pas arbitré séparément, un
   athlète RSEQ sans contexte ni école reste « Non renseigné ».

   ⚠ ET SURTOUT : « PAS D'ÉCOLE » N'EST PAS « LIGUE CIVILE ».
   Les définitions 2 et 3 déclarent civil tout athlète sans `school_id`. Sur les
   18 athlètes à `context` NULL, cela en range 7 en « civil » alors qu'on sait
   seulement qu'ils n'ont rien rempli. Ici, l'absence de TOUS les signaux rend
   `null` -> « Non renseigné ». Une facette qui affirme « ligue civile » sur la
   foi d'un champ vide ment à l'utilisateur, et le mensonge est invisible.
   ───────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────────
   LA GARDE D'ENTRÉE — une source absente n'est pas une erreur

   Les cinq fonctions publiques qui lisent une `TaxonomySource` acceptent
   `null` / `undefined` et rendent `null` (« Non renseigné »). Elles ne lèvent
   JAMAIS.

   Pourquoi ce n'est pas de la paranoïa : une donnée incomplète est l'état
   NORMAL du parc — 43 des 54 athlètes en équipe n'ont aucun ancrage résoluble,
   et les auto-inscrits partiels arrivent tous les jours. Une taxonomie qui
   plante sur une source vide fait tomber la page de recherche entière pour
   une ligne mal remplie ; elle doit dégrader, pas casser.

   La source peut aussi manquer sans que personne n'ait mal rempli quoi que ce
   soit : le cache TanStack est persisté en sessionStorage (`nx-rq-cache`,
   30 min), et une charge mise en cache AVANT que `SearchAthleteRow` ne porte
   `taxonomy` se réhydrate dans du code qui l'attend. Le champ vaut alors
   `undefined` sur TOUTES les lignes — pas sur un athlète, sur la page.
   Le type ne protège de rien ici : il décrit ce que le code écrit
   aujourd'hui, pas ce que le stockage rend.
   ───────────────────────────────────────────────────────────────────────────── */

/** Source utilisable ? Sert de garde d'entrée aux fonctions publiques. */
type MaybeSource = TaxonomySource | null | undefined;

export function organisationOf(src: MaybeSource): Organisation | null {
  if (!src) return null;

  // 1. La déclaration de l'athlète.
  const ctx = (src.context ?? "").trim().toLowerCase();
  if (ctx === "ligue_civile") return "ligue_civile";
  if (ctx === "scolaire") return "scolaire";

  // 2. Le type de son école.
  const type = (src.schoolType ?? "").trim().toUpperCase();
  if (type === "LIGUE_CIVILE") return "ligue_civile";
  if (type) return "scolaire"; // SECONDAIRE | CEGEP — et tout type scolaire à venir

  // 3. La ligue NOMMÉE de son équipe — jamais RSEQ, voir l'encadré ci-dessus.
  const league = leagueOf(src);
  if (league !== null && league !== RSEQ) return "ligue_civile";

  // 4. Le type d'école de son ÉQUIPE, côté CIVIL seulement (arbitrage BP du
  //    2026-09-07). Symétrique du 3e repli de `leagueOf` : même source, même
  //    principe — une donnée qu'on possède ne s'affiche pas « Non renseigné ».
  //    L'athlète joue pour un club civil ; c'est un FAIT lu dans schools.type,
  //    pas une inference sur une inference.
  //
  //    ⚠ RIEN DE SYMÉTRIQUE CÔTÉ SCOLAIRE ICI. Une équipe SECONDAIRE/CEGEP ne
  //    rend PAS « scolaire » : ce n'était pas dans l'arbitrage, et la
  //    prudence sur ce côté-là est deliberee depuis le debut du chantier.
  //    Consequence assumee : un athlete sans contexte ni ecole dont l'equipe
  //    est scolaire lit « RSEQ » en Ligue et « Non renseigne » en
  //    Organisation. A rouvrir si le cas se presente en vrai — il n'existe
  //    pas en prod aujourd'hui.
  if (src.hasTeam && (src.teamSchoolType ?? "").trim().toUpperCase() === "LIGUE_CIVILE") {
    return "ligue_civile";
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   AXE 2 — LIGUE

   LA RÈGLE QUI RATTRAPE 26 ATHLÈTES : une équipe importée du pont RSEQ porte
   `league` VIDE — sa nature RSEQ vit dans `rseq_team_id`, pas dans le texte.
   Une équipe créée dans Nexus porte « RSEQ » parce qu'un humain l'a tapé.
   Sans cette règle, 26 athlètes RSEQ tombent dans « Non renseigné » à côté de
   15 autres rangés dans « RSEQ » — la même ligue, coupée en deux, en silence.

   Elle absorbe aussi les 256 descripteurs longs du pont
   (« Volleyball C F D2 Nord-Est QCA-EDQ (2026-2027) ») : tous portent un
   `rseq_team_id`, vérifié en prod — 256/256. On ne parse donc AUCUNE chaîne
   pour les reconnaître, on lit la clé du pont. Un parseur de libellé serait
   faux dès que le RSEQ change sa nomenclature ; la clé, non.
   ───────────────────────────────────────────────────────────────────────────── */

/** Nom de ligue RSEQ, unique et canonique, quel que soit le libellé d'origine. */
export const RSEQ = "RSEQ";

/** Réduit un `teams.league` brut à un nom lisible : espaces normalisés, vide -> null.
 *  N'INVENTE AUCUNE MAJUSCULE : « Senior » ne doit pas devenir « SENIOR ». Les
 *  différences de CASSE sont réglées au niveau des options (voir `leagueOptions`),
 *  pas ici — regrouper est réversible, réécrire ne l'est pas. */
export function normalizeLeague(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().replace(/\s+/g, " ");
  return clean === "" ? null : clean;
}

/** Types d'école SCOLAIRES. `LIGUE_CIVILE` habite la même table `schools` —
 *  un club civil n'est pas une école, il n'en emprunte que la plomberie. */
const SCHOOL_TYPES = new Set(["SECONDAIRE", "CEGEP"]);

/** Ligue d'un athlète, ou null quand elle est inconnue.
 *
 *  L'ORDRE DES REPLIS :
 *    1. clé du pont (`rseq_team_id`)      -> RSEQ
 *    2. ligue saisie                      -> « RSEQ » si elle commence par RSEQ,
 *                                            sinon son nom
 *    3. équipe d'ÉCOLE sans ligue saisie  -> RSEQ   (voir l'encadré ci-dessous)
 *    4. rien de tout ça                   -> null   (« Non renseigné »)
 *
 *  ⚠ LE 3e REPLI SE JUGE SUR L'ÉQUIPE, JAMAIS SUR L'ATHLÈTE (arbitrage BP du
 *  2026-09-07). La formulation « organisation scolaire => ligue RSEQ » a été
 *  REJETÉE : elle aurait écrit « RSEQ » sur les 15 athlètes ACTIF qui n'ont
 *  AUCUNE équipe. Sans équipe il n'y a pas de ligue à déduire, il y en a une à
 *  INVENTER — ce n'est pas le même geste. D'où `hasTeam`.
 *
 *  Sûreté mesurée en prod le 2026-09-07, sur les 8 182 équipes rattachées à une
 *  école SECONDAIRE ou CEGEP :
 *      7 506 pontées RSEQ (clé) · 158 « RSEQ » tapé · 518 ligue VIDE
 *      0  ligue nommée qui ne soit PAS RSEQ   <- aucun contre-exemple
 *  Aucune école du parc ne joue dans une ligue nommée hors RSEQ. Le repli
 *  déplace 2 athlètes aujourd'hui, et 518 équipes d'école attendent d'en
 *  recevoir.
 *
 *  ⚠ L'INTERDICTION SYMÉTRIQUE TIENT : RSEQ n'implique toujours PAS
 *  « scolaire » dans `organisationOf`. Déduire ici une ligue d'un type d'école
 *  est sûr (0 contre-exemple) ; déduire là-bas une organisation d'une ligue
 *  qu'on vient soi-même de déduire empilerait deux inférences. */
export function leagueOf(src: MaybeSource): string | null {
  if (!src) return null;
  if (src.teamIsRseq) return RSEQ;

  const name = normalizeLeague(src.teamLeague);
  if (name !== null) {
    // Saisi à la main : « RSEQ », « RSEQ — Sud-Ouest », « Rseq »… Toutes ces
    // variantes désignent la même ligue ; le second niveau du filtre ne montre
    // que la FAMILLE, pas la déclinaison régionale.
    return /^rseq\b/i.test(name) ? RSEQ : name;
  }

  // Une équipe d'école sans ligue saisie joue en RSEQ — c'est le seul réseau
  // scolaire du parc. Un club civil, lui, garde son « Non renseigné » : là, la
  // ligue manquante est une VRAIE inconnue.
  if (src.hasTeam && SCHOOL_TYPES.has((src.teamSchoolType ?? "").trim().toUpperCase())) {
    return RSEQ;
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   AXE 3 — DIVISION

   DEUX VOCABULAIRES, ASSUMÉS (arbitrage BP). Le scolaire dit D1..D4 et range
   l'âge à part dans `age_group`. Le civil FUSIONNE âge et division dans la même
   chaîne : « Midget — Division 1 », « Pee-Wee AAA — Division 1 Sud ». Il n'y a
   pas d'échelle commune, et en fabriquer une serait une équivalence inventée.

   La normalisation se limite donc à ce qui est INDISCUTABLEMENT le même
   libellé écrit deux fois : « Division 1 » et « D1 ». Le reste passe tel quel,
   espaces normalisés. La facette montre les valeurs RÉELLEMENT présentes dans
   les cartes, jamais une liste théorique fusionnée.
   ───────────────────────────────────────────────────────────────────────────── */

/** Ramène un `teams.division` brut à sa forme canonique.
 *  « D1 » | « d1 » | « Division 1 » | « division  1 » -> « D1 ».
 *  Tout le reste : trimé, espaces normalisés, INCHANGÉ. */
export function normalizeDivision(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().replace(/\s+/g, " ");
  if (clean === "") return null; // `''` ET `NULL` sont le même trou côté écran

  const m = /^(?:d|division)\s*([1-9])$/i.exec(clean);
  return m ? `D${m[1]}` : clean;
}

/** Division d'un athlète, ou null quand elle est inconnue. */
export function divisionOf(src: MaybeSource): string | null {
  if (!src) return null;
  return normalizeDivision(src.teamDivision);
}

/* ─────────────────────────────────────────────────────────────────────────────
   LES OPTIONS DES FILTRES

   Construites depuis les cartes RÉELLES, jamais en dur. Deux conséquences que
   le 2b a payées cher pour apprendre :
     · « Non renseigné » n'apparaît QUE si au moins une carte est sans valeur —
       mais avec 38 % (division) et 41 % (ligue) de vides, elle sera là presque
       toujours, et c'est très bien : elle rend le trou VISIBLE et cliquable ;
     · la somme des options couvre toujours 100 % des cartes, donc le compteur
       « X sur N » se vérifie à l'oeil.
   ───────────────────────────────────────────────────────────────────────────── */

export type TaxonomyOption = { value: string; label: string; count: number };

/* ─────────────────────────────────────────────────────────────────────────────
   DANS QUEL ÉTAT AFFICHER CE MENU ?  (corrigé le 2026-09-08)

   Le menu est TOUJOURS AFFICHÉ, à une position stable. Ce qui varie, c'est ce
   qu'il raconte — trois états :

     · « active »    ≥ 2 options. Menu normal, « Toutes les X » par défaut.
     · « prefilled » 1 seule option, NOMMÉE. Menu désactivé affichant cette
                     valeur (« RSEQ », « D3 ») au lieu de « Toutes les X ».
     · « empty »     aucune option, ou la seule est « Non renseigné ».

   ⚠ LE PRÉ-REMPLI N'EST LÉGITIME QUE SI LA VALEUR UNIQUE COUVRE 100 % DES
   LIGNES. C'est la correction du 2026-09-08, et elle vient d'un vrai bug vu à
   l'écran : avec « Ligue civile » coché, le menu Ligue affichait « LFMM »
   grisé alors que la population était LFMM 10 **+ Non renseigné 17**. Le
   libellé mentait — il présentait une ligue comme le monde entier — et
   surtout, 17 athlètes devenaient INFILTRABLES : le menu grisé retirait le
   seul moyen de les isoler.

   La cause : « Non renseigné ne compte pas comme une seconde valeur » était
   une règle d'AFFICHAGE/MASQUAGE, héritée de la version où un menu non
   discriminant DISPARAISSAIT. Elle avait du sens là : RSEQ + des trous, ce
   n'est pas deux mondes, donc pas de menu. Elle n'en a plus aucun ici : dès
   qu'il y a un trou, « Non renseigné » est une option CLIQUABLE et utile, donc
   il y a bien deux choses à choisir. On compte donc TOUTES les options.

   Corollaire : le paramètre `unsetCounts` a disparu. Il n'existait que pour
   rattraper cette asymétrie entre la division (qui comptait le trou) et
   l'organisation / la ligue (qui ne le comptaient pas). Les trois axes suivent
   maintenant la même règle, et il n'y a plus d'asymétrie à documenter.
   ───────────────────────────────────────────────────────────────────────────── */

export type AxisState = "active" | "prefilled" | "empty";

/** `label` est vide en « active » (le menu porte ses propres options) et porte
 *  le libellé à afficher en « prefilled » / « empty ». */
export type AxisDisplay = { state: AxisState; label: string };

export function axisDisplay(options: readonly TaxonomyOption[]): AxisDisplay {
  if (options.length === 0) return { state: "empty", label: UNSET_LABEL };

  if (options.length === 1) {
    const seule = options[0];
    // « Non renseigné » seul n'est pas une valeur à afficher comme un monde :
    // c'est l'absence de donnée, et le menu le dit tel quel.
    return seule.value === UNSET_VALUE
      ? { state: "empty", label: UNSET_LABEL }
      : { state: "prefilled", label: seule.label };
  }

  return { state: "active", label: "" };
}

/** Regroupe des libellés à la casse près et rend l'orthographe la plus fréquente.
 *  « LFMM » et « Lfmm » sont la même ligue ; c'est un REGROUPEMENT d'affichage,
 *  aucune donnée n'est réécrite. Égalité de fréquence -> ordre alphabétique,
 *  pour que deux exécutions rendent toujours la même liste. */
function groupByCasefold(values: string[]): TaxonomyOption[] {
  const buckets = new Map<string, Map<string, number>>();
  for (const v of values) {
    const key = v.toLowerCase();
    const spellings = buckets.get(key) ?? new Map<string, number>();
    spellings.set(v, (spellings.get(v) ?? 0) + 1);
    buckets.set(key, spellings);
  }

  const out: TaxonomyOption[] = [];
  for (const [key, spellings] of buckets) {
    let label = "";
    let best = -1;
    for (const [spelling, n] of [...spellings.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "fr"),
    )) {
      if (n > best) { best = n; label = spelling; }
    }
    let count = 0;
    for (const n of spellings.values()) count += n;
    out.push({ value: key, label, count });
  }
  return out;
}

/** Trie les options par libellé (fr), « Non renseigné » toujours en dernier. */
function sortOptions(options: TaxonomyOption[]): TaxonomyOption[] {
  return [...options].sort((a, b) => {
    if (a.value === UNSET_VALUE) return 1;
    if (b.value === UNSET_VALUE) return -1;
    return a.label.localeCompare(b.label, "fr", { numeric: true });
  });
}

function withUnset(options: TaxonomyOption[], unsetCount: number): TaxonomyOption[] {
  const all = unsetCount > 0
    ? [...options, { value: UNSET_VALUE, label: UNSET_LABEL, count: unsetCount }]
    : options;
  return sortOptions(all);
}

export function organisationOptions(rows: readonly MaybeSource[]): TaxonomyOption[] {
  const counts = new Map<Organisation, number>();
  let unset = 0;
  for (const r of rows) {
    const org = organisationOf(r);
    if (org === null) unset += 1;
    else counts.set(org, (counts.get(org) ?? 0) + 1);
  }
  const named: TaxonomyOption[] = [...counts.entries()].map(([value, count]) => ({
    value, label: ORGANISATION_LABELS[value], count,
  }));
  return withUnset(named, unset);
}

/** Les ligues offertes. `org` renseigné -> seulement celles des athlètes de
 *  cette organisation : c'est le SECOND NIVEAU demandé (cocher « Scolaire » ne
 *  doit pas laisser LFMM dans la liste). `""` ou `null` -> toutes.
 *
 *  Le paramètre accepte la VALEUR du <select> de niveau 1, sentinelle comprise :
 *  cocher « Non renseigné » en organisation restreint bien aux athlètes sans
 *  organisation, au lieu de vider la liste. On réutilise `matchesOrganisation`
 *  pour que le cadrage des options et le filtrage des lignes ne puissent pas
 *  diverger — deux implémentations de la même règle finissent toujours par se
 *  contredire. */
export function leagueOptions(
  rows: readonly MaybeSource[],
  org?: string | null,
): TaxonomyOption[] {
  const named: string[] = [];
  let unset = 0;
  for (const r of rows) {
    if (!matchesOrganisation(r, org ?? "")) continue;
    const league = leagueOf(r);
    if (league === null) unset += 1;
    else named.push(league);
  }
  return withUnset(groupByCasefold(named), unset);
}

/** Les divisions offertes, mêmes règles de cadrage que `leagueOptions`. */
export function divisionOptions(
  rows: readonly MaybeSource[],
  org?: string | null,
): TaxonomyOption[] {
  const named: string[] = [];
  let unset = 0;
  for (const r of rows) {
    if (!matchesOrganisation(r, org ?? "")) continue;
    const division = divisionOf(r);
    if (division === null) unset += 1;
    else named.push(division);
  }
  return withUnset(groupByCasefold(named), unset);
}

/* ─────────────────────────────────────────────────────────────────────────────
   LES PRÉDICATS DE FILTRAGE

   Mono-valeur (`""` = pas de filtre), comme le filtre genre existant : ces
   barres-là sont en `<select>`, et mêler deux mécaniques de filtrage dans une
   même barre est exactement l'erreur corrigée au Lot 2b.

   La comparaison se fait sur `value` (casefoldée pour ligue et division), pas
   sur le libellé : deux orthographes d'une même ligue doivent matcher ensemble.
   ───────────────────────────────────────────────────────────────────────────── */

export function matchesOrganisation(src: MaybeSource, selected: string): boolean {
  if (!selected) return true;
  const org = organisationOf(src);
  if (selected === UNSET_VALUE) return org === null;
  return org === selected;
}

export function matchesLeague(src: MaybeSource, selected: string): boolean {
  if (!selected) return true;
  const league = leagueOf(src);
  if (selected === UNSET_VALUE) return league === null;
  return league !== null && league.toLowerCase() === selected.toLowerCase();
}

export function matchesDivision(src: MaybeSource, selected: string): boolean {
  if (!selected) return true;
  const division = divisionOf(src);
  if (selected === UNSET_VALUE) return division === null;
  return division !== null && division.toLowerCase() === selected.toLowerCase();
}
