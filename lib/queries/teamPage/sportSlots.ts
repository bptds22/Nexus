// lib/queries/teamPage/sportSlots.ts
//
// Pont SPORT ↔ LAYOUT ↔ POSITIONS. Le layout d'un sport (facettes + slots) vit
// dans le CODE (SPORT_CONFIGS) : c'est lui qui fournit les défauts des besoins
// tant que l'équipe n'a rien enregistré — d'où l'absence totale de seed DB pour
// les 7 943 équipes. L'ancrage « match parfait » est stocké en UUID de
// public.positions ; le moteur de rendu, lui, raisonne en abréviations.

import { SPORT_CONFIGS, type TeamNeed, type Niveau } from "@/components/team-page/content";
import type { EditorNeed } from "./teamPageData";

export type SportKey = keyof typeof SPORT_CONFIGS;
export interface PositionRow { id: string; nom: string; abreviation: string | null }

/** sports.nom (DB, 16 sports) → clé de layout. null = sport sans terrain Nexus
 *  (athlétisme, natation…) : la page rend tout SAUF le widget besoins. */
export function sportKeyFromNom(nom: string | null | undefined): SportKey | null {
  const n = (nom ?? "").toLowerCase().trim();
  if (!n) return null;
  if (n.startsWith("flag")) return "flag";           // « Flag football » AVANT « football »
  if (n.includes("football")) return "football";
  if (n.includes("basket")) return "basketball";
  if (n.includes("hockey")) return "hockey";
  if (n.includes("baseball")) return "baseball";
  if (n.includes("soccer")) return "soccer";
  if (n.includes("volley")) return "volleyball";
  return null;
}

/** Tous les slots du sport, à plat (ordre du layout). */
export function slotsOf(sportKey: SportKey) {
  return SPORT_CONFIGS[sportKey].facettes.flatMap((f) =>
    f.groups.map((g) => ({ facette: f.key, facetteLabel: f.label, ...g })),
  );
}

/** Défauts du sport, prêts à éditer — AUCUNE ligne DB requise. Les positions
 *  ancrées par défaut = celles du layout, résolues en UUID via public.positions
 *  (une abréviation inconnue du sport est simplement ignorée : jamais d'ancrage
 *  fantôme, le trigger DB la refuserait de toute façon). */
export function defaultNeeds(sportKey: SportKey, positions: PositionRow[]): EditorNeed[] {
  const byAbbr = new Map(
    positions.filter((p) => p.abreviation).map((p) => [p.abreviation!.toUpperCase(), p.id]),
  );
  return slotsOf(sportKey).map((s) => ({
    slot_key: s.key,
    facette: s.facette,
    acronym: s.acro,
    label: s.label,
    position_ids: s.positions.map((a) => byAbbr.get(a.toUpperCase())).filter((x): x is string => !!x),
    niveau: "complet" as Niveau,
    pitch: "",
    is_hidden: false,
  }));
}

/** Défauts du code + lignes DB par-dessus (la ligne enregistrée gagne pour SON
 *  slot). L'ordre reste celui du layout — jamais celui de la DB. */
export function mergeNeeds(defaults: EditorNeed[], rows: EditorNeed[]): EditorNeed[] {
  const db = new Map(rows.map((r) => [r.slot_key, r]));
  return defaults.map((d) => {
    const r = db.get(d.slot_key);
    return r ? { ...d, ...r, facette: d.facette } : d; // la facette reste celle du layout
  });
}

/** Forme éditeur → forme moteur de rendu (abréviations). */
export function toTeamNeeds(needs: EditorNeed[], positions: PositionRow[]): TeamNeed[] {
  const byId = new Map(positions.map((p) => [p.id, (p.abreviation ?? "").toUpperCase()]));
  return needs.map((n) => ({
    slotKey: n.slot_key,
    facette: n.facette,
    acronym: n.acronym,
    label: n.label,
    positions: n.position_ids.map((id) => byId.get(id)).filter((x): x is string => !!x),
    niveau: n.niveau,
    pitch: n.pitch,
    hidden: n.is_hidden,
  }));
}
