"use client";

// lib/queries/cegepSearch/searchData.ts
//
// Couche données « Trouver ton cégep ». TOUT est chargé en 5 requêtes PLATES
// puis agrégé en mémoire — 69 écoles, ~400 équipes, ~1 300 programmes : c'est
// quelques dizaines de ko, et le filtrage devient instantané côté client.
// Aucune requête par carte (pas de N+1), aucune vue ni RPC (zéro DDL).

import type { SupabaseClient } from "@supabase/supabase-js";

/** Écoles de test de la plateforme — jamais dans la recherche publique.
 *  Critère volontairement bête : le préfixe du nom. Les vraies écoles sont
 *  seedées depuis les données MEQ/RSEQ et aucune ne s'appelle « Nexus … ». */
export const isTestSchool = (name: string): boolean => /^nexus\b/i.test(name.trim());

export interface TeamBadge { sport: string; division: string | null; gender: string | null }

export interface CegepRow {
  id: string;
  name: string;
  city: string;
  region: string;
  langue: string | null;      // FR | EN | BILINGUE | null
  reseau: string | null;      // PUBLIC | PRIVE | null
  lat: number | null;
  lng: number | null;
  /** Logo DÉPOSÉ par le coach (school_page_content.logo_path), sinon null →
   *  monogramme. Jamais l'image RSEQ scrapée. Voir logoDeLEcole(). */
  logoUrl: string | null;
  /** Page « Ma page » réellement configurée (pas une ligne seedée vide). */
  riche: boolean;
  nickname: string | null;
  couleur: string | null;
  teams: TeamBadge[];
  sports: string[];           // noms de sports distincts (filtre)
  programmes: string[];        // noms de programmes affichés
}

export interface ViewerProfile {
  athleteId: string;
  sportNom: string | null;
  positionId: string | null;
  positionNom: string | null;
  /** Abréviation du poste — le badge « 🔥 QB » du panneau aperçu. */
  positionAbrev: string | null;
  /** Programme(s) visé(s) déclaré(s) au profil athlète. */
  programmesVises: string[];
  /** Région de son école actuelle — origine par défaut du calcul de distance. */
  regionOrigine: string | null;
}

export interface SearchData {
  cegeps: CegepRow[];
  /** Catalogue distinct, trié — la liste filtrable du rail. */
  catalogueProgrammes: string[];
  regions: string[];
  sports: string[];
  /** Écoles (id) où le poste du viewer est en demande (niveau ≥ moyen). */
  postesEnDemande: Set<string>;
  viewer: ViewerProfile | null;
}

const s = (v: unknown): string => (v == null ? "" : String(v));

/** Le logo d'un cégep : `school_page_content.logo_path`, et RIEN D'AUTRE.
 *
 *  C'est le fichier que le coach a lui-même déposé dans le bucket
 *  `school-logos` en configurant sa page — le logo que l'école revendique, et
 *  déjà celui qu'affichent la page école et la page équipe (loadForRender,
 *  teamEditorContext, dbToProgramPage). Absent → null, et la carte retombe sur
 *  le monogramme, exactement comme avant.
 *
 *  `schools.logo_url` N'EST PAS un repli, sciemment. C'est une image SCRAPÉE du
 *  RSEQ (rseq.ca/ImageGen.ashx…) : l'école ne l'a pas choisie, l'URL dépend d'un
 *  tiers, et 50 des 61 cégeps en ont une. La brancher en repli ferait apparaître
 *  50 logos scrapés sur des cartes qui n'en ont jamais montré. La colonne reste
 *  écrite et affichée par l'admin école (app/admin/schools/[id]) — elle n'est
 *  simplement pas une source pour la recherche PUBLIQUE. Pour l'y rebrancher un
 *  jour : remettre logo_url dans le select ci-dessous et le rendre ici en repli. */
function logoDeLEcole(supabase: SupabaseClient, logoPath: string | null | undefined): string | null {
  const chemin = logoPath?.trim();
  if (!chemin) return null;
  return supabase.storage.from("school-logos").getPublicUrl(chemin).data.publicUrl;
}

export async function loadSearchData(supabase: SupabaseClient): Promise<SearchData> {
  const [schools, teams, programs, pageContent, cards] = await Promise.all([
    supabase.from("schools")
      // logo_url N'EST PAS lu : un champ chargé et jamais rendu est exactement
      // le piège qui a fait croire que la recherche affichait un logo. Voir
      // logoDeLEcole().
      .select("id, name, city, region, langue, reseau, lat, lng")
      .eq("type", "CEGEP"),
    supabase.from("teams").select("school_id, division, gender, sports:sport_id(nom)"),
    supabase.from("school_programs").select("school_id, name").eq("is_displayed", true),
    supabase.from("school_page_content").select("school_id, nickname, logo_path, sell_text, color_primary"),
    supabase.from("school_campus_cards").select("school_id"),
  ]);
  for (const r of [schools, teams, programs, pageContent, cards]) if (r.error) throw r.error;

  const teamsBy = new Map<string, TeamBadge[]>();
  for (const t of (teams.data ?? []) as unknown as { school_id: string; division: string | null; gender: string | null; sports: { nom: string } | null }[]) {
    const arr = teamsBy.get(t.school_id) ?? [];
    if (t.sports?.nom) arr.push({ sport: t.sports.nom, division: t.division, gender: t.gender });
    teamsBy.set(t.school_id, arr);
  }

  const progsBy = new Map<string, string[]>();
  for (const p of (programs.data ?? []) as { school_id: string; name: string }[]) {
    const arr = progsBy.get(p.school_id) ?? [];
    arr.push(p.name);
    progsBy.set(p.school_id, arr);
  }

  const cardsBy = new Set((cards.data ?? []).map((c) => (c as { school_id: string }).school_id));
  const contentBy = new Map<string, { nickname: string | null; logo_path: string | null; sell_text: string | null; color_primary: string | null }>();
  for (const c of (pageContent.data ?? []) as { school_id: string; nickname: string | null; logo_path: string | null; sell_text: string | null; color_primary: string | null }[]) {
    contentBy.set(c.school_id, c);
  }

  const cegeps: CegepRow[] = ((schools.data ?? []) as Record<string, unknown>[])
    .filter((r) => !isTestSchool(s(r.name)))
    .map((r) => {
      const id = s(r.id);
      const c = contentBy.get(id);
      // « Riche » = du contenu éditorial RÉEL. Une ligne seedée qui ne porte
      // que la ville ne compte pas — sinon 61 collèges passeraient pour
      // configurés alors qu'aucun ne l'est.
      const riche = !!c && (
        !!(c.nickname && c.nickname.trim()) ||
        !!c.logo_path ||
        !!(c.sell_text && c.sell_text.trim()) ||
        cardsBy.has(id) ||
        (!!c.color_primary && c.color_primary.toUpperCase() !== "#A6192E")
      );
      const teamList = teamsBy.get(id) ?? [];
      return {
        id,
        name: s(r.name),
        city: s(r.city),
        region: s(r.region),
        langue: (r.langue as string | null) || null,
        reseau: (r.reseau as string | null) || null,
        lat: (r.lat as number | null) ?? null,
        lng: (r.lng as number | null) ?? null,
        logoUrl: logoDeLEcole(supabase, c?.logo_path),
        riche,
        nickname: c?.nickname?.trim() || null,
        couleur: riche ? (c?.color_primary ?? null) : null,
        teams: teamList,
        sports: [...new Set(teamList.map((t) => t.sport))].sort(),
        programmes: progsBy.get(id) ?? [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const catalogueProgrammes = [...new Set(((programs.data ?? []) as { name: string }[]).map((p) => p.name.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "fr"));
  const regions = [...new Set(cegeps.map((c) => c.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const sports = [...new Set(cegeps.flatMap((c) => c.sports))].sort((a, b) => a.localeCompare(b, "fr"));

  const viewer = await loadViewer(supabase);
  const postesEnDemande = viewer?.positionId
    ? await loadPostesEnDemande(supabase, viewer.positionId)
    : new Set<string>();

  return { cegeps, catalogueProgrammes, regions, sports, postesEnDemande, viewer };
}

/** Athlète connecté. Visiteur non connecté / non-athlète → null : la page
 *  bascule en filtres génériques, sans « Pour moi » ni fits. */
async function loadViewer(supabase: SupabaseClient): Promise<ViewerProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data } = await supabase.from("athletes")
    .select("id, position_id, programme_cegep_vise, school_id, sports:sport_id(nom), positions:position_id(nom, abreviation), schools:school_id(region)")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    id: string; position_id: string | null; programme_cegep_vise: unknown; school_id: string | null;
    sports: { nom: string } | null; positions: { nom: string; abreviation: string | null } | null;
    schools: { region: string | null } | null;
  };
  const vises = Array.isArray(row.programme_cegep_vise)
    ? (row.programme_cegep_vise as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];
  return {
    athleteId: row.id,
    sportNom: row.sports?.nom ?? null,
    positionId: row.position_id,
    positionNom: row.positions?.nom ?? null,
    positionAbrev: row.positions?.abreviation ?? null,
    programmesVises: vises,
    regionOrigine: row.schools?.region ?? null,
  };
}

/** Écoles où le poste de l'athlète est ancré sur une plaque de niveau ≥ moyen.
 *  Deux requêtes plates : les besoins, puis les équipes concernées. */
async function loadPostesEnDemande(supabase: SupabaseClient, positionId: string): Promise<Set<string>> {
  const { data: needs, error } = await supabase
    .from("team_position_needs")
    .select("team_id, position_ids, niveau, is_hidden")
    .in("niveau", ["moyen", "eleve", "urgent"]);
  if (error || !needs?.length) return new Set();
  const teamIds = (needs as { team_id: string; position_ids: unknown; is_hidden: boolean }[])
    .filter((n) => !n.is_hidden && Array.isArray(n.position_ids) && (n.position_ids as string[]).includes(positionId))
    .map((n) => n.team_id);
  if (!teamIds.length) return new Set();
  const { data: teams } = await supabase.from("teams").select("school_id").in("id", [...new Set(teamIds)]);
  return new Set(((teams ?? []) as { school_id: string }[]).map((t) => t.school_id));
}
