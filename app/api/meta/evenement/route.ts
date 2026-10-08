import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  CONSENT_COOKIE, EVENEMENTS, LEAD_DEMO, construireCorpsCapi, eventIdValide, leadDemoAutorise, roleMeta,
  urlSourceAssainie, type EvenementMeta, type RoleMeta,
} from "@/lib/meta/regles";

/* ═══════════════════════════════════════════════════════════════
   POST /api/meta/evenement — volet serveur (Conversions API) d'un
   événement déjà envoyé par le pixel navigateur avec le même event_id.

   Le client ne décide de RIEN de ce qui part chez Meta :
   - le consentement est relu dans le cookie nexus_consent ;
   - CompleteRegistration n'est accepté que pour une session Supabase
     dont le compte a moins de 15 min, et le rôle vient de la BASE
     (users.role), pas du corps de la requête ;
     Un rôle athlète (ou parent, admin…) donne null : RIEN ne part, même
     pour un appel forgé (verrou 4 de lib/meta/regles.ts) ;
   - Lead n'est accepté que si l'inscription démo existe, date de moins
     de 15 min et porte un rôle de personnel de cégep, lu en BASE.
   Sans ces gardes, n'importe qui pourrait empoisonner l'optimisation
   des campagnes en postant de fausses inscriptions.

   Ce qui part chez Meta : event_name, event_time, event_id,
   action_source, event_source_url (origine + chemin) et user_data limité
   à ip / user agent / _fbp / _fbc (lib/meta/regles.ts). Aucune donnée
   personnelle, aucun identifiant — nos utilisateurs sont en partie
   mineurs. L'id de session et l'id démo servent à VÉRIFIER, jamais à
   transmettre.

   Répond 204 dans tous les cas où rien n'est à corriger côté client :
   l'appelant ne lit pas la réponse, l'inscription n'en dépend pas.
═══════════════════════════════════════════════════════════════ */

const GRAPH = "https://graph.facebook.com/v21.0";
const FENETRE_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMOIN_FB = /^fb\.[0-9]\.[0-9]+\.[A-Za-z0-9_.-]{1,200}$/;

const rien = () => new NextResponse(null, { status: 204 });

function recent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t < FENETRE_MS;
}

async function roleInscriptionRecente(): Promise<RoleMeta | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !recent(user.created_at)) return null;
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  return roleMeta(data?.role as string | undefined);
}

async function demoRecenteDePersonnel(demoId: unknown): Promise<boolean> {
  if (typeof demoId !== "string" || !UUID.test(demoId)) return false;
  const { data } = await createServiceClient()
    .from("demo_inscriptions").select("modifie_le, role").eq("id", demoId).maybeSingle();
  // demo_inscriptions est absente des types générés : lecture typée à la main.
  const d = data as { modifie_le?: string; role?: string | null } | null;
  return recent(d?.modifie_le) && leadDemoAutorise(d?.role);
}

export async function POST(req: NextRequest) {
  try {
    if (req.cookies.get(CONSENT_COOKIE)?.value !== "granted") return rien();

    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const jeton = process.env.META_CAPI_TOKEN;
    if (!pixelId || !jeton) {
      console.warn("[meta/capi] NEXT_PUBLIC_META_PIXEL_ID ou META_CAPI_TOKEN absent — envoi ignoré");
      return rien();
    }

    const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!corps) return new NextResponse(null, { status: 400 });
    const evenement = corps.evenement as EvenementMeta;
    if (!EVENEMENTS.includes(evenement) || !eventIdValide(corps.eventId)) {
      return new NextResponse(null, { status: 400 });
    }

    let contentName: RoleMeta | typeof LEAD_DEMO;
    if (evenement === "CompleteRegistration") {
      const role = await roleInscriptionRecente();
      if (!role) return rien();
      contentName = role;
    } else {
      if (!(await demoRecenteDePersonnel(corps.demoId))) return rien();
      contentName = LEAD_DEMO;
    }

    const origine = req.nextUrl.origin;
    const fbp = req.cookies.get("_fbp")?.value ?? null;
    const fbc = req.cookies.get("_fbc")?.value ?? null;
    const payload = construireCorpsCapi({
      evenement,
      eventId: corps.eventId as string,
      contentName,
      eventSourceUrl: urlSourceAssainie(corps.url as string, origine) ?? `${origine}/`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent"),
      fbp: fbp && TEMOIN_FB.test(fbp) ? fbp : null,
      fbc: fbc && TEMOIN_FB.test(fbc) ? fbc : null,
      testEventCode: process.env.META_TEST_EVENT_CODE || null,
    });

    const rep = await fetch(`${GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(jeton)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!rep.ok) {
      console.error(`[meta/capi] ${evenement} refusé (${rep.status}):`, (await rep.text()).slice(0, 500));
    }
  } catch (e) {
    console.error("[meta/capi] échec:", e instanceof Error ? e.message : String(e));
  }
  return rien();
}
