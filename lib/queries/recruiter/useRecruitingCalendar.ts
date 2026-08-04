/* ═══════════════════════════════════════════════════════════════
   useRecruitingCalendar — couche data du Calendrier de recrutement.

   Chaîne : cibles → athletes → team_athletes → teams → games.

   ⚠️ JOINTURE MATCHS PAR CLÉ RSEQ, jamais par games.home_team_id /
   visitor_team_id. Ces deux colonnes ne sont remplies qu'à ~51 % (le
   pont teams.id n'existe que pour les équipes déjà adoptées par un
   coach), alors que home_rseq_team_id / visitor_rseq_team_id sont à
   100 %. La clé de jointure est donc teams.rseq_team_id ↔
   games.home_rseq_team_id / games.visitor_rseq_team_id.

   Perf — requêtes à plat, aucune N+1 par cible ni par match :
     1. cibles       (pipeline ∪ favoris ∪ membres de listes)
     2. athlètes     (1 seul .in() sur l'union des ids)
     3. matchs       (1 seul .or() avec 2 .in() sur l'array de rseq ids)
     4. adversaires  (1 seul .in() pour nommer les équipes d'en face)
     5. fraîcheur    (MAX(games.updated_at), 1 ligne)
   L'array de rseq_team_id part en littéral dans le .in() — pas de CTE
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
import { taRows } from "@/lib/queries/shared/embeds";
import { genderLabel } from "@/lib/config/gender";

/* ── Types ─────────────────────────────────────────────────── */

/** Une cible = un couple (athlète, équipe). Un athlète multi-sport a
 *  une équipe par sport (FIX 4) → il produit une entrée par équipe,
 *  ce qui est exactement ce qu'il faut pour rattacher ses matchs. */
export interface CalendarTarget {
  athleteId: string;
  firstName: string;
  lastName: string;
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
  teamId: string;
  teamName: string;
  rseqTeamId: string;
}

export interface CalendarGame {
  id: string;
  /** "YYYY-MM-DD" brut. À parser avec parseGameDate(), jamais new Date(str). */
  gameDate: string;
  gameTime: string;
  venue: string;
  homeRseqTeamId: string | null;
  visitorRseqTeamId: string | null;
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

      /* ── 2. Athlètes + leur(s) équipe(s) — un seul .in() ── */
      const { data: athleteRows, error: athleteErr } = await supabase
        .from("athletes")
        .select(`
          id, first_name, last_name, photo_url, verified,
          annee_diplomation, video_faits_saillants_url,
          cote_globale_entraineur, moyenne_generale, school_id,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region, type),
          team_athletes(
            team_id,
            teams!team_id(id, name, rseq_team_id)
          )
        ` as unknown as "*")
        .in("id", targetIds)
        .eq("status", "ACTIF");
      if (athleteErr) throw athleteErr;

      const targets: CalendarTarget[] = [];
      const rseqTeamIds = new Set<string>();

      ((athleteRows ?? []) as Record<string, unknown>[]).forEach((a) => {
        const sportRel = pickOne<Record<string, string>>(a.sports);
        const posRel = pickOne<Record<string, string>>(a.positions);
        const schoolRel = pickOne<Record<string, string>>(a.schools);
        // taRows : depuis l'ancrage unique strict, PostgREST renvoie cet embed
        // en OBJET (ou null). Un test Array.isArray excluant le vidait, et le
        // calendrier perdait TOUS ses matchs sans lever la moindre erreur.
        const links = taRows<Record<string, unknown>>(
          a.team_athletes as Record<string, unknown> | Record<string, unknown>[] | null,
        );

        const base = {
          athleteId: a.id as string,
          firstName: (a.first_name as string) || "",
          lastName: (a.last_name as string) || "",
          initials: initialsOf((a.first_name as string) || "", (a.last_name as string) || ""),
          photo: (a.photo_url as string) || "",
          sport: (sportRel?.nom || "").toLowerCase().replace(/ /g, "_"),
          sportName: sportRel?.nom || "",
          position: posRel?.abreviation || "",
          graduationYear: (a.annee_diplomation as number) || 0,
          region: schoolRel?.region || "",
          school: schoolRel?.name || "",
          verified: a.verified === true,
          hasVideo: !!a.video_faits_saillants_url,
          stars: (a.cote_globale_entraineur as number) || 0,
          gpa: (a.moyenne_generale as number) || 0,
          orgType: (!a.school_id
            ? undefined
            : schoolRel?.type === "LIGUE_CIVILE"
              ? "ligue_civile"
              : "scolaire") as "scolaire" | "ligue_civile" | undefined,
          pipelineStage: stageByAthlete.get(a.id as string) ?? null,
          listIds: listsByAthlete.get(a.id as string) ?? [],
        };

        (links as Record<string, unknown>[]).forEach((link) => {
          const team = pickOne<Record<string, unknown>>(link.teams);
          const rseq = team?.rseq_team_id as string | null | undefined;
          // Sans pont RSEQ, l'équipe ne peut porter aucun match : on
          // n'invente rien, la cible est simplement sans calendrier.
          if (!rseq) return;
          rseqTeamIds.add(rseq);
          targets.push({
            ...base,
            teamId: (team?.id as string) || (link.team_id as string) || "",
            teamName: (team?.name as string) || "",
            rseqTeamId: rseq,
          });
        });
      });

      if (rseqTeamIds.size === 0) {
        return { targets: [], games: [], lastUpdated: await fetchLastUpdated(supabase) };
      }

      /* ── 3. Matchs à venir — UNE requête, array de rseq ids ── */
      const ids = Array.from(rseqTeamIds);
      const inList = `(${ids.join(",")})`;
      const { data: gameRows, error: gameErr } = await supabase
        .from("games")
        .select(`
          id, game_date, game_time, venue,
          home_rseq_team_id, visitor_rseq_team_id,
          home_name_raw, visitor_name_raw,
          league_name, sport, division, category, sex_type
        `)
        .or(`home_rseq_team_id.in.${inList},visitor_rseq_team_id.in.${inList}`)
        .gte("game_date", todayIso())
        .order("game_date", { ascending: true });
      if (gameErr) throw gameErr;

      /* Nom d'équipe : le nom Nexus prime des DEUX côtés, sinon le
         libellé brut du calendrier RSEQ. La policy « Recruiters see
         teams » autorise la lecture de toutes les équipes, donc
         l'adversaire est résolu lui aussi — sans quoi une carte
         afficherait « Amitié vs Thérèse-Martin », un nom Nexus contre
         un libellé RSEQ. Une seule requête à plat sur l'ensemble des
         rseq ids apparus dans les matchs. */
      const teamNameByRseq = new Map<string, string>();
      targets.forEach((t) => {
        if (t.teamName && !teamNameByRseq.has(t.rseqTeamId)) {
          teamNameByRseq.set(t.rseqTeamId, t.teamName);
        }
      });

      const opponentIds = Array.from(new Set(
        ((gameRows ?? []) as Record<string, unknown>[])
          .flatMap((g) => [g.home_rseq_team_id, g.visitor_rseq_team_id])
          .filter((v): v is string => typeof v === "string" && !teamNameByRseq.has(v)),
      ));
      if (opponentIds.length > 0) {
        const { data: oppRows } = await supabase
          .from("teams")
          .select("rseq_team_id, name")
          .in("rseq_team_id", opponentIds);
        ((oppRows ?? []) as { rseq_team_id: string | null; name: string | null }[])
          .forEach((r) => {
            if (r.rseq_team_id && r.name && !teamNameByRseq.has(r.rseq_team_id)) {
              teamNameByRseq.set(r.rseq_team_id, r.name);
            }
          });
      }

      const games: CalendarGame[] = ((gameRows ?? []) as Record<string, unknown>[])
        .filter((g) => !!g.game_date)
        .map((g) => {
          const homeRseq = (g.home_rseq_team_id as string | null) ?? null;
          const visRseq = (g.visitor_rseq_team_id as string | null) ?? null;
          return {
            id: g.id as string,
            gameDate: g.game_date as string,
            gameTime: (g.game_time as string) || "",
            venue: (g.venue as string) || "",
            homeRseqTeamId: homeRseq,
            visitorRseqTeamId: visRseq,
            homeName:
              (homeRseq && teamNameByRseq.get(homeRseq)) ||
              (g.home_name_raw as string) ||
              "Équipe à confirmer",
            visitorName:
              (visRseq && teamNameByRseq.get(visRseq)) ||
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
