// lib/queries/teamPage/teamPageData.ts
//
// Couche données « Page équipe » CÉGEP — jumelle de schoolPage/schoolPageData.
// Load + save du contenu éditeur ↔ tables team_page_content / team_pennants /
// team_events / team_position_needs. Client Supabase AUTHENTIFIÉ : la RLS
// (can_edit_team_page → can_edit_school_page via teams.school_id) fait le
// contrôle. AUCUN service role ici.
//
// Les besoins ne sont JAMAIS seedés pour les 7 943 équipes : tant que le collège
// n'a rien enregistré, la table est vide et le rendu retombe sur les défauts du
// code (SPORT_CONFIGS). Le premier save matérialise les lignes du sport.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Niveau, PennantType } from "@/components/team-page/content";

/* ── formes éditeur ──────────────────────────────────────────────────────── */
export interface TeamContentState {
  hero_image_path: string | null;
  hero_focal_x: number;
  hero_focal_y: number;
  hero_zoom: number;
  record_saison: string;
  playoff_result: string;
  use_school_socials: boolean;
  /** Liste libre de liens (max 5) — forme stockée : [{type,url}]. jsonb, zéro DDL. */
  socials: { type: string; url: string }[];
  presentation_text: string;
  championships: number | null;
  staff_since: number | null;
  headcoach_photo_path: string | null;
  /** Cadrage de la photo du coach — même modèle que le hero. Défauts 50/50/100
   *  et non 50/25/100 : la vignette était en `object-fit: cover` sans
   *  `object-position`, donc centrée par le navigateur. */
  headcoach_focal_x: number;
  headcoach_focal_y: number;
  headcoach_zoom: number;
  headcoach_bio: string;
  /** Compte COACH désigné (éditorial — n'accorde aucun droit). */
  headcoach_user_id: string | null;
  /** Repli quand le coach n'a pas de compte. Ignoré si un compte est désigné. */
  headcoach_name: string;
  hidden_sections: string[];
}
export interface EditorPennant { id?: string; titre: string; annee: number | null; type: PennantType }
export interface EditorCamp { id?: string; titre: string; event_date: string; lieu: string }
export interface EditorNeed {
  id?: string;
  slot_key: string;
  facette: string;
  acronym: string;
  label: string;
  position_ids: string[];
  niveau: Niveau;
  pitch: string;
  is_hidden: boolean;
}

const CONTENT_COLS =
  "hero_image_path, hero_focal_x, hero_focal_y, hero_zoom, record_saison, playoff_result, use_school_socials, socials, presentation_text, championships, staff_since, headcoach_photo_path, headcoach_focal_x, headcoach_focal_y, headcoach_zoom, headcoach_bio, headcoach_user_id, headcoach_name, hidden_sections";

const s = (v: unknown): string => (v == null ? "" : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const num = (v: unknown, dflt: number): number => (typeof v === "number" ? v : dflt);

export interface TeamPageLoad {
  content: TeamContentState | null;     // null = équipe jamais configurée
  pennants: EditorPennant[];
  camps: EditorCamp[];
  needs: EditorNeed[];
  jetons: { pennants: string; events: string };
}

/** Charge tout le contenu d'une équipe. content NULL → l'appelant applique ses
 *  défauts (jamais un préremplissage faux). */
export async function loadTeamPage(
  supabase: SupabaseClient, teamId: string,
): Promise<TeamPageLoad> {
  const [c, pen, ev, nd, sigPen, sigEv] = await Promise.all([
    supabase.from("team_page_content").select(CONTENT_COLS).eq("team_id", teamId).maybeSingle(),
    supabase.from("team_pennants").select("id, titre, annee, type, position").eq("team_id", teamId).order("position"),
    supabase.from("team_events").select("id, titre, event_date, lieu, position").eq("team_id", teamId).order("position"),
    supabase.from("team_position_needs").select("id, slot_key, facette, acronym, label, position_ids, niveau, pitch, is_hidden").eq("team_id", teamId),
    // Jetons de contenu : OPAQUES. Le client ne les calcule jamais, il les
    // reçoit ici et les rend tels quels à savePennants / saveCamps.
    supabase.rpc("sig_team_pennants", { p_team_id: teamId }),
    supabase.rpc("sig_team_events", { p_team_id: teamId }),
  ]);
  for (const r of [c, pen, ev, nd]) if (r.error) throw r.error;
  // Les jetons ne sont PAS fatals : ce loader sert aussi le rendu public, lu
  // par des visiteurs `anon` à qui les fonctions sig_* sont révoquées. Un jeton
  // vide échoue FERMÉ — la RPC refusera l'écriture — plutôt que de faire
  // planter une page qui n'a jamais eu besoin de ce champ.

  const row = c.data as Record<string, unknown> | null;
  const content: TeamContentState | null = row && {
    hero_image_path: (row.hero_image_path as string | null) ?? null,
    hero_focal_x: num(row.hero_focal_x, 50),
    hero_focal_y: num(row.hero_focal_y, 25),
    hero_zoom: num(row.hero_zoom, 100),
    record_saison: s(row.record_saison),
    playoff_result: s(row.playoff_result),
    use_school_socials: row.use_school_socials !== false,
    socials: arr<{ type?: string; kind?: string; url: string }>(row.socials)
      .map((s) => ({ type: s.type ?? s.kind ?? "", url: s.url ?? "" }))
      .filter((s) => s.type && s.url),
    presentation_text: s(row.presentation_text),
    championships: (row.championships as number | null) ?? null,
    staff_since: (row.staff_since as number | null) ?? null,
    headcoach_photo_path: (row.headcoach_photo_path as string | null) ?? null,
    headcoach_focal_x: num(row.headcoach_focal_x, 50),
    headcoach_focal_y: num(row.headcoach_focal_y, 50),
    headcoach_zoom: num(row.headcoach_zoom, 100),
    headcoach_bio: s(row.headcoach_bio),
    headcoach_user_id: (row.headcoach_user_id as string | null) ?? null,
    headcoach_name: s(row.headcoach_name),
    hidden_sections: arr<string>(row.hidden_sections).filter(Boolean),
  };

  return {
    content,
    pennants: (pen.data ?? []).map((p) => ({
      id: p.id as string, titre: s(p.titre),
      annee: (p.annee as number | null) ?? null,
      type: (p.type as PennantType) ?? "championnat",
    })),
    camps: (ev.data ?? []).map((e) => ({
      id: e.id as string, titre: s(e.titre),
      event_date: s(e.event_date), lieu: s(e.lieu),
    })),
    jetons: {
      pennants: (sigPen.data as string | null) ?? "",
      events: (sigEv.data as string | null) ?? "",
    },
    needs: (nd.data ?? []).map((n) => ({
      id: n.id as string,
      slot_key: s(n.slot_key), facette: s(n.facette) || "main",
      acronym: s(n.acronym), label: s(n.label),
      position_ids: arr<string>(n.position_ids),
      niveau: (n.niveau as Niveau) ?? "complet",
      pitch: s(n.pitch), is_hidden: n.is_hidden === true,
    })),
  };
}

/* ── SAVE par section (client authentifié, RLS = le contrôle) ────────────── */

/** S2/S4 + visibilité : upsert de la ligne 1:1 team_page_content. */
export async function saveTeamContent(
  supabase: SupabaseClient, teamId: string, patch: Record<string, unknown>, userId: string,
): Promise<void> {
  const { error } = await supabase.from("team_page_content").upsert(
    { team_id: teamId, ...patch, updated_at: new Date().toISOString(), updated_by: userId },
    { onConflict: "team_id" },
  );
  if (error) throw error;
}

/** Plafond de fanions par équipe. DOIT rester égal à l'argument du trigger
 *  `trg_cap_team_pennants` (_cap_rows_per_team) — sinon la base refuse ce que
 *  l'interface autorise. L'éditeur lit cette constante, il ne la redéclare pas. */
export const MAX_TEAM_PENNANTS = 8;

/** Fanions (max MAX_TEAM_PENNANTS) — remplacement TRANSACTIONNEL sous verrou de jeton.
 *  Jumelle de saveCards. Pas de `apresSuppression` : plus rien n'est supprimé
 *  en cas d'échec. Voir replace_team_pennants. */
export async function savePennants(
  supabase: SupabaseClient, teamId: string, pennants: EditorPennant[],
  jeton: string, autoriserVide = false,
): Promise<{ n: number; jeton: string }> {
  const { data, error } = await supabase.rpc("replace_team_pennants", {
    p_team_id: teamId,
    p_rows: pennants.filter((p) => p.titre.trim()).slice(0, MAX_TEAM_PENNANTS)
      .map((p) => ({ id: p.id ?? null, titre: p.titre.trim(),
                     annee: p.annee == null ? "" : String(p.annee), type: p.type })),
    p_jeton: jeton,
    p_autoriser_vide: autoriserVide,
  });
  if (error) throw error;
  return data as { n: number; jeton: string };
}

/** Plafond d'événements par équipe. DOIT rester égal à l'argument du trigger
 *  `trg_cap_team_events` (_cap_rows_per_team) — sinon la base refuse ce que
 *  l'interface autorise. L'éditeur lit cette constante, il ne la redéclare pas.
 *  Voir supabase/migrations/20260731160000_team_events_cap_8.sql. */
export const MAX_TEAM_EVENTS = 8;

/** Camps & essais (max MAX_TEAM_EVENTS) — remplacement TRANSACTIONNEL sous
 *  verrou de jeton. Pas de `apresSuppression`. Voir replace_team_events. */
export async function saveCamps(
  supabase: SupabaseClient, teamId: string, camps: EditorCamp[],
  jeton: string, autoriserVide = false,
): Promise<{ n: number; jeton: string }> {
  const { data, error } = await supabase.rpc("replace_team_events", {
    p_team_id: teamId,
    p_rows: camps.filter((c) => c.titre.trim()).slice(0, MAX_TEAM_EVENTS)
      .map((c) => ({ id: c.id ?? null, titre: c.titre.trim(),
                     event_date: c.event_date || "", lieu: c.lieu || "" })),
    p_jeton: jeton,
    p_autoriser_vide: autoriserVide,
  });
  if (error) throw error;
  return data as { n: number; jeton: string };
}

/** Besoins : matérialisation des slots du sport. On n'écrit QUE des slot_key
 *  issus du layout (l'éditeur n'offre aucun ajout) ; l'upsert respecte
 *  UNIQUE(team_id, slot_key) et le trigger d'intégrité des positions. */
export async function saveNeeds(
  supabase: SupabaseClient, teamId: string, needs: EditorNeed[], userId: string,
): Promise<void> {
  if (!needs.length) return;
  const rows = needs.map((n) => ({
    team_id: teamId,
    slot_key: n.slot_key,
    facette: n.facette || "main",
    acronym: n.acronym || null,
    label: n.label || null,
    position_ids: n.position_ids,
    niveau: n.niveau,
    pitch: n.pitch || null,
    is_hidden: n.is_hidden,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }));
  const { error } = await supabase.from("team_position_needs").upsert(rows, { onConflict: "team_id,slot_key" });
  if (error) throw error;
}
