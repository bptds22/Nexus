import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/partner/cards/log-download
   Audit log for hero card downloads. Capture happens
   client-side via html-to-image; this endpoint records who
   downloaded what so we have a paper trail per athlete.

   Request body:
     { athlete_id: UUID, format: 'publication' | 'story' }

   Response (success):
     { success: true }

   Errors:
     400 missing/invalid params
     401 unauthenticated
     403 not an approved partner OR athlete not partner-eligible
     500 insert failed

   The eligibility check uses the SECURITY DEFINER helper
   is_partner_eligible_athlete which honors the canonical
   filter (opt-in + parental consent for minors + verified +
   not modified-since-verification + cote_globale_entraineur).
   We re-check server-side even though RLS would also block
   the row read — defense in depth, and we want a clean 403
   instead of a silent empty result.
═══════════════════════════════════════════════════════════════ */

interface LogDownloadBody {
  athlete_id?: string;
  format?: string;
}

const VALID_FORMATS = ["publication", "story"] as const;
type ValidFormat = (typeof VALID_FORMATS)[number];

function isValidFormat(value: unknown): value is ValidFormat {
  return typeof value === "string" && (VALID_FORMATS as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Body parse + validation
  let body: LogDownloadBody;
  try {
    body = (await req.json()) as LogDownloadBody;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const athleteId = body.athlete_id?.trim();
  const format = body.format;
  if (!athleteId || !isValidFormat(format)) {
    return NextResponse.json(
      { error: "Paramètres invalides : athlete_id (UUID) et format ('publication' | 'story') requis" },
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
    console.error("[log-download] partner lookup:", partnerErr);
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
    console.error("[log-download] eligibility rpc:", eligibleErr);
    return NextResponse.json({ error: "Erreur de vérification athlète" }, { status: 500 });
  }
  if (!eligibleResult) {
    return NextResponse.json({ error: "Athlète non disponible" }, { status: 403 });
  }

  // 5. Insert the audit row. RLS policy 'Partners log own
  //    downloads' (Phase 1 step 1 migration) gates partner_id =
  //    own approved partner row, so this insert respects RLS.
  const { error: insertErr } = await supabase
    .from("partner_card_downloads")
    .insert({
      partner_id: partner.id,
      athlete_id: athleteId,
      format,
    });
  if (insertErr) {
    console.error("[log-download] insert:", insertErr);
    return NextResponse.json({ error: "Erreur de journalisation" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
