// lib/queries/schoolPage/saisonEnCours.ts
//
// « Saison en cours » — les résultats et classements RSEQ d'un cégep.
//
// SOURCE UNIQUE, comme loadTeamsForGrid : la page publique (service-role) et
// l'aperçu de l'éditeur (client authentifié, RLS) appellent la MÊME fonction.
// `rseq_standings` et `games` ouvrent tous deux le SELECT à `authenticated`,
// donc les deux chemins lisent la même chose.
//
// LE CLASSEMENT N'EST JAMAIS RECALCULÉ. `position` vient de RSEQ, bris
// d'égalité compris — on ne saurait pas les reproduire (TieBreakingRules,
// points d'éthique, forfaits). On copie, on affiche.
//
// ── LA RÈGLE DES ZÉRO MATCH, ET POURQUOI ELLE EXISTE ────────────────────────
// Au 2026-09-02, 241 des 312 équipes collégiales (77 %) n'ont joué AUCUN match
// — la saison démarre. Or RSEQ attribue quand même un `position` à une équipe
// qui n'a rien joué : le Cégep de Sainte-Foy est « 11e sur 12 » en volleyball
// F D2 avec 0 match. C'est un artefact de tirage, pas un classement.
//
// Afficher ce rang mettrait « 11e sur 12 » sur la page publique d'un cégep
// pour une équipe qui n'est jamais entrée sur un terrain. Donc :
//   games_played = 0  →  ni fiche ni rang, l'équipe n'a QUE sa section
//                        « À venir ». Elle reste visible, elle ne ment pas.
// La fiche et le rang apparaissent au premier match joué, tout seuls.
//
// ── LE -999 ────────────────────────────────────────────────────────────────
// La sentinelle RSEQ « pas de résultat » est déjà neutralisée à la collecte :
// `games.is_played = false` et les scores à NULL. Ici on ne lit JAMAIS une
// valeur de score pour décider si un match est joué — on lit `is_played`, et
// on écarte par surcroît tout match « joué » dont un score serait nul. Un
// -999 ne peut donc pas ressortir en 0.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Saison scolaire courante. L'année RSEQ bascule en juillet. */
export function saisonCourante(d = new Date()): string {
  const a = d.getFullYear();
  return d.getMonth() + 1 >= 7 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
}

export type MatchResume = {
  date: string | null;
  adversaire: string;
  domicile: boolean;
  /** Score de l'équipe du cégep, puis celui de l'adversaire. */
  pour: number | null;
  contre: number | null;
  /** 'V' | 'D' | 'N' — null pour un match à venir. */
  issue: "V" | "D" | "N" | null;
};

export type EquipeSaison = {
  teamId: string;
  sport: string;
  genre: string | null;
  division: string | null;
  /** null tant qu'aucun match n'est joué — voir la règle ci-dessus. */
  fiche: { v: number; d: number; n: number } | null;
  matchsJoues: number;
  /** null si aucun match joué, ou si RSEQ ne publie pas de position. */
  rang: { position: number; sur: number } | null;
  derniers: MatchResume[];
  aVenir: MatchResume[];
  /** Base du tri : nombre de matchs de la saison, joués ou non. */
  nbMatchs: number;
};

type LigneTeam = {
  id: string; division: string | null; gender: string | null;
  sports: { nom: string } | null;
};
type LigneStanding = {
  team_id: string; rseq_league_id: string; position: number | null;
  games_played: number | null; wins: number | null; losses: number | null; draws: number | null;
};
type LigneGame = {
  game_date: string | null; is_played: boolean | null;
  home_team_id: string | null; visitor_team_id: string | null;
  home_name_raw: string | null; visitor_name_raw: string | null;
  home_score: number | null; visitor_score: number | null;
};

const MAX_DERNIERS = 5;
const MAX_A_VENIR = 3;

/**
 * Les équipes d'un cégep pour la saison courante, avec fiche, rang et matchs.
 *
 * Rend [] quand l'école n'a aucune équipe pontée — l'appelant fait alors
 * disparaître le bloc. Une équipe SANS résultat mais AVEC des matchs à venir
 * est conservée : « pas de coquille vide » vise le cégep sans équipe, pas
 * l'équipe sans résultat.
 */
export async function loadSaisonEnCours(
  supabase: SupabaseClient, schoolId: string, saison = saisonCourante(),
): Promise<EquipeSaison[]> {
  const { data: tRows } = await supabase
    .from("teams")
    .select("id, division, gender, sports:sport_id(nom)")
    .eq("school_id", schoolId)
    .eq("season", saison);

  const teams = (tRows ?? []) as unknown as LigneTeam[];
  if (!teams.length) return [];
  const ids = teams.map((t) => t.id);

  const [{ data: sRows }, { data: gRows }] = await Promise.all([
    supabase
      .from("rseq_standings")
      .select("team_id, rseq_league_id, position, games_played, wins, losses, draws")
      .in("team_id", ids),
    supabase
      .from("games")
      .select("game_date, is_played, home_team_id, visitor_team_id, home_name_raw, visitor_name_raw, home_score, visitor_score")
      .or(`home_team_id.in.(${ids.join(",")}),visitor_team_id.in.(${ids.join(",")})`)
      .eq("season", saison)
      .order("game_date"),
  ]);

  const standings = (sRows ?? []) as unknown as LigneStanding[];
  const parStanding = new Map(standings.map((s) => [s.team_id, s]));

  /* Taille de chaque ligue = nombre de lignes de classement qu'elle porte.
     C'est le « sur N » du rang. Une seule requête pour toutes les ligues
     concernées, comptée ici plutôt que par une agrégation par équipe. */
  const ligues = [...new Set(standings.map((s) => s.rseq_league_id))];
  const tailleLigue = new Map<string, number>();
  if (ligues.length) {
    const { data: lRows } = await supabase
      .from("rseq_standings")
      .select("rseq_league_id")
      .in("rseq_league_id", ligues);
    for (const r of (lRows ?? []) as { rseq_league_id: string }[]) {
      tailleLigue.set(r.rseq_league_id, (tailleLigue.get(r.rseq_league_id) ?? 0) + 1);
    }
  }

  const games = (gRows ?? []) as unknown as LigneGame[];
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const sortie: EquipeSaison[] = [];

  for (const t of teams) {
    const siens = games.filter((g) => g.home_team_id === t.id || g.visitor_team_id === t.id);
    if (!siens.length) continue; // aucune trace de calendrier : rien à montrer

    const derniers: MatchResume[] = [];
    const aVenir: MatchResume[] = [];

    for (const g of siens) {
      const domicile = g.home_team_id === t.id;
      const adversaire = (domicile ? g.visitor_name_raw : g.home_name_raw) ?? "—";
      const pour = domicile ? g.home_score : g.visitor_score;
      const contre = domicile ? g.visitor_score : g.home_score;

      // `is_played` fait foi. La double garde sur les scores nuls empêche
      // qu'un match marqué joué mais sans résultat affiche « 0 – 0 ».
      if (g.is_played === true && pour !== null && contre !== null) {
        derniers.push({
          date: g.game_date, adversaire, domicile, pour, contre,
          issue: pour > contre ? "V" : pour < contre ? "D" : "N",
        });
      } else if (g.game_date && g.game_date >= aujourdhui) {
        aVenir.push({ date: g.game_date, adversaire, domicile, pour: null, contre: null, issue: null });
      }
    }

    // Les matchs arrivent triés par date croissante : les derniers résultats
    // se lisent à l'envers, les prochains dans l'ordre.
    derniers.reverse();

    const st = parStanding.get(t.id);
    const joues = st?.games_played ?? 0;
    const aJoue = joues > 0;

    sortie.push({
      teamId: t.id,
      sport: t.sports?.nom ?? "",
      genre: t.gender,
      division: t.division && t.division.trim() ? t.division : null,
      fiche: aJoue && st
        ? { v: st.wins ?? 0, d: st.losses ?? 0, n: st.draws ?? 0 }
        : null,
      matchsJoues: joues,
      rang: aJoue && st && st.position != null && tailleLigue.get(st.rseq_league_id)
        ? { position: st.position, sur: tailleLigue.get(st.rseq_league_id)! }
        : null,
      derniers: derniers.slice(0, MAX_DERNIERS),
      aVenir: aVenir.slice(0, MAX_A_VENIR),
      nbMatchs: siens.length,
    });
  }

  /* Tri demandé : le plus de matchs d'abord (les programmes actifs en tête),
     puis le sport par ordre alphabétique pour que deux équipes à égalité ne
     changent pas de place d'un chargement à l'autre. */
  sortie.sort((a, b) =>
    b.nbMatchs - a.nbMatchs ||
    a.sport.localeCompare(b.sport, "fr") ||
    (a.division ?? "").localeCompare(b.division ?? "", "fr") ||
    (a.genre ?? "").localeCompare(b.genre ?? "", "fr"),
  );

  return sortie;
}
