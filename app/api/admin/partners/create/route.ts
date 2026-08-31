import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendWelcomeEmail } from "@/lib/partners/sendWelcomeEmail";

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/partners/create
   Service-role partner creation. Closed beta — only callable
   by users with is_platform_admin = true.

   Request body:
     {
       email: string,
       organization_name: string,
       contact_name: string,
       tier?: "OFFICIEL" | "MAJEUR" | "PARTENAIRE",
       category?: string,
       instagram_handle?: string,
       description?: string
     }

   logo_url n'est VOLONTAIREMENT pas accepte ici. Le logo se televerse
   apres creation, dans le bucket partner-logos, sous {partner.id}/ —
   ce qui exige l'id, donc la ligne. Une URL externe collee dans ce
   champ est ce qui a produit le logo Facebook expire (HTTP 403) qui
   a laisse la page d'accueil sans logo pendant deux semaines ; la
   contrainte media_partners_logo_url_interne la rejette desormais.

   Response (success):
     {
       partner: { ...media_partners row },
       email: string,
       temp_password: string  // shown once, not stored
     }

   Errors: 400 missing fields, 401 unauth, 403 not platform
   admin, 500 server-side failure.
═══════════════════════════════════════════════════════════════ */

interface CreatePartnerBody {
  email?: string;
  organization_name?: string;
  contact_name?: string;
  tier?: string;
  category?: string;
  instagram_handle?: string;
  description?: string;
}

export async function POST(req: Request) {
  // 1. Authenticate
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Authorize — must be platform admin
  const { data: meRow, error: meErr } = await supabase
    .from("users")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();
  if (meErr || !meRow?.is_platform_admin) {
    return NextResponse.json({ error: "Accès refusé — privilèges insuffisants" }, { status: 403 });
  }

  // 3. Parse + validate body
  let body: CreatePartnerBody;
  try {
    body = (await req.json()) as CreatePartnerBody;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const email = body.email?.trim();
  const organizationName = body.organization_name?.trim();
  const contactName = body.contact_name?.trim();

  if (!email || !organizationName || !contactName) {
    return NextResponse.json(
      { error: "Champs requis manquants : email, organization_name, contact_name" },
      { status: 400 },
    );
  }

  // 4. Service-role client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[admin/partners/create] Missing service-role env vars");
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }
  const sbAdmin = createSbClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 5. Generate temp password (~16 chars, base64url-safe)
  const tempPassword = crypto.randomBytes(12).toString("base64url");

  // 6. Create auth user. Pass role in user_metadata so the
  //    handle_new_auth_user trigger sets role='PARTNER' on the
  //    public.users row from the start — avoids the race where
  //    the partner's session JWT caches the default ATHLETE role
  //    before our follow-up UPDATE lands.
  const { data: created, error: createErr } = await sbAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { role: "PARTNER" },
  });
  if (createErr || !created.user) {
    console.error("[admin/partners/create] auth.createUser failed:", createErr);
    return NextResponse.json(
      { error: createErr?.message || "Échec de création du compte" },
      { status: 500 },
    );
  }
  const newUserId = created.user.id;

  // 7. Patch the public.users row created by the on_auth_user_created
  //    trigger — set role=PARTNER and split contact_name into
  //    first/last for sidebar display.
  const nameParts = contactName.split(/\s+/);
  const firstName = nameParts[0] || contactName;
  const lastName = nameParts.slice(1).join(" ") || null;

  const { error: roleErr } = await sbAdmin
    .from("users")
    .update({
      role: "PARTNER",
      first_name: firstName,
      last_name: lastName,
      onboarding_complete: true,
    })
    .eq("id", newUserId);
  if (roleErr) {
    console.error("[admin/partners/create] users.update role:", roleErr);
    // Don't roll back the auth user — log loud and surface the error
    return NextResponse.json(
      { error: `Compte créé mais rôle non assigné : ${roleErr.message}` },
      { status: 500 },
    );
  }

  // 8. Insert media_partners row, APPROVED
  const { data: partner, error: partnerErr } = await sbAdmin
    .from("media_partners")
    .insert({
      user_id: newUserId,
      organization_name: organizationName,
      contact_name: contactName,
      contact_email: email,
      tier: body.tier === "OFFICIEL" || body.tier === "MAJEUR" ? body.tier : "PARTENAIRE",
      category: body.category?.trim().slice(0, 24) || null,
      instagram_handle: body.instagram_handle?.trim() || null,
      description: body.description?.trim() || null,
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .select()
    .single();
  if (partnerErr || !partner) {
    console.error("[admin/partners/create] media_partners.insert:", partnerErr);
    return NextResponse.json(
      { error: partnerErr?.message || "Échec de l'insertion du partenaire" },
      { status: 500 },
    );
  }

  /* 9. ENVOI DES ACCÈS — ajouté le 2026-08-20.
        C'est l'absence de cet appel qui a produit le cas Jules Regimbald :
        send-partner-welcome était déployée depuis le 2026-08-13, son en-tête
        affirmait être appelée d'ici, et elle ne l'a JAMAIS été. Le mot de
        passe s'affichait à l'écran et la transmission reposait entièrement
        sur un copier-coller manuel de l'admin.

        NON BLOQUANT : un partenaire créé mais non prévenu reste récupérable
        (la route /resend existe désormais pour ça). Un partenaire non créé,
        non. Le mot de passe repart donc dans la réponse quoi qu'il arrive,
        et l'écran admin l'affiche — c'est le repli qui a fonctionné, mal,
        jusqu'ici. */
  const envoi = await sendWelcomeEmail({
    email,
    organizationName,
    contactName,
    tempPassword,
  });

  /* Marqueur posé UNIQUEMENT sur succès : il signifie « la passerelle a
     accepté », jamais « le partenaire a reçu ». En cas d'échec la colonne
     reste NULL — c'est précisément ce qui permettra de retrouver un
     partenaire resté dans le silence. */
  if (envoi.ok) {
    const { error: traceErr } = await sbAdmin
      .from("media_partners")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", partner.id);
    if (traceErr) console.error("[admin/partners/create] trace envoi:", traceErr);
  }

  return NextResponse.json({
    partner,
    email,
    temp_password: tempPassword,
    email_envoye: envoi.ok,
    email_erreur: envoi.error,
  });
}
