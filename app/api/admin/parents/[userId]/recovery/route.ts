import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/parents/[userId]/recovery      — LOT B4

   Renvoie au parent un courriel de réinitialisation de mot de passe.

   Corps : { athlete_id: uuid }
   `userId` = parent_user_id.

   ── AUCUNE SERVICE KEY, ET C'EST VOULU ──────────────────────
   `resetPasswordForEmail` est un point d'entrée auth PUBLIC — c'est
   exactement ce que fait /mot-de-passe-oublie, vivant en prod. On ne
   régénère PAS un mot de passe temporaire comme le fait la route
   partenaire : là-bas le mot de passe initial n'est jamais stocké et sa
   perte enferme le partenaire dehors, ici le parent a déjà un compte et le
   chemin normal de récupération existe. Réutiliser le chemin normal évite
   d'inventer un second mécanisme d'accès à maintenir.

   ── ALORS POURQUOI UNE ROUTE, SI LE NAVIGATEUR POURRAIT LE FAIRE ?
   Pour la TRACE. Un admin qui déclenche un courriel vers l'adresse du
   parent d'un mineur ne doit pas pouvoir le faire sans laisser de ligne au
   journal. La route est le point de passage unique : elle vérifie
   `is_admin()`, envoie, puis journalise par
   `admin_log_parent_recovery` — sous la session de l'admin, pour que le
   journal garde son invariant (écrit uniquement par des RPC definer).

   ── L'ORDRE : ENVOYER PUIS JOURNALISER ──────────────────────
   L'inverse journaliserait un envoi qui n'a pas eu lieu. Si la
   journalisation rate après un envoi réussi, on le dit — le courriel est
   parti, la trace manque, et c'est l'admin qui doit le savoir.

   ── « REMIS À LA PASSERELLE », JAMAIS « REÇU » ──────────────
   Supabase Auth accepte la demande ; la livraison ne se constate pas d'ici.
   Même discipline que l'invitation du lot B1 et que la route partenaire.
═══════════════════════════════════════════════════════════════ */

/* Même destination que /mot-de-passe-oublie : la session de récupération
   s'établit sur /auth/reinitialiser via detectSessionInUrl (PKCE ?code=).
   Une autre URL ici produirait un lien qui ouvre une page incapable de
   consommer le code. */
const RESET_REDIRECT_TO = "https://nexussports.ca/auth/reinitialiser";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  // 1. Authentifier
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Autoriser — is_admin(), la même définition que partout sur ce chantier.
  const { data: meRow, error: meErr } = await supabase
    .from("users").select("role").eq("id", user.id).single();
  if (meErr || meRow?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé — administrateur requis" }, { status: 403 });
  }

  // 3. Corps
  let body: { athlete_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 }); }
  const athleteId = body.athlete_id?.trim();
  if (!athleteId) {
    return NextResponse.json({ error: "athlete_id requis" }, { status: 400 });
  }

  /* 4. Résoudre l'adresse AUTH du parent — c'est elle que Supabase Auth
        reconnaît, pas la copie dans public.users. Envoyer à la copie
        échouerait silencieusement si les deux ont divergé, ce qui est
        précisément la situation qu'on répare sur cet écran. */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("[admin/parents/recovery] variables d'environnement manquantes");
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }
  const sbAdmin = createSbClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: cible, error: cibleErr } = await sbAdmin.auth.admin.getUserById(userId);
  if (cibleErr || !cible?.user?.email) {
    return NextResponse.json({ error: "Compte parent introuvable ou sans adresse" }, { status: 404 });
  }
  const emailAuth = cible.user.email;

  /* 5. ENVOI — client ANON. `resetPasswordForEmail` sous service_role n'a
        pas de sens : c'est une demande faite AU NOM de l'utilisateur, pas
        une opération d'administration. On passe donc par le même chemin
        qu'un visiteur sur /mot-de-passe-oublie. */
  const sbAnon = createSbClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: envoiErr } = await sbAnon.auth.resetPasswordForEmail(emailAuth, {
    redirectTo: RESET_REDIRECT_TO,
  });
  if (envoiErr) {
    console.error("[admin/parents/recovery] resetPasswordForEmail:", envoiErr);
    return NextResponse.json(
      { error: `Échec de l'envoi : ${envoiErr.message}` },
      { status: 500 },
    );
  }

  /* 6. TRACE — sous la session de l'admin. Non bloquant pour l'envoi (il
        est déjà parti), mais surfacé : un geste sans trace doit se voir. */
  const { data: logData, error: logErr } = await supabase.rpc("admin_log_parent_recovery", {
    p_parent_user_id: userId,
    p_athlete_id: athleteId,
    p_email: emailAuth,
  });
  const log = logData as { ok?: boolean; reason?: string } | null;

  if (logErr || !log?.ok) {
    const motif = logErr?.message ?? log?.reason ?? "raison inconnue";
    console.error("[admin/parents/recovery] envoi OK mais journal en échec :", motif);
    return NextResponse.json({
      ok: true,
      email: emailAuth,
      remis_a_la_passerelle: true,
      journal: "echec",
      avertissement:
        `Le courriel est parti vers ${emailAuth}, mais la journalisation a échoué (${motif}). ` +
        `Le geste n'apparaîtra pas au journal admin.`,
    });
  }

  return NextResponse.json({
    ok: true,
    email: emailAuth,
    remis_a_la_passerelle: true,
    journal: "ok",
  });
}
