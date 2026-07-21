// send-parent-marketing : avis parental « consentement à l'utilisation de
// l'image » (marketing) pour un athlète mineur 14-17 ayant opté pour le
// consentement marketing au signup. Envoie UN courriel au parent via Resend.
//
// Jumeau de send-parent-notice. Auth appelant : header
// x-marketing-notice-secret == MARKETING_NOTICE_SECRET (secret DÉDIÉ, distinct
// de PARENT_NOTICE_SECRET / INVITE_NOTICE_SECRET / PUSH_DISPATCH_SECRET).
//
// PII minimisée : le corps ne nomme JAMAIS l'enfant. Le body n'attend que
// { parent_email, parent_first_name }.
//
// Gabarit : mutualisé dans ../_shared/emailLayout.ts (renderEmail). Le corps
// spécifique à ce courriel vit dans ./email.ts (buildBody).

import { FROM } from "../_shared/emailLayout.ts";
import { buildBody } from "./email.ts";

const NOTICE_SECRET = Deno.env.get("MARKETING_NOTICE_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const SUBJECT = "Consentement à l'utilisation de l'image de votre enfant";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-marketing-notice-secret") !== NOTICE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  // Seuls champs consommés : parent_email (destinataire) + parent_first_name
  // (formule d'appel). Aucun nom d'enfant attendu ni lu.
  const parent_email = typeof payload?.parent_email === "string" ? payload.parent_email.trim() : "";
  const parent_first_name = typeof payload?.parent_first_name === "string" ? payload.parent_first_name.trim() : "";
  if (!parent_email) {
    return new Response("parent_email requis", { status: 400 });
  }

  const { html, text } = buildBody(parent_first_name);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: parent_email,
      subject: SUBJECT,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // Le trigger BEFORE avale l'erreur de toute façon ; on log + renvoie le
    // statut Resend pour diagnostic.
    console.error(`send-parent-marketing: Resend ${res.status} ${errText}`);
    return new Response(JSON.stringify({ ok: false, resend_status: res.status, error: errText }),
      { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  const json = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, id: json?.id ?? null }),
    { headers: { "Content-Type": "application/json" } });
});
