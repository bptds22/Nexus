import "server-only";

// lib/queries/schoolPage/loadForRender.ts
//
// Charge (serveur, service-role) le contenu d'une école et construit les props
// ProgramPage. content NULL (école non configurée) → renvoie {configured:false}
// pour que l'appelant applique le fixture Grasset. LA PAGE NE CASSE JAMAIS.

import { createServiceClient } from "@/lib/supabase/service";
import { lireLancementUniversitaire } from "@/lib/config/lancementUniversitaire";
import { loadSchoolPage, loadTeamsForGrid } from "./schoolPageData";
import { loadSaisonEnCours, type EquipeSaison } from "./saisonEnCours";
import { dbToProgramPage, degradedProgramPage, type SchoolRow } from "./dbToProgramPage";
import type { SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { ProgramPageContent } from "@/components/program-page/content";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RenderResult =
  | { configured: true; school: SchoolProgramIdentity; content: ProgramPageContent; schoolName: string; saison: EquipeSaison[] }
  // École réelle jamais configurée. `configured` reste FAUX — /page-test s'en
  // sert pour retomber sur son fixture, et ce comportement ne bouge pas.
  // `degraded` est additif : la route publique /college s'en sert pour rendre
  // CETTE école (nom, ville, équipes) au lieu d'emprunter une autre identité.
  | { configured: false; schoolName: string | null; saison?: EquipeSaison[]; degraded?: { school: SchoolProgramIdentity; content: ProgramPageContent } };

/** `universite` (lot D5b, route /universite) : ne cherche QUE les universités, et seulement sous
 *  lancement_universitaire ON — sous OFF, l'université n'existe pas (404), comme en base (D1a). Sans l'option,
 *  rien ne change : les universités restent exclues de /college. */
export async function loadSchoolPageForRender(idOrSlug: string, opts: { universite?: boolean } = {}): Promise<RenderResult> {
  const svc = createServiceClient();
  const universite = opts.universite === true;
  if (universite && !(await lireLancementUniversitaire(svc))) return { configured: false, schoolName: null };
  // `logo_url` est lu comme REPLI d'affichage derrière school_page_content.logo_path
  // — voir dbToProgramPage. Sans lui, les écoles jamais configurées perdaient
  // leur logo d'import RSEQ et retombaient sur le monogramme.
  // Lot D1a cégep : la clé service ne passe pas par la policy universites_masquees — une université n'a
  // pas de page publique tant que le lancement universitaire n'est pas fait (vitrine : plus tard).
  const base = svc.from("schools").select("id, name, city, region, province, langue, reseau, lat, lng, geo_source, logo_url, type");
  const q = (universite ? base.eq("type", "UNIVERSITE") : base.neq("type", "UNIVERSITE")).limit(1);
  const { data: rows } = UUID.test(idOrSlug)
    ? await q.eq("id", idOrSlug)
    : await q.ilike("name", "%" + idOrSlug.replace(/-/g, "%") + "%");
  const school = (rows ?? [])[0] as SchoolRow | undefined;
  if (!school) return { configured: false, schoolName: null };

  const page = await loadSchoolPage(svc, school.id);
  const { content, cards, news } = page;
  // Université : ses programmes vivent dans university_programs (lot D5a), pas dans school_programs (DEC).
  let programs: { name: string; is_displayed: boolean }[] = page.programs;
  if (universite) {
    const { data: up } = await svc.from("university_programs")
      .select("name, is_displayed").eq("school_id", school.id).order("position").order("name");
    programs = (up ?? []) as { name: string; is_displayed: boolean }[];
  }

  // RPC Bloc 2 non encore dans les types générés → cast des args (runtime OK).
  // `teams` alimente « L'affiche » : sans elle, content.sports restait vide et
  // la section #sports disparaissait de toute école chargée depuis la base.
  // Lu AVANT le branchement : une école non configurée a quand même ses
  // équipes, et c'est tout l'intérêt de sa page dégradée.
  // `teams` passe par loadTeamsForGrid — SOURCE UNIQUE partagée avec la page
  // école mobile et l'aperçu de l'éditeur, pour que les trois montrent la même
  // affiche (la requête y était recopiée à l'identique, sans `season`).
  // `saison` est de la donnee VIVANTE (veille RSEQ), lue au meme titre que les
  // equipes et AVANT le branchement : une ecole jamais configuree a elle aussi
  // ses resultats, et c'est tout l'interet de sa page degradee.
  const [{ data: rc }, { data: fc }, teams, saison] = await Promise.all([
    svc.rpc("count_recruited_by_school", { p_school_id: school.id } as unknown as undefined),
    svc.rpc("count_followers_by_school", { p_school_id: school.id } as unknown as undefined),
    loadTeamsForGrid(svc, school.id),
    loadSaisonEnCours(svc, school.id),
  ]);

  if (!content) {
    return {
      configured: false,
      schoolName: school.name,
      saison,
      degraded: degradedProgramPage(school, teams, universite ? programs : []),
    };
  }
  const assetUrl = (path: string | null | undefined, bucket: "school-logos" | "campus-photos") =>
    path ? svc.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;

  const { school: identity, content: pageContent } = dbToProgramPage(
    school, content, cards, programs, news,
    (rc as number | null) ?? 0, (fc as number | null) ?? 0, assetUrl, teams,
  );
  return { configured: true, school: identity, content: pageContent, schoolName: school.name, saison };
}
