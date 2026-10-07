/* ═══════════════════════════════════════════════════════════════
   carteProspect — les CARTES PROSPECT (lot C) côté web.

   Une carte = un athlète qui n'est PAS ENCORE sur Nexus, suivi par une
   unité (cégep × sport) dans Mon processus. Elle vit dans la table
   cartes_prospect (migration lot_c_cartes_prospect) ; la RLS n'en rend la
   lecture qu'aux Pro de l'unité et à l'admin du cégep, l'écriture qu'aux Pro
   de l'unité.

   Pour ne pas dédoubler l'écran, une carte est convertie en
   PipelineKanbanCard (le format d'un dossier) avec un champ `carte` qui la
   distingue : kanban, tableau, filtres, tris, entonnoir et tuiles la lisent
   sans rien savoir d'elle. Seules les ÉCRITURES bifurquent (ecrireCarte,
   retirerCarte, notes) et le panneau (Infos, Historique).

   Ce module ne fait que des lectures/écritures ; aucune décision d'accès :
   c'est la base qui décide.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PipelineKanbanCard } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { isGrade, type Grade } from "@/lib/config/grades";
import type { InvitationEtat } from "@/lib/cartes/invitationEtat";
import { leagueOf } from "@/lib/config/team-taxonomy";

/** Rétention (décision BP) : purge 12 mois après la dernière activité,
 *  avis à l'écran 30 jours avant. */
export const RETENTION_MOIS = 12;
export const AVIS_JOURS = 30;

/** Ce que porte une carte en plus du format d'un dossier. */
export interface CarteMeta {
  prenom: string;
  nom: string;
  courriel: string | null;
  /** 10 chiffres (normalisé par la base) — Pro de l'unité seulement. */
  telephone: string | null;
  /** Le parent (décision BP 2026-09-30) : facultatif, Infos seulement, jamais
   *  exporté. Son courriel sert au rapprochement, jamais à l'envoi. */
  parentNom: string | null;
  parentCourriel: string | null;
  lienVideo: string | null;
  teamId: string | null;
  teamNom: string | null;
  /** L'établissement (école ou club) : celui de l'équipe, ou celui auquel la
   *  carte est rattachée seule quand l'établissement n'a aucune équipe du
   *  sport de l'unité (décision BP 2026-09-30). */
  schoolId: string | null;
  schoolNom: string | null;
  /** Le sport de L'ATHLÈTE (décision BP 2026-10-05) — distinct du sport de
   *  l'unité (`PipelineKanbanCard.sport`, le tableau qui contient la carte).
   *  Déduit de l'équipe quand il y en a une, choisi par le recruteur sinon. */
  sportAthleteId: string;
  sportAthleteNom: string;
  positionId: string | null;
  numero: string | null;
  promotion: number | null;
  creePar: string | null;
  creeLe: string;
  derniereActivite: string;
  /** Date de la purge automatique si rien ne bouge d'ici là. */
  expireLe: string;
  /** Invitation automatique envoyée (acceptée par Resend) — null sinon. */
  inviteeLe: string | null;
  /** NON_ENVOYEE : l'invitation a été écartée — la carte le dit, sans la raison. */
  invitationEtat: InvitationEtat | null;
  /** Rappels envoyés par Nexus (0..3) et date du dernier — écrits par la base. */
  renvoisInvitation: number;
  dernierRenvoiLe: string | null;
}

export type CarteKanban = PipelineKanbanCard & { carte: CarteMeta };

export function estCarte(c: PipelineKanbanCard | null | undefined): c is CarteKanban {
  return !!c && !!(c as Partial<CarteKanban>).carte;
}

/** Échéance de purge : dernière activité + 12 mois. */
export function expireLe(derniereActivite: string): string {
  const d = new Date(derniereActivite);
  d.setMonth(d.getMonth() + RETENTION_MOIS);
  return d.toISOString();
}

/** Jours restants avant la purge (négatif = déjà dépassé). */
export function joursAvantPurge(expire: string, maintenant = Date.now()): number {
  return Math.ceil((new Date(expire).getTime() - maintenant) / 86400000);
}

export function bientotPurgee(c: PipelineKanbanCard, maintenant = Date.now()): boolean {
  return estCarte(c) && joursAvantPurge(c.carte.expireLe, maintenant) <= AVIS_JOURS;
}

export interface LigneCarte {
  id: string;
  unite_cegep_id: string;
  unite_sport_id: string;
  cree_par: string | null;
  prenom: string;
  nom: string;
  team_id: string | null;
  position_id: string | null;
  numero: string | null;
  promotion: number | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  lien_video: string | null;
  courriel: string | null;
  telephone: string | null;
  parent_nom: string | null;
  parent_courriel: string | null;
  etape: string;
  grade: string | null;
  relance_le: string | null;
  relance_note: string | null;
  visite_le: string | null;
  drapeau: boolean;
  invitee_le: string | null;
  invitation_etat: InvitationEtat | null;
  renvois_invitation: number;
  dernier_renvoi_le: string | null;
  etape_le: string;
  derniere_activite: string;
  created_at: string;
  school_id: string | null;
  sport_athlete_id: string;
  teams: { name: string | null; division: string | null; league: string | null; age_group: string | null; gender: string | null; rseq_team_id: string | null; schools: { name: string | null; region: string | null; type: string | null } | null } | null;
  /** L'établissement de la carte (rattachement direct, sans équipe). */
  etablissement: { name: string | null; region: string | null; type: string | null } | null;
  positions: { abreviation: string | null } | null;
}

const SELECT_CARTE = `
  id, unite_cegep_id, unite_sport_id, cree_par, prenom, nom, team_id, position_id, numero, promotion,
  taille_pieds, taille_pouces, poids_lbs, lien_video, courriel, telephone, parent_nom, parent_courriel, etape, grade, relance_le, relance_note,
  visite_le, drapeau, invitee_le, invitation_etat, renvois_invitation, dernier_renvoi_le, etape_le, derniere_activite, created_at,
  school_id, sport_athlete_id,
  teams!team_id(name, division, league, age_group, gender, rseq_team_id, schools!school_id(name, region, type)),
  etablissement:schools!school_id(name, region, type),
  positions!position_id(abreviation)
`;

function un<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/** Lit les cartes lisibles (la RLS décide), filtrées comme le processus :
 *  l'unité de l'appelant par défaut, un sport précis, ou tout le cégep. */
export async function lireCartes(
  supabase: SupabaseClient,
  options: { cegepId: string | null; sportId: string | null; toutLeCegep?: boolean },
): Promise<LigneCarte[]> {
  let q = supabase.from("cartes_prospect").select(SELECT_CARTE);
  if (options.cegepId) q = q.eq("unite_cegep_id", options.cegepId);
  if (!options.toutLeCegep && options.sportId) q = q.eq("unite_sport_id", options.sportId);
  const { data, error } = await q.order("etape_le", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as LigneCarte[]).map((l) => ({
    ...l,
    teams: un(l.teams as never) as LigneCarte["teams"],
    positions: un(l.positions as never) as LigneCarte["positions"],
  }));
}

/** Des cartes précises, par id (membres d'une liste). */
export async function lireCartesParIds(supabase: SupabaseClient, ids: string[]): Promise<LigneCarte[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("cartes_prospect").select(SELECT_CARTE).in("id", ids);
  if (error) throw error;
  return ((data ?? []) as unknown as LigneCarte[]).map((l) => ({
    ...l,
    teams: un(l.teams as never) as LigneCarte["teams"],
    positions: un(l.positions as never) as LigneCarte["positions"],
  }));
}

/** Une carte au format d'un membre de liste. */
export function versMembreListe(l: LigneCarte, nomSport: string) {
  return {
    id: l.id,
    identity_visible: true,
    full_name: `${l.prenom} ${l.nom}`.trim(),
    photo_url: "",
    jersey: l.numero ?? "",
    sport: nomSport,
    position: l.positions?.abreviation ?? "",
    school: l.teams?.schools?.name ?? l.etablissement?.name ?? "",
    division: "D1" as const,
    graduation_year: l.promotion ?? 0,
    coach_rating: 0,
    is_verified: false,
    pipeline_status: (l.etape || "IDENTIFIE").toLowerCase() as RecruitmentStatus,
    added_at: "",
    recruiter_note: "",
    priority: false,
    prospect: true as const,
  };
}

/** Dernière note par carte, avec son auteur (colonne « Note de suivi »). */
export async function lireDernieresNotesCartes(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, { content: string; created_at: string; auteur: string | null }>> {
  const out: Record<string, { content: string; created_at: string; auteur: string | null }> = {};
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("cartes_prospect_notes")
    .select("carte_id, contenu, created_at, auteur")
    .in("carte_id", ids)
    .order("created_at", { ascending: false });
  if (error) { console.error("[cartes] dernières notes :", error.message); return out; }
  for (const n of (data ?? []) as { carte_id: string; contenu: string; created_at: string; auteur: string | null }[]) {
    if (!out[n.carte_id]) out[n.carte_id] = { content: n.contenu, created_at: n.created_at, auteur: n.auteur };
  }
  return out;
}

/** Une carte au format d'un dossier du kanban. */
export function versKanban(
  l: LigneCarte,
  contexte: {
    nomSport: (sportId: string) => string;
    nomAuteur: (id: string | null) => string;
    derniereNote?: { content: string; created_at: string; auteur: string | null } | null;
  },
): CarteKanban {
  const jours = Math.floor((Date.now() - new Date(l.etape_le).getTime()) / 86400000);
  // Sans équipe, l'établissement de rattachement (école ou club).
  const ecole = l.teams?.schools ?? l.etablissement ?? null;
  const expire = expireLe(l.derniere_activite);
  // Le sport de L'ATHLÈTE (décision BP 2026-10-05) — peut différer de celui
  // de l'unité (le tableau qui contient la carte ne bouge pas). C'est LUI qui
  // définit l'équipe (teamNom plus bas), jamais le sport de l'unité.
  const nomSportAthlete = contexte.nomSport(l.sport_athlete_id);
  // Même règle que les dossiers (leagueOf) : équipe d'école sans ligue = RSEQ.
  // Hissé ici (plutôt que recalculé deux fois) : sert au champ `ligue` ET à
  // libeller l'équipe dans Infos (teamNom), qui veut sport·catégorie·division
  // · ligue · genre — teams.name ne définit rien, il porte parfois le nom de
  // l'école (saisie coach), jamais la ligue (déduite, jamais stockée pour une
  // équipe RSEQ).
  const ligueEquipe = l.teams
    ? leagueOf({ context: null, schoolType: null, teamDivision: l.teams.division, teamLeague: l.teams.league, teamIsRseq: !!l.teams.rseq_team_id, hasTeam: true, teamSchoolType: l.teams.schools?.type ?? null }) ?? ""
    : "";
  return {
    id: l.id,
    pipeline_id: l.id,
    full_name: `${l.prenom} ${l.nom}`.trim(),
    identityVisible: true,
    photo_url: "",
    // Le sport DE L'ATHLÈTE (décision BP 2026-10-05), pas celui de l'unité
    // (le tableau qui contient la carte) — c'est lui que les pastilles du
    // kanban, le filtre Sport du tableau et le calendrier doivent lire. Le
    // retour BP du 2026-10-06 confirme : « enregistrée comme Basketball »
    // décrivait exactement ce `sport` encore posé sur l'unité ici.
    sport: nomSportAthlete,
    position: l.positions?.abreviation ?? "",
    school: ecole?.name ?? "",
    region: ecole?.region ?? "",
    school_type: ecole?.type ?? null,
    division: "D1",
    graduation_year: l.promotion ?? 0,
    coach_rating: 0,
    profile_completeness: 0,
    is_verified: false,
    has_video: !!l.lien_video,
    jersey: l.numero ?? "",
    recruitment_status: "OUVERT",
    committed_school_name: "",
    open_to_offers: null,
    status: (l.etape || "IDENTIFIE").toLowerCase() as RecruitmentStatus,
    days_in_status: jours,
    notes: "",
    last_activity: `Mis à jour il y a ${jours} jours`,
    flagged: !!l.drapeau,
    next_action_at: l.relance_le,
    next_action_note: l.relance_note,
    visit_at: l.visite_le,
    moved_at: l.etape_le,
    // « Ligue civile » est pour un athlète SANS établissement ; une carte en a
    // toujours un (son équipe ou son rattachement direct).
    noTeam: !l.team_id && !l.school_id,
    grade: isGrade(l.grade ?? "") ? (l.grade as Grade) : null,
    taille_pieds: l.taille_pieds,
    taille_pouces: l.taille_pouces,
    poids_lbs: l.poids_lbs,
    derniere_note: contexte.derniereNote
      ? { content: contexte.derniereNote.content, created_at: contexte.derniereNote.created_at, auteur: contexte.nomAuteur(contexte.derniereNote.auteur) }
      : null,
    suivi_par: l.cree_par ? [l.cree_par] : [],
    suivi_par_noms: l.cree_par ? [contexte.nomAuteur(l.cree_par)] : [],
    unite_sport_id: l.unite_sport_id,
    division_equipe: l.teams?.division ?? null,
    ligue: ligueEquipe,
    carte: {
      prenom: l.prenom,
      nom: l.nom,
      courriel: l.courriel,
      telephone: l.telephone,
      parentNom: l.parent_nom,
      parentCourriel: l.parent_courriel,
      lienVideo: l.lien_video,
      teamId: l.team_id,
      teamNom: l.teams ? libelleEquipeComplet(nomSportAthlete, { ...l.teams, name: l.teams.name ?? "" }, ligueEquipe) : null,
      schoolId: l.school_id,
      schoolNom: ecole?.name ?? null,
      sportAthleteId: l.sport_athlete_id,
      sportAthleteNom: nomSportAthlete,
      positionId: l.position_id,
      numero: l.numero,
      promotion: l.promotion,
      creePar: l.cree_par,
      creeLe: l.created_at,
      derniereActivite: l.derniere_activite,
      expireLe: expire,
      inviteeLe: l.invitee_le,
      invitationEtat: l.invitation_etat,
      renvoisInvitation: l.renvois_invitation ?? 0,
      dernierRenvoiLe: l.dernier_renvoi_le,
    },
  };
}

/* ── ÉCRITURES ─────────────────────────────────────────────────────
   Les champs arrivent sous leur nom de DOSSIER (ceux qu'écrit déjà la page :
   stage, visit_at, next_action_at, next_action_note, flagged, grade) et sont
   traduits vers les colonnes de la carte — un seul appelant, deux tables. */
const VERS_COLONNE: Record<string, string> = {
  stage: "etape",
  visit_at: "visite_le",
  next_action_at: "relance_le",
  next_action_note: "relance_note",
  flagged: "drapeau",
  grade: "grade",
  telephone: "telephone",
  teamId: "team_id",
  parentNom: "parent_nom",
  parentCourriel: "parent_courriel",
};

export async function ecrireCarte(supabase: SupabaseClient, carteId: string, champs: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(champs)) {
    const colonne = VERS_COLONNE[cle];
    if (colonne) patch[colonne] = valeur;
  }
  if (Object.keys(patch).length === 0) return null;
  const { error } = await supabase.from("cartes_prospect").update(patch).eq("id", carteId);
  if (error) console.error("[cartes] écriture :", error.message);
  return error;
}

/** Retirer = SUPPRIMER (décision BP) ; la base garde une trace minimale. */
export async function retirerCarte(supabase: SupabaseClient, carteId: string) {
  const { error } = await supabase.from("cartes_prospect").delete().eq("id", carteId);
  if (error) console.error("[cartes] retrait :", error.message);
  return error;
}

export async function ajouterNoteCarte(supabase: SupabaseClient, carteId: string, contenu: string) {
  const { error } = await supabase.from("cartes_prospect_notes").insert({ carte_id: carteId, contenu: contenu.trim() });
  if (error) console.error("[cartes] note :", error.message);
  return error;
}

/* ── CRÉATION ──────────────────────────────────────────────────── */
export interface NouvelleCarte {
  prenom: string;
  nom: string;
  /** null : l'établissement n'a aucune équipe DE CE SPORT — rattachement direct. */
  teamId: string | null;
  schoolId: string;
  /** Le sport de l'athlète (décision BP 2026-10-05). Ignoré par la base
   *  quand `teamId` est posé — elle le déduit alors de l'équipe ; requis et
   *  faisant foi seulement quand `teamId` est null. */
  sportAthleteId: string;
  positionId: string | null;
  numero: string | null;
  promotion: number | null;
  taillePieds: number | null;
  taillePouces: number | null;
  poidsLbs: number | null;
  lienVideo: string | null;
  courriel: string | null;
  telephone: string | null;
  parentNom: string | null;
  parentCourriel: string | null;
}

export async function creerCarte(supabase: SupabaseClient, c: NouvelleCarte) {
  const { data, error } = await supabase
    .from("cartes_prospect")
    .insert({
      prenom: c.prenom.trim(),
      nom: c.nom.trim(),
      team_id: c.teamId,
      school_id: c.schoolId,
      sport_athlete_id: c.sportAthleteId,
      position_id: c.positionId,
      numero: c.numero?.trim() || null,
      promotion: c.promotion,
      taille_pieds: c.taillePieds,
      taille_pouces: c.taillePouces,
      poids_lbs: c.poidsLbs,
      lien_video: c.lienVideo?.trim() || null,
      courriel: c.courriel?.trim() || null,
      telephone: c.telephone || null,
      parent_nom: c.parentNom?.trim() || null,
      parent_courriel: c.parentCourriel?.trim() || null,
    })
    .select("id")
    .single();
  return { id: (data?.id as string | undefined) ?? null, error };
}

/* ── DOUBLONS (retour BP : avertir, jamais bloquer) ─────────────────
   Déclencheur : même NOM normalisé + même ÉTABLISSEMENT (l'école ou le club
   de l'équipe), avec un prénom COMPATIBLE — composé ou abrégé :
   « Bruno-Philippe » ↔ « Bruno », « Alex » ↔ « Alexandre », « J. » ↔ « Jean ».
   Plus : le même COURRIEL qu'une carte de l'unité ou qu'un athlète Nexus. */

/** Minuscules, sans accents, espaces resserrés. */
export function normaliserNom(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Deux prénoms désignent-ils possiblement la même personne ? Le premier
 *  élément de l'un est le début du premier élément de l'autre. */
export function prenomsCompatibles(a: string, b: string): boolean {
  const premier = (s: string) => normaliserNom(s).split(/[\s.\-']+/).filter(Boolean)[0] ?? "";
  const x = premier(a);
  const y = premier(b);
  if (!x || !y) return false;
  return x.startsWith(y) || y.startsWith(x);
}

/** Même personne probable : nom identique (normalisé) et prénoms compatibles. */
export function memePersonneProbable(p1: string, n1: string, p2: string, n2: string): boolean {
  return normaliserNom(n1) !== "" && normaliserNom(n1) === normaliserNom(n2) && prenomsCompatibles(p1, p2);
}

/** Cartes de l'unité (le sport ; la RLS borne au cégep) du même établissement
 *  — par l'équipe OU par rattachement direct (cartes.school_id, rempli dans
 *  tous les cas) —, au même nom avec un prénom compatible. */
export async function cartesDoublons(
  supabase: SupabaseClient,
  c: { prenom: string; nom: string; sportId: string; schoolId: string },
): Promise<{ prenom: string; nom: string }[]> {
  const { data } = await supabase
    .from("cartes_prospect")
    .select("prenom, nom")
    .eq("unite_sport_id", c.sportId)
    .eq("school_id", c.schoolId);
  return ((data ?? []) as unknown as { prenom: string; nom: string }[])
    .filter((l) => memePersonneProbable(c.prenom, c.nom, l.prenom, l.nom));
}

/** Une carte de l'unité porte-t-elle déjà ce courriel ? */
export async function carteAuCourriel(
  supabase: SupabaseClient,
  courriel: string,
  sportId: string,
): Promise<{ prenom: string; nom: string } | null> {
  const q = courriel.trim();
  if (!q) return null;
  const { data } = await supabase
    .from("cartes_prospect")
    .select("prenom, nom")
    .eq("unite_sport_id", sportId)
    .ilike("courriel", q.replace(/[%_\\]/g, (m) => `\\${m}`))
    .limit(1);
  return ((data ?? []) as { prenom: string; nom: string }[])[0] ?? null;
}

/** Un athlète Nexus porte-t-il ce courriel ? La base ne le rend QUE si son
 *  identité est visible pour l'appelant — un athlète masqué n'est jamais
 *  suggéré (athlete_nexus_par_courriel). */
export async function athleteAuCourriel(
  supabase: SupabaseClient,
  courriel: string,
): Promise<{ id: string; first_name: string | null; last_name: string | null } | null> {
  const q = courriel.trim();
  if (!q) return null;
  const { data, error } = await supabase.rpc("athlete_nexus_par_courriel", { p_courriel: q });
  if (error) { console.error("[cartes] courriel :", error.message); return null; }
  return ((data ?? []) as { id: string; first_name: string | null; last_name: string | null }[])[0] ?? null;
}

/* ── LISTES (retour BP) : une carte dans une liste de son unité ────── */
export async function ajouterCarteAListe(supabase: SupabaseClient, listId: string, carteId: string) {
  const { error } = await supabase.from("cartes_prospect_listes").insert({ list_id: listId, carte_id: carteId });
  if (error && error.code !== "23505") console.error("[cartes] liste :", error.message);
  return error && error.code !== "23505" ? error : null;
}

export async function retirerCarteDeListe(supabase: SupabaseClient, listId: string, carteId: string) {
  const { error } = await supabase.from("cartes_prospect_listes").delete().eq("list_id", listId).eq("carte_id", carteId);
  if (error) console.error("[cartes] liste (retrait) :", error.message);
  return error;
}

/** Libellé d'une équipe : « Football juvénile D1 · Masculin ». */
export function libelleEquipe(sport: string, e: { name: string; age_group: string | null; division: string | null; gender: string | null }): string {
  const corps = [sport, e.age_group?.toLowerCase(), e.division].filter(Boolean).join(" ");
  const base = e.age_group || e.division ? corps : [sport, e.name].filter(Boolean).join(" — ");
  return e.gender ? `${base} · ${e.gender}` : base;
}

/** Libellé COMPLET d'une équipe, ligue incluse : « Football juvénile D2 ·
 *  RSEQ · Masculin ». Ce qui définit une équipe (retour BP) — jamais
 *  teams.name, qui ne porte ni sport ni catégorie et porte parfois le nom de
 *  l'école (saisie coach). La ligue se passe déjà calculée (leagueOf) :
 *  teams.league est souvent NULL pour une équipe RSEQ, déduite jamais stockée. */
export function libelleEquipeComplet(
  sport: string,
  e: { name: string; age_group: string | null; division: string | null; gender: string | null },
  ligue: string,
): string {
  const corps = [sport, e.age_group?.toLowerCase(), e.division].filter(Boolean).join(" ");
  const base = e.age_group || e.division ? corps : [sport, e.name].filter(Boolean).join(" — ");
  return [base, ligue, e.gender].filter(Boolean).join(" · ");
}

/* ── MON CÉGEP (admin) ──────────────────────────────────────────────
   Les cartes de TOUT le cégep que l'admin lit (la RLS le lui permet, en
   lecture seule), restreintes aux sports des recruteurs retenus par le
   filtre « Sport de l'unité » (`sportsRetenus` null = tous). */
export interface CarteCegep {
  id: string;
  prenom: string;
  nom: string;
  etape: string;
  sportId: string;
  creePar: string | null;
  positionAbbr: string;
  ecole: string;
  region: string;
  promotion: number | null;
  miseAJour: string;
}

export async function lireCartesCegep(
  supabase: SupabaseClient,
  cegepId: string,
  sportsRetenus: Set<string> | null,
): Promise<CarteCegep[]> {
  let lignes: LigneCarte[] = [];
  try {
    lignes = await lireCartes(supabase, { cegepId, sportId: null, toutLeCegep: true });
  } catch (e) {
    console.error("[cartes] Mon CÉGEP :", e instanceof Error ? e.message : String(e));
    return [];
  }
  return lignes
    .filter((l) => !sportsRetenus || sportsRetenus.has(l.unite_sport_id))
    .map((l) => ({
      id: l.id,
      prenom: l.prenom,
      nom: l.nom,
      etape: l.etape,
      sportId: l.unite_sport_id,
      creePar: l.cree_par,
      positionAbbr: l.positions?.abreviation ?? "",
      ecole: l.teams?.schools?.name ?? "",
      region: l.teams?.schools?.region ?? "",
      promotion: l.promotion,
      miseAJour: l.etape_le,
    }));
}
