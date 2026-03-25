"use client";

import { useState } from "react";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import MarketingNav from "@/components/marketing/MarketingNav";
import { MOCK_REGION_COVERAGE } from "@/lib/mock/ambassadors";

/* ═══════════════════════════════════════════════════════════════
   Programme Ambassadeur — Public recruitment page
═══════════════════════════════════════════════════════════════ */

const RSEQ_REGIONS = MOCK_REGION_COVERAGE.map((r) => r.region);

const REGION_STATUS: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  active: { bg: "bg-[#22C55E]/10", text: "text-[#22C55E]", label: "Ambassadeur actif", icon: "✅" },
  searching: { bg: "bg-[#E63946]/10", text: "text-[#E63946]", label: "Recherche en cours", icon: "🔥" },
  phase2: { bg: "bg-[#6B7280]/10", text: "text-[#6B7280]", label: "Phase 2", icon: "📋" },
  phase3: { bg: "bg-[#4a4d56]/10", text: "text-[#4a4d56]", label: "Phase 3", icon: "⏳" },
};

const inputCls = "w-full bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

export default function AmbassadeursPage() {
  const [toast, setToast] = useState<string | null>(null);
  const [formRole, setFormRole] = useState<"coach" | "recruteur">("coach");
  const [formRegion, setFormRegion] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Candidature envoyée! On te contacte en 48h. (POC)");
  };

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen relative">
      <PlaybookBackground />
      <MarketingNav />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 sm:py-24">

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="text-center mb-20">
          <p className="font-head text-[12px] font-bold uppercase tracking-[2px] text-[#E63946] mb-3">
            Programme ambassadeur
          </p>
          <h1 className="font-head text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-5">
            Fais grandir Nexus dans ta région
          </h1>
          <p className="text-[15px] text-[#9CA3AF] max-w-lg mx-auto leading-relaxed mb-8">
            Recrute des coachs et des recruteurs dans ton réseau. Gagne ton abonnement Pro gratuitement et une commission sur chaque abonnement généré.
          </p>
          <a href="#postuler" className="inline-flex items-center h-12 px-8 rounded-lg bg-[#E63946] text-white font-head font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
            Devenir ambassadeur →
          </a>
        </div>

        {/* ── How it works ─────────────────────────────────── */}
        <div className="mb-20">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight text-center mb-10">
            Comment ça fonctionne
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Postule", desc: "Remplis le formulaire en 2 minutes. On te contacte en 48h.", color: "#E63946", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg> },
              { step: "02", title: "Recrute", desc: "Partage ton lien personnalisé avec les coachs et recruteurs de ta région.", color: "#E63946", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> },
              { step: "03", title: "Gagne", desc: "Pro gratuit, mois bonus, et 15% de commission sur chaque abonnement payant.", color: "#DAB65A", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></svg> },
            ].map((s) => (
              <div key={s.step} className="bg-[#1A1D24] rounded-xl border border-white/5 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center mx-auto mb-4">
                  {s.icon}
                </div>
                <span className="font-head text-[48px] font-black text-white/[0.04] absolute">{s.step}</span>
                <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">{s.title}</h3>
                <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Two ambassador types ─────────────────────────── */}
        <div className="mb-20">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight text-center mb-10">
            Deux types d&apos;ambassadeurs
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coach Ambassador */}
            <div className="relative bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#3B82F6]" />
              <div className="p-6 sm:p-8">
                <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">Ambassadeur Coach</h3>
                <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-4">Pour les entraîneurs qui connaissent tout le monde dans leur région</p>
                <p className="text-[12px] text-[#3B82F6] font-bold uppercase tracking-wider mb-4">Mission : Recrute 10+ coachs qui créent des profils</p>
                <ul className="space-y-3 mb-6">
                  {[
                    "Coach Pro GRATUIT 12 mois (valeur 129$)",
                    "+1 mois gratuit par coach recruté (10+ profils)",
                    "15% de commission sur les abonnements (12 mois)",
                    "Élite à 20+ coaches : Pro gratuit à vie",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-[13px] text-[#c8ccd4]">{f}</span>
                    </li>
                  ))}
                </ul>
                <a href="#postuler" className="inline-flex items-center h-10 px-5 rounded-lg border border-[#3B82F6] text-[#3B82F6] font-bold text-[12px] uppercase tracking-wider hover:bg-[#3B82F6]/10 transition-colors">
                  Postuler comme ambassadeur coach
                </a>
              </div>
            </div>

            {/* Recruiter Ambassador */}
            <div className="relative bg-[#1A1D24] rounded-xl border border-white/5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#E63946]" />
              <div className="p-6 sm:p-8">
                <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">Ambassadeur Recruteur</h3>
                <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-4">Pour les recruteurs passionnés qui veulent améliorer leur réseau</p>
                <p className="text-[12px] text-[#E63946] font-bold uppercase tracking-wider mb-4">Mission : Recrute 5+ recruteurs collègues</p>
                <ul className="space-y-3 mb-6">
                  {[
                    "Recruteur Pro GRATUIT 12 mois (valeur 249$)",
                    "+1 mois gratuit par recruteur recruté actif",
                    "15% de commission sur les abonnements (12 mois)",
                    "Élite à 10+ recruteurs : Pro gratuit à vie",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-[13px] text-[#c8ccd4]">{f}</span>
                    </li>
                  ))}
                </ul>
                <a href="#postuler" className="inline-flex items-center h-10 px-5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[12px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors">
                  Postuler comme ambassadeur recruteur
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Lifecycle timeline ───────────────────────────── */}
        <div className="mb-20">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight text-center mb-10">
            Le parcours ambassadeur
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { stage: "Candidat", desc: "Appel de 15 min avec l'équipe Nexus", color: "#E63946", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
              { stage: "Actif", desc: "Pro gratuit + code référal. 3 référals en 30 jours.", color: "#E63946", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
              { stage: "Confirmé", desc: "Commissions + mois bonus. 2+ référals/mois.", color: "#E63946", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg> },
              { stage: "Élite", desc: "Pro à vie + commission 20% + badge dans l'app", color: "#DAB65A", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" /></svg> },
            ].map((s, i) => (
              <div key={s.stage} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 text-center relative">
                {i < 3 && <div className="hidden lg:block absolute top-1/2 -right-2 w-4 text-[#2D3748]">→</div>}
                <div className="w-12 h-12 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center mx-auto mb-3">
                  {s.icon}
                </div>
                <h4 className="font-head text-[14px] font-black uppercase tracking-tight mb-1" style={{ color: s.color }}>{s.stage}</h4>
                <p className="text-[12px] text-[#9CA3AF] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Regions ──────────────────────────────────────── */}
        <div className="mb-20">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight text-center mb-10">
            Nos régions prioritaires
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOCK_REGION_COVERAGE.map((r) => {
              const st = REGION_STATUS[r.status];
              return (
                <div key={r.region} className="bg-[#1A1D24] rounded-xl border border-white/5 p-4 flex items-center gap-3">
                  <span className="text-[18px]">{st.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{r.region}</p>
                    <p className={`text-[11px] ${st.text}`}>{st.label}</p>
                  </div>
                  <span className="text-[11px] text-[#6b7280] shrink-0">{r.schools_count} écoles</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Application form ─────────────────────────────── */}
        <div id="postuler" className="max-w-lg mx-auto mb-20">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight text-center mb-8">
            Postuler maintenant
          </h2>
          <form onSubmit={handleSubmit} className="bg-[#1A1D24] rounded-xl border border-white/5 p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Prénom *</label><input type="text" required placeholder="Jean" className={inputCls} /></div>
              <div><label className={labelCls}>Nom *</label><input type="text" required placeholder="Bergeron" className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Courriel *</label><input type="email" required placeholder="coach@ecole.qc.ca" className={inputCls} /></div>
            <div><label className={labelCls}>Téléphone *</label><input type="tel" required placeholder="514-555-1234" className={inputCls} /></div>

            <div>
              <label className={labelCls}>Ton rôle *</label>
              <div className="flex gap-3">
                {(["coach", "recruteur"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFormRole(r)}
                    className={`flex-1 h-11 rounded-lg font-bold text-[12px] uppercase tracking-wider transition-all ${
                      formRole === r ? "bg-[#E63946] text-white" : "border border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946]/30"
                    }`}
                  >
                    {r === "coach" ? "Entraîneur" : "Recruteur"}
                  </button>
                ))}
              </div>
            </div>

            <div><label className={labelCls}>Ton institution *</label><input type="text" required placeholder="École ou CÉGEP" className={inputCls} /></div>
            <div>
              <label className={labelCls}>Région RSEQ *</label>
              <select value={formRegion} onChange={(e) => setFormRegion(e.target.value)} required className={inputCls}>
                <option value="">Sélectionner une région</option>
                {RSEQ_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Pourquoi veux-tu être ambassadeur? *</label>
              <textarea
                required
                maxLength={500}
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Décris ton réseau dans ta région. Combien de coachs ou recruteurs connais-tu personnellement?"
                className={`${inputCls} h-28 resize-none`}
              />
              <p className="text-[11px] text-[#4a4d56] text-right mt-1">{formMessage.length}/500</p>
            </div>

            <button type="submit" className="w-full h-12 rounded-lg bg-[#E63946] text-white font-head font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
              Envoyer ma candidature →
            </button>
          </form>
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
