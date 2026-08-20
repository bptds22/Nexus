// send-partner-welcome : courriel de bienvenue au partenaire média, envoyé à la
// création de son compte par l'admin. Envoie UN courriel via l'API Resend, avec
// ses identifiants (courriel + mot de passe temporaire) et un lien vers /auth.
//
// Auth appelant : header x-partner-welcome-secret == PARTNER_WELCOME_SECRET
// (secret DÉDIÉ, distinct de PARENT_NOTICE_SECRET / INVITE_NOTICE_SECRET /
// TEAM_INVITE_NOTICE_SECRET / MARKETING_NOTICE_SECRET / PUSH_DISPATCH_SECRET).
//
// APPELANTS (câblés le 2026-08-20 — voir l'historique plus bas) :
//   app/api/admin/partners/create/route.ts        -> à la création
//   app/api/admin/partners/[id]/resend/route.ts   -> à la régénération
// Les deux passent par le helper partagé lib/partners/sendWelcomeEmail.ts.
//
// PARTICULARITÉ — contrairement aux autres fonctions courriel, celle-ci n'est
// PAS déclenchée par un trigger Postgres. Le mot de passe temporaire est
// généré dans la route et n'est JAMAIS écrit en base : un trigger sur
// media_partners ne pourrait pas le connaître.
//
// ⚠️ ELLE NE SAIT PAS RELANCER UN PARTENAIRE EXISTANT. `temp_password` est
// requis (400 sans lui) et n'est stocké nulle part. Un « renvoyer les accès »
// doit donc RÉGÉNÉRER le mot de passe avant d'appeler ici — c'est ce que fait
// la route /resend, via auth.admin.updateUserById.
//
// ⚠️ L'ÉCHEC D'ENVOI NE DOIT JAMAIS FAIRE ÉCHOUER L'APPELANT. Après une
// régénération, le mot de passe est déjà posé et l'ancien invalidé : faire
// échouer la route effacerait le seul exemplaire du nouveau. Les deux routes
// rendent `temp_password` quoi qu'il arrive, et l'écran admin l'affiche avec
// un bandeau rouge en cas d'échec.
//
// ── HISTORIQUE, À NE PAS PERDRE ──────────────────────────────────────────────
// Déployée le 2026-08-13 (version 2) SANS AUCUNE SOURCE VERSIONNÉE et SANS
// AUCUN APPELANT. Son en-tête d'origine affirmait déjà être appelée par
// app/api/admin/partners/create/route.ts — c'était faux : cette route existait
// mais ne contenait ni `invoke`, ni `fetch`, ni Resend. Elle affichait le mot
// de passe à l'écran admin et la transmission reposait sur un copier-coller.
//
// Conséquence concrète : Jules Regimbald (lespritsportifmedia@gmail.com), créé
// le 2026-08-13 et APPROVED, n'a jamais reçu ses accès, ne s'est jamais
// connecté, et RIEN en base ne permettait de le savoir. Six jours de silence.
// D'où la colonne media_partners.welcome_email_sent_at, ajoutée le 2026-08-20.
//
// Source rapatriée le 2026-08-19 (`supabase functions download`). Le code est
// celui qui tourne, à l'octet près — seul ce bloc de commentaire a changé.
//
// Corps attendu :
//   { email, organization_name, contact_name, temp_password }
// email + temp_password strictement requis ; les noms ont un repli gracieux.
//
// Gabarit : ossature mutualisée dans ../_shared/emailLayout.ts (renderEmail) ;
// le corps propre à ce courriel vit dans ./email.ts (buildBody).

import { FROM, APP_URL } from "../_shared/emailLayout.ts";
import { buildBody } from "./email.ts";

const NOTICE_SECRET = Deno.env.get("PARTNER_WELCOME_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const SUBJECT = "Ton accès partenaire Nexus";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-partner-welcome-secret") !== NOTICE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const texte = (k: string) => (typeof payload?.[k] === "string" ? payload[k].trim() : "");

  // Requis : le destinataire et le mot de passe. Sans le mot de passe le
  // courriel n'a aucune valeur — le partenaire ne pourrait pas se connecter.
  const email = texte("email");
  const temp_password = texte("temp_password");
  if (!email) return new Response("email requis", { status: 400 });
  if (!temp_password) return new Response("temp_password requis", { status: 400 });

  // Repli gracieux : noms optionnels (le courriel part même sans).
  const organizationName = texte("organization_name") || "ton organisation";
  const contactName = texte("contact_name") || "toi";

  const loginUrl = `${APP_URL}/auth`;
  const { html, text } = buildBody(organizationName, contactName, email, temp_password, loginUrl);

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
    console.error(`send-partner-welcome: Resend ${res.status} ${errText}`);
    return new Response(JSON.stringify({ ok: false, resend_status: res.status, error: errText }),
      { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  const json = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, id: json?.id ?? null }),
    { headers: { "Content-Type": "application/json" } });
});
