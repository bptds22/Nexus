import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifierJetonDesabonnementParent } from "@/lib/courriel/jetonDesabonnement";

/* ═══════════════════════════════════════════════════════════════
   POST /api/desabonnement-parent — inscrit un PARENT au registre LCAP.

   Jumeau de /api/desabonnement (même contrat, mêmes deux appelants : le
   formulaire de la page → 303 ; le bouton natif RFC 8058 → 200 sans page).
   Le jeton porte l'athlete_id ; la base retrouve le courriel du parent et
   n'en garde que l'empreinte (parent_desabonner, service_role seulement).
   Idempotent. Pas de session exigée (LCAP). Aucun GET qui écrit.
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
      : NextResponse.redirect(new URL(`/desabonnement-parent?etat=${etat}`, url.origin), 303);

  let athleteId: string | null = null;
  try {
    athleteId = await verifierJetonDesabonnementParent(jeton, process.env.DESABONNEMENT_SECRET ?? "");
  } catch (e) {
    console.error("[desabonnement-parent] configuration :", e instanceof Error ? e.message : e);
    return retour("erreur");
  }
  if (!athleteId) return retour("invalide");

  const { error } = await createServiceClient().rpc(
    "parent_desabonner" as never,
    { p_athlete_id: athleteId, p_source: unClic ? "un_clic" : "lien" } as never,
  );
  if (error) {
    console.error(`[desabonnement-parent] athlete ${athleteId} : ${error.code ?? "?"} ${error.message}`);
    return retour("erreur");
  }
  // false = athlète supprimé ou sans courriel parent : personne à qui écrire,
  // le résultat voulu est atteint.
  return retour("ok");
}
