import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/policyVersion";

/* ═══════════════════════════════════════════════════════════════
   POST /api/consentement-partenaires — la réponse du PARENT.

   Appelé par le formulaire de /consentement-partenaires (Accepter / Refuser).
   Pas de session : c'est le jeton à usage unique qui fait foi, vérifié EN BASE
   (consentement_partenaire_par_jeton, service_role seulement). La fonction
   écrit la fiche, la trace et le journal (policy_version, IP), et garantit
   l'usage unique : un second envoi reçoit « deja_utilise ».

   POST seulement : aucun GET n'écrit (les messageries ouvrent les liens).
   Réponse : 303 vers la page, avec l'état — jamais le jeton.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origine = new URL(req.url).origin;
  const retour = (etat: string) =>
    NextResponse.redirect(new URL(`/consentement-partenaires?etat=${encodeURIComponent(etat)}`, origine), 303);

  const form = await req.formData().catch(() => null);
  const t = form?.get("t");
  const decision = form?.get("decision");
  if (typeof t !== "string" || !/^[0-9a-f]{64}$/.test(t)) return retour("invalide");
  if (decision !== "accepte" && decision !== "refuse") return retour("invalide");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  const { data, error } = await createServiceClient().rpc(
    "consentement_partenaire_par_jeton" as never,
    {
      p_jeton: t,
      p_accorde: decision === "accepte",
      p_policy_version: PRIVACY_POLICY_VERSION,
      p_ip: ip,
    } as never,
  );

  if (error) {
    console.error(`[consentement-partenaires] ${error.code ?? "?"} ${error.message}`);
    return retour("erreur");
  }
  const r = data as unknown as { ok?: boolean; decision?: string; reason?: string } | null;
  if (!r?.ok) return retour(r?.reason ?? "erreur");
  return retour(r.decision === "ACCEPTE" ? "accepte" : "refuse");
}
