"use client";

/* ═══════════════════════════════════════════════════════════════
   Wizard row primitives — extracted byte-for-byte from
   AthleteWizardMobile.tsx (Sprint A : pure refactor, no behavior
   changes).

   Originally private file-locals inside AthleteWizardMobile.tsx ;
   lifted here so the upcoming athlete editor can mount the same
   visual canon without re-implementing the kit. The coach wizard
   imports them back as-is.

   Verified by the Sprint-A audit : zero of these primitives read
   wizard component state (no form / slide / setter / render-scope
   closures). All inputs flow through props, all outputs through
   callbacks. The lift is a pure namespace shuffle.

   The 9 primitives :
     Card · InlineEditRow · PickerRow · DateRow · ReadOnlyRow ·
     ToggleRow · ChipsBlock · TagInputRow · MediaUrlRow

   Plus the shared helper component :
     DetailedTag (small uppercase grey "Détaillé" pill rendered
     next to a field label when detailed=true).

   The label/value typography tokens (`labelCls`, `valueCls`) live
   in ./tokens for callers that want to match the typography on
   their own custom rows without pulling the whole rows module.

   ⚠️ DO NOT add new behavior here without first updating the
   audit. This module's contract is "what the coach wizard had,
   exposed as a shared kit." Athlete-specific affordances belong
   on the athlete editor side (parent), not in these primitives.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { labelCls, valueCls } from "./tokens";

/* ── DetailedTag — small uppercase grey pill rendered next to a
      field label when detailed=true on one of the rows. */
export function DetailedTag() {
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] bg-white/[0.08]">
      Détaillé
    </span>
  );
}

/* ── Card — dark rounded #1A1D24 container grouping rows. */
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1A1D24] rounded-[14px] border border-white/[0.06] overflow-hidden">
      {children}
    </div>
  );
}

/* ── InlineEditRow — tap-to-edit text row, label LEFT, value RIGHT.
      Esc cancels, Enter commits, blur commits.

      Numeric keyboard hint : `numericMode` (optional) forces
      inputMode to "numeric" or "decimal" so mobile shows the right
      keypad. It applies REGARDLESS of `type` so unit-suffixed
      text fields (`6'4"`, `4.72s`, `225 × 8`) keep their free-text
      semantics while still getting the numeric keyboard on mobile —
      switching them to type="number" would reject the suffix and
      break the saved value shape. For pure-number fields (Numéro,
      GPA), pass type="number" alongside ; the type drives HTML
      validation, numericMode drives the keyboard hint.
      `pattern="[0-9]*"` is added on iOS for "numeric" mode only
      (skip on "decimal" — pattern would block the dot). */
export function InlineEditRow({
  label, value, onSave, placeholder, type = "text", detailed, numericMode,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url" | "number";
  /** Kept in signature for backwards-compat; per-field asterisk removed — section carries it. */
  required?: boolean;
  detailed?: boolean;
  /** Numeric keypad hint (mobile). Applies REGARDLESS of `type` so
   *  unit-suffixed text fields can still surface the numeric keypad
   *  without switching to type="number" (which would reject suffixes
   *  like `"`, `s`, `×`). For pure-number fields, pair with
   *  type="number". Omit to keep the existing text/email/url/tel
   *  keyboard behavior. */
  numericMode?: "numeric" | "decimal";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const showAdd = !value;
  const commit = () => { onSave(draft); setEditing(false); };

  /* numericMode wins when set — drives the mobile keypad. When unset,
     fall back to the per-type defaults that existed pre-A2 (tel/email/
     url/number → matching inputMode, text → undefined). Text fields
     that pass numericMode get the numeric keypad without losing their
     free-text input semantics. */
  const resolvedInputMode =
    numericMode != null ? numericMode
    : type === "number" ? "numeric"
    : type === "tel" ? "tel"
    : type === "email" ? "email"
    : type === "url" ? "url"
    : undefined;
  /* iOS-only legacy hint : pattern="[0-9]*" reinforces the numeric
     keypad for integer fields. Skip it on "decimal" so the dot
     stays available. */
  const iosNumericPattern = numericMode === "numeric" ? "[0-9]*" : undefined;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <span className={labelCls}>{label}</span>
        {detailed && <DetailedTag />}
      </div>
      {editing ? (
        <input type={type} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          inputMode={resolvedInputMode}
          pattern={iosNumericPattern}
          autoFocus
          aria-label={label}
          placeholder={placeholder}
          className="bg-transparent text-[15px] text-white font-semibold text-right outline-none flex-1 min-w-0"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className={`${valueCls} ${showAdd ? "text-white/30 font-normal" : ""} text-right active:opacity-70 truncate min-w-0 flex-1`}>
          {value || (placeholder ? placeholder : "Ajouter")}
        </button>
      )}
    </div>
  );
}

/* ── PickerRow — read-only label + value, fires onTap. Parent opens
      the actual MobilePicker / SearchSheet. */
export function PickerRow({
  label, value, onTap, placeholder, detailed, inline,
}: {
  label: string;
  value: string;
  onTap: () => void;
  placeholder?: string;
  /** Kept in signature for backwards-compat; per-field asterisk is gone — section header carries it. */
  required?: boolean;
  detailed?: boolean;
  inline?: boolean;
}) {
  return (
    <button type="button" onClick={onTap}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 ${inline ? "rounded-2xl bg-[#111317]" : "border-b border-white/[0.06] last:border-0"} active:bg-white/[0.02]`}>
      {label && (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={labelCls}>{label}</span>
          {detailed && <DetailedTag />}
        </div>
      )}
      <div className="flex items-center min-w-0">
        <span className={`${valueCls} ${value ? "" : "text-white/30 font-normal"} truncate`}>
          {value || placeholder || "Sélectionner"}
        </span>
      </div>
    </button>
  );
}

/* ── DateRow — visible value text + invisible native <input type="date">
      overlaid on the right ; tap opens the OS date picker. */
export function DateRow({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Kept in signature for backwards-compat; per-field asterisk removed. */
  required?: boolean;
}) {
  /* Native date picker is opened by tapping the row. We keep the input
     visible but fully transparent and overlaid on the right, so the
     row looks identical to its siblings (no browser-styled box,
     no inconsistent chevron). The visible "value" text is what
     actually reads. */
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] last:border-0 cursor-pointer active:bg-white/[0.02]">
      <span className={labelCls}>{label}</span>
      <div className="relative flex items-center min-w-0">
        <span className={`${valueCls} ${value ? "" : "text-white/30 font-normal"} truncate`}>
          {value || "Sélectionner"}
        </span>
        {/* Invisible native input takes the tap → opens the OS date picker. */}
        <input type="date"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
    </label>
  );
}

/* ── ReadOnlyRow — non-editable display (school, city, region). */
export function ReadOnlyRow({
  label, value, detailed,
}: {
  label: string;
  value: string;
  detailed?: boolean;
  /** Kept in signature for backwards-compat; per-field asterisk removed. */
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className={labelCls}>{label}</span>
        {detailed && <DetailedTag />}
      </div>
      <span className={`${valueCls} text-white/70`}>{value || "—"}</span>
    </div>
  );
}

/* ── ToggleRow — iOS-style switch. Track 48×28 rounded-full, thumb
      24×24 white circle. #E63946 on, white/12 off. */
export function ToggleRow({
  label, checked, onToggle, detailed,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  detailed?: boolean;
}) {
  /* iOS-style switch :
     track 48×28 (rounded-full), thumb 24×24 white circle,
     2px inset top/left when off → 2px inset top/right when on
     (travel = 48 − 24 − 2 − 2 = 20px). Track #E63946 on, white/12 off. */
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${label} — ${checked ? "activé" : "désactivé"}`}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] last:border-0 active:bg-white/[0.02]"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
        <span className={labelCls}>{label}</span>
        {detailed && <DetailedTag />}
      </div>
      <span
        className={`relative inline-flex items-center w-12 h-7 rounded-full transition-colors shrink-0 ${
          checked ? "bg-[#E63946]" : "bg-white/[0.12]"
        }`}
        aria-hidden
      >
        <span
          className="absolute top-1/2 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform"
          style={{
            left: 2,
            transform: checked ? "translate(20px, -50%)" : "translate(0, -50%)",
          }}
        />
      </span>
    </button>
  );
}

/* ── ChipsBlock — label-only container with children chips below. */
export function ChipsBlock({
  label, children, detailed,
}: {
  label: string;
  children: React.ReactNode;
  detailed?: boolean;
}) {
  return (
    <div className="px-4 py-3 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <span className={labelCls}>{label}</span>
        {detailed && <DetailedTag />}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* ── TagInputRow — chip-list + free-text input. Enter / blur commits
      the draft into the values array. */
export function TagInputRow({
  label, values, onChange, placeholder, detailed,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  detailed?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="px-4 py-3 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <span className={labelCls}>{label}</span>
        {detailed && <DetailedTag />}
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v) => (
          <span key={v}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label="Retirer" className="opacity-70 active:opacity-100">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M6 6l12 12" /><path d="M6 18l12-12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <input type="text" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        aria-label={label}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] text-white outline-none border-0" />
    </div>
  );
}

/* ── MediaUrlRow — two-line layout : label TOP, URL truncated BELOW.
      Tap to edit inline (consistent with text-field pattern). Fixes
      mobile overflow where a 50+ char URL couldn't fit a single-line
      right-aligned slot. */
export function MediaUrlRow({
  label, value, onSave, placeholder, detailed,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  detailed?: boolean;
}) {
  /* Two-line layout : label LEFT-TOP, URL truncated BELOW. Tap to edit
     inline (consistent with text-field pattern). Fixes mobile overflow
     where a 50+ char URL couldn't fit a single-line right-aligned slot. */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  const commit = () => { onSave(draft); setEditing(false); };

  return (
    <div className="px-4 py-3 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className={labelCls}>{label}</span>
        {detailed && <DetailedTag />}
      </div>
      {editing ? (
        <input type="url" inputMode="url" autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          aria-label={label}
          placeholder={placeholder}
          className="w-full bg-transparent text-[14px] text-white font-semibold outline-none"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className={`block w-full text-left text-[14px] font-semibold truncate active:opacity-70 ${value ? "text-white" : "text-white/30 font-normal"}`}>
          {value || (placeholder || "Ajouter un lien")}
        </button>
      )}
    </div>
  );
}
