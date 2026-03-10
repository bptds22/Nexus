"use client";

import { useState, useRef, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────
   DatePicker — custom dark-themed calendar dropdown.
   Matches Nexus coach portal design system.
───────────────────────────────────────────────────────────────── */

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS_FR = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

interface DatePickerProps {
  value: string;          // "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  hasError?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  hasError = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Parse current value or default to a reasonable view
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear() - 16);
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());
  const [mode, setMode] = useState<"days" | "months" | "years">("days");

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("days");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Sync view when value changes externally
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Navigation ─────────────────────────────────────────── */

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  /* ── Calendar grid ──────────────────────────────────────── */

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfWeek(year: number, month: number) {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0
  }

  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
    setMode("days");
  }

  function selectMonth(month: number) {
    setViewMonth(month);
    setMode("days");
  }

  function selectYear(year: number) {
    setViewYear(year);
    setMode("months");
  }

  /* ── Format display value ───────────────────────────────── */

  function formatDisplay(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getDate()} ${MONTHS_FR[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
  }

  /* ── Year range for year picker ─────────────────────────── */

  const yearStart = Math.floor(viewYear / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i);

  /* ── Render ─────────────────────────────────────────────── */

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth
    ? parsed.getDate()
    : null;

  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth
    ? today.getDate()
    : null;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger input */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setMode("days"); }}
        className={`
          w-full flex items-center justify-between bg-[#13151a] rounded-lg px-4 py-3 text-[15px] text-left transition-colors cursor-pointer
          ${hasError ? "border border-[#E63946]" : "border border-[#2a2d36]"}
          ${open ? "border-[#E63946]" : ""}
          ${value ? "text-[#e0e0e0]" : "text-[#6b7280]"}
        `}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#6b7280] shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
        </svg>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 w-[300px] bg-[#1A1D24] border border-[#2a2d36] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.5)] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2128]">
            <button type="button" onClick={() => mode === "days" ? prevMonth() : setViewYear(yearStart - 12)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#8a8d96] hover:text-white hover:bg-white/5 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "days" ? "months" : mode === "months" ? "years" : "days")}
              className="font-head text-[12px] font-bold uppercase tracking-[0.12em] text-white hover:text-[#E63946] transition-colors"
            >
              {mode === "days" && `${MONTHS_FR[viewMonth]} ${viewYear}`}
              {mode === "months" && `${viewYear}`}
              {mode === "years" && `${yearStart} — ${yearStart + 11}`}
            </button>

            <button type="button" onClick={() => mode === "days" ? nextMonth() : setViewYear(yearStart + 12)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#8a8d96] hover:text-white hover:bg-white/5 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-3">

            {/* ── Days view ──────────────────────────── */}
            {mode === "days" && (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-0 mb-1">
                  {DAYS_FR.map((d) => (
                    <div key={d} className="text-center text-[9px] font-bold tracking-[0.15em] uppercase text-[#6b7280] py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-0">
                  {Array.from({ length: rows * 7 }, (_, i) => {
                    const dayNum = i - firstDay + 1;
                    const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                    const isSelected = isValid && dayNum === selectedDay;
                    const isToday = isValid && dayNum === todayDay;

                    if (!isValid) {
                      return <div key={i} className="w-full aspect-square" />;
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectDay(dayNum)}
                        className={`
                          w-full aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium transition-all
                          ${isSelected
                            ? "bg-[#E63946] text-white font-bold shadow-[0_0_8px_rgba(230,57,70,0.3)]"
                            : isToday
                              ? "text-[#E63946] font-bold bg-[#E63946]/10"
                              : "text-[#e0e0e0] hover:bg-white/8"
                          }
                        `}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Months view ────────────────────────── */}
            {mode === "months" && (
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_FR.map((m, i) => {
                  const isCurrent = i === viewMonth;
                  return (
                    <button key={m} type="button" onClick={() => selectMonth(i)}
                      className={`
                        py-3 rounded-lg text-[11px] font-bold uppercase tracking-[0.1em] transition-all
                        ${isCurrent
                          ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.3)]"
                          : "text-[#e0e0e0] hover:bg-white/8"
                        }
                      `}>
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Years view ─────────────────────────── */}
            {mode === "years" && (
              <div className="grid grid-cols-3 gap-2">
                {years.map((y) => {
                  const isCurrent = y === viewYear;
                  return (
                    <button key={y} type="button" onClick={() => selectYear(y)}
                      className={`
                        py-3 rounded-lg text-[12px] font-bold transition-all
                        ${isCurrent
                          ? "bg-[#E63946] text-white shadow-[0_0_8px_rgba(230,57,70,0.3)]"
                          : "text-[#e0e0e0] hover:bg-white/8"
                        }
                      `}>
                      {y}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer — Today shortcut */}
          <div className="border-t border-[#1e2128] px-4 py-2">
            <button type="button"
              onClick={() => {
                const t = new Date();
                const m = String(t.getMonth() + 1).padStart(2, "0");
                const d = String(t.getDate()).padStart(2, "0");
                onChange(`${t.getFullYear()}-${m}-${d}`);
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth());
                setOpen(false);
              }}
              className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] hover:text-[#E63946] transition-colors">
              Aujourd&apos;hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
