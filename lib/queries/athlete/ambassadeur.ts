/* ═══════════════════════════════════════════════════════════════
   Programme Ambassadeur — accès client aux RPC.

   TOUT PASSE PAR ICI. La table `ambassadeur_revendications` n'a qu'une
   policy SELECT, `is_admin()` : un athlète qui l'interrogerait en direct
   lirait ZÉRO ligne — pas une erreur, zéro ligne, ce qui se lit comme
   « tu n'as rien déclaré ». La projection est son unique chemin.

   ⚠ friendlyDbError N'EST PAS UN FILET GLOBAL. Il n'était importé que par
   l'éditeur de page école et celui d'équipe. Sa branche finale est
   `clair = msg` : sans lui, un 23505 qui remonterait afficherait
   « duplicate key value violates unique constraint
   "ambassadeur_filleul_unique_confirme" » — ce qui NOMME L'INDEX et révèle
   que la personne est déjà revendiquée par quelqu'un d'autre. C'est
   exactement l'information que tout ce chantier refuse de divulguer.
   Les RPC attrapent déjà l'unique_violation côté base ; cet import est la
   seconde ligne de défense, et il traduit aussi les messages « NEXUS: ».
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/queries/shared/dbErrors";

/** Motifs rendus par ambassadeur_revendiquer. Fermés : tout autre motif est
 *  un bogue, pas un cas d'usage — d'où le `default` explicite dans MESSAGES. */
export type MotifRevendication =
  | "confirmee"
  | "en_attente"
  | "introuvable"
  | "deja_parrainee"
  | "soi_meme"
  | "discriminant_requis"
  | "saisie_incomplete";

export interface ResultatRevendication {
  ok: boolean;
  motif: MotifRevendication;
  statut?: "CONFIRMEE" | "EN_ATTENTE";
  id?: string;
}

export interface LigneRevendication {
  id: string;
  /** Ce que L'ATHLÈTE a tapé — jamais ce que la base a trouvé. */
  prenom: string;
  nom: string;
  statut: "EN_ATTENTE" | "CONFIRMEE" | "REJETEE";
  le: string;
}

export interface TableauAmbassadeur {
  confirmes: number;
  paliers: number[];
  badge_debloque: boolean;
  badge_porte: boolean;
  recherches_restantes: number;
  revendications: LigneRevendication[];
}

/** Ce que l'écran dit pour chaque motif. « deja_parrainee » reste VOLONTAIREMENT
 *  vague : dire « quelqu'un d'autre l'a déjà déclarée » confirmerait que la
 *  personne a un compte. On dit ce que l'athlète doit faire, pas ce que la base
 *  sait. */
export const MESSAGES: Record<MotifRevendication, string> = {
  confirmee: "C'est confirmé — elle compte dans tes recrues.",
  en_attente:
    "Plusieurs personnes portent ce nom. On vérifie et ça apparaîtra ici dès que c'est réglé.",
  introuvable:
    "On ne trouve personne avec ces informations. Vérifie l'orthographe, ou essaie avec son courriel.",
  deja_parrainee: "Cette déclaration ne peut pas être ajoutée.",
  soi_meme: "Celle-là, c'est toi.",
  discriminant_requis: "Ajoute son courriel, son école ou son équipe.",
  saisie_incomplete: "Il manque le prénom ou le nom.",
};

export async function chargerTableau(): Promise<TableauAmbassadeur> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ambassadeur_mon_tableau");
  if (error) throw friendlyDbError(error);
  return data as unknown as TableauAmbassadeur;
}

export async function revendiquer(saisie: {
  prenom: string;
  nom: string;
  courriel?: string | null;
  ecoleId?: string | null;
  teamId?: string | null;
}): Promise<ResultatRevendication> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ambassadeur_revendiquer", {
    p_prenom: saisie.prenom,
    p_nom: saisie.nom,
    p_courriel: saisie.courriel?.trim() || null,
    p_ecole_id: saisie.ecoleId || null,
    p_team_id: saisie.teamId || null,
  });
  /* Le quota du jour et l'absence de session LÈVENT (les seuls cas) ; tous les
     refus métier reviennent en `data`. friendlyDbError retire le marqueur
     NEXUS: et rend le message tel quel — « tu as atteint la limite de
     recherches pour aujourd'hui ». */
  if (error) throw friendlyDbError(error);
  return data as unknown as ResultatRevendication;
}

/** Pose ou retire le badge. Motifs de refus : palier_non_atteint, plafond,
 *  badge_absent_du_catalogue. */
export async function basculerBadge(
  actif: boolean,
): Promise<{ ok: boolean; porte?: boolean; motif?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ambassadeur_basculer_badge", {
    p_actif: actif,
  });
  if (error) throw friendlyDbError(error);
  return data as unknown as { ok: boolean; porte?: boolean; motif?: string };
}

export const PALIERS = [3, 5, 10] as const;
