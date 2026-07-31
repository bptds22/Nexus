"use client";

// components/team-page/TeamPageMobile.tsx
//
// Rendu NATIF (bundle Capacitor) de la page équipe /college/[schoolId]/[teamId].
// MÊME composant de rendu <TeamPage> que le web — seule la COUCHE DE CHARGEMENT
// change : createClient() côté client (clé anon) → RLS appliquée, comme les
// écrans *Mobile*. La version web (SSR service-role) reste dans
// app/college/[schoolId]/[teamId]/page.tsx et n'est pas touchée.

import * as React from "react";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import TeamPage from "@/components/team-page/TeamPage";
import { loadTeamPage } from "@/lib/queries/teamPage/teamPageData";
import { sportKeyFromNom, defaultNeeds, mergeNeeds, toTeamNeeds, type PositionRow } from "@/lib/queries/teamPage/sportSlots";
import {
  buildTeamData, resolveHeadCoachName,
  type GameRow, type CommitRow, type TeamRow, type SchoolIdentity,
} from "@/lib/queries/teamPage/dbToTeamPage";
import type { TeamData, Pennant, ConnectedAthlete } from "@/components/team-page/content";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap"
    />
  </>
);

/** Pluriel « suffisant » pour un libellé de poste (jumeau du loader serveur). */
function pluriel(nom: string): string {
  return /[sxz]$/i.test(nom) ? nom.toLowerCase() : nom.toLowerCase() + "s";
}

/** L'ATHLÈTE CONNECTÉ (client anon) — déclenche le « match parfait ». Lit sa
 *  PROPRE ligne athletes (RLS « athletes can read own profile »). Pas connecté /
 *  pas un athlète → null, la box disparaît. Ne jette jamais. */
async function loadViewerClient(supabase: SupabaseClient): Promise<ConnectedAthlete | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await supabase
      .from("athletes")
      .select("sports:sport_id(nom), positions:position_id(nom, abreviation)")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    const row = data as unknown as {
      sports: { nom: string } | null;
      positions: { nom: string; abreviation: string | null } | null;
    } | null;
    if (!row?.sports?.nom || !row.positions?.abreviation) return null;
    return {
      sport: row.sports.nom,
      pos: row.positions.abreviation.toUpperCase(),
      pos2: null,
      posLabel: row.positions.nom,
      posLabelPlural: pluriel(row.positions.nom),
    };
  } catch {
    return null;
  }
}

type TeamLoad =
  | { configured: true; team: TeamData }
  | { configured: false; degraded: TeamData }
  | { configured: false; degraded: null };

/** Jumeau CLIENT de loadTeamPageForRender : même logique, client anon au lieu
 *  du service-role. Réutilise loadTeamPage + les transforms tels quels. */
async function loadTeamDataClient(supabase: SupabaseClient, teamId: string): Promise<TeamLoad> {
  const { data: teamRow } = await supabase
    .from("teams").select("id, name, division, gender, season, school_id, sport_id")
    .eq("id", teamId).maybeSingle();
  const team = teamRow as TeamRow | null;
  if (!team) return { configured: false, degraded: null };

  const page = await loadTeamPage(supabase, team.id);

  const [sport, school, schoolPage, positions, games, roster, coaches, commits, viewer] = await Promise.all([
    supabase.from("sports").select("nom").eq("id", team.sport_id).maybeSingle(),
    supabase.from("schools").select("name").eq("id", team.school_id).maybeSingle(),
    supabase.from("school_page_content")
      .select("nickname, initiales, logo_path, color_primary, color_dark, color_light, wall_words")
      .eq("school_id", team.school_id).maybeSingle(),
    supabase.from("positions").select("id, nom, abreviation").eq("sport_id", team.sport_id),
    supabase.from("games")
      .select("game_date, game_time, venue, home_team_id, visitor_team_id, home_name_raw, visitor_name_raw, home_score, visitor_score, is_played")
      .or(`home_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
      .eq("season", team.season ?? "")
      .order("game_date"),
    // ═══════════════════════════════════════════════════════════════════════
    // RLS: team_coaches exclut CEGEP, team_athletes limité au membre.
    // Vide aujourd'hui (0 staff, 0 roster CÉGEP). Le jour où un collège en
    // saisit, ces sections seront vides SANS erreur pour l'athlète.
    // Correctif = policy de lecture (DDL), décision séparée.
    // ═══════════════════════════════════════════════════════════════════════
    supabase.from("team_athletes")
      .select("athletes!inner(annee_diplomation, positions:position_id(abreviation))")
      .eq("team_id", team.id),                                                   // ROSTER
    supabase.from("team_coaches").select("role, users:coach_id(first_name, last_name)").eq("team_id", team.id), // STAFF
    supabase.rpc("list_team_commits", { p_team_id: team.id } as unknown as undefined),
    loadViewerClient(supabase),
  ]);

  const sportNom = (sport.data as { nom: string } | null)?.nom ?? "";
  const sportKey = sportKeyFromNom(sportNom);
  const sp = (schoolPage.data ?? null) as Record<string, unknown> | null;
  const schoolName = (school.data as { name: string } | null)?.name ?? "Mon collège";

  const identity: SchoolIdentity = {
    name: schoolName,
    nickname: (sp?.nickname as string) || schoolName || "",
    initiales: (sp?.initiales as string) || "",
    logoUrl: sp?.logo_path
      ? supabase.storage.from("school-logos").getPublicUrl(sp.logo_path as string).data.publicUrl
      : null,
    colorPrimary: (sp?.color_primary as string) || "#A6192E",
    colorDark: (sp?.color_dark as string) || "#5A0E1B",
    colorLight: (sp?.color_light as string) || "#E8C7CD",
    wallWords: Array.isArray(sp?.wall_words) ? (sp!.wall_words as string[]).filter(Boolean) : [],
  };

  const posRows = (positions.data ?? []) as PositionRow[];
  const needs = page.needs.length && sportKey
    ? toTeamNeeds(mergeNeeds(defaultNeeds(sportKey, posRows), page.needs), posRows)
    : [];

  const rosterRows = (roster.data ?? []).map((r) => {
    const a = (r as unknown as { athletes: { annee_diplomation: number | null; positions: { abreviation: string | null } | null } }).athletes;
    return { pos: (a?.positions?.abreviation ?? "").toUpperCase(), annee_fin: a?.annee_diplomation ?? null };
  });

  const coachRows = (coaches.data ?? []) as unknown as { role: string | null; users: { first_name: string | null; last_name: string | null } | null }[];
  const nameOf = (u: { first_name: string | null; last_name: string | null } | null) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
  const headRow = coachRows.find((c) => /chef|head|principal/i.test(c.role ?? "")) ?? coachRows[0];

  let designatedName: string | null = null;
  if (page.content?.headcoach_user_id) {
    const { data: du } = await supabase
      .from("users").select("first_name, last_name")
      .eq("id", page.content.headcoach_user_id).maybeSingle();
    designatedName = nameOf((du ?? null) as { first_name: string | null; last_name: string | null } | null) || null;
  }
  const headCoachName = resolveHeadCoachName({
    designatedName,
    manualName: page.content?.headcoach_name ?? "",
    staffName: nameOf(headRow?.users ?? null),
  });

  const staff = coachRows
    .filter((c) => c !== headRow && nameOf(c.users))
    .map((c) => ({ nom: nameOf(c.users), role: c.role ?? "Entraîneur" }));

  const asset = (path: string | null) =>
    path ? supabase.storage.from("campus-photos").getPublicUrl(path).data.publicUrl : null;

  const pennants: Pennant[] = page.pennants.map((p) => ({ titre: p.titre, annee: p.annee ?? 0, type: p.type }));

  const built = buildTeamData({
    team, sportNom, sportKey, school: identity,
    content: page.content, pennants, camps: page.camps, needs,
    games: (games.data ?? []) as GameRow[],
    roster: rosterRows,
    commitRows: (commits.data ?? []) as CommitRow[],
    headCoachName, staff,
    heroUrl: asset(page.content?.hero_image_path ?? null),
    coachPhotoUrl: asset(page.content?.headcoach_photo_path ?? null),
    viewer,
  });

  if (!page.content) return { configured: false, degraded: built };
  return { configured: true, team: built };
}

type Loaded =
  | { state: "loading" }
  | { state: "error" }
  | { state: "notfound" }
  | { state: "ready"; team: TeamData };

function CenteredMobile({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ background: "#111317", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
      {children}
    </main>
  );
}

export default function TeamPageMobile() {
  // useDynamicParam : sur mobile, useParams vaut "placeholder" → relit le vrai
  // teamId depuis sessionStorage (stashé par app/page.tsx). Web : vrai id direct.
  const teamId = useDynamicParam("teamId");
  const isPlaceholder = !teamId || teamId === "placeholder";
  const [st, setSt] = React.useState<Loaded>({ state: "loading" });

  React.useEffect(() => {
    if (isPlaceholder) return;
    let cancelled = false;
    setSt({ state: "loading" });
    (async () => {
      try {
        if (!UUID.test(teamId!)) { if (!cancelled) setSt({ state: "notfound" }); return; }
        const res = await loadTeamDataClient(createClient(), teamId!);
        if (cancelled) return;
        if (res.configured) setSt({ state: "ready", team: res.team });
        else if (res.degraded) setSt({ state: "ready", team: res.degraded });
        else setSt({ state: "notfound" });
      } catch {
        if (!cancelled) setSt({ state: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [teamId, isPlaceholder]);

  // ÉTATS DE CHARGEMENT (nouveaux vs SSR) — jamais d'écran blanc ni de page à
  // moitié peuplée : squelette pendant le fetch, erreur lisible sinon.
  if (isPlaceholder || st.state === "loading") {
    return (
      <CenteredMobile>
        <div style={{ width: 30, height: 30, border: "3px solid #E63946", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </CenteredMobile>
    );
  }
  if (st.state === "notfound") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Équipe introuvable.</p></CenteredMobile>;
  }
  if (st.state === "error") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Impossible de charger la page. Vérifie ta connexion, puis réessaie.</p></CenteredMobile>;
  }
  return (
    <>
      {FONTS}
      <main style={{ background: "#111317", minHeight: "100vh" }}>
        <TeamPage team={st.team} />
      </main>
    </>
  );
}
