// lib/queries/schoolPage/schoolPageData.ts
//
// Couche données « Ma page » CÉGEP (Bloc 2 étape 4). Load + save du contenu
// éditeur ↔ tables school_page_content / school_campus_cards / school_programs /
// school_news. Utilise le client Supabase AUTHENTIFIÉ (browser) : la RLS
// (can_edit_school_page) autorise les recruteurs + is_school_admin du collège.
// AUCUN service role ici (c'est l'éditeur réel de l'utilisateur).

import type { SupabaseClient } from "@supabase/supabase-js";

/* ── forme éditeur (miroir des champs de l'éditeur v3) ─────────────────── */
export interface EditorProgram { id?: string; name: string; code: string | null; type: "preuniversitaire" | "technique"; is_displayed: boolean; source: "seed" | "manuel" }
export interface EditorCard { id?: string; titre: string; legende: string; image_path: string | null }
export interface EditorNews { id?: string; titre: string; url: string }

export interface SchoolPageState {
  // S1 identité & mur
  nickname: string; slogan: string; tagline: string; province: string;
  ville: string; quartier: string; code_regional: string;
  initiales: string; rail_word: string; devise_1: string; devise_2: string;
  arrow_avant: string; arrow_apres: string; wall_words: string[];
  ticker_text: string; color_primary: string; color_dark: string; color_light: string;
  nb_athletes: string; logo_path: string | null;
  // S3 campus
  campus_video_url: string; cards: EditorCard[];
  // S4 à propos
  about_title: string; sell_text: string;
  // S5 programmes
  programs: EditorProgram[];
  // S6 parcours
  niveau: string; encadrement: string[]; stat_usports: number | null;
  stat_usa: number | null; stat_diplomation: number | null; universities: string[];
  // S7 news
  news: EditorNews[];
  // visibilité par section (clés masquées : about/campus/programs/parcours/news)
  hidden_sections: string[];
}

const CONTENT_COLS =
  "nickname, slogan, tagline, province, ville, quartier, code_regional, initiales, rail_word, devise_1, devise_2, arrow_avant, arrow_apres, wall_words, ticker_text, color_primary, color_dark, color_light, nb_athletes, logo_path, campus_video_url, about_title, sell_text, niveau, encadrement, stat_usports, stat_usa, stat_diplomation, universities, hidden_sections";

/** null-safe : chaîne DB → chaîne éditeur ('' si null). */
const s = (v: unknown): string => (v == null ? "" : String(v));
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** Charge le contenu complet d'une école. content NULL (page jamais configurée)
 *  → renvoie null pour content ; l'appelant applique ses valeurs par défaut. */
export async function loadSchoolPage(
  supabase: SupabaseClient, schoolId: string,
): Promise<{ content: Partial<SchoolPageState> | null; cards: EditorCard[]; programs: EditorProgram[]; news: EditorNews[] }> {
  const [c, cards, progs, news] = await Promise.all([
    supabase.from("school_page_content").select(CONTENT_COLS).eq("school_id", schoolId).maybeSingle(),
    supabase.from("school_campus_cards").select("id, titre, legende, image_path, position").eq("school_id", schoolId).order("position"),
    supabase.from("school_programs").select("id, name, code, type, is_displayed, source, position").eq("school_id", schoolId).order("position"),
    supabase.from("school_news").select("id, titre, url, position").eq("school_id", schoolId).order("position"),
  ]);
  for (const r of [c, cards, progs, news]) if (r.error) throw r.error;

  const row = c.data as Record<string, unknown> | null;
  const content: Partial<SchoolPageState> | null = row && {
    nickname: s(row.nickname), slogan: s(row.slogan), tagline: s(row.tagline), province: s(row.province),
    ville: s(row.ville), quartier: s(row.quartier), code_regional: s(row.code_regional),
    initiales: s(row.initiales), rail_word: s(row.rail_word), devise_1: s(row.devise_1), devise_2: s(row.devise_2),
    arrow_avant: s(row.arrow_avant), arrow_apres: s(row.arrow_apres), wall_words: arr(row.wall_words),
    ticker_text: s(row.ticker_text), color_primary: s(row.color_primary), color_dark: s(row.color_dark), color_light: s(row.color_light),
    nb_athletes: s(row.nb_athletes), logo_path: (row.logo_path as string | null) ?? null,
    campus_video_url: s(row.campus_video_url), about_title: s(row.about_title), sell_text: s(row.sell_text),
    niveau: s(row.niveau), encadrement: arr(row.encadrement),
    stat_usports: (row.stat_usports as number | null) ?? null,
    stat_usa: (row.stat_usa as number | null) ?? null,
    stat_diplomation: (row.stat_diplomation as number | null) ?? null,
    universities: arr(row.universities),
    hidden_sections: arr(row.hidden_sections),
  };
  return {
    content,
    cards: (cards.data ?? []).map((c2) => ({ id: c2.id, titre: c2.titre ?? "", legende: c2.legende ?? "", image_path: c2.image_path ?? null })),
    programs: (progs.data ?? []) as EditorProgram[],
    news: (news.data ?? []).map((n) => ({ id: n.id, titre: n.titre ?? "", url: n.url ?? "" })),
  };
}

/* ── SAVE par section (UPDATE/INSERT/DELETE via client authentifié) ─────── */

/** S1/S3/S4/S6 : upsert de la ligne 1:1 school_page_content. */
export async function savePageContent(
  supabase: SupabaseClient, schoolId: string, patch: Partial<Record<string, unknown>>, userId: string,
): Promise<void> {
  const { error } = await supabase.from("school_page_content")
    .upsert({ school_id: schoolId, ...patch, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: "school_id" });
  if (error) throw error;
}

/** Remplace toutes les cartes d'une école (delete + insert positionnés). Pas de
 *  DELETE de données « métier » — ce sont les cartes de l'école, réécrites par
 *  son propre gestionnaire. */
export async function saveCards(supabase: SupabaseClient, schoolId: string, cards: EditorCard[]): Promise<void> {
  const del = await supabase.from("school_campus_cards").delete().eq("school_id", schoolId);
  if (del.error) throw del.error;
  if (!cards.length) return;
  const rows = cards.map((c, i) => ({ school_id: schoolId, titre: c.titre, legende: c.legende, image_path: c.image_path, position: i }));
  const { error } = await supabase.from("school_campus_cards").insert(rows);
  if (error) throw error;
}

export async function saveNews(supabase: SupabaseClient, schoolId: string, news: EditorNews[]): Promise<void> {
  const del = await supabase.from("school_news").delete().eq("school_id", schoolId);
  if (del.error) throw del.error;
  const rows = news.filter((n) => n.titre).map((n, i) => ({ school_id: schoolId, titre: n.titre, url: n.url || null, position: i }));
  if (!rows.length) return;
  const { error } = await supabase.from("school_news").insert(rows);
  if (error) throw error;
}

/** S5 programmes : is_displayed togglé + ajouts manuels + retraits. On UPDATE
 *  is_displayed des seedés, INSERT les manuels, DELETE les retirés (manuels ou
 *  seedés retirés de la liste par le collège). */
export async function savePrograms(supabase: SupabaseClient, schoolId: string, progs: EditorProgram[]): Promise<void> {
  const keep = new Set(progs.filter((p) => p.id).map((p) => p.id));
  // retirés = présents en DB, absents de la liste éditeur
  const existing = await supabase.from("school_programs").select("id").eq("school_id", schoolId);
  if (existing.error) throw existing.error;
  const toDelete = (existing.data ?? []).map((r) => r.id).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const d = await supabase.from("school_programs").delete().in("id", toDelete);
    if (d.error) throw d.error;
  }
  // update is_displayed des existants
  for (const p of progs.filter((x) => x.id)) {
    const u = await supabase.from("school_programs").update({ is_displayed: p.is_displayed }).eq("id", p.id!);
    if (u.error) throw u.error;
  }
  // insert des nouveaux (manuels)
  const news = progs.filter((p) => !p.id).map((p, i) => ({ school_id: schoolId, name: p.name, code: p.code, type: p.type, is_displayed: p.is_displayed, source: "manuel" as const, position: i }));
  if (news.length) {
    const { error } = await supabase.from("school_programs").insert(news);
    if (error) throw error;
  }
}
