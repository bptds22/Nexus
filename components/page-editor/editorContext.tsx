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
  loadSchoolPage, savePageContent, saveCards, savePrograms, saveNews, villePreRemplie,
  type SchoolPageState, type EditorCard, type EditorProgram, type EditorNews,
} from "@/lib/queries/schoolPage/schoolPageData";

type Bucket = "school-logos" | "campus-photos";

/** L'école connectée, telle qu'elle vit dans `public.schools`. Les sections
 *  AUTO (fiche campus, « L'affiche ») s'en servent pour afficher les VRAIES
 *  données de l'établissement au lieu d'une fixture. Aucune de ces valeurs
 *  n'est éditable ni reportée : elles ne partent jamais en base. */
export interface EditorSchool {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  langue: string | null;
  reseau: string | null;
  address: string | null;
  postal_code: string | null;
}

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

/** Traduit une erreur RLS/permission, de plafond, ou de remplacement interrompu.
 *  L'implémentation est partagée avec l'éditeur d'équipe — voir
 *  lib/queries/shared/dbErrors.ts. Réexporté ici pour ne casser aucun import. */
import { friendlyDbError } from "@/lib/queries/shared/dbErrors";
export { friendlyDbError };

const g = (v: string | null | undefined): string => v ?? "";
const numStr = (v: number | null | undefined): string => (v == null ? "" : String(v));

function dbToEditor(
  school: EditorSchool,
  c: Partial<SchoolPageState> | null,
  cards: EditorCard[],
  programs: EditorProgram[],
  news: EditorNews[],
): EditorInitial {
  return {
    schoolName: school.name,
    nick: g(c?.nickname), slog: g(c?.slogan), tagline: g(c?.tagline),
    prov: c?.province || "Québec", tick: g(c?.ticker_text),
    // VILLE : pré-remplie depuis schools.city quand l'éditeur n'a rien de saisi
    // — même repli que le rendu public (dbToProgramPage : nn(c.ville, city)).
    // C'est un PRÉ-REMPLISSAGE de champ : rien ne part en base tant que
    // l'utilisateur n'enregistre pas.
    // QUARTIER et CODE RÉGIONAL restent vides : `schools` ne porte ni secteur
    // ni indicatif téléphonique. Une valeur sans source reste absente.
    ville: g(c?.ville) || villePreRemplie(school.city),
    quartier: g(c?.quartier), rtag: g(c?.code_regional),
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
  /** Fiche `schools` de l'école connectée — lecture seule, sections AUTO. */
  school: EditorSchool;
  /** Athlètes recrutés par ce collège (count_recruited_by_school : pipeline
   *  recruteur, stages ENGAGE et LETTRE_SIGNEE). MÊME source que la page
   *  publique — l'aperçu du parcours ne doit jamais afficher un autre nombre. */
  recrutedCount: number;
  initial: EditorInitial;
  client: SupabaseClient;
  assetUrl: (path: string | null | undefined, bucket: Bucket) => string | null;
  /** `previousPath` : objet remplacé, supprimé après un upload réussi.
   *  Omets-le pour un ajout (nouvelle carte), passe-le pour un remplacement. */
  uploadAsset: (bucket: Bucket, file: File, previousPath?: string | null) => Promise<string>;
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

export function SchoolPageEditorProvider(
  { children, schoolIdParam }: { children: React.ReactNode; schoolIdParam?: string },
) {
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();

  /* ── RESOLUTION DU COLLEGE ────────────────────────────────────────────────
     Elle lisait UNIQUEMENT `users.school_id`. Le compte plateforme n'en a pas
     (il n'appartient a aucun etablissement), donc l'editeur s'arretait sur
     « Ton compte n'est rattache a aucune ecole » alors que la base l'autorisait
     deja partout : can_edit_school_page teste `is_platform_admin` sans
     condition d'ecole. Le blocage etait entierement cote interface.

     `schoolIdParam` vient du portail admin (fiche CEGEP ouverte). Il n'est
     honore QUE pour un admin plateforme, et IGNORE pour tout le monde d'autre
     — pas refuse, pas signale : un non-admin retombe sur son propre college,
     exactement comme avant. La RLS refuserait l'ecriture de toute facon, mais
     afficher le contenu d'un autre etablissement dans un editeur ressemble a
     une faille meme quand ca n'en est pas une. */
  const schoolId = user?.profile.is_platform_admin === true
    ? (schoolIdParam || null)
    : (user?.profile.school_id ?? null);

  const clientRef = React.useRef<SupabaseClient | null>(null);
  if (!clientRef.current) clientRef.current = createClient();
  const client = clientRef.current;

  // Jetons de contenu des collections sous verrou optimiste. Posés au
  // chargement, remplacés après chaque save réussi. Ils vivent dans un ref et
  // JAMAIS dans l'état de formulaire : une frappe de l'utilisateur ne doit pas
  // pouvoir les modifier, sinon le verrou ne protège plus rien.
  const jetonsRef = React.useRef<{ cards: string; news: string }>({ cards: "", news: "" });

  const [load, setLoad] = React.useState<{ loading: boolean; err?: string; initial?: EditorInitial; school?: EditorSchool; recrutedCount?: number }>({ loading: true });

  React.useEffect(() => {
    if (userLoading) return;
    if (userError) { setLoad({ loading: false, err: "Authentification : " + userError.message }); return; }
    if (!schoolId) { setLoad({ loading: false, err: "Ton compte n'est rattaché à aucune école — édition impossible." }); return; }
    let cancelled = false;
    (async () => {
      try {
        const [sch, page, rec] = await Promise.all([
          client.from("schools")
            .select("id, name, city, region, langue, reseau, address, postal_code")
            .eq("id", schoolId).maybeSingle(),
          loadSchoolPage(client, schoolId),
          // MÊME RPC que loadSchoolPageForRender : l'aperçu du parcours affiche
          // le nombre réel de recrutés, pas un exemple.
          client.rpc("count_recruited_by_school", { p_school_id: schoolId } as unknown as undefined),
        ]);
        if (cancelled) return;
        if (sch.error) throw sch.error;
        const row = (sch.data ?? {}) as Partial<EditorSchool>;
        const school: EditorSchool = {
          id: schoolId,
          name: row.name || "Mon collège",
          city: row.city ?? null,
          region: row.region ?? null,
          langue: row.langue ?? null,
          reseau: row.reseau ?? null,
          address: row.address ?? null,
          postal_code: row.postal_code ?? null,
        };
        jetonsRef.current = { cards: page.jetons.cards, news: page.jetons.news };
        setLoad({
          loading: false, school,
          recrutedCount: (rec.data as number | null) ?? 0,
          initial: dbToEditor(school, page.content, page.cards, page.programs, page.news),
        });
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
    // Nomme la section en cours. saveAll est SÉQUENTIEL : la première qui lève
    // abandonne les suivantes, et sans ce repère l'utilisateur voit un message
    // d'erreur sans savoir laquelle des quatre reprendre. Reprendre APRÈS un
    // échec — avec la comptabilité baseline/dirty par section — est un chantier
    // à part : la remise à zéro de la baseline en fin de fonction suppose un
    // succès total, et la fausser marquerait « propre » du contenu non écrit.
    let etape = "";
    try {
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(dataRef.current)) {
        if (k.startsWith("content.")) Object.assign(patch, dataRef.current[k] as Record<string, unknown>);
      }
      etape = "tes textes et couleurs";
      if (Object.keys(patch).length) await savePageContent(client, schoolId, patch, user.authUser.id);
      etape = "tes cartes campus";
      if (dataRef.current["cards"]) {
        // Même lecture du « vide délibéré » que pour les programmes : une liste
        // vide venue d'un retrait réel de l'utilisateur, jamais d'un chargement
        // raté (auquel cas les sections ne montent pas et on n'arrive pas ici).
        const baseCards = baselineRef.current["cards"];
        const videDelibereCards = baseCards !== undefined && baseCards !== "[]";
        const res = await saveCards(
          client, schoolId, dataRef.current["cards"] as EditorCard[],
          jetonsRef.current.cards, videDelibereCards,
        );
        jetonsRef.current.cards = res.jeton;
      }
      etape = "tes programmes";
      if (dataRef.current["programs"]) {
        // Une liste vide n'a pas le même sens selon d'où elle vient. La baseline
        // est figée au 1er report, c'est-à-dire à l'état sorti de la base : si
        // elle n'était PAS vide et que la liste l'est devenue, c'est que
        // l'utilisateur a retiré ses programmes — un effacement délibéré.
        // Un chargement raté, lui, ne reporte rien du tout (load.initial reste
        // indéfini, les sections ne montent pas), donc on n'arrive même pas ici.
        const base = baselineRef.current["programs"];
        const videDelibere = base !== undefined && base !== "[]";
        await savePrograms(client, schoolId, dataRef.current["programs"] as EditorProgram[], videDelibere);
      }
      etape = "tes nouvelles";
      if (dataRef.current["news"]) {
        const baseNews = baselineRef.current["news"];
        const videDelibereNews = baseNews !== undefined && baseNews !== "[]";
        const resNews = await saveNews(
          client, schoolId, dataRef.current["news"] as EditorNews[],
          jetonsRef.current.news, videDelibereNews,
        );
        jetonsRef.current.news = resNews.jeton;
      }
      for (const k of Object.keys(dataRef.current)) baselineRef.current[k] = JSON.stringify(dataRef.current[k]);
      setDirtyKeys([]);
    } catch (e) {
      const err = friendlyDbError(e);
      if (!etape) throw err;
      throw new Error(`${err.message}\n\nL'enregistrement s'est arrêté sur : ${etape}. Les sections suivantes n'ont pas été enregistrées.`);
    } finally { setSaving(false); }
  }, [client, schoolId, user]);

  const assetUrl = React.useCallback(
    (path: string | null | undefined, bucket: Bucket) =>
      path ? client.storage.from(bucket).getPublicUrl(path).data.publicUrl : null,
    [client],
  );

  /* CHEMIN VERSIONNÉ — c'est le correctif du bug « le logo ne se remplace
     jamais ».

     Avant : `{school_id}/logo.{ext}`, nom FIXE + upsert. Ré-uploader un PNG
     écrasait l'objet en place, l'URL publique restait identique au caractère
     près, et le CDN (cacheControl 3600) plus le cache navigateur servaient
     l'ancienne image jusqu'à une heure. Rien n'échouait — d'où le diagnostic
     « erreur avalée » alors que tout réussissait.

     L'extension venait du fichier source, ce qui produisait en plus des
     doublons : un `logo.jfif` ET un `logo.webp` pour la même école, dont un
     seul référencé.

     Maintenant chaque upload porte un nom unique : l'URL change, donc le
     rendu change, sans dépendre d'aucune expiration de cache.

     `previousPath` permet de supprimer l'objet remplacé — sans quoi le nom
     versionné empilerait un orphelin à chaque essai. La suppression est
     DÉLIBÉRÉMENT non bloquante : l'upload a réussi, la page doit continuer.
     Un orphelin est un coût de stockage ; un throw ici serait une perte de
     travail. */
  const uploadAsset = React.useCallback(async (
    bucket: Bucket,
    file: File,
    previousPath?: string | null,
  ): Promise<string> => {
    if (!schoolId) throw new Error("Aucune école");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const base = bucket === "school-logos"
      ? `logo_${schoolId}_${Date.now()}`
      : `card_${schoolId}_${Date.now()}`;
    const path = `${schoolId}/${base}.${ext}`;
    const { error } = await client.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw friendlyDbError(error);

    if (previousPath && previousPath !== path) {
      const { error: delErr } = await client.storage.from(bucket).remove([previousPath]);
      if (delErr) console.warn(`[uploadAsset] ancien objet non supprimé (${bucket}/${previousPath})`, delErr);
    }
    return path;
  }, [client, schoolId]);

  if (load.loading) {
    return <div className="pe-load">Chargement de ta page…</div>;
  }
  if (load.err || !load.initial || !load.school || !schoolId || !user) {
    return <div className="pe-load pe-err">{load.err || "Chargement impossible."}</div>;
  }

  const value: EditorCtx = {
    schoolId, userId: user.authUser.id, schoolName: load.school.name,
    school: load.school,
    recrutedCount: load.recrutedCount ?? 0,
    initial: load.initial, client, assetUrl, uploadAsset, report, saveAll,
    dirty: dirtyKeys.length > 0, saving,
    previewColors, setPreviewColors,
    hiddenSections, toggleSection,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
