// send-parent-retrait-partenaires : prévient le parent quand son enfant
// MINEUR retire le consentement partenaires (décision BP 2026-09-29, §55).
// Appelée par le trigger trg_notify_parent_retrait_partenaires
// (consent_audit_trail), jamais par le client.
//
// Auth appelant : header x-parent-notice-secret == PARENT_NOTICE_SECRET —
// même secret que send-parent-notice : même émetteur (la base, via pg_net),
// même domaine de confiance. Aucun nouveau secret à créer.
//
// Body : { parent_email, parent_first_name?, athlete_first_name?,
//          lien: 'parent'|'claim'|'accueil', claim_token?, audit_id }
// Idempotency-Key Resend = audit_id : un rejeu de pg_net ne double pas le
// courriel. Le courriel n'est jamais journalisé en clair.

import { FROM, SUPPORT } from "../_shared/emailLayout.ts";
import { buildBody, sujet, type Lien } from "./email.ts";

const NOTICE_SECRET = Deno.env.get("PARENT_NOTICE_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const LIENS: Lien[] = ["parent", "claim", "accueil"];

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!NOTICE_SECRET || req.headers.get("x-parent-notice-secret") !== NOTICE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const parentEmail = texte(payload.parent_email);
  const auditId = texte(payload.audit_id);
  const lien = (LIENS as string[]).includes(String(payload.lien)) ? (payload.lien as Lien) : "accueil";
  if (!parentEmail || !auditId) return new Response("parent_email et audit_id requis", { status: 400 });

  const prenomAthlete = texte(payload.athlete_first_name);
  const { html, text } = buildBody({
    prenomParent: texte(payload.parent_first_name),
    prenomAthlete,
    lien,
    claimToken: texte(payload.claim_token),
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `retrait-partenaires/${auditId}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: parentEmail,
      reply_to: SUPPORT,
      subject: sujet(prenomAthlete),
      html,
      text,
      tags: [{ name: "type", value: "retrait_partenaires" }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`send-parent-retrait-partenaires: audit ${auditId} — Resend ${res.status} ${err}`);
    return new Response(JSON.stringify({ ok: false, resend_status: res.status }),
      { status: res.status, headers: { "Content-Type": "application/json" } });
  }
  const j = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, id: (j as { id?: string })?.id ?? null }),
    { headers: { "Content-Type": "application/json" } });
});
