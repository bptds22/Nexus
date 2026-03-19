"use client";

import { useState, useMemo } from "react";
import { MODERATION_ITEMS } from "@/lib/mock/admin";
import type { ModerationItem } from "@/lib/mock/admin";

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "il y a quelques minutes";
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const TYPE_BADGE: Record<ModerationItem["type"], { bg: string; text: string; label: string }> = {
  profile_report: { bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]", label: "Profil signalé" },
  message_report: { bg: "bg-[#A855F7]/15", text: "text-[#A855F7]", label: "Message signalé" },
  contact_abuse: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Abus de contact" },
};

const STATUS_BADGE: Record<ModerationItem["status"], { bg: string; text: string; label: string }> = {
  open: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Ouvert" },
  under_review: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En examen" },
  resolved: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Résolu" },
  dismissed: { bg: "bg-[#6b7280]/15", text: "text-[#6b7280]", label: "Rejeté" },
};

const SEV_DOT: Record<ModerationItem["severity"], string> = {
  low: "bg-[#3B82F6]", medium: "bg-[#F59E0B]", high: "bg-[#E63946]",
};

const ROLE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  coach: { bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]", label: "Coach" },
  recruiter: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "Recruteur" },
};

type Tab = "all" | "open" | "under_review" | "resolved" | "dismissed";

export default function AdminModerationPage() {
  const [items, setItems] = useState(MODERATION_ITEMS);
  const [tab, setTab] = useState<Tab>("all");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg = "Action simulée — POC") { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function updateStatus(id: string, status: ModerationItem["status"]) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    showToast();
  }

  const filtered = useMemo(() => tab === "all" ? items : items.filter((i) => i.status === tab), [items, tab]);

  const counts = {
    all: items.length,
    open: items.filter((i) => i.status === "open").length,
    under_review: items.filter((i) => i.status === "under_review").length,
    resolved: items.filter((i) => i.status === "resolved").length,
    dismissed: items.filter((i) => i.status === "dismissed").length,
  };

  const tabs: { key: Tab; label: string; count: number; badge?: boolean }[] = [
    { key: "all", label: "Tous", count: counts.all },
    { key: "open", label: "Ouverts", count: counts.open, badge: true },
    { key: "under_review", label: "En examen", count: counts.under_review, badge: true },
    { key: "resolved", label: "Résolus", count: counts.resolved },
    { key: "dismissed", label: "Rejetés", count: counts.dismissed },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Modération &amp; signalements</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">{counts.open} signalements ouverts · {counts.under_review} en cours d&apos;examen</p>
      </div>

      <div className="flex gap-1 border-b border-[#2D3748]">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${tab === t.key ? "text-[#E63946] border-[#E63946]" : "text-[#6b7280] border-transparent hover:text-white"}`}>
            {t.label}
            <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${t.badge && t.count > 0 ? "bg-[#E63946] text-white" : "bg-[#2D3748] text-[#6b7280]"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((item) => {
          const tp = TYPE_BADGE[item.type];
          const st = STATUS_BADGE[item.status];
          const rl = ROLE_BADGE[item.reported_user_role];
          return (
            <div key={item.id} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
              {/* Top row */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className={`w-2.5 h-2.5 rounded-full ${SEV_DOT[item.severity]}`} />
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${tp.bg} ${tp.text}`}>{tp.label}</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${st.bg} ${st.text}`}>{st.label}</span>
                <span className="text-[11px] text-[#6b7280] ml-auto">{timeAgo(item.created_at)}</span>
              </div>

              {/* User info */}
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[15px] font-bold text-white">{item.reported_user}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rl.bg} ${rl.text}`}>{rl.label}</span>
              </div>
              <p className="text-[13px] text-[#6b7280] mb-3">Signalé par : <span className="text-[#9CA3AF]">{item.reporter_name}</span> · {item.reason}</p>

              {/* Content excerpt */}
              <div className="border-l-2 border-[#E63946]/40 bg-[#111317] rounded-r-lg px-4 py-3 mb-4">
                <p className="text-[13px] text-[#9CA3AF] italic leading-relaxed">{item.reported_content}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {item.status === "open" && (
                  <button type="button" onClick={() => updateStatus(item.id, "under_review")} className="px-4 py-2 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] font-bold text-[12px] uppercase tracking-wider hover:bg-[#F59E0B]/25 transition-colors">Examiner</button>
                )}
                <button type="button" onClick={() => showToast()} className="px-4 py-2 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] font-bold text-[12px] uppercase tracking-wider hover:bg-[#F59E0B]/20 transition-colors">Avertir</button>
                <button type="button" onClick={() => showToast()} className="px-4 py-2 rounded-lg bg-[#E63946]/10 text-[#E63946] font-bold text-[12px] uppercase tracking-wider hover:bg-[#E63946]/20 transition-colors">Suspendre</button>
                {(item.status === "open" || item.status === "under_review") && (
                  <button type="button" onClick={() => updateStatus(item.id, "dismissed")} className="px-4 py-2 rounded-lg bg-[#6b7280]/10 text-[#6b7280] font-bold text-[12px] uppercase tracking-wider hover:bg-[#6b7280]/20 transition-colors">Rejeter</button>
                )}
                {item.status === "under_review" && (
                  <button type="button" onClick={() => updateStatus(item.id, "resolved")} className="px-4 py-2 rounded-lg bg-[#22C55E]/15 text-[#22C55E] font-bold text-[12px] uppercase tracking-wider hover:bg-[#22C55E]/25 transition-colors">Résolu</button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-[#6b7280]">Aucun signalement</div>}
      </div>

      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}
