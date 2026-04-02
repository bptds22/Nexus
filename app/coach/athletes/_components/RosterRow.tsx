"use client";

import { useState } from "react";
import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import { createClient } from "@/lib/supabase/client";
import type { RosterAthlete } from "../_data/mockRosterData";
import VerificationBadge from "./VerificationBadge";
import FavoriteSignal from "./FavoriteSignal";

/* ─────────────────────────────────────────────────────────────────
   Roster Row — single athlete table row
───────────────────────────────────────────────────────────────── */

/* Stars: use shared StarRating component */

interface RosterRowProps {
  athlete: RosterAthlete;
  even: boolean;
  onVerify?: (id: string) => void;
}

function ViewsTrend({ views }: { views: number }) {
  // Mock trend based on view count ranges
  if (views >= 15) return <span className="text-[#22C55E] text-[10px] ml-1">↑</span>;
  if (views >= 5) return <span className="text-[#6B7280] text-[10px] ml-1">→</span>;
  if (views > 0) return <span className="text-[#E63946] text-[10px] ml-1">↓</span>;
  return null;
}

function AttentionDot({ views, profilePct }: { views: number; profilePct: number }) {
  if (profilePct < 40) return <span className="inline-block w-2 h-2 rounded-full bg-[#EF4444] ml-1.5 shrink-0" title="Profil très incomplet" />;
  if (views === 0) return <span className="inline-block w-2 h-2 rounded-full bg-[#EAB308] ml-1.5 shrink-0" title="Aucune vue depuis 14+ jours" />;
  return null;
}

export default function RosterRow({ athlete: a, even, onVerify }: RosterRowProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleToggleVerify() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (a.isVerified) {
      console.log("Unverifying athlete:", a.id);
      const { error } = await supabase
        .from("athletes")
        .update({
          verified: false,
          verification_method: null,
          verified_at: null,
          verified_by: null,
        })
        .eq("id", a.id);
      console.log("Unverify result:", error);
    } else {
      console.log("Verifying athlete:", a.id);
      const { error } = await supabase
        .from("athletes")
        .update({
          verified: true,
          verification_method: "manuel_coach",
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq("id", a.id);
      console.log("Verify result:", error);
    }

    setShowConfirm(false);
    if (onVerify) {
      onVerify(a.id);
    } else {
      // No parent callback — force page reload to reflect change
      window.location.reload();
    }
  }

  return (
    <>
    <tr className={`group border-b border-[#2D3748]/40 hover:bg-[#252D3A] transition-colors ${even ? "bg-[#1E2430]" : "bg-[#1A1D24]"}`}>
      {/* Nom */}
      <td className="px-4 py-3.5">
        <Link href={`/coach/athletes/${a.id}`}>
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-bold text-white group-hover:text-[#E63946] transition-colors">
              {a.firstName} {a.lastName}
            </p>
          </div>
          <StarRating rating={a.stars} size="sm" />
        </Link>
      </td>

      {/* Position */}
      <td className="px-4 py-3.5">
        <span className="inline-block bg-[#2D3748]/60 text-[#9CA3AF] text-[12px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md">
          {a.position}
        </span>
      </td>

      {/* Graduation */}
      <td className="px-4 py-3.5">
        <span className="text-[14px] font-semibold text-[#9CA3AF]">
          {a.gradYear}
        </span>
      </td>

      {/* Statut — clickable */}
      <td className="px-4 py-3.5">
        {(() => { console.log("Athlete ID:", a.id); return null; })()}
        <VerificationBadge
          isVerified={a.isVerified}
          verification={a.verification}
          onClick={() => { console.log("CLICK FIRED", a.id); setShowConfirm(true); }}
        />
      </td>

      {/* Recrutement (from pipeline table or coach override) */}
      <td className="px-4 py-3.5">
        {(() => {
          if (!a.recruitment) {
            return (
              <span className="inline-block px-3 py-1 rounded-full text-[12px] font-bold tracking-wider uppercase border border-white/20 text-white/70">
                Ouvert
              </span>
            );
          }
          const { status, label, count, isOverride } = a.recruitment;
          const s = status.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
          const isHighCommit = s === "ENGAGE" || s === "LETTRE_SIGNEE";
          const isGray = s === "IDENTIFIE";
          const isOuvert = s === "OUVERT";
          return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold tracking-wider uppercase border ${
              isOuvert
                ? "border-white/20 text-white/70"
                : isHighCommit
                  ? "bg-[#E63946] border-[#E63946] text-white"
                  : isGray
                    ? "bg-[#6B7280]/15 border-[#6B7280]/30 text-[#9CA3AF]"
                    : "bg-white/10 border-white/30 text-white"
            }`}>
              {label}{count > 0 ? ` (${count})` : ""}
              {isOverride && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-60"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>}
            </span>
          );
        })()}
      </td>

      {/* Vues */}
      <td className="px-4 py-3.5 hidden md:table-cell">
        <div className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={a.views > 0 ? "#FFFFFF" : "#4B5563"} strokeWidth="2" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className={`text-[13px] font-bold ${a.views > 0 ? "text-[#9CA3AF]" : "text-[#4B5563]"}`}>
            {a.views}
          </span>
          {a.views > 0 && <ViewsTrend views={a.views} />}
        </div>
      </td>

      {/* Favoris */}
      <td className="px-4 py-3.5 hidden md:table-cell">
        <FavoriteSignal count={a.favorites} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-center">
        <div className="inline-flex items-center justify-center gap-1">
          <Link
            href={`/coach/athletes/${a.id}/modifier`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
            title="Modifier"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Link>
          <Link
            href={`/coach/athletes/${a.id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
            title="Aperçu recruteur"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            </svg>
          </Link>
        </div>
      </td>
    </tr>

    {/* Confirmation modal — rendered via portal to avoid table nesting issues */}
    {showConfirm && (() => { console.log("Modal visible", showConfirm); return null; })()}
    {showConfirm && (
      <tr style={{ display: "contents" }}>
        <td style={{ display: "contents" }}>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ position: "fixed" }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={() => setShowConfirm(false)} />
            <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl z-[10000]">
              <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">
                {a.isVerified ? "Retirer la vérification?" : "Vérifier le profil?"}
              </h3>
              <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">
                {a.isVerified
                  ? `Retirer la vérification de ${a.firstName} ${a.lastName}? Le badge bleu sera supprimé.`
                  : `Vérifier le profil de ${a.firstName} ${a.lastName}? Le badge bleu sera affiché aux recruteurs.`}
              </p>
              <div className="flex items-center justify-end gap-3 mt-5">
                <button type="button" onClick={() => setShowConfirm(false)} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors cursor-pointer">
                  Annuler
                </button>
                <button type="button" onClick={handleToggleVerify} className={`px-5 py-2 text-white text-[13px] font-bold rounded-lg transition-colors cursor-pointer ${a.isVerified ? "bg-[#E63946] hover:bg-[#D42B22]" : "bg-[#3B82F6] hover:bg-[#2563EB]"}`}>
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )}
    </>
  );
}
