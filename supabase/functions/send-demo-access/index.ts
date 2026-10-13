// send-demo-access : courriels d'une demande d'accès à l'enregistrement de la
// démo (/12octobre) — le courriel A (lien personnel) au demandeur, l'avis à
// info@.
//
// Appelé par la route serveur POST /api/demo-access juste après la RPC
// demo_access_demander, avec l'id qu'elle a rendu. Aucune autre entrée n'est
// lue : tout est relu en base, et chaque courriel est RÉCLAMÉ avant l'envoi —
// un id rejoué n'envoie rien de plus. verify_jwt = false (config.toml), comme
// send-demo-inscription.
//
// Secret requis : RESEND_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traiterDemande } from "./traiter.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Preuve locale seulement : un Resend simulé. Absente en prod → api.resend.com.
const RESEND_URL = Deno.env.get("RESEND_URL") || undefined;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!RESEND_API_KEY) return json({ ok: false, erreur: "Configuration incomplète" }, 500);
  let corps: { id?: unknown };
  try { corps = await req.json(); } catch { return json({ ok: false }, 400); }
  const id = typeof corps.id === "string" ? corps.id : "";
  if (!UUID_RE.test(id)) return json({ ok: false }, 400);

  const r = await traiterDemande({ supabase, fetch, resendApiKey: RESEND_API_KEY, resendUrl: RESEND_URL }, id);
  if (r.erreur) console.error(`[demo-access] ${id} : ${r.erreur}`);
  return json({ ok: r.courriel !== "ECHEC" && r.avis !== "ECHEC", courriel: r.courriel, avis: r.avis });
});
