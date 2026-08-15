/* ═══════════════════════════════════════════════════════════════
   useRecruitingCalendar — couche data du Calendrier de recrutement.

   Chaîne : cibles → athletes → team_athletes → teams → games.

   JOINTURE MATCHS PAR teams.id ↔ games.home_team_id / visitor_team_id.

   Le filtre du calendrier, ce sont les ATHLÈTES suivis — jamais
   l'origine du match. La jointure passait auparavant par le pont RSEQ
   (teams.rseq_team_id ↔ games.home_rseq_team_id), un raccourci de
   l'époque où tout match venait du RSEQ. Il excluait EN SILENCE toute
   équipe non pontée, civile comme scolaire.

   Pourquoi teams.id ne perd rien — mesuré le 2026-08-14 sur les 97 478
   côtés de match : games.*_team_id est NULL dans 30 575 cas, et dans
   CES 30 575 cas il n'existe AUCUNE ligne `teams` pour l'id RSEQ visé
   (0 exception). Autrement dit *_team_id n'est jamais vide sur une
   équipe que nous connaissons — les côtés orphelins sont des
   adversaires absents de la base (« Collège Beaubois », et même
   « Congé (Bye) »). Or une cible du calendrier est par construction une
   ligne `teams`, puisqu'un athlète y est rattaché. Vérifié sur le
   périmètre réel — les équipes portant au moins un athlète : 24 matchs
   par le pont RSEQ, 24 par teams.id, 0 perdu.

   Perf — requêtes à plat, aucune N+1 par cible ni par match :
     1. cibles       (pipeline ∪ favoris ∪ membres de listes)
     2. athlètes     (1 seul .in() sur l'union des ids)
     3. matchs       (1 seul .or() avec 2 .in() sur l'array de teams.id)
     4. adversaires  (1 seul .in() pour nommer les équipes d'en face)
     5. fraîcheur    (MAX(games.updated_at), 1 ligne)
   L'array de teams.id part en littéral dans le .in() — pas de CTE
   non analysé côté serveur (cf. bench diagnostic).

   Le hook renvoie les cibles et les matchs BRUTS. Le filtrage vit dans
   la page (useMemo) : changer un filtre ne doit pas refetch, et un
   match reste affiché tant qu'au moins une cible filtrée y joue.

   RLS : la lecture de team_athletes passe par la policy « Recruiters
   read own target team rows » (FIX 5), bornée aux athlètes que CE
   recruteur suit déjà. Un recruteur sans cible ne lit donc rien.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { genderLabel } from "@/lib/config/gender";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";

/* ── Types ─────────────────────────────────────────────────── */

/** Une cible = un couple (athlète, équipe). Un athlète multi-sport a
 *  une équipe par sport (FIX 4) → il produit une entrée par équipe,
 *  ce qui est exactement ce qu'il faut pour rattacher ses matchs. */
export interface CalendarTarget {
  athleteId: string;
  /** false = identité masquée par le serveur (Loi 25 ou tier FREE). */
  identityVisible: boolean;
  /** Déjà résolu par displayFullName() — ne jamais reconcaténer. */
  fullName: string;
  firstName: string;
  lastName: string;
  /** Vide sous masquage : une initiale est une divulgation partielle. */
  initials: string;
  photo: string;
  /** Slug sport aligné sur la page Recherche ("flag_football"). */
  sport: string;
  sportName: string;
  /** Abréviation de position ("QB"). */
  position: string;
  graduationYear: number;
  region: string;
  school: string;
  verified: boolean;
  hasVideo: boolean;
  stars: number;
  gpa: number;
  orgType: "scolaire" | "ligue_civile" | undefined;
  /** Stage recruiter_pipeline, null si la cible vient d'un favori/liste seul. */
  pipelineStage: string | null;
  /** Listes du recruteur contenant cet athlète. */
  listIds: string[];
  /** Clé de jointure aux matchs (games.home_team_id / visitor_team_id). */
  teamId: string;
  teamName: string;
}

export interface CalendarGame {
  id: string;
  /** "YYYY-MM-DD" brut. À parser avec parseGameDate(), jamais new Date(str). */
  gameDate: string;
  gameTime: string;
  venue: string;
  homeTeamId: string | null;
  visitorTeamId: string | null;
  homeName: string;
  visitorName: string;
  /** "Football juvénile D2 · Masculin" — ligne `lg` de la carte. */
  competition: string;
}

export interface RecruitingCalendarData {
  targets: CalendarTarget[];
  games: CalendarGame[];
  /** MAX(games.updated_at) — « Mis à jour le X ». */
  lastUpdated: string | null;
}

const EMPTY: RecruitingCalendarData = { targets: [], games: [], lastUpdated: null };

/* ── Helpers ───────────────────────────────────────────────── */

/** PostgREST renvoie un embed to-one tantôt comme objet, tantôt comme
 *  tableau à un élément selon la forme du select. Le type cible est donné
 *  explicitement à l'appel — l'inférence depuis `Record<string, …>` part
 *  sinon sur l'index signature et casse. */
function pickOne<T>(v: unknown): T | null {
  if (!v) return null;
  const one = Array.isArray(v) ? (v[0] ?? null) : v;
  return (one as T | null) ?? null;
}

/** games.game_date est un `date` Postgres ("2026-10-12"). `new Date(str)`
 *  l'interprète en UTC minuit → en America/Montreal la date recule d'un
 *  jour et le match change de semaine. On construit donc la date en
 *  temps local, composant par composant. */
export function parseGameDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** "YYYY-MM-DD" du jour, en temps local (borne « matchs à venir »). */
export function todayIso(): string {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

/** "Football juvénile D2 · Masculin" — sport + catégorie + division,
 *  puis le genre s'il est déclaré. */
function buildCompetition(g: Record<string, unknown>): string {
  const head = [g.sport, g.category, g.division]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" ");
  const sex = typeof g.sex_type === "string" ? g.sex_type.trim() : "";
  const sexLabel = sex ? genderLabel(sex) : "";
  if (head && sexLabel && sexLabel !== "—") return `${head} · ${sexLabel}`;
  return head || (sexLabel !== "—" ? sexLabel : "");
}

/* ── Hook ──────────────────────────────────────────────────── */

/** @param enabled  false pour le tier Free : aucune requête ne part
 *                  (le mur ne doit rien télécharger). */
export function useRecruitingCalendar(enabled: boolean = true) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<RecruitingCalendarData>({
    queryKey: ["recruiting-calendar", userId],
    queryFn: async (): Promise<RecruitingCalendarData> => {
      if (!userId) return EMPTY;
      const supabase = createClient();

      /* ── 1. Cibles = pipeline ∪ favoris ∪ membres de listes ── */
      const { data: listRows } = await supabase
        .from("recruiter_lists")
        .select("id")
        .eq("recruiter_id", userId);
      const listIds = ((listRows ?? []) as { id: string }[]).map((l) => l.id);

      const [pipelineRes, favoritesRes, membersRes] = await Promise.all([
        supabase
          .from("recruiter_pipeline")
          .select("athlete_id, stage")
          .eq("recruiter_id", userId),
        supabase
          .from("recruiter_favorites")
          .select("athlete_id")
          .eq("recruiter_id", userId),
        listIds.length
          ? supabase
              .from("recruiter_list_members")
              .select("athlete_id, list_id")
              .in("list_id", listIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const stageByAthlete = new Map<string, string>();
      ((pipelineRes.data ?? []) as { athlete_id: string; stage: string | null }[])
        .forEach((r) => { if (r.stage) stageByAthlete.set(r.athlete_id, r.stage); });

      const listsByAthlete = new Map<string, string[]>();
      ((membersRes.data ?? []) as { athlete_id: string; list_id: string }[])
        .forEach((r) => {
          const cur = listsByAthlete.get(r.athlete_id) ?? [];
          cur.push(r.list_id);
          listsByAthlete.set(r.athlete_id, cur);
        });

      const targetIds = Array.from(new Set<string>([
        ...((pipelineRes.data ?? []) as { athlete_id: string }[]).map((r) => r.athlete_id),
        ...((favoritesRes.data ?? []) as { athlete_id: string }[]).map((r) => r.athlete_id),
        ...((membersRes.data ?? []) as { athlete_id: string }[]).map((r) => r.athlete_id),
      ]));

      if (targetIds.length === 0) return EMPTY;

      /* ── 2a. Les cartes projetées (famille 1 : lot d'IDs) ──
         targetIds vient de pipeline ∪ favoris ∪ listes, donc c'est
         bien un lot d'IDs connus, pas une recherche filtrée. */
      const cardMap = await fetchRecruiterAthleteCards(supabase, targetIds);

      /* ── 2b. Le rattachement d'équipe, à part ──
         Les RPC de projection ne portent AUCUN champ d'équipe. On le lit
         donc directement : team_athletes et teams ne contiennent
         aucune donnée personnelle d'athlète, seulement un lien.

         La RLS reste le gardien, à l'identique de l'embed d'avant :
         « Recruiters read own target team rows » couvre tout athlète
         ACTIF présent dans le pipeline, les favoris ou les listes du
         recruteur — c'est exactement la définition de targetIds, donc
         la couverture est totale ici, vérifiés ou non. */
      const { data: linkRows, error: linkErr } = await supabase
        .from("team_athletes")
        .select("athlete_id, team_id, teams!team_id(id, name)")
        .in("athlete_id", targetIds);
      if (linkErr) throw linkErr;

      const linksByAthlete = new Map<string, Record<string, unknown>[]>();
      for (const row of (linkRows ?? []) as Record<string, unknown>[]) {
        const aid = row.athlete_id as string;
        const cur = linksByAthlete.get(aid) ?? [];
        cur.push(row);
        linksByAthlete.set(aid, cur);
      }

      const targets: CalendarTarget[] = [];
      const teamIds = new Set<string>();

      targetIds.forEach((athleteId) => {
        // `?? null` explicite : la RPC ne rend rien pour un athlète
        // inactif — l'ancien `.eq("status","ACTIF")` le filtrait pareil.
        const card = cardMap.get(athleteId) ?? null;
        if (!card) return;

        const links = linksByAthlete.get(athleteId) ?? [];

        const base = {
          athleteId: card.id,
          identityVisible: card.identity_visible,
          fullName: displayFullName(card),
          firstName: card.first_name ?? "",
          lastName: card.last_name ?? "",
          // Sous masquage, pas d'initiales : elles recoupées à l'école
          // et à la position réidentifient. Le rendu bascule sur le
          // placeholder via identityVisible.
          initials: card.identity_visible
            ? initialsOf(card.first_name ?? "", card.last_name ?? "")
            : "",
          photo: card.photo_url ?? "",
          sport: (card.sport_nom || "").toLowerCase().replace(/ /g, "_"),
          sportName: card.sport_nom ?? "",
          position: card.position_abbr ?? "",
          graduationYear: card.annee_diplomation ?? 0,
          region: card.school_region ?? "",
          school: card.school_name ?? "",
          verified: card.verified === true,
          hasVideo: !!card.a_une_video,
          stars: card.cote_globale ?? 0,
          gpa: card.moyenne_generale ?? 0,
          orgType: (!card.school_id
            ? undefined
            : card.school_type === "LIGUE_CIVILE"
              ? "ligue_civile"
              : "scolaire") as "scolaire" | "ligue_civile" | undefined,
          pipelineStage: stageByAthlete.get(athleteId) ?? null,
          listIds: listsByAthlete.get(athleteId) ?? [],
        };

        links.forEach((link) => {
          const team = pickOne<Record<string, unknown>>(link.teams);
          // teams.id est la seule clé de jointure. Une équipe sans match
          // reste une cible légitime : elle apparaît simplement sans
          // calendrier, au lieu d'être écartée en amont.
          const teamId = (team?.id as string) || (link.team_id as string) || "";
          if (!teamId) return;
          teamIds.add(teamId);
          targets.push({
            ...base,
            teamId,
            teamName: (team?.name as string) || "",
          });
        });
      });

      if (targets.length === 0) {
        return { targets: [], games: [], lastUpdated: await fetchLastUpdated(supabase) };
      }

      /* ── 3. Matchs à venir — UNE requête, array de teams.id ── */
      const ids = Array.from(teamIds);
      const inList = `(${ids.join(",")})`;
      const { data: gameRows, error: gameErr } = await supabase
        .from("games")
        .select(`
          id, game_date, game_time, venue,
          home_team_id, visitor_team_id,
          home_name_raw, visitor_name_raw,
          league_name, sport, division, category, sex_type
        `)
        .or(`home_team_id.in.${inList},visitor_team_id.in.${inList}`)
        .gte("game_date", todayIso())
        .order("game_date", { ascending: true });
      if (gameErr) throw gameErr;

      /* Nom d'équipe : le nom Nexus prime des DEUX côtés, sinon le
         libellé brut du calendrier source. La policy « Recruiters see
         teams » autorise la lecture de toutes les équipes, donc
         l'adversaire est résolu lui aussi — sans quoi une carte
         afficherait « Amitié vs Thérèse-Martin », un nom Nexus contre
         un libellé brut. Une seule requête à plat sur l'ensemble des
         teams.id apparus dans les matchs.
         L'adversaire peut n'avoir AUCUNE ligne `teams` (équipe hors
         base) : son côté est alors NULL et on retombe sur *_name_raw. */
      const teamNameById = new Map<string, string>();
      targets.forEach((t) => {
        if (t.teamName && !teamNameById.has(t.teamId)) {
          teamNameById.set(t.teamId, t.teamName);
        }
      });

      const opponentIds = Array.from(new Set(
        ((gameRows ?? []) as Record<string, unknown>[])
          .flatMap((g) => [g.home_team_id, g.visitor_team_id])
          .filter((v): v is string => typeof v === "string" && !teamNameById.has(v)),
      ));
      if (opponentIds.length > 0) {
        const { data: oppRows } = await supabase
          .from("teams")
          .select("id, name")
          .in("id", opponentIds);
        ((oppRows ?? []) as { id: string | null; name: string | null }[])
          .forEach((r) => {
            if (r.id && r.name && !teamNameById.has(r.id)) {
              teamNameById.set(r.id, r.name);
            }
          });
      }

      const games: CalendarGame[] = ((gameRows ?? []) as Record<string, unknown>[])
        .filter((g) => !!g.game_date)
        .map((g) => {
          const homeId = (g.home_team_id as string | null) ?? null;
          const visId = (g.visitor_team_id as string | null) ?? null;
          return {
            id: g.id as string,
            gameDate: g.game_date as string,
            gameTime: (g.game_time as string) || "",
            venue: (g.venue as string) || "",
            homeTeamId: homeId,
            visitorTeamId: visId,
            homeName:
              (homeId && teamNameById.get(homeId)) ||
              (g.home_name_raw as string) ||
              "Équipe à confirmer",
            visitorName:
              (visId && teamNameById.get(visId)) ||
              (g.visitor_name_raw as string) ||
              "Équipe à confirmer",
            competition: buildCompetition(g),
          };
        });

      return { targets, games, lastUpdated: await fetchLastUpdated(supabase) };
    },
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** « Mis à jour le X » = MAX(games.updated_at). La colonne existe depuis
 *  la migration 20260723140000_rseq_games (DEFAULT now()), donc pas de
 *  repli sur created_at. */
async function fetchLastUpdated(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data } = await supabase
    .from("games")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  const row = ((data ?? []) as { updated_at: string | null }[])[0];
  return row?.updated_at ?? null;
}
