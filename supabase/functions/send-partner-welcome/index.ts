// send-partner-welcome : courriel de bienvenue au partenaire média, envoyé à la
// création de son compte par l'admin. Envoie UN courriel via l'API Resend, avec
// ses identifiants (courriel + mot de passe temporaire) et un lien vers /auth.
//
// Auth appelant : header x-partner-welcome-secret == PARTNER_WELCOME_SECRET
// (secret DÉDIÉ, distinct de PARENT_NOTICE_SECRET / INVITE_NOTICE_SECRET /
// TEAM_INVITE_NOTICE_SECRET / MARKETING_NOTICE_SECRET / PUSH_DISPATCH_SECRET).
//
// ⚠️ ÉTAT RÉEL AU 2026-08-19 — CETTE FONCTION N'A AUCUN APPELANT.
//
// L'en-tête d'origine affirmait être « appelée côté serveur par
// app/api/admin/partners/create/route.ts ». C'est FAUX, et ça l'a toujours été.
// Cette route existe bel et bien, mais elle ne contient aucun appel : ni
// `invoke`, ni `fetch` vers cette fonction, ni Resend. Elle crée l'utilisateur,
// insère la ligne media_partners en APPROVED, puis RENVOIE le mot de passe
// temporaire dans sa réponse JSON — que app/admin/partenaires/page.tsx affiche
// une fois à l'écran, dans un encart `select-all`.
//
// Autrement dit : la transmission des accès est aujourd'hui MANUELLE. L'admin
// copie le mot de passe et l'envoie lui-même. Aucun courriel n'est parti de
// cette fonction depuis son déploiement (version 2, 2026-08-13) — les deux
// partenaires APPROVED en prod n'ont jamais reçu d'accueil automatisé.
//
// La raison invoquée pour ne PAS passer par un trigger Postgres reste valide :
// le mot de passe temporaire est généré dans la route et n'est JAMAIS écrit en
// base, donc un trigger sur media_partners ne pourrait pas le connaître.
//
// ⚠️ CONSÉQUENCE POUR TOUT CÂBLAGE FUTUR — `temp_password` est requis (400
// sans lui) et n'est stocké nulle part. Cette fonction ne peut donc PAS servir
// à relancer un partenaire déjà créé : son mot de passe d'origine est perdu.
// Un « renvoyer l'accès » suppose d'abord un chemin de régénération.
//
// Ce fichier a été RAPATRIÉ depuis Supabase le 2026-08-19
// (`supabase functions download`) : il était déployé en prod sans aucune
// source versionnée. Le code est celui qui tourne, à l'octet près — seul ce
// bloc de commentaire a été corrigé.
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
