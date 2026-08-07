// send-team-invitation : courriel coach→athlète pour un TRANSFERT d'équipe.
// Envoie UN courriel via Resend.
//
// Corps attendu :
//   { email, coach_name, team_name, school_name, sport, age_group, division,
//     gender, transfer_token }
// email + transfer_token strictement requis ; le reste = repli gracieux.
//
// À NE PAS CONFONDRE avec send-invitation, qui est la RÉCLAMATION d'un profil
// par un athlète SANS compte (lien /claim). Ici l'athlète a déjà un compte : le
// lien mène au portail de transfert, avec le jeton en paramètre.
//
// Gabarit : ossature mutualisée dans ../_shared/emailLayout.ts (renderEmail) ;
// le corps propre à ce courriel vit dans ./email.ts (buildBody).

import { FROM, APP_URL } from "../_shared/emailLayout.ts";
import { buildBody } from "./email.ts";

const NOTICE_SECRET = Deno.env.get("TEAM_INVITE_NOTICE_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const SUBJECT = "Un coach t'invite dans son équipe";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-team-invite-notice-secret") !== NOTICE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const texte = (k: string) => (typeof payload?.[k] === "string" ? payload[k].trim() : "");

  // Requis : le destinataire et le jeton. Sans le jeton, le lien mènerait à un
  // portail vide — autant ne rien envoyer.
  const email = texte("email");
  const transfer_token = texte("transfer_token");
  if (!email) return new Response("email requis", { status: 400 });
  if (!transfer_token) return new Response("transfer_token requis", { status: 400 });

  const coachName = texte("coach_name") || "Un entraîneur";
  const teamName = texte("team_name") || "une équipe";
  const schoolName = texte("school_name");

  // Le jeton voyage dans l'URL. Il ne CONFÈRE rien — l'acceptation reste bornée
  // par is_own_athlete côté base — mais il désigne l'invitation à préremplir.
  // encodeURIComponent par principe : l'alphabet des codes est déjà sûr en URL,
  // on ne parie pas dessus.
  //
  // CHEMIN COMPLET, PAS DE LIEN COURT. Le bundle Capacitor est un
  // output:'export' — ni redirections ni gestionnaires de route (voir
  // next.config.ts) — donc l'URL doit désigner la page finale elle-même.
  //
  // /athlete/transfert, PAS /athlete/parametres?tab=transfert. L'ancienne forme
  // était doublement cassée : la page tenait son onglet dans un useState figé
  // sur « compte » — `tab` n'était lu par PERSONNE, l'athlète atterrissait sur
  // ses réglages de compte et devait trouver l'onglet lui-même — et sur mobile
  // l'onglet n'existait pas du tout (bascule sur AthleteParametresMobile).
  // Le transfert a maintenant sa propre route, identique sur les deux
  // plateformes. Si ce lien change, il n'a plus qu'un seul endroit où pointer.
  //
  // `t` reste transporté mais n'est PAS encore lu par la page : le
  // préremplissage depuis le jeton est un chantier à part. Le lien amène au bon
  // écran ; l'athlète saisit son code. Ne pas retirer le paramètre en le
  // croyant mort — c'est la page qui doit le brancher.
  //
  // Ce lien ouvrira Safari, jamais l'application : un apple-app-site-association
  // est publié sur le domaine mais l'app ne le réclame pas — dette consignée
  // dans capacitor.config.ts. Ne pas « corriger » ce lien en supposant l'app.
  const transferUrl =
    `${APP_URL}/athlete/transfert?t=${encodeURIComponent(transfer_token)}`;

  const { html, text } = buildBody(
    coachName,
    teamName,
    schoolName,
    {
      sport: texte("sport"),
      ageGroup: texte("age_group"),
      division: texte("division"),
      gender: texte("gender"),
    },
    transferUrl,
  );

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
    const errText = await res.text();
    console.error(`send-team-invitation: Resend ${res.status} ${errText}`);
    return new Response(JSON.stringify({ ok: false, resend_status: res.status, error: errText }),
      { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  const json = await res.json().catch(() => null);
  return new Response(JSON.stringify({ ok: true, id: json?.id ?? null }),
    { status: 200, headers: { "Content-Type": "application/json" } });
});
