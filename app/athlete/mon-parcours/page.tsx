"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { BADGE_CONFIG, BADGE_ORDER, parseDistinctions } from "@/lib/config/badges";
import { toPng } from "html-to-image";

/* ═══════════════════════════════════════════════════════════════
   /athlete/mon-parcours — "L'été où tout se joue"

   Chunk 2: scaffold, hero, season timeline spine.
   Chunk 3: Module 1 "Ma carte" — reuses AthletePlayerCard + the
   downloadCard/toPng pattern + BADGE_CONFIG.
   Chunk 4: Module 2 "Mes cibles" — CÉGEP shortlist (name-only),
   add/remove against the athlete_targets table. Module 3 = chunk 5.

   Athlete voice throughout — tutoiement, never a counsellor tone.
═══════════════════════════════════════════════════════════════ */

const STEPS = [
  { label: "Entraînement d'été" },
  { label: "Camps & essais" },
  { label: "Saison Sec 5" },
  { label: "Fenêtre de signature" },
];

// v1: the current step is static — the page ships for the summer
// prep window, so the athlete is at "Camps & essais".
const CURRENT_STEP = 1;

// The 6 named badges — "custom" is excluded (empty label, free-text).
const NAMED_BADGES = BADGE_ORDER.filter((k) => k !== "custom");

function readinessColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return "#F59E0B";
  return "#22C55E";
}

type Cegep = { id: string; name: string; city: string | null; region: string | null };
type TargetRow = { id: string; schoolId: string; name: string; city: string | null; region: string | null };

// schools embed comes back as an object (or array under some PostgREST
// versions) — normalise to a single record.
function pickOne<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

function locationLine(city: string | null, region: string | null): string {
  return [city, region].filter(Boolean).join(" · ");
}

export default function MonParcoursPage() {
  const [firstName, setFirstName] = useState("");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [cardAthlete, setCardAthlete] = useState<AthleteProfileRecruiterView | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  // Module 2 — Mes cibles
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [cegeps, setCegeps] = useState<Cegep[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadTargets = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("athlete_targets")
      .select("id, school_id, schools!school_id(name, city, region)")
      .eq("athlete_id", id)
      .order("created_at", { ascending: true });
    const rows = (data as Record<string, unknown>[] | null) ?? [];
    setTargets(
      rows.map((r) => {
        const school = pickOne(r.schools as { name?: string; city?: string | null; region?: string | null } | null);
        return {
          id: r.id as string,
          schoolId: r.school_id as string,
          name: school?.name ?? "CÉGEP",
          city: school?.city ?? null,
          region: school?.region ?? null,
        };
      }),
    );
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("athletes")
        .select("id, first_name, profile_completion")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      setFirstName((data.first_name as string) || "");
      setProfileCompletion((data.profile_completion as number) || 0);

      const id = data.id as string;
      setAthleteId(id);

      // Module 1 — player card. Reuse the coach data loader + the
      // recruiter-view mapper (same path the settings-page card uses).
      try {
        const result = await loadAthleteRaw(id);
        if (result?.data) {
          setCardAthlete(mapToRecruiterView(result.data as Record<string, unknown>));
        }
      } catch (e) {
        console.error("[mon-parcours] card load failed:", e);
      }

      // Module 1 — earned badges. Distinctions are coach-awarded and
      // live in evaluations.distinctions; union across all evaluations.
      const { data: evals } = await supabase
        .from("evaluations")
        .select("distinctions")
        .eq("athlete_id", id);
      if (evals) {
        const earned = new Set<string>();
        for (const row of evals) {
          for (const entry of parseDistinctions((row as { distinctions: unknown }).distinctions)) {
            earned.add(entry.badge);
          }
        }
        setEarnedBadges(earned);
      }

      // Module 2 — saved targets + the CÉGEP list for the picker.
      await loadTargets(id);
      const { data: cegepRows } = await supabase
        .from("schools")
        .select("id, name, city, region")
        .eq("type", "CEGEP")
        .order("name", { ascending: true });
      setCegeps((cegepRows as Cegep[] | null) ?? []);
    })();
  }, [loadTargets]);

  async function downloadCard() {
    if (!captureRef.current || !cardAthlete) return;
    setDownloading(true);
    try {
      // Wait for fonts so the captured PNG has the right typography.
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: undefined,
        style: { animation: "none", transition: "none" },
      });
      const link = document.createElement("a");
      const safe = `${cardAthlete.firstName}-${cardAthlete.lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      link.download = `nexus-carte-${safe}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("[mon-parcours] card export failed:", e);
    } finally {
      setDownloading(false);
    }
  }

  async function addTarget(cegepId: string) {
    if (!athleteId) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("athlete_targets")
        .insert({ athlete_id: athleteId, school_id: cegepId, rank: targets.length + 1 })
        .select("id");
      if (error) {
        console.error("[mon-parcours] add target:", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      // 0 rows + no error = RLS silently filtered the insert.
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      await loadTargets(athleteId);
      showToast("success", "CÉGEP ajouté à tes cibles");
    } finally {
      setBusy(false);
    }
  }

  async function removeTarget(targetId: string) {
    if (!athleteId) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("athlete_targets")
        .delete()
        .eq("id", targetId)
        .select("id");
      if (error) {
        console.error("[mon-parcours] remove target:", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      await loadTargets(athleteId);
    } finally {
      setBusy(false);
    }
  }

  const pctColor = readinessColor(profileCompletion);
  // Track spans node-0 centre → node-3 centre (left/right inset 12.5%).
  // Fill reaches the current node: one 25%-of-container segment per step.
  const fillWidth = (CURRENT_STEP * 75) / (STEPS.length - 1);

  const steps = STEPS.map((s, i) => ({
    ...s,
    state: i < CURRENT_STEP ? "done" : i === CURRENT_STEP ? "current" : "upcoming",
  }));

  // CÉGEPs not yet targeted, filtered by the picker search.
  const targetedIds = new Set(targets.map((t) => t.schoolId));
  const q = search.trim().toLowerCase();
  const addableCegeps = cegeps
    .filter((c) => !targetedIds.has(c.id))
    .filter((c) => (q ? c.name.toLowerCase().includes(q) : true));

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-8">
      {/* ── Hero ── */}
      <div>
        <div className="inline-flex items-center gap-2.5 mb-4">
          <span className="w-8 h-px bg-[#E63946]" />
          <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.22em] uppercase text-[#E63946]">
            Saison 2026–2027 · ta dernière au secondaire
          </span>
        </div>
        <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase tracking-tight leading-[0.95]">
          Mon Parcours
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[#9CA3AF] leading-relaxed mt-4 max-w-2xl">
          {firstName ? `${firstName}, l'été` : "L'été"} où tout se joue. Prépare ta saison,
          construis ta vitrine et sois prêt quand le CÉGEP cogne à ta porte.
        </p>
      </div>

      {/* ── Timeline spine ── */}
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 sm:p-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-9">
          <h2 className="font-head text-lg sm:text-xl font-black text-white uppercase tracking-tight">
            Ta ligne du temps vers le CÉGEP
          </h2>
          <div className="flex items-baseline gap-1.5">
            <span className="font-head text-3xl font-black leading-none" style={{ color: pctColor }}>
              {profileCompletion}%
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">
              prêt
            </span>
          </div>
        </div>

        {/* Spine — 3 stacked rows: markers · track+nodes · labels */}
        <div className="space-y-2.5">
          {/* Row 1 — "Tu es ici" marker */}
          <div className="flex">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 flex justify-center">
                {step.state === "current" && (
                  <span className="px-2 py-0.5 rounded-full bg-[#E63946] text-white text-[9px] font-black uppercase tracking-[0.12em] whitespace-nowrap">
                    Tu es ici
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Row 2 — track + nodes */}
          <div className="relative h-7">
            <div className="absolute left-[12.5%] right-[12.5%] top-1/2 -translate-y-1/2 h-[3px] bg-[#2D3748] rounded-full" />
            <div
              className="absolute left-[12.5%] top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-gradient-to-r from-[#E63946]/60 to-[#E63946]"
              style={{ width: `${fillWidth}%` }}
            />
            <div className="relative h-full flex">
              {steps.map((step, i) => (
                <div key={i} className="flex-1 flex items-center justify-center">
                  <span
                    className={
                      step.state === "done"
                        ? "w-7 h-7 rounded-full bg-[#E63946] flex items-center justify-center"
                        : step.state === "current"
                          ? "w-7 h-7 rounded-full bg-[#E63946] ring-4 ring-[#E63946]/25 flex items-center justify-center"
                          : "w-7 h-7 rounded-full bg-[#13151a] border-2 border-[#2D3748]"
                    }
                  >
                    {step.state === "done" && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {step.state === "current" && (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3 — labels */}
          <div className="flex">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 px-1 text-center">
                <p
                  className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.06em] leading-tight ${
                    step.state === "upcoming" ? "text-[#6b7280]" : "text-white"
                  }`}
                >
                  {step.label}
                </p>
                {step.state === "current" && (
                  <p className="mt-1 text-[10px] text-[#6b7280]">Saison 2026-2027</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Module 1 — Ma carte ── */}
      <section>
        <div className="flex items-baseline gap-2.5 mb-1">
          <span className="font-head text-base font-black text-[#E63946]">01</span>
          <span className="text-[#3a3d46]">·</span>
          <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Ma carte
          </h2>
        </div>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed mb-6 max-w-2xl">
          C&apos;est toi, en une image. Ta carte se met à jour quand tu progresses. Télécharge-la
          et publie-la.
        </p>

        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            {/* Card + download */}
            <div className="flex flex-col items-center gap-5 shrink-0">
              {cardAthlete ? (
                <AthletePlayerCard a={cardAthlete} />
              ) : (
                <div className="w-[300px] h-[460px] rounded-xl bg-[#13151a] border border-[#2D3748] flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <button
                type="button"
                onClick={downloadCard}
                disabled={!cardAthlete || downloading}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-[#E63946] text-[14px] font-bold text-white hover:bg-[#D42B22] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? "Génération…" : "Télécharger ma carte"}
                {!downloading && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Badges to chase */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                Badges à viser
              </h3>
              <p className="text-[12px] text-[#6b7280] mt-1 mb-4">
                Décernés par ton entraîneur — continue de performer pour les mériter.
              </p>
              <ul className="space-y-2">
                {NAMED_BADGES.map((key) => {
                  const earned = earnedBadges.has(key);
                  return (
                    <li
                      key={key}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border ${
                        earned
                          ? "bg-[#E63946]/[0.08] border-[#E63946]/30"
                          : "bg-[#13151a] border-[#2D3748]"
                      }`}
                    >
                      {earned ? (
                        <span className="w-6 h-6 rounded-full bg-[#E63946] flex items-center justify-center shrink-0">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full border-2 border-[#2D3748] shrink-0" />
                      )}
                      <span
                        className={`text-[14px] font-bold ${
                          earned ? "text-white" : "text-[#6b7280]"
                        }`}
                      >
                        {BADGE_CONFIG[key].label}
                      </span>
                      {earned && (
                        <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-[#E63946]">
                          Obtenu
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Module 2 — Mes cibles ── */}
      <section>
        <div className="flex items-baseline gap-2.5 mb-1">
          <span className="font-head text-base font-black text-[#E63946]">02</span>
          <span className="text-[#3a3d46]">·</span>
          <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Mes cibles
          </h2>
        </div>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed mb-6 max-w-2xl">
          Choisis les CÉGEPs où tu veux jouer. Construis ta liste, sache vers quoi tu travailles.
        </p>

        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 sm:p-8">
          {targets.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-[#13151a] border border-[#2D3748] flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <p className="text-[14px] text-[#9CA3AF]">
                Tu n&apos;as pas encore de cibles — ajoute ton premier CÉGEP.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5 mb-5">
              {targets.map((t) => {
                const loc = locationLine(t.city, t.region);
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-[#13151a] border border-[#2D3748]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-white truncate">{t.name}</p>
                      {loc && <p className="text-[12px] text-[#6b7280] truncate">{loc}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTarget(t.id)}
                      disabled={busy}
                      aria-label={`Retirer ${t.name}`}
                      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-[#E63946] hover:bg-[#E63946]/10 transition-colors disabled:opacity-40"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => { setSearch(""); setPickerOpen(true); }}
            disabled={!athleteId}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-[#13151a] border border-[#2a2d36] text-[14px] font-bold text-white hover:border-[#E63946] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Ajouter un CÉGEP
          </button>
        </div>
      </section>

      {/* Off-screen full-size render for the html-to-image capture.
          format="publication" is intrinsically 1080×1350; nx-capture-clean
          disables the editorial tilt so the PNG is axis-aligned. */}
      {cardAthlete && (
        <div
          aria-hidden="true"
          className="nx-capture-clean"
          style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", zIndex: -1 }}
        >
          <div ref={captureRef}>
            <AthletePlayerCard a={cardAthlete} format="publication" clipOverflow={true} />
          </div>
        </div>
      )}

      {/* ── CÉGEP picker modal ── */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#1A1D24] border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2D3748]">
              <h3 className="font-head text-base font-black text-white uppercase tracking-tight">
                Ajouter un CÉGEP
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-[#2D3748]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un CÉGEP…"
                aria-label="Rechercher un CÉGEP"
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors"
              />
            </div>

            <div className="overflow-y-auto nx-scrollbar p-2">
              {addableCegeps.length === 0 ? (
                <p className="text-[13px] text-[#6b7280] text-center py-8">
                  {cegeps.length > 0 && targetedIds.size >= cegeps.length
                    ? "Tu as ajouté tous les CÉGEPs disponibles."
                    : "Aucun CÉGEP trouvé."}
                </p>
              ) : (
                addableCegeps.map((c) => {
                  const loc = locationLine(c.city, c.region);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addTarget(c.id)}
                      disabled={busy}
                      className="w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-white truncate">{c.name}</p>
                        {loc && <p className="text-[12px] text-[#6b7280] truncate">{loc}</p>}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M12 5v14" /><path d="M5 12h14" />
                      </svg>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-lg text-[14px] font-bold shadow-lg border ${
            toast.kind === "success"
              ? "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30"
              : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
