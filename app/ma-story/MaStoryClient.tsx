"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUTRE,
  BADGES_CATALOGUE,
  CODE_CUSTOM,
  MAX_CONTEXTE,
  ORDRE_FAMILLES,
  SPORT_TAXONOMY,
  TITRE_FAMILLE,
  badgeDef,
  badgeSvg,
  badgesPourSport,
  placeholderContexte,
  sportDef,
} from "./taxonomie";
import styles from "./ma-story.module.css";

/* ═══════════════════════════════════════════════════════════════
   /ma-story — 8 gabarits de story Instagram, composés au canvas.

   Port 1:1 de la référence validée ma-story.html
   (sha256 01506397aa66855fd8d2bf823c02f63e41883c7c770ddd2e230e5f85d97062cd).
   Coordonnées, couleurs, dégradés, grain, seeds pseudo-aléatoires :
   identiques. Ce qui suit ne liste QUE les écarts, chacun demandé.

   ── ÉCART 1 — les fontes viennent du site ─────────────────────
   La référence charge Anton par <link> Google Fonts et Outfit par
   quatre .ttf locaux. Ici, next/font : Outfit (400→800) par la route
   (page.tsx, var --font-story), Anton par le layout racine
   (--font-anton). next/font produit des noms de famille hachés
   (__Outfit_a1b2c3…) : on les lit à l'exécution via getComputedStyle,
   puis on attend document.fonts.load() GRAISSE PAR GRAISSE avant de
   peindre. Sans cette attente, le premier rendu tombe en Impact et
   toutes les largeurs mesurées sont fausses.

   ── ÉCART 2 — aucune photo de démonstration ───────────────────
   La référence embarque trois JPG de 47 Mio et en charge un au
   démarrage puis à chaque changement d'onglet. Ils ne sont pas portés.
   Sans photo, `pp()` remplit la zone en #1A1D24 — le gabarit se lit,
   la zone photo est visiblement vide, et le téléchargement est éteint.

   ── ÉCART 3 — un champ vide ne peint rien ─────────────────────
   La référence peignait « TON NOM », « — » et « MON ÉQUIPE » quand le
   champ était vide. Sur un PNG exporté, ces replis deviennent le texte
   que l'athlète publie. Ils sont retirés : chaque bloc concerné est
   sous condition. Depuis le retrait de la jaquette (ÉCART 5) la règle
   n'a plus AUCUNE exception : tout champ vide ne peint rien, y compris
   les textes fixes de l'ÉCART 7.

   ── ÉCART 4 — ÉTOILES ET BADGES : DÉCLARÉS, PAS CERTIFIÉS ─────
   Décision de BP, 14 septembre 2026 (v2.2). Cet écart a porté deux
   textes contraires en trois jours ; celui-ci est le bon, et il dit
   POURQUOI, pas seulement quoi.

   LA DÉCISION. Le gabarit `etoiles` peint des étoiles en OR #F59E0B —
   la couleur des étoiles partout chez Nexus, dans l'application comme
   ici. Le gabarit `badges` peint les VRAIS badges du catalogue, ceux-là
   mêmes que porte la fiche. Aucune imitation, aucun badge maison : un
   badge qui se dessinerait autrement selon l'écran ne serait plus le
   même badge.

   v2.3.1 — les fichiers viennent de public/story-badges/ et non plus de
   public/badges/. Ce n'est PAS une variante de dessin : c'est la même
   géométrie, GÉNÉRÉE depuis l'original par scripts/gen-story-badges.mjs,
   où les contre-formes du glyphe sont percées au lieu d'être peintes en
   `#131519`. Ce sombre est invisible sur la fiche, à fond charbon ; sur
   une photo il devient un aplat noir au milieu du badge. La livrée, elle,
   ne bouge pas — la rampe métal reste rouge Nexus même quand l'athlète
   choisit une autre couleur d'équipe, comme le wordmark reste blanc.
   Voir badgeSvg() dans taxonomie.ts.

   CE QUE ÇA COÛTE, ET POURQUOI C'EST ASSUMÉ. /ma-story est publique,
   sans authentification, sans dossier d'athlète : elle ne peut RIEN
   vérifier. L'athlète coche ce qu'il veut. Une story portant le
   wordmark, un badge officiel et nexussports.ca se lit donc comme une
   distinction attribuée alors qu'elle est auto-déclarée — et
   lib/config/badges.ts écrit noir sur blanc qu'« un badge faux est une
   faute ». Cette page ne peut pas tenir cette garantie ; elle ne la
   revendique pas.

   CE QUI LA REMPLACE : LE RENVOI AU PROFIL. La story DÉCLARE, le
   profil FAIT FOI. D'où la ligne d'attribution sous la grille de
   badges — « MES DISTINCTIONS · PROFIL COMPLET SUR NEXUSSPORTS.CA » —
   non éditable au même titre que le wordmark (ÉCART 7). Elle ne
   vérifie rien : elle nomme la source de vérité et y envoie le
   lecteur, ce qui est aussi la raison d'être de la page. Sur `etoiles`
   le châssis porte déjà « MON PROFIL EST SUR NEXUS », qui joue ce rôle
   — rien n'y est ajouté, ce serait redondant.

   CE QUI RESTE INTERDIT, et n'a jamais été demandé : une cote
   chiffrée, un « /5 », un pourcentage, un classement, le mot
   « vérifié », et tout champ de contexte qui donnerait à une
   déclaration la précision d'un dossier (voir taxonomie.ts).

   ── ÉCART 5 — la jaquette a existé, puis n'existe plus ────────
   Le gabarit T.jaquette était écrit dans la référence mais absent de
   TPL_META et de FILE_NAMES ; il avait été rétabli ici. Il est retiré
   pour de bon le 14 septembre 2026 (v2.1) : rendu, champs (`f_posj`,
   `f_ligue`), et les actifs qui ne servaient qu'à lui — /brand/
   icon-red et icon-black — sont partis avec. `f_num` n'est pas mort
   avec la jaquette : il a migré sur « Vois mon profil », où il se colle
   au nom (v2.3.1).

   ── ÉCART 6 — le fond flouté sous 100 % de zoom ───────────────
   La référence bornait le zoom à 100–300 % : la photo couvrait
   toujours le cadre, `pp()` n'avait qu'à découper dedans. Le curseur
   descend maintenant à 50 %, et sous 100 % la photo ne couvre plus
   rien. Le vide se remplit avec la MÊME photo, agrandie ~1,4×,
   fortement floutée et légèrement assombrie — le motif des stories
   Instagram. Peinte AVANT l'étalonnage, donc elle prend le même
   duotone que la photo nette : un fond neutre trahirait le montage.

   Le découpage par rectangle SOURCE a été remplacé par un placement
   par rectangle DESTINATION — la seule écriture qui vaut des deux
   côtés de 100 %. Les deux sont algébriquement identiques au-dessus
   de 100 % (démonstration dans pp()).

   ── ÉCART 7 — les textes fixes deviennent éditables ───────────
   La référence peignait « JOUR DE MATCH. », « SCORE FINAL »,
   « MERCI. » — des littéraux, au milieu du code de rendu. Ils
   vivent maintenant dans TEXTES (une clé par texte, par gabarit),
   sont préremplis dans l'état avec leur valeur d'origine, et
   passent par val() comme n'importe quel champ : la règle ÉCART 3
   s'applique donc aussi à eux, vider le champ ne peint rien.

   Quatre textes restent des littéraux et le resteront : le
   wordmark, « NEXUSSPORTS.CA », « MON PROFIL EST SUR NEXUS » et la
   ligne d'attribution « MES DISTINCTIONS · PROFIL COMPLET SUR
   NEXUSSPORTS.CA ». Les trois derniers sont l'appel à l'action des
   gabarits de profil — les rendre éditables, c'est laisser publier
   une story estampillée Nexus qui renvoie ailleurs ; et la ligne
   d'attribution est précisément ce qui rattrape l'auto-déclaration
   des badges (ÉCART 4), la rendre modifiable la viderait de son
   sens. `profil`, `etoiles` et `badges` n'ont donc aucun texte
   personnalisable, et le bloc ne s'y affiche pas.

   Le verdict du gabarit Résultat est le seul cas mixte : calculé
   par défaut (VICTOIRE. / ON SE REPREND. / ÉGALITÉ.), et recalculé à
   chaque changement de score TANT QUE l'athlète n'y a pas touché. Le
   calcul n'est jamais écrit dans l'état — il est servi au vol par
   v(), avec la même mécanique que sport/position (ÉCART 9). Voir
   verdictDirty.

   ── ÉCART 8 — trois gabarits de profil, trois dessins ─────────
   `profil`, `etoiles` et `badges` ont partagé un châssis commun de
   la v2.1 à la v2.2 : même photo haute, même nom en héros, seul le
   bloc du milieu changeait. Il fallait alors PARAMÉTRER l'alignement
   pour que les trois se distinguent dans le sélecteur.

   La v2.3 les remplace par trois compositions portées de la
   référence Claude Design — un mur de tuiles, une photo noir et
   blanc, une vitrine sombre. Elles n'ont plus rien en commun, le
   châssis est retiré, et la question de l'écart visuel ne se pose
   plus : il est dans le dessin.

   v2.3.1 — le MUR DE TUILES est retiré à son tour et `profil`
   retrouve son dessin de la v2.2 : photo haute, nom en héros. Les
   trois restent pour autant trois dessins distincts — photo haute
   duotone, photo noir et blanc, vitrine sombre — et le châssis ne
   revient PAS : `profil` porte désormais son propre corps, comme les
   deux autres. Une nouvelle référence viendra plus tard.

   Ce qui reste commun aux trois, et qui n'est pas négociable : le
   renvoi au profil. « MON PROFIL EST SUR NEXUS » sur `profil`,
   « PROFIL COMPLET SUR NEXUSSPORTS.CA » sur les deux autres. Voir
   ÉCART 7 pour pourquoi aucun champ ne les pilote.

   ── ÉCART 10 — la colonne de verre (v2.2) ────────────────────
   `stats` et `prochain` partagent une composition qui n'existait pas
   dans la référence : photo PLEIN CADRE, et par-dessus une colonne
   translucide où vit tout le texte. La colonne n'est pas un aplat —
   c'est la MÊME photo, floutée fort et assombrie, découpée au clip.
   D'où colonneVerre().

   Ces deux-là se ressembleraient trop côte à côte dans le sélecteur.
   La colonne est donc MIROITÉE : à gauche pour `stats`, à droite
   pour `prochain`. Coût nul, différence lisible à la vignette —
   même raison qu'à l'ÉCART 8.

   ATTENTION AU FLOU, il y en a deux et ils ne se règlent pas
   pareil. Celui de pp() vit dans le canevas interne de la photo,
   dont la taille suit lowRes : il est donc PROPORTIONNEL, sinon
   l'aperçu et le PNG diffèrent. Celui de colonneVerre() vit dans le
   contexte du gabarit, toujours 1080 × 1920 : il est donc FIXE en
   pixels. Intervertir les deux réglages produit un bogue qui ne se
   voit qu'à l'export.

   ── ÉCART 11 — les vrais badges au canvas (v2.2) ─────────────
   Les 22 SVG de public/story-badges/ sont dessinés directement, sans
   export manuel — ce dossier est GÉNÉRÉ depuis public/badges/, voir
   l'ÉCART 4. Trois propriétés rendent la chose possible, et
   elles ne sont pas garanties pour un actif futur :
     · aucune référence externe (pas d'<image>, pas d'url(http…)) —
       le canvas n'est donc pas « tainted » et toBlob() reste permis ;
     · aucun <text> — donc aucune dépendance aux fontes ;
     · un viewBox 0 0 220 220, mais AUCUN width/height.
   Le dernier point est le piège : sans dimensions intrinsèques, un
   SVG peut se rasteriser à 0 × 0. loadImg() pose donc width/height
   sur l'élément AVANT le src (voir son paramètre `px`), et
   drawImage est toujours appelé avec des dimensions de destination
   explicites — jamais la forme à trois arguments.

   ── ÉCART 9 — la taxonomie sport → positions → badges ─────────
   Sport et position étaient des champs libres ; ce sont des
   sélecteurs alimentés par ./taxonomie.ts, avec « Autre » qui
   rouvre la saisie libre. Données figées, aucun réseau : c'est le
   point de branchement du futur mode connecté, qui lira le vrai
   profil de l'athlète au lieu de cette table.

   ── CE QUI NE CHANGE PAS ──────────────────────────────────────
   100 % client. La photo est lue par URL.createObjectURL, composée au
   canvas, exportée par toBlob. Aucun fetch, aucun stockage, aucune
   dépendance. Les seules requêtes réseau sont les GET same-origin des
   deux actifs /brand/ (logo-white, icon-white) et des SVG de badge
   choisis dans public/story-badges/.
═══════════════════════════════════════════════════════════════ */

type Tpl =
  | "match"
  | "prochain"
  | "resultat"
  | "stats"
  | "equipe"
  | "post"
  | "profil"
  | "etoiles"
  | "badges"
  | "merci";

type Vals = Record<string, string>;

/* ═══ DUOTONE — DOSAGE ═══════════════════════════════════════════════════
   Le duotone d'origine REMPLAÇAIT la couleur du pixel par la rampe d'accent.
   Sur un accent sature (bleu marine, ou une couleur prelevee a la pipette),
   la peau passait entierement dans la teinte : le sujet devenait monochrome
   et le visage se perdait.

   La reference de rendu est l'affiche de programme NCAA : la couleur habite
   les OMBRES et les HAUTES LUMIERES, la carnation reste lisible.

   Deux leviers, exposes ici pour iterer sans relire le pipeline :
     DUO_MIX   — part de duotone dans le melange final (le reste vient de la
                 photo d'origine, desaturee).
     DUO_DESAT — saturation conservee sur cette photo d'origine. 0 = grise,
                 1 = couleurs intactes. Basse volontairement : elle sert a
                 rendre la CARNATION, pas a ramener toute la scene.

   Un TROISIEME levier agit par pixel, et c'est lui qui sauve les visages :
   la ponderation par luminance (voir gradeData). Les tons moyens — la peau
   y vit — recoivent environ moitie moins de duotone que les ombres et les
   hautes lumieres. La courbe est une sinusoide sur la bande [0,30 ; 0,75] :
   aucun seuil dur, donc aucune cassure visible sur un degrade de joue. */
/** Dosage par DEFAUT du duotone. L'athlete le pilote a l'execution avec le
 *  curseur « Intensite de l'effet » ; cette constante n'est plus que le point
 *  de depart du curseur — et le repere auquel la desaturation
 *  d'accompagnement atteint sa pleine valeur (voir gradeData). */
const DUO_MIX = 0.65;
const DUO_DESAT = 0.4;
/** Duotone conserve dans les tons moyens (0,5 = moitie moins qu'aux bords). */
const DUO_MID_RELIEF = 0.5;
/** Bornes de la bande protegee, en luminance normalisee. */
const DUO_SHADOW_END = 0.3;
const DUO_HIGHLIGHT_START = 0.75;

const W = 1080;
const H = 1920;
const BG = "#111317";
const SURF = "#1A1D24";
const MUT = "#9CA3AF";
/** L'or des étoiles. La MÊME valeur que la cote d'entraîneur de
 *  l'application (design system : « Star Ratings — Filled: #F59E0B »).
 *  Il ne suit PAS la couleur d'équipe, et c'est voulu : une étoile est
 *  une étoile partout chez Nexus. Voir ÉCART 4.
 *
 *  Sorti puis remis le 15 septembre 2026, à la même valeur : la v2.3.4
 *  avait retiré la rangée d'étoiles, le correctif du même jour la
 *  rétablit. La valeur a été REPRISE du commit 1016fe7, pas retapée. */
const OR = "#F59E0B";
/* ═══ ÉCART 12 — LE TEXTE SECONDAIRE EST PILOTÉ PAR L'ATHLÈTE ════════════
   v2.3.2 — MUT est le gris de TOUT ce qui n'est pas un titre : surtitres,
   libellés, sous-lignes, lieu. Il a été choisi contre le fond #111317 des
   gabarits sombres, et il tient là. Il disparaît ailleurs : sur une photo
   claire posée plein cadre, un gris à 61 % de luminance n'a plus de
   contraste, et le surtitre s'efface. Plutôt qu'un second réglage codé en
   dur — juste sur une photo et faux sur la suivante — c'est l'athlète qui
   tranche, devant sa photo, avec une variable d'état substituée à MUT AU
   POINT D'ENTRÉE du rendu (`SEC` dans drawStory).

   v2.3.3 — QUATRE VALEURS, ET LA PORTÉE ENFIN COMPLÈTE.

   « Noir » entre dans la liste. Ce n'est pas la symétrie du blanc : c'est
   le cas de la photo SURexposée, où même le gris passe pour du blanc sale.
   La valeur est #111317, le fond de la page — le texte s'y lit comme de
   l'encre, pas comme une ombre.

   Et l'audit qui manquait. La v2.3.2 avait laissé DEUX familles de textes
   secondaires hors de SEC, toutes deux codées en dur :

     · VERRE_TXT / VERRE_TXT2, le blanc atténué de la colonne de verre
       (`stats`, `prochain`). L'exemption était argumentée — la colonne
       garantit son contraste par son dégradé — mais elle fabriquait deux
       régimes pour un même rôle : le surtitre de `match` obéissait au
       sélecteur, celui de `stats` non, sans que rien ne le dise à l'écran.
       Les deux niveaux d'atténuation, eux, étaient une VRAIE idée et ils
       sont conservés : SEC2 est SEC à 74 %, donc la hiérarchie à deux
       étages survit dans les quatre couleurs.
     · « MON PROFIL EST SUR NEXUS » et « NEXUSSPORTS.CA » sur `profil`,
       peints en blanc plein. Ce sont un surtitre et un pied — exactement
       le rôle de `t_match_sur` et d'ATTRIBUTION_PIED, qui suivent SEC.
       Ils passent à SEC. Conséquence à connaître : au réglage par défaut
       (Gris) ils sont plus sourds qu'avant. C'est le prix de la cohérence,
       et le sélecteur rend le blanc en un geste.

   CE QUE LE SÉLECTEUR NE TOUCHE PAS, ET POURQUOI. Deux exceptions, pas
   trois, et aucune n'est un oubli :
     · le SCORE ADVERSE de `resultat`. Il est en MUT, mais le gris n'y est
       pas une atténuation : c'est le seul signe qui distingue notre score
       du leur, à taille et à position égales. Le passer en blanc rendrait
       les deux nombres identiques.
     · L'ENCRE SUR PAPIER BLANC — la légende du polaroïd d'`equipe`
       (#16181d) et la ligne encadrée de `post` (BG sur plaque blanche).
       Le sélecteur existe pour régler le contraste d'un texte POSÉ SUR LA
       PHOTO ; sous ces deux-là il n'y a pas de photo, il y a un carton
       blanc. « Blanc » les effacerait purement et simplement. Ce ne sont
       pas des textes secondaires qui résistent, ce sont des objets d'une
       autre nature.

   Et ce qui n'a jamais été en cause : les titres, les noms en blanc plein,
   le mur en écho de `post` (c'est le TITRE répété), le wordmark. */

/** Le second niveau d'atténuation, pour la colonne de verre. Le rapport
 *  d'origine était 0,58 / 0,76 ≈ 0,76 ; arrondi à 0,74 sur une base
 *  opaque, la marche se lit pareil dans les quatre couleurs. */
const SEC2_ALPHA = 0.74;

type TexteSec = "gris" | "blanc" | "accent" | "noir";

/** Les valeurs du sélecteur, en TRIPLETS — pas en chaînes : SEC et SEC2
 *  se fabriquent tous deux à partir du même RGB, l'un opaque, l'autre à
 *  SEC2_ALPHA. « Accent » n'est pas dans la table, il se calcule à
 *  l'exécution (accInkRgb).
 *
 *  Le blanc est PLEIN, pas atténué : l'athlète qui le choisit le fait
 *  parce que le gris a disparu sous sa photo ; lui rendre un blanc à 76 %
 *  serait reprendre d'une main ce qu'on donne de l'autre. La hiérarchie
 *  tient par la TAILLE — 26 à 34 px interlettrés contre des titres de 100
 *  à 230 px — pas par l'opacité. */
const SEC_RGB: Partial<Record<TexteSec, number[]>> = {
  gris: [156, 163, 175], // MUT
  blanc: [255, 255, 255],
  noir: [17, 19, 23], // BG — l'encre de la page
};

const SEC_META: [TexteSec, string][] = [
  ["gris", "Gris"],
  ["blanc", "Blanc"],
  ["accent", "Accent"],
  ["noir", "Noir"],
];

/* ÉCART 5 — `jaquette` est sortie des deux tables (v2.1).
   ÉCART 8 — `etoiles` et `badges` entrent à la suite de `profil` : les
   trois gabarits de profil se lisent comme une famille, ils doivent se
   toucher dans le sélecteur.
   ÉCART 10 — `prochain` entre juste après `match`, pour la même raison :
   ce sont les deux gabarits d'un match, l'un avant, l'autre le jour J. */
const TPL_META: [Tpl, string][] = [
  ["match", "Jour de match"],
  ["prochain", "Prochain match"],
  ["resultat", "Résultat"],
  ["stats", "Mes stats"],
  ["equipe", "Mon équipe"],
  ["post", "Nouveau post"],
  ["profil", "Vois mon profil"],
  ["etoiles", "Mes étoiles"],
  ["badges", "Mes badges"],
  ["merci", "Merci"],
];

const FILE_NAMES: Record<Tpl, string> = {
  match: "jour-de-match",
  prochain: "prochain-match",
  resultat: "resultat",
  stats: "mes-stats",
  equipe: "mon-equipe",
  post: "nouveau-post",
  profil: "vois-mon-profil",
  etoiles: "mes-etoiles",
  badges: "mes-badges",
  merci: "merci",
};

const SWATCHES: [string, string][] = [
  ["Rouge Nexus", "#E63946"],
  ["Bleu marine", "#1D3557"],
  ["Vert forêt", "#1F5F3F"],
  ["Or", "#F59E0B"],
  ["Bourgogne", "#7A1F2B"],
  ["Orange", "#E36414"],
  ["Mauve", "#7C5CBF"],
  ["Noir", "#111317"],
];

/* ÉCART 5 — la table POSITIONS (`ABRÉGÉ|LIBELLÉ`) vivait ici pour la
   seule boîte de position de la jaquette. Elle est partie avec elle ;
   les positions viennent maintenant de ./taxonomie.ts, filtrées par le
   sport choisi (ÉCART 9). */

/* ═══ ÉCART 7 — LES TEXTES FIXES ═════════════════════════════════════════
   Une ligne par texte peint en dur dans la référence. `def` est la valeur
   d'origine, au caractère près : elle préremplit l'état au montage, donc
   ne rien toucher redonne exactement le rendu d'avant.

   `max` suit la place réelle sur le canvas — 24 pour les titres colossaux
   (Anton, une ou deux lignes), 16 pour les surtitres suivis (trk()). Ce
   n'est pas une limite de sécurité, c'est une limite de composition : le
   fitText encaisse le débordement, mais un titre de 40 caractères réduit
   à 110 px n'est plus un titre.

   Les trois gabarits de profil (`profil`, `etoiles`, `badges`) sont
   ABSENTS de cette table, et c'est le sujet de l'écart : « MON PROFIL
   EST SUR NEXUS » et « NEXUSSPORTS.CA » sont le CTA de la page, pas du
   contenu d'athlète. */
type TexteDef = {
  key: string;
  tpl: Tpl;
  label: string;
  def: string;
  max: number;
};

const TEXTES: TexteDef[] = [
  { key: "t_match_titre", tpl: "match", label: "Titre", def: "JOUR DE MATCH.", max: 24 },
  { key: "t_match_sur", tpl: "match", label: "Surtitre", def: "C'EST AUJOURD'HUI", max: 16 },
  { key: "t_res_sur", tpl: "resultat", label: "Surtitre", def: "SCORE FINAL", max: 16 },
  { key: "t_res_nous", tpl: "resultat", label: "Notre côté", def: "NOUS", max: 16 },
  { key: "t_res_eux", tpl: "resultat", label: "Leur côté", def: "EUX", max: 16 },
  { key: "t_stats_sur", tpl: "stats", label: "Surtitre", def: "MES STATS", max: 16 },
  { key: "t_equipe_sur", tpl: "equipe", label: "Surtitre", def: "MON ÉQUIPE", max: 16 },
  { key: "t_post_titre", tpl: "post", label: "Titre", def: "NOUVEAU POST.", max: 24 },
  { key: "t_merci_titre", tpl: "merci", label: "Titre", def: "MERCI.", max: 24 },
  {
    key: "t_prochain_sur",
    tpl: "prochain",
    label: "Surtitre",
    def: "PROCHAIN MATCH",
    max: 16,
  },
];

/** Valeur d'origine d'un texte fixe. Sert de PATRON DE MESURE quand le
 *  champ est vide : rien n'est peint, mais la composition garde ses
 *  ancrages au lieu de remonter d'un bloc (même convention que les
 *  champs de contenu vides, qui laissent un trou et ne décalent rien). */
const TEXTE_DEF: Record<string, string> = Object.fromEntries(
  TEXTES.map((t) => [t.key, t.def]),
);

/** État initial des textes fixes — « prérempli avec la valeur actuelle ». */
const TEXTES_INIT: Vals = Object.fromEntries(TEXTES.map((t) => [t.key, t.def]));

/* ÉCART 4 — L'ATTRIBUTION DU GABARIT `badges`.

   NON ÉDITABLE, au même titre que le wordmark : aucun champ ne la pilote
   et elle n'a pas d'entrée dans TEXTES. C'est elle qui porte tout le
   poids de la décision v2.2 — la story DÉCLARE, le profil FAIT FOI — et
   elle renvoie au profil, ce qui est aussi la raison d'être de la page.
   La rendre modifiable la viderait de son sens.

   Depuis la v2.3 elle est posée en DEUX temps, aux deux bouts de la
   vitrine : le surtitre au-dessus du badge héros, l'adresse au pied.
   Lues de haut en bas, les deux reconstituent la phrase actée. C'est la
   composition portée qui l'impose — 52 caractères sur une ligne, au
   milieu d'une vitrine, ne se lisent pas — et le sens est intact. */
const ATTRIBUTION_SUR = "MES DISTINCTIONS";
const ATTRIBUTION_PIED = "PROFIL COMPLET SUR NEXUSSPORTS.CA";
/** La phrase entière, pour le texte d'aide du formulaire. */
const ATTRIBUTION = `${ATTRIBUTION_SUR} · ${ATTRIBUTION_PIED}`;

/** Code de badge → libellé, à plat, pour le rendu au canvas. */
const BADGE_LIBELLE: Record<string, string> = Object.fromEntries(
  BADGES_CATALOGUE.map((b) => [b.code, b.libelle]),
);

/** Les cases de badge. Elles portent des CODES de catalogue depuis la
 *  v2.2, plus du texte libre.
 *
 *  CINQ depuis la v2.3.2, et le nombre n'est pas arbitraire : la vitrine
 *  pose un héros et une RANGÉE DE QUATRE dessous, comme la composition de
 *  référence. À quatre cases, la rangée n'en comptait que trois et
 *  restait visiblement en deçà de son dessin. C'est aussi PLAFOND_BADGES
 *  côté fiche (lib/config/badgeCatalogue.ts) — la story ne propose donc
 *  plus moins que ce qu'un athlète peut réellement porter. */
const BADGE_SLOTS = ["f_b1", "f_b2", "f_b3", "f_b4", "f_b5"];
const MAX_BADGES_STORY = BADGE_SLOTS.length;

/** Le contexte du badge HÉROS — le libellé de Custom, le millésime des
 *  quatre autres honneurs. Hors des BADGE_SLOTS : ce n'est pas un badge de
 *  plus, c'est le TEXTE de l'un d'eux.
 *
 *  UN SEUL champ, pas un par case : le contexte ne se peint que sous le
 *  héros, donc n'en demander qu'un est exactement ce que la composition
 *  utilise. Conséquence assumée, et dite dans le formulaire : changer de
 *  héros REPREND le texte déjà saisi au lieu de le vider. C'est déjà ce
 *  que faisait le libellé Custom depuis la v2.2. */
const SLOT_CONTEXTE = "f_bcustom";

/* ÉCART 5 — icon-black et icon-red ne servaient qu'à la jaquette et
   sont partis avec elle. icon-red était REVENU en v2.3 pour la tuile
   blanche du mur mosaïque de « Vois mon profil » ; le mur est retiré en
   v2.3.1, l'actif repart avec lui. Plus aucun gabarit ne le charge. */
const BRAND = {
  wordmark: "/brand/logo-white.png",
  icon: "/brand/icon-white.png",
};

/* ─────────────────────────────────────────────────────────────────
   OUTILS PURS
   ───────────────────────────────────────────────────────────────── */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const up = (s: string) => s.toUpperCase();

/** Le verdict CALCULÉ du gabarit Résultat. Extrait du rendu pour que le
 *  formulaire et le canvas lisent la même règle : le champ « Verdict »
 *  affiche cette valeur tant que l'athlète n'a rien surchargé, et le
 *  rendu la reçoit par l'état comme n'importe quel autre texte. */
function calcVerdict(sn: string, se: string): string {
  const a = parseInt(sn || "0", 10);
  const b = parseInt(se || "0", 10);
  return a > b ? "VICTOIRE." : a < b ? "ON SE REPREND." : "ÉGALITÉ.";
}

/* Découpe un titre en AU PLUS `kMax` lignes, au mot, en égalisant les
   largeurs (on minimise la ligne la plus large).

   Les titres colossaux étaient des littéraux découpés à la main :
   « JOUR » / « DE » / « MATCH. » sur trois lignes, « ON SE » /
   « REPREND. » sur deux. Ce découpage rend les deux À L'IDENTIQUE —
   trois mots en trois lignes donnent un mot par ligne ; sur « ON SE
   REPREND. » en deux lignes, le partage le plus équilibré est bien
   ON SE / REPREND. — tout en encaissant un titre personnalisé de un,
   deux ou quatre mots.

   `measure` est appelé à taille de fonte FIXE : seul le rapport entre
   les lignes compte, la taille définitive vient du fit ensuite. */
function splitBalanced(
  text: string,
  kMax: number,
  measure: (s: string) => number,
): string[] {
  const w = text.split(/\s+/).filter(Boolean);
  const k = Math.min(kMax, w.length);
  if (k <= 1) return [text];
  let best: string[] = [text];
  let bestMax = Infinity;
  const cuts: number[] = [];
  const walk = (from: number, depth: number) => {
    if (depth === k - 1) {
      const lines: string[] = [];
      let prev = 0;
      [...cuts, w.length].forEach((c) => {
        lines.push(w.slice(prev, c).join(" "));
        prev = c;
      });
      const m = Math.max(...lines.map(measure));
      if (m < bestMax) {
        bestMax = m;
        best = lines;
      }
      return;
    }
    for (let i = from; i <= w.length - (k - depth - 1); i++) {
      cuts[depth] = i;
      walk(i + 1, depth + 1);
    }
  };
  walk(1, 0);
  return best;
}

/** Charge une image, ou `null` si elle échoue — jamais de rejet : un
 *  actif manquant doit dégrader le rendu, pas casser le montage.
 *
 *  `px` pose width/height sur l'élément AVANT le src, et c'est
 *  indispensable pour les SVG de badge : ils n'ont qu'un
 *  viewBox, aucune dimension intrinsèque, et un SVG sans dimension peut
 *  se rasteriser à 0 × 0 dans un canvas. Les PNG de marque n'en ont pas
 *  besoin — ils portent les leurs. Voir ÉCART 11. */
function loadImg(src: string, px?: number): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    if (px) {
      i.width = px;
      i.height = px;
    }
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

/** PRNG déterministe — le grain et les rayures doivent être identiques
 *  d'un rendu à l'autre, sinon l'aperçu et le PNG exporté diffèrent. */
function mulberry(seed: number) {
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(h: string): number[] {
  let s = h.replace("#", "");
  if (s.length === 3) {
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

const mixC = (a: number[], b: number[], t: number) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

type GradeOpts = {
  sat?: number;
  con?: number;
  stops?: number[][];
  cool?: boolean;
  lift?: boolean;
  raw?: boolean;
  /** Dosage du duotone, 0..1. Absent = DUO_MIX. */
  duoMix?: number;
};

/* ═══ LE DOSAGE, v2.3.3 — UN SEUL POINT, LES DIX GABARITS ════════════════
   CE QUI N'ALLAIT PAS. Le dosage vivait DANS la branche `stops`, mêlé à la
   mécanique du duotone (`accompagnement`, `desatEff`). Trois conséquences,
   toutes constatées au rendu :

     · `equipe` et `badges` n'ont PAS de rampe — leur étalonnage est
       `sat`/`cool`/`lift`. Ils tombaient dans la branche `else`, où aucun
       dosage n'existait : le curseur ne les touchait pas du tout. Vérifié
       par empreinte MD5, 0 % et 100 % rendaient le même octet.
     · `sat` et `con` étaient appliqués AVANT le mélange, donc des deux
       côtés. À 0 %, on n'avait pas la photo brute : on avait la photo
       désaturée à 55 % (`equipe`) ou contrastée à 1,24 (`resultat`).
     · la désaturation d'accompagnement saturait à 65 % (`clamp(dose/0,65)`),
       donc au-dessus du défaut seule la part de teinte montait encore.

   CE QU'IL FAUT. Le dosage n'est pas une affaire de duotone, c'est une
   affaire de PIPELINE : « combien du traitement de ce gabarit, et combien
   de la photo telle qu'elle est ». Une seule ligne, tout à la fin :

       sortie = brut + (traité_à_pleine_dose − brut) × dose

   0 % rend la photo intacte sur les DIX gabarits. 100 % rend le traitement
   entier de chacun, rampe ou pas. Entre les deux, une droite. Aucun `if`
   sur le gabarit, ici ou ailleurs.

   CE QUE ÇA CHANGE, ET IL FAUT LE SAVOIR. La valeur par défaut du curseur
   est 65 %, et 65 % de traitement n'est plus tout à fait ce que rendait
   l'ancienne formule :
     · gabarits à rampe — à 100 % le rendu est identique AU BIT PRÈS
       (la démonstration est en dessous, dose=1 ⇒ la lerp est l'identité) ;
       à 65 % la sortie tire un peu plus vers la photo d'origine, parce que
       la couche d'accompagnement est maintenant la photo BRUTE et non sa
       version désaturée à 40 % ;
     · `equipe` et `badges` — à 65 % leur traitement (désaturation, bleuté,
       remontée des noirs) est désormais dosé à 65 % au lieu d'être posé en
       entier. Leur aspect PAR DÉFAUT change donc, et c'est le prix exact
       de les rendre pilotables. Mettre DUO_MIX à 1 les rendrait identiques
       à avant tout en gardant le curseur — c'est un arbitrage de BP, pas
       une évidence, et il n'est pas pris ici.

   L'invariant « à 65 % la sortie est identique au bit près à celle d'avant
   le curseur », qui était écrit ici, est donc RETIRÉ : il est incompatible
   avec « à 0 %, photo brute ». L'un des deux devait tomber. */
function gradeData(d: Uint8ClampedArray, o: GradeOpts) {
  const sat = o.sat ?? 1;
  const con = o.con ?? 1;
  const stops = o.stops;
  const cool = o.cool;
  const lift = o.lift !== false;
  /** La dose, 0..1. Elle ne touche plus une branche : elle touche la
   *  sortie. */
  const dose = clamp(o.duoMix ?? DUO_MIX, 0, 1);
  for (let i = 0; i < d.length; i += 4) {
    /* La photo TELLE QU'ELLE EST. C'est l'autre bout du mélange, et c'est
       ce qui manquait : il était reconstruit par désaturation partielle à
       l'intérieur du duotone, donc indisponible pour les deux gabarits qui
       n'en ont pas. */
    const r0 = d[i];
    const g0 = d[i + 1];
    const b0 = d[i + 2];
    let r = r0;
    let g = g0;
    let b = b0;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (sat !== 1) {
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }
    if (con !== 1) {
      r = (r - 128) * con + 128;
      g = (g - 128) * con + 128;
      b = (b - 128) * con + 128;
    }
    if (stops) {
      const t = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1);
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const A = stops[k];
      const B = stops[k + 1];
      const u = clamp((t - A[0]) / (B[0] - A[0]), 0, 1);
      // la teinte pure, telle que l'ancien pipeline la posait
      const dr = A[1] + (B[1] - A[1]) * u;
      const dg = A[2] + (B[2] - A[2]) * u;
      const db = A[3] + (B[3] - A[3]) * u;

      /* La photo d'origine, desaturee — c'est elle qui porte la carnation.
         On repart de la luminance DEJA calculee (t), pas d'un second calcul.

         DUO_DESAT est FIXE ici, et c'est le changement de la v2.3.3 : cette
         couche est la couche d'accompagnement du duotone À PLEINE DOSE, pas
         un endroit où doser. Le dosage est sorti de cette branche et vit
         maintenant à la fin de la boucle, pour les dix gabarits. */
      const lum255 = t * 255;
      const orr = lum255 + (r - lum255) * DUO_DESAT;
      const org = lum255 + (g - lum255) * DUO_DESAT;
      const orb = lum255 + (b - lum255) * DUO_DESAT;

      /* PROTECTION DES TONS MOYENS.
         Pleine teinte dans les ombres et les hautes lumieres ; environ
         moitie moins entre les deux. sin(pi * x) vaut 0 aux deux bornes et
         1 au centre — la ponderation rejoint donc 1 exactement en sortie de
         bande, sans marche. Un seuil dur produirait une arete visible en
         travers d'un front ou d'une joue. */
      let w = 1;
      if (t > DUO_SHADOW_END && t < DUO_HIGHLIGHT_START) {
        const x = (t - DUO_SHADOW_END) / (DUO_HIGHLIGHT_START - DUO_SHADOW_END);
        w = 1 - (1 - DUO_MID_RELIEF) * Math.sin(Math.PI * x);
      }

      r = dr * w + orr * (1 - w);
      g = dg * w + org * (1 - w);
      b = db * w + orb * (1 - w);
    } else {
      if (cool) {
        b += 7;
        r -= 4;
      }
      // noirs ramenés sur #111317 plutôt que sur du noir pur
      if (lift) {
        r = 17 + r * 0.933;
        g = 19 + g * 0.925;
        b = 23 + b * 0.91;
      }
    }

    /* ─── LE DOSAGE — la seule ligne qui le fait, et elle vaut pour les
       dix gabarits, rampe ou pas. Voir l'en-tête de la fonction.

       dose = 1 : r0 + (r − r0) × 1 = r — le traitement entier, au bit près.
       dose = 0 : r0 + (r − r0) × 0 = r0 — la photo intacte.
       Entre les deux : une droite. */
    if (dose !== 1) {
      r = r0 + (r - r0) * dose;
      g = g0 + (g - g0) * dose;
      b = b0 + (b - b0) * dose;
    }

    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

/* Grain procédural, calculé une fois. Volontairement hors du rendu :
   360×640 étiré sur 1080×1920, sans lissage. */
let grainCanvas: HTMLCanvasElement | null = null;
function getGrain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 640;
  const x = c.getContext("2d");
  if (x) {
    const id = x.createImageData(360, 640);
    const d = id.data;
    const rnd = mulberry(42);
    for (let i = 0; i < d.length; i += 4) {
      const v = 95 + rnd() * 115;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
  }
  grainCanvas = c;
  return c;
}

/* ─────────────────────────────────────────────────────────────────
   RENDU
   ───────────────────────────────────────────────────────────────── */

type DrawOpts = {
  tpl: Tpl;
  v: (k: string) => string;
  photo: HTMLImageElement | null;
  wm: HTMLImageElement | null;
  icon: HTMLImageElement | null;
  /** Les SVG de badge déjà chargés, par code. Absent = pas encore
   *  arrivé ; le gabarit ne peint alors rien à sa place plutôt qu'un
   *  trou gris. Voir ÉCART 11. */
  badges: Record<string, HTMLImageElement | null>;
  fx: number;
  fy: number;
  zoom: number;
  accent: string;
  /** ÉCART 12 — la couleur de TOUT le texte secondaire. */
  secTxt: TexteSec;
  /** Dosage du duotone, 0..1 — curseur « Intensite de l'effet ». */
  duoMix: number;
  lowRes: boolean;
  antonStack: string;
  outfitStack: string;
  /** Mode pipette : photo brute, sans étalonnage ni habillage. */
  pipette?: boolean;
};

function drawStory(ctx: CanvasRenderingContext2D, o: DrawOpts) {
  const val = o.v;
  const RED = o.accent;

  /* ---- fontes ---- */
  const anton = (px: number) => {
    ctx.font = px + "px " + o.antonStack;
  };
  const outfit = (wt: number, px: number) => {
    ctx.font = wt + " " + px + "px " + o.outfitStack;
  };

  /* ---- couleur d'accent ---- */
  /** L'accent RENDU LISIBLE EN TEXTE, en triplet. Il rend un triplet et
   *  non une chaîne depuis la v2.3.3 : le texte secondaire en a besoin à
   *  deux opacités, et refabriquer un rgba() à partir d'un « rgb(…) »
   *  déjà formaté serait une analyse de chaîne pour rien. */
  function accInkRgb(): number[] {
    const c = hexRgb(RED);
    const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    if (L >= 90) return c.map(Math.round);
    const t = clamp((95 - L) / 140, 0.2, 0.45);
    return mixC(c, [255, 255, 255], t).map(Math.round);
  }
  const INK_RGB = accInkRgb();
  const INK = "rgb(" + INK_RGB.join(",") + ")";

  /* ÉCART 12 — LA couleur du texte secondaire, résolue UNE fois pour les
     dix gabarits, à deux niveaux d'atténuation.

     `accent` passe par accInkRgb() et non par RED brut : un bleu marine ou
     un noir choisis comme couleur d'équipe seraient illisibles en texte,
     exactement le problème qu'on vient corriger. accInkRgb() éclaircit les
     accents sombres et laisse les clairs intacts — c'est déjà ce qui
     protège le point final et le verdict.

     SEC2 n'est pas une seconde couleur, c'est la MÊME à SEC2_ALPHA. La
     colonne de verre (ÉCART 10) empile un surtitre et une sous-ligne : sans
     ce second niveau, les deux se vaudraient et la colonne perdrait sa
     hiérarchie. Personne d'autre ne s'en sert, et c'est voulu — deux
     niveaux partout deviendraient deux décisions à prendre partout. */
  const secRgb = o.secTxt === "accent" ? INK_RGB : SEC_RGB[o.secTxt] ?? SEC_RGB.gris!;
  const SEC = "rgb(" + secRgb.join(",") + ")";
  const SEC2 = "rgba(" + secRgb.join(",") + "," + SEC2_ALPHA + ")";

  function accDuo(): number[][] {
    const c = hexRgb(RED);
    const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const main =
      L > 190
        ? mixC(c, [17, 19, 23], 0.58)
        : L > 150
          ? mixC(c, [17, 19, 23], 0.45)
          : L > 120
            ? mixC(c, [17, 19, 23], 0.25)
            : c;
    const mid = mixC(main, [17, 19, 23], 0.55);
    const hi = mixC(c, [255, 255, 255], 0.82);
    return [
      [0, 17, 19, 23],
      [0.42, ...mid],
      [0.78, ...main],
      [1, ...hi],
    ];
  }

  /* ---- texte ---- */
  function fit(
    text: string,
    build: (px: number) => void,
    maxW: number,
    start: number,
    min?: number,
  ) {
    let s = start;
    build(s);
    while (ctx.measureText(text).width > maxW && s > (min || 24)) {
      s -= 2;
      build(s);
    }
    return s;
  }

  /** Lettre à lettre pour un interlettrage réel — `letterSpacing` du
   *  canvas n'est pas supporté partout. Retourne la largeur totale. */
  function trk(text: string, x: number, y: number, ls: number, align?: string) {
    const cs = [...text];
    const ws = cs.map((c) => ctx.measureText(c).width);
    const tot = ws.reduce((a, b) => a + b, 0) + ls * (cs.length - 1);
    let cx = align === "center" ? x - tot / 2 : align === "right" ? x - tot : x;
    cs.forEach((c, i) => {
      ctx.fillText(c, cx, y);
      cx += ws[i] + ls;
    });
    return tot;
  }

  /** `fit`, mais pour un texte posé par trk(). La largeur d'un texte
   *  interlettré n'est pas celle que measureText rend : l'espacement
   *  ajoute ls × (n − 1). Sans ça un surtitre personnalisé long sort du
   *  cadre sans que le fit s'en aperçoive. Pas 1 px, pas 24 px de
   *  plancher : ces textes sont déjà petits, le pas de 1 évite qu'ils
   *  s'effondrent d'un coup. */
  function fitTrk(
    text: string,
    build: (px: number) => void,
    ls: number,
    maxW: number,
    start: number,
    min: number,
  ) {
    let s = start;
    build(s);
    const gaps = Math.max(0, [...text].length - 1);
    while (ctx.measureText(text).width + ls * gaps > maxW && s > min) {
      s -= 1;
      build(s);
    }
    return s;
  }

  /** INTERLIGNE DES TITRES EMPILÉS.
   *
   *  Anton serre ses lignes — 0,94 à 0,96 fois la taille selon le
   *  gabarit — et c'est juste TANT QUE les capitales n'ont pas
   *  d'accent : « É », « Ô », « È » montent au-dessus de la hauteur de
   *  capitale et viennent alors cogner la ligne du dessus.
   *
   *  La référence ne pouvait pas rencontrer le cas : ses titres
   *  empilés sont « JOUR / DE / MATCH. » et « ON SE / REPREND. », sans
   *  un accent. Un titre saisi en rencontre tout de suite — « QUELLE /
   *  REMONTÉE. » a suffi.
   *
   *  Le desserrage ne s'applique donc QUE si une ligne autre que la
   *  première porte un accent : les valeurs d'origine sortent
   *  inchangées sur tout ce que la référence peignait. */
  const ACCENTS_CAP = /[ÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ]/;
  function interligne(lines: string[], base: number) {
    return lines.slice(1).some((L) => ACCENTS_CAP.test(L)) ? Math.max(base, 1.06) : base;
  }

  /** Le point final en couleur d'accent — signature typographique de
   *  la marque, reprise sur six gabarits. */
  function redDot(text: string, x: number, y: number, align?: string) {
    const base = text.endsWith(".") ? text.slice(0, -1) : text;
    const wAll = ctx.measureText(text).width;
    const wBase = ctx.measureText(base).width;
    const x0 = align === "center" ? x - wAll / 2 : x;
    const keep = ctx.fillStyle;
    ctx.fillText(base, x0, y);
    if (base !== text) {
      ctx.fillStyle = INK;
      ctx.fillText(".", x0 + wBase, y);
      ctx.fillStyle = keep;
    }
    return wAll;
  }

  /* ---- photo ---- */
  function pp(w: number, h: number, g: GradeOpts): HTMLCanvasElement {
    const q = o.lowRes ? 0.42 : 1;
    const cw = Math.max(2, Math.round(w * q));
    const ch = Math.max(2, Math.round(h * q));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const x = c.getContext("2d", { willReadFrequently: true });
    if (!x) return c;
    // ÉCART 2 : sans photo, la zone se remplit en surface — le gabarit
    // reste lisible et le vide se voit.
    if (!o.photo) {
      x.fillStyle = SURF;
      x.fillRect(0, 0, cw, ch);
      return c;
    }
    const iw = o.photo.naturalWidth;
    const ih = o.photo.naturalHeight;
    /** Échelle à laquelle la photo couvre EXACTEMENT le cadre. */
    const base = Math.max(cw / iw, ch / ih);
    x.imageSmoothingQuality = "high";

    /* ÉCART 6 — LE FOND FLOUTÉ.
       Sous 100 %, la photo ne couvre plus le cadre. Le vide se remplit
       avec la même photo agrandie ~1,4×, fortement floutée, légèrement
       assombrie : le motif des stories Instagram.

       Le flou est proportionnel au cadre (3,5 % de son grand côté), et
       non fixe en pixels : ce canevas est dessiné à 42 % pendant un
       glissement (lowRes) et à 100 % au repos — un rayon fixe donnerait
       deux fonds différents entre l'aperçu et le PNG exporté.

       Le débordement de 1,4× n'est pas décoratif : il garantit que le
       flou ne va jamais chercher du transparent hors de l'image et ne
       laisse pas de halo clair sur les quatre bords. */
    if (o.zoom < 1) {
      const bs = base * 1.4;
      const bw = iw * bs;
      const bh = ih * bs;
      x.save();
      x.filter = `blur(${Math.max(6, Math.round(Math.max(cw, ch) * 0.035))}px)`;
      x.drawImage(o.photo, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
      x.restore();
      x.fillStyle = "rgba(17,19,23,.35)";
      x.fillRect(0, 0, cw, ch);
    }

    /* PLACEMENT PAR RECTANGLE DESTINATION.
       La référence découpait un rectangle SOURCE dans la photo — une
       écriture qui n'a plus de sens sous 100 %, où le rectangle sortirait
       de l'image. On pose donc la photo entière à l'échelle voulue, et on
       la déplace.

       Les deux sont le même calcul au-dessus de 100 % :
         dx = cw/2 − fx·dw  ⇔  sx = −dx/s = fx·iw − cw/(2s) = fx·iw − sw/2
       et le clamp de dx sur [cw−dw, 0] est exactement celui de sx sur
       [0, iw−sw]. Le rendu d'avant sort au pixel près.

       Le clamp ne s'applique QUE sur l'axe où la photo couvre encore :
       sur l'autre, elle flotte librement sur le fond flouté, et le point
       focal continue de commander ce qu'on voit au centre. */
    const s = base * o.zoom;
    const dw = iw * s;
    const dh = ih * s;
    let dx = cw / 2 - clamp(o.fx, 0, 1) * dw;
    let dy = ch / 2 - clamp(o.fy, 0, 1) * dh;
    if (dw >= cw) dx = clamp(dx, cw - dw, 0);
    if (dh >= ch) dy = clamp(dy, ch - dh, 0);
    x.drawImage(o.photo, dx, dy, dw, dh);
    if (!g.raw) {
      const id = x.getImageData(0, 0, cw, ch);
      /* Le dosage est injecte ICI, au point de passage unique : les 8
         gabarits gardent leurs options d'etalonnage telles quelles. */
      gradeData(id.data, { ...g, duoMix: o.duoMix });
      x.putImageData(id, 0, 0);
    }
    return c;
  }

  /* ---- traitements ---- */
  function grain(a: number) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = "overlay";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(getGrain(), 0, 0, W, H);
    ctx.restore();
  }
  function vignette(a: number) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, "rgba(17,19,23,0)");
    g.addColorStop(1, "rgba(17,19,23," + a + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function protect(y0: number, peak: number) {
    const g = ctx.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, "rgba(17,19,23,0)");
    g.addColorStop(0.75, "rgba(17,19,23," + peak * 0.85 + ")");
    g.addColorStop(1, "rgba(17,19,23," + peak + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, H - y0);
  }
  /* ÉCART 10 — LA COLONNE DE VERRE.

     Une bande verticale où vit tout le texte, posée sur une photo plein
     cadre. Ce n'est PAS un aplat : c'est la même photo, floutée fort et
     assombrie à 55 %, découpée au clip. L'aplat était la version facile
     et elle se voyait — le texte flottait sur un rectangle mort au lieu
     de reposer sur l'image.

     LE FLOU PASSE PAR UN CANEVAS RÉDUIT, pour deux raisons qui vont dans
     le même sens. La vitesse d'abord : un blur(44px) sur 1080 × 1920
     rend le glissement du cadrage poisseux, alors que le même flou sur
     270 × 480 est immédiat. La stabilité ensuite : ce contexte fait
     toujours 1080 × 1920, quelle que soit la résolution interne de la
     photo (lowRes) — le rayon est donc FIXE en pixels, à l'inverse de
     celui de pp(), qui doit être proportionnel. Ne pas intervertir les
     deux : le bogue ne se verrait qu'à l'export.

     Le ré-agrandissement du canevas réduit lisse encore l'image, ce qui
     renforce le flou au lieu de le trahir. */
  let verreCache: HTMLCanvasElement | null = null;
  function flouFort(src: HTMLCanvasElement): HTMLCanvasElement {
    if (verreCache) return verreCache;
    const k = 4;
    const c = document.createElement("canvas");
    c.width = Math.round(W / k);
    c.height = Math.round(H / k);
    const x = c.getContext("2d");
    if (x) {
      x.imageSmoothingQuality = "high";
      x.filter = `blur(${44 / k}px)`;
      x.drawImage(src, 0, 0, c.width, c.height);
    }
    verreCache = c;
    return c;
  }

  function colonneVerre(x0: number, w: number, src: HTMLCanvasElement) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, w, H);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(flouFort(src), 0, 0, W, H);
    ctx.fillStyle = "rgba(17,19,23,.55)";
    ctx.fillRect(x0, 0, w, H);

    /* LE VOILE SEUL NE SUFFIT PAS, et c'est une leçon de recette : sur
       une photo à ciel clair, 55 % laissent une colonne trop lumineuse
       et le surtitre en gris sourd devient illisible. Le même 55 % sur
       une photo sombre était parfait — d'où le piège, ça se voit sur
       une photo et pas sur l'autre.

       La colonne garantit donc son propre contraste : un dégradé
       vertical qui assombrit les DEUX bouts et laisse le milieu
       respirer. Le haut porte le surtitre et le titre, le bas porte le
       nom et le wordmark ; le ventre, lui, n'a que des chiffres en
       blanc plein, qui n'ont besoin de rien. */
    const gv = ctx.createLinearGradient(0, 0, 0, H);
    gv.addColorStop(0, "rgba(17,19,23,.40)");
    gv.addColorStop(0.42, "rgba(17,19,23,0)");
    gv.addColorStop(0.66, "rgba(17,19,23,0)");
    gv.addColorStop(1, "rgba(17,19,23,.34)");
    ctx.fillStyle = gv;
    ctx.fillRect(x0, 0, w, H);
    ctx.restore();
    /* L'arête intérieure. Un filet de 2 px à 14 % — sans lui la colonne
       bave sur la photo et l'effet de verre ne se lit plus. Le bord
       EXTÉRIEUR, lui, tombe sur le bord du cadre : rien à y tracer. */
    const interieur = x0 === 0 ? x0 + w : x0;
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fillRect(interieur - 1, 0, 2, H);
  }

  function scratches(seed: number, n: number, a: number) {
    const r = mulberry(seed);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#fff";
    for (let i = 0; i < n; i++) {
      ctx.lineWidth = 0.6 + r() * 1.4;
      ctx.beginPath();
      const x0 = r() * W;
      const y0 = r() * H;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (r() - 0.3) * 500, y0 + (r() - 0.5) * 900);
      ctx.stroke();
    }
    ctx.restore();
  }
  /* v2.1 — `tornPath` (le contour de papier déchiré) vivait ici. Il ne
     servait qu'au cadre de « Mes stats », remplacé par un cadre net ;
     il est parti avec. `mulberry` reste utilisé par le grain et les
     rayures. */

  /** Étoile à cinq branches, pointe en haut. Pose le chemin, ne peint
   *  pas — l'appelant choisit fill ou stroke.
   *
   *  `creux` est la profondeur des angles rentrants. 0,42 par défaut,
   *  0,45 pour les rendus portés de la référence v2.3, qui l'écrit
   *  ainsi. L'écart est imperceptible ; le paramètre existe pour que le
   *  port soit littéral et qu'on n'ait pas à choisir entre « fidèle » et
   *  « cohérent ».
   *
   *  Retirée puis remise le 15 septembre 2026, au caractère près : reprise
   *  du commit 1016fe7 et non redessinée. Une étoile redessinée de mémoire
   *  n'est plus la même étoile, et c'est exactement ce que l'ÉCART 4
   *  interdit pour les badges. */
  function star5(cxs: number, cys: number, r: number, creux = 0.42) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * creux : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cxs + Math.cos(a) * rad;
      const py = cys + Math.sin(a) * rad;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function dots(
    x0: number,
    y0: number,
    w: number,
    h: number,
    gap: number,
    color: string,
    a: number,
  ) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    for (let y = y0; y < y0 + h; y += gap) {
      for (let x = x0; x < x0 + w; x += gap) {
        const f = 1 - (x - x0) / w;
        const r = gap * 0.32 * f;
        if (r > 0.4) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 7);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  function rr(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wordmark(x: number, y: number, w: number, align?: string) {
    if (!o.wm) return;
    const h = (w * o.wm.naturalHeight) / o.wm.naturalWidth;
    const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.drawImage(o.wm, x0, y, w, h);
    return h;
  }

  /* ÉCART 8 — LE CHÂSSIS DES TROIS GABARITS DE PROFIL A VÉCU.

     De la v2.1 à la v2.2, `profil`, `etoiles` et `badges` partageaient
     chassisProfil() : même photo haute, même appel à l'action, même nom
     en héros, même pied — seul le bloc du milieu changeait.

     La v2.3 remplace les trois par des compositions PORTÉES de la
     référence Claude Design, et elles n'ont plus rien en commun : un mur
     de tuiles pleines, une photo noir et blanc, une vitrine sombre. Le
     châssis n'avait plus un seul appelant ; il est retiré plutôt que
     gardé « au cas où ».

     v2.3.1 — le mur de tuiles est retiré et `profil` reprend le dessin
     de la v2.2. Le châssis ne revient pas pour autant : ce que `profil`
     partageait avec les deux autres tient en quatre lignes de photo et
     un pied, et les deux autres ne les peignent plus pareil. Un châssis
     à un seul appelant est une indirection, pas une mutualisation.

     Ce qu'il portait de load-bearing survit dans les trois gabarits :
     l'appel à l'action « MON PROFIL EST SUR NEXUS » / « NEXUSSPORTS.CA »
     reste peint en dur, et reste non éditable (ÉCART 7).

     Ce qu'il portait de PARAMÈTRE — l'alignement, pour que les trois se
     distinguent dans le sélecteur — n'a plus lieu d'être : les trois
     dessins sont désormais si différents qu'aucun réglage n'est
     nécessaire pour les séparer d'un coup d'œil. */

  /* ─────────────────────────────────────────────────────────────
     MODE PIPETTE — photo brute, on prélève une couleur réelle
     ───────────────────────────────────────────────────────────── */
  if (o.pipette) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(pp(W, H, { raw: true }), 0, 0, W, H);
    rr(W / 2 - 340, 84, 680, 92, 12);
    ctx.fillStyle = "rgba(17,19,23,.78)";
    ctx.fill();
    outfit(600, 34);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("Touche la couleur à prélever", W / 2, 144);
    ctx.textAlign = "left";
    return;
  }

  /* ─────────────────────────────────────────────────────────────
     LES 8 GABARITS
     ───────────────────────────────────────────────────────────── */

  const T: Record<Tpl, () => void> = {
    /* 1 — JOUR DE MATCH : split vertical, duotone accent */
    match() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(pp(660, H, { con: 1.16, stops: accDuo() }), 0, 0, 660, H);
      let g = ctx.createLinearGradient(400, 0, 660, 0);
      g.addColorStop(0, "rgba(17,19,23,0)");
      g.addColorStop(1, "rgba(17,19,23,.92)");
      ctx.fillStyle = g;
      ctx.fillRect(400, 0, 260, H);
      g = ctx.createLinearGradient(0, 1350, 0, H);
      g.addColorStop(0, "rgba(17,19,23,0)");
      g.addColorStop(1, "rgba(17,19,23,.85)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 1350, 660, H - 1350);

      // nom vertical sur la tranche de la photo — ÉCART 3
      const nom = up(val("f_nom"));
      if (nom) {
        ctx.save();
        ctx.translate(88, 1580);
        ctx.rotate(-Math.PI / 2);
        outfit(700, 34);
        ctx.fillStyle = "#fff";
        trk(nom, 0, 0, 10, "left");
        ctx.restore();
      }

      const X = 430;
      const sur = up(val("t_match_sur"));
      if (sur) {
        ctx.fillStyle = SEC;
        fitTrk(sur, (s) => outfit(600, s), 9, W - X - 50, 30, 16);
        trk(sur, X, 360, 9, "left");
      }

      /* Le titre commande la position de tout ce qui suit (VS, date,
         lieu). Quand il est vide on mesure quand même le titre
         d'origine : rien n'est peint, mais le bas de la story ne
         remonte pas de 500 px pour un champ effacé — même convention
         que les champs de contenu vides, qui laissent un trou. */
      const titre = up(val("t_match_titre"));
      anton(100);
      const tl = splitBalanced(titre || TEXTE_DEF.t_match_titre, 3, (s) =>
        ctx.measureText(s).width,
      );
      /* Plancher à 24 et non plus à 120 : un titre saisi au maximum des
         24 caractères DOIT rétrécir jusqu'à tenir plutôt que de sortir
         du cadre. Sur « JOUR DE MATCH. » le fit s'arrête bien avant le
         plancher — la valeur d'origine sort au pixel près. Même raison
         partout où un texte fixe est devenu saisissable. */
      const size = Math.min(...tl.map((L) => fit(L, anton, W - X - 50, 220, 24)));
      const lh = size * interligne(tl, 0.96);
      let y = 390 + size;
      if (titre) {
        ctx.fillStyle = "#fff";
        anton(size);
        tl.forEach((L, i) => {
          if (i === tl.length - 1) redDot(L, X, y + i * lh);
          else ctx.fillText(L, X, y + i * lh);
        });
      }
      y += (tl.length - 1) * lh;
      if (titre) {
        ctx.fillStyle = INK;
        ctx.fillRect(X, y + 56, 110, 10);
      }

      // VS + adversaire — ÉCART 3 : un « VS » seul n'a pas de sens,
      // le bloc entier disparaît si l'adversaire n'est pas saisi.
      const yy = y + 150;
      const adv = up(val("f_adv"));
      if (adv) {
        outfit(800, 42);
        ctx.fillStyle = INK;
        ctx.fillText("VS", X, yy);
        const vsw = ctx.measureText("VS ").width;
        ctx.fillStyle = "#fff";
        fit(adv, (s) => outfit(800, s), W - X - 60 - vsw, 58, 30);
        ctx.fillText(adv, X + vsw + 8, yy);
      }
      outfit(600, 40);
      ctx.fillStyle = "#fff";
      ctx.fillText(up(val("f_date")), X, yy + 76);
      outfit(400, 34);
      ctx.fillStyle = SEC;
      ctx.fillText(up(val("f_lieu")), X, yy + 134);

      dots(X, 1330, 270, 150, 18, "#fff", 0.16);
      wordmark(W - 60, 1556, 200, "right");
      grain(0.09);
    },

    /* 2 — RÉSULTAT : plein cadre N&B, verdict incliné, tableau de score */
    resultat() {
      ctx.drawImage(
        pp(W, H, {
          con: 1.24,
          stops: [
            [0, 17, 19, 23],
            [0.55, 96, 101, 112],
            [1, 252, 252, 255],
          ],
        }),
        0,
        0,
        W,
        H,
      );
      ctx.fillStyle = "rgba(17,19,23,.30)";
      ctx.fillRect(0, 0, W, H);
      protect(880, 0.94);
      vignette(0.45);

      const sn = parseInt(val("f_sn") || "0", 10);
      const se = parseInt(val("f_se") || "0", 10);

      const surR = up(val("t_res_sur"));
      if (surR) {
        ctx.fillStyle = SEC;
        fitTrk(surR, (s) => outfit(600, s), 10, 940, 30, 16);
        trk(surR, W / 2, 366, 10, "center");
      }

      // ÉCART 3 : « VS — » retiré ; sans adversaire, la ligne ne s'écrit pas.
      const adv = up(val("f_adv"));
      if (adv) {
        const advTxt = "VS " + adv;
        fit(advTxt, (s) => outfit(800, s), 900, 54, 28);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(advTxt, W / 2, 446);
        ctx.textAlign = "left";
      }

      /* LE VERDICT.
         Le rendu ne calcule RIEN et ne connaît aucune règle de verdict :
         il lit `f_verdict` comme il lit n'importe quel texte, et ne
         peint rien si c'est vide. C'est v(), côté composant, qui sert
         le calcul tant que l'athlète n'a rien surchargé et sa saisie
         ensuite (voir verdictDirty).

         La COULEUR, elle, reste au calcul et ne suit jamais le texte :
         écrire « VICTOIRE. » sous un score perdu ne rend pas la story
         accent. Le point final garde sa couleur d'accent dans les deux
         cas — c'est la signature de marque, pas une mise en valeur du
         résultat. */
      const verdict = up(val("f_verdict"));
      if (verdict) {
        anton(100);
        const lines = splitBalanced(verdict, 2, (s) => ctx.measureText(s).width);
        const size = Math.min(...lines.map((L) => fit(L, anton, 940, 300, 24)));
        anton(size);
        const lh = size * interligne(lines, 0.94);
        ctx.save();
        ctx.translate(W / 2, 870);
        ctx.rotate((-3.2 * Math.PI) / 180);
        ctx.fillStyle = sn > se ? INK : "#fff";
        lines.forEach((L, i) => {
          const y = lines.length === 2 ? (i - 0.5) * lh + size * 0.32 : size * 0.36;
          redDot(L, 0, y, "center");
        });
        const by = (lines.length === 2 ? 0.5 * lh + size * 0.32 : size * 0.36) + 52;
        ctx.fillStyle = INK;
        ctx.fillRect(-150, by, 300, 12);
        ctx.restore();
      }

      /* v2.3 — CHAQUE CHIFFRE CENTRÉ SUR L'AXE DE SON LIBELLÉ.
         La référence calait le score de gauche à DROITE sur x=470 et
         celui de droite à GAUCHE sur x=610 : les deux nombres se
         serraient contre la barre oblique et s'éloignaient de « NOUS »
         et « EUX », centrés eux sur 380 et 700. Ça ne se voyait pas à
         22-2 — un chiffre de chaque côté — et ça sautait aux yeux dès
         qu'un score passait à deux ou trois chiffres. Les libellés sont
         les axes ; les scores s'y centrent.

         v2.3.2 — LA BARRE SUIT, ELLE AUSSI.
         Elle était restée à 540 : le milieu des DEUX AXES, qui n'est le
         milieu de rien dès que les deux scores n'ont pas la même largeur.
         À 22-2, « 22 » déborde vers la droite jusqu'à ~470 et « 2 »
         s'arrête à ~665 — le vide va de 470 à 665, son centre est à 567,
         et la barre plantée à 540 paraît collée au 22. C'est le même
         défaut que la v2.3 a corrigé sur les chiffres, laissé à
         mi-chemin.

         Le milieu VISUEL n'est pas entre les axes, il est entre les
         BORDS : bord droit du score NOUS, bord gauche du score EUX. Les
         deux se mesurent, la barre se pose au milieu. À scores de même
         largeur les deux bords sont symétriques et le calcul REDONNE
         540 — 2-2 sort au pixel près comme avant. */
      const ys = 1400;
      anton(230);
      const bordN = 380 + ctx.measureText(String(sn)).width / 2;
      const bordE = 700 - ctx.measureText(String(se)).width / 2;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(String(sn), 380, ys);
      /* LE SEUL MUT QUI RESTE DANS LE RENDU — ÉCART 12.
         Ici le gris n'atténue pas : il OPPOSE. C'est le seul signe qui
         distingue notre score du leur, à taille et à position égales.
         Le passer en blanc ou en accent avec le reste du texte
         secondaire donnerait deux nombres identiques. */
      ctx.fillStyle = MUT;
      ctx.fillText(String(se), 700, ys);
      ctx.textAlign = "left";
      ctx.save();
      ctx.translate((bordN + bordE) / 2, ys - 80);
      ctx.rotate(0.3);
      ctx.fillStyle = INK;
      ctx.fillRect(-7, -105, 14, 210);
      ctx.restore();
      ctx.fillStyle = SEC;
      const nous = up(val("t_res_nous"));
      if (nous) {
        fitTrk(nous, (s) => outfit(600, s), 8, 300, 28, 14);
        trk(nous, 380, ys + 64, 8, "center");
      }
      const eux = up(val("t_res_eux"));
      if (eux) {
        fitTrk(eux, (s) => outfit(600, s), 8, 300, 28, 14);
        trk(eux, 700, ys + 64, 8, "center");
      }

      scratches(7, 5, 0.06);
      grain(0.13);
      wordmark(W / 2, 1556, 190, "center");
    },

    /* 3 — MES STATS : photo plein cadre, colonne de verre à GAUCHE.

       v2.2 — refonte complète. Le cadre photo posé dans une page sombre
       est remplacé par l'inverse : la photo prend tout, et le texte vient
       vivre dans une colonne translucide par-dessus (voir colonneVerre).
       Tout le contenu est empilé et centré dans cette colonne, les
       valeurs en Anton géant à la verticale.

       La colonne est à GAUCHE, celle de `prochain` est à droite : c'est
       ce qui distingue les deux dans le sélecteur. Voir ÉCART 10. */
    stats() {
      const CW = 440;
      const cx = CW / 2;
      const ph = pp(W, H, { con: 1.14, stops: accDuo() });
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(ph, 0, 0, W, H);
      vignette(0.38);
      colonneVerre(0, CW, ph);

      const surS = up(val("t_stats_sur"));
      if (surS) {
        ctx.fillStyle = SEC;
        fitTrk(surS, (s2) => outfit(600, s2), 10, CW - 80, 30, 14);
        trk(surS, cx, 420, 10, "center");
      }

      const nom = up(val("f_nom"));
      if (nom) {
        anton(fit(nom, anton, CW - 60, 88, 24));
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(nom, cx, 506);
        ctx.textAlign = "left";
      }

      const sp = [up(val("f_sport")), up(val("f_pos"))].filter(Boolean).join("  ·  ");
      if (sp) {
        ctx.fillStyle = SEC2;
        fitTrk(sp, (s2) => outfit(600, s2), 4, CW - 80, 28, 13);
        trk(sp, cx, 562, 4, "center");
      }

      ctx.fillStyle = INK;
      ctx.fillRect(cx - 40, 606, 80, 8);

      const rows = (
        [
          ["f_s1v", "f_s1l"],
          ["f_s2v", "f_s2l"],
          ["f_s3v", "f_s3l"],
        ] as [string, string][]
      )
        .map(([a, b]) => [val(a), val(b)])
        .filter((r) => r[0] && r[1])
        .slice(0, 3);

      /* Le bloc de stats est RECENTRÉ sur la place des trois : avec une
         ou deux stats, il descend de la moitié du pas manquant au lieu
         de laisser un trou sous le wordmark. C'est le seul endroit de la
         page où une absence déplace quelque chose — ailleurs la règle
         est l'inverse (ÉCART 3). Elle vaut ici parce que ces lignes sont
         une LISTE : trois valeurs tassées en haut d'une colonne vide se
         lisent comme un rendu inachevé. */
      /* 812 et non 782 : la hauteur de capitale d'Anton à 200 px fait
         144, donc le premier chiffre MONTE de 144 px au-dessus de sa
         ligne de base et venait toucher le filet d'accent. Le calcul se
         fait sur le sommet des glyphes, pas sur la ligne de base. */
      const PAS = 300;
      let y = 812 + ((3 - rows.length) * PAS) / 2;
      rows.forEach((r, i) => {
        anton(fit(r[0], anton, CW - 70, 200, 40));
        ctx.fillStyle = i === 0 ? INK : "#fff";
        ctx.textAlign = "center";
        ctx.fillText(r[0], cx, y);
        ctx.textAlign = "left";
        const lab = up(r[1]);
        ctx.fillStyle = SEC2;
        fitTrk(lab, (s2) => outfit(600, s2), 6, CW - 80, 28, 13);
        trk(lab, cx, y + 54, 6, "center");
        y += PAS;
      });

      wordmark(cx, 1556, 180, "center");
      grain(0.08);
    },

    /* 4 — PROCHAIN MATCH : l'annonce, colonne de verre à DROITE.

       v2.2 — le pendant de « Jour de match », avant le jour J. Même
       composition en colonne que `stats`, MIROITÉE : c'est ce qui les
       sépare d'un coup d'œil dans le sélecteur (ÉCART 10).

       Aucun logo d'équipe, aucune marque tierce : l'adversaire est du
       TEXTE saisi, comme l'était la ligue de feu la jaquette. */
    prochain() {
      const CW = 440;
      const X0 = W - CW;
      const cx = X0 + CW / 2;
      const ph = pp(W, H, { con: 1.14, stops: accDuo() });
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(ph, 0, 0, W, H);
      vignette(0.38);
      colonneVerre(X0, CW, ph);

      /* v2.3 — FLUX VERTICAL, PLUS DE LIGNES DE BASE EN DUR.

         Chaque bloc était posé à un y fixe (430, 700, 852, 952, 1022),
         calculé pour « VEN 12 SEPT » sur deux lignes. Une date courte
         tenait sur UNE ligne et laissait alors un trou de 150 px sous
         l'eyebrow, tandis que le filet d'accent, lui, ne bougeait pas.
         Le défaut n'était visible qu'en changeant de date — d'où le
         correctif.

         Les blocs se MESURENT maintenant et s'empilent : chacun déclare
         sa hauteur et sait se peindre à partir d'un sommet, un espacement
         constant les sépare, et la pile entière est centrée dans la zone
         utile de la colonne. Ajouter ou retirer un bloc ne demande plus
         de recalculer quoi que ce soit.

         Les hauteurs sont des hauteurs de CAPITALE (0,72 × la taille) et
         non des tailles de fonte : tout est en majuscules ici, et une
         taille de fonte compterait un jambage qu'aucun glyphe n'occupe.
         La leçon est la même que sur `badges` — on empile ce qui se voit,
         pas ce que la fonte déclare. */
      const CAP = 0.72;
      const GAP = 46;
      /** Zone utile : sous la zone réservée d'Instagram, au-dessus du
       *  nom et du wordmark, qui restent ancrés au pied de la colonne. */
      const ZONE_HAUT = 320;
      const ZONE_BAS = 1400;

      type Bloc = { h: number; peint: (haut: number) => void };
      const blocs: Bloc[] = [];

      const surP = up(val("t_prochain_sur"));
      if (surP) {
        const sz = fitTrk(surP, (s2) => outfit(600, s2), 10, CW - 80, 30, 14);
        blocs.push({
          h: sz * CAP,
          peint: (haut) => {
            ctx.fillStyle = SEC;
            fitTrk(surP, (s2) => outfit(600, s2), 10, CW - 80, 30, 14);
            trk(surP, cx, haut + sz * CAP, 10, "center");
          },
        });
      }

      /* La date en héros. Deux lignes au plus : « VEN 12 SEPT » tient
         mal sur une seule dans 440 px de colonne, et le partage équilibré
         donne « VEN 12 » / « SEPT ». Une date courte reste sur une ligne
         et la pile se resserre d'autant. */
      const dt = up(val("f_pdate"));
      if (dt) {
        anton(100);
        const dl = splitBalanced(dt, 2, (t) => ctx.measureText(t).width);
        const ds = Math.min(...dl.map((L) => fit(L, anton, CW - 60, 152, 24)));
        const dlh = ds * interligne(dl, 0.96);
        blocs.push({
          h: (dl.length - 1) * dlh + ds * CAP,
          peint: (haut) => {
            anton(ds);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            dl.forEach((L, i) => ctx.fillText(L, cx, haut + ds * CAP + i * dlh));
            ctx.textAlign = "left";
          },
        });
        // le filet suit la date : sans date, pas de filet suspendu
        blocs.push({
          h: 8,
          peint: (haut) => {
            ctx.fillStyle = INK;
            ctx.fillRect(cx - 40, haut, 80, 8);
          },
        });
      }

      const hr = up(val("f_heure"));
      if (hr) {
        const sz = fit(hr, (s2) => outfit(800, s2), CW - 70, 58, 20);
        blocs.push({
          h: sz * CAP,
          peint: (haut) => {
            outfit(800, sz);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText(hr, cx, haut + sz * CAP);
            ctx.textAlign = "left";
          },
        });
      }

      // ÉCART 3 : pas d'adversaire, pas de « VS » orphelin.
      const adv = up(val("f_adv"));
      if (adv) {
        const txtv = "VS " + adv;
        const sz = fit(txtv, (s2) => outfit(800, s2), CW - 60, 48, 18);
        blocs.push({
          h: sz * CAP,
          peint: (haut) => {
            outfit(800, sz);
            ctx.fillStyle = INK;
            ctx.textAlign = "center";
            ctx.fillText(txtv, cx, haut + sz * CAP);
            ctx.textAlign = "left";
          },
        });
      }

      const lieu = up(val("f_lieu"));
      if (lieu) {
        const sz = fitTrk(lieu, (s2) => outfit(600, s2), 5, CW - 80, 28, 13);
        blocs.push({
          h: sz * CAP,
          peint: (haut) => {
            ctx.fillStyle = SEC2;
            fitTrk(lieu, (s2) => outfit(600, s2), 5, CW - 80, 28, 13);
            trk(lieu, cx, haut + sz * CAP, 5, "center");
          },
        });
      }

      if (blocs.length) {
        const total =
          blocs.reduce((a, b) => a + b.h, 0) + GAP * (blocs.length - 1);
        let y = ZONE_HAUT + (ZONE_BAS - ZONE_HAUT - total) / 2;
        blocs.forEach((b) => {
          b.peint(y);
          y += b.h + GAP;
        });
      }

      const nomP = up(val("f_nom"));
      if (nomP) {
        ctx.fillStyle = "#fff";
        fitTrk(nomP, (s2) => outfit(600, s2), 8, CW - 80, 30, 14);
        trk(nomP, cx, 1478, 8, "center");
      }

      wordmark(cx, 1524, 180, "center");
      grain(0.08);
    },

    /* 5 — MON ÉQUIPE : polaroid centré, composition symétrique */
    equipe() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      if (o.icon) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.drawImage(
          o.icon,
          W / 2 - 430,
          520,
          860,
          (860 * o.icon.naturalHeight) / o.icon.naturalWidth,
        );
        ctx.restore();
      }
      wordmark(W / 2, 286, 180, "center");
      ctx.fillStyle = SEC;
      const surE = up(val("t_equipe_sur"));
      if (surE) {
        fitTrk(surE, (s) => outfit(600, s), 10, 940, 28, 16);
        trk(surE, W / 2, 398, 10, "center");
      }

      const pw = 704;
      const ph = 780;
      const pad = 26;
      const bot = 130;
      const cw = pw + pad * 2;
      const chh = pad + ph + bot;
      const pcy = 430 + chh / 2;
      const prot = (-2.4 * Math.PI) / 180;
      ctx.save();
      ctx.translate(W / 2, pcy);
      ctx.rotate(prot);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-cw / 2, -chh / 2, cw, chh);
      ctx.drawImage(
        pp(pw, ph, { sat: 0.55, con: 1.08, cool: true }),
        -cw / 2 + pad,
        -chh / 2 + pad,
        pw,
        ph,
      );
      outfit(700, 52);
      ctx.fillStyle = "#16181d";
      ctx.textAlign = "center";
      ctx.fillText(up(val("f_prenom")), 0, -chh / 2 + pad + ph + 84);
      ctx.textAlign = "left";
      ctx.restore();

      /* v2.3.2 — LE TITRE SE POSE SOUS LE POLAROÏD, PAS À UN y CONNU.
         Il était à 1520, une constante juste une fois : pour une taille
         de titre donnée. Anton se réduit quand le nom d'équipe s'allonge
         — « LES CENTAURES DE REPENTIGNY. » tombe bien en dessous de 160 —
         et le titre remontait alors vers la légende du polaroïd, jusqu'à
         la toucher. À 160, il ne restait déjà que ~23 px entre le carton
         et la capitale.

         Le carton est INCLINÉ de 2,4° : son coin bas-gauche descend plus
         bas que son bord. Le bas réel d'un rectangle tourné de θ autour
         de son centre, c'est |w/2·sinθ| + |h/2·cosθ| — pas h/2. Ignorer
         la rotation, c'est croire le carton 16 px plus haut qu'il n'est,
         et ce sont précisément les 16 px qui manquaient.

         De là, une marge FIXE, puis la hauteur de capitale RÉELLE du
         titre (actualBoundingBoxAscent, pas un ratio deviné) : l'air
         au-dessus du titre ne dépend donc plus de sa taille. La
         sous-ligne suit le titre au lieu de suivre le canvas, sinon
         elle rattraperait ce que le titre vient de descendre.

         Et avec ou sans prénom dans la légende ? Le prénom est peint
         DANS le carton, au-dessus de son bord bas : il ne change ni la
         hauteur du carton ni ce calcul. C'est le but — la même air dans
         les deux cas, au lieu d'un y qui n'était juste que dans un. */
      const basPola =
        pcy + Math.abs((cw / 2) * Math.sin(prot)) + Math.abs((chh / 2) * Math.cos(prot));
      const AIR_TITRE = 70;

      // ÉCART 3 : « MON ÉQUIPE. » n'est plus peint par défaut. Le titre
      // vide garde quand même son gabarit de mesure, pour que la
      // sous-ligne ne remonte pas d'un bloc.
      let eq = up(val("f_eqnom"));
      if (eq && !eq.endsWith(".")) eq += ".";
      const ts = eq ? fit(eq, anton, 880, 160, 80) : 160;
      anton(ts);
      const capTitre =
        ctx.measureText(eq || "H").actualBoundingBoxAscent || ts * 0.73;
      const yTitre = basPola + AIR_TITRE + capTitre;
      if (eq) {
        ctx.fillStyle = "#fff";
        redDot(eq, W / 2, yTitre, "center");
      }
      const sub = [up(val("f_sport")), up(val("f_saison"))].filter(Boolean).join("  ·  ");
      outfit(600, 34);
      ctx.fillStyle = SEC;
      trk(sub, W / 2, yTitre + 64, 10, "center");
      grain(0.06);
    },

    /* 4 — NOUVEAU POST : mur typographique en écho sur photo sombre */
    post() {
      ctx.drawImage(
        pp(W, H, {
          con: 1.18,
          stops: [
            [0, 10, 11, 14],
            [0.6, 64, 68, 78],
            [1, 208, 212, 220],
          ],
        }),
        0,
        0,
        W,
        H,
      );
      ctx.fillStyle = "rgba(17,19,23,.28)";
      ctx.fillRect(0, 0, W, H);
      vignette(0.62);

      // ÉCART 3 : le nom et son filet forment un seul bloc — un filet
      // rouge suspendu au-dessus du vide serait un défaut visible.
      const nom = up(val("f_nom"));
      if (nom) {
        outfit(600, 32);
        ctx.fillStyle = "#fff";
        trk(nom, 70, 356, 9, "left");
        ctx.fillStyle = INK;
        ctx.fillRect(70, 384, 64, 7);
      }

      /* Le mur en écho est UNE seule ligne répétée cinq fois : pas de
         découpage ici, le fit encaisse la longueur. Titre vide, on
         mesure quand même l'original — `y` sert d'ancrage à la ligne
         encadrée plus bas. */
      const titreP = up(val("t_post_titre"));
      const size = fit(titreP || TEXTE_DEF.t_post_titre, anton, 940, 180, 24);
      const lh = size * 1.02;
      let y = 470 + size;
      const alphas = [0.3, 0.6, 1, 0.6, 0.35];
      for (let i = 0; i < 5; i++) {
        if (titreP) {
          anton(size);
          if (i === 2) {
            ctx.fillStyle = INK;
            ctx.fillText(titreP, 68, y);
          } else {
            ctx.strokeStyle = "rgba(255,255,255," + alphas[i] + ")";
            ctx.lineWidth = 2.5;
            ctx.strokeText(titreP, 68, y);
          }
        }
        y += lh;
      }

      const obj = up(val("f_ligne"));
      if (obj) {
        outfit(800, 46);
        const words = obj.split(/\s+/);
        const linesArr: string[] = [];
        let cur = "";
        words.forEach((w) => {
          const t = cur ? cur + " " + w : w;
          if (ctx.measureText(t).width > 720 && cur) {
            linesArr.push(cur);
            cur = w;
          } else cur = t;
        });
        if (cur) linesArr.push(cur);
        ctx.save();
        ctx.translate(W / 2, Math.min(y + 56, 1480));
        ctx.rotate((-2 * Math.PI) / 180);
        let maxW2 = 0;
        linesArr.slice(0, 2).forEach((L, i) => {
          const w = ctx.measureText(L).width;
          maxW2 = Math.max(maxW2, w);
          ctx.fillStyle = "#fff";
          ctx.fillRect(-w / 2 - 30, i * 86 - 52, w + 60, 74);
          ctx.fillStyle = BG;
          ctx.fillText(L, -w / 2, i * 86);
        });
        const ax = Math.min(maxW2 / 2 + 76, 470);
        ctx.strokeStyle = "rgba(255,255,255,.75)";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ax, 4);
        ctx.lineTo(ax, -48);
        ctx.moveTo(ax - 14, -32);
        ctx.lineTo(ax, -48);
        ctx.lineTo(ax + 14, -32);
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();
      }

      scratches(12, 4, 0.05);
      grain(0.17);
      wordmark(70, 1560, 190, "left");
    },

    /* 6 — VOIS MON PROFIL : photo haute duotone, le nom en héros.

       v2.3.1 — LE MUR MOSAÏQUE EST RETIRÉ ; ce rendu-ci revient.

       Repris de la v2.2 tel quel : la photo sur 1010 px fondue au noir, le
       surtitre « MON PROFIL EST SUR NEXUS » et son filet d'accent, le nom
       en Anton sur une ou deux lignes avec le point de marque, la
       sous-ligne sport · position · école, le wordmark et l'adresse au
       pied. Une nouvelle référence viendra plus tard.

       CE QUI S'Y AJOUTE — LE NUMÉRO. `f_num` n'existait pas quand ce
       dessin était en place : il est arrivé avec la mosaïque, logé dans
       une tuile. Le champ reste, ce rendu doit donc l'accueillir. Il se
       pose sur la MÊME ligne de base que la dernière ligne du nom, aligné
       à droite, en couleur d'accent — le nom à gauche, le numéro à
       droite, comme au dos d'un maillot. C'est ce qu'annonçait le
       commentaire de la v2.1 : « il se colle au nom ».

       La collision se règle AVANT le fit, pas après : le numéro est mesuré
       d'abord, et ce qui reste borne le nom. Sans ça, un nom long fitté
       sur 940 px chevaucherait un numéro à trois chiffres, et son fit ne
       s'en apercevrait jamais — il mesure le nom, pas le voisinage.

       ÉCART 4 — les cinq étoiles dorées ne reviennent pas avec le reste :
       elles sont parties avec leur champ à la v2.2, et `etoiles` est le
       gabarit qui les porte. */
    profil() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      const ph3 = 1010;
      ctx.drawImage(pp(W, ph3, { con: 1.16, stops: accDuo() }), 0, 0, W, ph3);
      const gp = ctx.createLinearGradient(0, ph3 - 340, 0, ph3);
      gp.addColorStop(0, "rgba(17,19,23,0)");
      gp.addColorStop(1, "#111317");
      ctx.fillStyle = gp;
      ctx.fillRect(0, ph3 - 340, W, 340);

      /* ÉCART 12 (v2.3.3) — ce surtitre et l'adresse au pied étaient en
         blanc plein. Même rôle que `t_match_sur` et qu'ATTRIBUTION_PIED,
         donc même règle : ils suivent le sélecteur. Le filet d'accent
         dessous, lui, reste de l'accent — c'est une signature de marque,
         pas du texte. */
      outfit(600, 34);
      ctx.fillStyle = SEC;
      trk("MON PROFIL EST SUR NEXUS", 70, 1046, 9, "left");
      ctx.fillStyle = INK;
      ctx.fillRect(70, 1074, 84, 8);

      /* LE NUMÉRO D'ABORD — c'est lui qui décide de la place du nom.
         Sa taille est fixe, indépendante de celle du nom : un numéro qui
         grandirait avec le nom cesserait de se lire comme un numéro. */
      const numP = up(val("f_num")).slice(0, 3);
      let resteNom = 940;
      let sNum = 0;
      if (numP) {
        sNum = fit(numP, anton, 210, 132, 56);
        anton(sNum);
        resteNom = 940 - ctx.measureText(numP).width - 44;
      }

      /** Ligne de base de la DERNIÈRE ligne du nom — celle que le numéro
       *  partage. Elle vaut 1420 dans tous les cas : sur deux lignes,
       *  c'est la première qui remonte, pas la seconde qui descend. */
      const baseNom = 1420;
      const nomP = up(val("f_nom"));
      if (nomP) {
        const parts = nomP.split(/\s+/);
        const lines =
          parts.length > 1 ? [parts[0], parts.slice(1).join(" ") + "."] : [nomP + "."];
        let s = Math.min(...lines.map((Lz) => fit(Lz, anton, resteNom, 230, 90)));
        if (lines.length === 2) s = Math.min(s, 150);
        anton(s);
        const lhp = s * 0.96;
        const b = lines.length === 2 ? baseNom - lhp : baseNom;
        ctx.fillStyle = "#fff";
        lines.forEach((Lz, i) => {
          const yv = b + i * lhp;
          if (i === lines.length - 1) redDot(Lz, 66, yv);
          else ctx.fillText(Lz, 66, yv);
        });
      }
      if (numP) {
        anton(sNum);
        ctx.fillStyle = INK;
        ctx.textAlign = "right";
        ctx.fillText(numP, W - 70, baseNom);
        ctx.textAlign = "left";
      }

      /* La v2.2 rétrécissait cette ligne avec une boucle écrite à la main,
         `sz -= 2` tant que largeur + longueur × 5 dépassait 940. C'est
         exactement ce que `fitTrk` fait — il a été extrait pour ça — en
         pas de 1 et en comptant les gaps sur les POINTS DE CODE, ce que la
         boucle faisait sur `.length`. Même rendu à 1 px près sur tout ce
         qui rentrait déjà, et juste sur une sous-ligne accentuée. */
      const sub = [up(val("f_sport")), up(val("f_pos")), up(val("f_ecole"))]
        .filter(Boolean)
        .join("  ·  ");
      if (sub) {
        fitTrk(sub, (s2) => outfit(600, s2), 5, 940, 30, 18);
        ctx.fillStyle = SEC;
        trk(sub, 70, 1482, 5, "left");
      }

      wordmark(70, 1592, 180, "left");
      outfit(600, 30);
      ctx.fillStyle = SEC;
      trk("NEXUSSPORTS.CA", 1010, 1634, 7, "right");
      grain(0.08);
    },

    /* 7 — MES ÉTOILES : cinq étoiles sur une photo noir et blanc.

       v2.3 — porté de la référence. Photo plein cadre en N&B contrasté
       (les mêmes arrêts que `resultat`), protect + vignette, la rangée
       d'étoiles en or géante, et le titre « n ÉTOILES. » en Anton.

       CE QUI A CHANGÉ AU PORT :
       · la référence borne à 1..5 et retombe sur 5 quand le champ est
         vide — donc elle peint TOUJOURS des étoiles, y compris pour un
         athlète qui n'a rien saisi. Ici le plancher est 0, et 0 ne peint
         PAS d'étoile : « 0 ÉTOILE. » serait une déclaration, pas une
         absence.
       · l'or #F59E0B est conservé tel quel (ÉCART 4).
       · v2.3.4 — le titre ne dit plus le NOMBRE, il dit QUI : les étoiles
         portent le compte à elles seules, le titre porte « POSITION ·
         #NUMÉRO ». Voir le bloc dans le corps. */
    etoiles() {
      ctx.drawImage(
        pp(W, H, {
          con: 1.24,
          stops: [
            [0, 17, 19, 23],
            [0.55, 96, 101, 112],
            [1, 252, 252, 255],
          ],
        }),
        0,
        0,
        W,
        H,
      );
      ctx.fillStyle = "rgba(17,19,23,.25)";
      ctx.fillRect(0, 0, W, H);
      protect(680, 0.97);
      vignette(0.4);

      /* ═══ v2.3.4 — LES ÉTOILES COMPTENT, LE TITRE NOMME ════════════════
         La rangée d'or est RESTÉE (5 × 148 px, `star5` et #F59E0B repris
         du commit 1016fe7 au caractère près). Ce qui a changé, c'est ce
         que dit le titre en dessous : il disait « 4 ÉTOILES. », il dit
         maintenant « RECEVEUR · #4. ».

         POURQUOI. Le gabarit peignait la cote DEUX fois — quatre étoiles
         de 148 px, puis le même nombre écrit en Anton 190. La plus
         grande des deux suffit : une rangée d'étoiles se compte d'un coup
         d'œil, c'est même tout ce qu'elle sait faire. Le titre récupère
         donc la place et dit ce que la story ne disait NULLE PART sur ce
         gabarit — la position et le numéro.

         Les étoiles restent pilotées par `f_etoiles` seul, et 0 ne peint
         toujours rien (voir plus haut : « 0 ÉTOILE. » serait une
         déclaration, pas une absence). Le titre, lui, ne dépend plus du
         tout du nombre d'étoiles : on peut porter un numéro sans cote, et
         une cote sans numéro.

         LE BLOC EST UNE PILE, MONTÉE DEPUIS LE TITRE. Le titre ne bouge
         pas (1420) : c'est l'ancre, et le seul nombre en dur de ce bloc.
         Au-dessus, chaque étage se pose par rapport à la CAPITALE MESURÉE
         de celui du dessous — et la mesure compte ici plus qu'avant : le
         titre était une chaîne courte à taille FIXE (« 4 ÉTOILES. »), il
         est maintenant une position qui peut aller de « K · #9. » à
         « LIGNE OFFENSIVE · #99. ». Le fit le réduit, sa capitale change,
         et toute la pile suit au lieu de se décoller.

         Aux valeurs nominales — Anton 190, cinq étoiles — la pile REDONNE
         la composition d'avant : surtitre à 1010, étoiles centrées à 1150.
         Ce n'est pas une coïncidence, les deux airs ont été choisies pour
         ça ; c'est la vérification que la pile n'a rien déplacé.

         Champs vides : rien n'est peint et le surtitre se rapproche des
         étoiles d'autant. C'est la seule entorse à la convention de
         l'ÉCART 3 (« un champ vide laisse un trou ») et elle est
         demandée : ici le trou serait un trou de 140 px au milieu de la
         pile, pas un décalage d'un bloc. */
      const Y_TITRE_E = 1420;
      const R_ETOILE = 74;
      const PAS_ETOILE = 172;
      /** LA POINTE BASSE D'UNE ÉTOILE, PAS LE BAS DE SA BOÎTE.
       *
       *  Une étoile à cinq branches, pointe en haut, ne remplit pas son
       *  cercle : elle monte à −r mais ne descend qu'à +r·sin(54°), soit
       *  0,809 r. Compter l'air depuis la boîte la poserait 14 px plus
       *  haut qu'annoncé, et c'est la sorte d'écart qu'on ne retrouve
       *  jamais ensuite. Vérifié au pixel sur le rendu : l'encre de la
       *  rangée fait bien 134 px de haut pour r = 74, pas 148. */
      const BAS_ETOILE = R_ETOILE * 0.809;
      /** Pointe basse des étoiles → capitale du titre. */
      const AIR_ETOILES_TITRE_E = 45;
      /** Étage du dessus → ligne de base du surtitre. */
      const AIR_SUR_E = 66;

      /* LE TITRE — POSITION · #NUMÉRO.
         La position vient de la taxonomie (ÉCART 9 : `val()` résout
         « Autre » vers la saisie libre), le numéro est le `f_num` de
         `profil` — le MÊME champ, pas un second, sinon un athlète le
         saisirait deux fois pour la même information. L'un sans l'autre
         se peint seul ; les deux vides ne peignent rien.

         Le point final part en couleur d'accent, par redDot, comme tous
         les titres de la page. */
      const posE = up(val("f_pos"));
      const numE = up(val("f_num")).slice(0, 3);
      /* Séparateur à UNE espace, pas les deux du reste de la page. Les
         « A · B » d'ailleurs sont en Outfit INTERLETTRÉ, où la double
         espace se fond dans l'écartement général ; en Anton serré et sans
         interlettrage, elle ouvre un trou de 60 px au milieu du titre. */
      let titreE = [posE, numE ? "#" + numE : ""].filter(Boolean).join(" · ");
      if (titreE && !titreE.endsWith(".")) titreE += ".";

      /* ÉCART 3 — titre vide, on mesure quand même un gabarit : la pile
         ne s'effondre pas sur un athlète qui n'a rempli ni l'un ni
         l'autre. */
      const sTitreE = titreE ? fit(titreE, anton, 940, 190, 60) : 190;
      anton(sTitreE);
      const capTitreE =
        ctx.measureText(titreE || "RECEVEUR.").actualBoundingBoxAscent || sTitreE * 0.73;
      const hautTitreE = Y_TITRE_E - capTitreE;

      const raw = val("f_etoiles");
      const n = raw ? clamp(parseInt(raw, 10) || 0, 0, 5) : 0;

      /* LA RANGÉE D'OR. Elle vit entre le surtitre et le titre, et c'est
         elle qui porte le compte — seule. */
      let hautBlocE = hautTitreE;
      if (n > 0) {
        const cyE = hautTitreE - AIR_ETOILES_TITRE_E - BAS_ETOILE;
        for (let i = 0; i < n; i++) {
          star5(W / 2 + (i - (n - 1) / 2) * PAS_ETOILE, cyE, R_ETOILE, 0.45);
          ctx.fillStyle = OR;
          ctx.fill();
        }
        hautBlocE = cyE - R_ETOILE;
      }

      outfit(600, 30);
      ctx.fillStyle = SEC;
      trk("SUR NEXUS, JE SUIS", W / 2, hautBlocE - AIR_SUR_E, 10, "center");

      if (titreE) {
        anton(sTitreE);
        ctx.fillStyle = "#fff";
        redDot(titreE, W / 2, Y_TITRE_E, "center");
      }

      const nomE = up(val("f_nom"));
      if (nomE) {
        outfit(600, 34);
        ctx.fillStyle = "#fff";
        trk(nomE, W / 2, 1500, 8, "center");
      }
      outfit(400, 28);
      ctx.fillStyle = SEC;
      trk("PROFIL COMPLET SUR NEXUSSPORTS.CA", W / 2, 1556, 4, "center");
      wordmark(W / 2, 1596, 170, "center");
      grain(0.13);
    },

    /* 8 — MES BADGES : la vitrine.

       v2.3 — porté de la référence. Photo désaturée et assombrie, halo
       d'accent radial, un badge héros en grand au centre, les autres en
       rangée réduite dessous.

       CE QUI A CHANGÉ AU PORT, et c'est l'essentiel :
       · la référence dessinait cinq icônes À LA MAIN dans un hexagone
         (hexBadge + badgeIcon). Ni l'un ni l'autre n'est porté : ce sont
         les VRAIS SVG du catalogue qui sont dessinés, la même géométrie
         que la fiche, contre-formes percées (ÉCART 4 et ÉCART 11). Un
         badge maison à côté d'un badge officiel, c'est deux badges
         différents pour la même distinction.
       · le modèle de données reste celui de la v2.2 : le PREMIER badge
         choisi devient le héros, les suivants forment la rangée. Le
         nombre, lui, a bougé — CINQ depuis la v2.3.2, soit le héros plus
         une rangée de QUATRE, ce que la référence dessine. À quatre
         cases la rangée n'en portait que trois : la composition n'était
         jamais atteinte, et la rangée réduite à 112 px la faisait passer
         pour une note de bas de page plutôt que pour la moitié du sujet.
         Voir BADGE_SLOTS.
       · le pied de la référence dit « PROFIL COMPLET SUR
         NEXUSSPORTS.CA » et le surtitre « BADGE DÉBLOQUÉ ». Le second
         est remplacé par « MES DISTINCTIONS » : « débloqué » affirme que
         le badge a été ATTRIBUÉ, ce que cette page ne peut pas garantir
         (ÉCART 4). Les deux lignes lues de haut en bas reconstituent
         alors exactement la ligne d'attribution actée — « MES
         DISTINCTIONS · PROFIL COMPLET SUR NEXUSSPORTS.CA » — sans
         l'écraser sur une seule ligne de 52 caractères. */
    badges() {
      ctx.drawImage(pp(W, H, { sat: 0.6, con: 1.16, cool: true }), 0, 0, W, H);
      ctx.fillStyle = "rgba(17,19,23,.45)";
      ctx.fillRect(0, 0, W, H);
      protect(500, 0.92);
      vignette(0.45);

      /* LA VITRINE A ÉTÉ REDESCENDUE D'UN CRAN (v2.3.2).
         La rangée du bas passe de 112 à 160 px et gagne une quatrième
         vignette ; le héros peut désormais porter une ligne de contexte
         sous son libellé. Ça fait ~125 px de plus à loger entre le badge
         héros et un pied qui, lui, ne bouge pas : le wordmark descend
         déjà jusqu'à 1666, à 4 px de la zone réservée Instagram.

         Le bloc entier remonte donc de 80 px. Toutes les ordonnées de ce
         gabarit sont nommées ici plutôt que semées dans le code : c'est
         une pile, chaque étage dépend du précédent, et la relire d'un
         bloc est la seule façon de voir qu'elle tient.

         v2.3.3 — le haut remonte de 22 px de plus, pour rendre au contexte
         l'air qui lui manquait (AIR_CTX passe de 20 à 42). Le bas, lui, ne
         bouge PAS : la rangée reste à 80 px de rayon, et c'est justement
         pour ça que les 22 px se prennent en haut — les descendre aurait
         forcé à rétrécir la rangée qu'on venait d'agrandir.

           774  nom de l'athlète
           830  « MES DISTINCTIONS »
           833  haut du héros          ┐ 430 px
          1048  centre du héros        │
          1263  bas du héros           ┘
          1350  libellé du héros (Anton ≤ 100, capitale ~73)
          1416  contexte du héros, s'il y en a un
          1438  haut de la rangée      ┐ 160 px
          1518  centre de la rangée    │
          1598  bas de la rangée       ┘
          1610  haut du wordmark       (→ 1663, calculé depuis Y_PIED)
          1646  ligne d'attribution    (Y_PIED)
          1670  zone réservée Instagram

         Les deux marges les plus serrées sont 1598 → 1610 (rangée /
         wordmark, et seulement sur les 60 px où ils se croisent en x) et
         1263 → 1277 (héros / capitale du libellé, inchangée depuis la
         v2.3). Tout ce qui grandirait encore ici doit passer par cette
         table, pas par un nombre ajusté sur place. */
      const HERO_CY = 1048;
      const HERO_R = 215;
      const Y_LIBELLE = 1350;
      /** Air sous la LIGNE DE BASE du libellé, au-dessus de la capitale du
       *  contexte. 20 px en v2.3.2 — les deux lignes se lisaient comme un
       *  bloc collé plutôt que comme un titre et sa précision. */
      const AIR_CTX = 42;
      /** Air au-dessus de la rangée. Deux valeurs parce que deux voisins :
       *  un titre en Anton 100 appelle plus d'air sous lui qu'une ligne
       *  d'Outfit 34. */
      const AIR_RANGEE_TITRE = 66;
      const AIR_RANGEE_CTX = 22;
      /* LA RANGÉE : 80 px de rayon au lieu de 56, et un pas de 200 px.
         Le pas n'est pas un réglage libre — c'est ce qui fait tenir
         QUATRE vignettes centrées : 3 × 200 + 160 = 760 px de large,
         soit de x=160 à x=920, dans les 940 px utiles entre les deux
         marges de 70. À l'ancien pas de 180 les vignettes agrandies se
         chevaucheraient de 20 px. Avec moins de quatre, la rangée reste
         centrée par construction (l'indice est compté depuis le milieu),
         elle est juste plus courte. */
      const ROW_R = 80;
      const ROW_PAS = 200;

      const nomB = up(val("f_nom"));
      if (nomB) {
        outfit(600, 32);
        ctx.fillStyle = "#fff";
        trk(nomB, W / 2, 774, 8, "center");
      }
      outfit(600, 28);
      ctx.fillStyle = SEC;
      trk(ATTRIBUTION_SUR, W / 2, 830, 10, "center");

      const codes = BADGE_SLOTS.map((k) => val(k))
        .filter(Boolean)
        .filter((c) => o.badges[c])
        .slice(0, MAX_BADGES_STORY);

      const cA = hexRgb(RED);
      const g = ctx.createRadialGradient(W / 2, HERO_CY, 40, W / 2, HERO_CY, 400);
      g.addColorStop(0, "rgba(" + cA.join(",") + ",.28)");
      g.addColorStop(1, "rgba(" + cA.join(",") + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(W / 2 - 400, HERO_CY - 400, 800, 800);

      if (codes.length) {
        // le héros : 430 px, le diamètre de l'hexagone de la référence
        const hero = o.badges[codes[0]];
        if (hero)
          ctx.drawImage(hero, W / 2 - HERO_R, HERO_CY - HERO_R, HERO_R * 2, HERO_R * 2);

        /* LE LIBELLÉ DU HÉROS, ET LE CAS CUSTOM.
           « Custom » est le nom que le CATALOGUE donne à la case, pas une
           distinction : peint sous un badge, il ne dirait rien à personne.
           C'est le texte de l'athlète qui tient lieu de libellé, seul —
           exactement la règle de la fiche (getBadgeLabel dans
           DistinctionBadge.tsx, branche `custom` / `nexus-x`).

           Et s'il n'a rien saisi ? RIEN n'est peint. La fiche retombe sur
           « Distinction » parce qu'une rangée de badges a besoin d'une
           légende sous chaque vignette ; ici le badge est en 430 px au
           centre de la vitrine, il se tient tout seul. ÉCART 3 : un champ
           vide ne peint pas. */
        const libelleHero =
          codes[0] === CODE_CUSTOM ? val(SLOT_CONTEXTE) : BADGE_LIBELLE[codes[0]] ?? "";
        const lbl = libelleHero ? up(libelleHero) + "." : "";

        /* L'AXE OPTIQUE DU LIBELLÉ (v2.3.3).

           Le contexte se peignait centré sur W/2, le libellé aussi — et
           les deux ne tombaient pourtant pas sur le même axe. La cause est
           dans redDot : il centre sur la largeur TOTALE, point de marque
           compris. Le point ne pèse rien à l'œil mais il pèse sa chasse
           dans le calcul, si bien que « MVP » se pose à une demi-chasse de
           point à GAUCHE du milieu — ~13 px sur un point d'Anton 100 —
           pendant que « SAISON 2025 » reste, lui, pile au milieu.

           Ce n'est pas un défaut de redDot : centrer un titre sur son
           encre totale est juste quand il est seul. Ça le devient dès
           qu'une seconde ligne doit s'aligner dessous, et c'est ALORS le
           MOT qui fait l'axe, pas le mot plus sa ponctuation.

           On recalcule donc l'axe du mot — même arithmétique que redDot,
           à ceci près qu'on s'arrête au mot — et le contexte s'y pose.
           Mesuré ICI, pendant qu'Anton est encore à la taille ajustée :
           un measureText après un changement de fonte mesurerait autre
           chose. */
        let axeLbl = W / 2;
        if (lbl.length > 1) {
          anton(fit(lbl, anton, 900, 100, 40));
          const base = lbl.endsWith(".") ? lbl.slice(0, -1) : lbl;
          axeLbl =
            W / 2 -
            ctx.measureText(lbl).width / 2 +
            ctx.measureText(base).width / 2;
          ctx.fillStyle = "#fff";
          redDot(lbl, W / 2, Y_LIBELLE, "center");
        }

        /* LE CONTEXTE DU HÉROS (v2.3.2) — « MVP. / SAISON 2025 ».

           Ce que la story peignait, c'était le libellé nu : « MVP. »,
           « LEADER DE LA LIGUE. ». Dans l'application, ces quatre-là ne
           s'affichent JAMAIS nus — getBadgeLabel rend « MVP — Saison
           2025 », parce qu'un honneur sans millésime ne dit pas de quoi
           on parle. La story disait donc moins que la fiche sur
           exactement le même badge.

           Elle le dit maintenant, et sur une LIGNE À PART plutôt que
           derrière un tiret : le libellé est en Anton 100, le contexte
           en Outfit 34 ; les accoler ferait un trait d'union entre deux
           typographies qui n'ont pas la même voix. Deux lignes, la
           seconde plus petite, c'est la hiérarchie que la vitrine a déjà
           partout ailleurs.

           CE QUI N'EST PAS DEVENU OBLIGATOIRE. En base le contexte est
           EXIGÉ pour ces cinq badges (trigger badge_contexte_requis).
           Ici il est optionnel, et vide ne peint rien — ÉCART 3, et
           surtout ÉCART 4 : /ma-story ne vérifie rien, refuser une story
           pour un millésime manquant serait une rigueur de façade. Ce
           qu'on gagne, c'est de pouvoir le dire, pas de l'imposer.

           `contexteForme` porte la condition, pas une liste de codes :
           le badge qui a une forme de contexte est celui qui peut en
           afficher un. Custom est exclu ici parce qu'il a déjà consommé
           le champ EN TANT QUE libellé, deux lignes plus haut — il
           REMPLACE son libellé là où les quatre autres le complètent. */
        const formeHero = badgeDef(codes[0])?.contexteForme;
        const ctxHero =
          codes[0] !== CODE_CUSTOM && formeHero ? up(val(SLOT_CONTEXTE)) : "";
        /* L'AIR est comptée depuis la ligne de base du libellé jusqu'au
           HAUT DE CAPITALE du contexte, et cette capitale est MESURÉE :
           fitTrk peut réduire le corps de 34 à 18 px sur un contexte long,
           et une hauteur devinée décalerait alors la ligne d'autant. */
        let yCtx = Y_LIBELLE;
        if (ctxHero) {
          ctx.fillStyle = SEC;
          const sCtx = fitTrk(ctxHero, (s2) => outfit(600, s2), 8, 860, 34, 18);
          const capCtx =
            ctx.measureText(ctxHero).actualBoundingBoxAscent || sCtx * 0.72;
          yCtx = Y_LIBELLE + AIR_CTX + capCtx;
          trk(ctxHero, axeLbl, yCtx, 8, "center");
        }

        /* La rangée suit CE QUI EST AU-DESSUS D'ELLE — le contexte s'il y
           en a un, le libellé sinon — et non un y fixe : sans ça, ajouter
           l'air du contexte l'aurait poussée dans le wordmark. */
        const rowCy =
          (ctxHero ? yCtx + AIR_RANGEE_CTX : Y_LIBELLE + AIR_RANGEE_TITRE) + ROW_R;

        // les suivants, en rangée — centrée sur leur nombre
        const autres = codes.slice(1);
        autres.forEach((c, i) => {
          const im = o.badges[c];
          if (!im) return;
          const cxb = W / 2 + (i - (autres.length - 1) / 2) * ROW_PAS;
          ctx.drawImage(im, cxb - ROW_R, rowCy - ROW_R, ROW_R * 2, ROW_R * 2);
        });
      }

      /* PIED ASYMÉTRIQUE — texte à gauche, marque à droite.
         La référence centrait cette ligne ET posait le wordmark en bas à
         droite : à 26 px et 33 caractères, le texte court jusqu'à x≈840
         et vient toucher la marque, qui commence à 930. Le défaut est
         dans la référence, pas dans le port — il se voit dès qu'on rend
         les deux. Aligner le texte à gauche les sépare sans déplacer le
         wordmark ni rogner la phrase, qui porte l'engagement de
         l'ÉCART 4. Le fit à 760 px garantit que ça tienne même si la
         ligne s'allonge un jour. */
      /* v2.3.4 — LES DEUX SUR LA MÊME BASE, ET DEPUIS UN SEUL y.

         Le texte était posé à 1638 et le wordmark à 1614 : deux nombres
         indépendants, donc un alignement qui ne tenait que par chance —
         et il ne tenait pas. Mesuré sur le rendu : le centre du wordmark
         tombait 11,5 px SOUS le centre optique du texte, ce qui se voit
         à l'œil sur une ligne de pied.

         CE QUI ALIGNE VRAIMENT, ET POURQUOI PAS LA BASELINE. Le PNG du
         wordmark est À FLEUR : son encre occupe la boîte entière, de 0 à
         52 sur 52,5 px de haut. Le bas de la boîte EST donc la ligne de
         pied des lettres, et la flamme au-dessus du X joue le rôle d'un
         jambage ascendant. Poser le CENTRE du wordmark sur la baseline du
         texte le descendrait de 26 px sous les lettres ; poser le bas de
         la boîte sur la baseline le remonterait de 26 px. Ni l'un ni
         l'autre n'aligne deux mots côte à côte.

         Ce qui aligne, c'est le CENTRE de la boîte sur le CENTRE OPTIQUE
         du texte — la mi-hauteur de capitale. C'est déjà, au 0,3 px près,
         ce que fait `profil`, seul autre gabarit où le wordmark et une
         ligne de texte se posent côte à côte : c'est donc la convention
         de la maison, et `badges` était l'exception involontaire.

         Un SEUL y commande les deux (Y_PIED), et la hauteur de capitale
         est mesurée, pas devinée : fitTrk peut réduire le corps de 26 à
         14 px si la ligne s'allonge un jour, et le wordmark suivra.

         Y_PIED descend de 1638 à 1646 : remonter le wordmark de 11,5 px
         l'aurait amené à 4 px du bas de la rangée de badges, là où les
         deux se croisent en x. Le pied gagne 8 px vers le bas, il en
         reste 7 avant la zone réservée Instagram. */
      const Y_PIED = 1646;
      ctx.fillStyle = SEC;
      const sPied = fitTrk(ATTRIBUTION_PIED, (s2) => outfit(400, s2), 4, 760, 26, 14);
      const capPied =
        ctx.measureText(ATTRIBUTION_PIED).actualBoundingBoxAscent || sPied * 0.73;
      trk(ATTRIBUTION_PIED, 70, Y_PIED, 4, "left");
      const WM_PIED = 150;
      const hWm = o.wm ? (WM_PIED * o.wm.naturalHeight) / o.wm.naturalWidth : 0;
      wordmark(W - 70, Y_PIED - capPied / 2 - hWm / 2, WM_PIED, "right");
      grain(0.08);
    },

    /* 8 — MERCI : moment calme, duotone doux, texte au tiers inférieur */
    merci() {
      ctx.drawImage(pp(W, H, { con: 1.04, stops: accDuo() }), 0, 0, W, H);
      ctx.fillStyle = "rgba(17,19,23,.15)";
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 860, 0, 1560);
      g.addColorStop(0, "rgba(17,19,23,0)");
      g.addColorStop(0.8, "rgba(17,19,23,.9)");
      g.addColorStop(1, "rgba(17,19,23,.96)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 860, W, H - 860);
      vignette(0.22);

      const nomM = up(val("f_nom"));
      if (nomM) {
        outfit(600, 30);
        ctx.fillStyle = "#fff";
        trk(nomM, W / 2, 366, 9, "center");
        ctx.fillStyle = INK;
        ctx.fillRect(W / 2 - 32, 392, 64, 6);
      }

      const titreM = up(val("t_merci_titre"));
      if (titreM) {
        const s = Math.min(fit(titreM, anton, 900, 300, 24), 280);
        anton(s);
        ctx.fillStyle = "#fff";
        redDot(titreM, W / 2, 1252, "center");
      }

      const aq = up(val("f_aqui"));
      if (aq) {
        const s2 = fit(aq, anton, 800, 96, 40);
        anton(s2);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(aq, W / 2, 1356);
        ctx.textAlign = "left";
      }

      const msg = up(val("f_msg")).slice(0, 60);
      if (msg) {
        let mz = 30;
        outfit(500, mz);
        while (ctx.measureText(msg).width + msg.length * 6 > 900 && mz > 18) {
          mz -= 2;
          outfit(500, mz);
        }
        ctx.fillStyle = SEC;
        trk(msg, W / 2, 1436, 6, "center");
      }

      wordmark(W / 2, 1556, 180, "center");
      grain(0.06);
    },
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  T[o.tpl]();
}

/* ─────────────────────────────────────────────────────────────────
   COMPOSANT
   ───────────────────────────────────────────────────────────────── */

/** Première famille de la pile, pour document.fonts.load() qui matche
 *  mal une liste. next/font produit un nom haché entre guillemets. */
function firstFamily(stack: string) {
  return stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
}

export default function MaStoryClient({
  fontVariableClass,
}: {
  fontVariableClass: string;
}) {
  const [tpl, setTpl] = useState<Tpl>("match");
  /* R5 — côté CONTENU, plus AUCUN champ n'est prérempli : `f_ligue`
     était le dernier, et il est parti avec la jaquette (ÉCART 5). Tout
     le reste est en placeholder.

     Les textes fixes (ÉCART 7) sont d'une autre nature — ce sont des
     valeurs DÉJÀ peintes aujourd'hui, le champ ne fait que les exposer.
     Ils entrent donc préremplis, et ne rien toucher redonne le rendu
     d'avant. */
  const [vals, setVals] = useState<Vals>({ ...TEXTES_INIT });
  /** Le verdict a-t-il été touché ? Tant que non, l'effet plus bas y
   *  réécrit le calcul à chaque changement de score. Dès que oui, la
   *  saisie gagne et les scores ne l'écrasent plus — « ↺ auto » rend la
   *  main au calcul. */
  const [verdictDirty, setVerdictDirty] = useState(false);
  /** Bloc « Personnaliser les textes » : fermé au montage, et refermé à
   *  chaque changement de gabarit. */
  const [textesOuverts, setTextesOuverts] = useState(false);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [focal, setFocal] = useState({ x: 0.5, y: 0.4 });
  const [accent, setAccent] = useState("#E63946");
  /** ÉCART 12 — la couleur du texte secondaire. « Gris » par défaut :
   *  c'est la valeur d'avant, donc ne rien toucher redonne le rendu
   *  d'avant, comme pour les textes fixes. */
  const [secTxt, setSecTxt] = useState<TexteSec>("gris");
  /** Curseur « Intensite de l'effet », en POURCENT. Vit a cote de
   *  zoom/fx/fy ; rien n'est persiste. */
  const [intensite, setIntensite] = useState(Math.round(DUO_MIX * 100));
  const [hexIn, setHexIn] = useState("#E63946");
  const [pipette, setPipette] = useState(false);
  const [safeShown, setSafeShown] = useState(false);
  const [ready, setReady] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const assetsRef = useRef<{
    wm: HTMLImageElement | null;
    icon: HTMLImageElement | null;
  }>({ wm: null, icon: null });
  const stacksRef = useRef({ anton: "Anton, Impact, sans-serif", outfit: "Outfit, system-ui, sans-serif" });
  const lowResRef = useRef(false);
  const photoUrlRef = useRef<string | null>(null);

  /* ÉCART 9 — DEUX CHAMPS POUR UNE VALEUR.
     Le sélecteur écrit `f_sport` ; sur « Autre » c'est `f_sport_autre`
     qui porte la saisie. Le canvas n'en sait rien et continue de lire
     `f_sport` — la résolution se fait ICI, au point de passage unique
     entre l'état et le rendu. Même mécanique pour la position. Le jour
     où le mode connecté remplira ces champs, il n'y aura qu'un endroit
     à toucher. */
  /** Le verdict CALCULÉ d'après les scores. Il n'est jamais écrit dans
   *  l'état : tant que l'athlète n'a pas touché au champ, c'est lui que
   *  `v()` sert au rendu et que le formulaire affiche. */
  const verdictCalc = calcVerdict(vals.f_sn ?? "", vals.f_se ?? "");

  const v = useCallback(
    (k: string) => {
      /* Le verdict AVANT tout : non surchargé, c'est le calcul qui sort,
         quoi que contienne l'état. Surchargé, c'est la saisie — vide
         comprise, et vide ne peint rien (ÉCART 3).

         Il a d'abord été synchronisé dans l'état par un useEffect. La
         règle react-hooks/set-state-in-effect a eu raison de cette
         version, et elle avait raison : une valeur DÉRIVÉE de deux
         champs n'a rien à faire dans l'état, elle s'y désynchronise au
         premier rendu concurrent. */
      if (k === "f_verdict" && !verdictDirty) return verdictCalc;
      const raw =
        k === "f_sport" && vals.f_sport === AUTRE
          ? vals.f_sport_autre
          : k === "f_pos" && vals.f_pos === AUTRE
            ? vals.f_pos_autre
            : vals[k];
      return (raw ?? "").trim();
    },
    [vals, verdictDirty, verdictCalc],
  );
  const set = (k: string) => (value: string) => setVals((p) => ({ ...p, [k]: value }));

  /** Le sport retenu dans la table, ou `undefined` si le champ est vide
   *  ou sur « Autre » — les deux cas où la position redevient libre. */
  const sportChoisi = sportDef(vals.f_sport ?? "");

  /** Les badges proposables. `v("f_sport")` et non `vals.f_sport` : sur
   *  « Autre », c'est la saisie libre qui compte, et elle ne correspondra
   *  à aucun sport de la table — la liste retombe donc sur les universels
   *  et les honneurs, ce qui est la dégradation voulue. */
  const badgesDispo = badgesPourSport(v("f_sport"));

  /* ---- badges : des cases, pas des emplacements réservés ----
     Un re-tap retire le badge ET referme le trou : sans ce tassement,
     retirer le 2e sur 5 laisserait un vide au milieu du formulaire — et
     surtout un trou dans la rangée du rendu, qui se centre sur le NOMBRE
     de badges posés, pas sur leurs indices. */
  const badgesPoses = BADGE_SLOTS.map((k) => (vals[k] ?? "").trim()).filter(Boolean);

  /** Le badge HÉROS — le premier posé. C'est lui, et lui seul, qui peut
   *  porter un contexte au rendu ; le formulaire ne demande donc le champ
   *  que pour lui. */
  const heros = badgesPoses[0] ?? "";
  const formeHeros = heros ? badgeDef(heros)?.contexteForme ?? null : null;
  const toggleBadge = (b: string) =>
    setVals((p) => {
      const cur = BADGE_SLOTS.map((k) => (p[k] ?? "").trim()).filter(Boolean);
      const i = cur.indexOf(b);
      const next =
        i >= 0
          ? cur.filter((_, j) => j !== i)
          : cur.length < MAX_BADGES_STORY
            ? [...cur, b]
            : cur;
      const out = { ...p };
      BADGE_SLOTS.forEach((k, j) => {
        out[k] = next[j] ?? "";
      });
      return out;
    });

  /* ---- ÉCART 11 — les SVG de badge, chargés à la demande ----
     Pas au montage : 22 fichiers dont un de 258 Ko, pour un gabarit sur
     dix et cinq badges au plus. On charge ce qui est choisi, une fois,
     et on garde.

     Le `Set` sert à ne pas relancer un chargement déjà en vol — la clé de
     dépendance change à chaque coche, et sans lui un aller-retour sur le
     même badge en redéclencherait un. Le résultat, lui, vit dans l'ÉTAT :
     c'est ce qui redéclenche le rendu quand l'image arrive. Un ref seul
     ne réveillerait rien et le badge n'apparaîtrait qu'au geste suivant. */
  const badgeEnCoursRef = useRef<Set<string>>(new Set());
  const [badgeImgs, setBadgeImgs] = useState<Record<string, HTMLImageElement | null>>(
    {},
  );
  const codesBadges = badgesPoses.join(",");
  useEffect(() => {
    const codes = codesBadges ? codesBadges.split(",") : [];
    const manquants = codes.filter((c) => !badgeEnCoursRef.current.has(c));
    if (!manquants.length) return;
    manquants.forEach((c) => badgeEnCoursRef.current.add(c));
    let alive = true;
    Promise.all(
      manquants.map(async (c) => [c, await loadImg(badgeSvg(c), 220)] as const),
    ).then((paires) => {
      if (alive) setBadgeImgs((prev) => ({ ...prev, ...Object.fromEntries(paires) }));
    });
    return () => {
      alive = false;
    };
  }, [codesBadges]);

  /* ---- boot : actifs de marque + fontes ---- */
  useEffect(() => {
    let alive = true;
    const root = rootRef.current;
    if (root) {
      const cs = getComputedStyle(root);
      const outfitVar = cs.getPropertyValue("--font-story").trim();
      const antonVar = cs.getPropertyValue("--font-anton").trim();
      if (outfitVar) stacksRef.current.outfit = `${outfitVar}, system-ui, sans-serif`;
      if (antonVar) stacksRef.current.anton = `${antonVar}, Impact, sans-serif`;
    }
    const outfitFam = firstFamily(stacksRef.current.outfit);
    const antonFam = firstFamily(stacksRef.current.anton);

    Promise.all([
      loadImg(BRAND.wordmark),
      loadImg(BRAND.icon),
      // ÉCART 1 — graisse par graisse : une famille « chargée » ne dit
      // rien de la graisse 800, et un fallback fausse toutes les mesures.
      document.fonts.load(`400 10px "${outfitFam}"`),
      document.fonts.load(`500 10px "${outfitFam}"`),
      document.fonts.load(`600 10px "${outfitFam}"`),
      document.fonts.load(`700 10px "${outfitFam}"`),
      document.fonts.load(`800 10px "${outfitFam}"`),
      document.fonts.load(`100px "${antonFam}"`),
    ]).then(([wm, icon]) => {
      if (!alive) return;
      assetsRef.current = { wm, icon };
      document.fonts.ready.then(() => {
        if (alive) setReady(true);
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ---- rendu ---- */
  const render = useCallback(() => {
    const cv = cvRef.current;
    if (!cv || !ready) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const a = assetsRef.current;
    drawStory(ctx, {
      tpl,
      v,
      photo,
      wm: a.wm,
      icon: a.icon,
      badges: badgeImgs,
      fx: focal.x,
      fy: focal.y,
      zoom,
      accent,
      secTxt,
      duoMix: intensite / 100,
      lowRes: lowResRef.current,
      antonStack: stacksRef.current.anton,
      outfitStack: stacksRef.current.outfit,
      pipette,
    });
  }, [ready, tpl, v, photo, focal, zoom, accent, secTxt, intensite, pipette, badgeImgs]);

  useEffect(() => {
    render();
  }, [render]);

  /* ---- vignette de cadrage ---- */
  const drawThumb = useCallback(() => {
    const th = thumbRef.current;
    if (!th) return;
    const tctx = th.getContext("2d");
    if (!tctx) return;
    const w2 = th.clientWidth || 336;
    if (th.width !== w2) {
      th.width = w2;
      th.height = Math.round(w2 * 0.62);
    }
    const wpx = th.width;
    const hpx = th.height;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.fillStyle = "#111317";
    tctx.fillRect(0, 0, wpx, hpx);
    if (!photo) return;
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    const s = Math.min(wpx / iw, hpx / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = (wpx - dw) / 2;
    const dy = (hpx - dh) / 2;
    tctx.drawImage(photo, dx, dy, dw, dh);
    tctx.strokeStyle = "rgba(255,255,255,.3)";
    tctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      tctx.beginPath();
      tctx.moveTo(dx + (dw * i) / 3, dy);
      tctx.lineTo(dx + (dw * i) / 3, dy + dh);
      tctx.stroke();
      tctx.beginPath();
      tctx.moveTo(dx, dy + (dh * i) / 3);
      tctx.lineTo(dx + dw, dy + (dh * i) / 3);
      tctx.stroke();
    }
    tctx.strokeStyle = "rgba(255,255,255,.5)";
    tctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
    const fxp = dx + clamp(focal.x, 0, 1) * dw;
    const fyp = dy + clamp(focal.y, 0, 1) * dh;
    tctx.beginPath();
    tctx.arc(fxp, fyp, 9, 0, 7);
    tctx.fillStyle = "#E63946";
    tctx.fill();
    tctx.lineWidth = 3;
    tctx.strokeStyle = "#fff";
    tctx.stroke();
  }, [photo, focal]);

  useEffect(() => {
    drawThumb();
    const onResize = () => drawThumb();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawThumb]);

  /* ---- photo ---- */
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(f);
    photoUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setFocal({ x: 0.5, y: 0.4 });
      setZoom(1);
    };
    img.src = url;
  };

  useEffect(
    () => () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    },
    [],
  );

  /* ---- cadrage au doigt ---- */
  const dragRef = useRef(false);
  const thPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const th = thumbRef.current;
    if (!th || !photo) return;
    const r = th.getBoundingClientRect();
    const wpx = th.width;
    const hpx = th.height;
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    const s = Math.min(wpx / iw, hpx / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = (wpx - dw) / 2;
    const dy = (hpx - dh) / 2;
    const x = (e.clientX - r.left) * (wpx / r.width);
    const y = (e.clientY - r.top) * (hpx / r.height);
    setFocal({ x: clamp((x - dx) / dw, 0, 1), y: clamp((y - dy) / dh, 0, 1) });
  };

  /* ---- pipette ---- */
  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pipette) return;
    e.preventDefault();
    const cv = cvRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const r = cv.getBoundingClientRect();
    const x = Math.floor(clamp((e.clientX - r.left) * (W / r.width), 0, W - 1));
    const y = Math.floor(clamp((e.clientY - r.top) * (H / r.height), 0, H - 1));
    const d = ctx.getImageData(x, y, 1, 1).data;
    const hex =
      "#" + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("");
    setPipette(false);
    setAccent(hex.toUpperCase());
    setHexIn(hex.toUpperCase());
  };

  /* ---- téléchargement ----
     R9 : le PNG est fabriqué dans le navigateur et l'URL objet est
     révoquée après le clic. Rien ne transite, rien ne reste. */
  const download = () => {
    const cv = cvRef.current;
    if (!cv) return;
    lowResRef.current = false;
    render();
    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "nexus-story-" + FILE_NAMES[tpl] + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  };

  /* ---- formulaire ---- */
  const show = (...list: Tpl[]) => (list.includes(tpl) ? undefined : { display: "none" });

  const txt = (id: string, ph: string, maxLength?: number) => (
    <input
      type="text"
      id={id}
      value={vals[id] ?? ""}
      placeholder={ph}
      maxLength={maxLength}
      onChange={(e) => set(id)(e.target.value)}
    />
  );

  return (
    <div ref={rootRef} className={`${fontVariableClass} ${styles.page}`}>
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.wordmark} alt="Nexus" />
        <div className={styles.headerT}>
          <b>Ma story</b> · Génère ta story Instagram 1080 × 1920
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.panel}>
          <div className={`${styles.card} ${styles.cTabs}`}>
            <div className={styles.eyebrow}>Gabarit</div>
            <div className={styles.tabs}>
              {TPL_META.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={tpl === k ? styles.on : undefined}
                  onClick={() => {
                    setTpl(k);
                    // Chaque gabarit s'ouvre replié — ses surcharges à lui
                    // restent en mémoire, c'est le bloc qui se referme.
                    setTextesOuverts(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.card} ${styles.cColor}`}>
            <div className={styles.eyebrow}>Couleur d&apos;équipe</div>
            <div className={styles.sw}>
              {SWATCHES.map(([label, hex]) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  aria-label={label}
                  className={accent === hex ? styles.on : undefined}
                  style={{ background: hex }}
                  onClick={() => {
                    setAccent(hex);
                    setHexIn(hex);
                  }}
                />
              ))}
            </div>
            <div className={styles.hexrow}>
              <span className={styles.hexLabel}>Hex libre</span>
              <input
                type="text"
                value={hexIn}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => {
                  const val2 = e.target.value.trim();
                  setHexIn(val2);
                  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val2)) setAccent(val2.toUpperCase());
                }}
              />
            </div>
            <button
              type="button"
              className={`${styles.btn2} ${pipette ? styles.on : ""}`}
              style={{ marginTop: 12 }}
              onClick={() => setPipette((p) => !p)}
            >
              {pipette ? "Pipette active — touche ta photo" : "Pipette — touche ta photo"}
            </button>

            {/* ÉCART 12 — le texte secondaire.
                Il vit dans la carte COULEUR et non dans « Contenu » : ce
                n'est pas une donnée d'athlète, c'est un réglage d'image,
                au même titre que l'accent et l'intensité. Et il se juge
                devant la photo, pas devant un formulaire. */}
            <div className={styles.eyebrow} style={{ marginTop: 16 }}>
              Texte secondaire
            </div>
            <div className={styles.tabs}>
              {SEC_META.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={secTxt === k ? styles.on : undefined}
                  aria-pressed={secTxt === k}
                  onClick={() => setSecTxt(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.hint}>
              Surtitres, libellés, sous-lignes, lieu — sur les dix gabarits.
              Le gris disparaît sur une photo claire&#8239;: passe au blanc, ou
              au noir si elle est très claire.
            </div>

            {/* Meme mecanique que le cadrage : basse resolution pendant le
                glissement, pleine resolution au relachement. Sans cela, un
                glissement continu recalcule 1080x1920 pixels a chaque pas et
                le curseur devient poisseux sur telephone. */}
            <label className={styles.f} style={{ marginTop: 14, marginBottom: 0 }}>
              <span>Intensité de l&apos;effet · {intensite}&#8239;%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={intensite}
                onChange={(e) => setIntensite(+e.target.value)}
                onPointerDown={() => {
                  lowResRef.current = true;
                }}
                onPointerUp={() => {
                  lowResRef.current = false;
                  render();
                }}
                onPointerCancel={() => {
                  lowResRef.current = false;
                  render();
                }}
              />
            </label>
          </div>

          <div className={`${styles.card} ${styles.cPhoto}`}>
            <div className={styles.eyebrow}>Ta photo</div>
            <label className={styles.photoBtn}>
              {photo ? "Changer la photo" : "Choisir une photo"}
              <input type="file" accept="image/*" hidden onChange={onPhoto} />
            </label>
            <div className={styles.eyebrow} style={{ marginTop: 16 }}>
              Cadrage — glisse le point sur le sujet, ajuste le zoom
            </div>
            <canvas
              ref={thumbRef}
              className={styles.thumb}
              width={336}
              height={210}
              onPointerDown={(e) => {
                if (!photo) return;
                e.preventDefault();
                dragRef.current = true;
                lowResRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                thPoint(e);
              }}
              onPointerMove={(e) => {
                if (dragRef.current) thPoint(e);
              }}
              onPointerUp={() => {
                if (!dragRef.current) return;
                dragRef.current = false;
                lowResRef.current = false;
                render();
              }}
              onPointerCancel={() => {
                if (!dragRef.current) return;
                dragRef.current = false;
                lowResRef.current = false;
                render();
              }}
            />
            <label className={styles.f} style={{ marginTop: 12 }}>
              <span>
                Zoom · {Math.round(zoom * 100)}&#8239;%
                {zoom < 1 && (
                  <span className={styles.flou}> · fond flouté</span>
                )}
              </span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.btn2}
              onClick={() => {
                setFocal({ x: 0.5, y: 0.4 });
                setZoom(1);
              }}
            >
              Recentrer
            </button>
            <div className={styles.hint}>
              Ta photo reste sur ton appareil&#8239;: rien n&apos;est téléversé.
            </div>
          </div>

          <div className={`${styles.card} ${styles.cFields}`}>
            <div className={styles.eyebrow}>Contenu</div>

            <label
              className={styles.f}
              style={show(
                "match",
                "prochain",
                "stats",
                "post",
                "profil",
                "etoiles",
                "badges",
                "merci",
              )}
            >
              <span>Ton nom</span>
              {txt("f_nom", "Ex. : Alex Tremblay")}
            </label>

            <label className={styles.f} style={show("merci")}>
              <span>À qui</span>
              {txt("f_aqui", "Ex. : Coach Tremblay")}
            </label>

            <label className={styles.f} style={show("merci")}>
              <span>Message (optionnel, 60 caract. max)</span>
              {txt("f_msg", "Ex. : Pour chaque pratique à 6 h", 60)}
            </label>

            <label className={styles.f} style={show("equipe")}>
              <span>Prénom de l&apos;athlète</span>
              {txt("f_prenom", "Ex. : Léa")}
            </label>

            <label className={styles.f} style={show("equipe")}>
              <span>Nom de l&apos;équipe</span>
              {txt("f_eqnom", "Ex. : Les Centaures")}
            </label>

            <label className={styles.f} style={show("match", "prochain", "resultat")}>
              <span>Adversaire</span>
              {txt("f_adv", "Ex. : Les Patriotes")}
            </label>

            <label className={styles.f} style={show("match")}>
              <span>Date et heure</span>
              {txt("f_date", "Ex. : VEN 12 SEPT · 19 H 30")}
            </label>

            <label className={styles.f} style={show("match", "prochain")}>
              <span>Lieu</span>
              {txt("f_lieu", "Ex. : Stade de Repentigny")}
            </label>

            {/* v2.2 — PROCHAIN MATCH a ses PROPRES date et heure, séparées.
                `f_date` de « Jour de match » porte les deux d'un bloc
                (« VEN 12 SEPT · 19 H 30 ») parce qu'il les peint sur une
                ligne ; ici la date part en Anton géant et l'heure vit
                dessous. Partager le champ peindrait l'heure en capitales
                de 150 px au milieu de la date. */}
            <div className={styles.row2} style={show("prochain")}>
              <label className={styles.f}>
                <span>Date</span>
                {txt("f_pdate", "Ex. : VEN 12 SEPT")}
              </label>
              <label className={styles.f}>
                <span>Heure</span>
                {txt("f_heure", "Ex. : 19 H 30")}
              </label>
            </div>

            <div className={styles.row2} style={show("resultat")}>
              <label className={styles.f}>
                <span>Notre score</span>
                <input
                  type="number"
                  id="f_sn"
                  min={0}
                  value={vals.f_sn ?? ""}
                  placeholder="0"
                  onChange={(e) => set("f_sn")(e.target.value)}
                />
              </label>
              <label className={styles.f}>
                <span>Leur score</span>
                <input
                  type="number"
                  id="f_se"
                  min={0}
                  value={vals.f_se ?? ""}
                  placeholder="0"
                  onChange={(e) => set("f_se")(e.target.value)}
                />
              </label>
            </div>

            {/* Le verdict est du CONTENU, pas un texte fixe : il suit les
                scores. Il vit donc ici, sous eux, et non dans le bloc
                « Personnaliser les textes ». */}
            <label className={styles.f} style={show("resultat")}>
              <span className={styles.labelRow}>
                Verdict
                {verdictDirty && (
                  <button
                    type="button"
                    className={styles.auto}
                    title="Revenir au verdict calculé d'après les scores"
                    onClick={() => setVerdictDirty(false)}
                  >
                    ↺ auto
                  </button>
                )}
              </span>
              <input
                type="text"
                id="f_verdict"
                value={verdictDirty ? (vals.f_verdict ?? "") : verdictCalc}
                placeholder={verdictCalc}
                maxLength={24}
                onChange={(e) => {
                  setVerdictDirty(true);
                  set("f_verdict")(e.target.value);
                }}
              />
            </label>

            {/* ÉCART 9 — le sport commande la position. Changer de sport
                vide la position : celle d'avant n'existe pas forcément
                dans la nouvelle liste, et la laisser en place, ce serait
                afficher un quart-arrière au volleyball. Sport vide ou
                « Autre », la position redevient un champ texte — il n'y a
                aucune liste à proposer. */}
            {/* v2.3 — `etoiles` était sorti de la liste : son rendu d'alors
                ne peignait plus la sous-ligne sport · position.
                v2.3.4 — il y REVIENT, parce que sa ligne « POSITION ·
                #NUMÉRO » a remplacé la rangée d'étoiles. Le SPORT y reste
                pourtant invisible au rendu : il est là pour alimenter la
                liste de positions, exactement comme sur `badges` où il
                filtre le sélecteur de badges. Un champ utile sans être
                peint, c'est le cas normal de ce formulaire, pas une
                exception. */}
            <div
              className={styles.row2}
              style={show("stats", "equipe", "profil", "badges", "etoiles")}
            >
              <label className={styles.f}>
                <span>Sport</span>
                <select
                  id="f_sport"
                  value={vals.f_sport ?? ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    setVals((pv) => ({
                      ...pv,
                      f_sport: next,
                      f_pos: "",
                      f_pos_autre: "",
                    }));
                  }}
                >
                  <option value="">Ton sport</option>
                  {SPORT_TAXONOMY.map((sp) => (
                    <option key={sp.nom} value={sp.nom}>
                      {sp.nom}
                    </option>
                  ))}
                  <option value={AUTRE}>Autre…</option>
                </select>
              </label>
              <label className={styles.f} style={show("stats", "profil", "etoiles")}>
                <span>Position</span>
                {sportChoisi ? (
                  <select
                    id="f_pos"
                    value={vals.f_pos ?? ""}
                    onChange={(e) => set("f_pos")(e.target.value)}
                  >
                    <option value="">Ta position</option>
                    {sportChoisi.positions.map(([ab, lb]) => (
                      <option key={ab} value={lb}>
                        {ab} — {lb}
                      </option>
                    ))}
                    <option value={AUTRE}>Autre…</option>
                  </select>
                ) : (
                  txt("f_pos", "Ex. : Receveur")
                )}
              </label>
              <label className={styles.f} style={show("equipe")}>
                <span>Saison</span>
                {txt("f_saison", "Ex. : 2026-2027")}
              </label>
            </div>

            {vals.f_sport === AUTRE && (
              <label
                className={styles.f}
                style={show("stats", "equipe", "profil", "badges", "etoiles")}
              >
                <span>Ton sport</span>
                {txt("f_sport_autre", "Ex. : Ultimate frisbee")}
              </label>
            )}

            {vals.f_pos === AUTRE && (
              <label className={styles.f} style={show("stats", "profil", "etoiles")}>
                <span>Ta position</span>
                {txt("f_pos_autre", "Ex. : Ailier rapproché")}
              </label>
            )}

            {/* v2.1 — `f_num` a survécu au retrait de la jaquette : il est
                passé sur « Vois mon profil », où il se colle au nom.
                v2.3.4 — « Mes étoiles » le lit aussi, dans sa ligne
                « POSITION · #NUMÉRO ». LE MÊME champ, pas un second : un
                numéro de maillot est un fait de l'athlète, pas une donnée
                de gabarit, et le saisir deux fois n'ouvrirait qu'une porte
                pour se contredire. */}
            <label className={styles.f} style={show("profil", "etoiles")}>
              <span>Ton numéro (3 caract. max)</span>
              {txt("f_num", "Ex. : 9", 3)}
            </label>

            <label className={styles.f} style={show("profil")}>
              <span>École ou équipe</span>
              {txt("f_ecole", "Ex. : École de l'Horizon")}
            </label>

            {/* v2.3 — l'option « 0 étoile » a disparu de la liste. Le
                rendu porté ne peint que des étoiles PLEINES : il n'y a
                plus d'étoile vide, donc « 0 » et « aucune » donnaient
                exactement la même image. Deux options pour un seul
                résultat, c'est un piège, pas un choix. Le code borne
                toujours à 0..5 par précaution. */}
            <label className={styles.f} style={show("etoiles")}>
              <span>Tes étoiles</span>
              <select
                id="f_etoiles"
                value={vals.f_etoiles ?? ""}
                onChange={(e) => set("f_etoiles")(e.target.value)}
              >
                <option value="">Aucune étoile</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} étoile{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>

            {/* v2.2 — ÉCART 4 et ÉCART 11. Le champ texte libre a disparu :
                on ne choisit plus un mot, on choisit un BADGE du catalogue,
                celui-là même que porte la fiche. Le sport filtre la section
                « propres au sport » — et pour les huit sports que la table
                de liaison ne couvre pas, cette section n'apparaît tout
                simplement pas (voir badgesPourSport dans taxonomie.ts). */}
            <div style={show("badges")}>
              <div className={styles.eyebrow} style={{ marginTop: 4 }}>
                Badges (jusqu&apos;à {MAX_BADGES_STORY})
              </div>
              {ORDRE_FAMILLES.map((fam) => {
                const liste = badgesDispo.filter((b) => b.famille === fam);
                if (!liste.length) return null;
                return (
                  <div key={fam} className={styles.badgeSection}>
                    <div className={styles.badgeFam}>{TITRE_FAMILLE[fam]}</div>
                    <div className={styles.badgeGrid}>
                      {liste.map((b) => {
                        const pose = badgesPoses.includes(b.code);
                        return (
                          <button
                            key={b.code}
                            type="button"
                            className={`${styles.badgePick} ${pose ? styles.on : ""}`}
                            aria-pressed={pose}
                            disabled={!pose && badgesPoses.length >= MAX_BADGES_STORY}
                            onClick={() => toggleBadge(b.code)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={badgeSvg(b.code)} alt="" width={38} height={38} />
                            <span>{b.libelle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* LE CONTEXTE DU BADGE HÉROS (v2.3.2).
                  UN champ, montré quand le premier badge choisi en porte
                  un au catalogue — `contexteForme`, jamais une liste de
                  codes écrite ici. Deux libellés pour deux natures :
                  Custom NOMME sa distinction (son texte REMPLACE le
                  libellé), les quatre autres honneurs la PRÉCISENT (leur
                  texte s'ajoute sous le libellé).

                  OPTIONNEL des deux côtés, alors que la fiche l'EXIGE :
                  ÉCART 4 — /ma-story ne vérifie rien, et bloquer une
                  story sur un millésime manquant serait une rigueur de
                  façade. Vide ne peint rien, comme partout ailleurs. */}
              {formeHeros && (
                <label className={styles.f} style={{ marginTop: 10 }}>
                  <span>
                    {heros === CODE_CUSTOM
                      ? `Ta distinction Custom (${MAX_CONTEXTE} caract. max)`
                      : `Contexte — ${BADGE_LIBELLE[heros]} (${MAX_CONTEXTE} caract. max, optionnel)`}
                  </span>
                  {txt(SLOT_CONTEXTE, placeholderContexte(formeHeros), MAX_CONTEXTE)}
                </label>
              )}

              <div className={styles.hint}>
                Ce sont les badges de ta fiche Nexus. Cette page ne peut pas
                vérifier lesquels tu as reçus&#8239;: la story les déclare, ton
                profil fait foi. La ligne «&#8239;{ATTRIBUTION}&#8239;» est
                peinte sous la grille et ne se modifie pas.
                {formeHeros && (
                  <>
                    {" "}
                    {heros === CODE_CUSTOM
                      ? "Le libellé Custom REMPLACE le nom du badge sous la grande vignette."
                      : "Le contexte se peint sur une seconde ligne, sous le nom du badge."}{" "}
                    Il ne concerne que ton PREMIER badge choisi — c&apos;est
                    celui-là qui passe en grand au centre. Laissé vide, rien
                    n&apos;est peint, et changer de premier badge garde le
                    texte déjà saisi.
                  </>
                )}
              </div>
            </div>

            <div style={show("stats")}>
              <div className={styles.eyebrow} style={{ marginTop: 4 }}>
                Stats (1 à 3)
              </div>
              <div className={styles.statrow}>
                {txt("f_s1v", "112")}
                {txt("f_s1l", "Verges")}
              </div>
              <div className={styles.statrow}>
                {txt("f_s2v", "2")}
                {txt("f_s2l", "Touchés")}
              </div>
              <div className={styles.statrow}>
                {txt("f_s3v", "6")}
                {txt("f_s3l", "Captations")}
              </div>
            </div>

            <label className={styles.f} style={show("post")}>
              <span>Ta ligne (ex. : Highlights du match)</span>
              {txt("f_ligne", "Ex. : Highlights du match")}
            </label>

            {/* ── ÉCART 7 — les textes fixes ────────────────────────────
                Replié par défaut, et c'est le point : ces champs sont
                déjà remplis et déjà justes. Les déplier est un geste
                volontaire ; l'athlète qui vient écrire son nom ne les
                croise jamais.

                Le gabarit « Vois mon profil » n'a aucune entrée dans
                TEXTES — le bloc ne s'y affiche donc pas du tout. */}
            {TEXTES.some((t) => t.tpl === tpl) && (
              <div className={styles.fold}>
                <button
                  type="button"
                  className={styles.foldHead}
                  aria-expanded={textesOuverts}
                  onClick={() => setTextesOuverts((o) => !o)}
                >
                  <span className={styles.foldCaret} aria-hidden="true">
                    {textesOuverts ? "−" : "+"}
                  </span>
                  Personnaliser les textes
                </button>
                {textesOuverts && (
                  <div className={styles.foldBody}>
                    {TEXTES.filter((t) => t.tpl === tpl).map((t) => (
                      <label key={t.key} className={styles.f}>
                        <span>{t.label}</span>
                        {txt(t.key, t.def, t.max)}
                      </label>
                    ))}
                    <div className={styles.hint}>
                      Un champ vidé n&apos;est pas peint. Le logo Nexus,
                      nexussports.ca et la ligne «&#8239;Mon profil est sur
                      Nexus&#8239;» ne se modifient pas.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`${styles.card} ${styles.dlcard}`}>
            <button type="button" className={styles.dl} disabled={!photo} onClick={download}>
              {photo
                ? "Télécharger le PNG · 1080 × 1920"
                : "Ajoute une photo pour télécharger"}
            </button>
            <label className={styles.chk}>
              <input
                type="checkbox"
                checked={safeShown}
                onChange={(e) => setSafeShown(e.target.checked)}
              />{" "}
              Afficher les zones de sécurité story
            </label>
          </div>
        </div>

        <div className={styles.stage}>
          <div className={styles.stagewrap}>
            <canvas
              ref={cvRef}
              className={`${styles.cv} ${pipette ? styles.pip : ""}`}
              width={W}
              height={H}
              onPointerDown={onCanvasPointer}
            />
            <div
              className={`${styles.safe} ${styles.safeT} ${safeShown ? styles.show : ""}`}
            >
              <span>ZONE RÉSERVÉE INSTAGRAM · 250 PX</span>
            </div>
            <div
              className={`${styles.safe} ${styles.safeB} ${safeShown ? styles.show : ""}`}
            >
              <span>ZONE RÉSERVÉE INSTAGRAM · 250 PX</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
