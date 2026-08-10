import "server-only";

// lib/queries/teamPage/loadForRender.ts
//
// Charge (serveur, service-role) tout ce qu'il faut pour rendre <TeamPage> à
// partir d'un team_id. Équipe inexistante OU jamais configurée → renvoie
// {configured:false} et l'appelant retombe sur la fixture. LA PAGE NE CASSE
// JAMAIS. Jumeau de schoolPage/loadForRender.

import { createServiceClient } from "@/lib/supabase/service";
import { loadTeamPage } from "./teamPageData";
import { sportKeyFromNom, defaultNeeds, mergeNeeds, toTeamNeeds, type PositionRow } from "./sportSlots";
import {
  buildTeamData, resolveHeadCoachName,
  type GameRow, type CommitRow, type TeamRow, type SchoolIdentity,
} from "./dbToTeamPage";
import type { TeamData, Pennant } from "@/components/team-page/content";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ⚠ LE VIEWER N'EST PLUS LU ICI — ET NE DOIT PAS Y REVENIR.
//
// Ce loader contenait une lecture de la session du visiteur, via
// createClient() → cookies(). La route publique /college/[schoolId]/[teamId]
// exporte un generateStaticParams (le bundle Capacitor en depend), donc Next
// la classe SSG : son rendu est STATIQUE, et un rendu statique ne peut pas
// lire de cookie. Toutes les equipes rendaient 500 en production web —
// « Page changed from static to dynamic at runtime, reason: cookies ».
//
// Aucune declaration de rendu ne sauvait les deux plateformes : Next exige un
// LITTERAL pour `export const dynamic` (le ternaire sur IS_CAPACITOR est
// refuse au build), et le seul litteral qui regle le web, 'force-dynamic',
// est refuse par output:'export'. Les deux formes ont ete eprouvees.
//
// La lecture vit maintenant dans lib/queries/teamPage/loadViewerClient.ts,
// cote client, partagee par le web (TeamPageWithViewer) et le mobile
// (TeamPageMobile). Ce loader reste 100 % service-role et sans lecture de
// session : c'est ce qui lui permet de rendre en statique.

export type TeamRenderResult =
  | { configured: true; team: TeamData; teamName: string }
  // Équipe réelle jamais configurée. `configured` reste FAUX — /team-test s'en
  // sert pour retomber sur son fixture, comportement inchangé. `degraded` est
  // additif : la route publique /college/[école]/[équipe] s'en sert pour rendre
  // CETTE équipe (son sport, sa division, son genre, son école) plutôt que
  // d'emprunter l'identité d'une autre.
  | { configured: false; teamName: string | null; degraded?: TeamData };

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

  // Pas de sortie anticipée quand la page n'est jamais configurée : on charge
  // quand même l'identité réelle (sport, école, calendrier, roster) pour bâtir
  // une page DÉGRADÉE. buildTeamData accepte `content: null` — chaque champ
  // éditorial y passe par `i.content?.x`, donc les sections vides s'effacent
  // d'elles-mêmes sans logique parallèle.
  const page = await loadTeamPage(svc, team.id);

  const [sport, school, schoolPage, positions, games, roster, coaches, commits] = await Promise.all([
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
  if (page.content?.headcoach_user_id) {
    const { data: du } = await svc
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
    path ? svc.storage.from("campus-photos").getPublicUrl(path).data.publicUrl : null;

  const pennants: Pennant[] = page.pennants.map((p) => ({
    titre: p.titre, annee: p.annee ?? 0, type: p.type,
  }));

  const built = buildTeamData({
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
    heroUrl: asset(page.content?.hero_image_path ?? null),
    coachPhotoUrl: asset(page.content?.headcoach_photo_path ?? null),
    // viewer : pose cote client par TeamPageWithViewer / TeamPageMobile.
    viewer: null,
  });

  // Jamais configurée → `configured` reste faux (contrat de /team-test), mais
  // l'équipe RÉELLE part avec la réponse pour la route publique.
  if (!page.content) return { configured: false, teamName: team.name, degraded: built };

  return { configured: true, teamName: team.name, team: built };
}
