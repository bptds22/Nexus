/* ═══════════════════════════════════════════════════════════════
   useListesUnite — les LISTES de l'unité (lot B2, étape 2, web).

   Décision BP 2026-09-24 : les listes appartiennent à l'unité (cégep ×
   sport). Tous les Pro de l'unité les voient et les modifient ; chaque liste
   garde son auteur, chaque membre qui l'a ajouté (added_by, imposé par
   trigger au lot B1), chaque note de liste son auteur.

   La RLS décide de ce qui est lisible (policies unite_* avec Pro, B2-0) : on
   ne filtre plus par recruiter_id. On garde en revanche SON unité seulement :
   l'admin cégep lit par la RLS toutes les listes de son cégep, mais les
   autres sports relèvent de l'étape 3 (registre §39–40) — ici, un admin voit
   les listes de son sport, comme ses collègues.

   Web seulement : l'app 1.4.3 garde useRecruiterLists (ses propres listes)
   jusqu'à la 1.4.4 (registre §38).

   Clés sous les préfixes ["recruiter-lists"] et ["list-notes"] : dans la
   liste tableauBlanc.ts, donc jamais persistées, et invalidées par toute
   écriture d'unité (invaliderTableauBlanc).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import { nomAuteur, type AuteurUnite } from "@/lib/queries/recruiter/useProcessusUnite";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import type { ProspectList, ProspectListAthlete } from "@/app/recruteur/listes/_data/mockListsData";
import { lireCartesParIds, versMembreListe } from "@/lib/cartes/carteProspect";

interface LigneListe {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  recruiter_id: string;
  unite_cegep_id: string | null;
  unite_sport_id: string | null;
}

interface LigneMembre {
  list_id: string;
  athlete_id: string;
  added_at: string;
  added_by: string | null;
}

export function useListesUnite(enabled = true) {
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const monCegep = currentUser?.profile.school_id ?? null;

  return useQuery<ProspectList[]>({
    queryKey: ["recruiter-lists", "unite", moi],
    enabled: !!moi && enabled,
    // Tableau PARTAGÉ : rechargé à chaque affichage et au retour sur l'onglet.
    staleTime: 0,
    queryFn: async () => {
      const supabase = createClient();
      const [listesRes, auteursRes] = await Promise.all([
        supabase
          .from("recruiter_lists")
          .select("id, name, description, created_at, updated_at, recruiter_id, unite_cegep_id, unite_sport_id")
          .order("updated_at", { ascending: false }),
        supabase.rpc("unite_auteurs"),
      ]);
      if (listesRes.error) throw listesRes.error;
      if (auteursRes.error) throw auteursRes.error;
      const auteurs: Record<string, AuteurUnite> = {};
      for (const a of (auteursRes.data ?? []) as AuteurUnite[]) auteurs[a.id] = a;
      const monSport = moi ? auteurs[moi]?.sport_id ?? null : null;

      // Les siennes (unité ou pas), et celles de SON unité.
      const listes = ((listesRes.data ?? []) as LigneListe[]).filter(
        (l) =>
          l.recruiter_id === moi ||
          (!!monCegep && !!monSport && l.unite_cegep_id === monCegep && l.unite_sport_id === monSport),
      );

      const ids = listes.map((l) => l.id);
      let membres: LigneMembre[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("recruiter_list_members")
          .select("list_id, athlete_id, added_at, added_by")
          .in("list_id", ids);
        if (error) throw error;
        membres = (data ?? []) as LigneMembre[];
      }

      const cartes = await fetchRecruiterAthleteCards(supabase, [...new Set(membres.map((m) => m.athlete_id))]);

      /* CARTES PROSPECT dans les listes (lot C, retour BP) : liaison à part,
         cartes_prospect_listes. Une erreur de lecture laisse les athlètes. */
      let liaisons: { list_id: string; carte_id: string; created_at: string; ajoute_par: string | null }[] = [];
      let cartesProspect = new Map<string, Awaited<ReturnType<typeof lireCartesParIds>>[number]>();
      const nomsSports = new Map<string, string>();
      if (ids.length > 0) {
        try {
          const { data, error } = await supabase
            .from("cartes_prospect_listes")
            .select("list_id, carte_id, created_at, ajoute_par")
            .in("list_id", ids);
          if (error) throw error;
          liaisons = (data ?? []) as typeof liaisons;
          const lues = await lireCartesParIds(supabase, [...new Set(liaisons.map((l) => l.carte_id))]);
          cartesProspect = new Map(lues.map((c) => [c.id, c]));
          // Le sport DE L'ATHLÈTE (décision BP 2026-10-05) — pas celui de
          // l'unité, qui peut désormais différer d'une carte à l'autre.
          const sports = [...new Set(lues.map((c) => c.sport_athlete_id))];
          if (sports.length > 0) {
            const { data: s } = await supabase.from("sports").select("id, nom").in("id", sports);
            for (const x of (s ?? []) as { id: string; nom: string }[]) nomsSports.set(x.id, x.nom);
          }
        } catch (e) {
          console.error("[useListesUnite] cartes prospect :", e instanceof Error ? e.message : String(e));
        }
      }

      return listes.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description || "",
        created_at: l.created_at,
        updated_at: l.updated_at,
        recruiter_id: l.recruiter_id,
        auteur: nomAuteur(auteurs[l.recruiter_id]),
        unite_sport_id: l.unite_sport_id,
        athletes: [...membres
          .filter((m) => m.list_id === l.id)
          .map((m): ProspectListAthlete | null => {
            const card = cartes.get(m.athlete_id);
            if (!card) return null;
            return {
              id: card.id,
              identity_visible: card.identity_visible,
              full_name: displayFullName(card),
              photo_url: card.photo_url ?? "",
              jersey: card.numero_jersey != null && card.numero_jersey !== "" ? String(card.numero_jersey) : "",
              sport: card.sport_nom ?? "",
              position: card.position_abbr ?? "",
              school: card.school_name ?? "",
              division: "D1",
              graduation_year: card.annee_diplomation ?? 0,
              coach_rating: card.cote_globale ?? 0,
              is_verified: !!card.verified,
              pipeline_status: (card.recruitment_status || "OUVERT").toLowerCase() as RecruitmentStatus,
              added_at: m.added_at,
              recruiter_note: "",
              priority: false,
              ajoute_par: m.added_by ? nomAuteur(auteurs[m.added_by]) : undefined,
            };
          })
          .filter((a): a is ProspectListAthlete => a !== null),
          ...liaisons
            .filter((x) => x.list_id === l.id && cartesProspect.has(x.carte_id))
            .map((x): ProspectListAthlete => {
              const c = cartesProspect.get(x.carte_id)!;
              return {
                ...versMembreListe(c, nomsSports.get(c.sport_athlete_id) ?? ""),
                added_at: x.created_at,
                ajoute_par: x.ajoute_par ? nomAuteur(auteurs[x.ajoute_par]) : undefined,
              };
            }),
        ].sort((a, b) => (b.added_at || "").localeCompare(a.added_at || "")),
      }));
    },
  });
}

/* ── Notes d'une liste, signées ───────────────────────────────────
   Toutes les notes de la liste (la RLS rend celles de l'unité à un Pro).
   Celles des collègues se lisent sans se modifier (décision BP 2 — la base
   le permettrait, l'interface ne l'offre pas). */
export interface NoteListe {
  id: string;
  content: string;
  created_at: string;
  recruiter_id: string;
}

export function useNotesListeUnite(listId: string | null) {
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  return useQuery<NoteListe[]>({
    queryKey: ["list-notes", "unite", moi, listId],
    enabled: !!moi && !!listId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("recruiter_list_notes")
        .select("id, content, created_at, recruiter_id")
        .eq("list_id", listId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoteListe[];
    },
  });
}
