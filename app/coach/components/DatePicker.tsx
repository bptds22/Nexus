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

/* ─── Bornes ────────────────────────────────────────────────────────
   POURQUOI (2026-09-16) : une fiche de test coach est partie en prod
   avec « 11 septembre 1624 ». Personne n'a tapé 1624 — la flèche de
   gauche en vue « années » faisait `setViewYear(viewYear - 1)` SANS
   plancher, et rien en aval ne rattrapait : `isUnder14` attrape le trop
   JEUNE, aucune garde n'attrapait le trop VIEUX.

   D'où la règle : borner la NAVIGATION, pas seulement la sélection. Un
   jour qu'on ne peut pas atteindre ne peut pas être choisi par erreur ;
   un jour qu'on peut atteindre mais pas cliquer laisse l'utilisateur
   deviner pourquoi.

   Clé numérique plutôt que comparaison de chaînes : `selectDay` compose
   `${viewYear}-MM-JJ`, et une année à 3 chiffres (« 624-09-11 ») casse
   l'ordre lexicographique. Les bornes rendent ce cas inatteignable —
   raison de plus pour ne pas en dépendre. */
function cle(y: number, moisIdx: number, jour: number): number {
  return y * 10000 + (moisIdx + 1) * 100 + jour;
}
function cleISO(iso: string): number | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return y * 10000 + m * 100 + d;
}
function joursDansMois(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface DatePickerProps {
  value: string;          // "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;     // read-only: shows the value, blocks the calendar
  /** Date la plus ANCIENNE atteignable, ISO "YYYY-MM-DD". Borne la
   *  navigation (mois, années, pagination) autant que la sélection. */
  min?: string;
  /** Date la plus RÉCENTE atteignable, ISO "YYYY-MM-DD". Idem. */
  max?: string;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  hasError = false,
  disabled = false,
  min,
  max,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Parse current value or default to a reasonable view
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const today = new Date();

  const kMin = min ? cleISO(min) : null;
  const kMax = max ? cleISO(max) : null;

  /** Un jour est-il hors des bornes ? */
  function jourFerme(y: number, moisIdx: number, jour: number) {
    const k = cle(y, moisIdx, jour);
    return (kMin !== null && k < kMin) || (kMax !== null && k > kMax);
  }
  /** Un mois est ouvert si AU MOINS UN de ses jours l'est. */
  function moisOuvert(y: number, moisIdx: number) {
    if (kMin !== null && cle(y, moisIdx, joursDansMois(y, moisIdx)) < kMin) return false;
    if (kMax !== null && cle(y, moisIdx, 1) > kMax) return false;
    return true;
  }
  /** Idem pour une année entière (31 décembre … 1er janvier). */
  function anneeOuverte(y: number) {
    if (kMin !== null && cle(y, 11, 31) < kMin) return false;
    if (kMax !== null && cle(y, 0, 1) > kMax) return false;
    return true;
  }

  /* La vue d'ouverture doit elle aussi tomber dans les bornes : sans ce
     recadrage, un champ vide s'ouvrirait sur « aujourd'hui − 16 ans »
     même quand cette année est fermée, et les deux flèches seraient
     grises d'entrée de jeu. */
  const anneeDepart = (() => {
    let y = parsed?.getFullYear() ?? today.getFullYear() - 16;
    if (kMin !== null) y = Math.max(y, Math.floor(kMin / 10000));
    if (kMax !== null) y = Math.min(y, Math.floor(kMax / 10000));
    return y;
  })();

  const [viewYear, setViewYear] = useState(anneeDepart);
  const [viewMonth, setViewMonth] = useState(() => {
    const m = parsed?.getMonth() ?? today.getMonth();
    if (moisOuvert(anneeDepart, m)) return m;
    // Année de bord : se poser sur le premier mois ouvert de cette année.
    for (let i = 0; i < 12; i++) if (moisOuvert(anneeDepart, i)) return i;
    return m;
  });
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

  /** Cible des flèches du bandeau : le mois voisin en vue « jours »,
   *  l'année voisine sinon. Rendue explicite pour que le bouton sache
   *  s'il mène quelque part AVANT d'être cliqué. */
  const cibleGauche = mode === "days"
    ? (viewMonth === 0 ? { y: viewYear - 1, m: 11 } : { y: viewYear, m: viewMonth - 1 })
    : { y: viewYear - 1, m: viewMonth };
  const cibleDroite = mode === "days"
    ? (viewMonth === 11 ? { y: viewYear + 1, m: 0 } : { y: viewYear, m: viewMonth + 1 })
    : { y: viewYear + 1, m: viewMonth };

  const gaucheOuverte = mode === "days"
    ? moisOuvert(cibleGauche.y, cibleGauche.m)
    : anneeOuverte(cibleGauche.y);
  const droiteOuverte = mode === "days"
    ? moisOuvert(cibleDroite.y, cibleDroite.m)
    : anneeOuverte(cibleDroite.y);

  function allerGauche() {
    if (!gaucheOuverte) return;
    setViewYear(cibleGauche.y);
    if (mode === "days") setViewMonth(cibleGauche.m);
  }
  function allerDroite() {
    if (!droiteOuverte) return;
    setViewYear(cibleDroite.y);
    if (mode === "days") setViewMonth(cibleDroite.m);
  }

  /* ── Calendar grid ──────────────────────────────────────── */

  function getDaysInMonth(year: number, month: number) {
    return joursDansMois(year, month);
  }

  function getFirstDayOfWeek(year: number, month: number) {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0
  }

  function selectDay(day: number) {
    if (jourFerme(viewYear, viewMonth, day)) return;
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
    setMode("days");
  }

  function selectMonth(month: number) {
    if (!moisOuvert(viewYear, month)) return;
    setViewMonth(month);
    setMode("days");
  }

  function selectYear(year: number) {
    if (!anneeOuverte(year)) return;
    setViewYear(year);
    // Le mois courant peut être fermé dans l'année de bord : se reposer
    // sur le premier mois ouvert plutôt que d'afficher une grille morte.
    if (!moisOuvert(year, viewMonth)) {
      for (let i = 0; i < 12; i++) if (moisOuvert(year, i)) { setViewMonth(i); break; }
    }
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
        disabled={disabled}
        onClick={() => { if (disabled) return; setOpen(!open); setMode("days"); }}
        className={`
          w-full flex items-center justify-between bg-[#13151a] rounded-lg px-4 py-3 text-[15px] text-left transition-colors
          ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
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
            <button type="button" onClick={allerGauche} disabled={!gaucheOuverte}
              aria-label="Précédent"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#8a8d96] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-25 disabled:hover:text-[#8a8d96] disabled:hover:bg-transparent disabled:cursor-not-allowed">
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

            <button type="button" onClick={allerDroite} disabled={!droiteOuverte}
              aria-label="Suivant"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#8a8d96] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-25 disabled:hover:text-[#8a8d96] disabled:hover:bg-transparent disabled:cursor-not-allowed">
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
                    const ferme = isValid && jourFerme(viewYear, viewMonth, dayNum);

                    if (!isValid) {
                      return <div key={i} className="w-full aspect-square" />;
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={ferme}
                        onClick={() => selectDay(dayNum)}
                        className={`
                          w-full aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium transition-all
                          ${ferme
                            ? "text-[#4a4d56] cursor-not-allowed"
                            : isSelected
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
                  const ferme = !moisOuvert(viewYear, i);
                  return (
                    <button key={m} type="button" disabled={ferme} onClick={() => selectMonth(i)}
                      className={`
                        py-3 rounded-lg text-[11px] font-bold uppercase tracking-[0.1em] transition-all
                        ${ferme
                          ? "text-[#4a4d56] cursor-not-allowed"
                          : isCurrent
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
                  const ferme = !anneeOuverte(y);
                  return (
                    <button key={y} type="button" disabled={ferme} onClick={() => selectYear(y)}
                      className={`
                        py-3 rounded-lg text-[12px] font-bold transition-all
                        ${ferme
                          ? "text-[#4a4d56] cursor-not-allowed"
                          : isCurrent
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

          {/* Footer — Today shortcut.
              Il CONTOURNE la grille : il écrit la date sans passer par
              `selectDay`. Sur une DOB bornée à « aujourd'hui − 14 ans »
              il poserait un âge de 0 an. On le retire quand aujourd'hui
              est hors bornes plutôt que de le laisser griser — un
              raccourci qu'on ne peut jamais prendre n'a rien à montrer. */}
          {!jourFerme(today.getFullYear(), today.getMonth(), today.getDate()) && (
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
          )}
        </div>
      )}
    </div>
  );
}
