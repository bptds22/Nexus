"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   Admin Approvals — Item 11-Security (commit 2/2)

   Platform admin queue for reviewing coach Directeur / Interim
   claims filed at onboarding. Approving fires the apply_admin_claim_
   approval DB trigger which promotes the claimant on `users.is_school
   _admin = true` + writes `profile_data.admin_type`. Rejecting clears
   any leftover admin_type and leaves the user as Coach-only.

   RLS already restricts SELECT + UPDATE to `is_platform_admin
   (auth.uid())` so this page can ship without a route-level gate
   beyond the existing app/admin/layout.tsx admin guard.
───────────────────────────────────────────────────────────────── */

interface PendingClaim {
  id: string;
  user_id: string;
  school_id: string;
  claim_type: "DIRECTEUR" | "INTERIM";
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  school_name: string | null;
  school_type: string | null;
}

export default function AdminApprovalsPage() {
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchClaims = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admin_claims")
      .select(`
        id, user_id, school_id, claim_type, status, created_at,
        users:user_id (email, first_name, last_name),
        schools:school_id (name, type)
      `)
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[AdminApprovals] fetch error:", error.message);
      showToast("Erreur lors du chargement de la liste.");
      setLoading(false);
      return;
    }

    const rows: PendingClaim[] = (data ?? []).map((c: Record<string, unknown>) => {
      const userRel = c.users as { email?: string; first_name?: string; last_name?: string } | { email?: string; first_name?: string; last_name?: string }[] | null;
      const schoolRel = c.schools as { name?: string; type?: string } | { name?: string; type?: string }[] | null;
      const u = Array.isArray(userRel) ? userRel[0] : userRel;
      const s = Array.isArray(schoolRel) ? schoolRel[0] : schoolRel;
      return {
        id: c.id as string,
        user_id: c.user_id as string,
        school_id: c.school_id as string,
        claim_type: c.claim_type as "DIRECTEUR" | "INTERIM",
        status: c.status as "PENDING" | "APPROVED" | "REJECTED",
        created_at: c.created_at as string,
        user_email: u?.email ?? null,
        user_first_name: u?.first_name ?? null,
        user_last_name: u?.last_name ?? null,
        school_name: s?.name ?? null,
        school_type: s?.type ?? null,
      };
    });
    setClaims(rows);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  async function approve(claimId: string) {
    setActionId(claimId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("admin_claims")
      .update({
        status: "APPROVED",
        reviewed_at: new Date().toISOString(),
        reviewer_id: user?.id ?? null,
      })
      .eq("id", claimId);
    setActionId(null);
    if (error) {
      console.error("[AdminApprovals] approve error:", error.message);
      showToast("Erreur lors de l'approbation.");
      return;
    }
    showToast("Claim approuvé. Le claimant a maintenant accès admin école.");
    await fetchClaims();
  }

  async function reject(claimId: string) {
    if (!rejectReason.trim()) {
      showToast("Indique une raison de rejet.");
      return;
    }
    setActionId(claimId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("admin_claims")
      .update({
        status: "REJECTED",
        reviewed_at: new Date().toISOString(),
        reviewer_id: user?.id ?? null,
        rejection_reason: rejectReason.trim(),
      })
      .eq("id", claimId);
    setActionId(null);
    if (error) {
      console.error("[AdminApprovals] reject error:", error.message);
      showToast("Erreur lors du rejet.");
      return;
    }
    setRejectingId(null);
    setRejectReason("");
    showToast("Claim rejeté. Le user reste comme Coach seulement.");
    await fetchClaims();
  }

  function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-CA")} ${d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Approbations
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Claims Directeur sportif et Directeur intérimaire en attente de révision. L&apos;approbation accorde le statut <code className="text-[#E63946]">is_school_admin</code>; le rejet laisse l&apos;utilisateur comme entraîneur seulement.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-6 py-12 text-center">
          <p className="text-[14px] text-[#9CA3AF]">Aucun claim en attente.</p>
          <p className="text-[12px] text-[#6b7280] mt-1">Les nouveaux claims apparaîtront ici dès qu&apos;un coach les soumet via l&apos;onboarding.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const fullName = `${claim.user_first_name ?? ""} ${claim.user_last_name ?? ""}`.trim() || "—";
            const isRejectingThis = rejectingId === claim.id;
            const isActing = actionId === claim.id;
            const claimLabel = claim.claim_type === "DIRECTEUR" ? "Directeur sportif" : "Directeur intérimaire";
            return (
              <div key={claim.id} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${claim.claim_type === "DIRECTEUR" ? "bg-[#DAB65A]/15 text-[#DAB65A]" : "bg-[#9CA3AF]/15 text-[#9CA3AF]"}`}>
                        {claimLabel}
                      </span>
                      <span className="text-[11px] text-[#6b7280]">soumis le {formatDateTime(claim.created_at)}</span>
                    </div>
                    <h2 className="font-head text-lg font-black text-white tracking-tight">{fullName}</h2>
                    <p className="text-[13px] text-[#9CA3AF]">
                      <span className="text-[#6b7280]">Courriel :</span> <span className="text-white">{claim.user_email ?? "—"}</span>
                    </p>
                    <p className="text-[13px] text-[#9CA3AF]">
                      <span className="text-[#6b7280]">École :</span>{" "}
                      <span className="text-white">{claim.school_name ?? "—"}</span>
                      {claim.school_type && <span className="text-[11px] text-[#6b7280] ml-2 uppercase tracking-wider">({claim.school_type})</span>}
                    </p>
                  </div>
                  {!isRejectingThis && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => approve(claim.id)}
                        disabled={isActing}
                        className="h-10 px-5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-[12px] uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        {isActing ? "..." : "Approuver"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(claim.id); setRejectReason(""); }}
                        disabled={isActing}
                        className="h-10 px-5 rounded-lg border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 font-bold text-[12px] uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        Rejeter
                      </button>
                    </div>
                  )}
                </div>

                {isRejectingThis && (
                  <div className="mt-4 pt-4 border-t border-[#2D3748] space-y-3">
                    <label className="block text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
                      Raison du rejet <span className="text-[#EF4444]">*</span>
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      maxLength={500}
                      placeholder="Ex: courriel non vérifié, école mismatch, identité non confirmée…"
                      className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#EF4444] outline-none transition-colors min-h-[80px] resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => reject(claim.id)}
                        disabled={isActing || !rejectReason.trim()}
                        className="h-10 px-5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-[12px] uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        {isActing ? "..." : "Confirmer le rejet"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        disabled={isActing}
                        className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
