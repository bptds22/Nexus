"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateProfileCompletion, getIncompleteFields } from "@/lib/utils/calculateProfileCompletion";
import { calculateCompletionForRole, SECTION_IDS } from "@/lib/utils/profileCompletion";
import { isValidationDue, isValidationExpired, formatDeadlineFr, currentMonthKey } from "@/lib/utils/profileValidation";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import DatePicker from "@/app/coach/components/DatePicker";
import type { AthleteSuggestion, AthleteTraitRatings } from "@/lib/types/models";
import StarRating from "@/components/ui/StarRating";
import NxIcon from "@/components/ui/NxIcon";
import { BADGE_CONFIG, BADGE_ORDER, MAX_BADGES, MAX_DETAIL_LENGTH, parseDistinctions, type DistinctionEntry } from "@/lib/config/badges";
import DistinctionBadge from "@/components/shared/DistinctionBadge";

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
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} title={label} placeholder={label}
                className="bg-[#13151a] border border-[#22C55E]/40 rounded px-2 py-1 text-[13px] text-white w-48 focus:border-[#22C55E] outline-none resize-none" autoFocus />
            ) : (
              <input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} title={label} placeholder={label}
                className="bg-[#13151a] border border-[#22C55E]/40 rounded px-2 py-1 text-[13px] text-white w-40 text-right focus:border-[#22C55E] outline-none" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft); setEditing(false); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }} />
            )}
            <button type="button" onClick={() => { onSave(draft); setEditing(false); }} className="text-[#22C55E]" aria-label="Enregistrer">
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

const MESSAGE_PLACEHOLDERS: Record<string, string> = {
  "Taille": "Ex: Je me suis fait mesurer à la clinique la semaine dernière",
  "Poids": "Ex: Poids pris ce matin après l'entraînement",
  "Envergure": "Ex: Mesurée lors du combine de l'école",
  "Taille mains": "Ex: Mesurée par le thérapeute sportif",
  "Main dominante": "Ex: Je lance de la droite mais j'écris de la gauche",
  "Pied dominant": "Ex: Je botte toujours du droit",
  "40 yards": "Ex: Chrono officiel du combine RSEQ",
  "Saut vertical": "Ex: Mesuré au gym avec l'entraîneur",
  "Saut longueur": "Ex: Résultat du test de la semaine dernière",
  "Développé couché": "Ex: Nouveau record personnel au gym",
  "Navette": "Ex: Temps du dernier test en équipe",
  "Sprint 100m": "Ex: Chrono de la compétition d'athlétisme",
  "Sport principal": "Ex: J'ai changé de sport cette saison",
  "Position": "Ex: Le coach m'a déplacé à cette position",
  "Sport secondaire": "Ex: Je joue aussi au basketball en parascolaire",
  "Position secondaire": "Ex: Je joue meneur quand je suis au basketball",
  "Numéro": "Ex: J'ai changé de numéro cette saison",
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  "Taille": "Ex: 6'2\"",
  "Poids": "Ex: 185 lbs",
  "Envergure": "Ex: 74\"",
  "Taille mains": "Ex: 9.5\"",
  "Ville": "Ex: Québec",
  "Position": "Ex: Quart-arrière (QB)",
  "Position secondaire": "Ex: Receveur (WR)",
  "Sport secondaire": "Ex: Basketball",
  "Numéro": "Ex: #12",
  "Programme": "Ex: Sciences humaines",
  "Moyenne générale": "Ex: 82%",
  "40 yards": "Ex: 4.65s",
  "Saut vertical": "Ex: 32\"",
  "Saut longueur": "Ex: 9'6\"",
  "Développé couché": "Ex: 225 lbs",
  "Navette": "Ex: 4.35s",
  "Sprint 100m": "Ex: 11.2s",
};

/* ── Structured input per field type ── */

const DROPDOWN_FIELDS: Record<string, string[]> = {
  "Main dominante": ["Droite", "Gauche", "Ambidextre"],
  "Pied dominant": ["Droit", "Gauche", "Ambidextre"],
};

const UNIT_FIELDS: Record<string, { unit: string; type: "number" }> = {
  "Poids": { unit: "lbs", type: "number" },
  "Envergure": { unit: '"', type: "number" },
  "Taille mains": { unit: '"', type: "number" },
  "40 yards": { unit: "s", type: "number" },
  "Saut vertical": { unit: '"', type: "number" },
  "Développé couché": { unit: "lbs", type: "number" },
  "Navette": { unit: "s", type: "number" },
  "Sprint 100m": { unit: "s", type: "number" },
};

const DUAL_FIELDS = new Set(["Taille", "Saut longueur"]);

const DB_SPORT_FIELDS = new Set(["Sport principal", "Sport secondaire"]);
const DB_POSITION_FIELDS = new Set(["Position", "Position secondaire"]);

function StructuredInput({ fieldKey, proposed, setProposed, inputCls }: { fieldKey: string; proposed: string; setProposed: (v: string) => void; inputCls: string }) {
  const [sports, setSports] = useState<{ id: string; nom: string }[]>([]);
  const [positions, setPositions] = useState<{ id: string; nom: string }[]>([]);

  // Load sports from DB for sport fields
  useEffect(() => {
    if (!DB_SPORT_FIELDS.has(fieldKey) && !DB_POSITION_FIELDS.has(fieldKey)) return;
    const loadSports = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("sports").select("id, nom").order("nom");
      if (data) setSports(data);
    };
    loadSports();
  }, [fieldKey]);

  // Load positions when a sport is selected (for position fields)
  useEffect(() => {
    if (!DB_POSITION_FIELDS.has(fieldKey) || !proposed) return;
    // For position fields, we need the sport context. Use the proposed sport or load from athlete.
    // Positions load is handled inline when sport changes
  }, [fieldKey, proposed]);

  // Sport dropdown
  if (DB_SPORT_FIELDS.has(fieldKey)) {
    return (
      <select title={fieldKey} value={proposed} onChange={(e) => setProposed(e.target.value)} className={inputCls}>
        <option value="">Sélectionner un sport</option>
        {sports.map((s) => <option key={s.id} value={s.nom}>{s.nom}</option>)}
      </select>
    );
  }

  // Position dropdown — loads positions based on current sport
  if (DB_POSITION_FIELDS.has(fieldKey)) {
    return <PositionDropdown fieldKey={fieldKey} proposed={proposed} setProposed={setProposed} inputCls={inputCls} />;
  }

  // Static dropdown fields
  if (DROPDOWN_FIELDS[fieldKey]) {
    return (
      <select title={fieldKey} value={proposed} onChange={(e) => setProposed(e.target.value)} className={inputCls}>
        <option value="">Sélectionner</option>
        {DROPDOWN_FIELDS[fieldKey].map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  // Dual input: feet + inches
  if (DUAL_FIELDS.has(fieldKey)) {
    const match = proposed.match(/^(\d+)'(\d+)"?$/);
    const ft = match ? match[1] : "";
    const inc = match ? match[2] : "";
    const update = (f: string, i: string) => setProposed(f && i !== "" ? `${f}'${i}"` : "");
    return (
      <div className="flex items-center gap-2">
        <select title="Pieds" value={ft} onChange={(e) => update(e.target.value, inc || "0")} className={`${inputCls} w-20`}>
          <option value="">—</option>
          {[4,5,6,7,8,9].map((v) => <option key={v} value={String(v)}>{v}&apos;</option>)}
        </select>
        <select title="Pouces" value={inc} onChange={(e) => update(ft || "5", e.target.value)} className={`${inputCls} w-20`}>
          <option value="">—</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i)}>{i}&quot;</option>)}
        </select>
      </div>
    );
  }

  // Number + unit suffix
  if (UNIT_FIELDS[fieldKey]) {
    const cfg = UNIT_FIELDS[fieldKey];
    const numVal = proposed.replace(/[^\d.]/g, "");
    return (
      <div className="flex items-center gap-2">
        <input type="number" value={numVal} onChange={(e) => setProposed(e.target.value ? `${e.target.value} ${cfg.unit}`.trim() : "")}
          placeholder={FIELD_PLACEHOLDERS[fieldKey]?.replace("Ex: ", "") || ""} className={`${inputCls} flex-1`} step="any" />
        <span className="text-[13px] text-[#6b7280] font-bold shrink-0">{cfg.unit}</span>
      </div>
    );
  }

  // Numéro — text with # prefix
  if (fieldKey === "Numéro") {
    const num = proposed.replace("#", "");
    return (
      <div className="flex items-center gap-1">
        <span className="text-[16px] font-bold text-[#E63946]">#</span>
        <input type="text" value={num} onChange={(e) => setProposed(e.target.value ? `#${e.target.value}` : "")} placeholder="14" className={inputCls} />
      </div>
    );
  }

  // Default — plain text input
  return (
    <input type="text" value={proposed} onChange={(e) => setProposed(e.target.value)} placeholder={FIELD_PLACEHOLDERS[fieldKey] || `Nouvelle valeur pour ${fieldKey}`} aria-label="Valeur proposée" className={inputCls} />
  );
}

/* Position dropdown — loads positions from DB based on athlete's current sport */
function PositionDropdown({ fieldKey, proposed, setProposed, inputCls }: { fieldKey: string; proposed: string; setProposed: (v: string) => void; inputCls: string }) {
  const [positions, setPositions] = useState<{ id: string; nom: string; abreviation: string }[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Get athlete's current sport_id
      const { data: athlete } = await supabase.from("athletes").select("sport_id").eq("user_id", user.id).maybeSingle();
      if (!athlete?.sport_id) return;
      const { data: pos } = await supabase.from("positions").select("id, nom, abreviation").eq("sport_id", athlete.sport_id).order("nom");
      if (pos) setPositions(pos);
    }
    load();
  }, [fieldKey]);

  return (
    <select title={fieldKey} value={proposed} onChange={(e) => setProposed(e.target.value)} className={inputCls}>
      <option value="">Sélectionner une position</option>
      {positions.map((p) => <option key={p.id} value={p.nom}>{p.abreviation} — {p.nom}</option>)}
    </select>
  );
}

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
            <StructuredInput fieldKey={fieldKey} proposed={proposed} setProposed={setProposed} inputCls="w-full bg-[#111317] border border-[#2a2d36] rounded px-3 py-2 text-[13px] text-white focus:border-[#EAB308] outline-none" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Message pour ton coach (optionnel)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder={MESSAGE_PLACEHOLDERS[fieldKey] || "Ex: Explique pourquoi tu proposes ce changement"} aria-label="Message"
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
  const [hovered, setHovered] = useState(false);

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
    <div
      className="relative py-2.5 border-b border-[#2D3748]/40 last:border-b-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1.5">
          {label}
          <span className={`transition-opacity duration-200 ${hovered ? "opacity-100" : "opacity-0"}`}><LockIcon size={12} /></span>
        </span>
        {children || <span className="text-[14px] font-bold text-white text-right">{value || <span className="text-[#4a4d56]">Non renseigné</span>}</span>}
      </div>
      <div
        className="absolute right-0 bottom-full mb-1 z-20 bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 shadow-xl max-w-[240px] pointer-events-none"
        style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease-in-out" }}
      >
        <p className="text-[11px] text-white font-bold">Seul ton coach peut modifier cette information</p>
      </div>
    </div>
  );
}

/* ── Shared suggestion UI primitives ──────────────────────── */

const SECTION_LABEL_CLS = "text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]";
const SECTION_SUBTITLE_CLS = "text-[12px] text-[#6b7280]";
const PROPOSE_BTN_CLS = "px-4 py-2 border border-[#E63946] text-[#E63946] rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors";
const CANCEL_BTN_CLS = "px-4 py-2 border border-[#E63946] text-[#E63946] rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors";
const SUBMIT_BTN_CLS = "px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors";
const PENDING_LINE_CLS = "text-[11px] text-[#6b7280] italic mt-1";

function ReadOnlyStars({ rating, size = 20 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = rating >= i + 1;
        const half = rating >= i + 0.5 && rating < i + 1;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#2D3748" />
            {filled && <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" />}
            {half && (
              <>
                <defs><clipPath id={`ros-${i}-${Math.random().toString(36).slice(2, 8)}`}><rect x="0" y="0" width="12" height="24" /></clipPath></defs>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" clipPath="inset(0 50% 0 0)" />
              </>
            )}
          </svg>
        );
      })}
    </div>
  );
}

function ClickableStars({ value, onChange, size = 28, allowHalf = false }: { value: number; onChange: (v: number) => void; size?: number; allowHalf?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const starIndex = i + 1;
        const filled = value >= starIndex;
        const half = value >= starIndex - 0.5 && value < starIndex;
        return (
          <button key={i} type="button" className="relative cursor-pointer" style={{ width: size, height: size }}
            onClick={(e) => {
              if (allowHalf) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const next = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
                onChange(value === next ? 0 : next);
              } else {
                onChange(value === starIndex ? 0 : starIndex);
              }
            }}>
            <svg className="absolute inset-0" style={{ width: size, height: size }} viewBox="0 0 24 24" fill="#2D3748" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            {filled && <svg className="absolute inset-0" style={{ width: size, height: size }} viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
            {half && (
              <svg className="absolute inset-0" style={{ width: size, height: size }} viewBox="0 0 24 24" fill="none" stroke="none">
                <defs><clipPath id={`cs-${i}-${starIndex}`}><rect x="0" y="0" width="12" height="24" /></clipPath></defs>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" clipPath={`url(#cs-${i}-${starIndex})`} />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Trait definitions (detailed evaluation) ──────────────── */

const TRAIT_CHAMPS: { key: keyof AthleteTraitRatings; label: string }[] = [
  // Character (8 original)
  { key: "leadership", label: "Leadership" },
  { key: "discipline", label: "Discipline" },
  { key: "coachability", label: "Coachabilité" },
  { key: "gameIQ", label: "Intelligence de jeu" },
  { key: "competitiveness", label: "Compétitivité" },
  { key: "teamwork", label: "Esprit d'équipe" },
  { key: "resilience", label: "Résilience" },
  { key: "attitude", label: "Attitude / Mentalité" },
  // Athletic / tactical (6 newer DB columns: vitesse_explosivite,
  // force_puissance, endurance_cardio, agilite_coordination,
  // vision_du_jeu, sens_tactique — mapped via AthleteTraitRatings).
  { key: "speed", label: "Vitesse / Explosivité" },
  { key: "power", label: "Force / Puissance" },
  { key: "endurance", label: "Endurance cardio" },
  { key: "agility", label: "Agilité / Coordination" },
  { key: "gameVision", label: "Vision du jeu" },
  { key: "tactics", label: "Sens tactique" },
];

/* ── Unified Evaluation section (simplified + detailed) ───── */

function EvaluationSuggest({ currentOverall, traitRatings, pendingSugs, onSubmit }: {
  currentOverall: number;
  traitRatings: AthleteTraitRatings | undefined;
  pendingSugs: AthleteSuggestion[];
  onSubmit: (field: string, proposed: string, message: string) => Promise<void>;
}) {
  const isDetailedMode = !!traitRatings && TRAIT_CHAMPS.some((t) => (traitRatings[t.key] || 0) > 0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overallDraft, setOverallDraft] = useState(currentOverall);
  const [traitDraft, setTraitDraft] = useState<Record<string, number>>({});

  function pendingFor(label: string): AthleteSuggestion | undefined {
    return pendingSugs.find((s) => s.field === label);
  }

  const getCurrent = (key: keyof AthleteTraitRatings) => (traitRatings ? traitRatings[key] || 0 : 0);

  const traitAvg = isDetailedMode
    ? (() => {
        const vals = TRAIT_CHAMPS.map((t) => getCurrent(t.key)).filter((v) => v > 0);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      })()
    : currentOverall;

  function startEditing() {
    setOverallDraft(currentOverall);
    const initial: Record<string, number> = {};
    for (const t of TRAIT_CHAMPS) initial[t.label] = getCurrent(t.key);
    setTraitDraft(initial);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  async function handleSubmit() {
    setSaving(true);
    if (isDetailedMode) {
      for (const t of TRAIT_CHAMPS) {
        const current = getCurrent(t.key);
        const proposed = traitDraft[t.label] ?? 0;
        if (proposed > 0 && proposed !== current) {
          await onSubmit(t.label, String(proposed), "");
        }
      }
    } else if (overallDraft > 0 && overallDraft !== currentOverall) {
      await onSubmit("Cote globale", overallDraft.toFixed(1), "");
    }
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#2D3748]/40">
      <div className="flex items-center justify-between mb-1">
        <h3 className={SECTION_LABEL_CLS}>Évaluation</h3>
        {!editing && (
          <button type="button" onClick={startEditing} className={PROPOSE_BTN_CLS}>Proposer</button>
        )}
      </div>
      {!editing && <p className={SECTION_SUBTITLE_CLS}>Modifications soumises à ton entraîneur pour approbation</p>}

      {!editing && !isDetailedMode && (
        <div className="flex items-center justify-between py-3 mt-2 border-b border-[#2D3748]/40">
          <span className="text-[13px] text-[#9CA3AF]">Cote Globale</span>
          <div className="flex items-center gap-3">
            <ReadOnlyStars rating={currentOverall} size={20} />
            <span className="text-[14px] font-bold text-white w-12 text-right">{currentOverall > 0 ? `${currentOverall.toFixed(1)}/5` : "—"}</span>
          </div>
        </div>
      )}
      {!editing && !isDetailedMode && pendingFor("Cote globale") && (
        <p className={PENDING_LINE_CLS}>⏳ En attente: {pendingFor("Cote globale")?.proposed_value}/5</p>
      )}

      {!editing && isDetailedMode && (
        <>
          <div className="flex items-center justify-between py-3 mt-2 border-b border-[#2D3748]/40">
            <span className="text-[13px] text-[#9CA3AF]">Cote Globale (moyenne)</span>
            <div className="flex items-center gap-3">
              <ReadOnlyStars rating={traitAvg} size={20} />
              <span className="text-[14px] font-bold text-white w-12 text-right">{traitAvg > 0 ? `${traitAvg.toFixed(1)}/5` : "—"}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {TRAIT_CHAMPS.map((trait) => {
              const current = getCurrent(trait.key);
              const pend = pendingFor(trait.label);
              // Hide unrated traits in the read-only view. In edit mode
              // (handled by a separate block below) we still show every
              // trait so the athlete can propose a first rating.
              if (current <= 0 && !pend) return null;
              return (
                <div key={trait.key} className="py-2 border-b border-[#2D3748]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9CA3AF]">{trait.label}</span>
                    {current > 0 ? <ReadOnlyStars rating={current} size={14} /> : <span className="text-[12px] text-[#4a4d56]">—</span>}
                  </div>
                  {pend && <p className={PENDING_LINE_CLS}>⏳ En attente: {pend.proposed_value}/5</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && !isDetailedMode && (
        <div className="mt-3">
          <div className="flex items-center justify-between py-3 border-b border-[#2D3748]/40">
            <span className="text-[13px] text-[#9CA3AF]">Cote Globale</span>
            <div className="flex items-center gap-3">
              <ClickableStars value={overallDraft} onChange={setOverallDraft} size={28} allowHalf />
              <span className="text-[14px] font-bold text-white w-12 text-right">{overallDraft > 0 ? `${overallDraft.toFixed(1)}/5` : "—"}</span>
            </div>
          </div>
        </div>
      )}

      {editing && isDetailedMode && (
        <div className="mt-3 space-y-1">
          {TRAIT_CHAMPS.map((trait) => {
            const value = traitDraft[trait.label] ?? 0;
            return (
              <div key={trait.key} className="flex items-center justify-between py-2 border-b border-[#2D3748]/30">
                <span className="text-[12px] text-[#c8c8cc]">{trait.label}</span>
                <div className="flex items-center gap-2">
                  <ClickableStars value={value} onChange={(v) => setTraitDraft((d) => ({ ...d, [trait.label]: v }))} size={20} />
                  <span className="text-[11px] font-bold text-[#9CA3AF] w-10 text-right">{value > 0 ? `${value}/5` : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="flex items-center gap-3 justify-end mt-4 pt-3 border-t border-[#2D3748]/40">
          <button type="button" onClick={cancel} className={CANCEL_BTN_CLS}>Annuler</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className={SUBMIT_BTN_CLS}>
            {saving ? "..." : "Envoyer"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Distinctions suggestion (unified pattern) ────────────── */

function DistinctionsSuggest({ currentDistinctions, pending, onSubmit }: {
  currentDistinctions: DistinctionEntry[];
  pending?: { proposed_value: string };
  onSubmit: (field: string, proposed: string, message: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<DistinctionEntry[]>(currentDistinctions);
  const [saving, setSaving] = useState(false);

  const totalCount = entries.length;
  const atMax = totalCount >= MAX_BADGES;

  function toggle(key: string) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.badge === key);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= MAX_BADGES) return prev;
      return [...prev, { badge: key }];
    });
  }

  function updateDetail(key: string, detail: string) {
    setEntries((prev) => prev.map((e) => e.badge === key ? { ...e, detail: detail || undefined } : e));
  }

  async function handleSubmit() {
    setSaving(true);
    await onSubmit("Distinctions", JSON.stringify(entries), "");
    setSaving(false);
    setEditing(false);
  }

  function startEditing() {
    setEntries(currentDistinctions);
    setEditing(true);
  }

  const hasPending = !!pending;

  return (
    <div className="mt-4 pt-4 border-t border-[#2D3748]/40">
      <div className="flex items-center justify-between mb-1">
        <h3 className={SECTION_LABEL_CLS}>Distinctions</h3>
        {!editing && (
          <button type="button" onClick={startEditing} className={PROPOSE_BTN_CLS}>Proposer</button>
        )}
      </div>
      {!editing && <p className={SECTION_SUBTITLE_CLS}>Modifications soumises à ton entraîneur pour approbation</p>}

      {!editing && currentDistinctions.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3">
          {currentDistinctions.map((e, i) => (
            <DistinctionBadge key={`${e.badge}-${i}`} badge={e.badge} detail={e.detail} count={currentDistinctions.length} index={i} />
          ))}
        </div>
      )}
      {!editing && currentDistinctions.length === 0 && (
        <p className="text-[13px] text-[#6b7280] mt-3">—</p>
      )}
      {!editing && hasPending && (
        <p className={PENDING_LINE_CLS}>⏳ En attente</p>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          {BADGE_ORDER.map((key) => {
            const cfg = BADGE_CONFIG[key];
            const entry = entries.find((e) => e.badge === key);
            const isSelected = !!entry;
            const isDisabled = !isSelected && atMax;
            return (
              <div key={key} className={`border rounded transition-colors ${isSelected ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-[#2a2d36]"} ${isDisabled ? "opacity-40" : ""}`}>
                <button type="button" onClick={() => !isDisabled && toggle(key)} disabled={isDisabled}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left">
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56]"}`}>
                    {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                  <span className={`text-[13px] font-bold ${isSelected ? "text-white" : "text-[#8a8d96]"}`}>{key === "custom" ? "Personnalisée" : cfg.label}</span>
                </button>
                {isSelected && cfg.hasDetail && (
                  <div className="px-3 pb-3 pl-10">
                    <input type="text"
                      value={entry?.detail || ""}
                      onChange={(e) => updateDetail(key, e.target.value.slice(0, MAX_DETAIL_LENGTH))}
                      maxLength={MAX_DETAIL_LENGTH}
                      placeholder={key === "custom" ? "Titre" : "Ex: Points, Buts, Passes..."}
                      className="w-full bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1.5 text-[12px] text-white focus:border-[#E63946] outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-[#6b7280]">{totalCount} / {MAX_BADGES}</p>

          <div className="flex items-center gap-3 justify-end mt-4 pt-3 border-t border-[#2D3748]/40">
            <button type="button" onClick={() => setEditing(false)} className={CANCEL_BTN_CLS}>Annuler</button>
            <button type="button" onClick={handleSubmit} disabled={saving} className={SUBMIT_BTN_CLS}>
              {saving ? "..." : "Envoyer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Trait labels ──────────────────────────────────────────────── */

const TRAIT_LABELS: Record<keyof AthleteTraitRatings, string> = {
  speed: "Vitesse / Explosivité", power: "Force / Puissance", endurance: "Endurance cardio", agility: "Agilité / Coordination",
  gameVision: "Vision du jeu", tactics: "Sens tactique",
  leadership: "Leadership", discipline: "Discipline", coachability: "Coachabilité",
  gameIQ: "Intelligence de jeu", competitiveness: "Compétitivité", teamwork: "Esprit d'équipe",
  resilience: "Résilience", attitude: "Attitude / Mentalité",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProfile = Record<string, any>;

/* ── Edit Form Components ─────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditFormProps = { raw: any; inputCls: string; lblCls: string; onSave: (u: Record<string, unknown>) => void; onCancel: () => void; saving: boolean };

function PersonalEditForm({ raw, inputCls, lblCls, onSave, onCancel, saving }: EditFormProps) {
  const [genre, setGenre] = useState(raw?.genre || "");
  const [dob, setDob] = useState(raw?.date_naissance || "");
  const [tel, setTel] = useState(raw?.telephone || "");
  return (
    <div className="space-y-3">
      <div><label className={lblCls}>Genre</label><select title="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className={inputCls}><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="X">Autre</option></select></div>
      <div><label className={lblCls}>Date de naissance</label><DatePicker value={dob} onChange={setDob} placeholder="Sélectionner une date" /></div>
      <div><label className={lblCls}>Téléphone</label><input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="514-000-0000" className={inputCls} /></div>
      <div className="flex items-center gap-3 mt-3">
        <button type="button" onClick={() => onSave({ genre: genre || null, date_naissance: dob || null, telephone: tel || null })} disabled={saving} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50">{saving ? "..." : "Enregistrer"}</button>
        <button type="button" onClick={onCancel} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
      </div>
    </div>
  );
}

function SportEditForm({ raw, inputCls, lblCls, onSave, onCancel, saving }: EditFormProps) {
  const [jersey, setJersey] = useState(raw?.numero_jersey || "");
  return (
    <div className="space-y-3">
      <div><label className={lblCls}>Numéro de jersey</label><input type="text" value={jersey} onChange={(e) => setJersey(e.target.value)} placeholder="#12" className={inputCls} /></div>
      <p className="text-[10px] text-[#4a4d56] italic">Sport principal, position, équipe et ligue sont gérés par ton coach.</p>
      <div className="flex items-center gap-3 mt-3">
        <button type="button" onClick={() => onSave({ numero_jersey: jersey || null })} disabled={saving} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50">{saving ? "..." : "Enregistrer"}</button>
        <button type="button" onClick={onCancel} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
      </div>
    </div>
  );
}

function PhysicalEditForm({ raw, inputCls, lblCls, onSave, onCancel, saving }: EditFormProps) {
  const [hf, setHf] = useState(String(raw?.taille_pieds || ""));
  const [hp, setHp] = useState(String(raw?.taille_pouces || ""));
  const [wt, setWt] = useState(String(raw?.poids_lbs || ""));
  const [ws, setWs] = useState(raw?.envergure || "");
  const [dh, setDh] = useState(raw?.main_dominante || "");
  const [df, setDf] = useState(raw?.pied_dominant || "");
  const [t40, setT40] = useState(raw?.test_40_verges || "");
  const [sv, setSv] = useState(raw?.saut_vertical || "");
  const [sl, setSl] = useState(raw?.saut_longueur || "");
  const [bp, setBp] = useState(raw?.developpe_couche || "");
  const [na, setNa] = useState(raw?.navette_agilite || "");
  const [sp, setSp] = useState(raw?.sprint_100m || "");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lblCls}>Pieds</label><select title="Pieds" value={hf} onChange={(e) => setHf(e.target.value)} className={inputCls}><option value="">—</option>{[4,5,6,7].map(v=><option key={v} value={String(v)}>{v}&apos;</option>)}</select></div>
        <div><label className={lblCls}>Pouces</label><select title="Pouces" value={hp} onChange={(e) => setHp(e.target.value)} className={inputCls}><option value="">—</option>{Array.from({length:12},(_,i)=><option key={i} value={String(i)}>{i}&quot;</option>)}</select></div>
        <div><label className={lblCls}>Poids (lbs)</label><input type="number" value={wt} onChange={(e) => setWt(e.target.value)} placeholder="185" className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lblCls}>Envergure</label><input type="text" value={ws} onChange={(e) => setWs(e.target.value)} placeholder='74"' className={inputCls} /></div>
        <div><label className={lblCls}>Main dom.</label><select title="Main dominante" value={dh} onChange={(e) => setDh(e.target.value)} className={inputCls}><option value="">—</option><option value="Droite">Droite</option><option value="Gauche">Gauche</option><option value="Ambidextre">Ambidextre</option></select></div>
        <div><label className={lblCls}>Pied dom.</label><select title="Pied dominant" value={df} onChange={(e) => setDf(e.target.value)} className={inputCls}><option value="">—</option><option value="Droit">Droit</option><option value="Gauche">Gauche</option><option value="Les deux">Les deux</option></select></div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mt-2">Tests athlétiques</p>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lblCls}>40 verges</label><input type="text" value={t40} onChange={(e) => setT40(e.target.value)} placeholder="4.65s" className={inputCls} /></div>
        <div><label className={lblCls}>Saut vertical</label><input type="text" value={sv} onChange={(e) => setSv(e.target.value)} placeholder='32"' className={inputCls} /></div>
        <div><label className={lblCls}>Saut longueur</label><input type="text" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="9'6&quot;" className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lblCls}>Bench press</label><input type="text" value={bp} onChange={(e) => setBp(e.target.value)} placeholder="225 lbs" className={inputCls} /></div>
        <div><label className={lblCls}>Navette</label><input type="text" value={na} onChange={(e) => setNa(e.target.value)} placeholder="4.35s" className={inputCls} /></div>
        <div><label className={lblCls}>Sprint 100m</label><input type="text" value={sp} onChange={(e) => setSp(e.target.value)} placeholder="11.2s" className={inputCls} /></div>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button type="button" onClick={() => onSave({
          taille_pieds: hf ? parseInt(hf) : null, taille_pouces: hp ? parseInt(hp) : null, poids_lbs: wt ? parseFloat(wt) : null,
          envergure: ws || null, main_dominante: dh || null, pied_dominant: df || null,
          test_40_verges: t40 || null, saut_vertical: sv || null, saut_longueur: sl || null,
          developpe_couche: bp || null, navette_agilite: na || null, sprint_100m: sp || null,
        })} disabled={saving} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50">{saving ? "..." : "Enregistrer"}</button>
        <button type="button" onClick={onCancel} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
      </div>
    </div>
  );
}

function AcademicEditForm({ raw, inputCls, lblCls, onSave, onCancel, saving }: EditFormProps) {
  const [gpa, setGpa] = useState(String(raw?.moyenne_generale || ""));
  const [prog, setProg] = useState((raw?.programme_cegep_vise as string[])?.join(", ") || "");
  const [subjects, setSubjects] = useState((raw?.matieres_fortes as string[])?.join(", ") || "");
  const [honors, setHonors] = useState((raw?.mentions_academiques as string[])?.join(", ") || "");
  const [prive, setPrive] = useState(raw?.ouvert_cegep_prive === true);
  const [anglo, setAnglo] = useState(raw?.ouvert_cegep_anglophone === true);
  const [relocate, setRelocate] = useState(raw?.pret_changer_region === true);
  const [regions, setRegions] = useState((raw?.regions_cegep_preferees as string[])?.join(", ") || "");
  const [bio, setBio] = useState(raw?.bio || "");

  const toggleCls = (on: boolean) => `px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${on ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748]"}`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lblCls}>Moyenne (%)</label><input type="number" value={gpa} onChange={(e) => setGpa(e.target.value)} placeholder="82" min="0" max="100" className={inputCls} /></div>
        <div><label className={lblCls}>Programme CÉGEP visé</label><input type="text" value={prog} onChange={(e) => setProg(e.target.value)} placeholder="Sciences humaines" className={inputCls} /></div>
      </div>
      <div><label className={lblCls}>Matières fortes (séparées par virgule)</label><input type="text" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Mathématiques, Éducation physique" className={inputCls} /></div>
      <div><label className={lblCls}>Mentions académiques</label><input type="text" value={honors} onChange={(e) => setHonors(e.target.value)} placeholder="Tableau d'honneur" className={inputCls} /></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPrive(!prive)} className={toggleCls(prive)}>Ouvert au privé</button>
        <button type="button" onClick={() => setAnglo(!anglo)} className={toggleCls(anglo)}>Ouvert anglophone</button>
        <button type="button" onClick={() => setRelocate(!relocate)} className={toggleCls(relocate)}>Ouvert à déménager</button>
      </div>
      {relocate && <div><label className={lblCls}>Régions préférées (séparées par virgule)</label><input type="text" value={regions} onChange={(e) => setRegions(e.target.value)} placeholder="Montréal, Québec" className={inputCls} /></div>}
      <div>
        <label className={lblCls}>Bio <span className="text-[#4a4d56] normal-case tracking-normal">({bio.length}/500)</span></label>
        <textarea value={bio} onChange={(e) => { if (e.target.value.length <= 500) setBio(e.target.value); }} rows={3} placeholder="Parle de toi, tes objectifs..." className={`${inputCls} h-auto py-2 resize-none`} />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button type="button" onClick={() => onSave({
          moyenne_generale: gpa ? parseFloat(gpa) : null,
          programme_cegep_vise: prog ? prog.split(",").map(s => s.trim()).filter(Boolean) : [],
          matieres_fortes: subjects ? subjects.split(",").map(s => s.trim()).filter(Boolean) : [],
          mentions_academiques: honors ? honors.split(",").map(s => s.trim()).filter(Boolean) : [],
          ouvert_cegep_prive: prive, ouvert_cegep_anglophone: anglo, pret_changer_region: relocate,
          regions_cegep_preferees: regions ? regions.split(",").map(s => s.trim()).filter(Boolean) : [],
          bio: bio || null,
        })} disabled={saving} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50">{saving ? "..." : "Enregistrer"}</button>
        <button type="button" onClick={onCancel} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
      </div>
    </div>
  );
}

export default function AthleteProfilPage() {
  const [loading, setLoading] = useState(true);
  const [a, setA] = useState<AnyProfile>({});
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const recruiterView = false;
  const [showPreview, setShowPreview] = useState(false);
  const [suggestions, setSuggestions] = useState<AthleteSuggestion[]>([]);
  const [sugTab, setSugTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [editableFields, setEditableFields] = useState({
    highlightVideo: "", hudl: "", youtube: "", instagram: "", fullGame: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: raw } = await supabase
        .from("athletes")
        .select(`
          *,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region, city),
          evaluations(vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination, vision_du_jeu, sens_tactique, leadership, discipline, coachabilite, intelligence_jeu, competitivite, esprit_equipe, resilience, attitude_mentalite, cote_globale, rapport_entraineur, distinctions),
          users!athletes_coach_id_fkey(first_name, last_name)
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      console.log("[Athlete Profile] loaded:", raw?.first_name, raw?.last_name);
      if (!raw) { setLoading(false); return; }

      setAthleteId(raw.id);

      // Secondary sport/position lookups
      let secondarySportName = "";
      let secondaryPositionName = "";
      if (raw.sport_secondaire_id) {
        const { data: ss } = await supabase.from("sports").select("nom").eq("id", raw.sport_secondaire_id).maybeSingle();
        secondarySportName = ss?.nom || "";
      }
      if (raw.position_secondaire_id) {
        const { data: sp } = await supabase.from("positions").select("nom").eq("id", raw.position_secondaire_id).maybeSingle();
        secondaryPositionName = sp?.nom || "";
      }

      const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
      const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
      const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
      const evalRel = Array.isArray(raw.evaluations) ? raw.evaluations[0] : raw.evaluations;
      const coachRel = Array.isArray(raw.users) ? raw.users[0] : raw.users;

      const heightFt = raw.taille_pieds;
      const heightIn = raw.taille_pouces;
      const heightDisplay = heightFt ? `${heightFt}'${heightIn || 0}"` : "";
      const weightDisplay = raw.poids_lbs ? `${raw.poids_lbs} lbs` : "";

      // Age from date_naissance
      let age = 0;
      if (raw.date_naissance) {
        const bd = new Date(raw.date_naissance);
        const now = new Date();
        age = now.getFullYear() - bd.getFullYear();
        if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
      }

      // Trait ratings
      const traitRatings: AthleteTraitRatings | undefined = evalRel ? {
        speed: evalRel.vitesse_explosivite || 0,
        power: evalRel.force_puissance || 0,
        endurance: evalRel.endurance_cardio || 0,
        agility: evalRel.agilite_coordination || 0,
        gameVision: evalRel.vision_du_jeu || 0,
        tactics: evalRel.sens_tactique || 0,
        leadership: evalRel.leadership || 0,
        discipline: evalRel.discipline || 0,
        coachability: evalRel.coachabilite || 0,
        gameIQ: evalRel.intelligence_jeu || 0,
        competitiveness: evalRel.competitivite || 0,
        teamwork: evalRel.esprit_equipe || 0,
        resilience: evalRel.resilience || 0,
        attitude: evalRel.attitude_mentalite || 0,
      } : undefined;

      // Profile completion
      const profileCompleteness = calculateProfileCompletion(raw);

      const mapped: AnyProfile = {
        id: raw.id,
        firstName: raw.first_name || "",
        lastName: raw.last_name || "",
        isVerified: raw.verified === true,
        profileCompleteness,
        primarySport: sportRel?.nom || "",
        primaryPosition: posRel?.nom || posRel?.abreviation || "",
        secondarySport: secondarySportName,
        secondaryPosition: secondaryPositionName,
        schoolName: schoolRel?.name || "",
        city: schoolRel?.city || "",
        region: schoolRel?.region || "",
        graduationYear: raw.annee_diplomation || "",
        age,
        gender: raw.genre || "",
        telephone: raw.telephone || "",
        jerseyNumber: raw.numero_jersey || "",
        teamName: "",
        leagueName: "",
        heightDisplay,
        weightDisplay,
        wingspan: raw.envergure || "",
        handSize: raw.taille_mains || "",
        dominantHand: raw.main_dominante || "",
        dominantFoot: raw.pied_dominant || "",
        fortyYard: raw.test_40_verges || "",
        verticalJump: raw.saut_vertical || "",
        broadJump: raw.saut_longueur || "",
        benchPress: raw.developpe_couche || "",
        shuttleAgility: raw.navette_agilite || "",
        sprint100m: raw.sprint_100m || "",
        gpa: raw.moyenne_generale,
        targetCegepProgram: raw.programme_cegep_vise || [],
        strongSubjects: raw.matieres_fortes || [],
        academicHonors: raw.mentions_academiques || [],
        openToRelocate: raw.pret_changer_region,
        openToPrivate: raw.ouvert_cegep_prive,
        openToAnglophone: raw.ouvert_cegep_anglophone,
        wantsDEC: undefined,
        preferredRegions: raw.regions_cegep_preferees || [],
        coachReport: evalRel?.rapport_entraineur || "",
        coachName: coachRel ? `${coachRel.first_name || ""} ${coachRel.last_name || ""}`.trim() : "",
        overallRating: evalRel?.cote_globale || 0,
        coachDistinctions: parseDistinctions(evalRel?.distinctions),
        traitRatings,
        highlightVideoUrl: raw.video_faits_saillants_url || "",
        hudlUrl: raw.hudl_url || "",
        youtubeUrl: raw.youtube_url || "",
        instagramUrl: raw.instagram_url || "",
        fullGameUrl: raw.video_match_complet_url || "",
        photoUrl: raw.photo_url || "",
        _raw: raw,
      };

      setA(mapped);
      setEditableFields({
        highlightVideo: mapped.highlightVideoUrl || "",
        hudl: mapped.hudlUrl || "",
        youtube: mapped.youtubeUrl || "",
        instagram: mapped.instagramUrl || "",
        fullGame: mapped.fullGameUrl || "",
      });
      // Load existing suggestions
      if (raw.id) {
        const { data: sugs } = await supabase
          .from("athlete_suggestions")
          .select("id, champ, valeur_actuelle, valeur_proposee, status, message, raison_rejet, created_at")
          .eq("athlete_id", raw.id)
          .order("created_at", { ascending: false });
        if (sugs) {
          const STATUS_MAP: Record<string, string> = { EN_ATTENTE: "pending", APPROUVEE: "approved", REJETEE: "rejected" };
          setSuggestions(sugs.map((s) => ({
            id: s.id,
            field: s.champ,
            current_value: s.valeur_actuelle,
            proposed_value: s.valeur_proposee,
            message: s.message || "",
            status: (STATUS_MAP[s.status] || "pending") as "pending" | "approved" | "rejected",
            submitted_at: s.created_at,
            rejection_reason: s.raison_rejet || undefined,
          })));
        }
      }

      setLoading(false);
    }
    load();
  }, []);

  // Re-fetch helper for after saves
  async function reloadProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: raw } = await supabase.from("athletes").select("*, sports!sport_id(nom), positions!position_id(nom, abreviation), schools!school_id(name, region, city), evaluations(vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination, vision_du_jeu, sens_tactique, leadership, discipline, coachabilite, intelligence_jeu, competitivite, esprit_equipe, resilience, attitude_mentalite, cote_globale, rapport_entraineur, distinctions), users!athletes_coach_id_fkey(first_name, last_name)").eq("user_id", user.id).maybeSingle();
    if (!raw) return;
    // Re-run the same mapping (simplified — just update key display fields)
    const sportRel = Array.isArray(raw.sports) ? raw.sports[0] : raw.sports;
    const posRel = Array.isArray(raw.positions) ? raw.positions[0] : raw.positions;
    const schoolRel = Array.isArray(raw.schools) ? raw.schools[0] : raw.schools;
    const evalRel = Array.isArray(raw.evaluations) ? raw.evaluations[0] : raw.evaluations;
    const coachRel = Array.isArray(raw.users) ? raw.users[0] : raw.users;
    const heightDisplay = raw.taille_pieds ? `${raw.taille_pieds}'${raw.taille_pouces || 0}"` : "";
    const weightDisplay = raw.poids_lbs ? `${raw.poids_lbs} lbs` : "";
    let age = 0;
    if (raw.date_naissance) { const bd = new Date(raw.date_naissance); const now = new Date(); age = now.getFullYear() - bd.getFullYear(); if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--; }
    const profileCompleteness = calculateProfileCompletion(raw);
    const traitRatings = evalRel ? {
      speed: evalRel.vitesse_explosivite || 0,
      power: evalRel.force_puissance || 0,
      endurance: evalRel.endurance_cardio || 0,
      agility: evalRel.agilite_coordination || 0,
      gameVision: evalRel.vision_du_jeu || 0,
      tactics: evalRel.sens_tactique || 0,
      leadership: evalRel.leadership || 0,
      discipline: evalRel.discipline || 0,
      coachability: evalRel.coachabilite || 0,
      gameIQ: evalRel.intelligence_jeu || 0,
      competitiveness: evalRel.competitivite || 0,
      teamwork: evalRel.esprit_equipe || 0,
      resilience: evalRel.resilience || 0,
      attitude: evalRel.attitude_mentalite || 0,
    } : undefined;
    setA({
      ...a,
      firstName: raw.first_name||"", lastName: raw.last_name||"", isVerified: raw.verified===true, profileCompleteness,
      primarySport: sportRel?.nom||"", primaryPosition: posRel?.nom||posRel?.abreviation||"",
      schoolName: schoolRel?.name||"", city: schoolRel?.city||"", region: schoolRel?.region||"",
      graduationYear: raw.annee_diplomation||"", age, gender: raw.genre||"", telephone: raw.telephone||"", jerseyNumber: raw.numero_jersey||"",
      heightDisplay, weightDisplay, wingspan: raw.envergure||"", handSize: raw.taille_mains||"",
      dominantHand: raw.main_dominante||"", dominantFoot: raw.pied_dominant||"",
      fortyYard: raw.test_40_verges||"", verticalJump: raw.saut_vertical||"", broadJump: raw.saut_longueur||"",
      benchPress: raw.developpe_couche||"", shuttleAgility: raw.navette_agilite||"", sprint100m: raw.sprint_100m||"",
      gpa: raw.moyenne_generale, targetCegepProgram: raw.programme_cegep_vise||[],
      strongSubjects: raw.matieres_fortes||[], academicHonors: raw.mentions_academiques||[],
      openToRelocate: raw.pret_changer_region, openToPrivate: raw.ouvert_cegep_prive, openToAnglophone: raw.ouvert_cegep_anglophone,
      preferredRegions: raw.regions_cegep_preferees||[], bio: raw.bio||"",
      coachReport: evalRel?.rapport_entraineur||"", coachName: coachRel ? `${coachRel.first_name||""} ${coachRel.last_name||""}`.trim() : "",
      overallRating: evalRel?.cote_globale||0, traitRatings,
      highlightVideoUrl: raw.video_faits_saillants_url||"", hudlUrl: raw.hudl_url||"", youtubeUrl: raw.youtube_url||"",
      instagramUrl: raw.instagram_url||"", fullGameUrl: raw.video_match_complet_url||"", photoUrl: raw.photo_url||"",
      // Raw values for edit forms
      _raw: raw,
    });
  }

  const [editSection, setEditSection] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  async function saveSection(updates: Record<string, unknown>) {
    if (!athleteId) return;
    setEditSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("athletes").update(updates).eq("id", athleteId);
    if (error) { console.error("[Profile save]", error); setEditSaving(false); return; }
    // Recalculate and persist profile_completion
    const { data: freshRow } = await supabase.from("athletes").select("*").eq("id", athleteId).single();
    if (freshRow) {
      const completion = calculateProfileCompletion(freshRow);
      await supabase.from("athletes").update({ profile_completion: completion }).eq("id", athleteId);
    }
    await reloadProfile();
    setEditSection(null);
    setEditSaving(false);
    showToast("Profil mis à jour!");
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const inputCls = "w-full h-10 px-3 bg-[#111317] border border-[#2D3748] rounded-lg text-[13px] text-white placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
  const lblCls = "text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mb-1 block";

  function SectionHeader({ title, sectionKey, mode = "direct" }: { title: string; sectionKey: string; mode?: "direct" | "suggestion" }) {
    const isDirect = mode === "direct";
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{title}</h3>
          {editSection !== sectionKey && (
            <button type="button" onClick={() => setEditSection(sectionKey)}
              className="px-4 py-2 border border-[#E63946] text-[#E63946] rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors">
              {isDirect ? "Modifier" : "Proposer"}
            </button>
          )}
        </div>
        {!isDirect && editSection !== sectionKey && (
          <p className="text-[12px] text-[#6b7280] mt-1">Modifications soumises à ton entraîneur pour approbation</p>
        )}
      </div>
    );
  }

  function EditButtons({ sectionKey, onSave }: { sectionKey: string; onSave: () => void }) {
    return (
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#2D3748]/40">
        <button type="button" onClick={onSave} disabled={editSaving} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50">
          {editSaving ? "..." : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setEditSection(null)} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Annuler</button>
      </div>
    );
  }

  const saveField = async (key: string, value: string) => {
    setEditableFields((prev) => ({ ...prev, [key]: value }));
    if (athleteId) {
      const supabase = createClient();
      const dbMap: Record<string, string> = {
        highlightVideo: "video_faits_saillants_url", hudl: "hudl_url",
        youtube: "youtube_url", instagram: "instagram_url", fullGame: "video_match_complet_url",
      };
      const col = dbMap[key];
      if (col) await supabase.from("athletes").update({ [col]: value || null }).eq("id", athleteId);
    }
    showToast("Mis à jour!");
  };

  const submitSuggestion = async (field: string, proposed: string, message: string) => {
    if (!athleteId) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the current value for this field from the raw athlete data
    const fieldMap: Record<string, string> = {
      "Taille": "taille_pieds", "Poids": "poids_lbs", "Envergure": "envergure",
      "Taille mains": "taille_mains", "Main dominante": "main_dominante", "Pied dominant": "pied_dominant",
      "40 yards": "test_40_verges", "Saut vertical": "saut_vertical", "Saut longueur": "saut_longueur",
      "Développé couché": "developpe_couche", "Navette": "navette_agilite", "Sprint 100m": "sprint_100m",
      "Sport principal": "sport_id", "Position": "position_id", "Sport secondaire": "sport_secondaire_id",
      "Position secondaire": "position_secondaire_id", "Numéro": "numero_jersey",
    };
    const dbField = fieldMap[field] || field;
    const currentVal = a._raw ? String(a._raw[dbField] || "") : "";

    // Look up coach_id from athlete record
    let coachId: string | null = a._raw?.coach_id || null;
    if (!coachId && athleteId) {
      const { data: athRow } = await supabase.from("athletes").select("coach_id").eq("id", athleteId).single();
      coachId = athRow?.coach_id || null;
    }

    const { data: inserted, error } = await supabase.from("athlete_suggestions").insert({
      athlete_id: athleteId,
      submitted_by: user.id,
      coach_id: coachId,
      champ: field,
      valeur_actuelle: currentVal,
      valeur_proposee: proposed,
      status: "EN_ATTENTE",
      message: message || null,
    }).select("id, champ, valeur_actuelle, valeur_proposee, status, message, created_at").single();

    if (error) { console.error("[Suggestion] insert error:", JSON.stringify(error), error.message, error.code, error.details); showToast("Erreur lors de l'envoi"); return; }

    console.log("[Suggestion] saved:", inserted);

    // Add to local state for immediate UI update
    const newSug: AthleteSuggestion = {
      id: inserted.id, field, current_value: currentVal, proposed_value: proposed,
      message, status: "pending", submitted_at: inserted.created_at,
    };
    setSuggestions((prev) => [newSug, ...prev]);
    showToast("Suggestion envoyée à ton coach");
  };

  const pendingSugs = suggestions.filter((s) => s.status === "pending");
  const approvedSugs = suggestions.filter((s) => s.status === "approved");
  const rejectedSugs = suggestions.filter((s) => s.status === "rejected");

  const getPending = (field: string) => pendingSugs.find((s) => s.field === field);

  const traitEntries = a.traitRatings ? Object.entries(a.traitRatings) as [keyof AthleteTraitRatings, number][] : [];
  const traitAvg = traitEntries.length > 0 ? traitEntries.reduce((s, [, v]) => s + v, 0) / traitEntries.length : (a.overallRating || 0);
  // Compute completion via shared util (richer: sections + evaluation signals)
  const _rawEval = a._raw?.evaluations;
  const _evalRow = Array.isArray(_rawEval) ? _rawEval[0] : _rawEval;
  const completionResult = a._raw
    ? calculateCompletionForRole(a._raw, _evalRow || null, null, "athlete")
    : { percentage: 0, missing: [], checks: [] };
  const pctValue = completionResult.percentage;
  const missingTop = completionResult.missing.slice(0, 6);
  if (typeof window !== "undefined") {
    console.log("Completion check:", {
      percentage: pctValue,
      missing: completionResult.missing,
      totalChecks: completionResult.checks.length,
    });
  }
  const encouragement =
    pctValue === 100 ? "Profil complet — bravo !" :
    pctValue >= 90 ? `Profil complété à ${pctValue}% — presque parfait !` :
    pctValue >= 70 ? `Profil complété à ${pctValue}% — continue comme ça !` :
    pctValue >= 50 ? `Profil complété à ${pctValue}% — bon début !` :
    `Profil complété à ${pctValue}% — complète ton profil pour attirer les recruteurs`;
  void getIncompleteFields;

  // Monthly re-validation banner
  const validationPair = { verified: a._raw?.verified === true, last_profile_validation: a._raw?.last_profile_validation };
  const needsValidation = isValidationDue(validationPair);
  const validationExpired = isValidationExpired(validationPair);

  // One-shot: log a notification the first time we detect expired state this month.
  useEffect(() => {
    if (!athleteId || !validationExpired) return;
    const month = currentMonthKey();
    (async () => {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("athlete_notifications")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("type", "PROFILE_TIP")
        .contains("metadata", { kind: "monthly_validation_expired", month })
        .maybeSingle();
      if (existing) return;
      await supabase.from("athlete_notifications").insert({
        athlete_id: athleteId,
        type: "PROFILE_TIP",
        title: "⚠️ Ton badge vérifié a été désactivé",
        message: "Confirme tes informations pour le réactiver.",
        metadata: { kind: "monthly_validation_expired", month },
      });
    })();
  }, [athleteId, validationExpired]);

  async function confirmValidation() {
    if (!athleteId) return;
    setConfirming(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("athletes")
      .update({ last_profile_validation: new Date().toISOString() })
      .eq("id", athleteId);
    if (error) { console.error("[Validation confirm]", error); setConfirming(false); return; }
    await supabase.from("athlete_notifications").insert({
      athlete_id: athleteId,
      type: "PROFILE_TIP",
      title: "Tes informations ont été confirmées pour ce mois.",
      metadata: { kind: "monthly_validation_confirmed", month: currentMonthKey() },
    });
    await reloadProfile();
    setConfirming(false);
    showToast("Informations confirmées!");
  }

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-5">

      {/* ── Monthly re-validation banner ──────────────────────── */}
      {!recruiterView && needsValidation && (
        <div className={`rounded-xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${validationExpired ? "bg-[#E63946]/10 border-[#E63946]/30" : "bg-[#F59E0B]/10 border-[#F59E0B]/30"}`}>
          <div className="flex items-start gap-3 flex-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={validationExpired ? "#E63946" : "#F59E0B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className={`text-[14px] font-bold ${validationExpired ? "text-[#E63946]" : "text-[#F59E0B]"}`}>
                {validationExpired ? "Profil non confirmé — ton badge vérifié est désactivé" : "Confirmation mensuelle requise"}
              </p>
              <p className="text-[13px] text-[#9CA3AF] mt-0.5">
                {validationExpired
                  ? "Confirme tes informations pour réactiver ton badge."
                  : `Confirme que tes informations sont toujours à jour avant le ${formatDeadlineFr()}.`}
              </p>
            </div>
          </div>
          <button type="button" onClick={confirmValidation} disabled={confirming}
            className="px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider bg-[#E63946] hover:bg-[#D42B22] text-white transition-colors disabled:opacity-50 shrink-0">
            {confirming ? "..." : "Confirmer mes informations"}
          </button>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Mon profil</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">C&apos;est ce que les recruteurs voient quand ils consultent ton profil</p>
        </div>
        <button type="button" onClick={() => setShowPreview(true)}
          className="px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] transition-colors flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          Aperçu recruteur
        </button>
      </div>

      {/* Slide-out preview panel */}
      {showPreview && athleteId && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowPreview(false)} />
          <div className="fixed top-0 right-0 h-full w-full md:w-[85vw] max-w-[1400px] z-50 bg-[#111317] overflow-hidden shadow-2xl flex flex-col animate-[slideInRight_0.3s_ease-out]">
            <div className="sticky top-0 z-10 bg-[#111317] border-b border-[#2a2d36] px-6 py-3 flex items-center justify-between shrink-0">
              <button type="button" onClick={() => setShowPreview(false)}
                className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#E63946] hover:text-[#ff4d5a] transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                Retour à mon profil
              </button>
              <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Aperçu recruteur</span>
            </div>
            <iframe
              src={`/recruteur/athletes/${athleteId}?preview=true`}
              title="Aperçu recruteur"
              className="flex-1 w-full border-0 bg-[#111317]"
            />
          </div>
        </>
      )}

      {/* Pending suggestions banner */}
      {!recruiterView && pendingSugs.length > 0 && (
        <div className="bg-[#1A1D24] border-l-4 border-[#E63946] rounded-r-xl px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] text-[#E63946] font-bold">{pendingSugs.length} suggestion{pendingSugs.length > 1 ? "s" : ""} en attente d&apos;approbation par ton coach</span>
          <button type="button" onClick={() => { const el = document.getElementById("suggestions-section"); el?.scrollIntoView({ behavior: "smooth" }); }} className="text-[12px] font-bold text-[#E63946] hover:text-white transition-colors">
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
              <div className="relative group shrink-0">
                {a.photoUrl ? (
                  <img src={a.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#2D3748]" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#2F3440] border border-[#2D3748] flex items-center justify-center">
                    <span className="text-[20px] font-head font-black text-white/15">{(a.firstName || "")[0]}{(a.lastName || "")[0]}</span>
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  <input type="file" accept="image/*" className="hidden" title="Photo" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f || !athleteId) return;
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
                    const path = `athletes/${user.id}/${Date.now()}.${f.name.split(".").pop()}`;
                    const { error: uploadError } = await supabase.storage.from("Ath Photos").upload(path, f, { upsert: true });
                    if (uploadError) {
                      console.error("[Photo upload]", uploadError);
                      showToast("Erreur lors de l'upload");
                      return;
                    }
                    const { data: urlData } = supabase.storage.from("Ath Photos").getPublicUrl(path);
                    await supabase.from("athletes").update({ photo_url: urlData.publicUrl }).eq("id", athleteId);
                    setA((prev: AnyProfile) => ({ ...prev, photoUrl: urlData.publicUrl }));
                    showToast("Photo mise à jour!");
                  }} />
                </label>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-head text-[20px] font-black text-white uppercase tracking-tight">{a.firstName} {a.lastName}</h2>
                  {a.isVerified && !isValidationExpired({ verified: a.isVerified, last_profile_validation: a._raw?.last_profile_validation }) ? (
                    <VerifiedBadge verified={a.isVerified} lastValidation={a._raw?.last_profile_validation} size={20} />
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4a4d56]/20 border border-[#4a4d56]/30 text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">
                      <VerifiedBadge verified={false} size={12} />
                      {a.isVerified ? "Badge désactivé" : "Non vérifié"}
                    </span>
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

          {/* ═══ PERSONAL INFO ═══ */}
          <div id={SECTION_IDS.identity} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <SectionHeader title="Informations personnelles" sectionKey="personal" mode="direct" />
            {editSection === "personal" ? (
              <PersonalEditForm raw={a._raw} inputCls={inputCls} lblCls={lblCls} onSave={(u) => saveSection(u)} onCancel={() => setEditSection(null)} saving={editSaving} />
            ) : (
              <>
                <LockedField label="Âge" value={a.age ? `${a.age} ans` : null} recruiterView={recruiterView} />
                <LockedField label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : a.gender === "X" ? "Autre" : null} recruiterView={recruiterView} />
                <LockedField label="Ville" value={a.city} recruiterView={recruiterView} />
                <LockedField label="Région" value={a.region} recruiterView={recruiterView} />
                <LockedField label="École" value={a.schoolName} recruiterView={recruiterView} />
                <LockedField label="Graduation" value={a.graduationYear ? String(a.graduationYear) : null} recruiterView={recruiterView} />
                <LockedField label="Téléphone" value={a.telephone} recruiterView={recruiterView} />
              </>
            )}
          </div>

          {/* ═══ SPORT INFO ═══ */}
          <div id={SECTION_IDS.sport} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <SectionHeader title="Informations sportives" sectionKey="sport" mode="suggestion" />
            {editSection === "sport" ? (
              <div className="space-y-1">
                <SuggestibleField label="Sport principal" value={a.primarySport || "—"} fieldKey="Sport principal" pending={getPending("Sport principal")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Position principale" value={a.primaryPosition || "—"} fieldKey="Position" pending={getPending("Position")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Sport secondaire" value={a.secondarySport || "—"} fieldKey="Sport secondaire" pending={getPending("Sport secondaire")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Position secondaire" value={a.secondaryPosition || "—"} fieldKey="Position secondaire" pending={getPending("Position secondaire")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Numéro" value={a.jerseyNumber ? `#${a.jerseyNumber}` : "—"} fieldKey="Numéro" pending={getPending("Numéro")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <div className="pt-2"><button type="button" onClick={() => setEditSection(null)} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Fermer</button></div>
              </div>
            ) : (
              <>
                <LockedField label="Sport principal" value={a.primarySport} recruiterView={recruiterView} />
                <LockedField label="Position principale" value={a.primaryPosition} recruiterView={recruiterView} />
                {a.secondarySport && <LockedField label="Sport secondaire" value={a.secondarySport} recruiterView={recruiterView} />}
                {a.secondaryPosition && <LockedField label="Position secondaire" value={a.secondaryPosition} recruiterView={recruiterView} />}
                <LockedField label="Numéro" value={a.jerseyNumber ? `#${a.jerseyNumber}` : null} recruiterView={recruiterView} />
              </>
            )}
          </div>

          {/* ═══ PHYSICAL + TESTS ═══ */}
          <div id={SECTION_IDS.physical} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <SectionHeader title="Profil physique & Tests" sectionKey="physical" mode="suggestion" />
            {editSection === "physical" ? (
              <div className="space-y-1">
                <SuggestibleField label="Taille" value={a.heightDisplay || "—"} fieldKey="Taille" pending={getPending("Taille")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Poids" value={a.weightDisplay || "—"} fieldKey="Poids" pending={getPending("Poids")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Envergure" value={a.wingspan || "—"} fieldKey="Envergure" pending={getPending("Envergure")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Main dominante" value={a.dominantHand || "—"} fieldKey="Main dominante" pending={getPending("Main dominante")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <SuggestibleField label="Pied dominant" value={a.dominantFoot || "—"} fieldKey="Pied dominant" pending={getPending("Pied dominant")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                <div className="mt-3 pt-3 border-t border-[#2D3748]/40">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Tests athlétiques</h4>
                  <SuggestibleField label="40 verges" value={a.fortyYard || "—"} fieldKey="40 yards" pending={getPending("40 yards")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                  <SuggestibleField label="Saut vertical" value={a.verticalJump || "—"} fieldKey="Saut vertical" pending={getPending("Saut vertical")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                  <SuggestibleField label="Saut en longueur" value={a.broadJump || "—"} fieldKey="Saut longueur" pending={getPending("Saut longueur")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                  <SuggestibleField label="Développé couché" value={a.benchPress || "—"} fieldKey="Développé couché" pending={getPending("Développé couché")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                  <SuggestibleField label="Navette" value={a.shuttleAgility || "—"} fieldKey="Navette" pending={getPending("Navette")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                  <SuggestibleField label="Sprint 100m" value={a.sprint100m || "—"} fieldKey="Sprint 100m" pending={getPending("Sprint 100m")} onSubmit={submitSuggestion} recruiterView={recruiterView} />
                </div>
                <div className="pt-2"><button type="button" onClick={() => setEditSection(null)} className="text-[12px] text-[#6b7280] hover:text-white transition-colors">Fermer</button></div>
              </div>
            ) : (
              <>
                <LockedField label="Taille" value={a.heightDisplay} recruiterView={recruiterView} />
                <LockedField label="Poids" value={a.weightDisplay} recruiterView={recruiterView} />
                <LockedField label="Envergure" value={a.wingspan} recruiterView={recruiterView} />
                <LockedField label="Main dominante" value={a.dominantHand} recruiterView={recruiterView} />
                <LockedField label="Pied dominant" value={a.dominantFoot} recruiterView={recruiterView} />
                {(a.fortyYard || a.verticalJump || a.broadJump || a.benchPress || a.shuttleAgility || a.sprint100m) && (
                  <div className="mt-3 pt-3 border-t border-[#2D3748]/40">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Tests athlétiques</h4>
                    <LockedField label="40 verges" value={a.fortyYard} recruiterView={recruiterView} />
                    <LockedField label="Saut vertical" value={a.verticalJump} recruiterView={recruiterView} />
                    <LockedField label="Saut en longueur" value={a.broadJump} recruiterView={recruiterView} />
                    <LockedField label="Développé couché" value={a.benchPress} recruiterView={recruiterView} />
                    <LockedField label="Navette" value={a.shuttleAgility} recruiterView={recruiterView} />
                    <LockedField label="Sprint 100m" value={a.sprint100m} recruiterView={recruiterView} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* ═══ ACADEMIC ═══ */}
          <div id={SECTION_IDS.academic} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <SectionHeader title="Profil académique" sectionKey="academic" mode="direct" />
            {editSection === "academic" ? (
              <AcademicEditForm raw={a._raw} inputCls={inputCls} lblCls={lblCls} onSave={(u) => saveSection(u)} onCancel={() => setEditSection(null)} saving={editSaving} />
            ) : (
              <>
                <LockedField label="Moyenne générale" value={a.gpa ? `${a.gpa}%` : null} recruiterView={recruiterView} />
                <LockedField label="Programme visé" value={a.targetCegepProgram?.join(", ")} recruiterView={recruiterView} />

            {/* Strong subjects — EDITABLE (green) */}
            {a.strongSubjects.length > 0 && (
              <div className="py-2.5 border-b border-[#2D3748]/40">
                <span className="text-[13px] text-[#9CA3AF] flex items-center gap-1.5">
                  <PencilIcon color={GREEN} size={12} />
                  Matières fortes
                </span>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {(a.strongSubjects as string[]).map((s: string) => (
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
                  {(a.academicHonors as string[]).map((h: string) => (
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
                  { label: "Ouvert à déménager", active: !!a.openToRelocate },
                  { label: "Ouvert au privé", active: !!a.openToPrivate },
                  { label: "Ouvert anglophone", active: !!a.openToAnglophone },
                ].map((p) => (
                  <span key={p.label} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.06] text-white">
                    <span className={`w-2 h-2 rounded-full ${p.active ? "bg-[#22C55E]" : "bg-[#6B7280]"}`} />
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
                  {(a.preferredRegions as string[]).map((r: string) => (
                    <span key={r} className="px-2.5 py-1 rounded-full bg-[#2D3748]/50 text-[11px] text-[#9CA3AF]">{r}</span>
                  ))}
                </div>
              </div>
            )}
            </>
            )}
          </div>

          {/* Coach Report — rapport stays locked, Cote + Distinctions are suggestible */}
          <div id={SECTION_IDS.evaluation} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
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

            {/* Evaluation — recruiter view (read-only) vs athlete (unified suggestion pattern) */}
            {recruiterView ? (
              <>
                <div className="py-2.5 border-b border-[#2D3748]/40 flex items-center justify-between">
                  <span className="text-[13px] text-[#9CA3AF]">Cote Globale</span>
                  <div className="flex items-center gap-2">
                    <StarRating rating={traitAvg} size="md" showNumber={false} />
                    <span className="text-[16px] font-head font-black text-white">{traitAvg.toFixed(1)}/5</span>
                  </div>
                </div>
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
              </>
            ) : (
              <EvaluationSuggest
                currentOverall={a.overallRating || 0}
                traitRatings={a.traitRatings}
                pendingSugs={pendingSugs}
                onSubmit={submitSuggestion}
              />
            )}

            {/* Distinctions — suggestible */}
            {!recruiterView && (
              <DistinctionsSuggest
                currentDistinctions={((a as unknown) as { coachDistinctions?: DistinctionEntry[] }).coachDistinctions || []}
                pending={getPending("Distinctions")}
                onSubmit={submitSuggestion}
              />
            )}
          </div>

          {/* Media — GREEN (editable) */}
          <div id={SECTION_IDS.media} className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
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
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={pctColor(pctValue)} strokeWidth="3"
                      strokeDasharray={`${pctValue}, 100`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-head text-[20px] font-black" style={{ color: pctColor(pctValue) }}>{pctValue}%</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Complétion du profil</p>

              <p className="text-center text-[12px] text-[#6b7280] mb-3">{encouragement}</p>

              {missingTop.length > 0 && (
                <ul className="space-y-2.5">
                  {missingTop.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(SECTION_IDS[item.section]);
                          el?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="w-full flex items-center gap-2.5 text-[12px] text-left hover:bg-[#2D3748]/30 rounded px-1.5 py-1 transition-colors"
                      >
                        <span className="text-[#22C55E] font-bold shrink-0">+{item.weight}%</span>
                        <span className="text-[#9CA3AF] flex-1 truncate">— {item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
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
