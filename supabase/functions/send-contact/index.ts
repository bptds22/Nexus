// send-contact : formulaire de contact public de la page /a-propos.
//
// Appelé DEPUIS LE NAVIGATEUR via supabase.functions.invoke("send-contact").
// La gateway Supabase vérifie le JWT anon (clé publique du front) → gate léger.
// Endpoint public → anti-spam obligatoire : honeypot (champ caché "company" qui
// doit rester vide) + garde-fous de longueur + validation courriel.
//
// Envoi via Resend vers l'adresse interne. reply_to = adresse du visiteur pour
// pouvoir répondre directement depuis la boîte. FROM mutualisé (domaine vérifié).

import { FROM } from "../_shared/emailLayout.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Destinataire interne du formulaire de contact.
const TO = "bpdesfosses@nexussports.ca";

// CORS : requête cross-origin depuis nexussports.ca vers le domaine functions.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "Bad JSON" }, 400); }

  const name = str(payload?.name);
  const email = str(payload?.email);
  const subject = str(payload?.subject);
  const message = str(payload?.message);
  const honeypot = str(payload?.company); // doit rester vide

  // Honeypot rempli = bot. On répond 200 (ne pas révéler le piège) sans envoyer.
  if (honeypot) return json({ ok: true });

  // Validation minimale.
  if (!name || !email || !message) return json({ ok: false, error: "Champs requis manquants" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "Courriel invalide" }, 400);
  if (name.length > 120 || email.length > 200 || subject.length > 160 || message.length > 5000) {
    return json({ ok: false, error: "Champs trop longs" }, 400);
  }

  const subjectLine = `Contact /a-propos${subject ? ` — ${subject}` : ""} — ${name}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1d24;">
    <p><strong>Nouveau message — formulaire /a-propos</strong></p>
    <p>
      <strong>Nom :</strong> ${esc(name)}<br>
      <strong>Courriel :</strong> ${esc(email)}<br>
      <strong>Sujet :</strong> ${esc(subject || "(non précisé)")}
    </p>
    <p style="white-space:pre-wrap;">${esc(message)}</p>
  </div>`;
  const text = [
    "Nouveau message — formulaire /a-propos",
    "",
    `Nom : ${name}`,
    `Courriel : ${email}`,
    `Sujet : ${subject || "(non précisé)"}`,
    "",
    message,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: TO,
      reply_to: email,
      subject: subjectLine,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`send-contact: Resend ${res.status} ${errText}`);
    return json({ ok: false, error: "Envoi échoué" }, 502);
  }

  const j = await res.json().catch(() => ({}));
  return json({ ok: true, id: j?.id ?? null });
});
