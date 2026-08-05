/* ═══════════════════════════════════════════════════════════════
   teamAttachment — LE chemin d'écriture de l'ancrage d'équipe côté client.

   Un athlète a UN SEUL rattachement actif, tous sports confondus (contrainte
   team_athletes_athlete_id_key). Changer d'école, monter au CÉGEP, changer de
   saison ou de sport, c'est le MÊME geste : un transfert. Le serveur le sait —
   `apply_team_attachment` fait tout, dans une transaction, et refuse un
   changement d'équipe non confirmé en levant TRANSFER_REQUIRES_CONFIRMATION.

   Ce module est le seul point d'entrée client. Les quatre surfaces qui
   rattachent un athlète — onboarding web, onboarding mobile, page /join, tab
   Transfert — l'appellent au lieu d'écrire dans team_athletes.

   POURQUOI PLUS D'INSERT DIRECT. Les anciens sites faisaient
   `insert(team_athletes)` puis avalaient le code 23505. Tant que l'unicité
   était (athlete_id, sport_id), ce 23505 voulait dire « déjà dans CETTE
   équipe » — inoffensif. Depuis l'ancrage unique strict il veut aussi dire
   « déjà ancré AILLEURS », et l'avaler faisait croire à l'athlète qu'il avait
   rejoint son équipe alors que rien n'avait bougé. Aucune erreur n'est plus
   avalée ici.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attachmentErrorMessage,
  attachmentSentinel,
  transferConfirmation,
  type AttachmentSentinel,
  type TransferConfirmation,
} from "@/lib/queries/shared/attachmentErrors";

/** jsonb retourné par apply_team_attachment. */
export interface AttachmentPayload {
  athlete_id: string;
  team_id: string;
  /** true si une appartenance précédente a été remplacée. */
  transferred: boolean;
  previous_team_id: string | null;
  /** true si coach_id a été réécrit vers le staff de l'équipe cible. */
  coach_id_updated: boolean;
  /** true si l'athlète était DÉJÀ sur l'équipe cible : rien n'a bougé. */
  no_op: boolean;
  /** false si le plafond de 10 entrées a empêché d'écrire la trace système. */
  parcours_appended: boolean;
}

export type AttachOutcome =
  | { status: "ok"; payload: AttachmentPayload }
  | { status: "needs_confirmation"; confirmation: TransferConfirmation }
  | { status: "error"; message: string; sentinel: AttachmentSentinel | null };

/** Équipe derrière un code d'adhésion (resolve_team_join_token).
 *  Tous les champs sont null quand `isValid` est false — le serveur masque
 *  les détails d'un code révoqué/expiré/épuisé. */
export interface ResolvedJoinTeam {
  teamId: string | null;
  teamName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  schoolLogoUrl: string | null;
  /** SECONDAIRE | CEGEP | LIGUE_CIVILE — décide du contexte d'onboarding
   *  (scolaire vs ligue civile) sans aller-retour supplémentaire sur `schools`. */
  schoolType: string | null;
  sportName: string | null;
  season: string | null;
  ageGroup: string | null;
  division: string | null;
  gender: string | null;
  league: string | null;
  isValid: boolean;
}

/** Alphabet des codes : 2-9 + A-Z sans I, L, O (cf. migration M1). */
const CODE_RE = /^[2-9A-HJKMNP-Z]{6,8}$/;

/* ── Transport du code de /join jusqu'à l'étape équipe de l'onboarding ──────
   CHOIX : sessionStorage, avec le query param `?code=` en simple porte
   d'entrée sur /join.

   Pourquoi pas le query param jusqu'au bout. Entre /join et l'étape équipe, le
   parcours traverse le signup, la confirmation d'email et potentiellement un
   aller-retour OAuth — autant de redirections dont certaines sont émises par
   Supabase et qu'on ne réécrit pas. Il faudrait reporter le paramètre à chaque
   saut, et le premier oubli le perd en silence. Un code en URL finit en plus
   dans les logs serveur et dans le Referer sortant.

   Ce que sessionStorage ne couvre PAS, et pourquoi ce n'est pas grave : un lien
   de confirmation ouvert dans un AUTRE onglet ou un autre navigateur repart à
   vide. C'est exactement pour ça que /join affiche le code EN GROS avec
   « retiens ton code », et que l'étape équipe expose un champ de saisie
   manuelle. Le stockage est un confort, jamais le seul chemin.                */
export const JOIN_CODE_STORAGE_KEY = "nexus.join-code";

/** Mémorise un code pour la durée de l'onglet. No-op si le stockage est
 *  indisponible (navigation privée, quota) — le champ manuel prend le relais. */
export function stashJoinCode(rawCode: string): void {
  const code = normalizeJoinCode(rawCode);
  if (!isPlausibleJoinCode(code)) return;
  try { sessionStorage.setItem(JOIN_CODE_STORAGE_KEY, code); } catch { /* ignoré */ }
}

/** Relit le code mémorisé, ou "" s'il n'y en a pas. */
export function readStashedJoinCode(): string {
  try {
    const v = sessionStorage.getItem(JOIN_CODE_STORAGE_KEY) ?? "";
    return isPlausibleJoinCode(v) ? normalizeJoinCode(v) : "";
  } catch {
    return "";
  }
}

/** Met un code saisi à la main en forme canonique : majuscules, sans espaces
 *  ni tirets. L'athlète recopie d'un tableau blanc ou dicte à voix haute — on
 *  ne le fait pas échouer sur « v9a9-b7hm ». */
export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Forme plausible ? Sert à ne pas déclencher un aller-retour réseau sur une
 *  saisie manifestement incomplète. Ne remplace PAS la validation serveur. */
export function isPlausibleJoinCode(raw: string): boolean {
  return CODE_RE.test(normalizeJoinCode(raw));
}

/**
 * Résout un code d'adhésion. Appelable en anon (page /join publique).
 *
 * Trois issues, volontairement distinctes :
 *   • code inexistant       → `null` (la fonction ne renvoie AUCUNE ligne :
 *                             pas d'oracle d'énumération) ;
 *   • code existant invalide → objet avec `isValid: false` et tout à null ;
 *   • code valide            → objet complet.
 */
export async function resolveTeamJoinToken(
  supabase: SupabaseClient,
  rawCode: string,
): Promise<ResolvedJoinTeam | null> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return null;

  const { data, error } = await supabase.rpc("resolve_team_join_token", { p_code: code });
  if (error) return null;

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return null;                       // code inexistant

  return {
    teamId: (row.team_id as string) ?? null,
    teamName: (row.team_name as string) ?? null,
    schoolId: (row.school_id as string) ?? null,
    schoolName: (row.school_name as string) ?? null,
    schoolLogoUrl: (row.school_logo_url as string) ?? null,
    schoolType: (row.school_type as string) ?? null,
    sportName: (row.sport_name as string) ?? null,
    season: (row.season as string) ?? null,
    ageGroup: (row.age_group as string) ?? null,
    division: (row.division as string) ?? null,
    gender: (row.gender as string) ?? null,
    league: (row.league as string) ?? null,
    isValid: row.is_valid === true,
  };
}

/**
 * Rattache l'athlète connecté à `teamId`.
 *
 * `confirmTransfer` reste à false au premier appel, TOUJOURS : c'est le serveur
 * qui décide s'il faut confirmer, en fonction de l'appartenance réelle en base.
 * L'UI ne devine pas — elle réagit à `needs_confirmation`, montre l'écran, puis
 * rappelle avec `confirmTransfer: true`.
 */
export async function applyTeamAttachment(
  supabase: SupabaseClient,
  opts: { teamId: string; joinCode?: string | null; confirmTransfer?: boolean },
): Promise<AttachOutcome> {
  const code = opts.joinCode ? normalizeJoinCode(opts.joinCode) : null;

  const { data, error } = await supabase.rpc("apply_team_attachment", {
    p_team_id: opts.teamId,
    p_join_code: code || null,
    p_confirm_transfer: opts.confirmTransfer === true,
  });

  if (error) {
    const confirmation = transferConfirmation(error);
    if (confirmation) return { status: "needs_confirmation", confirmation };
    return {
      status: "error",
      message: attachmentErrorMessage(error),
      sentinel: attachmentSentinel(error),
    };
  }

  return { status: "ok", payload: data as AttachmentPayload };
}
