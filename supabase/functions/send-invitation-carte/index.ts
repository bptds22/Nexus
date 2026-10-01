// send-invitation-carte : envoie l'invitation d'une CARTE PROSPECT (lot C).
//
// Appelant UNIQUE : public.envoyer_invitation_carte(), appelée par le trigger
// cartes_prospect_inviter à la CRÉATION d'une carte dont l'adresse n'appartient
// à aucun compte ni athlète, n'est pas désabonnée et n'a pas été invitée
// depuis 90 jours. Header x-carte-invitation-secret == CARTE_INVITATION_SECRET
// (même valeur au vault : name = 'CARTE_INVITATION_SECRET').
//
// Corps : { "invitation_id": "<uuid>" } — invitation à la création — OU
// { "rappel_id": "<uuid>" } — rappel demandé par un recruteur
// (public.envoyer_rappel_carte, décision BP 2026-09-30). Tout le reste est
// relu en base.
//
// Secrets requis : CARTE_INVITATION_SECRET, RESEND_API_KEY, DESABONNEMENT_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traiterInvitation, traiterRappel } from "./traiter.ts";

const SECRET = Deno.env.get("CARTE_INVITATION_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DESABONNEMENT_SECRET = Deno.env.get("DESABONNEMENT_SECRET") ?? "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SECRET || req.headers.get("x-carte-invitation-secret") !== SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!RESEND_API_KEY || DESABONNEMENT_SECRET.length < 32) {
    return json({ ok: false, erreur: "Configuration incomplète (RESEND_API_KEY ou DESABONNEMENT_SECRET)." }, 500);
  }
  let corps: { invitation_id?: unknown; rappel_id?: unknown };
  try { corps = await req.json(); } catch { return json({ ok: false, erreur: "JSON invalide" }, 400); }
  const invitationId = typeof corps.invitation_id === "string" ? corps.invitation_id : "";
  const rappelId = typeof corps.rappel_id === "string" ? corps.rappel_id : "";
  // Exactement un des deux.
  if (UUID_RE.test(invitationId) === UUID_RE.test(rappelId)) {
    return json({ ok: false, erreur: "invitation_id ou rappel_id attendu (un seul)" }, 400);
  }

  const deps = { supabase, fetch, resendApiKey: RESEND_API_KEY, desabonnementSecret: DESABONNEMENT_SECRET };
  const r = rappelId ? await traiterRappel(deps, rappelId) : await traiterInvitation(deps, invitationId);
  if (!r.ok) console.error(`[invitation-carte] ${rappelId ? `rappel ${rappelId}` : invitationId} : ${r.erreur}`);
  return json(r, r.ok ? 200 : 502);
});
