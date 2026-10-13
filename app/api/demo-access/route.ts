import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { estUuid, messageErreurAcces } from "@/lib/demo/demoAcces";

/* ═══════════════════════════════════════════════════════════════
   POST /api/demo-access — demande d'accès à l'enregistrement (/12octobre).

   Public, sans connexion. La base décide (RPC demo_access_demander,
   service_role seulement : validation, limite de débit par empreinte
   d'IP) ; puis l'edge function send-demo-access envoie TOUT DE SUITE le
   courriel A (lien personnel) et l'avis à info@.

   La réponse ne rend JAMAIS le jeton ni l'id : le lien n'existe que dans
   le courriel. Sinon, soumettre l'adresse de quelqu'un d'autre suffirait à
   obtenir son lien. Pour la même raison, un accès révoqué reçoit la même
   réponse « ok » qu'un autre — sans courriel.
═══════════════════════════════════════════════════════════════ */

const texte = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, erreur: messageErreurAcces(undefined) }, { status: 400 }); }

  // Pot de miel : un robot qui le remplit reçoit un « ok » muet.
  if (texte(b.nx_site, 200)) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("demo_access_demander", {
    p_prenom: texte(b.prenom, 80), p_nom: texte(b.nom, 80), p_courriel: texte(b.courriel, 200),
    p_cegep_id: estUuid(b.cegep_id) ? b.cegep_id : null,
    p_cegep_autre: texte(b.cegep_autre, 160),
    p_sport_id: estUuid(b.sport_id) ? b.sport_id : null,
    p_role: texte(b.role, 40),
    p_wants_1on1: b.wants_1on1 === true,
    p_consentement: b.consentement === true,
    p_ip: ip,
  } as never);
  const ligne = Array.isArray(data) ? (data[0] as { id?: string } | undefined) : undefined;
  if (error || !ligne?.id) {
    if (error && !error.message.includes("NEXUS:")) console.error("[demo-access] RPC :", error.message);
    return NextResponse.json({ ok: false, erreur: messageErreurAcces(error?.message) }, { status: 400 });
  }

  // Les courriels : un échec ne défait pas la demande (statut visible sur
  // /admin/demo-access, lien copiable de là).
  try {
    const { error: e } = await supabase.functions.invoke("send-demo-access", { body: { id: ligne.id } });
    if (e) console.error("[demo-access] envoi :", ligne.id, e.message);
  } catch (e) {
    console.error("[demo-access] envoi :", ligne.id, e instanceof Error ? e.message : String(e));
  }
  return NextResponse.json({ ok: true });
}
