/* « Mes athlètes » du partenaire (W4d) : les athlètes qu'il a évalués ou badgés
   (badge non retiré), SEULEMENT s'ils lui sont encore visibles (fiche active et
   visibilité partenaire). Un jeune qui retire sa visibilité sort de la liste ;
   ses données ne sont pas effacées (W2). RPC partenaire_mes_athletes. */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface BadgeMonAthlete {
  attributionId: string;
  /** Le badge du CATALOGUE (badges.id si Nexus, partner_badges.id si propre) :
   *  la clé du filtre « Distinctions ». Null avant la migration 20261016170000. */
  badgeRef: string | null;
  libelle: string | null;
  nexus: boolean;
  code: string | null;
  iconePath: string | null;
  /** Masqué de la fiche par le coach (W3) : il reste à toi, mais n'est pas affiché. */
  masque: boolean;
  le: string;
}

export interface MonAthlete {
  athleteId: string;
  prenom: string;
  nom: string;
  sport: string | null;
  ecole: string | null;
  /** Position (nom et abréviation) — null avant la migration 20261016170000. */
  poste: string | null;
  posteAbr: string | null;
  evaluationId: string | null;
  coteGlobale: number | null;
  evalueeLe: string | null;
  badges: BadgeMonAthlete[];
  derniereAction: string | null;
}

export async function chargerMesAthletes(supabase: SupabaseClient): Promise<MonAthlete[]> {
  const { data, error } = await supabase.rpc("partenaire_mes_athletes");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    athleteId: r.athlete_id as string,
    prenom: (r.prenom as string | null) ?? "",
    nom: (r.nom as string | null) ?? "",
    sport: (r.sport as string | null) ?? null,
    ecole: (r.ecole as string | null) ?? null,
    poste: (r.poste as string | null) ?? null,
    posteAbr: (r.poste_abr as string | null) ?? null,
    evaluationId: (r.evaluation_id as string | null) ?? null,
    coteGlobale: r.cote_globale == null ? null : Number(r.cote_globale),
    evalueeLe: (r.evaluee_le as string | null) ?? null,
    badges: ((r.badges as Record<string, unknown>[] | null) ?? []).map((b) => ({
      attributionId: b.attribution_id as string,
      badgeRef: (b.badge_ref as string | null) ?? null,
      libelle: (b.libelle as string | null) ?? null,
      nexus: b.nexus === true,
      code: (b.code as string | null) ?? null,
      iconePath: (b.icone_path as string | null) ?? null,
      masque: b.masque === true,
      le: b.le as string,
    })),
    derniereAction: (r.derniere_action as string | null) ?? null,
  }));
}
