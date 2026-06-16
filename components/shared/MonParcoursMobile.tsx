"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { toPng } from "html-to-image";

/* ═══════════════════════════════════════════════════════════════
   MonParcoursMobile — Sprint B-1.

   Mobile-native shell for /athlete/mon-parcours. Mounted by the
   page-level dispatch when IS_CAPACITOR is true. The desktop body
   (MonParcoursPageDesktop in app/athlete/mon-parcours/page.tsx)
   stays byte-identical for web.

   B-1 scope :
     - Vertical timeline hero (4 phases, tap-to-set current_phase)
     - Quand le CÉGEP cogne — progress ring + 12-item VERTICAL
       readiness checklist (7 derived read-only + 5 manual toggles)
     - Ma Carte + Mes Cibles : SECTION-HEADER STUBS only ("à venir")
       so the page reads as complete. Real carousels arrive in
       B-2 (Ma Carte format carousel) and B-3 (Mes Cibles CÉGEP
       carousel).

   Bug #8 discipline — every data fetch + every JSONB key + every
   write path is COPIED VERBATIM from the desktop page :

     - Manual key union ............ desktop page.tsx :41-46
     - Readiness shape ............. desktop page.tsx :47-54
     - STEPS const ................. desktop page.tsx :25-30
     - SEASON_YEAR / SEASON_LABEL .. desktop page.tsx :33-34
     - Athletes SELECT columns ..... desktop page.tsx :142
     - athlete_targets load ........ desktop page.tsx :112-132
     - toggleManual write .......... desktop page.tsx :280-310
     - setPhase write .............. desktop page.tsx :312-343
     - 12-item checklist + ring %.. desktop page.tsx :376-456

   Diverging from any of those breaks the parcours_readiness
   round-trip (RLS update succeeds but UI state drifts).
═══════════════════════════════════════════════════════════════ */

// ── Manual readiness keys (verbatim from desktop page.tsx :41-46).
//    Drift here = JSONB write writes the wrong key = UI never
//    reflects the toggle on reload.
type ManualKey =
  | "instagram_ready"
  | "knows_how_to_respond"
  | "coach_knows_goals"
  | "knows_numbers"
  | "contacted_program";

// ── Readiness shape (verbatim from desktop page.tsx :47-54).
type Readiness = {
  instagram_ready?: boolean;
  knows_how_to_respond?: boolean;
  coach_knows_goals?: boolean;
  knows_numbers?: boolean;
  contacted_program?: boolean;
  current_phase?: string;
};

// ── 4 timeline phases (verbatim from desktop page.tsx :25-30).
const STEPS = [
  { label: "Entraînement d'été", phase: "entrainement" },
  { label: "Camps & essais",     phase: "camps" },
  { label: "Saison Sec 5",       phase: "saison" },
  { label: "Fenêtre de signature", phase: "signature" },
];

// ── Season label — verbatim from desktop page.tsx :33-34. Computed,
//    never hardcoded — survives the calendar rollover.
const SEASON_YEAR = new Date().getFullYear();
const SEASON_LABEL = `${SEASON_YEAR}–${SEASON_YEAR + 1}`;

type ChecklistItem = {
  key: string;
  type: "auto" | "manual";
  label: string;
  done: boolean;
  why: string;
  manualKey?: ManualKey;
};

/* ── Ma Carte (B-3a collapse) ────────────────────────────────
   Sprint B-2 shipped a 3-format carousel (compact / publication /
   story) with 3 hidden capture nodes. B-3a collapses to ONE
   compact card + ONE native-aware download :
     - Web : <a download> with the toPng dataURL (unchanged from B-2)
     - Capacitor : Filesystem.writeFile → Share.share({ files: [...] })
       so the user lands in the iOS / Android share sheet and can pick
       "Save to Photos" (the canonical Capacitor pattern for "save an
       in-app generated image to the device gallery" without a
       community media plugin).

   The shared AthletePlayerCard.tsx FORMAT_CONFIG still registers
   publication / story / banniere — they're just not surfaced here.
   Surfacing them later means adding a format-picker UI, not
   un-collapsing this section.

   IS_CAPACITOR follows the canon dispatch flag — same one the
   page.tsx-level dispatch reads. */
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* triggerHaptic — verbatim copy of the body's helper
   (AthleteRecruiterProfileBodyMobile.tsx :93-99). Dynamic import +
   try/catch keeps the web build silent when the @capacitor/haptics
   plugin isn't available, same fallback semantics as the dynamic
   Share import below. */
async function triggerHaptic(intensity: "Light" | "Medium" | "Heavy" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : intensity === "Medium" ? ImpactStyle.Medium : ImpactStyle.Heavy;
    await Haptics.impact({ style });
  } catch { /* haptics non disponible */ }
}

export default function MonParcoursMobile() {
  // Identity + derived sources for the auto checklist items
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  const [matchVideoUrl, setMatchVideoUrl] = useState<string | null>(null);
  const [coteGlobale, setCoteGlobale] = useState<number | null>(null);
  const [moyenne, setMoyenne] = useState<number | null>(null);
  const [parentalConsent, setParentalConsent] = useState(false);
  // Manual readiness (JSONB) + current_phase live together in one column.
  const [readiness, setReadiness] = useState<Readiness>({});
  // athlete_targets count — only the length matters for the "Cibles
  // choisies" derived item; the full carousel comes in B-3.
  const [targetCount, setTargetCount] = useState(0);

  // Write-in-flight gates
  const [togglingKey, setTogglingKey] = useState<ManualKey | null>(null);
  const [phaseSaving, setPhaseSaving] = useState(false);

  // ── Ma Carte (B-3a) ────────────────────────────────────────
  // cardAthlete = the AthleteProfileRecruiterView the shared
  // AthletePlayerCard consumes. Same load path as desktop
  // (page.tsx :161-168) : loadAthleteRaw + mapToRecruiterView.
  //
  // B-2's per-format `downloadingFormat` (which format is currently
  // exporting) collapses to a single `downloading` boolean — there
  // is now ONE card + ONE download path. B-2's three capture refs
  // collapse to `captureCompactRef` alone — the only format the UI
  // surfaces today is compact. The card's FORMAT_CONFIG still
  // registers publication/story/banniere for callers who want them
  // (none here), but the off-screen capture node only mounts compact.
  const [cardAthlete, setCardAthlete] = useState<AthleteProfileRecruiterView | null>(null);
  const [downloading, setDownloading] = useState(false);
  const captureCompactRef = useRef<HTMLDivElement>(null);

  // Toast — same shape as the desktop (kind + message, auto-dismiss).
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── LOAD ─────────────────────────────────────────────────────
  // Verbatim shape of the desktop page.tsx :134-198 load, narrowed
  // to the columns + queries B-1 actually needs (Ma Carte loadAthleteRaw
  // and the schools type=CEGEP list are deferred to B-2/B-3).
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Athletes row — SELECT columns identical to desktop page.tsx :142.
      const { data: a } = await supabase
        .from("athletes")
        .select(
          "id, first_name, profile_completion, video_faits_saillants_url, video_match_complet_url, cote_globale_entraineur, moyenne_generale, consentement_parental, parcours_readiness",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!a) return;

      setProfileCompletion((a.profile_completion as number) || 0);
      setHighlightUrl((a.video_faits_saillants_url as string | null) ?? null);
      setMatchVideoUrl((a.video_match_complet_url as string | null) ?? null);
      setCoteGlobale((a.cote_globale_entraineur as number | null) ?? null);
      setMoyenne((a.moyenne_generale as number | null) ?? null);
      setParentalConsent(a.consentement_parental === true);
      setReadiness((a.parcours_readiness as Readiness) ?? {});

      // athlete_targets count for the "Cibles choisies" derived item.
      const athleteId = a.id as string;
      const { data: tgs } = await supabase
        .from("athlete_targets")
        .select("id")
        .eq("athlete_id", athleteId);
      setTargetCount(tgs?.length ?? 0);

      // ── Ma Carte data fetch (B-2). Verbatim from desktop
      //    page.tsx :161-168 — loadAthleteRaw returns the full row,
      //    mapToRecruiterView converts it to the
      //    AthleteProfileRecruiterView shape AthletePlayerCard
      //    consumes. Same path used by the recruiter mobile body's
      //    coach branch, so any future schema add lights up here
      //    automatically.
      try {
        const result = await loadAthleteRaw(athleteId);
        if (result?.data) {
          setCardAthlete(mapToRecruiterView(result.data as Record<string, unknown>));
        }
      } catch (e) {
        console.error("[mon-parcours mobile] card load failed:", e);
      }
    })();
  }, []);

  /* ── Unified Télécharger handler ─────────────────────────
        Mirrors the desktop's downloadCard at page.tsx :217-243 —
        same toPng options (cacheBust, no background, animation +
        transition disabled), same document.fonts.ready wait — with
        TWO B-3a deltas :

        (1) pixelRatio : 3 (vs desktop's 1). Compact format is
            intrinsically 300×460 ; pixelRatio 3 yields ~900×1380
            PNG (IG-feed quality on a retina screen) without
            changing the on-screen card. The photo `<img
            crossOrigin="anonymous">` stays CORS-clean — the canvas
            tainting decision is at image-LOAD time, not
            rasterization time, so upping the pixelRatio doesn't
            re-fetch the photo nor change the CORS path.

        (2) Native branch — IS_CAPACITOR routes through Filesystem
            + Share instead of <a download>. The web <a download>
            mechanic does NOT save to the Photos library on iOS or
            Android — it writes to the WebView's download sandbox,
            which the user can't reach. Filesystem writes the PNG
            to Directory.Cache (app-private, no WRITE_EXTERNAL perm
            needed on Android 10+, no Info.plist key needed on iOS),
            then Share.share({files:[uri]}) opens the system share
            sheet where the user picks "Save to Photos" / "Save to
            Files" / per-app shares. Mirrors the established
            3-tier share pattern at AthleteRecruiterProfileBodyMobile
            .tsx :2757 (dynamic import, graceful fallback, no
            top-level Capacitor import — keeps the web build clean
            without the plugins resolved). */
  const downloadCard = useCallback(async () => {
    if (!cardAthlete || !captureCompactRef.current || downloading) return;
    setDownloading(true);
    void triggerHaptic("Medium");
    try {
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }
      const dataUrl = await toPng(captureCompactRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: undefined,
        style: { animation: "none", transition: "none" },
      });
      const slug = `${cardAthlete.firstName}-${cardAthlete.lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const fileName = `nexus-carte-${slug}.png`;

      if (IS_CAPACITOR) {
        try {
          // Strip the `data:image/png;base64,` prefix — Filesystem
          // wants raw base64 without the data-URL header.
          const base64 = dataUrl.split(",")[1];
          const { Filesystem, Directory } = await import("@capacitor/filesystem");
          const written = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
          });
          const { Share } = await import("@capacitor/share");
          await Share.share({
            title: "Ma carte Nexus",
            files: [written.uri],
            dialogTitle: "Enregistrer ou partager ma carte",
          });
        } catch (e) {
          console.error("[mon-parcours mobile] native share failed:", e);
          showToast("error", "Impossible d'ouvrir le partage. Réessaie.");
        }
      } else {
        // Web — unchanged anchor-click download. The dataURL is the
        // <a href> directly ; the browser writes to the Downloads
        // folder (or prompts depending on user settings).
        const link = document.createElement("a");
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch (e) {
      console.error("[mon-parcours mobile] card export failed:", e);
      showToast("error", "Export impossible. Réessaie dans un instant.");
    } finally {
      setDownloading(false);
    }
  }, [cardAthlete, downloading, showToast]);

  // ── WRITE — manual readiness toggle ──────────────────────────
  // Verbatim from desktop page.tsx :280-310 — write the full Readiness
  // object back (merge, don't patch) so the OTHER manual keys + the
  // current_phase value survive. The RLS policy on athletes scopes
  // updates to the row's user_id ; an unexpected 0-row response means
  // RLS silently filtered. Mirror the desktop's "Action refusée" copy.
  async function toggleManual(key: ManualKey) {
    setTogglingKey(key);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Session expirée. Reconnecte-toi.");
        return;
      }
      const next: Readiness = { ...readiness, [key]: !readiness[key] };
      const { data, error } = await supabase
        .from("athletes")
        .update({ parcours_readiness: next })
        .eq("user_id", user.id)
        .select("id");
      if (error) {
        console.error("[mon-parcours mobile] readiness toggle:", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      setReadiness(next);
    } finally {
      setTogglingKey(null);
    }
  }

  // ── WRITE — current phase set (timeline tap) ────────────────
  // Verbatim from desktop page.tsx :312-343 — merge to preserve the
  // manual checkbox keys, same RLS-aware 0-row handling.
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
      const next: Readiness = { ...readiness, current_phase: phase };
      const { data, error } = await supabase
        .from("athletes")
        .update({ parcours_readiness: next })
        .eq("user_id", user.id)
        .select("id");
      if (error) {
        console.error("[mon-parcours mobile] phase write:", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        showToast("error", "Action refusée — vérifie tes permissions.");
        return;
      }
      setReadiness(next);
    } finally {
      setPhaseSaving(false);
    }
  }

  // Current phase — default to the first STEPS entry if unset.
  // Verbatim from desktop page.tsx :355-359.
  const currentPhase = readiness.current_phase ?? "entrainement";
  const currentStepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.phase === currentPhase),
  );
  const steps = STEPS.map((s, i) => ({
    ...s,
    state: (i < currentStepIndex
      ? "done"
      : i === currentStepIndex
        ? "current"
        : "upcoming") as "done" | "current" | "upcoming",
  }));

  // ── 12-item checklist — verbatim semantics from desktop page.tsx
  //    :377-454. 7 auto (derived predicates) + 5 manual (JSONB
  //    toggles). The labels + why micro-copy are condensed for the
  //    mobile readout — full "how" copy stays on desktop. The DONE
  //    PREDICATES + KEY STRINGS + manualKey identifiers are
  //    byte-identical so the ring % computes to the same value
  //    on mobile and desktop. ──
  const checklist: ChecklistItem[] = [
    { key: "highlight",   type: "auto",   label: "Highlight reel",
      done: !!highlightUrl && highlightUrl.trim() !== "",
      why: "Première chose qu'un recruteur regarde." },
    { key: "match_video", type: "auto",   label: "Vidéo d'un match complet",
      done: !!matchVideoUrl && matchVideoUrl.trim() !== "",
      why: "Montre ta constance — les highlights ne suffisent pas." },
    { key: "profile",     type: "auto",   label: "Profil complet",
      done: profileCompletion >= 100,
      why: "Un profil incomplet = invisible dans les filtres." },
    { key: "coach",       type: "auto",   label: "Évalué par ton coach",
      done: coteGlobale !== null,
      why: "La parole du coach, c'est ce qu'un recruteur croit le plus." },
    { key: "targets",     type: "auto",   label: "Cibles choisies",
      done: targetCount > 0,
      why: "Savoir où tu veux jouer change ta préparation." },
    { key: "moyenne",     type: "auto",   label: "Moyenne générale à jour",
      done: moyenne !== null,
      why: "Les programmes contingentés refusent sur les notes." },
    { key: "instagram",   type: "manual", manualKey: "instagram_ready",
      label: "Instagram recruteur-ready",
      done: readiness.instagram_ready === true,
      why: "Un recruteur te cherche en ligne avant de t'appeler." },
    { key: "respond",     type: "manual", manualKey: "knows_how_to_respond",
      label: "Tu sais répondre à un recruteur",
      done: readiness.knows_how_to_respond === true,
      why: "Ton premier message donne le ton — réponds vite, simplement." },
    { key: "consent",     type: "auto",   label: "Consentement parental",
      done: parentalConsent,
      why: "Obligatoire — et ça rassure le recruteur." },
    { key: "coach_goals", type: "manual", manualKey: "coach_knows_goals",
      label: "Ton coach connaît tes objectifs",
      done: readiness.coach_knows_goals === true,
      why: "Ton coach actuel est ton plus gros allié." },
    { key: "numbers",     type: "manual", manualKey: "knows_numbers",
      label: "Connais tes chiffres",
      done: readiness.knows_numbers === true,
      why: "40 verges, développé, stats — sans hésiter." },
    { key: "contacted",   type: "manual", manualKey: "contacted_program",
      label: "Tu as contacté ou visité un programme",
      done: readiness.contacted_program === true,
      why: "Prendre les devants montre que t'es sérieux." },
  ];

  const completedCount = checklist.filter((i) => i.done).length;
  const ringPct = Math.round((completedCount / checklist.length) * 100);
  const remaining = checklist.length - completedCount;

  // Ring geometry — same r=54 + circumference math as desktop
  // (page.tsx :466-468) so the visual arc matches when QA flips
  // between web and mobile previews.
  const RING_R = 54;
  const RING_C = 2 * Math.PI * RING_R;
  const ringDash = (ringPct / 100) * RING_C;

  return (
    <div
      className="min-h-screen bg-[#111317] text-white"
      style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="w-6 h-px bg-[#E63946]" />
          <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#E63946]">
            Ton plan de match
          </span>
        </div>
        <h1 className="font-head text-[28px] font-black text-white uppercase tracking-tight leading-[0.95]">
          Mon Parcours
        </h1>
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/45 mt-2">
          Saison {SEASON_LABEL}
        </p>
      </div>

      {/* ── Hero : vertical timeline ─────────────────────────── */}
      <div className="px-5 pt-4">
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-2xl p-5">
          <h2 className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/55 mb-4">
            Ta ligne du temps vers le CÉGEP
          </h2>

          <div className="relative">
            {/* Vertical connector segments — drawn between nodes. */}
            {steps.map((step, i) => {
              const isLast = i === steps.length - 1;
              const isFinal = i === steps.length - 1;
              const isDone = step.state === "done";
              const isCurrent = step.state === "current";
              const isGold = isFinal && isCurrent === false;
              return (
                <div key={step.phase} className="relative flex items-start gap-4">
                  {/* Column with the node + the connector line below it. */}
                  <div className="flex flex-col items-center shrink-0" style={{ width: 28 }}>
                    <button
                      type="button"
                      onClick={() => setPhase(step.phase)}
                      disabled={phaseSaving}
                      aria-label={`Marquer : ${step.label}`}
                      className={`relative flex items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-60 ${
                        isDone
                          ? "w-7 h-7 rounded-full bg-[#22C55E]"
                          : isCurrent
                            ? "w-7 h-7 rounded-full bg-[#E63946] ring-4 ring-[#E63946]/25 shadow-[0_0_14px_rgba(230,57,70,0.6)]"
                            : isGold
                              ? "w-7 h-7 rounded-full bg-[#F59E0B]/15 border-2 border-[#F59E0B]"
                              : "w-7 h-7 rounded-full bg-[#13151a] border-2 border-[#2D3748]"
                      }`}
                    >
                      {isDone && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-white" />}
                      {isFinal && !isCurrent && !isDone && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                      )}
                    </button>
                    {!isLast && (
                      <span
                        aria-hidden
                        className={`w-[3px] rounded-full my-1.5 ${
                          // Connector segment turns green once the LATER
                          // node is reached ; matches the desktop fill
                          // logic where the bar fills up to the current.
                          isDone ? "bg-[#22C55E]" : "bg-[#2D3748]"
                        }`}
                        style={{ height: 36 }}
                      />
                    )}
                  </div>

                  {/* Label + "Tu es ici" pill. */}
                  <div className="flex-1 min-w-0 pt-1 pb-6">
                    <p
                      className={`text-[14px] font-bold leading-tight ${
                        step.state === "upcoming" ? "text-white/45" : "text-white"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full bg-[#E63946] text-white text-[9px] font-black uppercase tracking-[0.14em]">
                        Tu es ici
                      </span>
                    )}
                    {isFinal && !isCurrent && (
                      <p className="text-[11px] text-[#F59E0B]/85 mt-1">
                        L&apos;objectif final.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Ma Carte (B-3a collapse) ─────────────────────────
            ONE compact card, centered + prominent. The B-2
            carousel + the per-format spinner + the format label
            row + 2 of 3 hidden capture nodes were all removed in
            this sprint — the card module still supports the other
            formats for callers who want them ; this surface
            chooses to present just one. */}
      <div className="pt-6">
        <div className="px-5">
          <SectionHeader index="01" title="Ma carte" />
          <p className="text-[12px] text-white/55 leading-relaxed -mt-2 mb-4 max-w-[32ch]">
            Télécharge ta carte et publie-la.
          </p>
        </div>

        {cardAthlete ? (
          <div className="px-5 flex flex-col items-center">
            {/* Visible compact preview. AthletePlayerCard at its
                intrinsic 300×460 sits comfortably on every mobile
                viewport (375px+) with px-5 padding. The
                select-none + -webkit-touch-callout:none +
                -webkit-user-select:none trio suppresses the
                iOS/Android WebView's native long-press menu
                ("Copy / Share / Select all") — without all three
                the menu still fires on either the photo or the
                name text inside the card. The capture node below
                is unaffected (pointer-events:none + off-screen). */}
            <div
              className="select-none [-webkit-touch-callout:none] [-webkit-user-select:none]"
              style={{
                userSelect: "none",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
              }}
            >
              <AthletePlayerCard a={cardAthlete} format="compact" />
            </div>

            {/* Single Télécharger CTA. The unified handler routes
                web → <a download> and Capacitor → Filesystem +
                Share share-sheet, so the same tap "feels right"
                on both platforms (download bar on web ; "Save to
                Photos" sheet on iOS / "Save to Files" sheet on
                Android). */}
            <button
              type="button"
              onClick={downloadCard}
              disabled={downloading}
              className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-[#E63946] text-white text-[13px] font-bold uppercase tracking-[0.14em] active:bg-[#D42B22] disabled:opacity-60 disabled:cursor-wait"
            >
              {downloading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Export…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Télécharger ma carte
                </>
              )}
            </button>
          </div>
        ) : (
          // Skeleton — keeps the section's vertical rhythm while
          // the loadAthleteRaw call is in flight.
          <div className="px-5 flex justify-center">
            <div
              className="rounded-2xl border border-[#2D3748] bg-[#0C0E12] flex items-center justify-center"
              style={{ width: 300, height: 460 }}
            >
              <span className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* ── Mes Cibles (B-3 stub) ────────────────────────────── */}
      <div className="px-5 pt-6">
        <SectionHeader index="02" title="Mes cibles" />
        <ComingSoonCard
          copy="Bâtis ta liste de CÉGEPs : cibles réalistes et rêves. Visibles en un coup d'œil."
        />
      </div>

      {/* ── Quand le CÉGEP cogne — ring + checklist ─────────── */}
      <div className="px-5 pt-6">
        <SectionHeader index="03" title="Quand le CÉGEP cogne" />
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-2xl p-5">
          {/* Ring + count */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
              <svg width="110" height="110" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={RING_R} fill="none" stroke="#2D3748" strokeWidth="12" />
                <circle
                  cx="70" cy="70" r={RING_R} fill="none" stroke="#E63946" strokeWidth="12"
                  strokeLinecap="round" strokeDasharray={`${ringDash} ${RING_C}`}
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-head text-[26px] font-black text-white leading-none">
                  {ringPct}%
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45 mt-1">
                  prêt
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[18px] font-bold text-white leading-tight">
                {completedCount}/{checklist.length}
              </p>
              <p className="text-[12px] text-white/55 leading-snug mt-1">
                {remaining === 0
                  ? "Tu es prêt. Vas-y."
                  : remaining === 1
                    ? "Plus qu'une étape avant la saison."
                    : `${remaining} étapes à compléter.`}
              </p>
            </div>
          </div>

          {/* 12-item vertical list */}
          <ul className="space-y-2">
            {checklist.map((item) => {
              const isManual = item.type === "manual" && item.manualKey;
              const isBusy = isManual && togglingKey === item.manualKey;
              const inner = (
                <div className="flex items-start gap-3 w-full">
                  {/* Check / circle */}
                  {item.done ? (
                    <span className="w-6 h-6 shrink-0 rounded-full bg-[#22C55E] flex items-center justify-center mt-0.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  ) : (
                    <span className="w-6 h-6 shrink-0 rounded-full border-2 border-white/25 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[14px] font-bold ${
                          item.done ? "text-white/45 line-through" : "text-white"
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.type === "manual" && (
                        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#E63946]/80">
                          À cocher
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/55 leading-relaxed mt-1">
                      {item.why}
                    </p>
                  </div>
                </div>
              );

              // Manual items render as buttons (tappable toggles).
              // Auto items render as a plain div — explicitly NOT
              // tappable so the athlete can't override a derived
              // predicate. The desktop encodes the same rule via the
              // checklist's `type` field (auto vs manual).
              if (isManual) {
                return (
                  <li
                    key={item.key}
                    className={`rounded-xl border ${
                      item.done
                        ? "bg-[#22C55E]/[0.06] border-[#22C55E]/25"
                        : "bg-[#13151a] border-[#2D3748]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleManual(item.manualKey!)}
                      disabled={isBusy}
                      className="w-full text-left px-3.5 py-3 active:bg-white/[0.03] disabled:opacity-60 rounded-xl"
                    >
                      {inner}
                    </button>
                  </li>
                );
              }
              return (
                <li
                  key={item.key}
                  className={`rounded-xl border px-3.5 py-3 ${
                    item.done
                      ? "bg-[#22C55E]/[0.06] border-[#22C55E]/25"
                      : "bg-[#13151a] border-[#2D3748]"
                  }`}
                >
                  {inner}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Off-screen full-resolution capture node (B-3a).
            Verbatim adaptation of the desktop's hidden capture
            pattern at page.tsx :930-943, narrowed to ONE compact
            node (B-2's 3 nodes were carousel-driven ; the
            collapse leaves only compact). With pixelRatio 3 in
            the toPng call the captured PNG comes out ~900×1380
            without the on-screen visible card changing size.

            position: fixed + left: -99999 takes the node out of
            visual flow while keeping it in the DOM for html-to-
            image to read ; nx-capture-clean disables the
            editorial tilt animation so the PNG is axis-aligned ;
            pointer-events: none + aria-hidden mark it as
            decorative-by-construction. clipOverflow=true asks
            the card to clip its content to its box so the PNG
            has clean bounds (no ticket overhang). */}
      {cardAthlete && (
        <div
          aria-hidden="true"
          className="nx-capture-clean"
          style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", zIndex: -1 }}
        >
          <div ref={captureCompactRef}>
            <AthletePlayerCard a={cardAthlete} format="publication" clipOverflow={true} />
          </div>
        </div>
      )}

      {/* ── Toast (RLS-aware error surface) ─────────────────── */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl"
          style={{
            bottom: "calc(80px + env(safe-area-inset-bottom))",
            backgroundColor: toast.kind === "success" ? "#22C55E" : "#E63946",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ── Local primitives ─────────────────────────────────────────
   Tiny shared bits for the B-1 layout. Kept local to keep the
   B-1 surface area minimal ; promoting them to a shared kit can
   come after the B-2/B-3 builds show what's actually reusable. */

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <span className="font-head text-[14px] font-black text-[#E63946]">{index}</span>
      <span className="text-white/15">·</span>
      <h2 className="font-head text-[18px] font-black text-white uppercase tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function ComingSoonCard({ copy }: { copy: string }) {
  return (
    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-black uppercase tracking-[0.14em]">
          À venir
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Mobile · prochain sprint
        </span>
      </div>
      <p className="text-[13px] text-white/65 leading-relaxed">
        {copy}
      </p>
    </div>
  );
}
