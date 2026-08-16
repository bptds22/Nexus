"use client";

// components/team-editor/teamEditorContext.tsx
//
// Provider « Page équipe » CÉGEP — jumeau de page-editor/editorContext. Charge
// UNE équipe (?team=<uuid>) : son identité HÉRITÉE de l'école (S1, verrouillée),
// son contenu éditable (team_page_content / pennants / camps / besoins), et les
// données AUTO qui alimentent les aperçus (calendrier RSEQ, engagements).
// Écriture via le client AUTHENTIFIÉ : la RLS can_edit_team_page arbitre.
//
// Besoins : les défauts viennent du CODE (SPORT_CONFIGS) et sont fusionnés avec
// les lignes DB. Rien n'est écrit tant que le collège n'enregistre pas — c'est
// ce qui évite tout seed des 7 943 équipes.

import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import {
  loadTeamPage, saveTeamContent, savePennants, saveCamps, saveNeeds,
  type TeamContentState, type EditorPennant, type EditorCamp, type EditorNeed,
} from "@/lib/queries/teamPage/teamPageData";
import {
  sportKeyFromNom, defaultNeeds, mergeNeeds, type SportKey, type PositionRow,
} from "@/lib/queries/teamPage/sportSlots";
import type { GameRow, CommitRow } from "@/lib/queries/teamPage/dbToTeamPage";

/** Ce que la base sait du calendrier d'une équipe, indépendamment de la saison
 *  inscrite sur l'équipe. `total` compte les matchs RSEQ rattachés à l'équipe
 *  quelle que soit leur saison : à 0, c'est que le pont RSEQ n'a pas été fait —
 *  ce n'est pas la même chose qu'une saison qui n'a pas commencé. */
export interface CalendrierEtat {
  total: number;
  joues: number;
  /** Date du prochain match non joué (ISO), toutes saisons. */
  prochaine: string | null;
  /** Saison réelle de ces matchs — peut différer de `teams.season`. */
  saison: string | null;
}

function resumeCalendrier(
  rows: { game_date: string | null; is_played: boolean | null; season: string | null }[],
): CalendrierEtat {
  const joues = rows.filter((r) => r.is_played === true).length;
  const aVenir = rows
    .filter((r) => r.is_played !== true && r.game_date)
    .map((r) => r.game_date as string)
    .sort();
  return {
    total: rows.length,
    joues,
    prochaine: aVenir[0] ?? null,
    // Saison des matchs eux-mêmes : si l'équipe est restée sur l'an dernier,
    // c'est cette valeur-là qu'il faut annoncer, pas `teams.season`.
    saison: rows.find((r) => r.season)?.season ?? null,
  };
}

export interface TeamIdentity {
  teamId: string;
  schoolId: string;
  teamName: string;
  division: string;
  genre: string;
  sportNom: string;
  sportKey: SportKey | null;
  season: string;
  seasonYear: number;
  schoolName: string;
  nickname: string;
  initiales: string;
  logoUrl: string | null;
  colorPrimary: string;
  colorDark: string;
  colorLight: string;
  wallWords: string[];
  headCoachName: string;
  staff: { nom: string; role: string }[];
}

/** Un compte COACH rattaché au collège — la liste du sélecteur S4. */
export interface SchoolCoach { id: string; nom: string }

export const DEFAULT_CONTENT: TeamContentState = {
  hero_image_path: null, hero_focal_x: 50, hero_focal_y: 25, hero_zoom: 100,
  record_saison: "", playoff_result: "",
  use_school_socials: true, socials: [],
  presentation_text: "", championships: null, staff_since: null,
  headcoach_photo_path: null, headcoach_focal_x: 50, headcoach_focal_y: 50, headcoach_zoom: 100,
  headcoach_bio: "",
  headcoach_user_id: null, headcoach_name: "",
  hidden_sections: [],
};

/** Traduit une erreur RLS/permission, de plafond, ou de remplacement interrompu.
 *  L'implémentation est partagée avec l'éditeur de page école — voir
 *  lib/queries/shared/dbErrors.ts. Réexporté ici pour ne casser aucun import. */
import { friendlyDbError } from "@/lib/queries/shared/dbErrors";
export { friendlyDbError };

interface TeamEditorCtx {
  identity: TeamIdentity;
  userId: string;
  client: SupabaseClient;
  /** contenu de départ (DB ou défauts) */
  initial: TeamContentState;
  initialPennants: EditorPennant[];
  initialCamps: EditorCamp[];
  /** besoins = défauts du sport + lignes DB par-dessus (ordre du layout) */
  initialNeeds: EditorNeed[];
  positions: PositionRow[];
  /** Comptes COACH du collège — source du sélecteur « Entraîneur-chef ». */
  schoolCoaches: SchoolCoach[];
  /** AUTO — aperçus */
  games: GameRow[];
  /** État du calendrier RSEQ pour CETTE équipe, toutes saisons confondues.
   *  Sert à distinguer trois situations que l'éditeur confondait en un seul
   *  message alarmant : équipe non pontée · saison à venir · saison en cours. */
  calendrier: CalendrierEtat;
  commits: CommitRow[];
  recordHint: string | null;
  /** état éditeur */
  report: (key: string, value: unknown) => void;
  saveAll: () => Promise<void>;
  dirty: boolean;
  saving: boolean;
  hiddenSections: string[];
  toggleSection: (key: string) => void;
  assetUrl: (path: string | null | undefined) => string | null;
  /** `previousPath` : objet remplacé, supprimé après un upload réussi. */
  uploadAsset: (kind: "hero" | "coach", file: File, previousPath?: string | null) => Promise<string>;
}

const Ctx = React.createContext<TeamEditorCtx | null>(null);
export function useTeamEditor(): TeamEditorCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useTeamEditor doit être utilisé dans <TeamPageEditorProvider>");
  return v;
}

interface LoadState {
  loading: boolean;
  err?: string;
  identity?: TeamIdentity;
  content?: TeamContentState;
  pennants?: EditorPennant[];
  camps?: EditorCamp[];
  needs?: EditorNeed[];
  positions?: PositionRow[];
  schoolCoaches?: SchoolCoach[];
  games?: GameRow[];
  calendrier?: CalendrierEtat;
  commits?: CommitRow[];
  recordHint?: string | null;
}

export function TeamPageEditorProvider({ teamId, children }: { teamId: string; children: React.ReactNode }) {
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  // Jetons de contenu des collections sous verrou optimiste. Posés au
  // chargement, remplacés après chaque save réussi. Dans un ref et JAMAIS dans
  // l'état de formulaire : une frappe ne doit pas pouvoir les modifier.
  const jetonsRef = React.useRef<{ pennants: string; events: string }>({ pennants: "", events: "" });

  const clientRef = React.useRef<SupabaseClient | null>(null);
  if (!clientRef.current) clientRef.current = createClient();
  const client = clientRef.current;

  const [load, setLoad] = React.useState<LoadState>({ loading: true });

  React.useEffect(() => {
    if (userLoading) return;
    if (userError) { setLoad({ loading: false, err: "Authentification : " + userError.message }); return; }
    if (!user) { setLoad({ loading: false, err: "Connecte-toi pour éditer cette page." }); return; }
    if (!teamId) { setLoad({ loading: false, err: "Aucune équipe en paramètre (?team=<id>)." }); return; }
    let cancelled = false;

    (async () => {
      try {
        const t = await client.from("teams")
          .select("id, name, division, gender, season, school_id, sport_id")
          .eq("id", teamId).maybeSingle();
        if (t.error) throw t.error;
        const team = t.data as {
          id: string; name: string; division: string | null; gender: string | null;
          season: string | null; school_id: string; sport_id: string;
        } | null;
        if (!team) { if (!cancelled) setLoad({ loading: false, err: "Équipe introuvable." }); return; }

        /* Elle s'ecrivait `if (mySchool && …)`, donc elle etait SAUTEE des que le
           compte n'avait pas de school_id : le compte plateforme passait, mais
           par accident — et n'importe quel compte sans ecole passait avec lui.
           Explicite dans les deux sens maintenant : l'admin passe parce qu'il
           EST admin, et l'absence d'ecole ne dispense plus de rien. (L'ecriture
           restait de toute facon arretee par la RLS — c'est l'interface qui
           mentait, pas la base.) */
        const isAdmin = user.profile.is_platform_admin === true;
        const mySchool = user.profile.school_id;
        if (!isAdmin && (!mySchool || team.school_id !== mySchool)) {
          if (!cancelled) setLoad({ loading: false, err: "Cette équipe n'appartient pas à ton collège." });
          return;
        }

        const [page, sport, school, schoolPage, positions, games, coaches, commits, hint, coachAccounts, tousMatchs] = await Promise.all([
          loadTeamPage(client, team.id),
          client.from("sports").select("nom").eq("id", team.sport_id).maybeSingle(),
          // logo_url = repli d'affichage derrière logo_path : l'aperçu de
          // l'éditeur doit montrer ce que le public verra, repli compris.
          client.from("schools").select("name, logo_url").eq("id", team.school_id).maybeSingle(),
          client.from("school_page_content")
            .select("nickname, initiales, logo_path, color_primary, color_dark, color_light, wall_words")
            .eq("school_id", team.school_id).maybeSingle(),
          client.from("positions").select("id, nom, abreviation").eq("sport_id", team.sport_id).order("nom"),
          client.from("games")
            .select("game_date, game_time, venue, home_team_id, visitor_team_id, home_name_raw, visitor_name_raw, home_score, visitor_score, is_played")
            .or(`home_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
            .eq("season", team.season ?? "").order("game_date").limit(30),
          client.from("team_coaches").select("role, users:coach_id(first_name, last_name)").eq("team_id", team.id),
          client.rpc("list_team_commits", { p_team_id: team.id } as unknown as undefined),
          client.rpc("team_record_hint", { p_team_id: team.id } as unknown as undefined),
          // Comptes COACH du collège — la policy « authenticated read coaches »
          // autorise déjà cette lecture ; on la scope à l'école de l'équipe.
          client.from("users").select("id, first_name, last_name")
            .eq("role", "COACH").eq("school_id", team.school_id)
            .order("last_name"),
          // Calendrier RSEQ SANS filtre de saison : c'est le seul moyen de
          // distinguer « équipe jamais pontée » (aucun match, quelle que soit
          // la saison) de « saison pas encore commencée » (des matchs existent,
          // aucun n'est joué). La requête scopée ci-dessus confond les deux.
          client.from("games")
            .select("game_date, is_played, season")
            .or(`home_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
            .order("game_date"),
        ]);
        if (cancelled) return;

        const sp = (schoolPage.data ?? null) as Record<string, unknown> | null;
        const schoolName = (school.data as { name: string } | null)?.name ?? "Mon collège";
        const sportNom = (sport.data as { nom: string } | null)?.nom ?? "";
        const sportKey = sportKeyFromNom(sportNom);
        const posRows = (positions.data ?? []) as PositionRow[];

        // Le client typé rend l'embed `users:coach_id(...)` en tableau ; à
        // l'exécution c'est bien un objet (relation 1:1) → cast via unknown.
        const coachRows = (coaches.data ?? []) as unknown as { role: string | null; users: { first_name: string | null; last_name: string | null } | null }[];
        const nameOf = (u: { first_name: string | null; last_name: string | null } | null) =>
          [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
        const headRow = coachRows.find((c) => /chef|head|principal/i.test(c.role ?? "")) ?? coachRows[0];

        const identity: TeamIdentity = {
          teamId: team.id, schoolId: team.school_id,
          teamName: team.name, division: team.division ?? "", genre: team.gender ?? "",
          sportNom, sportKey,
          season: team.season ?? "",
          seasonYear: parseInt(/(\d{4})/.exec(team.season ?? "")?.[1] ?? String(new Date().getFullYear()), 10),
          schoolName,
          nickname: (sp?.nickname as string) || schoolName,
          initiales: (sp?.initiales as string) || schoolName.slice(0, 1).toUpperCase(),
          // logo_path (déposé) d'abord, logo_url (import RSEQ) en repli.
          logoUrl: sp?.logo_path
            ? client.storage.from("school-logos").getPublicUrl(sp.logo_path as string).data.publicUrl
            : ((school.data as { logo_url?: string | null } | null)?.logo_url?.trim() || null),
          colorPrimary: (sp?.color_primary as string) || "#A6192E",
          colorDark: (sp?.color_dark as string) || "#5A0E1B",
          colorLight: (sp?.color_light as string) || "#E8C7CD",
          wallWords: Array.isArray(sp?.wall_words) ? (sp!.wall_words as string[]).filter(Boolean) : [],
          headCoachName: nameOf(headRow?.users ?? null),
          staff: coachRows.filter((c) => c !== headRow && nameOf(c.users))
            .map((c) => ({ nom: nameOf(c.users), role: c.role ?? "Entraîneur" })),
        };

        const needs = sportKey ? mergeNeeds(defaultNeeds(sportKey, posRows), page.needs) : [];

        jetonsRef.current = { pennants: page.jetons.pennants, events: page.jetons.events };
        setLoad({
          loading: false, identity,
          content: page.content ?? DEFAULT_CONTENT,
          pennants: page.pennants, camps: page.camps, needs, positions: posRows,
          schoolCoaches: ((coachAccounts.data ?? []) as { id: string; first_name: string | null; last_name: string | null }[])
            .map((c) => ({ id: c.id, nom: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() }))
            .filter((c) => c.nom),
          games: (games.data ?? []) as GameRow[],
          calendrier: resumeCalendrier(
            (tousMatchs.data ?? []) as { game_date: string | null; is_played: boolean | null; season: string | null }[],
          ),
          commits: (commits.data ?? []) as CommitRow[],
          recordHint: (hint.data as string | null) ?? null,
        });
      } catch (e) {
        if (!cancelled) setLoad({ loading: false, err: e instanceof Error ? e.message : "Erreur de chargement" });
      }
    })();
    return () => { cancelled = true; };
  }, [userLoading, userError, user, teamId, client]);

  // Même mécanique que « Ma page » : chaque section pousse son slice, le diff vs
  // baseline fait le badge dirty — zéro handler par champ.
  const dataRef = React.useRef<Record<string, unknown>>({});
  const baselineRef = React.useRef<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

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

  const [hiddenSections, setHiddenSections] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (!load.content) return;
    setHiddenSections(load.content.hidden_sections);
    dataRef.current["content.visibility"] = { hidden_sections: load.content.hidden_sections };
    baselineRef.current["content.visibility"] = JSON.stringify({ hidden_sections: load.content.hidden_sections });
  }, [load.content]);
  const toggleSection = React.useCallback((key: string) => {
    setHiddenSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);
  React.useEffect(() => {
    if (!load.content) return;
    report("content.visibility", { hidden_sections: hiddenSections });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenSections]);

  const teamId2 = load.identity?.teamId;
  const saveAll = React.useCallback(async () => {
    if (!teamId2 || !user) return;
    setSaving(true);
    // Nomme la section en cours — saveAll est SÉQUENTIEL, la première qui lève
    // abandonne les suivantes. Même dispositif que l'éditeur de page école.
    let etape = "";
    try {
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(dataRef.current)) {
        if (k.startsWith("content.")) Object.assign(patch, dataRef.current[k] as Record<string, unknown>);
      }
      etape = "tes textes et ton hero";
      if (Object.keys(patch).length) await saveTeamContent(client, teamId2, patch, user.authUser.id);
      etape = "tes fanions";
      if (dataRef.current["pennants"]) {
        const base = baselineRef.current["pennants"];
        const videDelibere = base !== undefined && base !== "[]";
        const res = await savePennants(client, teamId2, dataRef.current["pennants"] as EditorPennant[],
                                       jetonsRef.current.pennants, videDelibere);
        jetonsRef.current.pennants = res.jeton;
      }
      etape = "tes événements";
      if (dataRef.current["camps"]) {
        const base = baselineRef.current["camps"];
        const videDelibere = base !== undefined && base !== "[]";
        const res = await saveCamps(client, teamId2, dataRef.current["camps"] as EditorCamp[],
                                    jetonsRef.current.events, videDelibere);
        jetonsRef.current.events = res.jeton;
      }
      etape = "tes besoins de position";
      if (dataRef.current["needs"]) await saveNeeds(client, teamId2, dataRef.current["needs"] as EditorNeed[], user.authUser.id);
      for (const k of Object.keys(dataRef.current)) baselineRef.current[k] = JSON.stringify(dataRef.current[k]);
      setDirtyKeys([]);
    } catch (e) {
      const err = friendlyDbError(e);
      if (!etape) throw err;
      throw new Error(`${err.message}\n\nL'enregistrement s'est arrêté sur : ${etape}. Les sections suivantes n'ont pas été enregistrées.`);
    } finally { setSaving(false); }
  }, [client, teamId2, user]);

  const assetUrl = React.useCallback(
    (path: string | null | undefined) =>
      path ? client.storage.from("campus-photos").getPublicUrl(path).data.publicUrl : null,
    [client],
  );

  // Convention imposée par les policies « ma_page assets » : le 1er segment DOIT
  // être le school_id (c'est lui que can_edit_school_page vérifie). D'où
  // {school_id}/teams/{team_id}/… — aucun bucket ni policy en plus.
  const schoolId = load.identity?.schoolId;
  /* Chemin VERSIONNÉ — même maladie et même correctif que le logo d'école,
     voir editorContext.uploadAsset. Le nom fixe `hero.{ext}` écrasait en
     place : URL inchangée, CDN qui sert l'ancienne image. Les données le
     confirmaient — un `hero.jpg` réécrasé ET un `hero.png` pour la même
     équipe.

     Le 1er segment DOIT rester le school_id : c'est lui que
     can_edit_school_page vérifie dans les policies « ma_page assets ». La
     version s'ajoute au nom de fichier, jamais au préfixe. */
  const uploadAsset = React.useCallback(async (
    kind: "hero" | "coach",
    file: File,
    previousPath?: string | null,
  ): Promise<string> => {
    if (!schoolId || !teamId2) throw new Error("Équipe non chargée");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${schoolId}/teams/${teamId2}/${kind}_${Date.now()}.${ext}`;
    const { error } = await client.storage.from("campus-photos").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw friendlyDbError(error);

    // Non bloquant : l'upload a réussi, un orphelin ne doit pas casser le flow.
    if (previousPath && previousPath !== path) {
      const { error: delErr } = await client.storage.from("campus-photos").remove([previousPath]);
      if (delErr) console.warn(`[teamEditor uploadAsset] ancien objet non supprimé (${previousPath})`, delErr);
    }
    return path;
  }, [client, schoolId, teamId2]);

  if (load.loading) return <div className="te-load">Chargement de la page équipe…</div>;
  if (load.err || !load.identity || !load.content || !user) {
    return <div className="te-load te-err">{load.err || "Chargement impossible."}</div>;
  }

  const value: TeamEditorCtx = {
    identity: load.identity, userId: user.authUser.id, client,
    initial: load.content,
    initialPennants: load.pennants ?? [],
    initialCamps: load.camps ?? [],
    initialNeeds: load.needs ?? [],
    positions: load.positions ?? [],
    schoolCoaches: load.schoolCoaches ?? [],
    games: load.games ?? [],
    calendrier: load.calendrier ?? { total: 0, joues: 0, prochaine: null, saison: null },
    commits: load.commits ?? [],
    recordHint: load.recordHint ?? null,
    report, saveAll, dirty: dirtyKeys.length > 0, saving,
    hiddenSections, toggleSection, assetUrl, uploadAsset,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
