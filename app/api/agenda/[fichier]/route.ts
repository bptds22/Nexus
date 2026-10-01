import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { genererIcs, FORME_JETON, type EvenementAgenda } from "@/lib/agenda/ics";

/* ═══════════════════════════════════════════════════════════════
   GET /api/agenda/<jeton>.ics — le flux d'agenda privé d'un recruteur Pro.

   PAS DE SESSION : Google Agenda et Outlook lisent l'adresse depuis leurs
   serveurs. Le jeton EST l'autorisation ; la base n'en garde que le haché.
   · jeton mal formé ou inconnu (révoqué, régénéré) → 404 ;
   · recruteur plus Pro, ou unité changée depuis le jeton → 200, calendrier
     VIDE (la base ne rend aucune ligne) ;
   · sinon : relances et visites de l'unité (agenda_flux, service_role seul).
   Le jeton n'est JAMAIS journalisé.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const introuvable = () => new NextResponse("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const { fichier } = await params;
  const jeton = fichier.endsWith(".ics") ? fichier.slice(0, -4) : fichier;
  if (!FORME_JETON.test(jeton)) return introuvable();

  const supabase = createServiceClient();
  const existe = await supabase.rpc("agenda_flux_existe", { p_jeton: jeton } as never);
  if (existe.error) {
    console.error("[api/agenda] existe :", existe.error.code, existe.error.message);
    return new NextResponse("Erreur", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  if (existe.data !== true) return introuvable();

  const { data, error } = await supabase.rpc("agenda_flux", { p_jeton: jeton } as never);
  if (error) {
    console.error("[api/agenda] flux :", error.code, error.message);
    return new NextResponse("Erreur", { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  // Le domaine qui sert le flux (nexussports.ca) est celui des liens de dossier.
  const origine = new URL(req.url).origin;
  const ics = genererIcs((data ?? []) as EvenementAgenda[], origine);
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="nexus-agenda.ics"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
