/* ═══════════════════════════════════════════════════════════════
   usePipelineCards — TanStack hook (iter 5.3b)
   Fetch les cards pipeline du recruteur courant + competitorMap
   (stages des autres recruteurs sur les mêmes athlètes).
   Reproduit fidèlement le useEffect ligne 809+ du legacy.

   staleTime 60s — kanban peut bouger (autres recruteurs déplacent).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { isGrade, type Grade } from "@/lib/config/grades";

const STAGE_ORDER: Record<string, number> = {
  identifie: 1, contacte: 2, en_discussion: 3,
  visite_planifiee: 4, engage: 5, lettre_signee: 6,
};

export interface PipelineData {
  cards: PipelineKanbanCard[];
  competitorMap: Record<string, number>;
}

const EMPTY: PipelineData = { cards: [], competitorMap: {} };

/* Les grades du recruteur courant sur les athlètes de son pipeline.
   Même modèle que le competitorMap plus bas : une requête à plat, repliée en
   Record indexé par athlete_id, plutôt qu'un embed PostgREST.
   L'embed était impossible ici — recruiter_athlete_grades n'a pas de FK vers
   recruiter_pipeline (les deux pointent vers athletes séparément), donc aucune
   relation à traverser. Et la RLS suffit à cadrer la lecture : propriétaire
   seul. Le .eq("recruiter_id") reste pour que la requête dise ce qu'elle lit.
   isGrade() garde la frontière : une valeur hors des 7 est ignorée plutôt que
   propagée jusqu'à la puce. */
async function fetchGradeMap(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  athleteIds: string[],
): Promise<Record<string, Grade>> {
  const map: Record<string, Grade> = {};
  if (athleteIds.length === 0) return map;

  const { data } = await supabase
    .from("recruiter_athlete_grades")
    .select("athlete_id, grade")
    .eq("recruiter_id", userId)
    .in("athlete_id", athleteIds);

  if (data) {
    for (const row of data as { athlete_id: string; grade: unknown }[]) {
      if (isGrade(row.grade)) map[row.athlete_id] = row.grade;
    }
  }
  return map;
}

/** Dernière note de suivi (recruiter_notes) par athlète — colonne « Note de
 *  suivi » de la vue tableau (décision BP 2026-09-23 : la plus récente, avec
 *  sa date ; le panneau garde l'historique complet).
 *
 *  Une requête, triée du plus récent au plus ancien : la PREMIÈRE ligne vue
 *  pour un athlète est la sienne. Pas de migration — la RLS propriétaire seul
 *  de recruiter_notes suffit, et le `.eq("recruiter_id")` est explicite quand
 *  même (même idiome que fetchGradeMap). Si le plafond PostgREST (1 000
 *  lignes) tronquait un jour la réponse, c'est l'ancien qui tomberait, jamais
 *  la dernière note.
 *
 *  Une erreur ne casse PAS le pipeline : colonne vide plutôt que kanban
 *  blanc. Elle est journalisée, pas avalée. */
async function fetchDerniereNoteMap(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  athleteIds: string[],
): Promise<Record<string, { content: string; created_at: string }>> {
  const map: Record<string, { content: string; created_at: string }> = {};
  if (athleteIds.length === 0) return map;

  const { data, error } = await supabase
    .from("recruiter_notes")
    .select("athlete_id, content, created_at")
    .eq("recruiter_id", userId)
    .in("athlete_id", athleteIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[usePipelineCards] dernière note :", error.message);
    return map;
  }
  for (const row of (data ?? []) as { athlete_id: string; content: string; created_at: string }[]) {
    if (!map[row.athlete_id]) map[row.athlete_id] = { content: row.content, created_at: row.created_at };
  }
  return map;
}

/** `enabled` FACULTATIF, défaut `true` : tous les appelants existants sont
 *  inchangés. Le dashboard s'en sert pour ne PAS charger le pipeline d'un
 *  recruteur Free, chez qui l'encart Relances n'a pas lieu d'être — on évite
 *  la requête plutôt que de la faire et d'en jeter le résultat. La clé de
 *  cache est identique, donc le pipeline et le dashboard partagent le même
 *  chargement quand les deux sont montés. */
export function usePipelineCards(options?: { enabled?: boolean }) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<PipelineData>({
    queryKey: ["pipeline", userId],
    queryFn: async (): Promise<PipelineData> => {
      if (!userId) return EMPTY;
      const supabase = createClient();

      /* DEPRECATED — le champ `notes` du select ci-dessous est
         recruiter_pipeline.notes. La surface de notes CANONIQUE est la table
         recruiter_notes (useAddPipelineNote / usePipelineNotes). Cette colonne
         n'est plus ÉCRITE nulle part dans l'app : elle n'est plus que LUE ici,
         puis mappée sur PipelineKanbanCard.notes plus bas. Ne pas la réutiliser
         pour du neuf. Sa suppression est prévue dans un lot de nettoyage dédié —
         il faudra retirer le champ du select ET le mapping.
         Le commentaire vit ICI et pas dans le template literal : ce dernier part
         tel quel à PostgREST, où `//` n'est pas un commentaire mais du texte qui
         casse la requête. */
      /* Temps 1 — la relation SEULE (embed athletes retiré). */
      const { data, error } = await supabase
        .from("recruiter_pipeline")
        .select(`
          id,
          recruiter_id,
          athlete_id,
          stage,
          notes,
          flagged,
          next_action_at,
          next_action_note,
          visit_at,
          moved_at,
          created_at,
          updated_at
        `)
        .eq("recruiter_id", userId)
        .order("moved_at", { ascending: false });

      if (error) throw error;
      if (!data) return EMPTY;

      /* Temps 2 — les cartes projetées et les grades, résolus par lot.
         En parallèle : les deux ne dépendent que de la liste d'athlètes, les
         sérialiser ajouterait un aller-retour à l'ouverture du kanban. */
      const pipelineAthleteIds = data.map((p) => p.athlete_id as string);
      const [cardMap, gradeMap, noteMap] = await Promise.all([
        fetchRecruiterAthleteCards(supabase, pipelineAthleteIds),
        fetchGradeMap(supabase, userId, pipelineAthleteIds),
        fetchDerniereNoteMap(supabase, userId, pipelineAthleteIds),
      ]);

      const mapped: PipelineKanbanCard[] = data.map((p: Record<string, unknown>) => {
        // `?? null` explicite : la RPC ne rend rien pour un athlète
        // inactif ou supprimé, et un `undefined` interpolé écrirait
        // "undefined" sur la carte.
        const card = cardMap.get(p.athlete_id as string) ?? null;

        const movedAt = (p.moved_at as string) || (p.updated_at as string) || null;
        const daysSinceMove = movedAt ? Math.floor((Date.now() - new Date(movedAt).getTime()) / 86400000) : 0;
        const stageRaw = ((p.stage as string) || "IDENTIFIE").toLowerCase();

        return {
          id: card?.id ?? (p.athlete_id as string),
          pipeline_id: p.id as string,
          // Anciennement `${a.first_name} ${a.last_name}` : dès que le
          // serveur masque l'identité, les deux champs sont NULL et le
          // template littéral affichait "null null" sur le kanban.
          full_name: displayFullName(card),
          identityVisible: card?.identity_visible ?? false,
          photo_url: card?.photo_url ?? "",
          sport: card?.sport_nom ?? "",
          position: card?.position_abbr ?? "",
          school: card?.school_name ?? "",
          region: card?.school_region ?? "",
          // schools.type — déjà rendu par la projection, il ne descendait
          // simplement pas sur la carte. Sert au LIBELLÉ de la facette
          // « École / ligue » (distinguer une ligue civile d'une école
          // secondaire), jamais au filtrage lui-même.
          school_type: card?.school_type ?? null,
          division: "D1" as const,
          graduation_year: card?.annee_diplomation ?? 0,
          coach_rating: card?.cote_globale ?? 0,
          profile_completeness: card?.profile_completion ?? 0,
          is_verified: !!card?.verified,
          has_video: !!card?.a_une_video,
          jersey: card?.numero_jersey ? String(card.numero_jersey) : "",
          recruitment_status: card?.recruitment_status ?? "OUVERT",
          committed_school_name: card?.committed_school_name ?? "",
          open_to_offers: card?.open_to_offers ?? null,
          status: stageRaw as RecruitmentStatus,
          days_in_status: daysSinceMove,
          notes: (p.notes as string) || "",
          last_activity: movedAt ? `Mis à jour il y a ${daysSinceMove} jours` : "",
          flagged: !!p.flagged,
          next_action_at: (p.next_action_at as string) || null,
          next_action_note: (p.next_action_note as string) || null,
          // Date+heure de la visite. Ne vit que sous VISITE_PLANIFIEE — les
          // autres stages la remettent à NULL à l'écriture.
          visit_at: (p.visit_at as string) || null,
          moved_at: movedAt,
          // Grade privé du recruteur courant. `?? null` : absent du map =
          // aucune ligne dans recruiter_athlete_grades = pas encore jugé.
          grade: gradeMap[p.athlete_id as string] ?? null,
          noTeam: !card?.school_id,
          taille_pieds: card?.taille_pieds ?? null,
          taille_pouces: card?.taille_pouces ?? null,
          poids_lbs: card?.poids_lbs ?? null,
          derniere_note: noteMap[p.athlete_id as string] ?? null,
        } as PipelineKanbanCard;
      });

      // Competitor stages query — les autres recruteurs sur mes athlètes
      const athleteIds = mapped.map((c) => c.id);
      const competitorMap: Record<string, number> = {};
      if (athleteIds.length > 0) {
        const { data: competitorData } = await supabase
          .from("recruiter_pipeline")
          .select("athlete_id, stage")
          .in("athlete_id", athleteIds)
          .neq("recruiter_id", userId)
          .neq("stage", "RETIRÉ");

        if (competitorData) {
          for (const row of competitorData as { athlete_id: string; stage: string }[]) {
            const order = STAGE_ORDER[row.stage.toLowerCase()] ?? 0;
            if (!competitorMap[row.athlete_id] || order > competitorMap[row.athlete_id]) {
              competitorMap[row.athlete_id] = order;
            }
          }
        }
      }

      return { cards: mapped, competitorMap };
    },
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 60 * 1000,
  });
}
