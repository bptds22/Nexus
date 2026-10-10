/* ═══════════════════════════════════════════════════════════════
   classementCivil — catégorie / division / zone d'un groupe CIVIL.

   POURQUOI (BP 2026-10-09). Les sites civils fusionnent trois notions dans
   un seul libellé : « PEE-WEE AAA - DIVISION 1 SUD » porte la catégorie
   (Pee-Wee AAA), la division (1) et la zone (Sud). Importé tel quel, le
   filtre Division de la carte proposait « Bantam — Division 1 », « Atome
   Nord », « AAA »… Règle de BP (révisée le 2026-10-09) :
     · catégorie = l'âge ET le calibre : « Pee-Wee AAA », « Bantam AAA »,
       « Junior Majeur », « M18 AAA », ou l'âge seul (« Atome », « Midget ») ;
     · division  = SEULEMENT D1…D4, ou vide — jamais un calibre ;
     · zone      = Nord, Sud… — ni catégorie ni division, mais PARTIE DE
       L'IDENTITÉ du groupe : affichée à côté de la division (« Division 1 ·
       Sud ») ou de la catégorie sans division (« Atome Nord »), jamais dans
       un filtre.
   Exemples de BP : Pee-Wee AAA — Division 1 Sud → Pee-Wee AAA / D1 / Sud ;
   Midget — Division 2 → Midget / D2 ; Atome Nord → Atome / — / Nord ;
   QBFL → Bantam AAA ; QMFL → Midget AAA ; QMJFL → Junior Majeur.

   LE CALIBRE LFMM SE LIT DANS LE LIBELLÉ DE DIVISION, pas dans la catégorie
   source : la LFMM classe « BANTAM AAA » / « MIDGET AAA » des groupes que BP
   veut lire « Bantam » / « Midget » (« Midget — Division 2 → Midget / D2 »).

   UN SEUL CLASSEUR : les deux générateurs d'import (scripts/plan-civil-
   football-*.mjs) l'appliquent aux libellés SOURCE ; la correction des
   données déjà en base (scripts/civil-zone/) en est la table, vérifiée
   égale par test. Un libellé inconnu LÈVE UNE ERREUR : un générateur qui
   devine laisse revenir le désordre à la saison suivante.

   Aucune dépendance : importable depuis un script Node (strip-types).
═══════════════════════════════════════════════════════════════ */

export interface GroupeCivil {
  /** teams.age_group / games.category — âge et calibre. */
  categorie: string;
  /** teams.division / games.division — D1…D4, ou '' (jamais NULL : un NULL
   *  désarme les index d'identité). */
  division: string;
  /** teams.zone / games.zone — '' sans zone. */
  zone: string;
}

/** Catégorie source (toute forme) → âge, sans calibre. */
const AGES: Record<string, string> = {
  "ATOME": "Atome",
  "MOUSTIQUE": "Moustique",
  "PEE-WEE": "Pee-Wee",
  "PEEWEE": "Pee-Wee",
  "BANTAM": "Bantam",
  "BANTAM AAA": "Bantam",
  "MIDGET": "Midget",
  "MIDGET AAA": "Midget",
  "JUNIOR": "Junior",
  "JUNIOR MAJOR": "Junior",
  "JUNIOR MAJEUR": "Junior",
};

/** Ligues LeagueSuite : un seul calibre par ligue, ni division ni zone. */
const CALIBRE_LIGUE: Record<string, string> = { QBFL: "AAA", QMFL: "AAA", QMJFL: "Majeur" };

const ZONES: Record<string, string> = {
  NORD: "Nord", SUD: "Sud", EST: "Est", OUEST: "Ouest", CENTRE: "Centre",
};

const CALIBRES = ["AAA", "AA", "A", "BB", "B", "CC", "C"];

const majuscules = (s: string) =>
  s.normalize("NFC").toUpperCase().replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();

/** Âge d'une catégorie source, ou erreur. */
export function ageCivil(source: string): string {
  const c = AGES[majuscules(source)];
  if (!c) throw new Error(`classementCivil : catégorie inconnue « ${source} »`);
  return c;
}

/**
 * Classe un groupe civil à partir de ses libellés SOURCE (ou importés avant
 * le 2026-10-09 : « Pee-Wee AAA — Division 1 Sud »).
 *  · ligue      : sigle (LFMM, QBFL, QMFL, QMJFL)
 *  · categorie  : catégorie source
 *  · division   : libellé de division source (peut contenir catégorie,
 *                 calibre, numéro de division et zone)
 */
export function classerGroupeCivil(ligue: string, categorie: string, division: string | null | undefined): GroupeCivil {
  const age = ageCivil(categorie);
  const sigle = majuscules(ligue);
  if (CALIBRE_LIGUE[sigle] !== undefined) return { categorie: `${age} ${CALIBRE_LIGUE[sigle]}`, division: "", zone: "" };
  if (sigle !== "LFMM") throw new Error(`classementCivil : ligue inconnue « ${ligue} »`);

  let reste = majuscules(division ?? "");
  // 1. l'âge répété en tête (« PEE-WEE AAA - … », « ATOME NORD »)
  const tete = Object.keys(AGES)
    .filter((k) => AGES[k] === age && !k.includes(" "))
    .sort((a, b) => b.length - a.length)
    .find((k) => reste === k || reste.startsWith(k + " "));
  if (tete) reste = reste.slice(tete.length).trim();
  // 2. la zone en queue
  let zone = "";
  const z = /(?:^|\s)(NORD|SUD|EST|OUEST|CENTRE)$/.exec(reste);
  if (z) { zone = ZONES[z[1]]; reste = reste.slice(0, z.index).trim(); }
  // 3. le calibre (→ catégorie), puis « DIVISION N » (→ division)
  reste = reste.replace(/^-\s*|\s*-$/g, "").trim();
  let calibre = "";
  const cal = new RegExp(`^(${CALIBRES.join("|")})(?:\\s|$)`).exec(reste);
  if (cal) { calibre = cal[1]; reste = reste.slice(cal[1].length).replace(/^\s*-\s*/, "").trim(); }
  let numero = "";
  const d = /^(?:DIVISION|DIV\.?|D)\s*([1-4])$/.exec(reste);
  if (d) { numero = `D${d[1]}`; reste = ""; }
  if (reste !== "") throw new Error(`classementCivil : division illisible « ${division} » (reste « ${reste} »)`);
  return { categorie: calibre ? `${age} ${calibre}` : age, division: numero, zone };
}

/** « D1 » → « Division 1 » ; toute autre forme telle quelle. */
export function libelleDivisionCourt(division: string | null | undefined): string {
  const v = (division ?? "").trim();
  const m = /^D\s*(\d+)$/i.exec(v);
  return m ? `Division ${m[1]}` : v;
}

/** Le nom du groupe, tel qu'on le lit partout où une équipe ou un match est
 *  nommé : « Pee-Wee AAA · Division 1 · Sud », « Atome Nord », « Bantam AAA »,
 *  « Benjamin · Division 4 ». La zone suit la division, ou la catégorie quand
 *  il n'y a pas de division (BP 2026-10-09). */
export function nomGroupe(g: { categorie?: string | null; division?: string | null; zone?: string | null }): string {
  const cat = (g.categorie ?? "").trim();
  const div = libelleDivisionCourt(g.division);
  const zone = (g.zone ?? "").trim();
  if (div) return [cat, div, zone].filter(Boolean).join(" · ");
  return [cat, zone].filter(Boolean).join(" ");
}
