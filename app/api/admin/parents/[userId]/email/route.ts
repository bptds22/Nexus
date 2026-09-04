import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/parents/[userId]/email        — LOT B3

   Corrige le courriel d'un parent : `auth.users.email` PUIS
   `public.users.email`. Le seul lot du chantier parental qui exige la
   service key — et il ne s'en sert QUE pour l'étage `auth`.

   Corps : { athlete_id: uuid, email: string }
   `userId` = parent_user_id (= public.users.id = auth.users.id).

   ── LA LEÇON bptds17, APPLIQUÉE ─────────────────────────────
   Rien ne synchronise `auth.users.email` et `public.users.email` — aucun
   trigger, vérifié. Et les deux ne servent PAS à la même chose :
   `claim_parent_invitation` et la connexion lisent l'adresse AUTH ; les
   écrans admin et les exports Loi 25 lisent la copie PUBLIC. Corriger une
   seule des deux, c'est fabriquer une fiche qui affiche la bonne adresse
   pendant que la connexion refuse encore l'ancienne.

   ── L'ORDRE, ET POURQUOI IL N'EST PAS INTERCHANGEABLE ───────
   AUTH d'abord. Si le second étage rate, l'authentification est déjà
   correcte : le parent peut se connecter et réclamer, seul l'affichage est
   en retard. Un affichage en retard SE VOIT — la section met les deux
   adresses côte à côte et signale l'écart. L'ordre inverse laisserait une
   panne invisible.
   D'où : échec de l'étage 2 = **500 bruyant**, avec les deux adresses dans
   le message, et surtout PAS un 200 optimiste.

   ── LA SERVICE KEY NE SERT QU'À `auth.users` ────────────────
   Tout le reste — `public.users`, l'invitation en attente, le journal —
   passe par la RPC `admin_set_parent_email`, appelée avec la SESSION DE
   L'ADMIN. `is_admin()` reste donc le seul prédicat d'autorisation partout,
   et le journal garde son invariant : il n'est écrit que par des fonctions
   SECURITY DEFINER, jamais par une route en service_role.

   ── `athletes.parent_email` N'EST PAS TOUCHÉ ────────────────
   C'est la DÉCLARATION de l'athlète, pas l'adresse du compte — et l'écrire
   déclencherait `trg_notify_parent_on_minor`, donc un second courriel
   d'invitation fantôme. Voir le commentaire de la RPC en base.
═══════════════════════════════════════════════════════════════ */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Écrit `PARENT_EMAIL_CHANGE_FAILED` au journal B0, sous la session de
 *  l'admin (donc `is_admin()` s'applique, et le journal reste alimenté
 *  uniquement par des RPC definer).
 *
 *  NE JETTE JAMAIS. Une trace manquante ne doit pas transformer un échec
 *  déjà diagnostiqué en une seconde panne, plus obscure que la première —
 *  l'appelant est en train de rendre son propre message d'erreur, et c'est
 *  lui qui compte. L'échec de journalisation part en console. */
async function journaliserEchec(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  parentUserId: string,
  athleteId: string,
  emailVise: string,
  etape: "prevol" | "auth" | "public",
  erreur: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("admin_log_parent_email_failure", {
      p_parent_user_id: parentUserId,
      p_athlete_id: athleteId,
      p_email_vise: emailVise,
      p_etape: etape,
      p_erreur: erreur,
    });
    if (error) console.error("[admin/parents/email] journal d'échec non écrit :", error.message);
  } catch (e) {
    console.error("[admin/parents/email] journal d'échec non écrit :", e);
  }
}

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

  /* 2. Autoriser — `is_admin()` et rien d'autre. La même définition d'admin
        que les RPC (users.role = 'ADMIN'), PAS `is_platform_admin` : les
        routes partenaires utilisent l'autre prédicat, et faire cohabiter les
        deux sur un même chantier est le meilleur moyen d'en durcir un et
        d'oublier l'autre. */
  const { data: meRow, error: meErr } = await supabase
    .from("users").select("role").eq("id", user.id).single();
  if (meErr || meRow?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé — administrateur requis" }, { status: 403 });
  }

  // 3. Corps
  let body: { athlete_id?: string; email?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 }); }

  const athleteId = body.athlete_id?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!athleteId || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "athlete_id et une adresse valide sont requis" }, { status: 400 });
  }

  // 4. Client service-role — pour `auth.users` UNIQUEMENT.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[admin/parents/email] variables service-role manquantes");
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }
  const sbAdmin = createSbClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /* 5. Relever l'adresse AUTH d'AVANT. Elle ne sera plus lisible après
        l'étage 1, et c'est elle qui doit figurer au journal — c'est
        l'adresse qui décidait de la connexion. */
  const { data: avant, error: avantErr } = await sbAdmin.auth.admin.getUserById(userId);
  if (avantErr || !avant?.user) {
    return NextResponse.json({ error: "Compte parent introuvable" }, { status: 404 });
  }
  const ancienEmailAuth = avant.user.email ?? null;

  if (ancienEmailAuth?.toLowerCase() === email) {
    return NextResponse.json(
      { error: "Cette adresse est déjà celle du compte — rien à corriger." },
      { status: 409 },
    );
  }

  /* 5bis. PRÉ-VOL — l'adresse est-elle déjà prise ?
     LE CONTRÔLE ÉTAIT AU MAUVAIS ÉTAGE. `admin_set_parent_email` vérifie déjà
     l'unicité sur les deux tables, mais elle s'exécute APRÈS l'écriture
     `auth` ci-dessous : un doublon faisait donc échouer GoTrue en premier, et
     ce contrôle soigné ne tournait jamais. L'admin recevait
     « Error updating user » — le 500 générique de GoTrue — sans cause ni
     geste possible. Constaté en prod le 2026-09-04.
     Le pré-vol regarde public.users (qui porte le rôle), auth.users, puis
     auth.identities, et rend l'id de l'occupant. */
  const { data: occData, error: occErr } = await supabase.rpc("admin_email_occupe", {
    p_email: email,
    p_exclure_user_id: userId,
  });
  if (occErr) {
    return NextResponse.json(
      { error: `Pré-vol impossible : ${occErr.message}` },
      { status: 500 },
    );
  }
  const occ = occData as { occupe?: boolean; libelle?: string; user_id?: string; source?: string } | null;
  if (occ?.occupe) {
    await journaliserEchec(supabase, userId, athleteId, email, "prevol",
      `adresse deja utilisee par ${occ.libelle} (source ${occ.source})`);
    return NextResponse.json(
      {
        error: `L'adresse ${email} appartient déjà à ${occ.libelle}. Choisissez-en une autre, ou libérez d'abord celle-ci.`,
        conflit: { user_id: occ.user_id, source: occ.source },
      },
      { status: 409 },
    );
  }

  /* 6. ÉTAGE 1 — auth.users. `email_confirm: true` pose l'adresse
        directement : sans lui, Supabase ouvre un cycle de confirmation et
        l'ancienne adresse reste active en attendant un clic que le parent
        ne recevra peut-être jamais. Un admin qui corrige une adresse
        FAUSSE ne peut pas dépendre d'un courriel envoyé à... l'adresse
        fausse. */
  const { error: authErr } = await sbAdmin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });
  if (authErr) {
    /* Ici, et seulement ici, rien n'a changé : on peut échouer proprement.
       MAIS ON DIT POURQUOI. `authErr.message` seul vaut souvent
       « Error updating user » — le libellé générique de GoTrue, qui a coûté
       un diagnostic entier. On remonte donc TOUT ce que le client porte :
       message, statut HTTP et code d'erreur. Et on le journalise, parce
       qu'une tentative qui se heurte à un mur doit laisser une trace :
       sans elle, la prochaine enquête repart de zéro. */
    const detail = [
      authErr.message,
      authErr.status ? `HTTP ${authErr.status}` : null,
      (authErr as { code?: string }).code ? `code ${(authErr as { code?: string }).code}` : null,
    ].filter(Boolean).join(" · ");
    console.error("[admin/parents/email] updateUserById:", detail, authErr);
    await journaliserEchec(supabase, userId, athleteId, email, "auth", detail);
    return NextResponse.json(
      {
        error: `Échec de la mise à jour de l'authentification : ${detail}`,
        detail_serveur: authErr.message,
        statut_serveur: authErr.status ?? null,
      },
      { status: 500 },
    );
  }

  /* 7. ÉTAGE 2 — public.users + invitation en attente + journal, sous la
        SESSION DE L'ADMIN (donc `is_admin()` s'applique). */
  const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_set_parent_email", {
    p_parent_user_id: userId,
    p_athlete_id: athleteId,
    p_nouveau_email: email,
    p_ancien_email_auth: ancienEmailAuth,
  });

  const rpc = rpcData as { ok?: boolean; reason?: string; occupant?: string } | null;

  if (rpcErr || !rpc?.ok) {
    /* ÉCHEC BRUYANT — c'est tout l'objet de cette branche. L'étage 1 EST
       passé : le compte s'authentifie déjà avec la nouvelle adresse, mais
       `public.users` porte encore l'ancienne et AUCUNE ligne de journal
       n'existe. On le dit en toutes lettres, avec les deux valeurs, pour
       que la réparation soit évidente au lieu d'être à deviner. */
    /* `email_deja_utilise` mérite d'être nommé : c'est le seul motif où
       l'admin peut agir seul (choisir une autre adresse). `occupant` dit à
       QUI elle appartient — sans quoi on cherche un bogue là où il y a
       simplement un homonyme. Cas réel : bptds17@gmail.com appartient à un
       compte ATHLETE, pas au parent. */
    const motif =
      rpc?.reason === "email_deja_utilise"
        ? `l'adresse ${email} appartient déjà à ${rpc.occupant ?? "un autre compte"}`
        : rpcErr?.message ?? rpc?.reason ?? "raison inconnue";
    console.error("[admin/parents/email] DESYNCHRONISATION — auth changé, public.users NON :", motif);
    /* `etape: 'public'` est le cas grave du journal : auth EST passé, la ligne
       publique non. C'est le seul état à moitié écrit que ce lot peut
       produire, donc celui qu'il faut pouvoir retrouver. */
    await journaliserEchec(supabase, userId, athleteId, email, "public", motif);
    return NextResponse.json(
      {
        error:
          `Désynchronisation : l'adresse d'authentification est passée à ${email}, ` +
          `mais public.users porte encore ${avant.user.email ?? "—"} et rien n'a été journalisé. ` +
          `Motif : ${motif}. Le parent peut se connecter avec la nouvelle adresse ; ` +
          `l'affichage est en retard et doit être réparé.`,
        etage_auth: "ok",
        etage_public: "echec",
        ancien_email_auth: ancienEmailAuth,
        nouveau_email: email,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    ancien_email_auth: ancienEmailAuth,
    nouveau_email: email,
    ...(rpcData as Record<string, unknown>),
  });
}
