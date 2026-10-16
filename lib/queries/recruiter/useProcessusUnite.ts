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
     · processus_cartes / processus_dernieres_notes (2026-10-16) — TOUTES
       les cartes prospect, puis la dernière note de chaque carte et de
       chaque dossier : une valeur chacune, sans plafond ni identifiants dans
       l'adresse. Les notes arrivent par une seconde lecture, en parallèle :
       les cartes s'affichent sans les attendre (voir dernieresNotes).
   Aucune erreur n'est avalée : `error` / `notes.erreur`, et `reessayer`.

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

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { isGrade } from "@/lib/config/grades";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";
import { fetchEquipesAthletes } from "@/lib/queries/recruiter/divisionsEquipe";
import { lireCartes, lireDernieresNotesProcessus, versKanban } from "@/lib/cartes/carteProspect";
import { appliquerDernieresNotes, type EtatNotes, type NotesProcessus } from "@/lib/pipeline/dernieresNotes";

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

/** Ce que rend useProcessusUnite : les cartes (dès qu'elles sont lues), et
 *  l'état de la seconde lecture, celle des dernières notes. */
export interface ProcessusUnite {
  /** Cartes + dernières notes posées (ou leur état, voir dernieresNotes). */
  data: PipelineData | undefined;
  /** Première lecture des cartes en cours. */
  isLoading: boolean;
  /** Lecture des cartes en échec : l'écran l'affiche avec « Réessayer ». */
  error: Error | null;
  reessayer: () => void;
  notes: { etat: EtatNotes; erreur: Error | null; reessayer: () => void };
}

/** `avecNotes: false` : l'écran n'affiche aucune note (pipeline et tableau de
 *  bord mobiles) — la seconde lecture n'est pas faite du tout. */
export function useProcessusUnite(options: { enabled: boolean; sportId?: string | null; toutLeCegep?: boolean; avecNotes?: boolean }): ProcessusUnite {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const monCegep = currentUser?.profile.school_id ?? null;
  const sportId = options.sportId ?? null;
  const tout = !!options.toutLeCegep;
  const actif = !!userId && options.enabled;
  const avecNotes = options.avecNotes !== false;
  const monSportProfil = currentUser?.profile.sport_id ?? null;

  const cartesQ = useQuery<PipelineData>({
    queryKey: ["pipeline", "unite", userId, sportId, tout, monSportProfil],
    enabled: actif,
    // Lot C : cartes prospect incluses (même clé, même invalidation).
    // Tableau PARTAGÉ : toujours périmé d'office — rechargé à chaque
    // affichage et au retour sur l'onglet (refetchOnWindowFocus, défaut).
    staleTime: 0,
    queryFn: async (): Promise<PipelineData> => {
      const supabase = createClient();
      const params = { p_sport_id: sportId, p_tout_le_cegep: tout };

      /* Les cartes prospect partent DÈS LE DÉPART, en parallèle des lectures
         de l'unité (correctif 2026-10-16 : elles attendaient deux allers-retours
         de plus). Leur sport par défaut est celui de l'appelant
         (users.sport_id, le même que unite_auteurs rend pour lui). */
      const [[pipe, grades, auteurs], [lignesCartes, sportsRes]] = await Promise.all([
        Promise.all([
          supabase.rpc("unite_pipeline", params),
          supabase.rpc("unite_grades", params),
          supabase.rpc("unite_auteurs"),
        ]),
        Promise.all([
          lireCartes(supabase, { cegepId: monCegep, sportId: sportId ?? monSportProfil, toutLeCegep: tout }),
          supabase.from("sports").select("id, nom"),
        ]),
      ]);
      // Aucune erreur avalée (correctif 2026-10-16) : grades vides ou noms
      // « Recruteur » partout seraient des données fausses affichées sans un mot.
      if (pipe.error) throw pipe.error;
      if (grades.error) throw grades.error;
      if (auteurs.error) throw auteurs.error;
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

      /* Les dernières notes (dossiers ET cartes) ne sont PLUS lues ici :
         seconde lecture, lancée en même temps (notesQ plus bas) — les
         cartes s'affichent sans les attendre (correctif 2026-10-16). */

      const sportDuDossier = new Map(lignes.map((l) => [l.athlete_id, l.unite_sport_id]));
      const [cardMap, { divisions, ligues, equipes }] = await Promise.all([
        fetchRecruiterAthleteCards(supabase, ids),
        fetchEquipesAthletes(supabase, ids, (id) => sportDuDossier.get(id)),
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
          derniere_note: undefined,
          suivi_par: recruteurs,
          suivi_par_noms: recruteurs.map((id) => nomAuteur(parAuteur[id])),
          unite_sport_id: l.unite_sport_id,
          division_equipe: divisions[l.athlete_id] ?? null,
          ligue: ligues[l.athlete_id] ?? "",
          equipe: equipes[l.athlete_id] ?? null,
        } as PipelineKanbanCard;
      });

      /* CARTES PROSPECT (lot C) : les athlètes pas encore sur Nexus que
         l'unité suit. Converties au format d'un dossier (versKanban) : kanban,
         tableau, entonnoir et tuiles du tableau de bord les comptent sans
         savoir ce qu'elles sont. Même filtre de sport que les dossiers.
         TOUTES les cartes (processus_cartes, sans plafond). Une erreur de
         lecture est LEVÉE (correctif 2026-10-16) : un processus amputé de ses
         cartes sans un mot laissait croire qu'elles avaient disparu — l'écran
         affiche maintenant l'erreur et « Réessayer ». Lues dès le départ
         (plus haut), en parallèle des lectures de l'unité. */
      if (sportsRes.error) throw sportsRes.error;
      const nomsSports = new Map(((sportsRes.data ?? []) as { id: string; nom: string }[]).map((x) => [x.id, x.nom]));
      const cartes = lignesCartes.map((l) => {
        const k = versKanban(l, {
          nomSport: (id) => nomsSports.get(id) ?? "",
          nomAuteur: (id) => (id ? nomAuteur(parAuteur[id]) : "Recruteur"),
        });
        return { ...k, derniere_note: undefined } as PipelineKanbanCard;
      });

      /* Pas de « concurrents » en mode unité : les lignes lisibles d'autres
         recruteurs sont celles des COLLÈGUES, pas d'autres cégeps. */
      return { cards: [...cards, ...cartes], competitorMap: {} };
    },
  });

  /* DERNIÈRES NOTES (dossiers + cartes) : une seule lecture,
     processus_dernieres_notes — ni identifiants dans l'adresse, ni plafond.
     Lancée EN MÊME TEMPS que les cartes (elle n'en dépend pas) ; le sport
     des cartes est celui de l'appelant (users.sport_id) quand aucun n'est
     choisi, comme lireCartes plus haut et unite_pipeline en base. Même
     préfixe ["pipeline"] : les invalidations existantes la couvrent. */
  const notesQ = useQuery<NotesProcessus & { auteurs: Record<string, AuteurUnite> }>({
    queryKey: ["pipeline", "unite-notes", userId, sportId, tout],
    enabled: actif && avecNotes,
    staleTime: 0,
    queryFn: async () => {
      const supabase = createClient();
      // Les noms des auteurs avec les notes (unite_auteurs) : une note n'est
      // jamais affichée signée « Recruteur » le temps qu'ils arrivent.
      const [notes, auteursRes] = await Promise.all([
        lireDernieresNotesProcessus(supabase, { cegepId: monCegep, sportId: sportId ?? monSportProfil, toutLeCegep: tout }),
        supabase.rpc("unite_auteurs"),
      ]);
      if (auteursRes.error) throw auteursRes.error;
      const auteurs: Record<string, AuteurUnite> = {};
      for (const a of (auteursRes.data ?? []) as AuteurUnite[]) auteurs[a.id] = a;
      return { ...notes, auteurs };
    },
  });

  const etatNotes: EtatNotes = !avecNotes || notesQ.data ? "pret" : notesQ.isError ? "erreur" : "chargement";
  const brut = cartesQ.data;
  const notes = notesQ.data;
  const data = useMemo<PipelineData | undefined>(() => {
    if (!brut) return undefined;
    if (!avecNotes) return brut;
    const nom = (id: string | null) => (id ? nomAuteur(notes?.auteurs[id]) : "Recruteur");
    return { ...brut, cards: appliquerDernieresNotes(brut.cards, notes, etatNotes, nom) };
  }, [brut, notes, etatNotes, avecNotes]);

  const { refetch: relireCartes } = cartesQ;
  const { refetch: relireNotes } = notesQ;
  const reessayer = useCallback(() => { void relireCartes(); void relireNotes(); }, [relireCartes, relireNotes]);
  const reessayerNotes = useCallback(() => { void relireNotes(); }, [relireNotes]);

  return {
    data,
    isLoading: cartesQ.isLoading,
    error: cartesQ.error,
    reessayer,
    notes: { etat: etatNotes, erreur: notesQ.error, reessayer: reessayerNotes },
  };
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
  // Carte des matchs (migration 4) : sans athlète, donc jamais dans l'historique
  // d'un dossier — seulement dans le fil de l'unité.
  "MATCH_AJOUTE", "MATCH_RETIRE",
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
