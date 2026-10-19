/* ═══════════════════════════════════════════════════════════════
   Cartes prospects PARTENAIRE (lot W4) — écrans W4b (partenaire) et W4c
   (jeune). Base W4a (20261014200739), en prod : tout passe par ses RPC,
   aucune table n'est lisible en direct.

   Partenaire :
   - partenaire_prospects_mes_cartes : ses cartes, statut MASQUÉ par le
     serveur (A_ENVOYER, ENVOYEE, CORRESPONDANCE_POSSIBLE) — l'écran affiche
     ce que le serveur rend, sans rien déduire ;
   - partenaire_prospect_enregistrer / _lien / _revoquer_lien / _supprimer ;
   - partenaire_prospects_terminees (W4d) : les cartes terminées ; une réclamation est nommée
     (avec le résumé du transfert) seulement si le jeune est encore visible du partenaire.

   Jeune :
   - prospect_partenaire_resoudre (anon) : le nom du partenaire, rien d'autre ;
   - prospect_partenaire_ouvrir : réserve la carte au compte connecté ;
   - prospect_partenaire_mes_cartes / _confirmer / _infirmer.

   LE JETON n'est affiché qu'une fois au partenaire (le serveur n'en garde
   que l'empreinte) et n'est jamais affiché au jeune. Côté jeune, il est
   mémorisé dans le navigateur le temps de l'inscription et de l'onboarding
   (même transport que le lien ambassadeur, lib/ambassadeur/invitation.ts).
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lireTout } from "@/lib/supabase/lireTout";
import { messageErreurNexus } from "@/lib/erreurs/messageErreurNexus";
import type { CritereColonne } from "@/lib/evaluations/partenaire";


/* ── Partenaire ─────────────────────────────────────────────────── */

export type StatutVuPartenaire = "A_ENVOYER" | "ENVOYEE" | "CORRESPONDANCE_POSSIBLE";

export interface CartePartenaire {
  id: string;
  prenom: string;
  nom: string;
  sportId: string;
  positionId: string | null;
  schoolId: string | null;
  teamId: string | null;
  promotion: number | null;
  coteGlobale: number | null;
  traits: Partial<Record<CritereColonne, number>>;
  badgesPartenaire: string[];
  badgesNexus: string[];
  statut: StatutVuPartenaire;
  expireLe: string;
  creeLe: string;
  modifieLe: string;
}

export const LIBELLE_STATUT: Record<StatutVuPartenaire, string> = {
  A_ENVOYER: "À envoyer",
  ENVOYEE: "Lien envoyé",
  CORRESPONDANCE_POSSIBLE: "Correspondance possible",
};

/** Toutes les cartes, par pages (lireTout) : plus de plafond de cartes (BP 2026-10-18). */
export async function chargerMesCartes(supabase: SupabaseClient): Promise<CartePartenaire[]> {
  const data = await lireTout<Record<string, unknown>>((de, a) => supabase
    .rpc("partenaire_prospects_mes_cartes", {}, { count: "exact" }).select("*").order("id").range(de, a));
  return (data as unknown as {
    id: string; prenom: string; nom: string; sport_id: string; position_id: string | null;
    school_id: string | null; team_id: string | null; promotion: number | null;
    cote_globale: number | string | null; traits: Record<string, number> | null;
    badges_partenaire: string[] | null; badges_nexus: string[] | null; statut: StatutVuPartenaire;
    expire_le: string; created_at: string; updated_at: string;
  }[]).map((r) => ({
    id: r.id,
    prenom: r.prenom,
    nom: r.nom,
    sportId: r.sport_id,
    positionId: r.position_id,
    schoolId: r.school_id,
    teamId: r.team_id,
    promotion: r.promotion,
    coteGlobale: r.cote_globale == null ? null : Number(r.cote_globale),
    traits: (r.traits ?? {}) as Partial<Record<CritereColonne, number>>,
    badgesPartenaire: r.badges_partenaire ?? [],
    badgesNexus: r.badges_nexus ?? [],
    statut: r.statut,
    expireLe: r.expire_le,
    creeLe: r.created_at,
    modifieLe: r.updated_at,
  }));
}

export interface SaisieCarte {
  prenom: string;
  nom: string;
  sportId: string;
  positionId: string | null;
  schoolId: string | null;
  teamId: string | null;
  promotion: number | null;
  atteste14Ans: boolean;
  /** null = aucune évaluation. En détaillé, le serveur recalcule la cote. */
  coteGlobale: number | null;
  traits: Partial<Record<CritereColonne, number>>;
  badgesPartenaire: string[];
  badgesNexus: string[];
}

/** Crée (carteId null) ou modifie une carte. Rend son id. */
export async function enregistrerCarte(
  supabase: SupabaseClient,
  carteId: string | null,
  s: SaisieCarte,
): Promise<string> {
  const { data, error } = await supabase.rpc("partenaire_prospect_enregistrer", {
    p_carte: carteId,
    p_prenom: s.prenom,
    p_nom: s.nom,
    p_sport_id: s.sportId,
    p_position_id: s.positionId,
    p_school_id: s.schoolId,
    p_team_id: s.teamId,
    p_promotion: s.promotion,
    p_atteste_14_ans: s.atteste14Ans,
    p_cote_globale: s.coteGlobale,
    p_traits: s.traits,
    p_badges_partenaire: s.badgesPartenaire,
    p_badges_nexus: s.badgesNexus,
  });
  if (error) throw error;
  return data as string;
}

/** Génère un NOUVEAU lien (l'ancien meurt). Le jeton n'est rendu qu'ici. */
export async function genererLien(supabase: SupabaseClient, carteId: string): Promise<string> {
  const { data, error } = await supabase.rpc("partenaire_prospect_lien", { p_carte: carteId });
  if (error) throw error;
  return data as string;
}

export async function revoquerLien(supabase: SupabaseClient, carteId: string): Promise<void> {
  const { error } = await supabase.rpc("partenaire_prospect_revoquer_lien", { p_carte: carteId });
  if (error) throw error;
}

export async function supprimerCarte(supabase: SupabaseClient, carteId: string): Promise<void> {
  const { error } = await supabase.rpc("partenaire_prospect_supprimer", { p_carte: carteId });
  if (error) throw error;
}

export type IssueCarte = "RECLAMEE" | "REFUSEE" | "EXPIREE" | "RETIREE" | "SUPPRIMEE_ADMIN";

/** Un badge du transfert d'une carte réclamée (W4d). */
export interface BadgeTransfert {
  libelle: string | null;
  nexus: boolean;
  transfere: boolean;
  /** Pourquoi il a été sauté (null s'il est passé). */
  raison: string | null;
}

export interface CarteTerminee {
  carteId: string;
  issue: IssueCarte;
  creeLe: string;
  termineeLe: string;
  /** W4d : vrai seulement pour une réclamation non annulée dont le jeune lui est ENCORE visible.
   *  Sinon tout ce qui suit est null : ni nom, ni identifiant. */
  profilVisible: boolean;
  athleteId: string | null;
  prenom: string | null;
  nom: string | null;
  sport: string | null;
  poste: string | null;
  ecole: string | null;
  /** transferee | deja_evalue | aucune | autre_sport | non_permise */
  evaluation: string | null;
  badges: BadgeTransfert[];
}

/** Raisons des badges sautés au transfert (prospect_partenaire_transferer, W4a). */
export const LIBELLE_RAISON_BADGE: Record<string, string> = {
  autre_sport: "autre sport que celui du jeune",
  non_permise: "plus permis à ton organisation",
  retire_du_catalogue: "retiré de ton catalogue",
  deja_porte: "il le portait déjà",
  non_admissible: "non admissible",
  deja_porte_coach: "déjà posé par son coach",
  deja_porte_partenaire: "déjà posé par un partenaire",
};

export const LIBELLE_EVALUATION_TRANSFERT: Record<string, string> = {
  transferee: "Évaluation transférée",
  deja_evalue: "Évaluation non transférée — tu l'avais déjà évalué",
  aucune: "Pas d'évaluation sur la carte",
  autre_sport: "Évaluation non transférée — autre sport",
  non_permise: "Évaluation non transférée — sport plus permis",
};

export const LIBELLE_ISSUE: Record<IssueCarte, string> = {
  RECLAMEE: "Réclamée par le jeune",
  REFUSEE: "Le jeune a répondu que ce n'était pas lui",
  EXPIREE: "Expirée (60 jours)",
  RETIREE: "Retirée par toi",
  SUPPRIMEE_ADMIN: "Retirée par Nexus",
};

/** W4d : partenaire_prospects_terminees — le nom d'une réclamation seulement si le jeune lui est
 *  encore visible ; les autres issues restent sans nom. */
export async function chargerCartesTerminees(supabase: SupabaseClient): Promise<CarteTerminee[]> {
  const data = await lireTout<Record<string, unknown>>((de, a) => supabase
    .rpc("partenaire_prospects_terminees", {}, { count: "exact" }).select("*").order("carte_id").order("terminee_le").range(de, a));
  return data.map((r) => ({
    carteId: r.carte_id as string,
    issue: r.issue as IssueCarte,
    creeLe: r.carte_creee_le as string,
    termineeLe: r.terminee_le as string,
    profilVisible: r.profil_visible === true,
    athleteId: (r.athlete_id as string | null) ?? null,
    prenom: (r.prenom as string | null) ?? null,
    nom: (r.nom as string | null) ?? null,
    sport: (r.sport as string | null) ?? null,
    poste: (r.poste as string | null) ?? null,
    ecole: (r.ecole as string | null) ?? null,
    evaluation: (r.evaluation as string | null) ?? null,
    badges: ((r.badges as BadgeTransfert[] | null) ?? []),
  }));
}

/** Adresse du lien, sur le domaine où le partenaire travaille. */
export function adresseLien(origine: string, jeton: string): string {
  return `${origine.replace(/\/+$/, "")}/p/${jeton}`;
}

/** Texto pré-rempli : court, signé de l'organisation, sans nom du jeune ni
 *  évaluation (le message peut être lu par d'autres que lui). Sans évaluation
 *  sur la carte, il ne dit pas « t'a évalué » : il invite (BP 2026-10-16). */
export function messageTexto(organisation: string, adresse: string, evalue = true): string {
  return evalue
    ? `Salut! ${organisation} t'a évalué et t'invite à voir ton évaluation sur Nexus : ${adresse}\n— ${organisation}`
    : `Salut! ${organisation} t'invite sur Nexus : ${adresse}\n— ${organisation}`;
}

/** P4 (option a, BP 1.4.5) : Messages s'ouvre avec le message et le lien, SANS numéro — Nexus
 *  n'a aucune coordonnée du jeune, rien n'est saisi ni stocké. iOS lit le corps après « & »,
 *  Android après « ? » (même règle que le texto du recruteur, lib/cartes/renvoiInvitation). */
export function lienSms(message: string, ios: boolean): string {
  return `sms:${ios ? "&" : "?"}body=${encodeURIComponent(message)}`;
}

/** Message lisible pour une erreur d'une RPC W4 (refus « NEXUS: … » de la
 *  base, sinon le message générique fourni). */
export function messageErreurCarte(e: unknown, generique: string): string {
  const err = e as { code?: string; message?: string } | null;
  // Plafond serveur tant que 20261019103000 n'est pas appliquée (BP 2026-10-18 : aucun maximum).
  if (err?.code === "54000") return "Le nombre de cartes est encore limité sur le serveur. Retire une carte inutile pour en créer une autre.";
  return messageErreurNexus(err?.message) ?? generique;
}

/* ── Jeune ──────────────────────────────────────────────────────── */

export interface BadgeCarteJeune {
  libelle: string;
  nexus: boolean;
  code?: string;
  icone_path?: string | null;
}

/** Ce que le jeune voit d'une carte qui lui est réservée (prospect_partenaire_contenu). */
export interface CarteJeune {
  carteId: string;
  statut: "RESERVEE" | "CONFIRMEE_ATTENTE_OPTIN";
  /** Vrai : proposée par Nexus (rapprochement) ; faux : ouverte par le lien. */
  proposition: boolean;
  partenaire: string | null;
  prenom: string;
  nom: string;
  sport: string | null;
  position: string | null;
  ecole: string | null;
  equipe: string | null;
  promotion: number | null;
  coteGlobale: number | null;
  traits: Record<string, number>;
  badges: BadgeCarteJeune[];
  visibilitePartenaireActive: boolean;
  expireLe: string;
}

type ContenuBrut = {
  carte_id: string; statut: CarteJeune["statut"]; proposition: boolean; partenaire: string | null;
  prenom: string; nom: string; sport: string | null; position: string | null; ecole: string | null;
  equipe: string | null; promotion: number | null; cote_globale: number | string | null;
  traits: Record<string, number> | null; badges: BadgeCarteJeune[] | null;
  visibilite_partenaire_active: boolean; expire_le: string;
};

export function lireCarteJeune(r: ContenuBrut): CarteJeune {
  return {
    carteId: r.carte_id,
    statut: r.statut,
    proposition: !!r.proposition,
    partenaire: r.partenaire,
    prenom: r.prenom,
    nom: r.nom,
    sport: r.sport,
    position: r.position,
    ecole: r.ecole,
    equipe: r.equipe,
    promotion: r.promotion,
    coteGlobale: r.cote_globale == null ? null : Number(r.cote_globale),
    traits: r.traits ?? {},
    badges: r.badges ?? [],
    visibilitePartenaireActive: !!r.visibilite_partenaire_active,
    expireLe: r.expire_le,
  };
}

/** Ouvre le lien sous le compte connecté (réserve la carte). */
export async function ouvrirLien(supabase: SupabaseClient, jeton: string): Promise<CarteJeune> {
  const { data, error } = await supabase.rpc("prospect_partenaire_ouvrir", { p_jeton: jeton });
  if (error) throw error;
  return lireCarteJeune(data as ContenuBrut);
}

export async function chargerCartesJeune(supabase: SupabaseClient): Promise<CarteJeune[]> {
  const { data, error } = await supabase.rpc("prospect_partenaire_mes_cartes");
  if (error) throw error;
  return ((data ?? []) as ContenuBrut[]).map(lireCarteJeune);
}

export type ReponseConfirmation =
  | { statut: "transferee"; partenaire: string | null; evaluation: string; badgesTransferes: number }
  | { statut: "attente_optin"; partenaire: string | null; expireLe: string };

export async function confirmerCarte(supabase: SupabaseClient, carteId: string): Promise<ReponseConfirmation> {
  const { data, error } = await supabase.rpc("prospect_partenaire_confirmer", { p_carte: carteId });
  if (error) throw error;
  const r = data as {
    statut: string; partenaire?: string | null; expire_le?: string; evaluation?: string;
    badges?: { attribution: string | null }[];
  };
  if (r.statut === "attente_optin") {
    return { statut: "attente_optin", partenaire: r.partenaire ?? null, expireLe: r.expire_le ?? "" };
  }
  return {
    statut: "transferee",
    partenaire: r.partenaire ?? null,
    evaluation: r.evaluation ?? "aucune",
    badgesTransferes: (r.badges ?? []).filter((b) => b.attribution).length,
  };
}

export async function infirmerCarte(supabase: SupabaseClient, carteId: string): Promise<void> {
  const { error } = await supabase.rpc("prospect_partenaire_infirmer", { p_carte: carteId });
  if (error) throw error;
}

/* ── Le jeton côté jeune : de /p/[jeton] jusqu'après l'onboarding ── */

export const PROSPECT_STORAGE_KEY = "nexus_carte_partenaire";
// La carte vit 60 jours : au-delà, le lien est mort de toute façon.
const DUREE_MS = 60 * 24 * 60 * 60 * 1000;
const JETON_RE = /^[0-9a-f]{64}$/;

export function jetonCartePlausible(jeton: string | null | undefined): jeton is string {
  return typeof jeton === "string" && JETON_RE.test(jeton);
}

export function memoriserJetonCarte(jeton: string): void {
  if (!jetonCartePlausible(jeton)) return;
  try {
    localStorage.setItem(PROSPECT_STORAGE_KEY, JSON.stringify({ jeton, expire: Date.now() + DUREE_MS }));
  } catch { /* navigation privée : le jeune rouvrira le lien */ }
}

export function lireJetonCarte(): string | null {
  try {
    const brut = localStorage.getItem(PROSPECT_STORAGE_KEY);
    if (!brut) return null;
    const v = JSON.parse(brut) as { jeton?: string; expire?: number };
    if (!jetonCartePlausible(v.jeton) || typeof v.expire !== "number" || v.expire < Date.now()) {
      localStorage.removeItem(PROSPECT_STORAGE_KEY);
      return null;
    }
    return v.jeton;
  } catch {
    return null;
  }
}

export function oublierJetonCarte(): void {
  try { localStorage.removeItem(PROSPECT_STORAGE_KEY); } catch { /* ignoré */ }
}
