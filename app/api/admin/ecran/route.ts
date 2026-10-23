import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";
import { datesCreationComptes } from "@/lib/admin/comptesAthletes";
import {
  debutsSemaines,
  fenetres7Jours,
  libelleSemaine,
  parSemaine,
  type EcranMuralDonnees,
} from "@/lib/admin/ecranMural";
import {
  activiteRecruteurs,
  chargerLignes,
  comparer,
  datesActivite,
  filesAttente,
  parcoursInscription,
  recruteursActifs,
} from "@/lib/admin/indicateurs";

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

   ── DÉFINITIONS ──────────────────────────────────────────────
   Lectures et calculs : lib/admin/indicateurs.ts, partagés avec le QG
   (/api/admin/qg) depuis le 2026-10-22. Consentements v2 : 4 cases
   (acceptés, refusés, en attente, jamais demandé — décision BP).
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const SANS_CACHE = { "Cache-Control": "no-store" };

function refus(status: 401 | 403, error: string) {
  return NextResponse.json({ error }, { status, headers: SANS_CACHE });
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

  try {
    const l = await chargerLignes(sb, sv, f7.precedent.de.toISOString(), maintenant);
    const act = activiteRecruteurs(l);
    const dates = datesActivite(l, act);

    // ── Comptes athlètes : la définition partagée avec /admin/athletes et le tableau de bord.
    const datesAthletes = datesCreationComptes(l.fiches, l.sansFiche);
    const datesRole = (role: string) => l.comptes.filter((c) => c.role === role).map((c) => c.created_at);
    const datesAutres = l.comptes.filter((c) => c.role !== "ATHLETE").map((c) => c.created_at);

    // ── Inscriptions par semaine
    const parSemAthletes = parSemaine(datesAthletes, semaines, maintenant);
    const parSemAutres = parSemaine(datesAutres, semaines, maintenant);

    const profilsVus = comparer(dates.profils_consultes, f7);
    const mouvements = comparer(dates.mouvements_processus, f7);

    const donnees: EcranMuralDonnees = {
      calcule_le: maintenant.toISOString(),
      fenetres: { courant_de: f7.courant.de.toISOString(), precedent_de: f7.precedent.de.toISOString() },
      tuiles: {
        nouveaux_athletes: comparer(datesAthletes, f7),
        athletes_actifs: l.athletesActifs,
        profils_vus: profilsVus,
        recruteurs_actifs: { courant: recruteursActifs(l, act, f7.courant), precedent: recruteursActifs(l, act, f7.precedent) },
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
        favoris: comparer(dates.favoris, f7),
        mouvements_processus: mouvements,
        suivi_cartes: comparer(dates.suivi_cartes, f7),
        notes_match: comparer(dates.notes_match, f7),
        messages: comparer(dates.messages, f7),
      },
      parcours: parcoursInscription(l),
      files: filesAttente(l),
    };
    return NextResponse.json(donnees, { headers: SANS_CACHE });
  } catch (e) {
    // Le détail reste dans les journaux du serveur ; le navigateur n'a que l'échec.
    console.error("[admin/ecran]", erreurLisible(e));
    return NextResponse.json({ error: "Lecture des chiffres impossible" }, { status: 500, headers: SANS_CACHE });
  }
}
