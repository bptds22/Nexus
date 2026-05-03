import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/partner/profile-views/log
   Audit log for partner profile-page opens. Logs partner_id +
   athlete_id + viewed_at to partner_profile_views — Loi 25
   transparency lever, mirrors /api/partner/cards/log-download.

   Request body:
     { athlete_id: UUID }

   Response (success):
     { success: true }

   Errors:
     400 missing/invalid params
     401 unauthenticated
     403 not an approved partner OR athlete not partner-eligible
     500 insert failed

   Eligibility re-checked server-side via the SECURITY DEFINER
   helper is_partner_eligible_athlete (defense in depth — RLS on
   athletes already gates the row read). The page calls this on
   mount; failures are swallowed client-side because audit
   logging shouldn't block the user from reading a public page.
═══════════════════════════════════════════════════════════════ */

interface LogProfileViewBody {
  athlete_id?: string;
}

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Body parse + validation
  let body: LogProfileViewBody;
  try {
    body = (await req.json()) as LogProfileViewBody;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const athleteId = body.athlete_id?.trim();
  if (!athleteId) {
    return NextResponse.json(
      { error: "Paramètre invalide : athlete_id (UUID) requis" },
      { status: 400 },
    );
  }

  // 3. Caller must be an approved partner
  const { data: partner, error: partnerErr } = await supabase
    .from("media_partners")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (partnerErr) {
    console.error("[log-profile-view] partner lookup:", partnerErr);
    return NextResponse.json({ error: "Erreur de vérification partenaire" }, { status: 500 });
  }
  if (!partner || partner.status !== "APPROVED") {
    return NextResponse.json({ error: "Accès refusé — partenaire non approuvé" }, { status: 403 });
  }

  // 4. Athlete must be partner-eligible
  const { data: eligibleResult, error: eligibleErr } = await supabase.rpc(
    "is_partner_eligible_athlete",
    { p_athlete_id: athleteId },
  );
  if (eligibleErr) {
    console.error("[log-profile-view] eligibility rpc:", eligibleErr);
    return NextResponse.json({ error: "Erreur de vérification athlète" }, { status: 500 });
  }
  if (!eligibleResult) {
    return NextResponse.json({ error: "Athlète non disponible" }, { status: 403 });
  }

  // 5. Insert the audit row. RLS policy 'Partners log own views'
  //    gates partner_id = own approved partner row.
  const { error: insertErr } = await supabase
    .from("partner_profile_views")
    .insert({
      partner_id: partner.id,
      athlete_id: athleteId,
    });
  if (insertErr) {
    console.error("[log-profile-view] insert:", insertErr);
    return NextResponse.json({ error: "Erreur de journalisation" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
