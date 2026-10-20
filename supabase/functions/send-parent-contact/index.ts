// send-parent-contact : avis au parent quand un recruteur contacte son enfant
// mineur (trigger aviser_parent_contact_recruteur, 20261020170000).
// Auth appelant : header x-parent-contact-secret == PARENT_CONTACT_SECRET
// (secret DÉDIÉ, lu par le trigger dans le Vault).
//
// Deux modes, un seul texte (./email.ts) :
//   { mode: "courriel", to, lang, claim_token? } → un courriel (Resend) ;
//   { mode: "push", user_id, lang }               → un push par send-push, le
//     canal du coach (x-push-secret = PUSH_DISPATCH_SECRET, secret du projet).
// Les heures calmes sont gérées en base (parent_contact_envoyer_push) : ici,
// on envoie.
//
// Courriel en local : EMAIL_TRANSPORT=mailpit poste à l'API HTTP de Mailpit
// (MAILPIT_URL) au lieu de Resend. Absente, la variable laisse Resend : la
// prod n'a rien à poser.

import { FROM } from "../_shared/emailLayout.ts";
import { buildCourriel, langue, textePush } from "./email.ts";

const SECRET = Deno.env.get("PARENT_CONTACT_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const PUSH_SECRET = Deno.env.get("PUSH_DISPATCH_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const TRANSPORT = Deno.env.get("EMAIL_TRANSPORT") ?? "resend";
const MAILPIT_URL = Deno.env.get("MAILPIT_URL") ?? "http://supabase_inbucket_Nexus:8025";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function envoyerCourriel(to: string, subject: string, html: string, text: string) {
  if (TRANSPORT === "mailpit") {
    const m = FROM.match(/^(.*)<(.+)>$/);
    const res = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Name: m ? m[1].trim() : "", Email: m ? m[2].trim() : FROM },
        To: [{ Email: to }],
        Subject: subject,
        HTML: html,
        Text: text,
      }),
    });
    return { ok: res.ok, status: res.status, detail: await res.text().catch(() => "") };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  return { ok: res.ok, status: res.status, detail: await res.text().catch(() => "") };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SECRET || req.headers.get("x-parent-contact-secret") !== SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const l = langue(payload?.lang);

  if (payload?.mode === "courriel") {
    const to = typeof payload?.to === "string" ? payload.to.trim() : "";
    const claimToken = typeof payload?.claim_token === "string" ? payload.claim_token.trim() : "";
    if (!to) return new Response("to requis", { status: 400 });
    const { subject, html, text } = buildCourriel(l, claimToken);
    const r = await envoyerCourriel(to, subject, html, text);
    if (!r.ok) {
      console.error(`send-parent-contact: courriel ${TRANSPORT} ${r.status} ${r.detail}`);
      return json({ ok: false, mode: "courriel", transport: TRANSPORT, status: r.status }, r.status);
    }
    // Identifiant d'envoi du transport (Resend : { id } ; Mailpit : { ID }) — la
    // preuve de livraison côté fournisseur. Jamais l'adresse dans le journal.
    let envoiId: string | null = null;
    try { const d = JSON.parse(r.detail); envoiId = d?.id ?? d?.ID ?? null; } catch { /* corps non JSON */ }
    console.log(JSON.stringify({ evt: "parent_contact_courriel", transport: TRANSPORT, status: r.status, envoi_id: envoiId }));
    return json({ ok: true, mode: "courriel", transport: TRANSPORT, envoi_id: envoiId });
  }

  if (payload?.mode === "push") {
    const userId = typeof payload?.user_id === "string" ? payload.user_id.trim() : "";
    if (!userId) return new Response("user_id requis", { status: 400 });
    if (!PUSH_SECRET || !SUPABASE_URL) return json({ ok: false, mode: "push", erreur: "push non configuré" }, 500);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-push-secret": PUSH_SECRET },
      body: JSON.stringify({ user_id: userId, title: "Nexus", body: textePush(l), data: { type: "announcement" } }),
    });
    const detail = await res.text().catch(() => "");
    console.log(JSON.stringify({ evt: "parent_contact_push", user_id: userId, status: res.status, detail }));
    return json({ ok: res.ok, mode: "push", send_push_status: res.status, send_push: detail }, res.ok ? 200 : 502);
  }

  return new Response("mode inconnu", { status: 400 });
});
