import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";
import { fenetresADate } from "@/lib/admin/ecranMural";
import { chargerLignes, toutLire } from "@/lib/admin/indicateurs";
import { construireQg, lectureDepuis, lireGranularite, type Connectes } from "@/lib/admin/qg";

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/qg?periode=jour|semaine|mois — les chiffres du QG
   admin (/admin/qg). Défaut : jour.

   ── CE QUI SORT D'ICI : DES NOMBRES, RIEN D'AUTRE (Loi 25) ────
   Totaux, libellés de période, dates d'échéance (jour seulement) et
   l'heure du calcul. Aucun nom, courriel ni identifiant de personne.

   ── LA GARDE ─────────────────────────────────────────────────
   La même que /api/admin/ecran : 401 sans session ; 403 sans
   `is_platform_admin` ET `is_admin()`.

   ── LECTURES ─────────────────────────────────────────────────
   lib/admin/indicateurs.ts (mêmes définitions que l'écran mural), plus :
   - admin_comptes_connectes() pour la période et celle d'avant ;
   - les échéances des demandes Loi 25 ouvertes (portabilité : session
     de l'admin ; suppression : clé de service, comme l'écran).
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const SANS_CACHE = { "Cache-Control": "no-store" };

function refus(status: 401 | 403, error: string) {
  return NextResponse.json({ error }, { status, headers: SANS_CACHE });
}

export async function GET(req: NextRequest) {
  // 1. Authentifier
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return refus(401, "Non authentifié");

  // 2. Autoriser — les deux définitions d'admin.
  const [plateforme, admin] = await Promise.all([
    sb.rpc("is_platform_admin", { uid: user.id }),
    sb.rpc("is_admin"),
  ]);
  if (plateforme.error || admin.error || plateforme.data !== true || admin.data !== true) {
    return refus(403, "Accès refusé — administrateur requis");
  }

  // 3. Clé de service : seulement maintenant, et seulement pour les tables sans règle admin.
  const sv = createServiceClient();

  const g = lireGranularite(req.nextUrl.searchParams.get("periode"));
  const maintenant = new Date();
  const f = fenetresADate(maintenant, g);

  try {
    const connectes = async (de: Date, a: Date): Promise<Connectes> => {
      // Fenêtre vide (lundi 0 h pile, le 1er à 0 h) : rien à compter.
      if (a.getTime() <= de.getTime()) return { total: 0, par_role: {} };
      const r = await sb.rpc("admin_comptes_connectes", { p_de: de.toISOString(), p_a: a.toISOString() });
      if (r.error) throw new Error(`admin_comptes_connectes: ${r.error.message}`);
      return r.data as Connectes;
    };

    const [l, connCourant, connPrecedent, portabilite, suppressions] = await Promise.all([
      chargerLignes(sb, sv, lectureDepuis(maintenant, g).toISOString(), maintenant),
      connectes(f.courant.de, f.courant.a),
      connectes(f.precedent.de, f.precedent.a),
      toutLire<{ deadline: string | null }>(
        () => sb.from("loi25_portability_requests").select("id, deadline", { count: "exact" })
          .in("status", ["pending", "in_progress"])),
      toutLire<{ requested_at: string | null }>(
        () => sv.from("deletion_requests").select("id, requested_at", { count: "exact" })
          .in("status", ["PENDING", "IN_PROGRESS"])),
    ]);

    const donnees = construireQg(l, {
      connectes: { courant: connCourant, precedent: connPrecedent },
      echeancesPortabilite: portabilite.map((p) => p.deadline ?? ""),
      suppressionsDeposees: suppressions.map((s) => s.requested_at ?? ""),
    }, maintenant, g);
    return NextResponse.json(donnees, { headers: SANS_CACHE });
  } catch (e) {
    // Le détail reste dans les journaux du serveur ; le navigateur n'a que l'échec.
    console.error("[admin/qg]", erreurLisible(e));
    return NextResponse.json({ error: "Lecture des chiffres impossible" }, { status: 500, headers: SANS_CACHE });
  }
}
