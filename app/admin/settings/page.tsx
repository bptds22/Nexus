"use client";

import { useState, useRef } from "react";
import { SYSTEM_SETTINGS } from "@/lib/mock/admin";

/* ─────────────────────────────────────────────────────────────────
   Admin Settings — Refactored to match Coach Settings layout
   Left nav + content panel, 5 sections.
───────────────────────────────────────────────────────────────── */

type Section = "verification" | "saison" | "pipeline" | "messages" | "systeme";

const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
  {
    key: "verification",
    label: "Vérification",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    key: "saison",
    label: "Saison & période",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    key: "pipeline",
    label: "Pipeline",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    key: "messages",
    label: "Messages",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    key: "systeme",
    label: "Système & données",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

const label = "text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-1.5";
const input = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

/* ── Variables for message template ────────────────────────── */
const TEMPLATE_VARS: { token: string; example: string; description: string }[] = [
  { token: "[Coach]", example: "Marc-André Pelletier", description: "Nom complet du coach" },
  { token: "[Recruteur]", example: "Pierre Dufour", description: "Nom du recruteur" },
  { token: "[CÉGEP]", example: "Garneau", description: "Nom du CÉGEP" },
  { token: "[Athlète]", example: "Félix Gagnon-Roy", description: "Nom de l'athlète" },
  { token: "[Sport]", example: "Football", description: "Sport principal" },
];

function MessagesSection({ template, setTemplate, onSave }: { template: string; setTemplate: (v: string) => void; onSave: () => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saved, setSaved] = useState(false);
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);

  function insertVariable(token: string) {
    const el = textareaRef.current;
    if (!el) { setTemplate(template + token); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = template.slice(0, start);
    const after = template.slice(end);
    const newVal = before + token + after;
    setTemplate(newVal);
    // Restore cursor after the inserted token
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleSave() {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // Build preview with highlighted variables
  function renderPreview() {
    let text = template;
    for (const v of TEMPLATE_VARS) {
      text = text.replaceAll(v.token, v.example);
    }
    return text;
  }

  // Count variables used
  const usedVars = TEMPLATE_VARS.filter((v) => template.includes(v.token));
  const unusedVars = TEMPLATE_VARS.filter((v) => !template.includes(v.token));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Message d&apos;introduction</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Template envoyé par défaut lors d&apos;une première demande de contact.</p>
      </div>

      <div className="space-y-5">
        {/* Template textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className={label + " mb-0"}>Template</p>
            <span className={`text-[11px] font-bold ${template.length > 500 ? "text-[#F59E0B]" : "text-[#4B5563]"}`}>
              {template.length} / 500 caractères
            </span>
          </div>
          <textarea
            ref={textareaRef}
            title="Template du message"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={5}
            className={`${input} resize-y`}
          />
        </div>

        {/* Clickable variable pills */}
        <div>
          <p className={label}>Variables — cliquer pour insérer</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARS.map((v) => {
              const isUsed = template.includes(v.token);
              return (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => insertVariable(v.token)}
                  onMouseEnter={() => setHoveredVar(v.token)}
                  onMouseLeave={() => setHoveredVar(null)}
                  className={`group relative px-3 py-1.5 rounded-full text-[12px] font-bold font-mono transition-all cursor-pointer border ${
                    isUsed
                      ? "bg-[#E63946]/15 border-[#E63946]/30 text-[#E63946] hover:bg-[#E63946]/25"
                      : "bg-[#2D3748] border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946]/40 hover:text-white"
                  }`}
                >
                  {v.token}
                  {isUsed && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#E63946] text-[9px] text-white font-bold">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Tooltip for hovered variable */}
          {hoveredVar && (
            <div className="mt-2 px-3 py-2 bg-[#13151a] border border-[#2a2d36] rounded-lg inline-flex items-center gap-3">
              <span className="text-[11px] text-[#6b7280]">{TEMPLATE_VARS.find((v) => v.token === hoveredVar)?.description}</span>
              <span className="text-[11px] text-[#4B5563]">→</span>
              <span className="text-[11px] text-[#9CA3AF] italic">{TEMPLATE_VARS.find((v) => v.token === hoveredVar)?.example}</span>
            </div>
          )}
        </div>

        {/* Variable usage summary */}
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-[#22C55E] font-bold">{usedVars.length}/{TEMPLATE_VARS.length} variables utilisées</span>
          {unusedVars.length > 0 && (
            <span className="text-[11px] text-[#F59E0B]">
              Manquantes : {unusedVars.map((v) => v.token).join(", ")}
            </span>
          )}
        </div>

        {/* Live preview */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className={label + " mb-0"}>Aperçu en direct</p>
            <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold">LIVE</span>
          </div>
          <div className="bg-[#13151a] rounded-lg border border-[#2a2d36] p-5">
            {/* Simulated message bubble */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#A855F7]/15 border border-[#A855F7]/30 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-black text-[#A855F7]">PD</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-bold text-white">Pierre Dufour</span>
                  <span className="text-[10px] text-[#6b7280]">CÉGEP Garneau · Recruteur</span>
                </div>
                <div className="bg-[#1A1D24] rounded-lg rounded-tl-none border border-[#2D3748] px-4 py-3">
                  <p className="text-[13px] text-[#e0e0e0] leading-relaxed">
                    {renderPreview() || <span className="text-[#4B5563] italic">Le message apparaîtra ici...</span>}
                  </p>
                </div>
                <p className="text-[10px] text-[#4B5563] mt-1.5">Envoyé il y a 2 minutes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={handleSave} className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors">
          Enregistrer
        </button>
        <button type="button" onClick={() => setTemplate(SYSTEM_SETTINGS.intro_message_template)} className="text-[13px] font-bold text-[#6b7280] hover:text-white transition-colors">
          Réinitialiser
        </button>
        {saved && (
          <span className="text-[14px] font-semibold text-[#22C55E] animate-pulse">
            Modifications enregistrées
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [section, setSection] = useState<Section>("verification");
  const [toast, setToast] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(SYSTEM_SETTINGS.verification_threshold);
  const [season, setSeason] = useState(SYSTEM_SETTINGS.current_season);
  const [startDate, setStartDate] = useState(SYSTEM_SETTINGS.recruitment_period.start);
  const [endDate, setEndDate] = useState(SYSTEM_SETTINGS.recruitment_period.end);
  const [autoAdvance, setAutoAdvance] = useState(SYSTEM_SETTINGS.auto_advance_pipeline);
  const [maintenance, setMaintenance] = useState(SYSTEM_SETTINGS.maintenance_mode);
  const [template, setTemplate] = useState(SYSTEM_SETTINGS.intro_message_template);

  function save() { setToast("Paramètres sauvegardés (POC)"); setTimeout(() => setToast(null), 3000); }
  function showToast(msg = "Action simulée — POC") { setToast(msg); setTimeout(() => setToast(null), 3000); }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Configuration système
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Paramètres globaux de la plateforme Nexus.
        </p>
      </div>

      {/* Layout: nav + content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left nav */}
        <div className="lg:w-[240px] shrink-0">
          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            {SECTIONS.map((s) => {
              const isActive = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] font-bold tracking-[0.08em] uppercase whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[#E63946]/12 text-[#E63946]"
                      : "text-[#8a8d96] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className={isActive ? "text-[#E63946]" : "text-[#6b7280]"}>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8">

            {/* ═══ Vérification ═══ */}
            {section === "verification" && (
              <div className="space-y-8">
                <div>
                  <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Vérification des profils</h2>
                  <p className="text-[14px] text-[#6b7280] mt-1">Un profil atteint le badge vérifié (coche bleue) lorsque sa complétion atteint ce seuil.</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className={label}>Seuil de complétion</p>
                    <div className="flex items-center gap-4">
                      <input type="range" title="Seuil de complétion" min="30" max="100" step="5" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1 accent-[#E63946]" />
                      <span className="text-[24px] font-head font-black text-white w-20 text-center">{threshold}%</span>
                    </div>
                    <p className="text-[12px] text-[#4B5563] mt-2">Les profils sous {threshold}% ne seront pas considérés comme vérifiés.</p>
                  </div>

                  {/* Preview */}
                  <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
                    <p className={`${label} mb-3`}>Aperçu du seuil</p>
                    <div className="space-y-3">
                      {[
                        { name: "Profil complet (95%)", pct: 95 },
                        { name: `Seuil exact (${threshold}%)`, pct: threshold },
                        { name: "Profil incomplet (40%)", pct: 40 },
                      ].map((p) => (
                        <div key={p.name} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] text-[#9CA3AF]">{p.name}</span>
                              <span className="text-[12px] font-bold text-white">{p.pct}%</span>
                            </div>
                            <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${p.pct >= threshold ? "bg-[#3B82F6]" : "bg-[#4B5563]"}`} style={{ width: `${p.pct}%` }} />
                            </div>
                          </div>
                          {p.pct >= threshold ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0"><circle cx="12" cy="12" r="10" fill="#3B82F6" /><path d="M8 12l2.5 2.5L16 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0"><circle cx="12" cy="12" r="10" stroke="#4B5563" strokeWidth="1.5" /></svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button type="button" onClick={save} className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors">
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Saison & Période ═══ */}
            {section === "saison" && (
              <div className="space-y-8">
                <div>
                  <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Saison &amp; Période de recrutement</h2>
                  <p className="text-[14px] text-[#6b7280] mt-1">Définissez la saison active et les dates de la période de recrutement.</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className={label}>Saison active</p>
                    <input type="text" title="Saison active" value={season} onChange={(e) => setSeason(e.target.value)} className={input} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className={label}>Début recrutement</p>
                      <input type="date" title="Début recrutement" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
                    </div>
                    <div>
                      <p className={label}>Fin recrutement</p>
                      <input type="date" title="Fin recrutement" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
                    </div>
                  </div>

                  {/* Period preview */}
                  <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
                    <p className={`${label} mb-3`}>Aperçu</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#6b7280]">Saison</span>
                          <span className="text-[14px] font-bold text-white">{season}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#6b7280]">Période</span>
                          <span className="text-[13px] text-[#9CA3AF]">
                            {new Date(startDate).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                            {" → "}
                            {new Date(endDate).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-[#6b7280]">Durée</span>
                          <span className="text-[13px] text-[#22C55E] font-bold">
                            {Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} jours
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button type="button" onClick={save} className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors">
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Pipeline ═══ */}
            {section === "pipeline" && (
              <div className="space-y-8">
                <div>
                  <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Pipeline automatique</h2>
                  <p className="text-[14px] text-[#6b7280] mt-1">Contrôlez le comportement automatique du pipeline de recrutement.</p>
                </div>

                <div className="space-y-5">
                  {/* Auto advance toggle */}
                  <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-[14px] font-bold text-white">Avancement automatique</p>
                        <p className="text-[13px] text-[#6b7280] mt-1">Quand activé, le pipeline avance automatiquement selon les actions des utilisateurs.</p>
                      </div>
                      <button type="button" title="Activer/désactiver le pipeline automatique" onClick={() => { setAutoAdvance(!autoAdvance); save(); }}
                        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${autoAdvance ? "bg-[#22C55E]" : "bg-[#2D3748]"}`}>
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${autoAdvance ? "left-6" : "left-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Pipeline rules */}
                  <div>
                    <p className={label}>Règles d&apos;avancement</p>
                    <div className="space-y-2">
                      {[
                        { action: "Ajout aux favoris", result: "→ Identifié", active: autoAdvance },
                        { action: "Premier message envoyé", result: "→ Contacté", active: autoAdvance },
                        { action: "Réponse du coach", result: "→ En discussion", active: autoAdvance },
                      ].map((rule) => (
                        <div key={rule.action} className="bg-[#1A1D24] rounded-lg border border-[#2D3748] px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${rule.active ? "bg-[#22C55E]" : "bg-[#4B5563]"}`} />
                            <span className="text-[13px] text-[#9CA3AF]">{rule.action}</span>
                          </div>
                          <span className="text-[13px] font-bold text-white">{rule.result}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Messages ═══ */}
            {section === "messages" && (
              <MessagesSection template={template} setTemplate={setTemplate} onSave={save} />
            )}

            {/* ═══ Système & données ═══ */}
            {section === "systeme" && (
              <div className="space-y-8">
                <div>
                  <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Système &amp; données</h2>
                  <p className="text-[14px] text-[#6b7280] mt-1">Mode maintenance, export et réinitialisation des données.</p>
                </div>

                <div className="space-y-5">
                  {/* Maintenance toggle — danger */}
                  <div className="bg-[#1A1D24] rounded-xl border border-[#E63946]/30 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-[14px] font-bold text-[#E63946]">Mode maintenance</p>
                        <p className="text-[13px] text-[#6b7280] mt-1">Quand activé, seuls les admins peuvent accéder à la plateforme. Les autres utilisateurs voient un message de maintenance.</p>
                      </div>
                      <button type="button" title="Activer/désactiver le mode maintenance" onClick={() => { setMaintenance(!maintenance); save(); }}
                        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${maintenance ? "bg-[#E63946]" : "bg-[#2D3748]"}`}>
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${maintenance ? "left-6" : "left-1"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Export & reset */}
                  <div>
                    <p className={label}>Actions sur les données</p>
                    <div className="space-y-3">
                      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 flex items-center justify-between">
                        <div>
                          <p className="text-[14px] font-bold text-white">Exporter les données</p>
                          <p className="text-[12px] text-[#6b7280] mt-0.5">Télécharger toutes les données en format CSV.</p>
                        </div>
                        <button type="button" onClick={() => showToast()} className="shrink-0 px-5 py-2.5 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:text-white hover:border-[#E63946]/40 transition-colors">
                          Exporter CSV
                        </button>
                      </div>
                      <div className="bg-[#1A1D24] rounded-xl border border-[#E63946]/20 p-5 flex items-center justify-between">
                        <div>
                          <p className="text-[14px] font-bold text-white">Réinitialiser les données mock</p>
                          <p className="text-[12px] text-[#6b7280] mt-0.5">Remettre toutes les données de démonstration à leur état initial.</p>
                        </div>
                        <button type="button" onClick={() => showToast()} className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946]/30 text-[#E63946] font-bold text-[12px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors">
                          Réinitialiser
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}
