"use client";

import { useState, useRef, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────
   NxSelect — custom dark-themed dropdown select.
   Replaces native <select> with a fully styled dropdown.
   Supports optgroups via the `groups` prop.
───────────────────────────────────────────────────────────────── */

export interface NxOption {
  value: string;
  label: string;
  group?: string;
}

interface NxSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NxOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  "aria-label"?: string;
}

export default function NxSelect({
  value,
  onChange,
  options,
  placeholder = "Sélectionner",
  disabled = false,
  hasError = false,
  "aria-label": ariaLabel,
}: NxSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || highlightIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-option]");
    items[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, open]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    const flatOptions = options;

    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        const idx = flatOptions.findIndex((o) => o.value === value);
        setHighlightIdx(idx >= 0 ? idx : 0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, flatOptions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < flatOptions.length) {
          onChange(flatOptions[highlightIdx].value);
          setOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  // Build grouped structure
  const groups: { label: string | null; items: { option: NxOption; flatIdx: number }[] }[] = [];
  let flatIdx = 0;
  const groupMap = new Map<string | null, { option: NxOption; flatIdx: number }[]>();

  for (const opt of options) {
    const key = opt.group || null;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
      groups.push({ label: key, items: groupMap.get(key)! });
    }
    groupMap.get(key)!.push({ option: opt, flatIdx });
    flatIdx++;
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { if (!disabled) { setOpen(!open); if (!open) { const idx = options.findIndex((o) => o.value === value); setHighlightIdx(idx >= 0 ? idx : 0); } } }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`
          w-full flex items-center justify-between
          bg-[#13151a] rounded-lg px-4 py-3 text-[15px] text-left
          transition-all duration-200 cursor-pointer
          ${hasError
            ? "border border-[#E63946]/60"
            : open
              ? "border border-[#E63946]/60 shadow-[0_0_12px_rgba(230,57,70,0.06)]"
              : "border border-[#2a2d36] hover:border-[#3a3d46]"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${value ? "text-[#e0e0e0]" : "text-[#4a4d56]"}
        `}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`shrink-0 ml-2 text-[#6b7280] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="
            absolute z-50 top-full mt-1.5 left-0 w-full
            bg-[#1A1D24] border border-[#2a2d36] rounded-xl
            shadow-[0_12px_40px_rgba(0,0,0,0.5)]
            overflow-hidden
            animate-[nxDropIn_0.15s_ease-out]
          "
        >
          {/* Inner highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none" />

          <div className="max-h-[280px] overflow-y-auto py-1.5 nx-scrollbar">
            {groups.map((group) => (
              <div key={group.label || "__ungrouped"}>
                {group.label && (
                  <div className="px-4 pt-3 pb-1.5 text-[11px] font-bold tracking-[0.18em] uppercase text-[#5a5d66] select-none">
                    {group.label}
                  </div>
                )}
                {group.items.map(({ option, flatIdx: fi }) => {
                  const isSelected = option.value === value;
                  const isHighlighted = fi === highlightIdx;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      data-option
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => { onChange(option.value); setOpen(false); }}
                      onMouseEnter={() => setHighlightIdx(fi)}
                      className={`
                        w-full text-left px-4 py-2.5 text-[14px] transition-colors duration-100
                        flex items-center gap-2
                        ${isHighlighted
                          ? "bg-white/[0.06]"
                          : ""
                        }
                        ${isSelected
                          ? "text-[#E63946] font-bold"
                          : "text-[#c8c8cc] hover:text-white"
                        }
                      `}
                    >
                      {/* Selected indicator */}
                      <span className={`w-1 h-1 rounded-full shrink-0 transition-opacity ${isSelected ? "bg-[#E63946] opacity-100" : "opacity-0"}`} />
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
