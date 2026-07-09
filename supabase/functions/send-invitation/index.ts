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

const NOTICE_SECRET = Deno.env.get("INVITE_NOTICE_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Base publique du lien de claim (mirroir de createAthleteInvitation.ts :
// `${NEXT_PUBLIC_APP_URL || origin}/claim?token=…`). Override possible via env.
const APP_URL = Deno.env.get("APP_URL") ?? "https://nexussports.ca";

const FROM = "Nexus <info@nexussports.ca>";
const SUBJECT = "Invitation à rejoindre Nexus";

// Corps FR minimal (chantier template séparé).
function buildBody(coachName: string, schoolName: string, claimUrl: string): { html: string; text: string } {
  const coachLabel = coachName ? `Le coach ${coachName}` : "Un coach";
  const schoolPart = schoolName ? ` de ${schoolName}` : "";
  const headline = `${coachLabel}${schoolPart} t'invite à rejoindre Nexus.`;

  const text = [
    headline,
    "",
    "Nexus est la plateforme québécoise qui met en relation les athlètes du",
    "secondaire avec les recruteurs des CÉGEP (réseau RSEQ).",
    "",
    "Pour accepter l'invitation et créer ton profil :",
    claimUrl,
    "",
    "Ce lien est valide 30 jours.",
    "",
    "— L'équipe Nexus",
  ].join("\n");

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.55; color: #1a1d24;">
    <p><strong>${headline}</strong></p>
    <p>
      Nexus est la plateforme québécoise qui met en relation les athlètes du
      secondaire avec les recruteurs des CÉGEP (réseau RSEQ).
    </p>
    <p style="margin: 24px 0;">
      <a href="${claimUrl}"
         style="display: inline-block; background: #E63946; color: #ffffff; text-decoration: none;
                font-weight: bold; padding: 12px 24px; border-radius: 8px;">
        Accepter l'invitation
      </a>
    </p>
    <p style="color: #6b7280; font-size: 13px;">
      Ou copie ce lien dans ton navigateur :<br />
      <a href="${claimUrl}">${claimUrl}</a>
    </p>
    <p style="color: #6b7280; font-size: 13px;">Ce lien est valide 30 jours.</p>
    <p style="color: #6b7280; font-size: 13px;">— L'équipe Nexus</p>
  </div>`.trim();

  return { html, text };
}

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

  const claimUrl = `${APP_URL}/claim?token=${encodeURIComponent(claim_token)}`;
  const { html, text } = buildBody(coach_name, school_name, claimUrl);

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
