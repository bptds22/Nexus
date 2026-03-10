"use client";

import { useState, useRef, type KeyboardEvent } from "react";

/* ─────────────────────────────────────────────────────────────────
   TagInput — prestige dark-themed tag input.
   Glass badges with glow transitions, inline layout.
───────────────────────────────────────────────────────────────── */

interface TagInputProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export default function TagInput({
  label,
  tags,
  onChange,
  placeholder = "Tapez + Entrée",
  maxTags,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = maxTags !== undefined && tags.length >= maxTags;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || atLimit) return;
      if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        setInput("");
        return;
      }
      onChange([...tags, trimmed]);
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
    inputRef.current?.focus();
  }

  return (
    <div>
      {label && (
        <p className="text-[11px] font-bold tracking-[1.2px] uppercase text-[#6b7280] mb-2">
          {label}
        </p>
      )}

      {/* Unified container — badges + input inline */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`
          relative min-h-[48px] rounded-xl px-3 py-2.5
          bg-[#0d0f13] border transition-all duration-300 cursor-text
          flex flex-wrap items-center gap-2
          ${focused
            ? "border-[#E63946]/60 shadow-[0_0_16px_rgba(230,57,70,0.08),inset_0_1px_0_rgba(255,255,255,0.03)]"
            : "border-[#1e2128] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
          }
          ${atLimit ? "opacity-60" : ""}
        `}
      >
        {/* Subtle inner highlight line */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none" />

        {/* Tags */}
        {tags.map((tag) => (
          <span
            key={tag}
            className="
              group/tag inline-flex items-center gap-1.5
              bg-gradient-to-b from-[#E63946]/[0.14] to-[#E63946]/[0.08]
              border border-[#E63946]/20
              rounded-lg px-3 py-[5px]
              text-[10px] font-bold uppercase tracking-[0.14em] text-[#E63946]
              shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(230,57,70,0.08)]
              transition-all duration-200
              hover:border-[#E63946]/40 hover:shadow-[0_0_8px_rgba(230,57,70,0.12)]
              animate-[tagIn_0.2s_ease-out]
            "
          >
            {tag}
            <button
              type="button"
              aria-label={`Retirer ${tag}`}
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="
                w-4 h-4 rounded-full flex items-center justify-center
                bg-[#E63946]/0 text-[#E63946]/40
                hover:bg-[#E63946]/20 hover:text-white
                transition-all duration-200 cursor-pointer
              "
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={atLimit}
          placeholder={
            atLimit
              ? `Maximum ${maxTags} atteint`
              : tags.length === 0
                ? placeholder
                : ""
          }
          className="
            flex-1 min-w-[100px] bg-transparent py-[2px]
            text-[13px] text-[#e0e0e0] placeholder-[#3a3d46]
            outline-none caret-[#E63946]
          "
        />

        {/* Counter pill */}
        {maxTags !== undefined && tags.length > 0 && (
          <span className={`
            ml-auto text-[9px] font-bold tracking-[0.1em] tabular-nums
            px-2 py-0.5 rounded-full
            ${atLimit
              ? "bg-[#E63946]/12 text-[#E63946]"
              : "bg-white/[0.04] text-[#4a4d56]"
            }
          `}>
            {tags.length}/{maxTags}
          </span>
        )}
      </div>

      {/* Inline keymap hint */}
      {focused && !atLimit && (
        <p className="mt-1.5 text-[9px] tracking-[0.08em] text-[#3a3d46] transition-opacity duration-300">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-px rounded bg-white/[0.04] border border-white/[0.06] text-[8px] font-mono text-[#6b7280]">Entrée</kbd>
            ajouter
          </span>
          <span className="mx-1.5 text-[#2a2d36]">·</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1 py-px rounded bg-white/[0.04] border border-white/[0.06] text-[8px] font-mono text-[#6b7280]">⌫</kbd>
            supprimer
          </span>
        </p>
      )}
    </div>
  );
}
