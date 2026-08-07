// lib/queries/teamPage/loadViewerClient.ts
//
// L'ATHLÈTE CONNECTÉ — celui qui déclenche le widget « match parfait » sur la
// page équipe publique. Lecture CLIENT, clé anon, RLS (« athletes can read own
// profile »). Pas connecté / pas un athlète → null, et la box n'apparaît pas.
//
// ── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────
// Cette fonction vivait en double :
//   • serveur, dans teamPage/loadForRender.ts (loadViewer), via cookies() ;
//   • client, dans TeamPageMobile.tsx (loadViewerClient), via la clé anon.
// La version SERVEUR rendait la route /college/[schoolId]/[teamId] intenable :
// la route exporte un generateStaticParams (le bundle Capacitor en dépend),
// donc Next la classe SSG, donc son rendu est STATIQUE — et un rendu statique
// n'a pas le droit de lire cookies(). Toutes les équipes rendaient 500.
// Aucune déclaration `dynamic` ne pouvait sauver les deux plateformes : Next
// exige un littéral, et le seul littéral qui règle le web ('force-dynamic')
// est refusé par output:'export'. Les deux formes ont été éprouvées au build.
//
// La lecture est donc passée côté client sur les DEUX plateformes, et
// l'implémentation est ici, une seule fois. Le web garde son rendu SSG (SEO
// public) ; le widget se pose après hydratation.
//
// ⚠ NE PAS réintroduire d'appel à cookies() / lib/supabase/server dans le
// chemin de rendu de la page équipe : ça remettrait le 500 en place.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectedAthlete } from "@/components/team-page/content";

/** Pluriel français « suffisant » pour un libellé de poste : les noms de
 *  positions sont des groupes nominaux simples (« Quart-arrière », « Receveur
 *  éloigné »). Terminaison en s/x/z → invariable. */
function pluriel(nom: string): string {
  return /[sxz]$/i.test(nom) ? nom.toLowerCase() : nom.toLowerCase() + "s";
}

/** Ne jette jamais : une page publique ne casse pas parce que la session est
 *  absente ou injoignable. */
export async function loadViewerClient(
  supabase: SupabaseClient,
): Promise<ConnectedAthlete | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await supabase
      .from("athletes")
      .select("sports:sport_id(nom), positions:position_id(nom, abreviation)")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    const row = data as unknown as {
      sports: { nom: string } | null;
      positions: { nom: string; abreviation: string | null } | null;
    } | null;
    if (!row?.sports?.nom || !row.positions?.abreviation) return null;
    return {
      sport: row.sports.nom,
      pos: row.positions.abreviation.toUpperCase(),
      pos2: null, // athletes n'a plus de position secondaire (migration remove_sport_secondaire)
      posLabel: row.positions.nom,
      posLabelPlural: pluriel(row.positions.nom),
    };
  } catch (e) {
    // Le retour null reste le comportement (la box disparaît), mais il cesse
    // d'être MUET : une panne de session ou un Supabase injoignable se lisait
    // exactement comme « visiteur non connecté », et rien ne le distinguait.
    console.error("[loadViewerClient] session/profil illisible", e);
    return null;
  }
}
