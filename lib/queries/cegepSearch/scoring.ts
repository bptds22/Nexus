// lib/queries/cegepSearch/scoring.ts
//
// Score de pertinence « Tes meilleurs fits » — TRANSPARENT par construction :
// chaque point marqué produit une raison affichable. Si on ne peut pas dire
// pourquoi, on ne marque pas le point.
//
// Poids (arbitrage produit) : poste 3 > programme 2 > distance 1 > langue 1.
// Le poste ne pilote JAMAIS le tri à lui seul : au lancement presque aucun
// collège n'a saisi ses besoins, un tri qui en dépendrait afficherait un
// classement vide de sens. Programme + distance + langue suffisent à trier.

import type { CegepRow, ViewerProfile } from "./searchData";

/** Comparaison accent- et casse-insensible (unaccent n'est pas installé en DB,
 *  et de toute façon le catalogue tient en mémoire). */
export function norm(v: string): string {
  return v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Distance à vol d'oiseau (km). Null si l'une des deux positions manque —
 *  une école non géocodée n'est jamais exclue, elle est juste « sans distance ». */
export function distanceKm(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Centre d'une région = barycentre de ses cégeps géocodés. Sert d'origine au
 *  filtre distance : l'athlète n'a pas de coordonnées propres en base, mais il
 *  a une région (son école) et il peut en choisir une dans le rail. */
export function regionCentroid(cegeps: CegepRow[], region: string): { lat: number | null; lng: number | null } {
  const pts = cegeps.filter((c) => c.region === region && c.lat != null && c.lng != null);
  if (!pts.length) return { lat: null, lng: null };
  return {
    lat: pts.reduce((s, c) => s + (c.lat as number), 0) / pts.length,
    lng: pts.reduce((s, c) => s + (c.lng as number), 0) / pts.length,
  };
}

export interface FitResult {
  score: number;
  raisons: string[];
  distance: number | null;
}

export interface FitInput {
  viewer: ViewerProfile | null;
  postesEnDemande: Set<string>;
  origine: { lat: number | null; lng: number | null };
  /** Langues cochées dans le rail — c'est l'athlète qui exprime la préférence,
   *  on ne l'infère jamais de son nom ni de sa région. */
  languesChoisies: string[];
}

const P_POSTE = 3, P_PROGRAMME = 2, P_DISTANCE = 1, P_LANGUE = 1;

export function scoreCegep(c: CegepRow, i: FitInput): FitResult {
  const distance = distanceKm(i.origine, c);
  if (!i.viewer) return { score: 0, raisons: [], distance };

  let score = 0;
  const raisons: string[] = [];

  // 1. Poste en demande — le signal le plus fort, mais rare au lancement.
  if (i.postesEnDemande.has(c.id)) {
    score += P_POSTE;
    raisons.push(i.viewer.positionNom ? `${i.viewer.positionNom} en demande` : "ton poste en demande");
  }

  // 2. Programme visé offert — JOINTURE, plus sous-chaîne.
  //
  // AVANT T2 : `o.includes(norm(p)) || norm(p).includes(o)` sur le texte
  // libre de l'athlète contre les noms locaux des cégeps. Rejoué sur les
  // données réelles, ce test marquait le point pour 2 athlètes sur 40 :
  // « DEC général » (28 athlètes) ne correspond à aucun nom de programme,
  // et « Technique — Physiothérapie » échouait alors que
  // « DEC Techniques de physiothérapie » existe chez 12 cégeps.
  // P_PROGRAMME était décoratif.
  //
  // DEPUIS : intersection d'ensembles sur cegep_programs.id. La raison
  // affichée reste le LIBELLÉ choisi par l'athlète — c'est son mot, pas
  // la formule ministérielle.
  if (i.viewer.programmeIdsVises.length && c.programmeIds.length) {
    const offerts = new Set(c.programmeIds);
    const idx = i.viewer.programmeIdsVises.findIndex((pid) => offerts.has(pid));
    if (idx >= 0) {
      score += P_PROGRAMME;
      raisons.push(`${i.viewer.programmesVises[idx] ?? i.viewer.programmesVises[0] ?? "programme visé"} offert`);
    }
  }

  // 3. Proximité — sous 60 km on considère que c'est « proche de chez toi ».
  // Le tilde n'est pas décoratif : la distance part du BARYCENTRE de la région
  // (l'athlète n'a pas de coordonnées propres en base), elle est donc
  // approximative par construction. Ne jamais l'écrire comme une mesure exacte.
  if (distance != null && distance <= 60) {
    score += P_DISTANCE;
    raisons.push(`~${distance} km`);
  }

  // 4. Langue : le point ne se marque que si l'athlète a coché une langue —
  //    l'intention vient de lui, on ne suppose rien à partir de son nom.
  if (i.languesChoisies.length && c.langue && i.languesChoisies.includes(c.langue)) {
    score += P_LANGUE;
    const lib = c.langue === "FR" ? "français" : c.langue === "EN" ? "anglais" : "bilingue";
    raisons.push(`enseignement ${lib}`);
  }

  return { score, raisons, distance };
}

export const POIDS = { poste: P_POSTE, programme: P_PROGRAMME, distance: P_DISTANCE, langue: P_LANGUE };
