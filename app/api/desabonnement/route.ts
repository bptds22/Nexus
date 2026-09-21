import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifierJetonDesabonnement } from "@/lib/courriel/jetonDesabonnement";

/* ═══════════════════════════════════════════════════════════════
   POST /api/desabonnement — inscrit un compte au registre LCAP.

   DEUX APPELANTS, UNE ROUTE :
     • le formulaire de /desabonnement (bouton « Me désabonner ») :
       corps `t=<jeton>` → 303 vers /desabonnement?etat=ok ;
     • le bouton natif de Gmail / Apple Mail (RFC 8058) : POST sur l'URL de
       l'en-tête List-Unsubscribe (`?t=` dans l'URL), corps
       `List-Unsubscribe=One-Click` → 200, sans page.

   POURQUOI PAS DE GET QUI DÉSABONNE. Les passerelles de sécurité des
   messageries (et certains aperçus) OUVRENT les liens d'un courriel pour
   les analyser. Un GET qui écrit désabonnerait des gens qui n'ont rien
   demandé. Le lien du courriel mène donc à une page qui CONFIRME ; seul un
   POST écrit.

   PAS DE SESSION EXIGÉE : la LCAP interdit de conditionner le
   désabonnement à une connexion. C'est la signature HMAC du jeton qui
   prouve que le lien sort d'un courriel que nous avons envoyé.

   IDEMPOTENT : `on conflict do nothing` — un second clic ne change ni la
   date ni la source du premier.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  let jeton = url.searchParams.get("t");
  let unClic = false;

  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (form) {
      unClic = form.get("List-Unsubscribe") === "One-Click";
      const t = form.get("t");
      if (typeof t === "string" && t) jeton = t;
    }
  }

  const retour = (etat: "ok" | "invalide" | "erreur") =>
    unClic
      ? new NextResponse(etat === "ok" ? "ok" : etat, { status: etat === "ok" ? 200 : etat === "invalide" ? 400 : 500 })
      : NextResponse.redirect(new URL(`/desabonnement?etat=${etat}`, url.origin), 303);

  const secret = process.env.DESABONNEMENT_SECRET ?? "";
  let userId: string | null = null;
  try {
    userId = await verifierJetonDesabonnement(jeton, secret);
  } catch (e) {
    // Secret absent ou trop court : panne de configuration, pas un jeton
    // invalide. On le dit au journal, pas à l'internaute.
    console.error("[desabonnement] configuration :", e instanceof Error ? e.message : e);
    return retour("erreur");
  }
  if (!userId) return retour("invalide");

  const { error } = await createServiceClient()
    .from("courriel_desabonnements")
    .upsert({ user_id: userId, source: unClic ? "un_clic" : "lien" } as never,
            { onConflict: "user_id", ignoreDuplicates: true });

  if (error) {
    // 23503 : le compte n'existe plus (suppression). Il n'y a plus personne à
    // qui écrire — le résultat voulu est atteint.
    if (error.code === "23503") return retour("ok");
    console.error(`[desabonnement] écriture user ${userId} : ${error.code ?? "?"} ${error.message}`);
    return retour("erreur");
  }
  return retour("ok");
}
