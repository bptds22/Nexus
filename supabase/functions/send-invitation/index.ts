// send-invitation : email d'invitation coach→athlète. Envoie UN courriel à
// l'athlète invité via l'API Resend, avec un lien de claim vers /claim?token=…
// (page app/claim/page.tsx → resolve_athlete_invitation / consume au signup).
//
// Auth appelant : header x-invite-notice-secret == INVITE_NOTICE_SECRET
// (secret DÉDIÉ, distinct de PARENT_NOTICE_SECRET / PUSH_DISPATCH_SECRET).
//
// Clone structurel de send-parent-notice. Body attendu :
//   { email, coach_name, school_name, claim_token }
// email + claim_token strictement requis ; coach_name/school_name = repli gracieux.
//
// Gabarit : mutualisé dans ../_shared/emailLayout.ts (renderEmail). Le corps
// spécifique à ce courriel vit dans ./email.ts (buildBody).

import { FROM, APP_URL } from "../_shared/emailLayout.ts";
import { buildBody } from "./email.ts";

const NOTICE_SECRET = Deno.env.get("INVITE_NOTICE_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const SUBJECT = "Invitation à rejoindre Nexus";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-invite-notice-secret") !== NOTICE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  // Requis : email (destinataire) + claim_token (le lien de claim). Sans l'un
  // des deux, pas d'invitation valide.
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  const claim_token = typeof payload?.claim_token === "string" ? payload.claim_token.trim() : "";
  if (!email) return new Response("email requis", { status: 400 });
  if (!claim_token) return new Response("claim_token requis", { status: 400 });

  // Repli gracieux : noms optionnels (le courriel part même sans).
  const coach_name = typeof payload?.coach_name === "string" ? payload.coach_name.trim() : "";
  const school_name = typeof payload?.school_name === "string" ? payload.school_name.trim() : "";
  const coachName = coach_name || "Ton coach";
  const schoolName = school_name || "ton école";

  const claimUrl = `${APP_URL}/claim?token=${encodeURIComponent(claim_token)}`;
  const { html, text } = buildBody(coachName, schoolName, claimUrl);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: email,
      subject: SUBJECT,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`send-invitation: Resend ${res.status} ${errText}`);
    return new Response(JSON.stringify({ ok: false, resend_status: res.status, error: errText }),
      { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  const json = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, id: json?.id ?? null }),
    { headers: { "Content-Type": "application/json" } });
});
