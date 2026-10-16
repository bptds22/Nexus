/* Accès au portail partenaire — la règle, en un seul endroit (1.4.5, B1).

   Le web la vérifie DEUX fois : le middleware (serveur, avant la page) et le
   layout (client). L'appli est un export statique : AUCUN middleware n'y
   tourne. Sans reprise côté client, un partenaire qui n'a ni accepté les
   conditions ni posé son mot de passe entrerait dans le portail depuis
   l'appli. Le layout applique donc la même règle, dans les deux builds.

   Ce que la règle ne fait PAS : décider de ce que le partenaire VOIT. Chaque
   RPC du portail porte sa propre garde (is_approved_partner,
   is_partner_eligible_athlete) — c'est elle qui protège les données. */

import type { SupabaseClient } from "@supabase/supabase-js";

export const ROUTE_BIENVENUE = "/partenaire/bienvenue";

export interface ConditionsPartenaire {
  terms_accepted_at: string | null;
  password_reset_completed_at: string | null;
}

/** Conditions acceptées ET mot de passe posé — sinon l'écran de bienvenue. Lue
 *  aussi par middleware.ts : la même règle des deux côtés. */
export function doitPasserParBienvenue(p: ConditionsPartenaire): boolean {
  return !p.terms_accepted_at || !p.password_reset_completed_at;
}

/** Le portail d'un autre rôle (même aiguillage que le layout d'avant). */
export function portailDuRole(role: string | null | undefined): string {
  switch (role) {
    case "COACH": return "/coach/tableau-de-bord";
    case "RECRUTEUR": return "/recruteur/tableau-de-bord";
    case "ATHLETE": return "/athlete/dashboard";
    case "ADMIN": return "/admin/dashboard";
    default: return "/";
  }
}

export type AccesPartenaire =
  | { etat: "SANS_SESSION" }
  | { etat: "AUTRE_ROLE"; destination: string }
  | { etat: "BIENVENUE" }
  | { etat: "OK" };

function chemin(p: string): string {
  return p.replace(/\/+$/, "") || "/";
}

/** Décide de l'accès pour `pathname`. Une fiche partenaire absente laisse
 *  passer (incohérence de données : la page la montrera, comme le middleware). */
export async function lireAccesPartenaire(supabase: SupabaseClient, pathname: string): Promise<AccesPartenaire> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { etat: "SANS_SESSION" };
  const { data: u } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!u) return { etat: "SANS_SESSION" };
  if (u.role !== "PARTNER") return { etat: "AUTRE_ROLE", destination: portailDuRole(u.role as string) };
  if (chemin(pathname) === ROUTE_BIENVENUE) return { etat: "OK" };
  const { data: p } = await supabase
    .from("media_partners")
    .select("terms_accepted_at, password_reset_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (p && doitPasserParBienvenue(p as ConditionsPartenaire)) return { etat: "BIENVENUE" };
  return { etat: "OK" };
}
