// send-parent-notice : avis parental Loi 25 quand un athlète mineur (14-17)
// finalise son inscription. Envoie UN courriel au parent via l'API Resend.
// Auth appelant : header x-parent-notice-secret == PARENT_NOTICE_SECRET
// (secret DÉDIÉ, distinct de PUSH_DISPATCH_SECRET).
//
// PII minimisée : le corps ne nomme JAMAIS l'enfant. Le body n'attend que
// { parent_email, parent_first_name } — le prénom/nom de l'athlète n'est ni
// requis ni transmis.

const NOTICE_SECRET = Deno.env.get("PARENT_NOTICE_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const FROM = "Nexus <info@nexussports.ca>";
const SUBJECT = "Votre enfant s'est inscrit sur Nexus";
// Base publique de l'app (pour le lien de création de compte parent).
const APP_URL = Deno.env.get("APP_URL") ?? "https://nexussports.ca";

// Corps FR minimal (chantier template séparé). PII : aucun nom d'enfant.
// Lot 1a — si un claimToken est fourni, on ajoute le lien de création de
// compte parent (${APP_URL}/parent/claim?token=…). Ton conservé.
function buildBody(parentFirstName: string, claimToken: string): { html: string; text: string } {
  const greeting = parentFirstName ? `Bonjour ${parentFirstName},` : "Bonjour,";
  const claimUrl = claimToken ? `${APP_URL}/parent/claim?token=${encodeURIComponent(claimToken)}` : "";

  const ctaText = claimUrl
    ? [
        "",
        "Créez votre compte parent pour gérer les consentements et suivre",
        "l'activité liée au profil de votre enfant :",
        claimUrl,
      ]
    : [];

  const text = [
    greeting,
    "",
    "Votre enfant s'est inscrit sur Nexus, une plateforme québécoise qui met en",
    "relation les athlètes du secondaire avec les recruteurs des CÉGEP (réseau RSEQ).",
    ...ctaText,
    "",
    "Ce que vous devez savoir :",
    "- Aucun recruteur ni joueur ne peut contacter votre enfant directement. Le seul",
    "  contact possible passe par l'entraîneur ou le directeur sportif de son école.",
    "- Le profil peut être supprimé à tout moment depuis les paramètres du compte.",
    "",
    "Ce courriel vous est envoyé conformément à la Loi 25 (protection des",
    "renseignements personnels). Pour toute question : confidentialite@nexussports.ca.",
    "",
    "— L'équipe Nexus",
  ].join("\n");

  const ctaHtml = claimUrl
    ? `
    <p style="margin: 22px 0 8px;">
      <a href="${claimUrl}"
         style="display:inline-block;background:#E63946;color:#ffffff;text-decoration:none;
                font-weight:bold;padding:12px 24px;border-radius:8px;">
        Créer mon compte parent
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:0;">
      Ce compte vous permettra de gérer les consentements et de suivre l'activité
      liée au profil de votre enfant.
    </p>`
    : "";

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.55; color: #1a1d24;">
    <p>${greeting}</p>
    <p>
      Votre enfant s'est inscrit sur <strong>Nexus</strong>, une plateforme québécoise
      qui met en relation les athlètes du secondaire avec les recruteurs des CÉGEP
      (réseau RSEQ).
    </p>${ctaHtml}
    <p><strong>Ce que vous devez savoir :</strong></p>
    <ul>
      <li>
        Aucun recruteur ni joueur ne peut contacter votre enfant directement. Le seul
        contact possible passe par l'entraîneur ou le directeur sportif de son école.
      </li>
      <li>
        Le profil peut être supprimé à tout moment depuis les paramètres du compte.
      </li>
    </ul>
    <p style="color: #6b7280; font-size: 13px;">
      Ce courriel vous est envoyé conformément à la Loi 25 (protection des
      renseignements personnels). Pour toute question :
      <a href="mailto:confidentialite@nexussports.ca">confidentialite@nexussports.ca</a>.
    </p>
    <p style="color: #6b7280; font-size: 13px;">— L'équipe Nexus</p>
  </div>`.trim();

  return { html, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-parent-notice-secret") !== NOTICE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  // Seuls champs consommés : parent_email (destinataire) + parent_first_name
  // (formule d'appel). Aucun nom d'enfant attendu ni lu.
  const parent_email = typeof payload?.parent_email === "string" ? payload.parent_email.trim() : "";
  const parent_first_name = typeof payload?.parent_first_name === "string" ? payload.parent_first_name.trim() : "";
  // Lot 1a — token de création de compte parent (facultatif : rétro-compatible).
  const claim_token = typeof payload?.claim_token === "string" ? payload.claim_token.trim() : "";
  if (!parent_email) {
    return new Response("parent_email requis", { status: 400 });
  }

  const { html, text } = buildBody(parent_first_name, claim_token);

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
    console.error(`send-parent-notice: Resend ${res.status} ${errText}`);
    return new Response(JSON.stringify({ ok: false, resend_status: res.status, error: errText }),
      { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  const json = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, id: json?.id ?? null }),
    { headers: { "Content-Type": "application/json" } });
});
