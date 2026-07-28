import "server-only";

// lib/queries/teamPage/loadForRender.ts
//
// Charge (serveur, service-role) tout ce qu'il faut pour rendre <TeamPage> à
// partir d'un team_id. Équipe inexistante OU jamais configurée → renvoie
// {configured:false} et l'appelant retombe sur la fixture. LA PAGE NE CASSE
// JAMAIS. Jumeau de schoolPage/loadForRender.

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { loadTeamPage } from "./teamPageData";
import { sportKeyFromNom, defaultNeeds, mergeNeeds, toTeamNeeds, type PositionRow } from "./sportSlots";
import {
  buildTeamData, resolveHeadCoachName,
  type GameRow, type CommitRow, type TeamRow, type SchoolIdentity,
} from "./dbToTeamPage";
import type { TeamData, Pennant, ConnectedAthlete } from "@/components/team-page/content";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pluriel français « suffisant » pour un libellé de poste : les noms de
 *  positions sont des groupes nominaux simples (« Quart-arrière », « Receveur
 *  éloigné »). Terminaison en s/x/z → invariable. */
function pluriel(nom: string): string {
  return /[sxz]$/i.test(nom) ? nom.toLowerCase() : nom.toLowerCase() + "s";
}

/** L'ATHLÈTE CONNECTÉ, s'il y en a un — c'est lui qui déclenche le « match
 *  parfait ». Session lue via les cookies (client serveur), profil athlète lu en
 *  service-role. Aucun visiteur connecté / pas un athlète → null, et la box
 *  disparaît (comportement du widget). Ne jette jamais : une page publique ne
 *  casse pas parce que la session est absente. */
async function loadViewer(
  svc: ReturnType<typeof createServiceClient>,
): Promise<ConnectedAthlete | null> {
  try {
    const sb = await createClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await svc
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
      pos2: null, // athletes n'a plus de position secondaire (migration remove_sport_secondaire)
      posLabel: row.positions.nom,
      posLabelPlural: pluriel(row.positions.nom),
    };
  } catch {
    return null;
  }
}

export type TeamRenderResult =
  | { configured: true; team: TeamData; teamName: string }
  | { configured: false; teamName: string | null };

export async function loadTeamPageForRender(teamId: string): Promise<TeamRenderResult> {
  if (!UUID.test(teamId)) return { configured: false, teamName: null };
  const svc = createServiceClient();

  const { data: teamRow } = await svc
    .from("teams")
    .select("id, name, division, gender, season, school_id, sport_id")
    .eq("id", teamId)
    .maybeSingle();
  const team = teamRow as TeamRow | null;
  if (!team) return { configured: false, teamName: null };

  const page = await loadTeamPage(svc, team.id);
  if (!page.content) return { configured: false, teamName: team.name };

  const [sport, school, schoolPage, positions, games, roster, coaches, commits, viewer] = await Promise.all([
    svc.from("sports").select("nom").eq("id", team.sport_id).maybeSingle(),
    svc.from("schools").select("name").eq("id", team.school_id).maybeSingle(),
    svc.from("school_page_content")
      .select("nickname, initiales, logo_path, color_primary, color_dark, color_light, wall_words")
      .eq("school_id", team.school_id).maybeSingle(),
    svc.from("positions").select("id, nom, abreviation").eq("sport_id", team.sport_id),
    svc.from("games")
      .select("game_date, game_time, venue, home_team_id, visitor_team_id, home_name_raw, visitor_name_raw, home_score, visitor_score, is_played")
      .or(`home_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
      .eq("season", team.season ?? "")
      .order("game_date"),
    svc.from("team_athletes")
      .select("athletes!inner(annee_diplomation, positions:position_id(abreviation))")
      .eq("team_id", team.id),
    svc.from("team_coaches").select("role, users:coach_id(first_name, last_name)").eq("team_id", team.id),
    svc.rpc("list_team_commits", { p_team_id: team.id } as unknown as undefined),
    loadViewer(svc),
  ]);

  // Les types Supabase générés ne couvrent pas toutes les tables du projet
  // (même dette que les routes Stripe) → on caste les lignes lues, comme
  // schoolPage/loadForRender le fait déjà.
  const sportNom = (sport.data as { nom: string } | null)?.nom ?? "";
  const sportKey = sportKeyFromNom(sportNom);
  const sp = (schoolPage.data ?? null) as Record<string, unknown> | null;
  const schoolName = (school.data as { name: string } | null)?.name ?? "Mon collège";

  const identity: SchoolIdentity = {
    name: schoolName,
    nickname: (sp?.nickname as string) || schoolName || "",
    initiales: (sp?.initiales as string) || "",
    logoUrl: sp?.logo_path
      ? svc.storage.from("school-logos").getPublicUrl(sp.logo_path as string).data.publicUrl
      : null,
    colorPrimary: (sp?.color_primary as string) || "#A6192E",
    colorDark: (sp?.color_dark as string) || "#5A0E1B",
    colorLight: (sp?.color_light as string) || "#E8C7CD",
    wallWords: Array.isArray(sp?.wall_words) ? (sp!.wall_words as string[]).filter(Boolean) : [],
  };

  const posRows = (positions.data ?? []) as PositionRow[];
  // Besoins : défauts du CODE + lignes enregistrées par-dessus. Tant que rien
  // n'est enregistré, `needs` reste vide → le moteur dérivé du roster gouverne.
  const needs = page.needs.length && sportKey
    ? toTeamNeeds(mergeNeeds(defaultNeeds(sportKey, posRows), page.needs), posRows)
    : [];

  const rosterRows = (roster.data ?? []).map((r) => {
    const a = (r as { athletes: { annee_diplomation: number | null; positions: { abreviation: string | null } | null } }).athletes;
    return {
      pos: (a?.positions?.abreviation ?? "").toUpperCase(),
      annee_fin: a?.annee_diplomation ?? null,
    };
  });

  const coachRows = (coaches.data ?? []) as { role: string | null; users: { first_name: string | null; last_name: string | null } | null }[];
  const nameOf = (u: { first_name: string | null; last_name: string | null } | null) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
  const headRow = coachRows.find((c) => /chef|head|principal/i.test(c.role ?? "")) ?? coachRows[0];

  // Compte DÉSIGNÉ dans l'éditeur : son nom est la source de vérité et prime
  // sur le staff. Lu en service-role (une seule ligne, pas de PII exposée).
  let designatedName: string | null = null;
  if (page.content.headcoach_user_id) {
    const { data: du } = await svc
      .from("users").select("first_name, last_name")
      .eq("id", page.content.headcoach_user_id).maybeSingle();
    designatedName = nameOf((du ?? null) as { first_name: string | null; last_name: string | null } | null) || null;
  }
  const headCoachName = resolveHeadCoachName({
    designatedName,
    manualName: page.content.headcoach_name,
    staffName: nameOf(headRow?.users ?? null),
  });

  const staff = coachRows
    .filter((c) => c !== headRow && nameOf(c.users))
    .map((c) => ({ nom: nameOf(c.users), role: c.role ?? "Entraîneur" }));

  const asset = (path: string | null) =>
    path ? svc.storage.from("campus-photos").getPublicUrl(path).data.publicUrl : null;

  const pennants: Pennant[] = page.pennants.map((p) => ({
    titre: p.titre, annee: p.annee ?? 0, type: p.type,
  }));

  return {
    configured: true,
    teamName: team.name,
    team: buildTeamData({
      team, sportNom, sportKey, school: identity,
      content: page.content,
      pennants,
      camps: page.camps,
      needs,
      games: (games.data ?? []) as GameRow[],
      roster: rosterRows,
      commitRows: (commits.data ?? []) as CommitRow[],
      headCoachName,
      staff,
      heroUrl: asset(page.content.hero_image_path),
      coachPhotoUrl: asset(page.content.headcoach_photo_path),
      viewer,
    }),
  };
}
