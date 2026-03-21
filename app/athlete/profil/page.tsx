"use client";

import { useState, useMemo } from "react";
import { mockAthleteProfileFull } from "@/lib/mock/athleteProfileRecruiter";
import { athleteUser, athleteSuggestions, profileChecklist } from "@/lib/mock/athlete";
import type { AthleteSuggestion } from "@/lib/mock/athlete";
import type { AthleteTraitRatings } from "@/lib/types/models";
import StarRating from "@/components/ui/StarRating";
import NxIcon from "@/components/ui/NxIcon";

/* ═══════════════════════════════════════════════════════════════
   Athlete Profile — Co-creation page
   Green pencil = edit freely · Yellow pencil = suggest · Red lock = coach only
═══════════════════════════════════════════════════════════════ */

const GREEN = "#22C55E";
const YELLOW = "#EAB308";
const RED = "#E63946";
const BLUE = "#3B82F6";

/* ── Edit indicator icons ─────────────────────────────────────── */

function PencilIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Editable field wrapper (green) ───────────────────────────── */

function EditableField({ label, value, onSave, type = "text", recruiterView }: {
  label: string; value: string; onSave: (v: string) => void; type?: "text" | "url" | "textarea"; recruiterView: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (recruiterView) {
    if (!value) return null;
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
        <span className="text-[13px] text-[#9CA3AF]">{label}</span>
        <span className="text-[14px] font-bold text-white text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="group relative py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1.5">
          {label}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity"><PencilIcon color={GREEN} size={12} /></span>
        </span>
        {editing ? (
          <div className="flex items-center gap-2">
            {type === "textarea" ? (
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                className="bg-[#13151a] border border-[#22C55E]/40 rounded px-2 py-1 text-[13px] text-white w-48 focus:border-[#22C55E] outline-none resize-none" autoFocus />
            ) : (
              <input type={type} value={draft} onChange={(e) => setDraft(e.target.value)}
                className="bg-[#13151a] border border-[#22C55E]/40 rounded px-2 py-1 text-[13px] text-white w-40 text-right focus:border-[#22C55E] outline-none" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft); setEditing(false); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }} />
            )}
            <button type="button" onClick={() => { onSave(draft); setEditing(false); }} className="text-[#22C55E]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-[14px] font-bold text-white text-right hover:text-[#22C55E] transition-colors cursor-pointer group-hover:underline group-hover:decoration-[#22C55E]/30">
            {value || <span className="text-[#4a4d56] italic">Ajouter</span>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Suggestible field wrapper (yellow) ────────────────────────── */

function SuggestibleField({ label, value, fieldKey, pending, onSubmit, recruiterView }: {
  label: string; value: string; fieldKey: string; pending?: AthleteSuggestion; onSubmit: (field: string, proposed: string, message: string) => void; recruiterView: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [proposed, setProposed] = useState("");
  const [message, setMessage] = useState("");

  if (recruiterView) {
    if (!value) return null;
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
        <span className="text-[13px] text-[#9CA3AF]">{label}</span>
        <span className="text-[14px] font-bold text-white text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="group relative py-3 border-b border-[#2D3748]/40 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1.5">
          <PencilIcon color={YELLOW} size={12} />
          {label}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-bold text-white">{value}</span>
          {pending && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#EAB308]/15 text-[#EAB308]">En attente</span>
          )}
          {!pending && !showForm && (
            <button type="button" onClick={() => setShowForm(true)}
              className="px-2.5 py-1 rounded-lg border border-[#EAB308]/30 text-[#EAB308] text-[10px] font-bold uppercase tracking-wider hover:bg-[#EAB308]/10 transition-colors">
              Modifier
            </button>
          )}
        </div>
      </div>

      {pending && (
        <p className="text-[11px] text-[#EAB308] mt-1.5 pl-5">Suggestion envoyée: <span className="font-bold">{pending.proposed_value}</span></p>
      )}

      {showForm && !pending && (
        <div className="mt-3 bg-[#13151a] border border-[#EAB308]/20 rounded-lg p-4 space-y-3 animate-[slideDown_0.2s_ease-out]">
          <div>
            <p className="text-[11px] text-[#6b7280] line-through mb-1">Actuel: {value}</p>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#EAB308] block mb-1">Nouvelle valeur proposée</label>
            <input type="text" value={proposed} onChange={(e) => setProposed(e.target.value)} placeholder="Ex: 6'3&quot;" aria-label="Valeur proposée"
              className="w-full bg-[#111317] border border-[#2a2d36] rounded px-3 py-2 text-[13px] text-white focus:border-[#EAB308] outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Message pour ton coach (optionnel)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Ex: Mon bulletin de janvier montre 85%" aria-label="Message"
              className="w-full bg-[#111317] border border-[#2a2d36] rounded px-3 py-2 text-[12px] text-[#e0e0e0] focus:border-[#EAB308] outline-none resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={!proposed.trim()} onClick={() => { onSubmit(fieldKey, proposed, message); setShowForm(false); setProposed(""); setMessage(""); }}
              className="px-4 py-2 bg-[#EAB308] hover:bg-[#CA8A04] disabled:opacity-40 text-white text-[12px] font-bold rounded-lg transition-colors">
              Soumettre la suggestion
            </button>
            <button type="button" onClick={() => { setShowForm(false); setProposed(""); setMessage(""); }} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Locked field wrapper (red) ───────────────────────────────── */

function LockedField({ label, value, recruiterView, children }: {
  label: string; value?: string | number | null; recruiterView: boolean; children?: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (recruiterView) {
    if (!value && !children) return null;
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
        <span className="text-[13px] text-[#9CA3AF]">{label}</span>
        {children || <span className="text-[14px] font-bold text-white text-right">{value}</span>}
      </div>
    );
  }

  return (
    <div className="group relative py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowTooltip(!showTooltip)}>
        <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1.5">
          {label}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity"><LockIcon size={12} /></span>
        </span>
        {children || <span className="text-[14px] font-bold text-white text-right">{value}</span>}
      </div>
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 shadow-xl max-w-[260px]">
          <p className="text-[12px] text-white font-bold mb-1">Seul ton coach peut modifier cette information</p>
          <p className="text-[11px] text-[#6b7280]">Contacte ton coach si tu penses qu&apos;une mise à jour est nécessaire.</p>
        </div>
      )}
    </div>
  );
}

/* ── Trait labels ──────────────────────────────────────────────── */

const TRAIT_LABELS: Record<keyof AthleteTraitRatings, string> = {
  leadership: "Leadership", discipline: "Discipline", coachability: "Coachabilité",
  gameIQ: "QI sportif", competitiveness: "Compétitivité", teamwork: "Esprit d'équipe",
  resilience: "Résilience", attitude: "Attitude",
};

/* ── Completeness color ───────────────────────────────────────── */

function pctColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return "#6B7280";
  return BLUE;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function AthleteProfilPage() {
  const a = mockAthleteProfileFull;
  const u = athleteUser;
  const recruiterView = false; // always edit mode — aperçu opens in new tab
  const [suggestions, setSuggestions] = useState(athleteSuggestions);
  const [sugTab, setSugTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [toast, setToast] = useState<string | null>(null);

  // Editable fields (green — immediate save)
  const [editableFields, setEditableFields] = useState({
    highlightVideo: a.highlightVideoUrl || "",
    hudl: a.hudlUrl || "",
    youtube: a.youtubeUrl || "",
    instagram: a.instagramUrl || "",
    fullGame: a.fullGameUrl || "",
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const saveField = (key: string, value: string) => {
    setEditableFields((prev) => ({ ...prev, [key]: value }));
    showToast("Mis à jour!");
  };

  const submitSuggestion = (field: string, proposed: string, message: string) => {
    const newSug: AthleteSuggestion = {
      id: `s-new-${Date.now()}`, field, current_value: null, proposed_value: proposed,
      message, status: "pending", submitted_at: new Date().toISOString(),
    };
    setSuggestions((prev) => [newSug, ...prev]);
    showToast("Suggestion envoyée à ton coach");
  };

  const pendingSugs = suggestions.filter((s) => s.status === "pending");
  const approvedSugs = suggestions.filter((s) => s.status === "approved");
  const rejectedSugs = suggestions.filter((s) => s.status === "rejected");

  const getPending = (field: string) => pendingSugs.find((s) => s.field === field);

  const traitEntries = a.traitRatings ? Object.entries(a.traitRatings) as [keyof AthleteTraitRatings, number][] : [];
  const traitAvg = traitEntries.length > 0 ? traitEntries.reduce((s, [, v]) => s + v, 0) / traitEntries.length : a.overallRating;
  const color = pctColor(a.profileCompleteness);
  const incomplete = profileChecklist.filter((i) => !i.done);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Mon profil</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">C&apos;est ce que les recruteurs voient quand ils consultent ton profil</p>
        </div>
        <a href="/recruteur/athletes/r-001" target="_blank" rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          Aperçu recruteur
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
        </a>
      </div>

      {/* Pending suggestions banner */}
      {!recruiterView && pendingSugs.length > 0 && (
        <div className="bg-[#1A1D24] border-l-4 border-[#EAB308] rounded-r-xl px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] text-[#EAB308] font-bold">{pendingSugs.length} suggestion{pendingSugs.length > 1 ? "s" : ""} en attente d&apos;approbation par ton coach</span>
          <button type="button" onClick={() => { const el = document.getElementById("suggestions-section"); el?.scrollIntoView({ behavior: "smooth" }); }} className="text-[12px] font-bold text-[#EAB308] hover:text-white transition-colors">
            Voir mes suggestions →
          </button>
        </div>
      )}

      {/* ── Profile Content ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Main content (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Header card */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-xl bg-[#2F3440] border border-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[20px] font-head font-black text-white/15">{a.firstName[0]}{a.lastName[0]}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-head text-[20px] font-black text-white uppercase tracking-tight">{a.firstName} {a.lastName}</h2>
                  {a.isVerified && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={BLUE} stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-[#E63946]/20 text-[#E63946] text-[11px] font-bold uppercase tracking-wider">{a.primarySport}</span>
                  <span className="text-[13px] font-bold text-[#9CA3AF]">{a.primaryPosition}</span>
                  <span className="text-[#2D3748]">·</span>
                  <span className="text-[13px] text-[#9CA3AF]">{a.schoolName}</span>
                  <span className="text-[#2D3748]">·</span>
                  <span className="text-[13px] text-[#9CA3AF]">Promotion {a.graduationYear}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Info — SUGGESTIBLE */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Informations personnelles</h3>
            <LockedField label="Âge" value={`${a.age} ans`} recruiterView={recruiterView} />
            <LockedField label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} recruiterView={recruiterView} />
            <SuggestibleField label="Ville" value={a.city} fieldKey="Ville" pending={getPending("Ville")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
            <LockedField label="Région" value={a.region} recruiterView={recruiterView} />
            <LockedField label="École" value={a.schoolName} recruiterView={recruiterView} />
            <LockedField label="Graduation" value={String(a.graduationYear)} recruiterView={recruiterView} />
          </div>

          {/* Sport Info — SUGGESTIBLE */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Informations sportives</h3>
            <LockedField label="Sport principal" value={a.primarySport} recruiterView={recruiterView} />
            <SuggestibleField label="Position principale" value={a.primaryPosition} fieldKey="Position" pending={getPending("Position")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
            {a.secondarySport && <SuggestibleField label="Sport secondaire" value={a.secondarySport} fieldKey="Sport secondaire" pending={getPending("Sport secondaire")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
            {a.secondaryPosition && <SuggestibleField label="Position secondaire" value={a.secondaryPosition} fieldKey="Position secondaire" pending={getPending("Position secondaire")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
            {a.jerseyNumber && <LockedField label="Numéro" value={`#${a.jerseyNumber}`} recruiterView={recruiterView} />}
            {a.teamName && <LockedField label="Équipe" value={a.teamName} recruiterView={recruiterView} />}
            {a.leagueName && <LockedField label="Ligue" value={a.leagueName} recruiterView={recruiterView} />}
          </div>

          {/* Physical — SUGGESTIBLE */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Profil physique</h3>
            <SuggestibleField label="Taille" value={a.heightDisplay} fieldKey="Taille" pending={getPending("Taille")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
            <SuggestibleField label="Poids" value={a.weightDisplay} fieldKey="Poids" pending={getPending("Poids")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
            {a.wingspan && <SuggestibleField label="Envergure" value={a.wingspan} fieldKey="Envergure" pending={getPending("Envergure")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
            {a.handSize && <SuggestibleField label="Taille des mains" value={a.handSize} fieldKey="Taille mains" pending={getPending("Taille mains")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
            {a.dominantHand && <LockedField label="Main dominante" value={a.dominantHand} recruiterView={recruiterView} />}
            {a.dominantFoot && <LockedField label="Pied dominant" value={a.dominantFoot} recruiterView={recruiterView} />}

            {/* Athletic tests — SUGGESTIBLE */}
            {(a.fortyYard || a.verticalJump || a.broadJump) && (
              <div className="mt-4 pt-3 border-t border-[#2D3748]/40">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Tests athlétiques</h4>
                {a.fortyYard && <SuggestibleField label="40 yards" value={a.fortyYard} fieldKey="40 yards" pending={getPending("40 yards")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
                {a.verticalJump && <SuggestibleField label="Saut vertical" value={a.verticalJump} fieldKey="Saut vertical" pending={getPending("Saut vertical")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
                {a.broadJump && <SuggestibleField label="Saut en longueur" value={a.broadJump} fieldKey="Saut longueur" pending={getPending("Saut longueur")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
                {a.benchPress && <SuggestibleField label="Développé couché" value={a.benchPress} fieldKey="Développé couché" pending={getPending("Développé couché")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
                {a.shuttleAgility && <SuggestibleField label="Navette" value={a.shuttleAgility} fieldKey="Navette" pending={getPending("Navette")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
                {a.sprint100m && <SuggestibleField label="Sprint 100m" value={a.sprint100m} fieldKey="Sprint 100m" pending={getPending("Sprint 100m")} onSubmit={submitSuggestion} recruiterView={recruiterView} />}
              </div>
            )}
          </div>

          {/* Academic — SUGGESTIBLE */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Profil académique</h3>
            <SuggestibleField label="Moyenne générale" value={a.gpa ? `${a.gpa}%` : "—"} fieldKey="Moyenne générale" pending={getPending("Moyenne générale")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
            <SuggestibleField label="Programme visé" value={a.targetCegepProgram?.join(", ") || "—"} fieldKey="Programme" pending={getPending("Programme")} onSubmit={submitSuggestion} recruiterView={recruiterView} />

            {/* Strong subjects — EDITABLE (green) */}
            {a.strongSubjects.length > 0 && (
              <div className="py-2.5 border-b border-[#2D3748]/40">
                <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1.5">
                  <PencilIcon color={GREEN} size={12} />
                  Matières fortes
                </span>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {a.strongSubjects.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full bg-[#2D3748]/50 text-[11px] text-[#9CA3AF]">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Academic honors */}
            {a.academicHonors && a.academicHonors.length > 0 && (
              <div className="py-2.5 border-b border-[#2D3748]/40">
                <span className="text-[13px] text-[#9CA3AF]">Mentions</span>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {a.academicHonors.map((h) => (
                    <span key={h} className="px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[11px] text-[#22C55E]">{h}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Preferences — EDITABLE (green) */}
            <div className="mt-3 pt-3 border-t border-[#2D3748]/40">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3 flex items-center gap-1.5">
                <PencilIcon color={GREEN} size={12} />
                Préférences CÉGEP
              </h4>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Ouvert à déménager", active: a.openToRelocate },
                  { label: "Ouvert au privé", active: a.openToPrivate },
                  { label: "Veut faire un DEC", active: a.wantsDEC },
                  { label: "Ouvert anglophone", active: a.openToAnglophone },
                ].filter((p) => p.active !== undefined).map((p) => (
                  <span key={p.label} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border" style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "#fff" }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.active ? "#22C55E" : "#6B7280" }} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Preferred regions */}
            {a.preferredRegions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#2D3748]/40">
                <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1.5">
                  <PencilIcon color={GREEN} size={12} />
                  Régions préférées
                </span>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {a.preferredRegions.map((r) => (
                    <span key={r} className="px-2.5 py-1 rounded-full bg-[#2D3748]/50 text-[11px] text-[#9CA3AF]">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coach Report — LOCKED */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4 flex items-center gap-2">
              Rapport de l&apos;entraîneur
              {!recruiterView && <LockIcon size={12} />}
            </h3>
            {a.coachReport && (
              <div className="bg-[#111317] rounded-lg border border-white/5 p-4 mb-4">
                <p className="text-[11px] font-bold text-[#6b7280] mb-2">Coach {a.coachName}</p>
                <p className="text-[14px] text-[#9CA3AF] leading-relaxed italic">&ldquo;{a.coachReport}&rdquo;</p>
              </div>
            )}
            <LockedField label="Cote Globale" recruiterView={recruiterView}>
              <div className="flex items-center gap-2">
                <StarRating rating={traitAvg} size="md" showNumber={false} />
                <span className="text-[16px] font-head font-black text-white">{traitAvg.toFixed(1)}/5</span>
              </div>
            </LockedField>
            {traitEntries.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {traitEntries.map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded bg-[#111317] border border-white/5">
                    <span className="text-[12px] text-[#9CA3AF]">{TRAIT_LABELS[key]}</span>
                    <StarRating rating={val} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Media — GREEN (editable) */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4 flex items-center gap-2">
              Médias &amp; liens
              {!recruiterView && <PencilIcon color={GREEN} size={12} />}
            </h3>
            <EditableField label="Faits saillants" value={editableFields.highlightVideo} onSave={(v) => saveField("highlightVideo", v)} type="url" recruiterView={recruiterView} />
            <EditableField label="Hudl" value={editableFields.hudl} onSave={(v) => saveField("hudl", v)} type="url" recruiterView={recruiterView} />
            <EditableField label="YouTube" value={editableFields.youtube} onSave={(v) => saveField("youtube", v)} type="url" recruiterView={recruiterView} />
            <EditableField label="Instagram" value={editableFields.instagram} onSave={(v) => saveField("instagram", v)} type="url" recruiterView={recruiterView} />
            <EditableField label="Match complet" value={editableFields.fullGame} onSave={(v) => saveField("fullGame", v)} type="url" recruiterView={recruiterView} />
          </div>
        </div>

        {/* Sidebar (1/3) — completeness widget */}
        {!recruiterView && (
          <div className="lg:col-span-1">
            <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 sticky top-24">
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2D3748" strokeWidth="3" />
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3"
                      strokeDasharray={`${a.profileCompleteness}, 100`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-head text-[20px] font-black" style={{ color }}>{a.profileCompleteness}%</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Complétion du profil</p>

              {incomplete.length > 0 && (
                <div className="space-y-2.5">
                  {incomplete.map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 text-[12px]">
                      <div className="w-4 h-4 rounded-full border-2 border-[#4a4d56] shrink-0" />
                      <span className="text-[#9CA3AF] flex-1">{item.label}</span>
                      <span className="text-[#22C55E] font-bold shrink-0">+{item.boost}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Suggestions Section ───────────────────────────────── */}
      {!recruiterView && (
        <div id="suggestions-section" className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Mes suggestions</h3>

          <div className="flex items-center gap-2 mb-4">
            {([
              { key: "pending" as const, label: "En attente", count: pendingSugs.length, color: YELLOW },
              { key: "approved" as const, label: "Approuvées", count: approvedSugs.length, color: GREEN },
              { key: "rejected" as const, label: "Rejetées", count: rejectedSugs.length, color: RED },
            ]).map((tab) => (
              <button key={tab.key} type="button" onClick={() => setSugTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  sugTab === tab.key ? `text-white` : "text-[#6b7280] hover:text-[#9CA3AF]"
                }`}
                style={sugTab === tab.key ? { backgroundColor: `${tab.color}20`, color: tab.color } : undefined}>
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {(sugTab === "pending" ? pendingSugs : sugTab === "approved" ? approvedSugs : rejectedSugs).map((s) => (
              <div key={s.id} className={`bg-[#13151a] rounded-lg border p-4 ${
                s.status === "pending" ? "border-[#EAB308]/20" : s.status === "approved" ? "border-[#22C55E]/20" : "border-[#E63946]/20"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-bold text-white">{s.field}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.status === "pending" ? "bg-[#EAB308]/15 text-[#EAB308]" : s.status === "approved" ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#E63946]/15 text-[#E63946]"
                  }`}>
                    {s.status === "pending" ? "En attente" : s.status === "approved" ? "Approuvée" : "Rejetée"}
                  </span>
                </div>
                <p className="text-[12px] text-[#9CA3AF]">
                  {s.current_value && <><span className="line-through text-[#6b7280]">{s.current_value}</span> → </>}
                  <span className="font-bold text-white">{s.proposed_value}</span>
                </p>
                {s.message && <p className="text-[11px] text-[#6b7280] mt-1 italic">&ldquo;{s.message}&rdquo;</p>}
                {s.rejection_reason && <p className="text-[11px] text-[#E63946] mt-1">Coach: &ldquo;{s.rejection_reason}&rdquo;</p>}
                <p className="text-[10px] text-[#4a4d56] mt-1.5">{s.submitted_at}</p>
              </div>
            ))}
            {(sugTab === "pending" ? pendingSugs : sugTab === "approved" ? approvedSugs : rejectedSugs).length === 0 && (
              <p className="text-[13px] text-[#4a4d56] text-center py-6">Aucune suggestion</p>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 400px; }
        }
      `}</style>
    </div>
  );
}
