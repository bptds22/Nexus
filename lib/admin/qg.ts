import { datesCreationComptes } from "@/lib/admin/comptesAthletes";
import {
  debutsPeriodes,
  fenetresADate,
  libellePeriode,
  parPeriode,
  partiesMontreal,
  type Comparaison,
  type Fenetre,
  type Granularite,
} from "@/lib/admin/ecranMural";
import {
  activiteRecruteurs,
  comparer,
  datesActivite,
  filesAttente,
  parcoursInscription,
  recruteursActifs,
  type Lignes,
} from "@/lib/admin/indicateurs";

/* ═══════════════════════════════════════════════════════════════
   QG admin (/admin/qg) — construction pure de la réponse de
   GET /api/admin/qg. Mêmes définitions que l'écran mural
   (lib/admin/indicateurs.ts) ; périodes « à date vs même moment »
   (lib/admin/ecranMural.ts).

   Ce qui sort d'ici : des nombres, des libellés de période et des
   dates d'échéance (jour seulement) — aucun nom, courriel ni identifiant.
═══════════════════════════════════════════════════════════════ */

export const GRANULARITES: Granularite[] = ["jour", "semaine", "mois"];

export function lireGranularite(v: string | null): Granularite {
  return v === "semaine" || v === "mois" ? v : "jour";
}

/** Rendu de admin_comptes_connectes() : total et comptes par rôle. */
export interface Connectes { total: number; par_role: Record<string, number> }

/** Échéances Loi 25 : demandes ouvertes, en retard, à moins de 7 jours. */
export interface EcheancesLoi25 {
  ouvertes: number;
  portabilite: number;
  suppression: number;
  en_retard: number;
  sous_7_jours: number;
  /** AAAA-MM-JJ (Montréal), la plus proche parmi les demandes ouvertes ; null s'il n'y en a pas. */
  prochaine: string | null;
}

/** Ce que la route lit en plus des lignes partagées. */
export interface ExtrasQg {
  connectes: { courant: Connectes; precedent: Connectes };
  /** Échéance (AAAA-MM-JJ) de chaque demande de portabilité/accès ouverte. */
  echeancesPortabilite: string[];
  /** Date de dépôt (ISO) de chaque demande de suppression ouverte. */
  suppressionsDeposees: string[];
}

export interface PointSerie { libelle: string; en_cours: boolean }

export interface QgDonnees {
  calcule_le: string;
  periode: Granularite;
  fenetres: { courant_de: string; courant_a: string; precedent_de: string; precedent_a: string };
  aujourdhui: ReturnType<typeof filesAttente> & { loi25: EcheancesLoi25 };
  croissance: {
    connectes: { courant: Connectes; precedent: Connectes };
    nouveaux: { athletes: Comparaison; autres: Comparaison; par_role: Record<string, Comparaison> };
    serie: (PointSerie & { athletes: number; autres: number })[];
    parcours: ReturnType<typeof parcoursInscription>;
  };
  recruteurs: {
    tuiles: {
      recruteurs_actifs: Comparaison;
      profils_consultes: Comparaison;
      favoris: Comparaison;
      mouvements_processus: Comparaison;
      notes_match: Comparaison;
      messages: Comparaison;
      suivi_cartes: Comparaison;
    };
    serie: (PointSerie & {
      profils_consultes: number; favoris: number; mouvements_processus: number; notes_match: number; messages: number;
    })[];
  };
}

/** Lecture à partir de quand : le plus ancien entre le début de la série et la période d'avant. */
export function lectureDepuis(maintenant: Date, g: Granularite): Date {
  const serie = debutsPeriodes(maintenant, g);
  const f = fenetresADate(maintenant, g);
  return serie[0].getTime() < f.precedent.de.getTime() ? serie[0] : f.precedent.de;
}

/** AAAA-MM-JJ à Montréal. */
export function jourMontreal(instant: Date): string {
  const p = partiesMontreal(instant);
  return `${p.annee}-${String(p.mois).padStart(2, "0")}-${String(p.jour).padStart(2, "0")}`;
}

/** Ajoute `n` jours à une date AAAA-MM-JJ (calendrier, sans heure). */
export function plusJours(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

/** Délai légal Loi 25 : 30 jours (même règle que /admin/loi25 et la colonne deadline). */
export const DELAI_LOI25_JOURS = 30;

export function echeancesLoi25(maintenant: Date, portabilite: string[], suppressionsDeposees: string[]): EcheancesLoi25 {
  const aujourdhui = jourMontreal(maintenant);
  const dans7 = plusJours(aujourdhui, 7);
  const toutes = [
    ...portabilite.filter(Boolean),
    ...suppressionsDeposees.filter(Boolean).map((d) => plusJours(jourMontreal(new Date(d)), DELAI_LOI25_JOURS)),
  ].sort();
  return {
    ouvertes: toutes.length,
    portabilite: portabilite.filter(Boolean).length,
    suppression: suppressionsDeposees.filter(Boolean).length,
    en_retard: toutes.filter((e) => e < aujourdhui).length,
    sous_7_jours: toutes.filter((e) => e >= aujourdhui && e <= dans7).length,
    prochaine: toutes[0] ?? null,
  };
}

const ROLES_NOUVEAUX = ["COACH", "RECRUTEUR", "PARENT", "PARTNER", "ADMIN"] as const;

export function construireQg(l: Lignes, x: ExtrasQg, maintenant: Date, g: Granularite): QgDonnees {
  const f = fenetresADate(maintenant, g);
  const debuts = debutsPeriodes(maintenant, g);
  const act = activiteRecruteurs(l);
  const dates = datesActivite(l, act);

  const datesAthletes = datesCreationComptes(l.fiches, l.sansFiche);
  const datesAutres = l.comptes.filter((c) => c.role !== "ATHLETE").map((c) => c.created_at);
  const parRole: Record<string, Comparaison> = {};
  for (const r of ROLES_NOUVEAUX) parRole[r] = comparer(l.comptes.filter((c) => c.role === r).map((c) => c.created_at), f);

  const serie = <K extends string>(cles: Record<K, (string | null | undefined)[]>) => {
    const comptes = Object.fromEntries(
      (Object.keys(cles) as K[]).map((k) => [k, parPeriode(cles[k], debuts, maintenant)]),
    ) as Record<K, number[]>;
    return debuts.map((d, i) => ({
      libelle: libellePeriode(d, g),
      en_cours: i === debuts.length - 1,
      ...(Object.fromEntries((Object.keys(cles) as K[]).map((k) => [k, comptes[k][i]])) as Record<K, number>),
    }));
  };

  const fenIso = (w: Fenetre) => [w.de.toISOString(), w.a.toISOString()] as const;
  const [cd, ca] = fenIso(f.courant);
  const [pd, pa] = fenIso(f.precedent);

  return {
    calcule_le: maintenant.toISOString(),
    periode: g,
    fenetres: { courant_de: cd, courant_a: ca, precedent_de: pd, precedent_a: pa },
    aujourdhui: {
      ...filesAttente(l),
      loi25: echeancesLoi25(maintenant, x.echeancesPortabilite, x.suppressionsDeposees),
    },
    croissance: {
      connectes: x.connectes,
      nouveaux: { athletes: comparer(datesAthletes, f), autres: comparer(datesAutres, f), par_role: parRole },
      serie: serie({ athletes: datesAthletes, autres: datesAutres }),
      parcours: parcoursInscription(l),
    },
    recruteurs: {
      tuiles: {
        recruteurs_actifs: { courant: recruteursActifs(l, act, f.courant), precedent: recruteursActifs(l, act, f.precedent) },
        profils_consultes: comparer(dates.profils_consultes, f),
        favoris: comparer(dates.favoris, f),
        mouvements_processus: comparer(dates.mouvements_processus, f),
        notes_match: comparer(dates.notes_match, f),
        messages: comparer(dates.messages, f),
        suivi_cartes: comparer(dates.suivi_cartes, f),
      },
      serie: serie({
        profils_consultes: dates.profils_consultes,
        favoris: dates.favoris,
        mouvements_processus: dates.mouvements_processus,
        notes_match: dates.notes_match,
        messages: dates.messages,
      }),
    },
  };
}
