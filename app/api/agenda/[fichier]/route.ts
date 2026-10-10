import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  genererIcs, estJetonPartenaire, FORME_JETON, NOM_CALENDRIER_PARTENAIRE,
  type EvenementAgenda, type MatchAgenda,
} from "@/lib/agenda/ics";

/* ═══════════════════════════════════════════════════════════════
   GET /api/agenda/<jeton>.ics — le flux d'agenda privé.

   PAS DE SESSION : Google Agenda et Outlook lisent l'adresse depuis leurs
   serveurs. Le jeton EST l'autorisation ; la base n'en garde que le haché.

   · nxa_ — recruteur Pro : relances et visites de l'unité (agenda_flux) ET,
     depuis le 2026-10-09 (BP), les matchs ajoutés par l'unité
     (agenda_matchs_unite). Recruteur plus Pro, ou unité changée depuis le
     jeton → 200, calendrier VIDE (la base ne rend aucune ligne).
   · nxp_ — partenaire : les matchs qu'il a ajoutés (agenda_matchs_partenaire).
     Partenaire plus APPROVED (SUSPENDED, REVOKED) → 404, comme un jeton
     inconnu : refusé partout, jeton compris (BP 2026-10-09).
   · jeton mal formé ou inconnu (révoqué, régénéré) → 404.

   L'heure d'un match est convertie par instantMatch (genererIcs), la seule
   lecture d'heure de l'app. Toutes les RPC : service_role seul. Le jeton n'est
   JAMAIS journalisé.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const introuvable = () => new NextResponse("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
const erreur = (etape: string, e: { code?: string; message?: string }) => {
  console.error(`[api/agenda] ${etape} :`, e.code, e.message);
  return new NextResponse("Erreur", { status: 500, headers: { "Cache-Control": "no-store" } });
};

export async function GET(req: Request, { params }: { params: Promise<{ fichier: string }> }) {
  const { fichier } = await params;
  const jeton = fichier.endsWith(".ics") ? fichier.slice(0, -4) : fichier;
  if (!FORME_JETON.test(jeton)) return introuvable();

  const supabase = createServiceClient();
  // Le domaine qui sert le flux (nexussports.ca) est celui des liens.
  const origine = new URL(req.url).origin;
  let ics: string;

  if (estJetonPartenaire(jeton)) {
    const existe = await supabase.rpc("agenda_flux_partenaire_existe", { p_jeton: jeton } as never);
    if (existe.error) return erreur("existe (partenaire)", existe.error);
    if (existe.data !== true) return introuvable();
    const matchs = await supabase.rpc("agenda_matchs_partenaire", { p_jeton: jeton } as never);
    if (matchs.error) return erreur("matchs (partenaire)", matchs.error);
    ics = genererIcs([], origine, new Date(), {
      matchs: (matchs.data ?? []) as MatchAgenda[],
      nom: NOM_CALENDRIER_PARTENAIRE,
      lienMatch: () => `${origine}/partenaire/carte-matchs`,
    });
  } else {
    const existe = await supabase.rpc("agenda_flux_existe", { p_jeton: jeton } as never);
    if (existe.error) return erreur("existe", existe.error);
    if (existe.data !== true) return introuvable();
    const [flux, matchs] = await Promise.all([
      supabase.rpc("agenda_flux", { p_jeton: jeton } as never),
      supabase.rpc("agenda_matchs_unite", { p_jeton: jeton } as never),
    ]);
    if (flux.error) return erreur("flux", flux.error);
    if (matchs.error) return erreur("matchs", matchs.error);
    ics = genererIcs((flux.data ?? []) as EvenementAgenda[], origine, new Date(), {
      matchs: (matchs.data ?? []) as MatchAgenda[],
      lienMatch: () => `${origine}/recruteur/calendrier`,
    });
  }

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
