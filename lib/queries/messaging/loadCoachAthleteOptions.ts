/* ═══════════════════════════════════════════════════════════════
   loadCoachAthleteOptions — source de données « à propos d'un athlète »
   pour les composeurs coach (messagerie).

   PROBLÈME (#6) : dans les composeurs où un coach choisit « de quel
   athlète » parle le message (ex. RecruiterBrowserCompose — coach →
   recruteur), la liste était chargée en dur `.eq("coach_id", selfId)`.
   Pour un DIRECTEUR d'école, ça ne montrait QUE ses propres athlètes,
   jamais ceux des autres coachs de son école — alors qu'il a le droit
   (RLS oversight Part A) de les lire et d'écrire à leur sujet.

   Ce helper renvoie DEUX sections :
     • mine   — « Mes athlètes »        (coach_id = selfId)
     • school — « Athlètes de l'école »  (school_id = école du directeur,
                                          coach_id ≠ selfId → pas de doublon)
   Pour un coach NON-directeur, `school` est vide → le composeur n'affiche
   qu'une section (comportement inchangé).

   Statut directeur = school_coaches.role ∈ {DIRECTEUR, DIRECTEUR_INTERIM}
   via loadSchoolDirectorStatus (même source de vérité que le reste des
   surfaces « supervision »). On NE lit PAS is_school_admin (inclurait les
   admins CÉGEP, hors périmètre COACH-only).

   La sélection de colonnes / le mapping reproduisent EXACTEMENT ceux des
   composeurs (id, first_name, last_name, photo_url, cote_globale_entraineur,
   sports!sport_id(nom), positions!position_id(abreviation)) pour que la
   carte AthleteSelectCard s'affiche à l'identique.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCoachAthleteScope } from "@/lib/queries/coach/getCoachAthletes";

export interface CoachAthleteOption {
  id: string;
  /** user_id du compte de l'athlète (null si l'athlète n'a pas de compte).
   *  `id` reste l'athlete_id ; `userId` est ce qu'attend le RPC groupe custom. */
  userId: string | null;
  firstName: string;
  lastName: string;
  name: string;
  sport: string;
  position: string;
  photoUrl: string | null;
  stars: number;
  /** #EN_ATTENTE : athlète en attente de consentement → liseré « En attente ». */
  isPending: boolean;
}

export interface CoachAthleteOptions {
  /** « Mes athlètes » — roster propre du user (coach_id = selfId). */
  mine: CoachAthleteOption[];
  /** « Athlètes de l'école » — reste de l'école, directeur seulement.
   *  Vide pour un coach non-directeur. Ne chevauche jamais `mine`. */
  school: CoachAthleteOption[];
}

/* Ligne athlete + jointures sport/position, telle que sélectionnée. */
interface AthleteRow {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  cote_globale_entraineur: number | null;
  coach_id: string | null;
  sports: { nom?: string } | { nom?: string }[] | null;
  positions: { abreviation?: string } | { abreviation?: string }[] | null;
}

const ATHLETE_OPTION_SELECT =
  "id, user_id, first_name, last_name, photo_url, cote_globale_entraineur, coach_id, " +
  "sports!sport_id(nom), positions!position_id(abreviation)";

function pickFirst<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toOption(a: AthleteRow): CoachAthleteOption {
  const pos = pickFirst(a.positions);
  const spt = pickFirst(a.sports);
  const af = a.first_name || "";
  const al = a.last_name || "";
  return {
    id: a.id,
    userId: a.user_id ?? null,
    firstName: af,
    lastName: al,
    name: `${af} ${al}`.trim() || "Athlète",
    sport: spt?.nom || "",
    position: pos?.abreviation || "",
    photoUrl: a.photo_url ?? null,
    stars: Number(a.cote_globale_entraineur) || 0,
    isPending: false,
  };
}

/**
 * Charge les athlètes que ce user peut attacher à un message, en deux
 * sections. Ne throw jamais : retombe sur des tableaux vides en cas
 * d'erreur (le composeur affiche « aucun athlète »).
 */
export async function loadCoachAthleteOptions(
  supabase: SupabaseClient,
  // selfId n'est plus requis pour le scope — le RPC get_coach_athletes lit
  // auth.uid(). Conservé pour la stabilité de signature des appelants.
  _selfId: string,
  // #EN_ATTENTE : par défaut le coach voit SES athlètes en attente de consentement
  // dans ses pickers (roster/groupe/message) — il les gère. Le côté RECRUTEUR reste
  // protégé par sa propre RLS (status='ACTIF' seul) : un athlète en attente n'est
  // jamais exposé au marché, même si le coach le sélectionne pour en parler.
  includePending = true,
): Promise<CoachAthleteOptions> {
  // Périmètre canonique — source unique get_coach_athletes (owner ∪ team,
  // +école si directeur ; statut filtré serveur). On partitionne par `relation` :
  //   • OWNER / TEAM → « mes athlètes »
  //   • SCHOOL       → « athlètes de l'école » (le RPC ne renvoie SCHOOL que
  //                    pour un directeur — un coach ordinaire n'a jamais cette
  //                    section). Les non réclamés (coach_id NULL) de l'école
  //                    ressortent en SCHOOL, comme avant.
  const { ids, relationById, statusById } = await loadCoachAthleteScope(supabase, { includePending });
  if (!ids.length) return { mine: [], school: [] };

  const { data } = await supabase
    .from("athletes")
    .select(ATHLETE_OPTION_SELECT)
    .in("id", ids)
    .order("last_name", { ascending: true });

  const mine: CoachAthleteOption[] = [];
  const school: CoachAthleteOption[] = [];
  for (const raw of (data ?? []) as unknown as AthleteRow[]) {
    const opt = toOption(raw);
    opt.isPending = statusById.get(raw.id) === "EN_ATTENTE";
    if (relationById.get(raw.id) === "SCHOOL") school.push(opt);
    else mine.push(opt);
  }
  return { mine, school };
}
