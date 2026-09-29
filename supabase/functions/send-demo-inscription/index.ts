// send-demo-inscription : courriels d'une inscription à la démo du 12 octobre
// (confirmation à l'inscrit, avis à info@).
//
// Appelé DEPUIS LE NAVIGATEUR (/12octobre) juste après la RPC inscrire_demo,
// avec l'id qu'elle a rendu. Aucune autre entrée n'est lue du client : tout
// est relu en base, et chaque courriel est RÉCLAMÉ avant l'envoi — un id
// rejoué n'envoie rien de plus. La limite de débit et le pot de miel vivent
// dans la RPC. verify_jwt = false (config.toml), comme send-contact : le
// front peut envoyer une clé publishable (non-JWT).
//
// Secret requis : RESEND_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traiterInscription } from "./traiter.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!RESEND_API_KEY) return json({ ok: false, erreur: "Configuration incomplète" }, 500);
  let corps: { id?: unknown };
  try { corps = await req.json(); } catch { return json({ ok: false }, 400); }
  const id = typeof corps.id === "string" ? corps.id : "";
  if (!UUID_RE.test(id)) return json({ ok: false }, 400);

  const r = await traiterInscription({ supabase, fetch, resendApiKey: RESEND_API_KEY }, id);
  if (r.erreur) console.error(`[demo-inscription] ${id} : ${r.erreur}`);
  // Le client ne reçoit que « ok » : rien sur l'existence d'un id.
  return json({ ok: r.confirmation !== "ECHEC" && r.avis !== "ECHEC" });
});
