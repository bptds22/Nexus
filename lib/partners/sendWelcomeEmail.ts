import "server-only";

/* ═══════════════════════════════════════════════════════════════
   sendWelcomeEmail — appel de l'edge function send-partner-welcome.

   Partagé par les DEUX routes admin qui produisent un mot de passe
   temporaire :
     app/api/admin/partners/create/route.ts        (création)
     app/api/admin/partners/[id]/resend/route.ts   (régénération)

   ── LA RÈGLE NON NÉGOCIABLE ───────────────────────────────────
   L'ÉCHEC D'ENVOI NE FAIT JAMAIS ÉCHOUER L'OPÉRATION APPELANTE.

   À la création : un partenaire créé mais non prévenu reste
   récupérable — on peut lui renvoyer ses accès. Un partenaire non
   créé, non.

   À la régénération : le mot de passe est DÉJÀ posé quand on
   arrive ici. L'ancien est donc déjà invalidé. Faire échouer la
   route effacerait le seul exemplaire du nouveau — on aggraverait
   la situation qu'on essaie de réparer.

   Dans les deux cas l'appelant DOIT rendre `temp_password` dans sa
   réponse, quoi qu'il arrive ici, et l'écran admin DOIT l'afficher.
   C'est le repli manuel, et c'est le chemin qui a fonctionné
   jusqu'ici — mal, mais il a fonctionné.

   ── CE QUE `ok: true` SIGNIFIE ────────────────────────────────
   Que l'API Resend a répondu 2xx, c'est-à-dire que la passerelle a
   ACCEPTÉ le message. Ce n'est PAS une preuve de livraison ni de
   lecture. `media_partners.welcome_email_sent_at` porte exactement
   la même sémantique, et son commentaire en base le dit.

   On ne pose ce marqueur QUE sur `ok: true`. Le poser sur la
   tentative masquerait un échec de passerelle — c'est une dette
   qui existe déjà ailleurs dans le projet, on ne la reproduit pas.
═══════════════════════════════════════════════════════════════ */

export interface WelcomeEmailInput {
  email: string;
  organizationName: string;
  contactName: string;
  tempPassword: string;
}

export interface WelcomeEmailResult {
  /** true UNIQUEMENT si Resend a répondu 2xx. */
  ok: boolean;
  /** Message lisible destiné à l'écran admin. Absent si ok. */
  error?: string;
}

export async function sendWelcomeEmail(
  input: WelcomeEmailInput,
): Promise<WelcomeEmailResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.PARTNER_WELCOME_SECRET;

  /* Configuration manquante : on le DIT, on ne le tait pas. Sans ce
     diagnostic explicite, un secret absent produirait un 401 opaque et
     l'admin croirait à un problème de courriel. La fonction a tourné six
     jours sans que personne ne sache qu'elle n'était jamais appelée —
     l'inverse (appelée mais mal configurée) doit être aussi visible. */
  if (!supabaseUrl) {
    return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL absente côté serveur." };
  }
  if (!secret) {
    return {
      ok: false,
      error:
        "PARTNER_WELCOME_SECRET absente côté serveur — le courriel ne peut pas être authentifié auprès de l'edge function. À poser dans les variables d'environnement Vercel, avec la MÊME valeur que le secret Supabase Edge.",
    };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-partner-welcome`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-partner-welcome-secret": secret,
      },
      body: JSON.stringify({
        email: input.email,
        organization_name: input.organizationName,
        contact_name: input.contactName,
        temp_password: input.tempPassword,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      /* 401 = secret refusé. C'est la panne la plus probable et la plus
         déroutante : on la nomme au lieu de rendre un code nu. */
      const detail =
        res.status === 401
          ? "secret refusé par l'edge function — vérifier que PARTNER_WELCOME_SECRET porte la MÊME valeur côté Vercel et côté Supabase Edge Secrets"
          : body.slice(0, 300) || "réponse sans corps";
      console.error(`[sendWelcomeEmail] ${res.status} — ${detail}`);
      return { ok: false, error: `Envoi refusé (${res.status}) : ${detail}` };
    }

    return { ok: true };
  } catch (e) {
    /* Réseau, DNS, timeout. On ne relance pas : l'appelant a déjà réussi son
       opération et le mot de passe part vers l'écran admin. */
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sendWelcomeEmail] échec réseau :", msg);
    return { ok: false, error: `Envoi impossible : ${msg}` };
  }
}
