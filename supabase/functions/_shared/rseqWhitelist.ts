// supabase/functions/_shared/rseqWhitelist.ts
// ============================================================================
// LA LIGNE ROUGE RSEQ, ET RIEN D'AUTRE.
//
// GetLeagueDiffusion renvoie 459 CLÉS RACINE (83 tableaux, 1 objet, 375
// scalaires — relevé sur Football C M D1 Provincial, 2026-09-02). On en garde
// QUATRE. Ce module est le seul endroit où le payload brut est touché : tout
// le reste de la veille travaille sur ce qui sort d'ici, et ne peut donc pas
// atteindre ce qui a été jeté.
//
// L'ordre de grandeur compte pour comprendre le choix : 60 de ces clés
// contiennent « Stats », 23 « Player », 17 « Athlete », 5 « Coach », 8
// « Coordinator » ou « Statistician ». Énumérer ce qu'on refuse était perdu
// d'avance ; énumérer ce qu'on garde tient en quatre lignes.
//
// WHITELIST POSITIVE, PAS BLACKLIST — et ce n'est pas un détail de style.
//   Une blacklist /Stats|Athlete/ paraît suffisante et ne l'est pas : le
//   payload porte, À LA RACINE, `LeagueCoordinator: "rcollard@rseq.ca"` et
//   `LeagueStatistician: "jptremblay@rseq.ca"` — des courriels nominatifs de
//   personnel RSEQ, qui ne contiennent ni « Stats » ni « Athlete » dans leur
//   nom de clé. Une blacklist les laisserait passer. Une whitelist ne les voit
//   même pas.
//
// CE QUI EST JETÉ, PAR CONSTRUCTION
//   • Les 60 clés *Stats (LeagueFootballQbStats, LeagueBasketballStats1, …).
//     Vides au 2026-09-02 sur les ligues sondées — mais le poste
//     `LeagueStatistician` existe, donc elles se rempliront. L'assertion n'est
//     pas théorique, elle est en avance.
//   • Les courriels de coordination ci-dessus.
//   • PlayerCount / CoachCount / AffiliatedPlayerCount : des AGRÉGATS, donc
//     pas des personnes — on ne les prend quand même pas. On n'a pas besoin
//     du nombre de joueurs d'une équipe pour afficher un classement, et la
//     ligne la plus facile à défendre est celle qu'on ne franchit pas.
//   • Les champs *DiffusionHtml : du markup <a> vers diffusion.rseq.ca.
//
// PÉRIMÈTRE DES MATCHS — ARBITRÉ LE 2026-09-02, NE PAS ÉLARGIR SANS DÉCISION.
//   Retenus : Teams, RegularSeasonGames, PostSeasonGames, Standings. C'est tout.
//   • PreSeasonGames    — EXCLU : hors-concours, valeur faible.
//   • ChampionshipGames (et ConferenceChampionship / ChampionshipD2 / AllStar)
//     — EXCLUS : ce sont des gabarits de tableau à UUID nul (« 3e position »,
//     « Gagnant SF01 »), du bruit de bracket. À revoir au lot C seulement si
//     l'affichage des séries devient un besoin.
//   Les élargir reste un changement d'UNE ligne dans CLES_RETENUES +
//   BUCKETS_MATCHS — mais c'est une décision, pas un ajustement.
//
// LE GABARIT DE TABLEAU — UUID_NUL.
//   Même dans les deux blocs retenus, RSEQ inscrit des cases de tableau
//   éliminatoire comme si c'étaient des équipes : elles portent toutes
//   l'identifiant nul 00000000-0000-0000-0000-000000000000 et un nom de rang.
//   Le filtre s'applique PARTOUT où l'on raisonne « équipe », jamais aux
//   matchs eux-mêmes (le match existe, son adversaire n'est pas encore connu).
// ============================================================================

/** Les seules clés racine qui survivent. Toute autre est jetée sans être lue. */
export const CLES_RETENUES = [
  "Teams",
  "RegularSeasonGames",
  "PostSeasonGames",
  "Standings",
] as const;

export type CleRetenue = (typeof CLES_RETENUES)[number];

/** Les blocs de matchs retenus, et la phase inscrite en base pour chacun. */
export const BUCKETS_MATCHS: ReadonlyArray<{ cle: CleRetenue; phase: string }> = [
  { cle: "RegularSeasonGames", phase: "regular" },
  { cle: "PostSeasonGames", phase: "post" },
];

/**
 * Motifs qui NE DOIVENT JAMAIS survivre au filtre. Sert au test de dérive
 * amont : on l'applique au payload BRUT pour vérifier que ce qu'il attrape
 * là est bien absent du filtré. `Coordinator` et `Statistician` sont là pour
 * les courriels ; `Player`/`Coach` pour les compteurs qu'on refuse aussi.
 */
export const MOTIFS_INTERDITS =
  /Stats|Athlete|Coordinator|Statistician|Player|Coach|Html/i;

export type PayloadRetenu = Record<CleRetenue, Record<string, unknown>[]>;

/**
 * Réduit le payload brut aux quatre clés retenues. Toute clé absente devient
 * un tableau vide : l'appelant n'a jamais à tester l'existence.
 *
 * Lève si le payload n'est pas un objet — un 404 renvoyant du HTML, ou un
 * corps vide, ne doit pas se traduire par « ligue sans match » (ce serait un
 * effacement silencieux) mais par une ligue MUETTE.
 */
export function retenirWhitelist(brut: unknown): PayloadRetenu {
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) {
    throw new Error("NEXUS: payload RSEQ inexploitable (pas un objet JSON)");
  }
  const src = brut as Record<string, unknown>;
  const sortie = {} as PayloadRetenu;
  for (const cle of CLES_RETENUES) {
    const v = src[cle];
    sortie[cle] = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  }
  return sortie;
}

/** Les clés racine du payload brut qui matchent les motifs interdits. */
export function clesSuspectes(brut: unknown): string[] {
  if (brut === null || typeof brut !== "object") return [];
  return Object.keys(brut as Record<string, unknown>).filter((k) =>
    MOTIFS_INTERDITS.test(k),
  );
}

/* ── Normalisation ────────────────────────────────────────────────────────
   Les fonctions ci-dessous REPRODUISENT à l'identique ce que
   scripts/scrape-rseq-calendar.mjs a écrit au premier chargement. Ce n'est
   pas du zèle : le moindre écart de format (un "19:30" devenu "1170", un
   null devenu 0) ferait diverger 2 368 lignes au premier passage de veille,
   et la recette d'idempotence ne prouverait plus rien. */

const SENTINELLE = -999; // « pas de résultat » côté RSEQ

/** GameTime (minutes depuis minuit) -> "HH:MM", ou null. */
export function formatHeure(gameTime: unknown): string | null {
  const n = Number(gameTime);
  if (!Number.isFinite(n) || n <= 0 || n > 23 * 60 + 59) return null;
  const hh = Math.floor(n / 60);
  const mm = n % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Un match est « joué » dès qu'un score DOMICILE réel est présent. Le test
 * porte volontairement sur le seul score domicile : c'est la règle du premier
 * chargement, et la changer reclasserait des matchs sans que RSEQ ait bougé.
 */
export function scoreDe(g: Record<string, unknown>) {
  const brut = g.HomeTeamScore;
  const joue = brut !== null && brut !== undefined && brut !== "" && brut !== SENTINELLE;
  if (!joue) {
    return {
      home_score: null as number | null,
      visitor_score: null as number | null,
      result_formatted: null as string | null,
      home_forfeit: false,
      visitor_forfeit: false,
      is_played: false,
    };
  }
  const vs = g.VisitingTeamScore;
  return {
    home_score: (brut as number) ?? null,
    visitor_score: vs === SENTINELLE || vs === undefined ? null : (vs as number),
    result_formatted: String(g.GameResultFormatted ?? "").trim() || null,
    home_forfeit: Boolean(g.IsHomeTeamForfeit ?? false),
    visitor_forfeit: Boolean(g.IsVisitingTeamForfeit ?? false),
    is_played: true,
  };
}

/** Méta de ligue, reprise de la base (jamais du payload) — voir la vue. */
export type MetaLigue = {
  rseq_league_id: string;
  saison: string;
  sector: string;
  sport: string | null;
  region: string | null;
  division: string | null;
  category: string | null;
  sex_type: string | null;
  league_name: string | null;
};

export function normaliserMatchs(p: PayloadRetenu, meta: MetaLigue) {
  const out: Record<string, unknown>[] = [];
  for (const { cle, phase } of BUCKETS_MATCHS) {
    for (const g of p[cle]) {
      if (!g?.GameId) continue;
      out.push({
        rseq_game_id: g.GameId,
        game_no: g.No ?? null,
        season: meta.saison,
        sector: meta.sector,
        phase,
        game_date: g.GameDateText ?? null,
        game_time: formatHeure(g.GameTime),
        home_rseq_team_id: g.HomeTeamId ?? null,
        visitor_rseq_team_id: g.VisitingTeamId ?? null,
        home_name_raw: g.HomeTeamName ?? null,
        visitor_name_raw: g.VisitingTeamName ?? null,
        home_code: g.HomeTeamCode ?? null,
        visitor_code: g.VisitingTeamCode ?? null,
        ...scoreDe(g),
        venue: g.SportFacilityDescription ?? null,
        venue_lat: g.SportsFacilityGPSLatitude ?? null,
        venue_lon: g.SportsFacilityGPSLongitude ?? null,
        field_number: g.FieldNumber ?? null,
        is_released: g.IsReleased ?? null,
        rseq_league_id: meta.rseq_league_id,
        league_name: meta.league_name,
        sport: meta.sport,
        region: meta.region,
        division: meta.division,
        category: meta.category,
        sex_type: meta.sex_type,
      });
    }
  }
  return out;
}

const CHAMPS_SETS = [
  "Wins_2Sets0", "Wins_2Sets1", "Losses_1Sets2", "Losses_0Sets2",
  "Wins_3Sets0", "Wins_3Sets1", "Wins_3Sets2",
  "Losses_2Sets3", "Losses_1Sets3", "Losses_0Sets3",
] as const;

const nombreOuNull = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : Number(v);

/**
 * Le classement, copié TEL QUEL. Aucun tri, aucun recalcul : `position` est
 * la position publiée par RSEQ, bris d'égalité compris. On ne saurait pas
 * les reproduire (TieBreakingRules, points d'éthique, forfaits) et un
 * classement « presque juste » est pire qu'aucun classement.
 */
export function normaliserClassement(p: PayloadRetenu) {
  return p.Standings.filter((s) => s?.TeamId).map((s) => {
    const setDetail: Record<string, unknown> = {};
    for (const c of CHAMPS_SETS) if (s[c] !== undefined) setDetail[c] = s[c];

    const showFlags: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) {
      if (k.startsWith("Standings_Show_") || k === "ShowNumberForfeits") {
        showFlags[k] = v;
      }
    }

    return {
      rseq_standings_id: s.StandingsId ?? null,
      rseq_team_id: s.TeamId,
      season_type: nombreOuNull(s.SeasonType) ?? 1,
      team_code: s.TeamCode ?? null,
      team_name: s.TeamName ?? null,
      pool: s.Pool ?? null,
      section_id: s.SectionId ?? null,
      position: nombreOuNull(s.Position),
      position_formatted: s.PositionFormatted ?? null,
      pool_position: s.PoolPosition ?? null,
      games_played: nombreOuNull(s.GamesPlayed),
      wins: nombreOuNull(s.Wins),
      wins_overtime: nombreOuNull(s.WinsOvertime),
      wins_shootout: nombreOuNull(s.WinsShootout),
      losses: nombreOuNull(s.Losses),
      losses_overtime: nombreOuNull(s.LossesOvertime),
      losses_shootout: nombreOuNull(s.LossesShootout),
      draws: nombreOuNull(s.Draws),
      set_wins: nombreOuNull(s.SetWins),
      set_losses: nombreOuNull(s.SetLosses),
      half_wins: nombreOuNull(s.HalfWins),
      half_losses: nombreOuNull(s.HalfLosses),
      half_draws: nombreOuNull(s.HalfDraws),
      points_for: nombreOuNull(s.PointsFor),
      // « PointsAgaints » / « GoalsAgaints » : la faute de frappe est CHEZ
      // RSEQ. On lit leur clé telle qu'elle est, on la corrige de notre côté.
      points_against: nombreOuNull(s.PointsAgaints),
      goals_for: nombreOuNull(s.GoalsFor),
      goals_against: nombreOuNull(s.GoalsAgaints),
      average: nombreOuNull(s.Average),
      average_formatted: s.AverageFormatted ?? null,
      average_points: nombreOuNull(s.AveragePoints),
      average_pts_formatted: s.AveragePtsFormatted ?? null,
      diff1: nombreOuNull(s.Diff1),
      diff2: nombreOuNull(s.Diff2),
      diff2_formatted: s.Diff2Formatted ?? null,
      plus_minus: nombreOuNull(s.PlusMinus),
      league_points: nombreOuNull(s.LeaguePoints),
      ethics_points: nombreOuNull(s.EthicsPoints),
      bonus_points: nombreOuNull(s.BonusPoints),
      total_points: nombreOuNull(s.TotalPoints),
      number_forfeits: nombreOuNull(s.NumberForfeits),
      set_detail: setDetail,
      show_flags: showFlags,
    };
  });
}

/**
 * Les équipes — uniquement ce qu'il faut pour DÉTECTER une nouveauté et la
 * rattacher à une école. InstitutionId est la seule raison de lire ce bloc :
 * c'est le seul endroit du payload qui relie une équipe à son établissement.
 * PlayerCount / CoachCount ne sont pas repris (voir l'entête).
 */
export function normaliserEquipes(p: PayloadRetenu) {
  return p.Teams.filter((t) => t?.TeamId && t.TeamId !== UUID_NUL).map((t) => ({
    rseq_team_id: t.TeamId,
    team_name: t.TeamName ?? null,
    team_code: t.TeamCode ?? null,
    rseq_institution_id: t.InstitutionId ?? null,
    team_pseudonym: t.TeamPseudonym ?? null,
  }));
}

/** Le gabarit de tableau éliminatoire, déguisé en équipe. */
export const UUID_NUL = "00000000-0000-0000-0000-000000000000";

/* ── L'UNION — et pourquoi Teams[] seul ne suffit pas ─────────────────────
   `Teams[]` N'EST PAS le registre des participants d'une ligue. Mesuré le
   2026-09-02 sur « Soccer C M D2 Nord-Est » : Teams[] = 5 lignes, TeamCount
   = 5, alors que les 52 matchs de la MÊME ligue font jouer 12 équipes
   réelles — Alma, Beauce-Appalaches, Chicoutimi, Jonquière, Rivière-du-Loup,
   Saint-Félicien et Thetford n'y figurent pas. Sur les 38 ligues collégiales
   2026-2027 : 312 lignes Teams[] pour 334 participants réels.

   Un détecteur qui ne lit que Teams[] est donc aveugle à 22 équipes — très
   exactement celles qu'on veut voir. On prend l'UNION :
     • Teams[]  — la seule source de l'InstitutionId, donc du rattachement
                  à une école. `vu_dans_teams = true`.
     • les participants des matchs retenus — nom et code seulement, aucun
       InstitutionId disponible. `vu_dans_teams = false` : la revue saura
       que le rattachement à l'école reste À FAIRE À LA MAIN, au lieu de
       croire à un rapprochement de nom.
   L'UUID nul est exclu des deux côtés. */
export function equipesADetecter(p: PayloadRetenu) {
  const par = new Map<string, {
    rseq_team_id: string;
    team_name: string | null;
    team_code: string | null;
    rseq_institution_id: string | null;
    team_pseudonym: string | null;
    vu_dans_teams: boolean;
  }>();

  for (const t of normaliserEquipes(p)) {
    par.set(t.rseq_team_id as string, {
      rseq_team_id: t.rseq_team_id as string,
      team_name: (t.team_name as string) ?? null,
      team_code: (t.team_code as string) ?? null,
      rseq_institution_id: (t.rseq_institution_id as string) ?? null,
      team_pseudonym: (t.team_pseudonym as string) ?? null,
      vu_dans_teams: true,
    });
  }

  for (const { cle } of BUCKETS_MATCHS) {
    for (const g of p[cle]) {
      for (const [id, nom, code] of [
        [g.HomeTeamId, g.HomeTeamName, g.HomeTeamCode],
        [g.VisitingTeamId, g.VisitingTeamName, g.VisitingTeamCode],
      ] as [unknown, unknown, unknown][]) {
        if (typeof id !== "string" || id === UUID_NUL || par.has(id)) continue;
        par.set(id, {
          rseq_team_id: id,
          team_name: (nom as string) ?? null,
          team_code: (code as string) ?? null,
          rseq_institution_id: null,
          team_pseudonym: null,
          vu_dans_teams: false,
        });
      }
    }
  }

  return [...par.values()];
}
