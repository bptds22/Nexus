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

interface ListRow {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  recruiter_list_members: Array<{
    id: string;
    added_at: string;
    athlete_id: string;
    athletes:
      | AthleteJoin
      | AthleteJoin[]
      | null;
  }> | null;
}

interface AthleteJoin {
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | number | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  cote_globale_entraineur: number | null;
  statut_recrutement_override: string | null;
  sports: { nom: string | null } | { nom: string | null }[] | null;
  positions: { abreviation: string | null } | { abreviation: string | null }[] | null;
  schools: { name: string | null } | { name: string | null }[] | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
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
      const { data, error } = await supabase
        .from("recruiter_lists")
        .select(`
          id, name, color, description,
          recruiter_list_members(
            id, added_at, athlete_id,
            athletes(
              first_name, last_name, photo_url, numero_jersey, annee_diplomation,
              verified, cote_globale_entraineur, statut_recrutement_override,
              sports!sport_id(nom),
              positions!position_id(abreviation),
              schools!school_id(name)
            )
          )
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
      const athletes: ListAthlete[] = (row.recruiter_list_members ?? [])
        .filter((m) => !!m.athletes)
        .map((m): ListAthlete => {
          const ath = pickOne(m.athletes) as AthleteJoin;
          const sport = pickOne(ath.sports);
          const pos = pickOne(ath.positions);
          const school = pickOne(ath.schools);
          return {
            memberId: m.id,
            athleteId: m.athlete_id,
            addedAt: m.added_at,
            firstName: ath.first_name ?? "",
            lastName: ath.last_name ?? "",
            photoUrl: ath.photo_url,
            jersey: ath.numero_jersey != null && ath.numero_jersey !== "" ? String(ath.numero_jersey) : null,
            sportName: sport?.nom ?? null,
            positionAbbr: pos?.abreviation ?? null,
            schoolName: school?.name ?? null,
            graduationYear: ath.annee_diplomation,
            coachRating: Number(ath.cote_globale_entraineur ?? 0),
            isVerified: ath.verified === true,
            recruitmentStatus: ath.statut_recrutement_override,
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
