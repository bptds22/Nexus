"use client";

import { useState, useMemo } from "react";
import {
  SUBSCRIPTION_TIERS,
  INSTITUTION_SUBSCRIPTIONS,
  REVENUE_STATS,
} from "@/lib/mock/admin";
import type { InstitutionSubscription, SubscriptionTier } from "@/lib/mock/admin";

/* ── Helpers ─────────────────────────────────────────────── */

const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

function formatCAD(n: number) {
  if (n === 0) return "Gratuit";
  if (n < 0) return "Sur mesure";
  return n.toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " $";
}

function formatCADPrecise(n: number) {
  if (n === 0) return "Gratuit";
  if (n < 0) return "Sur mesure";
  return n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

function relativeDate(iso: string) {
  const diff = new Date(iso).getTime() - new Date("2026-03-17T12:00:00Z").getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `il y a ${Math.abs(days)} jours`;
  if (days === 0) return "aujourd'hui";
  return `dans ${days} jours`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Actif" },
  trial: { bg: "bg-[#3B82F6]/15", text: "text-[#3B82F6]", label: "Essai" },
  past_due: { bg: "bg-[#E63946]/15", text: "text-[#E63946]", label: "En retard" },
  cancelled: { bg: "bg-[#6b7280]/15", text: "text-[#6b7280]", label: "Annulé" },
  expired: { bg: "bg-[#6B7280]/15", text: "text-[#6B7280]", label: "Expiré" },
};

const TIER_BADGE: Record<string, { bg: string; text: string }> = {
  "Découverte": { bg: "bg-[#A48261]/15", text: "text-[#A48261]" },
  "Essentiel": { bg: "bg-[#A48261]/15", text: "text-[#A48261]" },
  "Gratuit": { bg: "bg-[#A48261]/15", text: "text-[#A48261]" },
  "Standard": { bg: "bg-[#B4BCC8]/15", text: "text-[#B4BCC8]" },
  "Pro": { bg: "bg-[#B4BCC8]/15", text: "text-[#B4BCC8]" },
  "Premium": { bg: "bg-[#DAB65A]/15", text: "text-[#DAB65A]" },
  "Élite": { bg: "bg-[#DAB65A]/15", text: "text-[#DAB65A]" },
  "Entreprise": { bg: "bg-[#EF4444]/15", text: "text-[#EF4444]" },
};

type Tab = "cegep" | "school" | "athlete";
type QuickFilter = "all" | "active" | "trial" | "past_due" | "inactive";

/* ── Page ─────────────────────────────────────────────────── */

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<Tab>("cegep");
  const [toast, setToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [tiersPanelOpen, setTiersPanelOpen] = useState(false);

  // CÉGEP filters
  const [cSearch, setCSearch] = useState("");
  const [cTier, setCTier] = useState("all");
  const [cStatus, setCStatus] = useState("all");
  const [cConf, setCConf] = useState("all");
  const [cQuick, setCQuick] = useState<QuickFilter>("all");

  // School filters
  const [sSearch, setSSearch] = useState("");
  const [sTier, setSTier] = useState("all");
  const [sStatus, setSStatus] = useState("all");
  const [sRegion, setSRegion] = useState("all");
  const [sQuick, setSQuick] = useState<QuickFilter>("all");

  function showToast(msg = "Action simulée — POC") { setToast(msg); setTimeout(() => setToast(null), 3000); }

  const rv = REVENUE_STATS;
  const cegepTiers = SUBSCRIPTION_TIERS.filter((t) => t.customer_type === "cegep");
  const schoolTiers = SUBSCRIPTION_TIERS.filter((t) => t.customer_type === "school");
  const athleteTiers = SUBSCRIPTION_TIERS.filter((t) => t.customer_type === "athlete");

  const cegepSubs = INSTITUTION_SUBSCRIPTIONS.filter((s) => s.institution_type === "cegep");
  const schoolSubs = INSTITUTION_SUBSCRIPTIONS.filter((s) => s.institution_type === "school");

  const tierMap = useMemo(() => {
    const m: Record<string, SubscriptionTier> = {};
    SUBSCRIPTION_TIERS.forEach((t) => { m[t.id] = t; });
    return m;
  }, []);

  // ── Filtered lists ──────────────────────────────────────
  const filteredCegeps = useMemo(() => {
    return cegepSubs.filter((s) => {
      if (cSearch && !s.institution_name.toLowerCase().includes(cSearch.toLowerCase()) && !s.city.toLowerCase().includes(cSearch.toLowerCase())) return false;
      if (cTier !== "all" && s.tier_id !== cTier) return false;
      if (cStatus !== "all" && s.status !== cStatus) return false;
      if (cConf !== "all" && s.conference !== cConf) return false;
      if (cQuick === "active" && s.status !== "active") return false;
      if (cQuick === "trial" && s.status !== "trial") return false;
      if (cQuick === "past_due" && s.status !== "past_due") return false;
      if (cQuick === "inactive" && s.status !== "cancelled" && s.status !== "expired") return false;
      return true;
    });
  }, [cSearch, cTier, cStatus, cConf, cQuick]);

  const filteredSchools = useMemo(() => {
    return schoolSubs.filter((s) => {
      if (sSearch && !s.institution_name.toLowerCase().includes(sSearch.toLowerCase()) && !s.city.toLowerCase().includes(sSearch.toLowerCase())) return false;
      if (sTier !== "all" && s.tier_id !== sTier) return false;
      if (sStatus !== "all" && s.status !== sStatus) return false;
      if (sRegion !== "all" && s.city !== sRegion) return false;
      if (sQuick === "active" && s.status !== "active") return false;
      if (sQuick === "trial" && s.status !== "trial") return false;
      if (sQuick === "past_due" && s.status !== "past_due") return false;
      if (sQuick === "inactive" && s.status !== "cancelled" && s.status !== "expired") return false;
      return true;
    });
  }, [sSearch, sTier, sStatus, sRegion, sQuick]);

  // Counts for quick tabs
  const cCounts = {
    all: cegepSubs.length,
    active: cegepSubs.filter((s) => s.status === "active").length,
    trial: cegepSubs.filter((s) => s.status === "trial").length,
    past_due: cegepSubs.filter((s) => s.status === "past_due").length,
    inactive: cegepSubs.filter((s) => s.status === "cancelled" || s.status === "expired").length,
  };
  const sCounts = {
    all: schoolSubs.length,
    active: schoolSubs.filter((s) => s.status === "active").length,
    trial: schoolSubs.filter((s) => s.status === "trial").length,
    past_due: schoolSubs.filter((s) => s.status === "past_due").length,
    inactive: schoolSubs.filter((s) => s.status === "cancelled" || s.status === "expired").length,
  };

  // Revenue chart max
  const maxRevenue = Math.max(...rv.monthly_revenue_trend.map((m) => m.cegep_revenue + m.school_revenue + m.athlete_revenue));

  // Alerts
  const alerts = useMemo(() => {
    const list: { type: "yellow" | "red" | "blue"; msg: string; sub: string; actions: string[] }[] = [];
    INSTITUTION_SUBSCRIPTIONS.forEach((s) => {
      if (s.status === "past_due") {
        const daysLate = Math.round((new Date("2026-03-17T12:00:00Z").getTime() - new Date(s.current_period_end).getTime()) / 86400000);
        list.push({ type: "red", msg: `${s.institution_name} — Paiement en retard (${daysLate} jours)`, sub: s.contact_email, actions: ["Relancer", "Suspendre"] });
      }
      if (s.trial_ends_at) {
        const daysLeft = Math.round((new Date(s.trial_ends_at).getTime() - new Date("2026-03-17T12:00:00Z").getTime()) / 86400000);
        if (daysLeft >= 0 && daysLeft <= 7) {
          list.push({ type: "yellow", msg: `${s.institution_name} — Essai expire ${relativeDate(s.trial_ends_at)}`, sub: s.contact_email, actions: ["Contacter", "Prolonger"] });
        }
      }
      if (s.status === "active" && s.seats_max > 0 && s.seats_used >= s.seats_max) {
        list.push({ type: "blue", msg: `${s.institution_name} — ${s.seats_used}/${s.seats_max} ${s.institution_type === "cegep" ? "recruteurs" : "coachs"} utilisés, capacité max`, sub: s.contact_email, actions: ["Proposer upgrade"] });
      }
    });
    return list;
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Abonnements</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Gestion des forfaits et revenus de la plateforme · Saison 2025-2026</p>
      </div>

      {/* ═══ Section 1 — Revenue KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Revenu mensuel récurrent", value: formatCAD(rv.mrr), sub: null, trend: "↑5.1% vs mois dernier", trendColor: "text-[#22C55E]", color: "#E63946" },
          { label: "Revenu CÉGEPs", value: formatCAD(rv.mrr_cegep), sub: `${rv.active_cegeps} abonnés actifs`, trend: null, trendColor: "", color: "#E63946" },
          { label: "Revenu Écoles", value: formatCAD(rv.mrr_school), sub: `${rv.active_schools} abonnées actives`, trend: null, trendColor: "", color: "#3B82F6" },
          { label: "Essais actifs", value: String(rv.trial_count), sub: "3 expirent cette semaine", trend: null, trendColor: "text-[#F59E0B]", color: "#F59E0B" },
          { label: "Taux de rétention", value: "95.2%", sub: null, trend: "↑1.5 pts vs trimestre", trendColor: "text-[#22C55E]", color: "#22C55E" },
        ].map((card) => (
          <div key={card.label} className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 p-5 relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">{card.label}</p>
            <p className="text-[32px] font-head font-black text-white leading-none">{card.value}</p>
            {card.sub && <p className={`text-[12px] mt-1 ${card.trendColor || "text-[#6b7280]"}`}>{card.sub}</p>}
            {card.trend && <p className={`text-[12px] font-bold mt-1 ${card.trendColor}`}>{card.trend}</p>}
          </div>
        ))}
      </div>

      {/* ═══ Section 2 — Revenue Chart ═══ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
        <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-6">Revenu mensuel par type — 6 derniers mois</p>
        <div className="flex items-end gap-4 h-[220px]">
          {rv.monthly_revenue_trend.map((m) => {
            const total = m.cegep_revenue + m.school_revenue + m.athlete_revenue;
            const cPct = (m.cegep_revenue / maxRevenue) * 100;
            const sPct = (m.school_revenue / maxRevenue) * 100;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[11px] font-bold text-white mb-1">{formatCAD(total)}</span>
                <div className="flex flex-col-reverse w-full items-center" style={{ height: 170 }}>
                  <div className="w-8 bg-[#E63946] rounded-t-none rounded-b-md transition-all" style={{ height: `${cPct}%` }} />
                  <div className="w-8 bg-[#3B82F6] rounded-t-md transition-all" style={{ height: `${sPct}%` }} />
                </div>
                <span className="text-[10px] text-[#6b7280] font-bold whitespace-nowrap">{m.month.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <span className="flex items-center gap-2 text-[11px] text-[#9CA3AF]"><span className="w-3 h-3 rounded-sm bg-[#E63946]" /> CÉGEPs</span>
          <span className="flex items-center gap-2 text-[11px] text-[#9CA3AF]"><span className="w-3 h-3 rounded-sm bg-[#3B82F6]" /> Écoles</span>
          <span className="flex items-center gap-2 text-[11px] text-[#9CA3AF] opacity-40"><span className="w-3 h-3 rounded-sm bg-[#22C55E]" /> Athlètes (Phase 2)</span>
        </div>
      </div>

      {/* ═══ Section 3 — Tabs ═══ */}
      <div className="flex gap-1 border-b border-[#2D3748]">
        {([
          ["cegep", "CÉGEPs"] as const,
          ["school", "Écoles secondaires"] as const,
          ["athlete", "Athlètes"] as const,
        ]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${tab === key ? "text-[#E63946] border-[#E63946]" : "text-[#6b7280] border-transparent hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: CÉGEPs ═══ */}
      {tab === "cegep" && (
        <div className="space-y-6">
          {/* Tier summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cegepTiers.map((t) => {
              const count = cegepSubs.filter((s) => s.tier_id === t.id && (s.status === "active" || s.status === "trial")).length;
              return (
                <div key={t.id} className="bg-[#1A1D24] rounded-lg border border-[#2D3748] px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TIER_BADGE[t.name]?.bg} ${TIER_BADGE[t.name]?.text}`}>{t.name}</span>
                      {t.is_popular && <span className="px-1.5 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[9px] font-bold">POPULAIRE</span>}
                    </div>
                    <p className="text-[11px] text-[#6b7280] mt-1">{t.price_monthly > 0 ? `${t.price_monthly}$/mo` : t.price_monthly === 0 ? "Gratuit" : "Sur mesure"} · {count} CÉGEPs · {t.limits.max_recruiters === -1 ? "∞" : t.limits.max_recruiters} recruteurs</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input type="text" placeholder="Rechercher un CÉGEP..." value={cSearch} onChange={(e) => setCSearch(e.target.value)} className={`${selectBase} flex-1 min-w-[240px]`} />
            <select title="Forfait" value={cTier} onChange={(e) => setCTier(e.target.value)} className={selectBase}>
              <option value="all">Tous les forfaits</option>
              {cegepTiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select title="Statut" value={cStatus} onChange={(e) => setCStatus(e.target.value)} className={selectBase}>
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option><option value="trial">Essai</option>
              <option value="past_due">En retard</option><option value="cancelled">Annulé</option><option value="expired">Expiré</option>
            </select>
            <select title="Conférence" value={cConf} onChange={(e) => setCConf(e.target.value)} className={selectBase}>
              <option value="all">Toutes les conférences</option>
              <option value="sud_ouest">Sud-Ouest</option><option value="nord_est">Nord-Est</option>
            </select>
          </div>

          {/* Quick tabs */}
          <div className="flex gap-1 border-b border-[#2D3748]">
            {([
              { key: "all" as QuickFilter, label: "Tous", count: cCounts.all },
              { key: "active" as QuickFilter, label: "Actifs", count: cCounts.active, color: "text-[#22C55E]" },
              { key: "trial" as QuickFilter, label: "En essai", count: cCounts.trial, color: "text-[#3B82F6]" },
              { key: "past_due" as QuickFilter, label: "En retard", count: cCounts.past_due, color: "text-[#E63946]", pulse: true },
              { key: "inactive" as QuickFilter, label: "Inactifs", count: cCounts.inactive },
            ]).map((t) => (
              <button key={t.key} type="button" onClick={() => setCQuick(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${cQuick === t.key ? "text-[#E63946] border-[#E63946]" : "text-[#6b7280] border-transparent hover:text-white"}`}>
                {t.label}
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${t.pulse && t.count > 0 ? "bg-[#E63946] text-white animate-pulse" : "bg-[#2D3748] text-[#6b7280]"}`}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Table */}
          <SubscriptionTable subs={filteredCegeps} tierMap={tierMap} type="cegep" openMenu={openMenu} setOpenMenu={setOpenMenu} showToast={showToast} />
        </div>
      )}

      {/* ═══ TAB: Écoles ═══ */}
      {tab === "school" && (
        <div className="space-y-6">
          {/* Tier summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {schoolTiers.map((t) => {
              const count = schoolSubs.filter((s) => s.tier_id === t.id && (s.status === "active" || s.status === "trial")).length;
              return (
                <div key={t.id} className="bg-[#1A1D24] rounded-lg border border-[#2D3748] px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TIER_BADGE[t.name]?.bg} ${TIER_BADGE[t.name]?.text}`}>{t.name}</span>
                      {t.is_popular && <span className="px-1.5 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[9px] font-bold">POPULAIRE</span>}
                    </div>
                    <p className="text-[11px] text-[#6b7280] mt-1">{t.price_monthly > 0 ? `${t.price_monthly}$/mo` : "Gratuit"} · {count} écoles · {t.limits.max_coaches === -1 ? "Illimité" : t.limits.max_coaches} coachs</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input type="text" placeholder="Rechercher une école..." value={sSearch} onChange={(e) => setSSearch(e.target.value)} className={`${selectBase} flex-1 min-w-[240px]`} />
            <select title="Forfait" value={sTier} onChange={(e) => setSTier(e.target.value)} className={selectBase}>
              <option value="all">Tous les forfaits</option>
              {schoolTiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select title="Statut" value={sStatus} onChange={(e) => setSStatus(e.target.value)} className={selectBase}>
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option><option value="trial">Essai</option>
              <option value="past_due">En retard</option><option value="cancelled">Annulé</option><option value="expired">Expiré</option>
            </select>
          </div>

          {/* Quick tabs */}
          <div className="flex gap-1 border-b border-[#2D3748]">
            {([
              { key: "all" as QuickFilter, label: "Tous", count: sCounts.all },
              { key: "active" as QuickFilter, label: "Actifs", count: sCounts.active },
              { key: "trial" as QuickFilter, label: "En essai", count: sCounts.trial },
              { key: "past_due" as QuickFilter, label: "En retard", count: sCounts.past_due, pulse: true },
              { key: "inactive" as QuickFilter, label: "Inactifs", count: sCounts.inactive },
            ]).map((t) => (
              <button key={t.key} type="button" onClick={() => setSQuick(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${sQuick === t.key ? "text-[#E63946] border-[#E63946]" : "text-[#6b7280] border-transparent hover:text-white"}`}>
                {t.label}
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${t.pulse && t.count > 0 ? "bg-[#E63946] text-white animate-pulse" : "bg-[#2D3748] text-[#6b7280]"}`}>{t.count}</span>
              </button>
            ))}
          </div>

          <SubscriptionTable subs={filteredSchools} tierMap={tierMap} type="school" openMenu={openMenu} setOpenMenu={setOpenMenu} showToast={showToast} />
        </div>
      )}

      {/* ═══ TAB: Athlètes (Phase 2) ═══ */}
      {tab === "athlete" && (
        <div className="space-y-8 py-8">
          <div className="text-center max-w-[600px] mx-auto space-y-4">
            <span className="inline-block px-3 py-1 rounded-full bg-[#E63946]/15 text-[#E63946] text-[11px] font-bold uppercase tracking-wider">Phase 2 — À venir</span>
            <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight">Abonnements athlètes individuels</h2>
            <p className="text-[14px] text-[#6b7280] leading-relaxed">
              Quand un athlète veut des fonctionnalités premium que son école ne couvre pas, il pourra s&apos;abonner individuellement. Cela ouvre un troisième flux de revenus et garantit que chaque athlète motivé a accès à la plateforme.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[600px] mx-auto">
            {athleteTiers.map((t) => (
              <div key={t.id} className={`relative bg-[#1A1D24] rounded-xl border p-6 ${t.name === "Pro" ? "border-[#E63946]/30 shadow-[0_0_30px_rgba(230,51,41,0.08)]" : "border-[#2D3748]"}`}>
                {t.name === "Pro" && <div className="absolute inset-0 rounded-xl bg-[#E63946]/[0.03] pointer-events-none" />}
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${t.name === "Pro" ? "bg-[#E63946]/15 text-[#E63946]" : "bg-[#2D3748] text-[#6b7280]"}`}>
                      {t.name === "Pro" ? "À VENIR" : "ACTUEL"}
                    </span>
                  </div>
                  <p className="font-head text-xl font-black text-white uppercase">{t.name}</p>
                  <p className="text-[28px] font-head font-black text-white leading-none mt-2">
                    {t.price_monthly === 0 ? "0$" : `${t.price_monthly.toFixed(2).replace(".", ",")}$`}
                    {t.price_monthly > 0 && <span className="text-[14px] text-[#6b7280] font-normal">/mois</span>}
                  </p>
                  <div className="mt-4 space-y-2">
                    {t.features.map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.name === "Pro" ? "#E63946" : "#22C55E"} strokeWidth="2.5" strokeLinecap="round"><path d="M9 12l2 2 4-4" /></svg>
                        <span className="text-[13px] text-[#9CA3AF]">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Projected revenue */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 max-w-[600px] mx-auto text-center">
            <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Revenu projeté</p>
            <p className="text-[13px] text-[#9CA3AF]">Si 5% des athlètes inscrits s&apos;abonnent Pro :</p>
            <p className="text-[14px] text-white font-bold mt-2">347 athlètes × 5% = ~17 abonnés × 9,99$ = <span className="text-[#22C55E]">170$/mois</span></p>
            <p className="text-[14px] text-white font-bold">Revenu projeté annuel : <span className="text-[#22C55E]">~2 040$</span></p>
            <p className="text-[11px] text-[#4B5563] mt-2 italic">Estimation basée sur les données actuelles</p>
          </div>
        </div>
      )}

      {/* ═══ Section 4 — Alerts ═══ */}
      {alerts.length > 0 && (
        <div className="space-y-4">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Actions requises</p>
          {alerts.map((a, i) => (
            <div key={i} className={`bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 flex items-center gap-4 border-l-4 ${a.type === "red" ? "border-l-[#E63946]" : a.type === "yellow" ? "border-l-[#F59E0B]" : "border-l-[#3B82F6]"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${a.type === "red" ? "bg-[#E63946]/15" : a.type === "yellow" ? "bg-[#F59E0B]/15" : "bg-[#3B82F6]/15"}`}>
                {a.type === "red" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                ) : a.type === "yellow" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 6v6l4 2" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white">{a.msg}</p>
                <p className="text-[11px] text-[#6b7280] mt-0.5">{a.sub}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {a.actions.map((action) => (
                  <button key={action} type="button" onClick={() => showToast()}
                    className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[11px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Section 5 — Tier Management (collapsed) ═══ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
        <button type="button" onClick={() => setTiersPanelOpen(!tiersPanelOpen)}
          className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Gérer les forfaits</p>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform ${tiersPanelOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {tiersPanelOpen && (
          <div className="px-5 pb-6 space-y-6 border-t border-[#2D3748]">
            <p className="text-[12px] text-[#6b7280] italic mt-4">Les modifications de forfait s&apos;appliquent aux nouveaux abonnés. Les abonnés existants gardent leur forfait actuel jusqu&apos;au renouvellement.</p>

            {(["cegep", "school", "athlete"] as const).map((type) => {
              const tiers = SUBSCRIPTION_TIERS.filter((t) => t.customer_type === type);
              const typeLabel = type === "cegep" ? "CÉGEPs" : type === "school" ? "Écoles secondaires" : "Athlètes (Phase 2)";
              return (
                <div key={type}>
                  <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">{typeLabel}</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {tiers.map((t) => (
                      <div key={t.id} className="bg-[#111317] rounded-lg border border-[#2D3748] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <input type="text" title="Nom du forfait" defaultValue={t.name} readOnly className="bg-transparent text-[14px] font-bold text-white border-none outline-none cursor-default" />
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TIER_BADGE[t.name]?.bg} ${TIER_BADGE[t.name]?.text}`}>{t.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1">Mensuel</p>
                            <p className="text-[13px] text-white font-bold">{formatCADPrecise(t.price_monthly)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1">Annuel</p>
                            <p className="text-[13px] text-white font-bold">{formatCADPrecise(t.price_yearly)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {t.features.map((f) => (
                            <span key={f} className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] text-[#9CA3AF] font-bold">{f}</span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#2D3748]/50">
                          <button type="button" onClick={() => showToast()} className="text-[11px] font-bold text-[#9CA3AF] hover:text-white transition-colors">+ Ajouter une fonctionnalité</button>
                          <div className="flex gap-3">
                            <button type="button" onClick={() => showToast()} className="text-[11px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">Supprimer</button>
                            <button type="button" onClick={() => showToast()} className="px-3 py-1.5 rounded-md bg-[#E63946] text-white text-[11px] font-bold hover:bg-[#D42B22] transition-colors">Sauvegarder</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}

/* ── Subscription Table Component ────────────────────────── */

function SubscriptionTable({ subs, tierMap, type, openMenu, setOpenMenu, showToast }: {
  subs: InstitutionSubscription[];
  tierMap: Record<string, SubscriptionTier>;
  type: "cegep" | "school";
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  showToast: (msg?: string) => void;
}) {
  const seatsLabel = type === "cegep" ? "Recruteurs" : "Coachs";

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#2D3748]">
              {[type === "cegep" ? "CÉGEP" : "École", "Forfait", "Statut", seatsLabel, "Sports", "Revenu/mo", "Renouvellement", "Contact", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subs.map((s, i) => {
              const tier = tierMap[s.tier_id];
              const st = STATUS_BADGE[s.status] || STATUS_BADGE.active;
              const tb = tier ? (TIER_BADGE[tier.name] || TIER_BADGE.Standard) : TIER_BADGE.Standard;
              const isInactive = s.status === "cancelled" || s.status === "expired";
              const isPastDue = s.status === "past_due";
              const isTrial = s.status === "trial";
              const trialDaysLeft = s.trial_ends_at ? Math.round((new Date(s.trial_ends_at).getTime() - new Date("2026-03-17T12:00:00Z").getTime()) / 86400000) : null;
              const renewDaysLeft = Math.round((new Date(s.current_period_end).getTime() - new Date("2026-03-17T12:00:00Z").getTime()) / 86400000);
              const seatsFull = s.seats_max > 0 && s.seats_used >= s.seats_max;

              return (
                <tr key={s.id} className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"} ${isInactive ? "opacity-60" : ""} ${isPastDue ? "border-l-2 border-l-[#E63946]" : ""} ${isTrial && trialDaysLeft !== null && trialDaysLeft <= 7 ? "border-l-2 border-l-[#F59E0B]" : ""}`}>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-bold text-white whitespace-nowrap">{s.institution_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[#6b7280]">{s.city}</span>
                      {s.conference && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#2D3748] text-[#6b7280]">{s.conference === "sud_ouest" ? "SO" : "NE"}</span>
                      )}
                    </div>
                  </td>
                  {/* Tier */}
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${tb.bg} ${tb.text}`}>{tier?.name}</span></td>
                  {/* Status */}
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${st.bg} ${st.text}`}>{st.label}</span></td>
                  {/* Seats */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-bold ${seatsFull ? "text-[#E63946]" : "text-white"}`}>{s.seats_used}/{s.seats_max === -1 ? "∞" : s.seats_max}</span>
                      {s.seats_max > 0 && (
                        <div className="w-10 h-1.5 bg-[#2D3748] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${seatsFull ? "bg-[#E63946]" : "bg-[#3B82F6]"}`} style={{ width: `${Math.min((s.seats_used / s.seats_max) * 100, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Sports */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.sports_active.slice(0, 2).map((sp) => (
                        <span key={sp} className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#9CA3AF]">{sp}</span>
                      ))}
                      {s.sports_active.length > 2 && <span className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#6b7280]">+{s.sports_active.length - 2}</span>}
                      {s.sports_active.length === 0 && <span className="text-[11px] text-[#4B5563]">—</span>}
                    </div>
                  </td>
                  {/* Revenue */}
                  <td className="px-4 py-3">
                    <span className={`text-[13px] font-bold ${s.monthly_revenue > 0 ? "text-white" : "text-[#6b7280]"}`}>
                      {s.monthly_revenue > 0 ? formatCADPrecise(s.monthly_revenue) : tier?.price_monthly === -1 ? "Sur mesure" : "Gratuit"}
                    </span>
                  </td>
                  {/* Renewal */}
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-[#9CA3AF] whitespace-nowrap">{formatDate(s.current_period_end)}</p>
                    <p className={`text-[11px] font-bold ${renewDaysLeft <= 0 ? "text-[#E63946]" : renewDaysLeft <= 14 ? "text-[#F59E0B]" : "text-[#6b7280]"}`}>
                      {relativeDate(s.current_period_end)}
                    </p>
                  </td>
                  {/* Contact */}
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-white whitespace-nowrap">{s.contact_name}</p>
                    <p className="text-[11px] text-[#6b7280] truncate max-w-[160px]">{s.contact_email}</p>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button type="button" title="Actions" onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} className="text-[#6b7280] hover:text-white p-1 transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                      </button>
                      {openMenu === s.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                          <div className="absolute right-0 top-8 z-50 bg-[#1A1D24] border border-[#2D3748] rounded-lg py-1.5 min-w-[200px] shadow-xl">
                            <button type="button" onClick={() => { setOpenMenu(null); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5">Voir les détails</button>
                            <button type="button" onClick={() => { setOpenMenu(null); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5">Changer de forfait</button>
                            {s.status === "trial" && (
                              <button type="button" onClick={() => { setOpenMenu(null); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#3B82F6] hover:bg-[#3B82F6]/10">Prolonger l&apos;essai</button>
                            )}
                            <div className="border-t border-[#2D3748] my-1.5" />
                            <button type="button" onClick={() => { setOpenMenu(null); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#F59E0B] hover:bg-[#F59E0B]/10">Suspendre</button>
                            <button type="button" onClick={() => { setOpenMenu(null); showToast(); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#E63946] hover:bg-[#E63946]/10">Annuler</button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {subs.length === 0 && <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucun abonnement trouvé</div>}
    </div>
  );
}
