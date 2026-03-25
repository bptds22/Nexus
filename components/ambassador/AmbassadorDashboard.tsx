"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MOCK_AMBASSADOR_SELF,
  MOCK_REFERRALS,
  MOCK_LEADERBOARD,
} from "@/lib/mock/ambassadors";
import type { Referral } from "@/lib/mock/ambassadors";

/* ═══════════════════════════════════════════════════════════════
   AmbassadorDashboard — Shared settings panel
   Shows ambassador KPIs, referrals, progress, leaderboard.
   If not ambassador → shows recruitment CTA.
═══════════════════════════════════════════════════════════════ */

const REFERRAL_STATUS: Record<Referral["status"], { bg: string; text: string; label: string }> = {
  inscrit: { bg: "bg-[#6B7280]/15", text: "text-[#6B7280]", label: "Inscrit" },
  actif: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Actif" },
  payant: { bg: "bg-[#DAB65A]/15", text: "text-[#DAB65A]", label: "Payant" },
  inactif: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Inactif" },
};

function daysAgo(iso: string) {
  const diff = new Date("2026-03-23").getTime() - new Date(iso).getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 30) return `Il y a ${days} jours`;
  const months = Math.round(days / 30);
  return `Il y a ${months} mois`;
}

/* ── Non-ambassador CTA ───────────────────────────────────── */

function AmbassadorCTA() {
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div>
      <div className="relative bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#DAB65A]" />
        <div className="p-6 sm:p-8">
          <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">
            Deviens ambassadeur Nexus
          </h3>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-6">
            Recrute des collègues et gagne ton abonnement Pro gratuitement.
          </p>

          <div className="space-y-3 mb-6">
            {[
              { icon: "gift", label: "Pro gratuit 12 mois" },
              { icon: "plus", label: "+1 mois par référal actif" },
              { icon: "dollar", label: "15% de commission sur les abonnements" },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#DAB65A]/10 flex items-center justify-center shrink-0">
                  {b.icon === "gift" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg>}
                  {b.icon === "plus" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                  {b.icon === "dollar" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
                </div>
                <span className="text-[13px] font-bold text-white">{b.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/ambassadeurs" className="h-10 px-5 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors inline-flex items-center justify-center">
              En savoir plus
            </Link>
            <button
              type="button"
              onClick={() => { setToast("Candidature envoyée (Phase 2)"); setTimeout(() => setToast(null), 3000); }}
              className="h-10 px-5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
            >
              Postuler
            </button>
          </div>
          <p className="text-[11px] text-[#4a4d56] mt-4">
            Nous sélectionnons 1 ambassadeur par région RSEQ.
          </p>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────── */

export default function AmbassadorDashboard({ isAmbassador = true }: { isAmbassador?: boolean }) {
  const [toast, setToast] = useState<string | null>(null);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const a = MOCK_AMBASSADOR_SELF;
  const referrals = MOCK_REFERRALS;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  if (!isAmbassador) return <AmbassadorCTA />;

  const activeCount = referrals.filter((r) => r.status === "actif").length;
  const payingCount = referrals.filter((r) => r.status === "payant").length;
  const eliteTarget = a.type === "coach" ? 20 : 10;
  const progress = Math.min((a.total_referrals / eliteTarget) * 100, 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Programme ambassadeur</h2>
        <p className="text-[13px] text-[#9CA3AF]">Gère tes référals et suis tes commissions</p>
      </div>

      {/* ── KPI strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Référals totaux</p>
          <p className="font-head text-[28px] font-black text-white leading-none mt-1">{a.total_referrals}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">{activeCount} actifs · {payingCount} payants</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Mois gratuits</p>
          <p className="font-head text-[28px] font-black text-[#DAB65A] leading-none mt-1">{a.free_months_earned}</p>
          <p className="text-[11px] text-[#6b7280] mt-1">{a.free_months_used} utilisés · {a.free_months_earned - a.free_months_used} restants</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Commission totale</p>
          <p className="font-head text-[28px] font-black text-[#22C55E] leading-none mt-1">{a.total_commission.toFixed(2).replace(".", ",")} $</p>
          <p className="text-[11px] text-[#6b7280] mt-1">{a.commission_paid.toFixed(2).replace(".", ",")} $ payée · {(a.total_commission - a.commission_paid).toFixed(2).replace(".", ",")} $ en attente</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Statut</p>
          <div className="mt-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              a.status === "elite" ? "bg-[#DAB65A]/15 text-[#DAB65A]" :
              a.status === "active" ? "bg-[#22C55E]/15 text-[#22C55E]" :
              "bg-[#6B7280]/15 text-[#6B7280]"
            }`}>
              {a.status === "elite" && <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
              {a.status === "elite" ? "Élite" : a.status === "active" ? "Actif" : "Inactif"}
            </span>
          </div>
          <p className="text-[11px] text-[#6b7280] mt-2">Ambassadeur depuis sept. 2025</p>
        </div>
      </div>

      {/* ── Referral link ─────────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Ton lien de référal</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 font-mono text-[13px] text-[#9CA3AF] truncate select-all">
            https://nexus-brown-zeta.vercel.app/auth?ref={a.referral_code}
          </div>
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(`https://nexus-brown-zeta.vercel.app/auth?ref=${a.referral_code}`); showToast("Lien copié!"); }}
            className="h-11 px-5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors shrink-0"
          >
            Copier le lien
          </button>
          <button
            type="button"
            onClick={() => showToast("Partage (Phase 2)")}
            className="h-11 px-5 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors shrink-0"
          >
            Partager
          </button>
        </div>
        <p className="text-[11px] text-[#4a4d56] mt-2">Ton code : {a.referral_code}</p>
      </div>

      {/* ── Progress to Élite ─────────────────────────────── */}
      {a.status !== "elite" && (
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Progression vers Élite</h3>
          <p className="text-[13px] text-white font-bold mb-3">
            {a.total_referrals} / {eliteTarget} {a.type === "coach" ? "coaches recrutés" : "recruteurs"} → Ambassadeur Élite
          </p>
          <div className="relative h-3 bg-[#2D3748] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#DAB65A] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-[#6b7280]">0</span>
            <span className="text-[10px] text-[#DAB65A] font-bold">{a.type === "coach" ? "10 (base)" : "5 (base)"}</span>
            <span className="text-[10px] text-white font-bold">{a.total_referrals} (toi)</span>
            <span className="text-[10px] text-[#DAB65A] font-bold">{eliteTarget} (élite)</span>
          </div>
        </div>
      )}

      {/* ── Referral table ────────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D3748]">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Mes référals</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#2D3748]">
                {["Utilisateur", "Date", "Statut", "Profils", "Abonnement", "Commission"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referrals.map((r, i) => {
                const st = REFERRAL_STATUS[r.status];
                return (
                  <tr key={r.id} className={`${i % 2 === 0 ? "bg-[#111317]/40" : ""} hover:bg-white/[0.02] transition-colors border-b border-[#2D3748]/40`}>
                    <td className="px-4 py-3 text-[13px] font-bold text-white">{r.referred_name}</td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{daysAgo(r.signed_up_at)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-[13px] text-white">{r.profiles_created}</td>
                    <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{r.subscription_tier}</td>
                    <td className="px-4 py-3 text-[12px] font-bold text-[#22C55E]">{r.commission_per_month > 0 ? `${r.commission_per_month.toFixed(2).replace(".", ",")}$/mois` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Commission details ────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => setCommissionOpen(!commissionOpen)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Détail des commissions</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${commissionOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {commissionOpen && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Taux de commission</span><span className="text-white font-bold">15%</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Taux Élite</span><span className="text-[#6B7280]">20% <span className="text-[10px]">(verrouillé)</span></span></div>
            <div className="border-t border-[#2D3748]/40 my-2" />
            <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Revenu total des référals</span><span className="text-white font-bold">516,00 $</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Ta commission (15%)</span><span className="text-[#22C55E] font-bold">77,40 $</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">Déjà payé</span><span className="text-white">42,00 $</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-[#9CA3AF]">En attente</span><span className="text-[#DAB65A] font-bold">35,40 $</span></div>
            <p className="text-[11px] text-[#4a4d56] mt-2">Minimum 50 $ pour un paiement · Méthode : Crédit Nexus (Phase 1)</p>
          </div>
        )}
      </div>

      {/* ── Regional leaderboard ──────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1">Classement — Région {a.region}</h3>
        <p className="text-[12px] text-[#9CA3AF] mb-4">Tu es #2 sur {MOCK_LEADERBOARD.length} ambassadeurs dans ta région</p>
        <div className="space-y-2">
          {MOCK_LEADERBOARD.map((l) => {
            const isYou = l.name === "Toi";
            return (
              <div key={l.rank} className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isYou ? "bg-[#E63946]/8 border border-[#E63946]/20" : "bg-[#111317]/60"}`}>
                <span className="text-[14px] font-black text-white w-6 text-center">{l.rank === 1 ? "🏆" : `#${l.rank}`}</span>
                <span className={`flex-1 text-[13px] font-bold ${isYou ? "text-[#E63946]" : "text-white"}`}>{l.name}</span>
                <span className="text-[12px] text-[#9CA3AF]">{l.referrals} référals</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  l.status === "elite" ? "bg-[#DAB65A]/15 text-[#DAB65A]" : "bg-[#22C55E]/15 text-[#22C55E]"
                }`}>
                  {l.status === "elite" ? "Élite" : "Actif"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
