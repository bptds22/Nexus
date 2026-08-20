import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendWelcomeEmail } from "@/lib/partners/sendWelcomeEmail";

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/partners/[id]/resend
   Régénère un mot de passe temporaire pour un partenaire EXISTANT
   et lui renvoie ses accès. Réservé à is_platform_admin.

   `id` = media_partners.id (PAS user_id, PAS auth.uid()) — même
   convention que partner_card_downloads.partner_id.

   ── POURQUOI CETTE ROUTE EXISTE ─────────────────────────────
   Le mot de passe temporaire est généré à la création et
   n'est JAMAIS stocké (« shown once, not stored »). Si l'admin ne
   l'a pas transmis, il est définitivement perdu et le partenaire
   ne peut plus entrer. C'est arrivé : Jules Regimbald, créé le
   2026-08-13, APPROVED, jamais connecté.

   send-partner-welcome ne peut PAS servir à relancer un partenaire
   existant — elle exige `temp_password` (400 sans lui) et ne sait
   pas en fabriquer un. Il faut donc régénérer AVANT d'envoyer.

   ── ROUTE SÉPARÉE, PAS UNE BRANCHE DE LA CRÉATION ───────────
   La création fait sept choses (createUser, patch users, insert
   media_partners). La régénération n'en fait qu'une :
   updateUserById. Les fusionner imposerait un « l'utilisateur
   existe-t-il ? » dont les deux branches finiraient par diverger.

   Réponse :
     { email, temp_password, email_envoye: boolean, email_erreur?: string }

   `temp_password` est rendu MÊME si l'envoi échoue — voir l'étape 7.
═══════════════════════════════════════════════════════════════ */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: partnerId } = await params;

  // 1. Authenticate
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Authorize — must be platform admin (garde identique à la création)
  const { data: meRow, error: meErr } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();
  if (meErr || !meRow?.is_platform_admin) {
    return NextResponse.json({ error: "Accès refusé — privilèges insuffisants" }, { status: 403 });
  }

  // 3. Service-role client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[admin/partners/resend] Missing service-role env vars");
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }
  const sbAdmin = createSbClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4. Charger le partenaire. En service-role pour ne pas dépendre des
  //    policies de lecture — l'autorisation a déjà été faite à l'étape 2.
  const { data: partner, error: partnerErr } = await sbAdmin
    .from("media_partners")
    .select("id, user_id, organization_name, contact_name, contact_email, status")
    .eq("id", partnerId)
    .maybeSingle();
  if (partnerErr || !partner) {
    return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 });
  }

  /* 5. Refuser si le compte n'est pas actif. Renvoyer des accès à un
        partenaire SUSPENDED ou REVOKED lui rouvrirait la porte que la
        bascule de statut a fermée. */
  if (partner.status !== "APPROVED") {
    return NextResponse.json(
      { error: `Statut « ${partner.status} » — seuls les partenaires APPROVED peuvent recevoir de nouveaux accès.` },
      { status: 409 },
    );
  }

  // 6. Nouveau mot de passe temporaire — même générateur que la création.
  const tempPassword = crypto.randomBytes(12).toString("base64url");

  const { error: pwdErr } = await sbAdmin.auth.admin.updateUserById(
    partner.user_id,
    { password: tempPassword },
  );
  if (pwdErr) {
    /* Ici, et SEULEMENT ici, on échoue vraiment : rien n'a change, l'ancien
       mot de passe (perdu ou non) est toujours en place. */
    console.error("[admin/partners/resend] updateUserById:", pwdErr);
    return NextResponse.json(
      { error: `Échec de régénération du mot de passe : ${pwdErr.message}` },
      { status: 500 },
    );
  }

  /* 7. RÉ-ARMER L'ONBOARDING. Étape facile à oublier et sans laquelle la
        route est subtilement fausse : si password_reset_completed_at était
        déjà posé, le middleware laisserait le partenaire entrer sans jamais
        lui redemander de remplacer le mot de passe temporaire — qui
        resterait donc actif indéfiniment.
        Pour un partenaire jamais activé la colonne est déjà NULL ; on la
        remet quand même, pour que la route soit correcte dans TOUS les cas.
        `terms_accepted_at` n'est PAS touché : les conditions éditoriales
        acceptées le restent, un changement de mot de passe ne les annule
        pas. */
  const { error: armErr } = await sbAdmin
    .from("media_partners")
    .update({ password_reset_completed_at: null })
    .eq("id", partner.id);
  if (armErr) {
    // Non bloquant, mais bruyant : le mot de passe EST déjà changé.
    console.error("[admin/partners/resend] ré-armement onboarding:", armErr);
  }

  /* 8. Envoi — NON BLOQUANT. Le mot de passe est déjà posé, donc l'ancien
        est déjà invalidé : échouer ici effacerait le seul exemplaire du
        nouveau et aggraverait la panne qu'on répare. Il repart dans la
        réponse quoi qu'il arrive, et l'écran admin l'affiche. */
  const envoi = await sendWelcomeEmail({
    email: partner.contact_email,
    organizationName: partner.organization_name,
    contactName: partner.contact_name,
    tempPassword,
  });

  /* Marqueur posé UNIQUEMENT sur succès — il signifie « la passerelle a
     accepté », jamais « le partenaire a reçu ». En cas d'échec la colonne
     reste NULL et le bandeau rouge de l'écran admin prend le relais. */
  if (envoi.ok) {
    const { error: traceErr } = await sbAdmin
      .from("media_partners")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", partner.id);
    if (traceErr) console.error("[admin/partners/resend] trace envoi:", traceErr);
  }

  return NextResponse.json({
    email: partner.contact_email,
    temp_password: tempPassword,
    email_envoye: envoi.ok,
    email_erreur: envoi.error,
  });
}
