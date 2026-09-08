import type { SupabaseClient } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════════════════
   transferAthletes — GESTION DES ATHLÈTES, pivotée PAR ÉQUIPE.

   ── CE QUI A CHANGÉ, ET POURQUOI ──────────────────────────────
   Le portail déplaçait la PROPRIÉTÉ (`athletes.coach_id`) d'un coach à un
   autre. Constat chiffré du 2026-09-09 : coach_id ne décrivait que 9 des 53
   athlètes en équipe, et 39 des 42 équipes concernées n'avaient aucun coach.
   Déplacer un pointeur que 83 % des lignes ne portent pas n'organise rien.

   Le portail déplace maintenant l'APPARTENANCE D'ÉQUIPE (`team_athletes`),
   qui est la donnée réellement peuplée et réellement structurante.

   `athletes.coach_id` n'est PLUS ÉCRIT ICI. Il devient un pointeur calculé,
   maintenu par les triggers de la vague 2 (fn_resolve_team_referent). Tant
   que la vague 2 n'est pas appliquée, le référent peut être PÉRIMÉ après un
   déplacement — accepté et documenté, c'est la fenêtre entre les deux vagues.

   ── LES TROIS ÉCRITURES, ET L'INTERDIT ────────────────────────
     déplacement   → UPDATE team_athletes SET team_id = <cible>
     depuis « Sans équipe » → INSERT team_athletes
     vers « Retirer »       → DELETE team_athletes

   ⚠ JAMAIS DELETE + INSERT pour un déplacement. Ça paraît équivalent et ça
   ne l'est pas : la ligne perdrait son `id` et son `joined_at`, et le couple
   DELETE→INSERT ferait tirer les triggers de retrait PUIS d'arrivée, avec un
   état intermédiaire « sans équipe » que rien ne justifie. Un déplacement est
   UN changement, pas une sortie suivie d'une entrée.

   ── PÉRIMÈTRE ET DROITS ───────────────────────────────────────
   RLS sur team_athletes (policies FOR ALL, `qual` = `with_check`) :
     · « Directors manage school team athletes » — le directeur passe partout
       dans son organisation.
     · « Coaches manage own team athletes » — un coach est borné à SES équipes,
       et comme un UPDATE de team_id évalue l'ANCIENNE équipe (qual) ET la
       NOUVELLE (with_check), il doit être coach des DEUX. L'UI désactive donc
       les destinations tierces pour un non-directeur, avec le motif.

   ── DETTE CONSERVÉE ───────────────────────────────────────────
   Le pool de réclamation (school_id NULL + coach_id NULL) reste HORS de ce
   portail : c'est une salle d'attente de réclamation, pas un marché d'agents
   libres. La réclamation a son propre flow coach, et le retour au pool a le
   sien (« Libérer l'athlète »). Ce portail ne gère que l'appartenance
   d'équipe — il ne réclame ni ne libère personne.
   ═══════════════════════════════════════════════════════════════ */

/** Source : athlètes du périmètre SANS ligne team_athletes. */
export const NO_TEAM_ID = "__SANS_EQUIPE__";
/** Destination : retirer de l'équipe (DELETE), sans en rejoindre une autre. */
export const REMOVE_FROM_TEAM_ID = "__RETIRER__";

export interface TeamOption {
  /** team_id réel, ou l'un des deux sentinelles ci-dessus. */
  id: string;
  name: string;
  /** Sous-titre : sport · division, ou le motif pour les sentinelles. */
  sub: string;
  athleteCount: number;
  /** false → le coach courant n'est pas coach de cette équipe. L'UI
   *  désactive la destination (la RLS la refuserait). Toujours true
   *  pour un directeur. */
  canManage: boolean;
}

export interface TransferAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photo?: string | null;
  sport?: string | null;
  position?: string | null;
  /** #EN_ATTENTE : athlète en attente de consentement → liseré « En attente ». */
  isPending?: boolean;
  /** id de la ligne team_athletes — la cible de l'UPDATE/DELETE.
   *  undefined quand l'athlète vient de « Sans équipe » (il faudra un INSERT). */
  rowId?: string;
}

const ATHLETE_COLS =
  "id, first_name, last_name, photo_url, status, sports!sport_id(nom), positions!position_id(abreviation)";

/* ── Contexte de droits ────────────────────────────────────────── */

export interface TransferContext {
  /** Équipes dont le user courant est coach — bornent ses déplacements. */
  myTeamIds: Set<string>;
  /** Directeur de l'organisation → passe partout. */
  isDirector: boolean;
}

export async function loadTransferContext(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<TransferContext> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return { myTeamIds: new Set(), isDirector: false };

  const [{ data: tcRows }, { data: scRows }] = await Promise.all([
    supabase.from("team_coaches").select("team_id").eq("coach_id", uid),
    supabase.from("school_coaches").select("role").eq("coach_id", uid).eq("school_id", schoolId),
  ]);

  const isDirector = (scRows ?? []).some((r) =>
    ["DIRECTEUR", "DIRECTEUR_INTERIM"].includes((r as { role: string }).role),
  );

  return {
    myTeamIds: new Set((tcRows ?? []).map((r) => (r as { team_id: string }).team_id)),
    isDirector,
  };
}

/* ── Sources / destinations ────────────────────────────────────── */

/**
 * Équipes de l'organisation + l'entrée virtuelle « Sans équipe ».
 * Les effectifs sont comptés en UN aller-retour, pas un `count` par équipe.
 */
export async function loadSchoolTeams(
  supabase: SupabaseClient,
  schoolId: string,
  ctx: TransferContext,
): Promise<TeamOption[]> {
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, division, age_group, sports!sport_id(nom)")
    .eq("school_id", schoolId)
    .order("name");

  const rows = (teamRows ?? []) as Record<string, unknown>[];
  const ids = rows.map((t) => t.id as string);

  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: taRows } = await supabase
      .from("team_athletes")
      .select("team_id")
      .in("team_id", ids);
    for (const r of (taRows ?? []) as { team_id: string }[]) {
      counts.set(r.team_id, (counts.get(r.team_id) ?? 0) + 1);
    }
  }

  const teams: TeamOption[] = rows.map((t) => {
    const spRel = t.sports as { nom?: string } | { nom?: string }[] | null;
    const sp = Array.isArray(spRel) ? spRel[0] : spRel;
    const sub = [sp?.nom, t.division as string, t.age_group as string]
      .filter(Boolean)
      .join(" · ");
    const id = t.id as string;
    return {
      id,
      name: (t.name as string) || "Équipe",
      sub: sub || "—",
      athleteCount: counts.get(id) ?? 0,
      canManage: ctx.isDirector || ctx.myTeamIds.has(id),
    };
  });

  teams.unshift({
    id: NO_TEAM_ID,
    name: "Sans équipe",
    sub: "Athlètes de l'organisation qui ne sont sur aucun alignement",
    athleteCount: await countAthletesWithoutTeam(supabase, schoolId),
    canManage: true,
  });

  return teams;
}

async function countAthletesWithoutTeam(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<number> {
  const { data } = await supabase
    .from("athletes")
    .select("id")
    .eq("school_id", schoolId)
    .in("status", ["ACTIF", "EN_ATTENTE"]);

  const ids = ((data ?? []) as { id: string }[]).map((a) => a.id);
  if (ids.length === 0) return 0;

  const { data: taRows } = await supabase
    .from("team_athletes")
    .select("athlete_id")
    .in("athlete_id", ids);

  const withTeam = new Set(
    ((taRows ?? []) as { athlete_id: string }[]).map((r) => r.athlete_id),
  );
  return ids.filter((id) => !withTeam.has(id)).length;
}

/** Athlètes d'une équipe, ou du groupe « Sans équipe ». */
export async function loadAthletesForTeam(
  supabase: SupabaseClient,
  schoolId: string,
  teamId: string,
): Promise<TransferAthlete[]> {
  if (!teamId) return [];

  if (teamId === NO_TEAM_ID) {
    const { data } = await supabase
      .from("athletes")
      .select(ATHLETE_COLS)
      .eq("school_id", schoolId)
      // #EN_ATTENTE inclus (badgé) — même règle que les autres pickers.
      .in("status", ["ACTIF", "EN_ATTENTE"]);

    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) return [];

    const { data: taRows } = await supabase
      .from("team_athletes")
      .select("athlete_id")
      .in("athlete_id", rows.map((a) => a.id as string));
    const withTeam = new Set(
      ((taRows ?? []) as { athlete_id: string }[]).map((r) => r.athlete_id),
    );

    return rows.filter((a) => !withTeam.has(a.id as string)).map((a) => mapAthlete(a, undefined));
  }

  const { data } = await supabase
    .from("team_athletes")
    .select(`id, athlete_id, athletes!athlete_id(${ATHLETE_COLS})`)
    .eq("team_id", teamId);

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const aRel = row.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
      const a = (Array.isArray(aRel) ? aRel[0] : aRel) as Record<string, unknown> | null;
      if (!a) return null;
      const status = a.status as string | null;
      if (status !== "ACTIF" && status !== "EN_ATTENTE") return null;
      return mapAthlete(a, row.id as string);
    })
    .filter((x): x is TransferAthlete => x !== null);
}

function mapAthlete(a: Record<string, unknown>, rowId: string | undefined): TransferAthlete {
  const spRel = a.sports as { nom?: string } | { nom?: string }[] | null;
  const sp = Array.isArray(spRel) ? spRel[0] : spRel;
  const poRel = a.positions as { abreviation?: string } | { abreviation?: string }[] | null;
  const po = Array.isArray(poRel) ? poRel[0] : poRel;
  return {
    id: a.id as string,
    firstName: (a.first_name as string) || "",
    lastName: (a.last_name as string) || "",
    photo: (a.photo_url as string | null) ?? null,
    sport: sp?.nom ?? null,
    position: po?.abreviation ?? null,
    isPending: a.status === "EN_ATTENTE",
    rowId,
  };
}

/* ── Écriture ──────────────────────────────────────────────────── */

export interface MoveResult {
  success: boolean;
  moved: number;
  error?: string;
}

/**
 * Déplace un lot d'athlètes vers `destTeamId`, ou les retire
 * (`REMOVE_FROM_TEAM_ID`).
 *
 * N'ÉCRIT JAMAIS athletes.coach_id — le référent est dérivé (vague 2).
 *
 * Chaque écriture porte `.select("id")` : une ligne refusée par la RLS ne
 * lève PAS d'erreur, elle met simplement à jour zéro ligne. Sans ce compte,
 * l'appelant annoncerait un succès fantôme.
 */
export async function moveAthletesToTeam(
  supabase: SupabaseClient,
  athletes: TransferAthlete[],
  destTeamId: string,
): Promise<MoveResult> {
  if (athletes.length === 0) {
    return { success: false, moved: 0, error: "Aucun athlète sélectionné." };
  }

  // ── Retrait : DELETE des lignes existantes.
  if (destTeamId === REMOVE_FROM_TEAM_ID) {
    const rowIds = athletes.map((a) => a.rowId).filter((x): x is string => !!x);
    if (rowIds.length === 0) {
      return { success: false, moved: 0, error: "Ces athlètes ne sont sur aucune équipe." };
    }
    const { data, error } = await supabase
      .from("team_athletes")
      .delete()
      .in("id", rowIds)
      .select("id");
    if (error) return { success: false, moved: 0, error: error.message };
    return finish(data?.length ?? 0, rowIds.length, "retiré");
  }

  // ── Déjà en équipe → UPDATE du team_id. JAMAIS delete+insert.
  const aDeplacer = athletes.filter((a) => a.rowId);
  // ── Sans équipe → INSERT. sport_id est posé par le trigger BEFORE INSERT
  //    `team_athletes_set_sport_id`, on ne le fournit pas.
  const aInserer = athletes.filter((a) => !a.rowId);

  let moved = 0;

  if (aDeplacer.length > 0) {
    const { data, error } = await supabase
      .from("team_athletes")
      .update({ team_id: destTeamId })
      .in("id", aDeplacer.map((a) => a.rowId as string))
      .select("id");
    if (error) return { success: false, moved, error: error.message };
    moved += data?.length ?? 0;
  }

  if (aInserer.length > 0) {
    const { data, error } = await supabase
      .from("team_athletes")
      .insert(aInserer.map((a) => ({ team_id: destTeamId, athlete_id: a.id })))
      .select("id");
    if (error) return { success: false, moved, error: error.message };
    moved += data?.length ?? 0;
  }

  return finish(moved, athletes.length, "déplacé");
}

function finish(moved: number, attendu: number, verbe: string): MoveResult {
  if (moved < attendu) {
    const bloques = attendu - moved;
    return {
      success: false,
      moved,
      error:
        `${bloques} athlète${bloques > 1 ? "s" : ""} n'${bloques > 1 ? "ont" : "a"} pas pu être ${verbe}${bloques > 1 ? "s" : ""}. ` +
        "Tu peux seulement gérer les alignements de tes équipes — ou toutes celles de l'organisation si tu en es le directeur.",
    };
  }
  return { success: true, moved };
}

/** Première source non vide : une équipe que je gère, sinon n'importe laquelle. */
export function pickInitialTeam(teams: TeamOption[]): string {
  const mienne = teams.find((t) => t.id !== NO_TEAM_ID && t.canManage && t.athleteCount > 0);
  if (mienne) return mienne.id;
  const pleine = teams.find((t) => t.id !== NO_TEAM_ID && t.athleteCount > 0);
  if (pleine) return pleine.id;
  const sansEquipe = teams.find((t) => t.id === NO_TEAM_ID);
  return sansEquipe && sansEquipe.athleteCount > 0 ? NO_TEAM_ID : (teams[1]?.id ?? "");
}

/** Motif de blocage d'une destination, ou null si elle est ouverte. */
export function destinationBlockReason(dest: TeamOption, source: TeamOption | null): string | null {
  if (dest.id === REMOVE_FROM_TEAM_ID) return null;
  if (!dest.canManage) {
    return "Réservé au directeur — tu n'es pas entraîneur de cette équipe.";
  }
  if (source && !source.canManage) {
    return "Réservé au directeur — tu n'es pas entraîneur de l'équipe de départ.";
  }
  return null;
}
