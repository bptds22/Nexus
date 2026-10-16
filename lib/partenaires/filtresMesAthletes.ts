/* ═══════════════════════════════════════════════════════════════
   « Mes athlètes » du partenaire — recherche et filtre « Distinctions »
   (demande BP du 2026-10-16). Logique pure, partagée web et appli.

   - Recherche : par MOTS, accents et casse ignorés ; chaque mot doit
     figurer dans le prénom, le nom, l'école/club ou la position (nom ou
     abréviation). Même lecture que la recherche coach et recruteur.
   - Distinctions : choix multiple parmi les badges que le partenaire a
     RÉELLEMENT remis à ses athlètes — ses badges propres et les badges
     Nexus qu'il a attribués (non retirés). Un athlète passe s'il porte AU
     MOINS UN des badges choisis. Aucun badge choisi = filtre inactif.
     « Tout » choisit tous les badges (les athlètes seulement évalués, sans
     badge, sortent alors) ; « Aucun » vide le choix (filtre inactif).
   - Les filtres se combinent (ET) : recherche ET distinctions.
═══════════════════════════════════════════════════════════════ */

import type { BadgeMonAthlete, MonAthlete } from "@/lib/partenaires/mesAthletes";

export interface OptionDistinction {
  /** Clé stable du filtre : « nexus:<badges.id> » ou « propre:<partner_badges.id> ». */
  cle: string;
  libelle: string;
  nexus: boolean;
  /** Pour l'icône (même source que la liste). */
  code: string | null;
  iconePath: string | null;
  /** Nombre d'athlètes de la liste qui portent ce badge. */
  nbAthletes: number;
}

export interface FiltresMesAthletes {
  texte: string;
  /** Clés choisies ; vide = filtre « Distinctions » inactif. */
  distinctions: ReadonlySet<string>;
}

export const FILTRES_VIDES: FiltresMesAthletes = { texte: "", distinctions: new Set() };

export function normaliserRecherche(v: string | null | undefined): string {
  return (v ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function motsRecherche(texte: string): string[] {
  return normaliserRecherche(texte).split(/\s+/).filter(Boolean);
}

/** La clé de filtre d'un badge. Sans badge_ref (serveur d'avant la migration), repli sur le libellé. */
export function cleDistinction(b: Pick<BadgeMonAthlete, "nexus" | "badgeRef" | "libelle">): string {
  const ref = b.badgeRef ?? `libelle:${normaliserRecherche(b.libelle)}`;
  return `${b.nexus ? "nexus" : "propre"}:${ref}`;
}

export function correspondRecherche(a: MonAthlete, mots: readonly string[]): boolean {
  if (mots.length === 0) return true;
  const champs = [a.prenom, a.nom, a.ecole, a.poste, a.posteAbr].map(normaliserRecherche).filter(Boolean);
  return mots.every((m) => champs.some((c) => c.includes(m)));
}

export function correspondDistinctions(a: MonAthlete, choix: ReadonlySet<string>): boolean {
  if (choix.size === 0) return true;
  return a.badges.some((b) => choix.has(cleDistinction(b)));
}

export function filtrerMesAthletes(athletes: readonly MonAthlete[], f: FiltresMesAthletes): MonAthlete[] {
  const mots = motsRecherche(f.texte);
  return athletes.filter((a) => correspondRecherche(a, mots) && correspondDistinctions(a, f.distinctions));
}

/** Les badges proposés au filtre : badges propres d'abord, puis Nexus ; par libellé. */
export function optionsDistinctions(athletes: readonly MonAthlete[]): OptionDistinction[] {
  const parCle = new Map<string, OptionDistinction & { vus: Set<string> }>();
  for (const a of athletes) {
    for (const b of a.badges) {
      const cle = cleDistinction(b);
      let o = parCle.get(cle);
      if (!o) {
        o = { cle, libelle: b.libelle ?? "—", nexus: b.nexus, code: b.code, iconePath: b.iconePath, nbAthletes: 0, vus: new Set() };
        parCle.set(cle, o);
      }
      o.vus.add(a.athleteId);
    }
  }
  return [...parCle.values()]
    .map(({ vus, ...o }) => ({ ...o, nbAthletes: vus.size }))
    .sort((x, y) => Number(x.nexus) - Number(y.nexus) || x.libelle.localeCompare(y.libelle, "fr"));
}

/** « Tout » : toutes les clés proposées. */
export function toutesLesDistinctions(options: readonly OptionDistinction[]): Set<string> {
  return new Set(options.map((o) => o.cle));
}

/** Bascule une clé dans le choix (nouvel ensemble, jamais muté). */
export function basculerDistinction(choix: ReadonlySet<string>, cle: string): Set<string> {
  const n = new Set(choix);
  if (n.has(cle)) n.delete(cle); else n.add(cle);
  return n;
}

/** Retire du choix les clés qui ne sont plus proposées (badge retiré, liste rechargée). */
export function elaguerDistinctions(choix: ReadonlySet<string>, options: readonly OptionDistinction[]): Set<string> {
  const ok = toutesLesDistinctions(options);
  return new Set([...choix].filter((c) => ok.has(c)));
}

/** Le texte du bouton du filtre. */
export function resumeDistinctions(choix: ReadonlySet<string>, options: readonly OptionDistinction[]): string {
  const n = [...choix].filter((c) => options.some((o) => o.cle === c)).length;
  if (n === 0) return "Distinctions";
  if (n === options.length) return "Toutes les distinctions";
  if (n === 1) return options.find((o) => choix.has(o.cle))?.libelle ?? "1 distinction";
  return `${n} distinctions`;
}

export function filtresActifs(f: FiltresMesAthletes): boolean {
  return motsRecherche(f.texte).length > 0 || f.distinctions.size > 0;
}
