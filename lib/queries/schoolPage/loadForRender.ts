import "server-only";

// lib/queries/schoolPage/loadForRender.ts
//
// Charge (serveur, service-role) le contenu d'une école et construit les props
// ProgramPage. content NULL (école non configurée) → renvoie {configured:false}
// pour que l'appelant applique le fixture Grasset. LA PAGE NE CASSE JAMAIS.

import { createServiceClient } from "@/lib/supabase/service";
import { loadSchoolPage } from "./schoolPageData";
import { dbToProgramPage, type SchoolRow } from "./dbToProgramPage";
import type { SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { ProgramPageContent } from "@/components/program-page/content";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RenderResult =
  | { configured: true; school: SchoolProgramIdentity; content: ProgramPageContent; schoolName: string }
  | { configured: false; schoolName: string | null };

export async function loadSchoolPageForRender(idOrSlug: string): Promise<RenderResult> {
  const svc = createServiceClient();
  const q = svc.from("schools").select("id, name, city, region").limit(1);
  const { data: rows } = UUID.test(idOrSlug)
    ? await q.eq("id", idOrSlug)
    : await q.ilike("name", "%" + idOrSlug.replace(/-/g, "%") + "%");
  const school = (rows ?? [])[0] as SchoolRow | undefined;
  if (!school) return { configured: false, schoolName: null };

  const { content, cards, programs, news } = await loadSchoolPage(svc, school.id);
  if (!content) return { configured: false, schoolName: school.name };

  // RPC Bloc 2 non encore dans les types générés → cast des args (runtime OK).
  const { data: rc } = await svc.rpc(
    "count_recruited_by_school", { p_school_id: school.id } as unknown as undefined,
  );
  const assetUrl = (path: string | null | undefined, bucket: "school-logos" | "campus-photos") =>
    path ? svc.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;

  const { school: identity, content: pageContent } = dbToProgramPage(
    school, content, cards, programs, news, (rc as number | null) ?? 0, assetUrl,
  );
  return { configured: true, school: identity, content: pageContent, schoolName: school.name };
}
