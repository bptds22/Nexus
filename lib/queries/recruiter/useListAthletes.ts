/* ═══════════════════════════════════════════════════════════════
   useListAthletes — TanStack hook (iter 7.17 Sprint 2)
   Charge en UN round-trip :
    1. métadonnées de la liste (id, name, color)
    2. membres + champs athlètes pour la carte Pipeline-style
       (photo, nom, position, école, promo, cote, verified, status)
   Tri par added_at DESC (le plus récent ajout en premier).
   queryKey ["list-athletes", listId], staleTime 30s.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";

export interface ListMetadata {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export interface ListAthlete {
  /** id du row recruiter_list_members (pour DELETE cible) */
  memberId: string;
  /** id de l'athlète (pour navigation profil + UNIQUE pair clé) */
  athleteId: string;
  addedAt: string;
  /** Décision SERVEUR (identity_visible de la RPC). false = nom, photo et
   *  dossard sont ABSENTS de la réponse, pas juste cachés à l'écran. */
  identityVisible: boolean;
  /** Libellé déjà résolu — « Identité réservée » sous masquage. */
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  jersey: string | null;
  sportName: string | null;
  positionAbbr: string | null;
  schoolName: string | null;
  graduationYear: number | null;
  coachRating: number;
  isVerified: boolean;
  /** statut recrutement athlète (override last-write-wins) — ex IDENTIFIE, CONTACTE, ... */
  recruitmentStatus: string | null;
}

export interface UseListAthletesResult {
  list: ListMetadata | null;
  athletes: ListAthlete[];
  isLoading: boolean;
  error: Error | null;
  /** Stats agrégées client-side (identiques desktop). */
  stats: {
    total: number;
    verifiedCount: number;
    dominantSport: string | null;
    avgRating: number;
  };
}

/* La relation SEULE. L'embed `athletes(...)` a disparu : c'était une lecture
   directe de la table, exactement ce que le verrou RLS doit fermer, et elle
   ne pouvait appliquer aucune projection Loi 25. Il ne reste que le lien.

   AthleteJoin et pickOne() sont partis avec lui — la RPC projette à plat,
   il n'y a plus d'embed to-one à déballer (PostgREST le rendait tantôt
   objet, tantôt tableau à un élément selon la forme du select). */
interface ListRow {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  recruiter_list_members: Array<{
    id: string;
    added_at: string;
    athlete_id: string;
  }> | null;
}

function computeStats(athletes: ListAthlete[]) {
  const total = athletes.length;
  const verifiedCount = athletes.filter((a) => a.isVerified).length;
  let dominantSport: string | null = null;
  if (total > 0) {
    const counts = new Map<string, number>();
    athletes.forEach((a) => {
      if (!a.sportName) return;
      counts.set(a.sportName, (counts.get(a.sportName) ?? 0) + 1);
    });
    let topCount = 0;
    counts.forEach((c, s) => {
      if (c > topCount) { topCount = c; dominantSport = s; }
    });
  }
  const sumRating = athletes.reduce((s, a) => s + (a.coachRating || 0), 0);
  const avgRating = total > 0 ? Math.round((sumRating / total) * 10) / 10 : 0;
  return { total, verifiedCount, dominantSport, avgRating };
}

export function useListAthletes(listId: string | null): UseListAthletesResult {
  const query = useQuery<{ list: ListMetadata; athletes: ListAthlete[] } | null>({
    queryKey: ["list-athletes", listId],
    queryFn: async () => {
      if (!listId) return null;
      const supabase = createClient();

      /* Temps 1 — la relation SEULE (embed athletes retiré). */
      const { data, error } = await supabase
        .from("recruiter_lists")
        .select(`
          id, name, color, description,
          recruiter_list_members(id, added_at, athlete_id)
        `)
        .eq("id", listId)
        .order("added_at", { foreignTable: "recruiter_list_members", ascending: false })
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as ListRow;
      const list: ListMetadata = {
        id: row.id,
        name: row.name,
        color: row.color || "#E63946",
        description: row.description,
      };

      const members = row.recruiter_list_members ?? [];

      /* Temps 2 — les cartes projetées, résolues par lot. */
      const cardMap = await fetchRecruiterAthleteCards(
        supabase,
        members.map((m) => m.athlete_id),
      );

      const athletes: ListAthlete[] = members
        // La RPC ne rend AUCUNE ligne pour un athlète inactif ou supprimé.
        // On retire le membre plutôt que d'afficher une carte vide — c'est
        // ce que faisait déjà le `.filter(m => !!m.athletes)` sur l'embed,
        // qui tombait à null dans le même cas.
        .filter((m) => cardMap.has(m.athlete_id))
        .map((m): ListAthlete => {
          const card = cardMap.get(m.athlete_id)!;
          return {
            memberId: m.id,
            athleteId: m.athlete_id,
            addedAt: m.added_at,
            identityVisible: card.identity_visible,
            fullName: displayFullName(card),
            // Sous masquage le serveur rend NULL : `?? ""` garde le contrat
            // `string` sans jamais afficher "null".
            firstName: card.first_name ?? "",
            lastName: card.last_name ?? "",
            photoUrl: card.photo_url,
            jersey: card.numero_jersey != null && card.numero_jersey !== "" ? String(card.numero_jersey) : null,
            sportName: card.sport_nom,
            positionAbbr: card.position_abbr,
            schoolName: card.school_name,
            graduationYear: card.annee_diplomation,
            coachRating: Number(card.cote_globale ?? 0),
            isVerified: card.verified === true,
            recruitmentStatus: card.statut_recrutement_override,
          };
        });
      return { list, athletes };
    },
    enabled: !!listId,
    staleTime: 30 * 1000,
    // Iter 7.21 Section B — garde les données précédentes pendant le refetch.
    // Élimine le flash skeleton/name quand DetailInner re-mount (navigation
    // Index → détail) et quand une mutation invalide la query.
    placeholderData: (prev) => prev,
  });

  const athletes = query.data?.athletes ?? [];
  return {
    list: query.data?.list ?? null,
    athletes,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    stats: computeStats(athletes),
  };
}
