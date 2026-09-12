/* ═══════════════════════════════════════════════════════════════
   useCoachTeamDetail — TanStack hook for the team detail screen.

   Mirrors the desktop /coach/equipes/[teamId] load() shape : team
   header + role check + coaches + athletes + pending invitations.
   Returns null when the team is missing or the current user isn't
   a coach on it (mobile screen renders an empty state ; routing
   redirect happens at the caller).

   Cache key : ["coach-team", teamId]. Mutations (add/remove coach,
   add/remove athlete, update info, cancel invite) invalidate it.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { isCivilType, type SchoolType } from "@/lib/utils/orgLabel";
import { isReferentRole } from "@/lib/coach/teamRoles";

export interface CoachTeamDetailHeader {
  id: string;
  name: string;
  ageGroup: string;
  division: string;
  league: string;
  season: string;
  gender: string;
  sportName: string;
  sportId: string;
  schoolId: string;
  schoolName: string;
  schoolType: SchoolType | null;
  isCivil: boolean;
  isActive: boolean;
  myRole: "ADMIN" | "COACH";
  /** L'ajout et le retrait d'entraîneurs passent-ils la RLS pour cet usager ?
   *
   *  DISTINCT de `myRole`, et c'est délibéré. Un entraîneur-chef PAR INTÉRIM
   *  est un responsable à part entière — l'index unique
   *  `team_coaches_one_referent_per_team` le range avec `head_coach`, et
   *  REFERENT_ROLES aussi. Mais la RLS, elle, ne le sait pas encore : les
   *  politiques INSERT/DELETE de `team_coaches` passent par
   *  `is_team_head_coach()`, qui teste `role = 'head_coach'` tout court.
   *
   *  Le changement de rôle, lui, passe : la politique UPDATE a une branche
   *  école (`users.school_id = team.school_id`) que l'intérimaire satisfait.
   *
   *  Donc : le select de rôle s'affiche pour un intérimaire, mais « Ajouter »
   *  et « Retirer » restent masqués — un contrôle qui échoue est pire qu'un
   *  contrôle absent. Ce drapeau disparaîtra quand `is_team_head_coach()`
   *  nommera REFERENT_ROLES (prévu au lot migration, cf.
   *  docs/fast-follow-1.4.2.md). */
  /** Peut AJOUTER un entraîneur. Référents (titulaire ET intérimaire) +
   *  direction. S'appuie sur `is_team_head_coach()`, que le volet 3 de D6
   *  élargit aux REFERENT_ROLES. */
  canAddStaff: boolean;
  /** Peut RETIRER un entraîneur. DIRECTION SEULE — la policy DELETE de
   *  `team_coaches` ne connaît pas `is_team_head_coach`. Décision produit
   *  assumée, pas une limitation temporaire. */
  canRemoveStaff: boolean;
}

export interface CoachTeamDetailCoach {
  id: string;
  coachId: string;
  name: string;
  role: string;
}

export interface CoachTeamDetailAthlete {
  /** team_athletes.id (junction row, used for delete). */
  id: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  name: string;
  /** Canonical athlete photo (athletes.photo_url). Same field the
   *  /coach/athletes roster surfaces ; empty string = fall back to
   *  initials. */
  photoUrl: string;
  position: string;
  verified: boolean;
  region: string;
  taillePieds: number | null;
  taillePouces: number | null;
  poidsLbs: number | null;
  anneeDiplomation: number | null;
  cote: number | null;
  recruitmentStatus: GlobalRecruitmentStatus | null;
  committedSchoolName: string | null;
  openToOffers: boolean | null;
  school: string;
}

export interface CoachTeamDetailInvitation {
  id: string;
  athleteId: string;
  athleteName: string;
  position: string;
  createdAt: string;
}

export interface CoachTeamDetailResult {
  team: CoachTeamDetailHeader;
  coaches: CoachTeamDetailCoach[];
  athletes: CoachTeamDetailAthlete[];
  pendingInvitations: CoachTeamDetailInvitation[];
}

export function useCoachTeamDetail(teamId: string | null | undefined) {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<CoachTeamDetailResult | null>({
    queryKey: ["coach-team", teamId],
    queryFn: async () => {
      if (!teamId || !userId) return null;
      const supabase = createClient();

      const { data: t } = await supabase
        .from("teams")
        .select(`
          name, age_group, division, league, season, gender, is_active,
          school_id, sport_id,
          sports!sport_id(nom),
          schools!school_id(name, type)
        `)
        .eq("id", teamId)
        .maybeSingle();
      if (!t) return null;

      const { data: roleRow } = await supabase
        .from("team_coaches")
        .select("role")
        .eq("team_id", teamId)
        .eq("coach_id", userId)
        .order("role")
        .limit(1)
        .maybeSingle();
      if (!roleRow) return null;

      const tRec = t as Record<string, unknown>;
      const sportRel = tRec.sports as { nom?: string } | { nom?: string }[] | null;
      const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
      const schoolRel = tRec.schools as { name?: string; type?: string } | { name?: string; type?: string }[] | null;
      const schoolRow = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;
      const schoolType = (schoolRow?.type as SchoolType | undefined) ?? null;
      const rawRole = (roleRow as { role?: string } | null)?.role;
      /* `isReferentRole` plutôt qu'une énumération à la main : elle nomme
         head_coach ET head_coach_interim, comme l'index unique en base. La
         version précédente listait « head_coach » seul et rangeait donc un
         intérimaire parmi les simples entraîneurs — écran en lecture seule
         pour le responsable de l'équipe. Une liste blanche vérifiée par
         énumération laisse passer ce qu'elle n'a pas nommé. */
      const myRole: "ADMIN" | "COACH" = isReferentRole(rawRole) || rawRole === "ADMIN" ? "ADMIN" : "COACH";
      /* ── DEUX DROITS, PAS UN — décision BP, 2026-09-12 (règle 11) ────────
         `canManageStaff` mélangeait « ajouter » et « retirer ». Ce sont deux
         politiques différentes en base, et elles ne bougeront pas ensemble :

         · AJOUTER  → policy `team_coaches scoped insert`, qui s'appuie sur
           `is_team_head_coach()`. Le volet 3 de D6 élargit cette fonction aux
           REFERENT_ROLES (head_coach + head_coach_interim) : l'intérimaire
           gagnera donc ce droit, et `canAddStaff` s'ouvrira avec lui — SANS
           retoucher ce fichier, puisqu'il lit déjà `isReferentRole`.

         · RETIRER  → policy DELETE de `team_coaches`, qui ne mentionne
           `is_team_head_coach` NULLE PART :
               coach_id = auth.uid() OR is_director_of_team_school(team_id) OR is_admin()
           Autrement dit : même un entraîneur-chef TITULAIRE ne peut retirer
           personne d'autre que lui-même. Le retrait de staff appartient à la
           DIRECTION — décision produit assumée (BP, 2026-09-12), pas un oubli.
           Le volet 3 ne l'élargit pas et ne doit pas l'élargir.

         Les garder fusionnés affichait le ✕ à un chef titulaire dont la base
         refusait le geste : un contrôle mort, qui échoue au moment du clic.
         Jamais de contrôle mort — c'est la règle qui motive la scission. */
      const canAddStaff    = isReferentRole(rawRole) || rawRole === "ADMIN";
      const canRemoveStaff = rawRole === "ADMIN";

      const header: CoachTeamDetailHeader = {
        id: teamId,
        name: (tRec.name as string) || "",
        ageGroup: (tRec.age_group as string) || "",
        division: (tRec.division as string) || "",
        league: (tRec.league as string) || "",
        season: (tRec.season as string) || "",
        gender: (tRec.gender as string) || "",
        sportName: sport?.nom || "",
        sportId: (tRec.sport_id as string) || "",
        schoolId: (tRec.school_id as string) || "",
        schoolName: schoolRow?.name || "",
        schoolType,
        isCivil: isCivilType(schoolType),
        isActive: (tRec.is_active as boolean) ?? true,
        myRole,
        canAddStaff,
        canRemoveStaff,
      };

      const { data: tc } = await supabase
        .from("team_coaches")
        .select("id, coach_id, role")
        .eq("team_id", teamId);
      const tcRows = (tc as { id: string; coach_id: string; role: string }[]) || [];
      const coachIds = tcRows.map((c) => c.coach_id).filter(Boolean);
      const nameMap = new Map<string, string>();
      if (coachIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", coachIds);
        for (const u of (users || []) as { id: string; first_name?: string; last_name?: string }[]) {
          nameMap.set(u.id, `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Coach");
        }
      }
      const coaches: CoachTeamDetailCoach[] = tcRows.map((c) => ({
        id: c.id,
        coachId: c.coach_id,
        name: nameMap.get(c.coach_id) || "Coach",
        role: c.role,
      }));

      const { data: ta } = await supabase
        .from("team_athletes")
        .select(`
          id, athlete_id,
          athletes!athlete_id(
            id, first_name, last_name, photo_url, verified,
            position_id, positions!position_id(abreviation),
            statut_recrutement_override, open_to_offers,
            committed_school_id, committed_school:schools!committed_school_id(name),
            annee_diplomation, taille_pieds, taille_pouces, poids_lbs,
            cote_globale_entraineur,
            school_id, schools!school_id(name, region, type),
            user_id, users!athletes_user_id_fkey(region)
          )
        `)
        .eq("team_id", teamId);
      const athletes: CoachTeamDetailAthlete[] = ((ta as Record<string, unknown>[]) || []).map((a) => {
        const athleteRel = a.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
        const ath = (Array.isArray(athleteRel) ? athleteRel[0] : athleteRel) as Record<string, unknown> | null;
        const posRel = ath?.positions as { abreviation?: string } | { abreviation?: string }[] | null;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        const schoolRel2 = ath?.schools as { name?: string; region?: string; type?: string } | { name?: string; region?: string; type?: string }[] | null;
        const athleteSchool = Array.isArray(schoolRel2) ? schoolRel2[0] : schoolRel2;
        const committedRel = ath?.committed_school as { name?: string } | { name?: string }[] | null;
        const committed = Array.isArray(committedRel) ? committedRel[0] : committedRel;
        const userRel = ath?.users as { region?: string } | { region?: string }[] | null;
        const userRow = Array.isArray(userRel) ? userRel[0] : userRel;
        const firstName = (ath?.first_name as string) || "";
        const lastName = (ath?.last_name as string) || "";
        const schoolIsCivil = athleteSchool?.type === "LIGUE_CIVILE";
        const region = schoolIsCivil
          ? (userRow?.region || "")
          : (athleteSchool?.region || userRow?.region || "");
        const schoolSubLine = schoolIsCivil ? "" : (athleteSchool?.name || "");
        return {
          id: a.id as string,
          athleteId: (ath?.id as string) || (a.athlete_id as string),
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          photoUrl: (ath?.photo_url as string | null) || "",
          position: pos?.abreviation || "",
          verified: ath?.verified === true,
          region,
          taillePieds: (ath?.taille_pieds as number | null | undefined) ?? null,
          taillePouces: (ath?.taille_pouces as number | null | undefined) ?? null,
          poidsLbs: (ath?.poids_lbs as number | null | undefined) ?? null,
          anneeDiplomation: typeof ath?.annee_diplomation === "number" ? (ath.annee_diplomation as number) : null,
          cote: typeof ath?.cote_globale_entraineur === "number" ? (ath.cote_globale_entraineur as number) : null,
          recruitmentStatus: ((ath?.statut_recrutement_override as string | null) ?? null) as GlobalRecruitmentStatus | null,
          committedSchoolName: committed?.name || null,
          openToOffers: (ath?.open_to_offers as boolean | null) ?? null,
          school: schoolSubLine,
        };
      });

      const { data: pending } = await supabase
        .from("team_invitations")
        .select(`
          id, created_at,
          athletes!athlete_id(
            id, first_name, last_name,
            position_id, positions!position_id(abreviation)
          )
        `)
        .eq("team_id", teamId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false });
      const pendingInvitations: CoachTeamDetailInvitation[] = ((pending as Record<string, unknown>[]) || []).map((row) => {
        const athleteRel = row.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
        const athlete = (Array.isArray(athleteRel) ? athleteRel[0] : athleteRel) ?? {};
        const posRel = (athlete as Record<string, unknown>).positions as { abreviation?: string } | { abreviation?: string }[] | null;
        const pos = Array.isArray(posRel) ? posRel[0] : posRel;
        const firstName = ((athlete as { first_name?: string }).first_name) || "";
        const lastName = ((athlete as { last_name?: string }).last_name) || "";
        return {
          id: row.id as string,
          athleteId: ((athlete as { id?: string }).id) || "",
          athleteName: `${firstName} ${lastName}`.trim(),
          position: pos?.abreviation || "",
          createdAt: row.created_at as string,
        };
      });

      return { team: header, coaches, athletes, pendingInvitations };
    },
    enabled: !!teamId && !!userId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
