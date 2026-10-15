/* ═══════════════════════════════════════════════════════════════
   teamLabel — LA règle du libellé d'une équipe dans une liste de choix
   (décision BP 2026-10-14, bug NLS). Web et mobile passent tous par ici.

     « NOM — Catégorie · Division · Genre »   ex. « PHEBUS JM — Juvénile · Gold · Masculin »

   - Le NOM n'est affiché que s'il DIFFÈRE du nom du club / de l'école
     (casse et accents ignorés) : une équipe RSEQ nommée comme son école
     reste « Juvénile · D1 · Masculin ». Sans ce nom, les 107 équipes du
     club « No Limits Showcases » se lisaient « Juvénile · Diamond ·
     Masculin » quinze fois.
   - Zone : règle actuelle (avecZone) — elle suit la division, ou la
     catégorie sans division.
   - Un champ vide disparaît : pas de « — », pas de séparateur orphelin.
   - `sport` (optionnel) ouvre la partie attributs, pour les listes où
     plusieurs sports se côtoient ; `ligue` (optionnel) la ferme.

   Tri commun : nom, puis catégorie dans l'ordre des âges, puis division,
   puis genre. Recherche commune : nom + catégorie + division + genre +
   zone (+ sport, ligue), accents et casse ignorés, chaque mot du texte
   tapé doit se trouver quelque part.
═══════════════════════════════════════════════════════════════ */

import { avecZone } from "@/lib/config/teamLabel";
import { genderLabel } from "@/lib/config/gender";

export interface EquipeLibellable {
  name?: string | null;
  age_group?: string | null;
  division?: string | null;
  gender?: string | null;
  zone?: string | null;
}

export interface OptionsLibelle {
  /** Préfixe la partie attributs (« Basketball · Juvénile · … »). */
  sport?: string | null;
  /** Ferme la partie attributs (« … · Masculin · RSEQ »). */
  ligue?: string | null;
}

const net = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Casse, accents et espaces multiples ignorés — pour comparer et chercher. */
export function normaliserTexte(s: string | null | undefined): string {
  return net(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
}

/** Vrai si le nom de l'équipe n'apporte rien : vide, ou identique au club. */
export function nomEstCeluiDuClub(nomEquipe: string | null | undefined, nomClub: string | null | undefined): boolean {
  const n = normaliserTexte(nomEquipe);
  return n === "" || (normaliserTexte(nomClub) !== "" && n === normaliserTexte(nomClub));
}

function genreAffiche(g: string | null | undefined): string {
  const v = net(g);
  if (!v) return "";
  const l = genderLabel(v);
  return l === "—" ? "" : l;
}

/** « Catégorie · Division · Genre » (+ sport en tête, ligue en fin). */
export function attributsEquipe(t: EquipeLibellable, o: OptionsLibelle = {}): string {
  return [
    net(o.sport),
    ...avecZone(net(t.age_group), net(t.division), net(t.zone)),
    genreAffiche(t.gender),
    net(o.ligue),
  ].filter(Boolean).join(" · ");
}

/** LE libellé : « NOM — attributs », le nom seulement s'il diffère du club. */
export function libelleEquipe(t: EquipeLibellable, nomClub: string | null | undefined, o: OptionsLibelle = {}): string {
  const attributs = attributsEquipe(t, o);
  const nom = net(t.name);
  if (!nomEstCeluiDuClub(nom, nomClub)) return attributs ? `${nom} — ${attributs}` : nom;
  // Nom = club (ou vide) : les attributs seuls ; à défaut, le nom quand même.
  return attributs || nom;
}

/** Ancienne signature (pickers d'inscription, TeamPickerSheet, /coach/ecole),
 *  désormais branchée sur la règle commune : il FAUT passer le nom du club,
 *  sinon le nom d'une équipe RSEQ (= l'école) s'afficherait. */
export function formatTeamLabel(
  sport: string | null | undefined,
  ageGroup: string | null | undefined,
  division: string | null | undefined,
  gender: string | null | undefined,
  name: string | null | undefined,
  zone: string | null | undefined,
  nomClub: string | null | undefined,
): string {
  return libelleEquipe({ name, age_group: ageGroup, division, gender, zone }, nomClub, { sport });
}

/* ── Ordre des âges ────────────────────────────────────────────────
   Âge approximatif de chaque catégorie, pour trier du plus jeune au plus
   vieux. « Pee-Wee AAA », « M18 AAA » : le calibre suit l'âge, on lit le
   début. Inconnu → après les connus, ordre alphabétique. */
const AGE_PAR_NOM: Record<string, number> = {
  novice: 8, atome: 10, moustique: 11, "pee-wee": 12, peewee: 12, benjamin: 13,
  bantam: 14, cadet: 15, midget: 17, juvenile: 17, collegial: 19, junior: 20, senior: 22,
};

export function rangCategorie(cat: string | null | undefined): number {
  const c = normaliserTexte(cat);
  if (!c) return 999;
  const num = /^[mu]\s?(\d{1,2})\b/.exec(c);
  if (num) return Number(num[1]);
  for (const [nom, age] of Object.entries(AGE_PAR_NOM)) {
    if (c === nom || c.startsWith(`${nom} `)) return age;
  }
  return 500;
}

const fr = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base", numeric: true });

/** Comparateur commun : nom, catégorie (ordre des âges), division, genre. */
export function comparerEquipes(a: EquipeLibellable, b: EquipeLibellable): number {
  return fr(net(a.name), net(b.name))
    || rangCategorie(a.age_group) - rangCategorie(b.age_group)
    || fr(net(a.age_group), net(b.age_group))
    || fr(net(a.division), net(b.division))
    || fr(genreAffiche(a.gender), genreAffiche(b.gender));
}

export function trierEquipes<T extends EquipeLibellable>(equipes: readonly T[]): T[] {
  return [...equipes].sort(comparerEquipes);
}

/** Recherche commune : chaque mot tapé doit se trouver dans le nom ou un
 *  attribut (genre compris, sous sa forme brute ET affichée). */
export function equipeCorrespond(t: EquipeLibellable, recherche: string, o: OptionsLibelle = {}): boolean {
  const mots = normaliserTexte(recherche).split(" ").filter(Boolean);
  if (mots.length === 0) return true;
  const botte = normaliserTexte([
    t.name, t.age_group, t.division, t.zone, t.gender, genreAffiche(t.gender), o.sport, o.ligue,
  ].map(net).filter(Boolean).join(" "));
  return mots.every((m) => botte.includes(m));
}

/* ── Équipe RÉSOLUE (code d'adhésion, transfert) — décision BP 2026-10-15 ──
   Le bloc « Tu rejoins » affichait une seule ligne : « Club · Sport ·
   Catégorie · Division · Genre · Saison · Ligue ». Le club y figurait deux fois
   (en tête, puis comme ligue : « No Limits Showcases ») et l'essentiel s'y
   noyait. Désormais, sous le nom de l'équipe :
     - ligne 1, en évidence : Catégorie · Division · Genre (zone : règle actuelle) ;
     - ligne 2, discrète     : Club · Sport · Saison (+ Ligue SEULEMENT si son
       nom diffère de celui du club, casse et accents ignorés).
   Un champ vide disparaît. */
export interface EquipeResolue extends EquipeLibellable {
  sport?: string | null;
  season?: string | null;
  league?: string | null;
}

export function lignesEquipeResolue(
  t: EquipeResolue,
  nomClub: string | null | undefined,
): { essentiel: string; contexte: string } {
  const ligue = net(t.league);
  return {
    essentiel: attributsEquipe(t),
    contexte: [
      net(nomClub),
      net(t.sport),
      net(t.season),
      ligue && !nomEstCeluiDuClub(ligue, nomClub) ? ligue : "",
    ].filter(Boolean).join(" · "),
  };
}
