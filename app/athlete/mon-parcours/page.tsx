"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { BADGE_ORDER, parseDistinctions } from "@/lib/config/badges";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import { toPng } from "html-to-image";

/* ═══════════════════════════════════════════════════════════════
   /athlete/mon-parcours — "L'été où tout se joue"

   Chunk 2: scaffold, hero, season timeline spine.
   Chunk 3: Module 1 "Ma carte" — AthletePlayerCard + download + badges.
   Chunk 4: Module 2 "Mes cibles" — CÉGEP shortlist (athlete_targets).
   Chunk 5: Module 3 "Quand le CÉGEP cogne" — 8-item readiness
            checklist (6 auto-derived + 2 manual) + progress ring.

   Athlete voice throughout — tutoiement, never a counsellor tone.
═══════════════════════════════════════════════════════════════ */

const STEPS = [
  { label: "Entraînement d'été", phase: "entrainement" },
  { label: "Camps & essais", phase: "camps" },
  { label: "Saison Sec 5", phase: "saison" },
  { label: "Fenêtre de signature", phase: "signature" },
];

// Season label — currentYear–(currentYear+1), computed, never hardcoded.
const SEASON_YEAR = new Date().getFullYear();
const SEASON_LABEL = `${SEASON_YEAR}–${SEASON_YEAR + 1}`;

// The 6 named badges — "custom" is excluded (empty label, free-text).
const NAMED_BADGES = BADGE_ORDER.filter((k) => k !== "custom");

type Cegep = { id: string; name: string; city: string | null; region: string | null };
type TargetRow = { id: string; schoolId: string; name: string; city: string | null; region: string | null };
type ManualKey =
  | "instagram_ready"
  | "knows_how_to_respond"
  | "coach_knows_goals"
  | "knows_numbers"
  | "contacted_program";
type Readiness = {
  instagram_ready?: boolean;
  knows_how_to_respond?: boolean;
  coach_knows_goals?: boolean;
  knows_numbers?: boolean;
  contacted_program?: boolean;
  current_phase?: string;
};

type ChecklistItem = {
  key: string;
  type: "auto" | "manual";
  label: string;
  done: boolean;
  why: string;        // always visible — one-line rationale
  how: string;        // revealed by the "En savoir plus" accordion
  tag?: string;       // auto — category shown when done
  href?: string;      // auto — "Compléter" link target when not done
  manualKey?: ManualKey;
};

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
  const [earnedBadges, setEarnedBadges] = useState<Map<string, string | undefined>>(new Map());
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

  // Module 3 — readiness (auto sources + manual jsonb)
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  const [coteGlobale, setCoteGlobale] = useState<number | null>(null);
  const [moyenne, setMoyenne] = useState<number | null>(null);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [readiness, setReadiness] = useState<Readiness>({});
  const [togglingKey, setTogglingKey] = useState<ManualKey | null>(null);
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
        .select(
          "id, first_name, profile_completion, video_faits_saillants_url, cote_globale_entraineur, moyenne_generale, consentement_parental, parcours_readiness",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      setFirstName((data.first_name as string) || "");
      setProfileCompletion((data.profile_completion as number) || 0);
      setHighlightUrl((data.video_faits_saillants_url as string | null) ?? null);
      setCoteGlobale((data.cote_globale_entraineur as number | null) ?? null);
      setMoyenne((data.moyenne_generale as number | null) ?? null);
      setParentalConsent(data.consentement_parental === true);
      setReadiness((data.parcours_readiness as Readiness) ?? {});

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
        // Keep the full entry (badge + detail); on a repeat badge, prefer
        // the occurrence that carries a stat detail.
        const earned = new Map<string, string | undefined>();
        for (const row of evals) {
          for (const entry of parseDistinctions((row as { distinctions: unknown }).distinctions)) {
            if (!earned.has(entry.badge) || (earned.get(entry.badge) == null && entry.detail != null)) {
              earned.set(entry.badge, entry.detail);
            }
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

  async function toggleManual(key: ManualKey) {
    setTogglingKey(key);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Session expirée. Reconnecte-toi.");
        return;
      }
      // Merge — flip one key, preserve the other.
      const next: Readiness = { ...readiness, [key]: !readiness[key] };
      const { data, error } = await supabase
        .from("athletes")
        .update({ parcours_readiness: next })
        .eq("user_id", user.id)
        .select("id");
      if (error) {
        console.error("[mon-parcours] readiness toggle:", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      // 0 rows + no error = RLS silently filtered the update.
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      setReadiness(next);
    } finally {
      setTogglingKey(null);
    }
  }

  async function setPhase(phase: string) {
    if (phaseSaving) return;
    setPhaseSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Session expirée. Reconnecte-toi.");
        return;
      }
      // Merge — set current_phase, preserve the manual-checkbox keys.
      const next: Readiness = { ...readiness, current_phase: phase };
      const { data, error } = await supabase
        .from("athletes")
        .update({ parcours_readiness: next })
        .eq("user_id", user.id)
        .select("id");
      if (error) {
        console.error("[mon-parcours] phase write:", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      // 0 rows + no error = RLS silently filtered the update.
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      setReadiness(next);
    } finally {
      setPhaseSaving(false);
    }
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Current phase from the readiness jsonb; defaults to the first step.
  const currentPhase = readiness.current_phase ?? "entrainement";
  const currentStepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.phase === currentPhase),
  );
  // Track spans node-0 centre → node-3 centre (left/right inset 12.5%).
  // Fill reaches the current node: one 25%-of-container segment per step.
  const fillWidth = (currentStepIndex * 75) / (STEPS.length - 1);

  const steps = STEPS.map((s, i) => ({
    ...s,
    state: i < currentStepIndex ? "done" : i === currentStepIndex ? "current" : "upcoming",
  }));

  // CÉGEPs not yet targeted, filtered by the picker search.
  const targetedIds = new Set(targets.map((t) => t.schoolId));
  const q = search.trim().toLowerCase();
  const addableCegeps = cegeps
    .filter((c) => !targetedIds.has(c.id))
    .filter((c) => (q ? c.name.toLowerCase().includes(q) : true));

  // ── Module 3 — the 11 readiness items (6 auto + 5 manual) ──
  const checklist: ChecklistItem[] = [
    {
      key: "highlight", type: "auto", label: "Highlight reel", tag: "Vitrine",
      done: !!highlightUrl && highlightUrl.trim() !== "",
      href: "/athlete/profil",
      why: "C'est la première chose qu'un recruteur regarde — souvent avant même de lire ton profil.",
      how: "2-3 minutes max. Tes meilleurs jeux en premier. Ton numéro visible. Pas de musique ni d'effets — les recruteurs veulent voir toi, pas le montage.",
    },
    {
      key: "profile", type: "auto", label: "Profil complet", tag: "Profil",
      done: profileCompletion >= 100,
      href: "/athlete/profil",
      why: "Un profil à moitié rempli, ça donne l'air d'un athlète pas sérieux.",
      how: "Remplis chaque champ. Les recruteurs filtrent par position, taille, région — un champ vide, c'est une recherche où tu n'apparais pas.",
    },
    {
      key: "coach", type: "auto", label: "Évalué par ton coach", tag: "Crédibilité",
      done: coteGlobale !== null,
      why: "La parole de ton coach, c'est ce qu'un recruteur croit le plus. Au Québec, le monde du recrutement est petit — les coachs se parlent.",
      how: "Demande à ton entraîneur de remplir ton évaluation Nexus. C'est souvent la première chose qu'un recruteur lit.",
    },
    {
      key: "targets", type: "auto", label: "Cibles choisies", tag: "Plan",
      done: targets.length > 0,
      why: "Savoir où tu veux jouer change tout — tu te prépares différemment pour du D1 que pour du D2.",
      how: "Choisis 3 à 5 CÉGEPs réalistes. Mélange des rêves et des choix sûrs.",
    },
    {
      key: "moyenne", type: "auto", label: "Moyenne générale à jour", tag: "Académique",
      done: moyenne !== null,
      href: "/athlete/profil",
      why: "Les programmes contingentés refusent sur les notes, peu importe le talent.",
      how: "Garde-la à jour. Certains programmes ne regarderont même pas ton dossier sous un certain seuil.",
    },
    {
      key: "instagram", type: "manual", manualKey: "instagram_ready",
      label: "Instagram recruteur-ready", done: readiness.instagram_ready === true,
      why: "Un recruteur te cherche en ligne avant de t'appeler. Qu'est-ce qu'il trouve?",
      how: "Enlève les photos de party. Mets du contenu d'entraînement, de matchs. Public, mais propre. Présente-toi comme un athlète.",
    },
    {
      key: "respond", type: "manual", manualKey: "knows_how_to_respond",
      label: "Tu sais répondre à un recruteur", done: readiness.knows_how_to_respond === true,
      why: "Ton premier message donne le ton. Le manquer, ça peut coûter l'intérêt.",
      how: "Garde ça simple : remercie, confirme ton intérêt, pose une bonne question, et mets ton coach ou tes parents dans la boucle. Réponds vite — dans les 24h.",
    },
    {
      key: "consent", type: "auto", label: "Consentement parental", tag: "Famille",
      done: parentalConsent,
      why: "C'est obligatoire, et ça montre au recruteur qu'un parent est impliqué.",
      how: "Fais remplir le consentement par ton parent dans Nexus.",
    },
    {
      key: "coach_goals", type: "manual", manualKey: "coach_knows_goals",
      label: "Ton coach actuel connaît tes objectifs", done: readiness.coach_knows_goals === true,
      why: "Ton coach actuel, c'est ton plus gros allié. Les recruteurs l'appellent — s'il sait que tu vises le CÉGEP, il va te vendre.",
      how: "Assieds-toi avec lui. Dis-lui où tu veux jouer. Un coach au courant te défend; un coach surpris ne peut pas t'aider.",
    },
    {
      key: "numbers", type: "manual", manualKey: "knows_numbers",
      label: "Connais tes chiffres", done: readiness.knows_numbers === true,
      why: "Un recruteur va te demander ton 40 verges, ton développé, tes stats — sur le coup. Pas savoir, ça fait amateur.",
      how: "Apprends tes mesurables par cœur. Tes stats de saison aussi. Sois prêt à répondre sans hésiter.",
    },
    {
      key: "contacted", type: "manual", manualKey: "contacted_program",
      label: "Tu as contacté ou visité un programme", done: readiness.contacted_program === true,
      why: "Prendre les devants — écrire à un coach, aller à une journée portes ouvertes — ça montre que t'es sérieux et ça te met sur le radar tôt.",
      how: "Choisis un CÉGEP dans tes cibles, trouve le coach, envoie un courriel court et poli. Ou va voir un match, une pratique, un camp.",
    },
  ];
  const completedCount = checklist.filter((i) => i.done).length;
  const ringPct = Math.round((completedCount / checklist.length) * 100);
  const remaining = checklist.length - completedCount;
  const encouragement =
    remaining === 0
      ? "Tu es prêt. Vas-y."
      : remaining === 1
        ? "Plus qu'un élément avant d'être prêt pour la saison."
        : `Plus que ${remaining} éléments avant d'être prêt pour la saison.`;

  // Ring geometry — progress arc from 12 o'clock.
  const RING_R = 54;
  const RING_C = 2 * Math.PI * RING_R;
  const ringDash = (ringPct / 100) * RING_C;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-8">
      {/* ── Hero ── */}
      <div>
        <div className="inline-flex items-center gap-2.5 mb-4">
          <span className="w-8 h-px bg-[#E63946]" />
          <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.22em] uppercase text-[#E63946]">
            Saison {SEASON_LABEL}
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
        <h2 className="font-head text-lg sm:text-xl font-black text-white uppercase tracking-tight mb-9">
          Ta ligne du temps vers le CÉGEP
        </h2>

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
              className="absolute left-[12.5%] top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-gradient-to-r from-[#E63946]/60 to-[#E63946] transition-[width] duration-700 ease-out"
              style={{ width: `${fillWidth}%` }}
            />
            <div className="relative h-full flex">
              {steps.map((step, i) => (
                <div key={i} className="flex-1 flex items-center justify-center relative">
                  {step.state === "current" && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#E63946]/40 blur-md animate-pulse"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setPhase(step.phase)}
                    disabled={phaseSaving}
                    aria-label={`Marquer : ${step.label}`}
                    className={`relative transition-all duration-300 hover:scale-110 disabled:opacity-60 ${
                      step.state === "done"
                        ? "w-7 h-7 rounded-full bg-[#E63946] flex items-center justify-center"
                        : step.state === "current"
                          ? "w-7 h-7 rounded-full bg-[#E63946] ring-4 ring-[#E63946]/25 shadow-[0_0_14px_rgba(230,57,70,0.6)] flex items-center justify-center"
                          : "w-7 h-7 rounded-full bg-[#13151a] border-2 border-[#2D3748] hover:border-[#E63946]"
                    }`}
                  >
                    {step.state === "done" && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {step.state === "current" && (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3 — labels */}
          <div className="flex">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 px-1 text-center">
                <p
                  className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.06em] leading-tight transition-colors duration-300 ${
                    step.state === "upcoming" ? "text-[#6b7280]" : "text-white"
                  }`}
                >
                  {step.label}
                </p>
                {step.state === "current" && (
                  <p className="mt-1 text-[10px] text-[#6b7280]">Saison {SEASON_LABEL}</p>
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

            {/* Badges to chase — real DistinctionBadge emblems */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                Badges à viser
              </h3>
              <p className="text-[12px] text-[#6b7280] mt-1 mb-4">
                Décernés par ton entraîneur — continue de performer pour les mériter.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {NAMED_BADGES.map((key) => {
                  const earned = earnedBadges.has(key);
                  const detail = earnedBadges.get(key);
                  return (
                    <div
                      key={key}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                        earned
                          ? "bg-[#E63946]/[0.06] border-[#E63946]/25"
                          : "bg-[#13151a] border-[#2D3748]"
                      }`}
                    >
                      <div className={earned ? "" : "grayscale opacity-40"}>
                        <DistinctionBadge badge={key} detail={detail} size="lg" />
                      </div>
                      {earned ? (
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#E63946]">
                          Obtenu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                          À viser
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
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

      {/* ── Module 3 — Quand le CÉGEP cogne ── */}
      <section>
        <div className="flex items-baseline gap-2.5 mb-1">
          <span className="font-head text-base font-black text-[#E63946]">03</span>
          <span className="text-[#3a3d46]">·</span>
          <h2 className="font-head text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Quand le CÉGEP cogne
          </h2>
        </div>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed mb-6 max-w-2xl">
          Un recruteur peut t&apos;écrire demain. Sois prêt à répondre comme un pro. Coche chaque
          élément avant que la saison commence.
        </p>

        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            {/* Progress ring */}
            <div className="flex flex-col items-center text-center shrink-0 lg:w-[210px]">
              <div className="relative w-[150px] h-[150px]">
                <svg width="150" height="150" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r={RING_R} fill="none" stroke="#2D3748" strokeWidth="12" />
                  <circle
                    cx="70" cy="70" r={RING_R} fill="none" stroke="#E63946" strokeWidth="12"
                    strokeLinecap="round" strokeDasharray={`${ringDash} ${RING_C}`}
                    transform="rotate(-90 70 70)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-head text-4xl font-black text-white leading-none">
                    {ringPct}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mt-1.5">
                    prêt
                  </span>
                </div>
              </div>
              <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-5">{encouragement}</p>
            </div>

            {/* 11-item checklist */}
            <div className="flex-1 min-w-0 space-y-2">
              {checklist.map((item) => {
                const open = expanded.has(item.key);

                const labelEl = (
                  <span
                    className={`text-[14px] font-bold ${
                      item.done ? "text-[#6b7280] line-through" : "text-white"
                    }`}
                  >
                    {item.label}
                  </span>
                );

                // Why (always visible) + the "En savoir plus" accordion (how).
                const detail = (
                  <>
                    <p className="text-[12px] text-[#9CA3AF] leading-relaxed">{item.why}</p>
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.key)}
                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#6b7280] hover:text-white transition-colors mt-2"
                    >
                      En savoir plus
                      <svg
                        width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-[12px] text-[#6b7280] leading-relaxed pt-2">{item.how}</p>
                      </div>
                    </div>
                  </>
                );

                if (item.type === "manual" && item.manualKey) {
                  const mk = item.manualKey;
                  // Manual — a real toggleable checkbox: SQUARE box; the
                  // checkbox + label header is the toggle button.
                  return (
                    <div
                      key={item.key}
                      className={`rounded-lg border ${
                        item.done
                          ? "bg-[#22C55E]/[0.06] border-[#22C55E]/25"
                          : "bg-[#13151a] border-[#2D3748]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleManual(mk)}
                        disabled={togglingKey === mk}
                        className="w-full flex items-start gap-3 text-left px-4 pt-3.5 pb-2 cursor-pointer disabled:opacity-60"
                      >
                        {item.done ? (
                          <span className="w-6 h-6 shrink-0 rounded-md bg-[#22C55E] flex items-center justify-center mt-0.5">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                        ) : (
                          <span className="w-6 h-6 shrink-0 rounded-md border-2 border-[#6b7280] mt-0.5" />
                        )}
                        <span className="flex items-center gap-2 flex-wrap">
                          {labelEl}
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#E63946]/80">
                            À cocher toi-même
                          </span>
                        </span>
                      </button>
                      <div className="pr-4 pb-3.5 pl-[3.25rem]">{detail}</div>
                    </div>
                  );
                }

                // Auto — reflects data, NOT toggleable. A CIRCLE status
                // indicator (never an empty checkbox); the affordance is the
                // "Compléter" link, not the row.
                return (
                  <div
                    key={item.key}
                    className={`rounded-lg border ${
                      item.done
                        ? "bg-[#22C55E]/[0.06] border-[#22C55E]/25"
                        : "bg-[#13151a] border-[#2D3748]"
                    }`}
                  >
                    <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
                      {item.done ? (
                        <span className="w-6 h-6 shrink-0 rounded-full bg-[#22C55E] flex items-center justify-center mt-0.5">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      ) : (
                        <span className="w-6 h-6 shrink-0 rounded-full border-2 border-[#3a3d46] flex items-center justify-center mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3a3d46]" />
                        </span>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {labelEl}
                        {item.done && item.tag && (
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#22C55E]">
                            {item.tag}
                          </span>
                        )}
                        {!item.done && (
                          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6b7280]">
                            Suivi auto
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pr-4 pb-3.5 pl-[3.25rem]">
                      {detail}
                      {!item.done && item.href && (
                        <Link
                          href={item.href}
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors mt-2.5"
                        >
                          Compléter
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
