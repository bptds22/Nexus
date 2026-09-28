/* ═══════════════════════════════════════════════════════════════
   useCalendrierUnite — le calendrier de l'UNITÉ (lot B2, étape 3, web).

   Décision BP 2026-09-28 : pour un Pro, le calendrier montre
   · les matchs des athlètes suivis par l'UNITÉ (cégep × sport) — processus,
     favoris, listes —, qu'ils aient été ajoutés par soi ou par un collègue ;
   · les VISITES PLANIFIÉES de toute l'unité, comme événements ;
   · les RELANCES de l'unité, à leur date d'échéance (next_action_at) —
     en retard comprises : ce sont celles qui appellent un geste.

   Sources (toutes filtrées par la RLS, Pro exigé) :
     · unite_pipeline()  — une ligne par athlète : étape, visite, qui suit ;
     · unite_favoris()   — une ligne par athlète ;
     · recruiter_lists / recruiter_list_members — les siennes et celles de
       SON unité (même filtre que useListesUnite).
   Puis la même construction que le calendrier d'avant
   (construireCalendrier). Les équipes des athlètes suivis par un collègue
   sont lisibles grâce à la policy unite_equipes_suivies (migration
   b2_3_unite_journal_calendrier) ; sans elle, ces athlètes n'auraient pas
   d'équipe, donc pas de match.

   Admin cégep : son sport seulement, comme ses collègues (les autres sports
   se lisent dans Mon CÉGEP).

   Web seulement : l'app 1.4.3 garde useRecruitingCalendar (registre §38).
   Clé sous ["recruiting-calendar"] : dans tableauBlanc.ts.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import { nomAuteur, type AuteurUnite } from "@/lib/queries/recruiter/useProcessusUnite";
import { construireCalendrier, type RecruitingCalendarData, type CalendarTarget } from "@/lib/queries/recruiter/useRecruitingCalendar";
import { lireCartes } from "@/lib/cartes/carteProspect";

/** Une visite planifiée de l'unité (recruiter_pipeline.visit_at). */
export interface VisiteUnite {
  athleteId: string;
  identityVisible: boolean;
  fullName: string;
  /** timestamptz ISO. */
  visitAt: string;
  /** Jour local "YYYY-MM-DD", pour la grille du mois. */
  jour: string;
  stage: string;
  /** Qui suit le dossier, par nom (« Suivi par »). */
  suiviPar: string[];
  /** Carte prospect (lot C) : pas de fiche Nexus à ouvrir. */
  prospect?: boolean;
}

/** Une relance de l'unité (recruiter_pipeline.next_action_at). */
export interface RelanceUnite {
  athleteId: string;
  identityVisible: boolean;
  fullName: string;
  /** Échéance, jour "YYYY-MM-DD" (next_action_at est une date). */
  jour: string;
  note: string;
  stage: string;
  /** Échéance passée : la relance est en retard. */
  enRetard: boolean;
  suiviPar: string[];
  /** Carte prospect (lot C) : pas de fiche Nexus à ouvrir. */
  prospect?: boolean;
}

export interface CalendrierUniteData extends RecruitingCalendarData {
  visites: VisiteUnite[];
  relances: RelanceUnite[];
}

interface LigneUnite {
  athlete_id: string;
  stage: string | null;
  visit_at: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
  recruteurs: string[] | null;
}

/** "YYYY-MM-DD" en temps local — une visite à 20 h le 12 reste le 12. */
export function jourLocal(iso: string): string {
  const d = new Date(iso);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useCalendrierUnite(enabled: boolean) {
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const monCegep = currentUser?.profile.school_id ?? null;

  return useQuery<CalendrierUniteData>({
    queryKey: ["recruiting-calendar", "unite", moi],
    enabled: enabled && !!moi,
    // Tableau PARTAGÉ : rechargé à chaque affichage et au retour sur l'onglet.
    staleTime: 0,
    queryFn: async () => {
      const supabase = createClient();
      const [pipeRes, favRes, listesRes, auteursRes] = await Promise.all([
        supabase.rpc("unite_pipeline"),
        supabase.rpc("unite_favoris"),
        supabase.from("recruiter_lists").select("id, recruiter_id, unite_cegep_id, unite_sport_id"),
        supabase.rpc("unite_auteurs"),
      ]);
      if (pipeRes.error) throw pipeRes.error;
      if (favRes.error) throw favRes.error;
      if (listesRes.error) throw listesRes.error;
      const auteurs: Record<string, AuteurUnite> = {};
      for (const a of (auteursRes.data ?? []) as AuteurUnite[]) auteurs[a.id] = a;
      const monSport = moi ? auteurs[moi]?.sport_id ?? null : null;

      // Les listes : les siennes, et celles de SON unité (cf. useListesUnite).
      const listIds = ((listesRes.data ?? []) as { id: string; recruiter_id: string; unite_cegep_id: string | null; unite_sport_id: string | null }[])
        .filter((l) => l.recruiter_id === moi
          || (!!monCegep && !!monSport && l.unite_cegep_id === monCegep && l.unite_sport_id === monSport))
        .map((l) => l.id);
      let membres: { athlete_id: string; list_id: string }[] = [];
      if (listIds.length > 0) {
        const { data, error } = await supabase
          .from("recruiter_list_members")
          .select("athlete_id, list_id")
          .in("list_id", listIds);
        if (error) throw error;
        membres = (data ?? []) as { athlete_id: string; list_id: string }[];
      }

      const lignes = (pipeRes.data ?? []) as LigneUnite[];
      const stageByAthlete = new Map<string, string>();
      for (const l of lignes) if (l.stage) stageByAthlete.set(l.athlete_id, l.stage);
      const listsByAthlete = new Map<string, string[]>();
      for (const m of membres) listsByAthlete.set(m.athlete_id, [...(listsByAthlete.get(m.athlete_id) ?? []), m.list_id]);

      const targetIds = Array.from(new Set<string>([
        ...lignes.map((l) => l.athlete_id),
        ...((favRes.data ?? []) as { athlete_id: string }[]).map((f) => f.athlete_id),
        ...membres.map((m) => m.athlete_id),
      ]));

      /* CARTES PROSPECT de l'unité (lot C) : les matchs de leur équipe, leurs
         visites et leurs relances, marqués « prospect ». Une erreur de
         lecture laisse le calendrier des athlètes Nexus intact. */
      let cartesProspect: Awaited<ReturnType<typeof lireCartes>> = [];
      try {
        cartesProspect = await lireCartes(supabase, { cegepId: monCegep, sportId: monSport });
      } catch (e) {
        console.error("[useCalendrierUnite] cartes prospect :", e instanceof Error ? e.message : String(e));
      }
      const listesParCarte = new Map<string, string[]>();
      if (cartesProspect.length > 0 && listIds.length > 0) {
        const { data } = await supabase
          .from("cartes_prospect_listes")
          .select("carte_id, list_id")
          .in("list_id", listIds);
        for (const m of (data ?? []) as { carte_id: string; list_id: string }[]) {
          listesParCarte.set(m.carte_id, [...(listesParCarte.get(m.carte_id) ?? []), m.list_id]);
        }
      }
      const nomSportUnite = monSport && cartesProspect.length > 0
        ? ((await supabase.from("sports").select("nom").eq("id", monSport).maybeSingle()).data?.nom as string | undefined) ?? ""
        : "";
      const ciblesCartes: CalendarTarget[] = cartesProspect
        .filter((c) => !!c.team_id)
        .map((c) => ({
          athleteId: c.id,
          identityVisible: true,
          fullName: `${c.prenom} ${c.nom}`.trim(),
          firstName: c.prenom,
          lastName: c.nom,
          initials: `${c.prenom.charAt(0)}${c.nom.charAt(0)}`.toUpperCase(),
          photo: "",
          sport: nomSportUnite.toLowerCase().replace(/ /g, "_"),
          sportName: nomSportUnite,
          position: c.positions?.abreviation ?? "",
          graduationYear: c.promotion ?? 0,
          region: c.teams?.schools?.region ?? "",
          school: c.teams?.schools?.name ?? "",
          verified: false,
          hasVideo: !!c.lien_video,
          stars: 0,
          gpa: 0,
          orgType: (c.teams?.schools?.type === "LIGUE_CIVILE" ? "ligue_civile" : "scolaire") as "scolaire" | "ligue_civile",
          pipelineStage: c.etape,
          listIds: listesParCarte.get(c.id) ?? [],
          teamId: c.team_id!,
          teamName: c.teams?.name ?? "",
          prospect: true,
        }));

      const base = await construireCalendrier(supabase, targetIds, stageByAthlete, listsByAthlete, ciblesCartes);

      /* Visites À VENIR de l'unité (à partir d'aujourd'hui, 0 h locale). */
      const debut = new Date();
      debut.setHours(0, 0, 0, 0);
      const avecVisite = lignes.filter((l) => l.visit_at && new Date(l.visit_at) >= debut);
      const avecRelance = lignes.filter((l) => !!l.next_action_at);
      const aNommer = Array.from(new Set([...avecVisite, ...avecRelance].map((l) => l.athlete_id)));
      const cartes = aNommer.length > 0
        ? await fetchRecruiterAthleteCards(supabase, aNommer)
        : new Map();
      const visites: VisiteUnite[] = avecVisite
        .map((l) => {
          const card = cartes.get(l.athlete_id) ?? null;
          return {
            athleteId: l.athlete_id,
            identityVisible: card?.identity_visible ?? false,
            fullName: displayFullName(card),
            visitAt: l.visit_at!,
            jour: jourLocal(l.visit_at!),
            stage: (l.stage || "VISITE_PLANIFIEE").toUpperCase(),
            suiviPar: (l.recruteurs ?? []).map((id) => nomAuteur(auteurs[id])),
          };
        })
        .sort((a, b) => a.visitAt.localeCompare(b.visitAt));

      /* Relances : toutes celles qui ont une échéance, en retard comprises. */
      const aujourdhui = jourLocal(new Date().toISOString());
      const relances: RelanceUnite[] = avecRelance
        .map((l) => {
          const card = cartes.get(l.athlete_id) ?? null;
          const jour = l.next_action_at!.slice(0, 10);
          return {
            athleteId: l.athlete_id,
            identityVisible: card?.identity_visible ?? false,
            fullName: displayFullName(card),
            jour,
            note: (l.next_action_note ?? "").trim(),
            stage: (l.stage || "IDENTIFIE").toUpperCase(),
            enRetard: jour < aujourdhui,
            suiviPar: (l.recruteurs ?? []).map((id) => nomAuteur(auteurs[id])),
          };
        })
        .sort((a, b) => a.jour.localeCompare(b.jour));

      // Visites et relances des cartes prospect, dans les mêmes listes.
      const nomCreateur = (id: string | null) => (id ? nomAuteur(auteurs[id]) : "Recruteur");
      for (const c of cartesProspect) {
        const fullName = `${c.prenom} ${c.nom}`.trim();
        if (c.visite_le && new Date(c.visite_le) >= debut) {
          visites.push({
            athleteId: c.id, identityVisible: true, fullName, visitAt: c.visite_le, jour: jourLocal(c.visite_le),
            stage: c.etape, suiviPar: [nomCreateur(c.cree_par)], prospect: true,
          });
        }
        if (c.relance_le) {
          relances.push({
            athleteId: c.id, identityVisible: true, fullName, jour: c.relance_le.slice(0, 10),
            note: (c.relance_note ?? "").trim(), stage: c.etape, enRetard: c.relance_le.slice(0, 10) < aujourdhui,
            suiviPar: [nomCreateur(c.cree_par)], prospect: true,
          });
        }
      }
      visites.sort((a, b) => a.visitAt.localeCompare(b.visitAt));
      relances.sort((a, b) => a.jour.localeCompare(b.jour));

      return { ...base, visites, relances };
    },
  });
}
