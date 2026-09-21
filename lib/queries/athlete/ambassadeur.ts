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

   ── DEPUIS LE 2026-09-22 : L'INVITATION PAR LIEN ────────────────────────
   Le chemin principal est le lien personnel (ambassadeur_mon_lien) ; la
   déclaration est un secours, PAR COURRIEL EXACT seulement. La recherche
   par nom, par école ou approximative n'existe plus côté serveur.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/queries/shared/dbErrors";

/** Motifs rendus par ambassadeur_revendiquer depuis la déclaration par
 *  courriel seul. `en_attente`, `discriminant_requis` et `saisie_incomplete`
 *  ont disparu côté serveur (ils ne vivent plus que dans le binaire 1.4.2). */
export type MotifRevendication =
  | "confirmee"
  | "introuvable"
  | "deja_parrainee"
  | "soi_meme";

export interface ResultatRevendication {
  ok: boolean;
  motif: MotifRevendication;
  /** `courriel_requis` quand aucun courriel valide n'a été fourni. */
  motif_precis?: string;
  statut?: "CONFIRMEE";
  id?: string;
  /** Prénom de la recrue confirmée — le seul renseignement projeté. */
  prenom?: string | null;
}

export interface LigneRevendication {
  id: string;
  /** PRÉNOM seulement (décision BP 2026-09-21), lu sur le compte de la recrue. */
  prenom: string;
  /** Toujours vide depuis le 2026-09-22 ; gardé pour le binaire 1.4.2. */
  nom: string;
  via: "lien" | "declaration";
  statut: "EN_ATTENTE" | "CONFIRMEE" | "REJETEE";
  le: string;
}

export interface TableauAmbassadeur {
  confirmes: number;
  paliers: number[];
  badge_debloque: boolean;
  badge_porte: boolean;
  recherches_restantes: number;
  lien: { clics_30j: number; inscriptions: number };
  revendications: LigneRevendication[];
}

/** Ce que l'écran dit pour chaque motif. « deja_parrainee » reste VOLONTAIREMENT
 *  vague : dire « quelqu'un d'autre l'a déjà déclarée » confirmerait que la
 *  personne a un compte. On dit ce que l'athlète doit faire, pas ce que la base
 *  sait. */
export const MESSAGES: Record<MotifRevendication, string> = {
  confirmee: "C'est confirmé — elle compte dans tes recrues.",
  introuvable:
    "On ne trouve aucun compte athlète avec ce courriel. Vérifie l'adresse de son compte Nexus.",
  deja_parrainee: "Cette déclaration ne peut pas être ajoutée.",
  soi_meme: "Celle-là, c'est toi.",
};

export const MESSAGE_COURRIEL_REQUIS = "Entre le courriel de ton ami.";

export async function chargerTableau(): Promise<TableauAmbassadeur> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ambassadeur_mon_tableau");
  if (error) throw friendlyDbError(error);
  return data as unknown as TableauAmbassadeur;
}

/** Déclaration de secours, par COURRIEL EXACT. Les paramètres de nom,
 *  d'école et d'équipe de la RPC sont ignorés côté serveur : on les envoie
 *  nuls. */
export async function revendiquer(courriel: string): Promise<ResultatRevendication> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ambassadeur_revendiquer", {
    p_prenom: null,
    p_nom: null,
    p_courriel: courriel.trim() || null,
    p_ecole_id: null,
    p_team_id: null,
  });
  /* Le quota du jour et l'absence de session LÈVENT (les seuls cas) ; tous les
     refus métier reviennent en `data`. friendlyDbError retire le marqueur
     NEXUS: et rend le message tel quel — « tu as atteint la limite de
     recherches pour aujourd'hui ». */
  if (error) throw friendlyDbError(error);
  return data as unknown as ResultatRevendication;
}

/** URL publique du lien d'invitation. ABSOLUE et en dur, pas
 *  `location.origin` : le lien part dans un message, depuis un téléphone qui a
 *  pu ouvrir l'app par une préproduction ou une adresse LAN. */
export function urlInvitation(jeton: string): string {
  return `https://nexussports.ca/i/${jeton}`;
}

/** Le jeton du lien personnel (créé au premier appel, stable ensuite). */
export async function monLien(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ambassadeur_mon_lien");
  if (error) throw friendlyDbError(error);
  return (data as unknown as { jeton: string }).jeton;
}

/** Nouveau jeton — l'ancien lien cesse aussitôt de fonctionner. */
export async function regenererLien(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ambassadeur_regenerer_lien");
  if (error) throw friendlyDbError(error);
  return (data as unknown as { jeton: string }).jeton;
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
