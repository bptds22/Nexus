import type { SupabaseClient } from "@supabase/supabase-js";
import { lireTout } from "@/lib/supabase/lireTout";
import {
  inscriptionDeFiche,
  lireComptesSansFiche,
  repartitionComptesAthletes,
  EMBED_COMPTE,
} from "@/lib/admin/comptesAthletes";
import { ACTIONS_CARTES_EXCLUES, compterDans, type Comparaison, type Fenetre } from "@/lib/admin/ecranMural";

/* ═══════════════════════════════════════════════════════════════
   Indicateurs admin — UNE définition pour l'écran mural (/admin/ecran)
   et le QG (/admin/qg). Sortis de app/api/admin/ecran/route.ts le
   2026-10-22, sans changer leur sens.

   - `chargerLignes` : ce qu'on lit (session de l'admin là où une règle
     admin existe, clé de service pour les 4 tables qui n'en ont pas).
     À appeler APRÈS la garde de la route.
   - le reste : des calculs purs sur ces lignes.

   Les identifiants lus servent à compter (recruteurs distincts, athlètes
   vus) et ne quittent pas le serveur : les routes ne renvoient que des
   nombres (Loi 25).
═══════════════════════════════════════════════════════════════ */

type Resultat = { data: unknown; error: { message: string } | null; count?: number | null };

/** Nombre exact de lignes, sans en lire aucune. Une erreur est levée. */
export async function compter(requete: PromiseLike<Resultat>, quoi: string): Promise<number> {
  const { count, error } = await requete;
  if (error) throw new Error(`${quoi}: ${error.message}`);
  return count ?? 0;
}

/* Toutes les lignes d'une requête, triées sur `id` (lireTout l'exige). */
type Page = { order: (c: string) => { range: (de: number, a: number) => PromiseLike<Resultat> } };
export function toutLire<T>(requete: () => Page): Promise<T[]> {
  return lireTout<T>((de, a) => requete().order("id").range(de, a));
}

export function comparer(dates: (string | null | undefined)[], f: { courant: Fenetre; precedent: Fenetre }): Comparaison {
  return { courant: compterDans(dates, f.courant), precedent: compterDans(dates, f.precedent) };
}

export function dansFenetre(d: string | null | undefined, f: Fenetre): boolean {
  return compterDans([d], f) === 1;
}

export interface Fiche { id: string; user_id: string | null; compte: unknown; profile_completion: number | null; verified: boolean | null }

export interface Lignes {
  fiches: Fiche[];
  sansFiche: { inscrit_le?: string | null }[];
  comptes: { id: string; role: string; created_at: string | null }[];
  vues: { recruiter_id: string; viewed_at: string | null }[];
  vuesAthletes: { athlete_id: string }[];
  favoris: { recruiter_id: string; created_at: string | null }[];
  journalProcessus: { recruiter_id: string; created_at: string | null }[];
  messages: { sender_id: string; created_at: string | null }[];
  suivis: { athlete_id: string }[];
  journalCartes: { acteur: string | null; created_at: string | null }[];
  notesMatch: { auteur: string | null; note_le: string | null }[];
  ecolesNonListees: number;
  loi25Portabilite: number;
  loi25Suppression: number;
  reclamations: number;
  statsV2: Record<string, number>;
  invReclamees: number;
  invEnAttente: number;
  invExpirees: number;
  athletesActifs: number;
}

/** Tout ce que les deux écrans lisent. Les journaux d'activité sont lus à
 *  partir de `depuis` (ISO) ; le reste, en entier. */
export async function chargerLignes(sb: SupabaseClient, sv: SupabaseClient, depuis: string, maintenant: Date): Promise<Lignes> {
  const nowIso = maintenant.toISOString();
  const [
    fiches, sansFiche, comptes, vues, vuesAthletes, favoris, journalProcessus,
    messages, suivis, ecolesNonListees, loi25Portabilite, reclamations, statsV2,
    journalCartes, notesMatch, invReclamees, invEnAttente, invExpirees, loi25Suppression,
    athletesActifs,
  ] = await Promise.all([
    // ── Session de l'admin ──
    toutLire<Fiche>(
      () => sb.from("athletes").select(`id, user_id, profile_completion, verified, ${EMBED_COMPTE}`, { count: "exact" })),
    lireComptesSansFiche<{ inscrit_le?: string | null }>(sb),
    toutLire<{ id: string; role: string; created_at: string | null }>(
      () => sb.from("users").select("id, role, created_at", { count: "exact" })),
    toutLire<{ recruiter_id: string; viewed_at: string | null }>(
      () => sb.from("recruiter_athlete_views").select("id, recruiter_id, viewed_at", { count: "exact" }).gte("viewed_at", depuis)),
    toutLire<{ athlete_id: string }>(
      () => sb.from("recruiter_athlete_views").select("id, athlete_id", { count: "exact" })),
    toutLire<{ recruiter_id: string; created_at: string | null }>(
      () => sb.from("recruiter_favorites").select("id, recruiter_id, created_at", { count: "exact" }).gte("created_at", depuis)),
    toutLire<{ recruiter_id: string; created_at: string | null }>(
      () => sb.from("recruiter_activity_log").select("id, recruiter_id, created_at", { count: "exact" })
        .eq("action_type", "PIPELINE_CHANGED").gte("created_at", depuis)),
    toutLire<{ sender_id: string; created_at: string | null }>(
      () => sb.from("messages").select("id, sender_id, created_at", { count: "exact" }).gte("created_at", depuis)),
    toutLire<{ athlete_id: string }>(
      () => sb.from("recruiter_pipeline").select("id, athlete_id", { count: "exact" })),
    compter(sb.from("athletes").select("id", { count: "exact", head: true })
      .not("ecole_non_listee", "is", null).is("school_id", null), "ecoles_non_listees"),
    compter(sb.from("loi25_portability_requests").select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]), "loi25_portability_requests"),
    compter(sb.from("admin_claims").select("id", { count: "exact", head: true })
      .eq("status", "PENDING"), "admin_claims"),
    sb.rpc("admin_consentement_partenaire_stats"),
    // ── Clé de service : les 4 tables sans règle admin ──
    toutLire<{ acteur: string | null; created_at: string | null }>(
      () => sv.from("cartes_prospect_journal").select("id, acteur, created_at", { count: "exact" })
        .not("action", "in", `(${ACTIONS_CARTES_EXCLUES.join(",")})`).gte("created_at", depuis)),
    toutLire<{ auteur: string | null; note_le: string | null }>(
      () => sv.from("match_notes").select("id, auteur, note_le", { count: "exact" }).gte("note_le", depuis)),
    compter(sv.from("parent_invitations").select("id", { count: "exact", head: true })
      .not("claimed_at", "is", null), "parent_invitations"),
    compter(sv.from("parent_invitations").select("id", { count: "exact", head: true })
      .is("claimed_at", null).gt("expires_at", nowIso), "parent_invitations"),
    compter(sv.from("parent_invitations").select("id", { count: "exact", head: true })
      .is("claimed_at", null).lte("expires_at", nowIso), "parent_invitations"),
    compter(sv.from("deletion_requests").select("id", { count: "exact", head: true })
      .in("status", ["PENDING", "IN_PROGRESS"]), "deletion_requests"),
    // ── Session de l'admin ──
    compter(sb.from("athletes").select("id", { count: "exact", head: true }).eq("status", "ACTIF"), "athletes_actifs"),
  ]);

  if (statsV2.error) throw new Error(`admin_consentement_partenaire_stats: ${statsV2.error.message}`);

  return {
    fiches, sansFiche, comptes, vues, vuesAthletes, favoris, journalProcessus, messages, suivis,
    journalCartes, notesMatch, ecolesNonListees, loi25Portabilite, loi25Suppression, reclamations,
    statsV2: (statsV2.data ?? {}) as Record<string, number>,
    invReclamees, invEnAttente, invExpirees, athletesActifs,
  };
}

/* ── Définitions ─────────────────────────────────────────────── */

export interface Activite {
  recruteurs: Set<string>;
  messagesRecruteurs: Lignes["messages"];
  notesRecruteurs: Lignes["notesMatch"];
}

/** Messages et notes de match : seulement ceux écrits par un compte RECRUTEUR. */
export function activiteRecruteurs(l: Lignes): Activite {
  const recruteurs = new Set(l.comptes.filter((c) => c.role === "RECRUTEUR").map((c) => c.id));
  return {
    recruteurs,
    messagesRecruteurs: l.messages.filter((m) => recruteurs.has(m.sender_id)),
    notesRecruteurs: l.notesMatch.filter((n) => n.auteur && recruteurs.has(n.auteur)),
  };
}

/** Recruteurs actifs : ont consulté, mis en favori, déplacé, écrit, noté ou suivi une carte. */
export function recruteursActifs(l: Lignes, a: Activite, fen: Fenetre): number {
  const ids = new Set<string>();
  for (const v of l.vues) if (dansFenetre(v.viewed_at, fen)) ids.add(v.recruiter_id);
  for (const x of l.favoris) if (dansFenetre(x.created_at, fen)) ids.add(x.recruiter_id);
  for (const x of l.journalProcessus) if (dansFenetre(x.created_at, fen)) ids.add(x.recruiter_id);
  for (const x of a.messagesRecruteurs) if (dansFenetre(x.created_at, fen)) ids.add(x.sender_id);
  for (const x of a.notesRecruteurs) if (dansFenetre(x.note_le, fen)) ids.add(x.auteur as string);
  for (const x of l.journalCartes) if (x.acteur && a.recruteurs.has(x.acteur) && dansFenetre(x.created_at, fen)) ids.add(x.acteur);
  return ids.size;
}

/** Les dates de chaque série d'activité recruteur (mêmes définitions que les tuiles). */
export function datesActivite(l: Lignes, a: Activite) {
  return {
    profils_consultes: l.vues.map((v) => v.viewed_at),
    favoris: l.favoris.map((x) => x.created_at),
    mouvements_processus: l.journalProcessus.map((x) => x.created_at),
    suivi_cartes: l.journalCartes.map((x) => x.created_at),
    notes_match: a.notesRecruteurs.map((x) => x.note_le),
    messages: a.messagesRecruteurs.map((x) => x.created_at),
  };
}

/** Parcours d'inscription en 5 étapes, sur les fiches des comptes athlètes (complète / commencée). */
export function parcoursInscription(l: Lignes) {
  const repartition = repartitionComptesAthletes(l.fiches.map(inscriptionDeFiche), l.sansFiche.length);
  const inscrites = l.fiches.filter((x) => {
    const i = inscriptionDeFiche(x);
    return i === "complete" || i === "commencee";
  });
  const vus = new Set(l.vuesAthletes.map((v) => v.athlete_id));
  const suivisIds = new Set(l.suivis.map((p) => p.athlete_id));
  return {
    inscrits: repartition.comptes,
    profil_80: inscrites.filter((x) => (x.profile_completion ?? 0) >= 80).length,
    valide_coach: inscrites.filter((x) => x.verified === true).length,
    vu_recruteur: inscrites.filter((x) => vus.has(x.id)).length,
    suivi_recruteur: inscrites.filter((x) => suivisIds.has(x.id)).length,
  };
}

/** Consentements partenaires v2, 4 cases (décision BP 2026-10-22) :
 *  acceptés, refusés, en attente (question posée, sans réponse : « plus tard »,
 *  demande au parent, push) et jamais demandé. Les 4 font le total. */
export function consentementsV2(v2: Record<string, number>) {
  return {
    acceptes: Number(v2.accepte_v2 ?? 0),
    refuses: Number(v2.refuse_v2 ?? 0),
    en_attente: Number(v2.en_attente ?? 0),
    jamais_demande: Number(v2.jamais_demande ?? 0),
  };
}

/** Files d'attente de l'admin (comptes seulement). */
export function filesAttente(l: Lignes) {
  return {
    invitations_parent: { reclamees: l.invReclamees, en_attente: l.invEnAttente, expirees: l.invExpirees },
    consentements_v2: consentementsV2(l.statsV2),
    ecoles_non_listees: l.ecolesNonListees,
    loi25_ouvertes: l.loi25Portabilite + l.loi25Suppression,
    reclamations_etablissement: l.reclamations,
  };
}
