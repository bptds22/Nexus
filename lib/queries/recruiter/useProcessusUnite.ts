/* ═══════════════════════════════════════════════════════════════
   useProcessusUnite — « Mon processus » par UNITÉ (lot B2, étape 1).

   Le tableau blanc (décision BP 2026-09-24) : une carte par athlète pour
   l'unité cégep × sport, pas une par ligne de recruteur. Lu par les
   fonctions posées en base aux lots B1/B2-0 :
     · unite_pipeline()  — une ligne par athlète (étape la plus avancée,
       relance, visite, drapeau) et `recruteurs` : qui le suit ;
     · unite_grades()    — le grade de l'unité (le plus récent) ;
     · unite_auteurs()   — les NOMS des auteurs (users n'est pas lisible
       entre collègues) ;
     · recruiter_notes   — la dernière note de suivi, avec son auteur (la
       RLS rend les notes de l'unité à un Pro).

   Réservé au Pro : un compte gratuit reste sur usePipelineCards (ses propres
   lignes, mode démo, décision BP 1). La base le garantit de toute façon :
   les policies d'unité exigent Pro depuis B2-0.

   `sportId` / `toutLeCegep` : le filtre sport de l'admin cégep. Absents →
   l'unité de l'appelant. La RLS décide de ce qui est lisible : un
   non-admin qui demanderait tout le cégep ne reçoit que son unité.

   Les noms sont résolus ICI, une fois, en chaînes prêtes à afficher : la
   carte, le tableau, l'export et le panneau les lisent sans refaire la
   jointure.

   Clé de cache sous le préfixe ["pipeline"] : toutes les invalidations
   existantes de la page (["pipeline"]) couvrent aussi celle-ci.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { isGrade } from "@/lib/config/grades";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";
import { fetchDivisionsEquipe } from "@/lib/queries/recruiter/divisionsEquipe";

export interface AuteurUnite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport_id: string | null;
}

/** « Prénom Nom », ou « Recruteur » si le compte n'a pas de nom. */
export function nomAuteur(a: AuteurUnite | undefined | null): string {
  const n = `${a?.first_name ?? ""} ${a?.last_name ?? ""}`.trim();
  return n || "Recruteur";
}

/** Les recruteurs de l'unité (admin cégep : tout son cégep), par id. */
export function useAuteursUnite(enabled = true) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  return useQuery<Record<string, AuteurUnite>>({
    queryKey: ["unite-auteurs", userId],
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("unite_auteurs");
      if (error) throw error;
      const out: Record<string, AuteurUnite> = {};
      for (const a of (data ?? []) as AuteurUnite[]) out[a.id] = a;
      return out;
    },
  });
}

interface LigneUnite {
  athlete_id: string;
  unite_cegep_id: string | null;
  unite_sport_id: string | null;
  stage: string;
  moved_at: string | null;
  flagged: boolean | null;
  next_action_at: string | null;
  next_action_note: string | null;
  visit_at: string | null;
  recruteurs: string[] | null;
  ajoute_le: string | null;
}

export function useProcessusUnite(options: { enabled: boolean; sportId?: string | null; toutLeCegep?: boolean }) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const sportId = options.sportId ?? null;
  const tout = !!options.toutLeCegep;

  return useQuery<PipelineData>({
    queryKey: ["pipeline", "unite", userId, sportId, tout],
    enabled: !!userId && options.enabled,
    // Tableau PARTAGÉ : toujours périmé d'office — rechargé à chaque
    // affichage et au retour sur l'onglet (refetchOnWindowFocus, défaut).
    staleTime: 0,
    queryFn: async (): Promise<PipelineData> => {
      const supabase = createClient();
      const params = { p_sport_id: sportId, p_tout_le_cegep: tout };

      const [pipe, grades, auteurs] = await Promise.all([
        supabase.rpc("unite_pipeline", params),
        supabase.rpc("unite_grades", params),
        supabase.rpc("unite_auteurs"),
      ]);
      if (pipe.error) throw pipe.error;
      const parAuteur: Record<string, AuteurUnite> = {};
      for (const a of (auteurs.data ?? []) as AuteurUnite[]) parAuteur[a.id] = a;

      /* Tout le cégep (admin) : un même athlète peut être suivi par deux
         unités (deux sports). Une carte par athlète : on garde le dossier de
         l'unité de l'admin s'il existe, sinon le premier rendu. (Les dossiers
         d'un autre sport sont en lecture seule à cette étape — voir la page.) */
      const monSport = userId ? parAuteur[userId]?.sport_id ?? null : null;
      const parAthlete = new Map<string, LigneUnite>();
      for (const l of (pipe.data ?? []) as LigneUnite[]) {
        const deja = parAthlete.get(l.athlete_id);
        if (!deja || (deja.unite_sport_id !== monSport && l.unite_sport_id === monSport)) parAthlete.set(l.athlete_id, l);
      }
      const lignes = [...parAthlete.values()];
      const ids = lignes.map((l) => l.athlete_id);

      // Clé athlète × unité : en « tout le cégep », deux unités peuvent
      // grader le même athlète — la carte prend le grade de SON dossier.
      const gradeMap: Record<string, string> = {};
      for (const g of (grades.data ?? []) as { athlete_id: string; unite_sport_id: string | null; grade: string }[]) {
        if (isGrade(g.grade)) gradeMap[`${g.athlete_id}|${g.unite_sport_id ?? ""}`] = g.grade;
      }

      /* Dernière note de suivi par athlète, avec son auteur. Une erreur ne
         casse pas le processus : colonne vide plutôt que kanban blanc. */
      const noteMap: Record<string, { content: string; created_at: string; auteur: string }> = {};
      if (ids.length > 0) {
        const { data: notes, error } = await supabase
          .from("recruiter_notes")
          .select("athlete_id, content, created_at, recruiter_id")
          .in("athlete_id", ids)
          .order("created_at", { ascending: false });
        if (error) console.error("[useProcessusUnite] dernière note :", error.message);
        for (const n of (notes ?? []) as { athlete_id: string; content: string; created_at: string; recruiter_id: string }[]) {
          if (!noteMap[n.athlete_id]) {
            noteMap[n.athlete_id] = { content: n.content, created_at: n.created_at, auteur: nomAuteur(parAuteur[n.recruiter_id]) };
          }
        }
      }

      const sportDuDossier = new Map(lignes.map((l) => [l.athlete_id, l.unite_sport_id]));
      const [cardMap, divisions] = await Promise.all([
        fetchRecruiterAthleteCards(supabase, ids),
        fetchDivisionsEquipe(supabase, ids, (id) => sportDuDossier.get(id)),
      ]);

      const cards: PipelineKanbanCard[] = lignes.map((l) => {
        const card = cardMap.get(l.athlete_id) ?? null;
        const movedAt = l.moved_at ?? l.ajoute_le ?? null;
        const jours = movedAt ? Math.floor((Date.now() - new Date(movedAt).getTime()) / 86400000) : 0;
        const recruteurs = l.recruteurs ?? [];
        return {
          id: card?.id ?? l.athlete_id,
          /* En mode unité, une carte n'est la ligne de PERSONNE en particulier :
             toute écriture passe par unite_ecrire_dossier(athlete_id), qui
             écrit la ligne de l'acteur. L'identifiant de ligne n'a plus de
             sens ici — c'est l'athlète qui identifie le dossier. */
          pipeline_id: l.athlete_id,
          full_name: displayFullName(card),
          identityVisible: card?.identity_visible ?? false,
          photo_url: card?.photo_url ?? "",
          sport: card?.sport_nom ?? "",
          position: card?.position_abbr ?? "",
          school: card?.school_name ?? "",
          region: card?.school_region ?? "",
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
          status: (l.stage || "IDENTIFIE").toLowerCase() as RecruitmentStatus,
          days_in_status: jours,
          notes: "",
          last_activity: movedAt ? `Mis à jour il y a ${jours} jours` : "",
          flagged: !!l.flagged,
          next_action_at: l.next_action_at,
          next_action_note: l.next_action_note,
          visit_at: l.visit_at,
          moved_at: movedAt,
          noTeam: !card?.school_id,
          grade: (gradeMap[`${l.athlete_id}|${l.unite_sport_id ?? ""}`] as PipelineKanbanCard["grade"]) ?? null,
          taille_pieds: card?.taille_pieds ?? null,
          taille_pouces: card?.taille_pouces ?? null,
          poids_lbs: card?.poids_lbs ?? null,
          derniere_note: noteMap[l.athlete_id] ?? null,
          suivi_par: recruteurs,
          suivi_par_noms: recruteurs.map((id) => nomAuteur(parAuteur[id])),
          unite_sport_id: l.unite_sport_id,
          division_equipe: divisions[l.athlete_id] ?? null,
        } as PipelineKanbanCard;
      });

      /* Pas de « concurrents » en mode unité : les lignes lisibles d'autres
         recruteurs sont celles des COLLÈGUES, pas d'autres cégeps. */
      return { cards, competitorMap: {} };
    },
  });
}

/* ── Notes de suivi d'un athlète, signées (panneau) ───────────────── */
export interface NoteUnite {
  id: string;
  content: string;
  created_at: string;
  recruiter_id: string;
}

export function useNotesUnite(athleteId: string | null, enabled = true) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  return useQuery<NoteUnite[]>({
    queryKey: ["pipeline-notes", "unite", userId, athleteId],
    enabled: !!userId && !!athleteId && enabled,
    staleTime: 0,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_notes")
        .select("id, content, created_at, recruiter_id")
        .eq("athlete_id", athleteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoteUnite[];
    },
  });
}

/* ── Historique de l'unité pour un athlète (onglet du panneau) ───────
   Les GESTES du tableau blanc seulement : la même liste que la policy
   unite_journal_select. Les vues de profil et les notifications rangées dans
   la même table n'ont rien à faire dans un historique de dossier — même
   celles que l'admin cégep peut lire par ailleurs. */
export const GESTES_UNITE = [
  "PIPELINE_CHANGED", "FAVORITED", "UNFAVORITED", "NOTE_ADDED", "NOTE_UPDATED",
  "LIST_CREATED", "LIST_NOTE_ADDED", "ATHLETE_ADDED_TO_LIST", "ATHLETE_REMOVED_FROM_LIST",
] as const;

export interface GesteUnite {
  id: string;
  action_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  recruiter_id: string;
}

export function useHistoriqueUnite(athleteId: string | null, enabled = true) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  return useQuery<GesteUnite[]>({
    queryKey: ["pipeline-historique", userId, athleteId],
    enabled: !!userId && !!athleteId && enabled,
    staleTime: 0,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_activity_log")
        .select("id, action_type, details, created_at, recruiter_id")
        .eq("athlete_id", athleteId!)
        .in("action_type", GESTES_UNITE as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as GesteUnite[];
    },
  });
}
