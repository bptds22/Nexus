"use client";

// components/page-editor/editorContext.tsx
//
// Provider « Ma page » CÉGEP (Bloc 2 étape 4a) — câblage RÉEL de l'éditeur.
// Charge l'école du COMPTE CONNECTÉ (useCurrentUser → school_id) + son contenu
// (school_page_content / cards / programs / news) via le client AUTHENTIFIÉ
// (la RLS can_edit_school_page fait le contrôle). Expose :
//   - initial : valeurs de départ NEUTRES (pas GRASSET ; seuls les catalogues
//     WORDS/ENC/UNIS/SUGG restent partagés). Une école à peine configurée part
//     de champs vides + couleurs par défaut — jamais un préremplissage faux.
//   - report(key, value) : chaque section pousse son slice ; diff vs baseline
//     chargé → badge dirty/saved global, zéro handler par champ.
//   - saveAll() : merge des content.* → savePageContent, puis cards/programs/news.
//   - uploadAsset / assetUrl : storage {school_id}/… (buckets school-logos /
//     campus-photos), convention de chemin imposée par les policies ma_page.

import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import {
  loadSchoolPage, savePageContent, saveCards, savePrograms, saveNews,
  type SchoolPageState, type EditorCard, type EditorProgram, type EditorNews,
} from "@/lib/queries/schoolPage/schoolPageData";

type Bucket = "school-logos" | "campus-photos";

/* ── forme d'init consommée par les sections (neutre) ─────────────────────── */
export interface EditorInitial {
  schoolName: string;
  // S1 identité & mur
  nick: string; slog: string; tagline: string; prov: string; tick: string;
  ville: string; quartier: string; rtag: string;
  c1: string; c2: string; c3: string;
  init: string; vword: string; dev1: string; dev2: string; fla: string; flb: string;
  nbath: string; wallWords: string[]; logoPath: string | null;
  // S3 campus
  cards: { id?: string; t: string; x: string; image_path: string | null }[];
  yt: string;
  // S4 à propos
  about_title: string; sell_text: string;
  // S5 programmes (catalogue = school_programs de l'école, PAS le DEC fixture)
  programs: EditorProgram[];
  // S6 parcours
  pniv: string; encOn: string[]; pus: string; pdip: string; pusa: string; universities: string[];
  // S7 news
  news: { t: string; u: string }[];
  // visibilité : clés de sections masquées (about/campus/programs/parcours/news)
  hiddenSections: string[];
}

/** Traduit une erreur RLS/permission (session périmée, mauvais scoping école)
 *  en message actionnable. Sinon renvoie l'erreur telle quelle. */
export function friendlyDbError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string; statusCode?: string })?.code;
  const status = (e as { statusCode?: string })?.statusCode;
  if (code === "42501" || status === "403" || /row.level security/i.test(msg)) {
    return new Error("Ta session a expiré — reconnecte-toi pour enregistrer.");
  }
  return e instanceof Error ? e : new Error(msg);
}

const g = (v: string | null | undefined): string => v ?? "";
const numStr = (v: number | null | undefined): string => (v == null ? "" : String(v));

function dbToEditor(
  schoolName: string,
  c: Partial<SchoolPageState> | null,
  cards: EditorCard[],
  programs: EditorProgram[],
  news: EditorNews[],
): EditorInitial {
  return {
    schoolName,
    nick: g(c?.nickname), slog: g(c?.slogan), tagline: g(c?.tagline),
    prov: c?.province || "Québec", tick: g(c?.ticker_text),
    ville: g(c?.ville), quartier: g(c?.quartier), rtag: g(c?.code_regional),
    c1: c?.color_primary || "#A6192E", c2: c?.color_dark || "#5A0E1B", c3: c?.color_light || "#E8C7CD",
    init: g(c?.initiales), vword: g(c?.rail_word), dev1: g(c?.devise_1), dev2: g(c?.devise_2),
    fla: g(c?.arrow_avant), flb: g(c?.arrow_apres),
    nbath: g(c?.nb_athletes), wallWords: (c?.wall_words ?? []).filter(Boolean), logoPath: c?.logo_path ?? null,
    cards: cards.map((cd) => ({ id: cd.id, t: cd.titre, x: cd.legende, image_path: cd.image_path })),
    yt: g(c?.campus_video_url),
    about_title: g(c?.about_title), sell_text: g(c?.sell_text),
    programs,
    pniv: g(c?.niveau), encOn: (c?.encadrement ?? []).filter(Boolean),
    pus: numStr(c?.stat_usports), pdip: numStr(c?.stat_diplomation), pusa: numStr(c?.stat_usa),
    universities: (c?.universities ?? []).filter(Boolean),
    news: news.map((n) => ({ t: n.titre, u: n.url })),
    hiddenSections: (c?.hidden_sections ?? []).filter(Boolean),
  };
}

/* ── contexte ─────────────────────────────────────────────────────────────── */
interface EditorCtx {
  schoolId: string; userId: string; schoolName: string;
  initial: EditorInitial;
  client: SupabaseClient;
  assetUrl: (path: string | null | undefined, bucket: Bucket) => string | null;
  uploadAsset: (bucket: Bucket, file: File) => Promise<string>;
  report: (key: string, value: unknown) => void;
  saveAll: () => Promise<void>;
  dirty: boolean;
  saving: boolean;
  /** couleurs live (S1) → pilotent le thème de TOUTES les previews (#3). */
  previewColors: { c1: string; c2: string; c3: string };
  setPreviewColors: (c: { c1: string; c2: string; c3: string }) => void;
  /** visibilité par section — clés masquées + toggle. */
  hiddenSections: string[];
  toggleSection: (key: string) => void;
}

const Ctx = React.createContext<EditorCtx | null>(null);
export function useEditor(): EditorCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useEditor doit être utilisé dans <SchoolPageEditorProvider>");
  return v;
}

export function SchoolPageEditorProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  const schoolId = user?.profile.school_id ?? null;

  const clientRef = React.useRef<SupabaseClient | null>(null);
  if (!clientRef.current) clientRef.current = createClient();
  const client = clientRef.current;

  const [load, setLoad] = React.useState<{ loading: boolean; err?: string; initial?: EditorInitial; schoolName?: string }>({ loading: true });

  React.useEffect(() => {
    if (userLoading) return;
    if (userError) { setLoad({ loading: false, err: "Authentification : " + userError.message }); return; }
    if (!schoolId) { setLoad({ loading: false, err: "Ton compte n'est rattaché à aucune école — édition impossible." }); return; }
    let cancelled = false;
    (async () => {
      try {
        const [sch, page] = await Promise.all([
          client.from("schools").select("name").eq("id", schoolId).maybeSingle(),
          loadSchoolPage(client, schoolId),
        ]);
        if (cancelled) return;
        if (sch.error) throw sch.error;
        const name = (sch.data?.name as string) || "Mon collège";
        setLoad({ loading: false, schoolName: name, initial: dbToEditor(name, page.content, page.cards, page.programs, page.news) });
      } catch (e) {
        if (!cancelled) setLoad({ loading: false, err: e instanceof Error ? e.message : "Erreur de chargement" });
      }
    })();
    return () => { cancelled = true; };
  }, [userLoading, userError, schoolId, client]);

  // dataRef : dernier slice reporté par clé. baselineRef : sérialisé au chargement
  // (1er report) + après chaque save → diff = dirty.
  const dataRef = React.useRef<Record<string, unknown>>({});
  const baselineRef = React.useRef<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Couleurs live pour le thème des previews (#3). Sync depuis l'init au load ;
  // IdentityWall les met à jour à chaque changement de swatch.
  const [previewColors, setPreviewColors] = React.useState({ c1: "#A6192E", c2: "#5A0E1B", c3: "#E8C7CD" });
  React.useEffect(() => {
    if (load.initial) setPreviewColors({ c1: load.initial.c1, c2: load.initial.c2, c3: load.initial.c3 });
  }, [load.initial]);

  // Visibilité par section. Baseline posée directement au load (dataRef+baselineRef)
  // pour que le chargement ne marque PAS dirty ; toggleSection reporte le patch.
  const [hiddenSections, setHiddenSections] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (!load.initial) return;
    setHiddenSections(load.initial.hiddenSections);
    dataRef.current["content.visibility"] = { hidden_sections: load.initial.hiddenSections };
    baselineRef.current["content.visibility"] = JSON.stringify({ hidden_sections: load.initial.hiddenSections });
  }, [load.initial]);
  const toggleSection = React.useCallback((key: string) => {
    setHiddenSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);
  React.useEffect(() => {
    if (!load.initial) return; // baseline déjà posée au load ; on ne reporte qu'après
    report("content.visibility", { hidden_sections: hiddenSections });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenSections]);

  const report = React.useCallback((key: string, value: unknown) => {
    dataRef.current[key] = value;
    const ser = JSON.stringify(value);
    if (baselineRef.current[key] === undefined) { baselineRef.current[key] = ser; return; }
    setDirtyKeys((prev) => {
      const isDirty = ser !== baselineRef.current[key];
      const has = prev.includes(key);
      if (isDirty && !has) return [...prev, key];
      if (!isDirty && has) return prev.filter((k) => k !== key);
      return prev;
    });
  }, []);

  const saveAll = React.useCallback(async () => {
    if (!schoolId || !user) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(dataRef.current)) {
        if (k.startsWith("content.")) Object.assign(patch, dataRef.current[k] as Record<string, unknown>);
      }
      if (Object.keys(patch).length) await savePageContent(client, schoolId, patch, user.authUser.id);
      if (dataRef.current["cards"]) await saveCards(client, schoolId, dataRef.current["cards"] as EditorCard[]);
      if (dataRef.current["programs"]) await savePrograms(client, schoolId, dataRef.current["programs"] as EditorProgram[]);
      if (dataRef.current["news"]) await saveNews(client, schoolId, dataRef.current["news"] as EditorNews[]);
      for (const k of Object.keys(dataRef.current)) baselineRef.current[k] = JSON.stringify(dataRef.current[k]);
      setDirtyKeys([]);
    } catch (e) {
      throw friendlyDbError(e);
    } finally { setSaving(false); }
  }, [client, schoolId, user]);

  const assetUrl = React.useCallback(
    (path: string | null | undefined, bucket: Bucket) =>
      path ? client.storage.from(bucket).getPublicUrl(path).data.publicUrl : null,
    [client],
  );

  const uploadAsset = React.useCallback(async (bucket: Bucket, file: File): Promise<string> => {
    if (!schoolId) throw new Error("Aucune école");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const base = bucket === "school-logos" ? "logo" : "card-" + Math.random().toString(36).slice(2, 9);
    const path = `${schoolId}/${base}.${ext}`;
    const { error } = await client.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw friendlyDbError(error);
    return path;
  }, [client, schoolId]);

  if (load.loading) {
    return <div className="pe-load">Chargement de ta page…</div>;
  }
  if (load.err || !load.initial || !schoolId || !user) {
    return <div className="pe-load pe-err">{load.err || "Chargement impossible."}</div>;
  }

  const value: EditorCtx = {
    schoolId, userId: user.authUser.id, schoolName: load.schoolName || "Mon collège",
    initial: load.initial, client, assetUrl, uploadAsset, report, saveAll,
    dirty: dirtyKeys.length > 0, saving,
    previewColors, setPreviewColors,
    hiddenSections, toggleSection,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
