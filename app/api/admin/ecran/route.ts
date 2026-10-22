import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { lireTout } from "@/lib/supabase/lireTout";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";
import {
  datesCreationComptes,
  inscriptionDeFiche,
  lireComptesSansFiche,
  repartitionComptesAthletes,
  EMBED_COMPTE,
} from "@/lib/admin/comptesAthletes";
import {
  ACTIONS_CARTES_EXCLUES,
  compterDans,
  debutsSemaines,
  fenetres7Jours,
  libelleSemaine,
  parSemaine,
  type Comparaison,
  type EcranMuralDonnees,
  type Fenetre,
} from "@/lib/admin/ecranMural";

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/ecran — les chiffres de l'écran mural (/admin/ecran).

   ── CE QUI SORT D'ICI : DES NOMBRES, RIEN D'AUTRE (Loi 25) ────
   Tout est lu et compté sur le serveur. La réponse ne porte aucun nom,
   courriel ni identifiant de personne : des totaux, des libellés de
   semaine et l'heure du calcul. Les identifiants lus pour compter
   (recruteurs distincts, athlètes vus) ne quittent pas cette fonction.

   ── LA GARDE ─────────────────────────────────────────────────
   Le layout /admin ne protège pas /api : cette route a la sienne.
   - pas de session → 401 ;
   - pas `is_platform_admin` (la garde des pages /admin) → 403 ;
   - pas `is_admin()` (rôle ADMIN) → 403 aussi. Les règles d'accès des
     tables lues ici testent `is_admin()`, pas `is_platform_admin` : un
     compte qui n'aurait que le second verrait des zéros, sans erreur.

   ── DEUX CLIENTS ─────────────────────────────────────────────
   Session de l'admin (RLS) partout où une règle admin existe. Clé de
   service, APRÈS la garde, pour les 4 tables qu'aucune règle ne laisse
   lire à l'admin (vérifié en local et en prod le 2026-10-22) :
   cartes_prospect_journal, parent_invitations, deletion_requests,
   match_notes. Rien d'autre ne passe par la clé de service.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const SANS_CACHE = { "Cache-Control": "no-store" };

function refus(status: 401 | 403, error: string) {
  return NextResponse.json({ error }, { status, headers: SANS_CACHE });
}

type Resultat = { data: unknown; error: { message: string } | null; count?: number | null };

/** Nombre exact de lignes, sans en lire aucune. Une erreur est levée. */
async function compter(requete: PromiseLike<Resultat>, quoi: string): Promise<number> {
  const { count, error } = await requete;
  if (error) throw new Error(`${quoi}: ${error.message}`);
  return count ?? 0;
}

/* Toutes les lignes d'une requête, triées sur `id` (lireTout l'exige). */
type Page = { order: (c: string) => { range: (de: number, a: number) => PromiseLike<Resultat> } };
function toutLire<T>(requete: () => Page): Promise<T[]> {
  return lireTout<T>((de, a) => requete().order("id").range(de, a));
}

function comparer(dates: (string | null | undefined)[], f: { courant: Fenetre; precedent: Fenetre }): Comparaison {
  return { courant: compterDans(dates, f.courant), precedent: compterDans(dates, f.precedent) };
}

function dansFenetre(d: string | null | undefined, f: Fenetre): boolean {
  return compterDans([d], f) === 1;
}

export async function GET() {
  // 1. Authentifier
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return refus(401, "Non authentifié");

  // 2. Autoriser — les deux définitions d'admin (voir l'en-tête).
  const [plateforme, admin] = await Promise.all([
    sb.rpc("is_platform_admin", { uid: user.id }),
    sb.rpc("is_admin"),
  ]);
  if (plateforme.error || admin.error || plateforme.data !== true || admin.data !== true) {
    return refus(403, "Accès refusé — administrateur requis");
  }

  // 3. Clé de service : seulement maintenant, et seulement pour 4 tables.
  const sv = createServiceClient();

  const maintenant = new Date();
  const f7 = fenetres7Jours(maintenant);
  const semaines = debutsSemaines(maintenant, 12);
  const depuis14 = f7.precedent.de.toISOString();
  const nowIso = maintenant.toISOString();

  try {
    const [
      fiches, sansFiche, comptes, vues, vuesAthletes, favoris, journalProcessus,
      messages, suivis, ecolesNonListees, loi25Portabilite, reclamations, statsV2,
      journalCartes, notesMatch, invReclamees, invEnAttente, invExpirees, loi25Suppression,
      actifs,
    ] = await Promise.all([
      // ── Session de l'admin ──
      toutLire<{ id: string; user_id: string | null; compte: unknown; profile_completion: number | null; verified: boolean | null }>(
        () => sb.from("athletes").select(`id, user_id, profile_completion, verified, ${EMBED_COMPTE}`, { count: "exact" })),
      lireComptesSansFiche<{ inscrit_le?: string | null }>(sb),
      toutLire<{ id: string; role: string; created_at: string | null }>(
        () => sb.from("users").select("id, role, created_at", { count: "exact" })),
      toutLire<{ recruiter_id: string; viewed_at: string | null }>(
        () => sb.from("recruiter_athlete_views").select("id, recruiter_id, viewed_at", { count: "exact" }).gte("viewed_at", depuis14)),
      toutLire<{ athlete_id: string }>(
        () => sb.from("recruiter_athlete_views").select("id, athlete_id", { count: "exact" })),
      toutLire<{ recruiter_id: string; created_at: string | null }>(
        () => sb.from("recruiter_favorites").select("id, recruiter_id, created_at", { count: "exact" }).gte("created_at", depuis14)),
      toutLire<{ recruiter_id: string; created_at: string | null }>(
        () => sb.from("recruiter_activity_log").select("id, recruiter_id, created_at", { count: "exact" })
          .eq("action_type", "PIPELINE_CHANGED").gte("created_at", depuis14)),
      toutLire<{ sender_id: string; created_at: string | null }>(
        () => sb.from("messages").select("id, sender_id, created_at", { count: "exact" }).gte("created_at", depuis14)),
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
          .not("action", "in", `(${ACTIONS_CARTES_EXCLUES.join(",")})`).gte("created_at", depuis14)),
      toutLire<{ auteur: string | null; note_le: string | null }>(
        () => sv.from("match_notes").select("id, auteur, note_le", { count: "exact" }).gte("note_le", depuis14)),
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
    const v2 = (statsV2.data ?? {}) as Record<string, number>;

    // ── Comptes athlètes : la définition partagée avec /admin/athletes et le tableau de bord.
    const repartition = repartitionComptesAthletes(fiches.map(inscriptionDeFiche), sansFiche.length);
    const datesAthletes = datesCreationComptes(fiches, sansFiche);

    const recruteurs = new Set(comptes.filter((c) => c.role === "RECRUTEUR").map((c) => c.id));
    const datesRole = (role: string) => comptes.filter((c) => c.role === role).map((c) => c.created_at);
    const datesAutres = comptes.filter((c) => c.role !== "ATHLETE").map((c) => c.created_at);

    const messagesRecruteurs = messages.filter((m) => recruteurs.has(m.sender_id));
    const notesRecruteurs = notesMatch.filter((n) => n.auteur && recruteurs.has(n.auteur));

    // Recruteurs actifs : ont consulté, mis en favori, déplacé, écrit, noté ou suivi une carte.
    const actifsDans = (fen: Fenetre) => {
      const ids = new Set<string>();
      for (const v of vues) if (dansFenetre(v.viewed_at, fen)) ids.add(v.recruiter_id);
      for (const x of favoris) if (dansFenetre(x.created_at, fen)) ids.add(x.recruiter_id);
      for (const x of journalProcessus) if (dansFenetre(x.created_at, fen)) ids.add(x.recruiter_id);
      for (const x of messagesRecruteurs) if (dansFenetre(x.created_at, fen)) ids.add(x.sender_id);
      for (const x of notesRecruteurs) if (dansFenetre(x.note_le, fen)) ids.add(x.auteur as string);
      for (const x of journalCartes) if (x.acteur && recruteurs.has(x.acteur) && dansFenetre(x.created_at, fen)) ids.add(x.acteur);
      return ids.size;
    };

    // ── Parcours : sur les fiches des comptes athlètes (complete / commencée).
    const inscrites = fiches.filter((x) => {
      const i = inscriptionDeFiche(x);
      return i === "complete" || i === "commencee";
    });
    const vus = new Set(vuesAthletes.map((v) => v.athlete_id));
    const suivisIds = new Set(suivis.map((p) => p.athlete_id));

    // ── Inscriptions par semaine
    const fin = maintenant;
    const parSemAthletes = parSemaine(datesAthletes, semaines, fin);
    const parSemAutres = parSemaine(datesAutres, semaines, fin);

    const profilsVus = comparer(vues.map((v) => v.viewed_at), f7);
    const mouvements = comparer(journalProcessus.map((x) => x.created_at), f7);

    const donnees: EcranMuralDonnees = {
      calcule_le: maintenant.toISOString(),
      fenetres: { courant_de: f7.courant.de.toISOString(), precedent_de: f7.precedent.de.toISOString() },
      tuiles: {
        nouveaux_athletes: comparer(datesAthletes, f7),
        athletes_actifs: actifs,
        profils_vus: profilsVus,
        recruteurs_actifs: { courant: actifsDans(f7.courant), precedent: actifsDans(f7.precedent) },
        mouvements_processus: mouvements,
        nouveaux_coachs: comparer(datesRole("COACH"), f7),
        nouveaux_recruteurs: comparer(datesRole("RECRUTEUR"), f7),
      },
      inscriptions: semaines.map((debut, i) => ({
        semaine: libelleSemaine(debut),
        athletes: parSemAthletes[i],
        autres: parSemAutres[i],
        en_cours: i === semaines.length - 1,
      })),
      activite: {
        profils_consultes: profilsVus,
        favoris: comparer(favoris.map((x) => x.created_at), f7),
        mouvements_processus: mouvements,
        suivi_cartes: comparer(journalCartes.map((x) => x.created_at), f7),
        notes_match: comparer(notesRecruteurs.map((x) => x.note_le), f7),
        messages: comparer(messagesRecruteurs.map((x) => x.created_at), f7),
      },
      parcours: {
        inscrits: repartition.comptes,
        profil_80: inscrites.filter((x) => (x.profile_completion ?? 0) >= 80).length,
        valide_coach: inscrites.filter((x) => x.verified === true).length,
        vu_recruteur: inscrites.filter((x) => vus.has(x.id)).length,
        suivi_recruteur: inscrites.filter((x) => suivisIds.has(x.id)).length,
      },
      files: {
        invitations_parent: { reclamees: invReclamees, en_attente: invEnAttente, expirees: invExpirees },
        consentements_v2: {
          acceptes: Number(v2.accepte_v2 ?? 0),
          refuses: Number(v2.refuse_v2 ?? 0),
          en_attente: Number(v2.demande_parent ?? 0) + Number(v2.pas_repondu ?? 0),
        },
        ecoles_non_listees: ecolesNonListees,
        loi25_ouvertes: loi25Portabilite + loi25Suppression,
        reclamations_etablissement: reclamations,
      },
    };
    return NextResponse.json(donnees, { headers: SANS_CACHE });
  } catch (e) {
    // Le détail reste dans les journaux du serveur ; le navigateur n'a que l'échec.
    console.error("[admin/ecran]", erreurLisible(e));
    return NextResponse.json({ error: "Lecture des chiffres impossible" }, { status: 500, headers: SANS_CACHE });
  }
}
