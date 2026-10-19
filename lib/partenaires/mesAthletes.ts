/* « Mes évaluations » du partenaire (W4d ; ex-« Mes athlètes », 1.4.5) : les athlètes qu'il a évalués ou badgés
   (badge non retiré), SEULEMENT s'ils lui sont encore visibles (fiche active et
   visibilité partenaire). Un jeune qui retire sa visibilité sort de la liste ;
   ses données ne sont pas effacées (W2). RPC partenaire_mes_athletes. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lireTout } from "@/lib/supabase/lireTout";
import { pastillesBadges, textePastille } from "@/lib/queries/shared/athleteBadges";

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

/** Toutes les lignes, par pages (lireTout) : aucun plafond de 1 000 (BP 2026-10-18, « aucun maximum »). */
export async function chargerMesAthletes(supabase: SupabaseClient): Promise<MonAthlete[]> {
  const data = await lireTout<Record<string, unknown>>((de, a) => supabase
    .rpc("partenaire_mes_athletes", {}, { count: "exact" }).select("*").order("athlete_id").range(de, a));
  return data.map((r) => ({
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

/** Ce qu'une carte compacte « Mes évaluations » (P2, 1.4.5) ajoute à la ligne : la photo et les
 *  badges du COACH (règle R3 : badges du partenaire d'abord, puis le coach, 5 au total, puis +N).
 *  Lus dans top_athletes_view — la vue que la recherche partenaire lit déjà, avec la même garde
 *  d'éligibilité : aucune donnée nouvelle. Un athlète absent de la vue garde ses initiales. */
export interface VignetteMonAthlete {
  photo: string | null;
  badgesCoach: { badgeId: string; label: string }[];
}

/** Par paquets de 200 identifiants (URL raisonnable, sous le plafond PostgREST). Échec : carte sans photo ni badge coach. */
export async function chargerVignettesMesAthletes(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<Map<string, VignetteMonAthlete>> {
  const res = new Map<string, VignetteMonAthlete>();
  const uniques = [...new Set(ids)];
  for (let i = 0; i < uniques.length; i += 200) {
    const { data, error } = await supabase.from("top_athletes_view").select("id, photo_url, badges").in("id", uniques.slice(i, i + 200));
    if (error) continue;
    for (const r of (data ?? []) as { id: string; photo_url: string | null; badges: unknown }[]) {
      res.set(r.id, {
        photo: r.photo_url ?? null,
        badgesCoach: pastillesBadges(r.badges).map((d) => ({ badgeId: d.code, label: textePastille(d) })),
      });
    }
  }
  return res;
}
