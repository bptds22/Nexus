// send-invitation : email d'invitation coach→athlète. Envoie UN courriel à
// l'athlète invité via l'API Resend, avec un lien de claim vers /claim?token=…
// (page app/claim/page.tsx → resolve_athlete_invitation / consume au signup).
//
// Auth appelant : header x-invite-notice-secret == INVITE_NOTICE_SECRET
// (secret DÉDIÉ, distinct de PARENT_NOTICE_SECRET / PUSH_DISPATCH_SECRET).
//
// Clone structurel de send-parent-notice. Body attendu :
//   { email, nb_recruteurs, claim_token, invitation_id }
// email + claim_token + invitation_id strictement requis ; nb_recruteurs absent = phrase sans
// chiffre. invitation_id sert au lien « Ne plus recevoir ces courriels » (jeton signé « a. »).
// coach_name / coach_ecole : présents SEULEMENT pour un coach du secondaire ou du civil (la base
// en décide, coach_nommable) ; absents → aucun nom de coach dans le courriel.
//
// Gabarit : mutualisé dans ../_shared/emailLayout.ts (renderEmail). Le corps
// spécifique à ce courriel vit dans ./email.ts (buildBody).

import { FROM, APP_URL, SUPPORT } from "../_shared/emailLayout.ts";
import { buildBody, SUJET } from "./email.ts";
// @ts-ignore TS5097 — module Deno, l'extension .ts est obligatoire.
import { signerJetonInvitationAthlete } from "../_shared/jetonDesabonnement.ts";

const NOTICE_SECRET = Deno.env.get("INVITE_NOTICE_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// @ts-ignore TS2304 — Deno, hors du typage Next.
const DESABONNEMENT_SECRET = Deno.env.get("DESABONNEMENT_SECRET") ?? "";

const SUBJECT = SUJET;

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
  // Le lien de désabonnement désigne l'invitation (le destinataire n'a pas de compte).
  const invitation_id = typeof payload?.invitation_id === "string" ? payload.invitation_id.trim() : "";
  if (!invitation_id) return new Response("invitation_id requis", { status: 400 });
  // Secret absent ou trop court : panne de configuration. Pas de courriel sans lien de
  // désabonnement valide (même garde que send-invitation-carte).
  if (DESABONNEMENT_SECRET.length < 32) {
    console.error("send-invitation: DESABONNEMENT_SECRET absent ou trop court");
    return new Response("configuration", { status: 500 });
  }
  let jeton: string;
  try {
    jeton = encodeURIComponent(await signerJetonInvitationAthlete(invitation_id, DESABONNEMENT_SECRET));
  } catch {
    return new Response("invitation_id invalide", { status: 400 });
  }

  // Le nombre réel de recruteurs (absent → la phrase « profil prêt », jamais un chiffre inventé) ;
  // le coach seulement si la base l'a transmis (secondaire ou civil).
  const claimUrl = `${APP_URL}/claim?token=${encodeURIComponent(claim_token)}`;
  const { html, text } = buildBody(payload?.nb_recruteurs, claimUrl, `${APP_URL}/desabonnement?t=${jeton}`,
    { nom: payload?.coach_name, ecole: payload?.coach_ecole });

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
      headers: {
        "List-Unsubscribe": `<${APP_URL}/api/desabonnement?t=${jeton}>, <mailto:${SUPPORT}?subject=desabonnement>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
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
