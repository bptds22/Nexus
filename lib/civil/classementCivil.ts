/* ═══════════════════════════════════════════════════════════════
   classementCivil — catégorie / division / zone d'un groupe CIVIL.

   POURQUOI (BP 2026-10-09). Les sites civils fusionnent trois notions dans
   un seul libellé : « PEE-WEE AAA - DIVISION 1 SUD » porte la catégorie
   d'âge (Pee-Wee), le niveau (AAA) et la zone (Sud). Importé tel quel, le
   filtre Division de la carte proposait « Bantam — Division 1 », « Atome
   Nord », « AAA »… Règle de BP :
     · catégorie = l'âge (Atome, Moustique, Pee-Wee, Bantam, Midget, Junior) ;
     · division  = le niveau (D1, D2…, AAA, Majeur) ; vide s'il n'y en a pas ;
     · zone      = Nord, Sud… — ni catégorie ni division, mais PARTIE DE
       L'IDENTITÉ du groupe : affichée partout où l'équipe ou le match est
       nommé, jamais dans le filtre.
   Décisions BP : « Moustique / Pee-Wee AAA — Division 1 » → AAA ; Atome
   Nord/Sud → division vide ; QMJFL → « Majeur » ; pas de fusion
   Midget/Juvénile ni Bantam/Cadet.

   UN SEUL CLASSEUR, trois appelants : les deux générateurs d'import
   (scripts/plan-civil-football-*.mjs) et la correction des données déjà en
   base (scripts/civil-zone/). Il lit indifféremment le libellé SOURCE
   (« PEE-WEE AAA - DIVISION 1 SUD ») et le libellé déjà importé
   (« Pee-Wee AAA — Division 1 Sud ») : tiret ou cadratin, toute casse.

   UN LIBELLÉ INCONNU LÈVE UNE ERREUR. Un générateur qui devine laisse
   revenir le désordre à la prochaine saison ; un générateur qui s'arrête
   oblige à décider.

   Aucune dépendance : importable depuis un script Node (strip-types).
═══════════════════════════════════════════════════════════════ */

export interface GroupeCivil {
  /** teams.age_group / games.category */
  categorie: string;
  /** teams.division / games.division — '' quand la source n'a pas de niveau
   *  (jamais NULL : un NULL désarme les index d'identité). */
  division: string;
  /** teams.zone / games.zone — '' sans zone. */
  zone: string;
}

/** Catégorie source (toute forme) → catégorie en base. */
const CATEGORIES: Record<string, string> = {
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

/** Ligues LeagueSuite : un seul niveau par ligue, aucune zone. */
const NIVEAU_LIGUE: Record<string, string> = { QBFL: "AAA", QMFL: "AAA", QMJFL: "Majeur" };

const ZONES: Record<string, string> = {
  NORD: "Nord", SUD: "Sud", EST: "Est", OUEST: "Ouest", CENTRE: "Centre",
};

const CALIBRES = ["AAA", "AA", "A", "BB", "B", "CC", "C"];

const majuscules = (s: string) =>
  s.normalize("NFC").toUpperCase().replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();

/** Catégorie en base d'une catégorie source, ou erreur. */
export function categorieCivile(source: string): string {
  const c = CATEGORIES[majuscules(source)];
  if (!c) throw new Error(`classementCivil : catégorie inconnue « ${source} »`);
  return c;
}

/**
 * Classe un groupe civil.
 *  · ligue      : sigle (LFMM, QBFL, QMFL, QMJFL)
 *  · categorie  : catégorie source ou déjà importée
 *  · division   : libellé source ou déjà importé (peut contenir catégorie,
 *                 calibre, numéro de division et zone)
 */
export function classerGroupeCivil(ligue: string, categorie: string, division: string | null | undefined): GroupeCivil {
  const cat = categorieCivile(categorie);
  const sigle = majuscules(ligue);
  if (NIVEAU_LIGUE[sigle] !== undefined) return { categorie: cat, division: NIVEAU_LIGUE[sigle], zone: "" };
  if (sigle !== "LFMM") throw new Error(`classementCivil : ligue inconnue « ${ligue} »`);

  let reste = majuscules(division ?? "");
  // 1. la catégorie répétée en tête (« PEE-WEE AAA - … », « ATOME NORD »)
  const tete = Object.keys(CATEGORIES)
    .filter((k) => CATEGORIES[k] === cat)
    .sort((a, b) => b.length - a.length)
    .find((k) => reste === k || reste.startsWith(k + " "));
  if (tete) reste = reste.slice(tete.length).trim();
  // 2. la zone en queue
  let zone = "";
  const z = /(?:^|\s)(NORD|SUD|EST|OUEST|CENTRE)$/.exec(reste);
  if (z) { zone = ZONES[z[1]]; reste = reste.slice(0, z.index).trim(); }
  // 3. calibre et/ou « DIVISION N » (un calibre l'emporte : décision BP)
  reste = reste.replace(/^-\s*|\s*-$/g, "").trim();
  let calibre = "";
  const cal = new RegExp(`^(${CALIBRES.join("|")})(?:\\s|$)`).exec(reste);
  if (cal) { calibre = cal[1]; reste = reste.slice(cal[1].length).replace(/^\s*-\s*/, "").trim(); }
  let numero = "";
  const d = /^(?:DIVISION|DIV\.?|D)\s*([1-9])$/.exec(reste);
  if (d) { numero = `D${d[1]}`; reste = ""; }
  if (reste !== "") throw new Error(`classementCivil : division illisible « ${division} » (reste « ${reste} »)`);
  return { categorie: cat, division: calibre || numero, zone };
}

/** « Pee-Wee AAA Sud », « Atome Nord », « Bantam D1 » — le nom du groupe,
 *  tel qu'on le lit partout où une équipe ou un match est nommé. */
export function nomGroupe(g: { categorie?: string | null; division?: string | null; zone?: string | null }): string {
  return [g.categorie, g.division, g.zone].map((v) => (v ?? "").trim()).filter(Boolean).join(" ");
}
