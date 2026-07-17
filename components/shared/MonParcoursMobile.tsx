"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { createClient } from "@/lib/supabase/client";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { SearchSheet } from "@/components/mobile/SearchSheet";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useAthleteVisibilityPro, type CegepDetail } from "@/hooks/useAthleteVisibility";
import { MON_PARCOURS_COTE_COPY } from "@/lib/config/parcoursCoteCopy";
import { parseDistinctions, BADGE_ORDER, type DistinctionEntry } from "@/lib/config/badges";
import DistinctionBadge from "@/components/shared/DistinctionBadge";

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

/* ── Mes Cibles types + helpers (B-3) ────────────────────────
   Mirrors desktop page.tsx :39-40 + :70-77. TargetRow is the
   shape returned by the loadTargets join (athlete_targets +
   schools); Cegep is the shape returned by the schools type=CEGEP
   list-fetch that drives the SearchSheet picker.

   `pickOne` normalizes the PostgREST join shape — depending on
   driver version it may surface a single object or a 1-element
   array. `locationLine` is the desktop's compact "city · region"
   subtitle used on both the target card and the picker row. */
type TargetRow = {
  id: string;
  schoolId: string;
  name: string;
  city: string | null;
  region: string | null;
};
type Cegep = { id: string; name: string; city: string | null; region: string | null };

function pickOne<T>(rel: T | T[] | null | undefined): T | null {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel ?? null;
}

function locationLine(city: string | null, region: string | null): string {
  return [city, region].filter(Boolean).join(" · ");
}

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

/* normalizeCoteKey — defensive cast of athletes.cote_globale_entraineur
   (numeric column, can be a DECIMAL like 2.5 or null) into an integer
   star-key 0-5. Rounds to nearest integer per the brief recommendation
   ("a 2.5 athlete reads as closer to 3") then clamps to the supported
   key range. null/NaN → 0 (the "Pas encore évalué" rating-copy slot).
   Single source of truth — used by BOTH Ta Cote (screen 2) and Langue
   commune "TOI" rung (screen 3) so they always agree on the same key. */
function normalizeCoteKey(n: number | null | undefined): 0 | 1 | 2 | 3 | 4 | 5 {
  if (n == null || Number.isNaN(n)) return 0;
  const rounded = Math.round(n);
  return Math.max(0, Math.min(5, rounded)) as 0 | 1 | 2 | 3 | 4 | 5;
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

  /* B-3b-2b — distinctions loaded from evaluations.distinctions JSONB via
     the embedded join in the athletes-row SELECT below. Parsed once via
     parseDistinctions() so legacy string arrays + new {badge, detail}
     objects both normalize to DistinctionEntry[]. Drives the Badges
     screen's obtenu/à-viser grid. Empty array when not yet evaluated. */
  const [distinctions, setDistinctions] = useState<DistinctionEntry[]>([]);

  /* ── Mes Cibles state (B-3, verbatim mirror of desktop
        page.tsx :104-110). targets feeds the carousel + the
        "Cibles choisies" checklist derivation ; cegeps + the
        picker triplet feed the SearchSheet. athleteId is the
        own-row id used by addTarget / removeTarget — same
        value setA() exposes elsewhere but kept as a local
        narrowing for the section. */
  const [athleteId, setAthleteId] = useState<string | null>(null);
  // Photo en dataURL pour la capture (inline → aucun fetch réseau/cross-origin
  // pendant toPng, qui sortait la photo blanche sous capacitor://).
  const [capturePhotoUrl, setCapturePhotoUrl] = useState<string | null>(null);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [cegeps, setCegeps] = useState<Cegep[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

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

  /* B-3b — Ma Carte 3-screen carousel state. activeIndex drives the
     dot indicator + the haptic-on-snap fire ; prevActiveRef debounces
     the haptic so mid-momentum scrolling doesn't pulse repeatedly. */
  const [activeIndex, setActiveIndex] = useState(0);
  const prevActiveRef = useRef(0);

  // Toast — same shape as the desktop (kind + message, auto-dismiss).
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* loadTargets — verbatim from desktop page.tsx :128-148. The
     schools!school_id join pulls name/city/region in one query
     (no N+1). Output rows are ordered by created_at so the
     carousel reflects insertion order — same as desktop. status
     is intentionally NOT selected this sprint (no CIBLE/RÊVE
     pill yet) ; the column defaults to 'CIBLE' server-side per
     Sprint A's migration. */
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

  // ── LOAD ─────────────────────────────────────────────────────
  // Verbatim shape of the desktop page.tsx :134-198 load, narrowed
  // to the columns + queries B-1 actually needs (Ma Carte loadAthleteRaw
  // and the schools type=CEGEP list are deferred to B-2/B-3).
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Athletes row — SELECT columns identical to desktop page.tsx :142,
      // plus B-3b-2b : evaluations(distinctions) embedded join for the new
      // Badges screen (single round-trip ; at most 1 evaluations row per
      // athlete via UNIQUE(coach_id, athlete_id)).
      const { data: a } = await supabase
        .from("athletes")
        .select(
          "id, first_name, profile_completion, video_faits_saillants_url, video_match_complet_url, cote_globale_entraineur, moyenne_generale, consentement_parental, parcours_readiness, evaluations(distinctions, updated_at)",
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

      /* B-3b-2b — PostgREST embedded join surfaces evaluations as either an
         array (the canonical 1-to-many embed) or a single object (when the
         driver collapses 1-row joins). pickOne-style normalization handles
         both ; parseDistinctions() further accepts legacy string-array
         and new {badge, detail} object shapes. Empty array for not-yet-
         evaluated athletes → Badges screen renders all 6 as "à viser". */
      const evalsRaw = (a as { evaluations?: unknown }).evaluations;
      const evalRow = selectBestEvaluation(Array.isArray(evalsRaw) ? evalsRaw : evalsRaw ? [evalsRaw] : []) as { distinctions?: unknown } | null;
      setDistinctions(parseDistinctions(evalRow?.distinctions));

      /* Module 2 — saved targets + the CÉGEP list for the picker.
         Verbatim from desktop page.tsx :206-213. loadTargets
         drives both the carousel display + the "Cibles choisies"
         derived checklist item (replaces B-1's count-only fetch).
         The schools type=CEGEP list is loaded ONCE on mount ; the
         picker filters client-side via addableCegeps. */
      const id = a.id as string;
      setAthleteId(id);
      await loadTargets(id);
      const { data: cegepRows } = await supabase
        .from("schools")
        .select("id, name, city, region")
        .eq("type", "CEGEP")
        .order("name", { ascending: true });
      setCegeps((cegepRows as Cegep[] | null) ?? []);

      // ── Ma Carte data fetch (B-2). Verbatim from desktop
      //    page.tsx :161-168 — loadAthleteRaw returns the full row,
      //    mapToRecruiterView converts it to the
      //    AthleteProfileRecruiterView shape AthletePlayerCard
      //    consumes. Same path used by the recruiter mobile body's
      //    coach branch, so any future schema add lights up here
      //    automatically.
      try {
        const result = await loadAthleteRaw(id);
        if (result?.data) {
          setCardAthlete(mapToRecruiterView(result.data as Record<string, unknown>));
        }
      } catch (e) {
        console.error("[mon-parcours mobile] card load failed:", e);
      }
    })();
  }, [loadTargets]);

  /* ── addTarget / removeTarget — verbatim from desktop
        page.tsx :245-294. Same RLS-aware 0-row checks (an
        unexpected empty .select("id") response after an INSERT
        or DELETE means RLS silently filtered the row write —
        surface as "Action refusée" so the user knows the click
        registered but didn't take effect). status is NOT passed
        on INSERT ; the column defaults to 'CIBLE' server-side
        (Sprint A migration). */
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
        console.error("[mon-parcours mobile] add target:", error);
        showToast("error", `Erreur : ${error.message}`);
        return;
      }
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
        console.error("[mon-parcours mobile] remove target:", error);
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

  /* addableCegeps — verbatim mirror of desktop page.tsx :371-376.
     Hides already-targeted CÉGEPs from the picker + applies the
     search-input filter client-side. Order preserves the
     name-ASC sort from the schools list-fetch. */
  const targetedIds = new Set(targets.map((t) => t.schoolId));
  const q = search.trim().toLowerCase();
  const addableCegeps = cegeps
    .filter((c) => !targetedIds.has(c.id))
    .filter((c) => (q ? c.name.toLowerCase().includes(q) : true));

  /* ── Pro tier check (single read, drives the recruiter badges).
        canSee("who_viewed") is the canon flag for "athlete sees
        recruiter-view data per CÉGEP" — mirrors the gate used at
        app/athlete/visibilite/page.tsx :174 + :179. The tier is
        read ONCE here ; the actual recruiter fetch is gated below
        by mounting <ProRecruiterBadgesLoader> only when this flag
        is true. Free athletes never trigger the
        useAthleteVisibilityPro hook → no athlete_view_details
        query, no recruiter names in the network tab. */
  const { canSee, loading: subscriptionLoading } = useSubscription();
  const showProBadges = !subscriptionLoading && canSee("who_viewed");

  /* recruiterBadgeMap is null while loading OR when free ;
     TargetCard renders nothing in the badge slot in that case.
     Pro path: <ProRecruiterBadgesLoader> fetches once + setter
     populates the Map<cegepName, CegepDetail>. */
  const [recruiterBadgeMap, setRecruiterBadgeMap] = useState<Map<string, CegepDetail> | null>(null);

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
      // Photo → dataURL locale pour la capture : on charge l'image
      // (crossOrigin, cache-bust pour une réponse CORS propre), on la
      // DOWNSCALE (max 1080px + JPEG 0.9 — une photo 24 Mpx donnait un dataURL
      // de 32 Mo que html-to-image ignorait), puis on la passe au nœud capturé.
      if (cardAthlete.photoUrl && !cardAthlete.photoUrl.startsWith("data:")) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const sep = cardAthlete.photoUrl.includes("?") ? "&" : "?";
          img.src = `${cardAthlete.photoUrl}${sep}nxcors=${Date.now()}`;
          await img.decode();
          const maxW = 1080;
          const sc = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
          const cw = Math.max(1, Math.round(img.naturalWidth * sc));
          const ch = Math.max(1, Math.round(img.naturalHeight * sc));
          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          if (ctx && canvas.width > 0) {
            ctx.drawImage(img, 0, 0, cw, ch);
            setCapturePhotoUrl(canvas.toDataURL("image/jpeg", 0.9));
            await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          }
        } catch { /* photo absente / canvas tainté → fallback URL distante */ }
      }
      // Safari/WKWebView : le 1er rendu html-to-image RATE souvent les images
      // embarquées (foreignObject) → photo blanche, alors que le web (Chrome)
      // les rend du 1er coup. Workaround connu : appeler toPng 2× (le 1er
      // "réchauffe"/charge les images, le 2e les rend) et garder le 2e.
      const toPngOpts = {
        pixelRatio: 1,
        backgroundColor: undefined,
        style: { animation: "none", transition: "none" },
      };
      // Lazy : html-to-image n'est chargé qu'au tap export (hors bundle initial).
      const { toPng } = await import("html-to-image");
      await toPng(captureCompactRef.current, toPngOpts);   // warm-up Safari
      const dataUrl = await toPng(captureCompactRef.current, toPngOpts);
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
      setCapturePhotoUrl(null);   // retire l'override dataURL (revient à l'URL distante à l'écran)
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
      done: targets.length > 0,
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
      <div
        className="px-5 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
      >
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

      {/* ── Ma Carte (B-3b) — 3-screen horizontal peek-next snap
            carousel : (1) the player Card + Télécharger CTA,
            (2) Ta Cote (star-scale hero + static "talk to your coach"
            block), (3) Langue commune (5 rungs, athlete's current
            rung marked "TOI"). Carousel containment mirrors Mes Cibles
            exactly — w-full min-w-0 is the firewall against
            horizontal page-drift. The 4th screen (Badges à viser)
            is deferred to B-3b-2 ; this sprint ships 3 screens + 3
            dots. */}
      <div className="pt-6">
        <div className="px-5">
          <SectionHeader index="01" title="Ma carte" />
          <p className="text-[12px] text-white/55 leading-relaxed -mt-2 mb-4 max-w-[32ch]">
            Télécharge ta carte et publie-la.
          </p>
        </div>

        {cardAthlete ? (
          <>
            <div
              className="w-full min-w-0 overflow-x-auto nx-no-scrollbar flex gap-3 snap-x snap-mandatory px-5"
              style={{ scrollPaddingLeft: 20, scrollPaddingRight: 20 }}
              onScroll={(e) => {
                const el = e.currentTarget;
                const firstChild = el.firstElementChild as HTMLElement | null;
                if (!firstChild) return;
                const cardW = firstChild.offsetWidth;
                const gap = 12;
                const next = Math.max(0, Math.min(3, Math.round(el.scrollLeft / (cardW + gap))));
                if (next !== prevActiveRef.current) {
                  prevActiveRef.current = next;
                  setActiveIndex(next);
                  triggerHaptic("Light");
                }
              }}
            >
              {/* SCREEN 1 (B-3b-2c) — Ta Cote-style boxed container holding the
                  FULL player card + Télécharger button INSIDE the box, with the
                  canon wow idle-bounce + sheen-sweep enabled. Mirrors screen 2's
                  exact box (rounded-2xl, red-left-border, #1A1D24, height: 560).
                  The card renders at intrinsic 300×460 inside a scale(0.85) wrapper
                  — the OUTER scale wrapper has NO overflow:hidden, so the card's
                  intentional badge + ticket overhangs render fully (the B-3b-2a
                  "TA cut off" bug came from overflow:hidden clipping those). The
                  outer Ta Cote box's overflow:hidden only rounds the corners ;
                  card overhangs sit within the box's internal padding zone, well
                  away from the rounded corners.

                  TRANSFORM STACK (outer → inner, each on its own element so all
                  compose multiplicatively, none collide) :
                    1. layout-reservation div     — no transform, just sizing 255×391
                    2. scale wrapper              — transform: scale(0.85)
                    3. .nx-wow-idle wrapper       — animation: nx-wow-idle-float
                                                    (translateY 0 → -4px, scale 1 → 1.005)
                    4. AthletePlayerCard outer    — no transform (compact scale=1)
                    5. .nx-v30-card               — transform: rotate(-2deg)  (editorial tilt)
                    6. .nx-v30-ticket             — transform: rotate(3.5deg) (ticket tilt)

                  Sheen overlay is a sibling of AthletePlayerCard inside .nx-wow-idle
                  (mirrors AthleteOnboardingWowMobile.tsx :428-435 inline JSX pattern
                  since `nx-wow-sheen` is a @keyframes, not a class). The overlay's
                  own overflow:hidden clips the sweeping gradient ; the card's
                  overhangs render through OUTSIDE the sheen overlay (positioned
                  absolute inset:0 over the 300×460 card body only). */}
              <div
                className="snap-start shrink-0 flex"
                style={{ width: "calc(100vw - 64px)", height: 560 }}
              >
                <div
                  className="w-full rounded-2xl bg-[#1A1D24] border border-[#2D3748] overflow-hidden flex flex-col"
                  style={{ borderLeft: "3px solid #E63946" }}
                >
                  <div className="px-5 pt-4 pb-3">
                    <p className="text-[10px] font-black tracking-[0.25em] uppercase text-[#E63946]">Ma carte</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-5 pb-5">
                    <div
                      className="select-none [-webkit-touch-callout:none] [-webkit-user-select:none]"
                      style={{
                        userSelect: "none",
                        WebkitTouchCallout: "none",
                        WebkitUserSelect: "none",
                      }}
                    >
                      {/* Layout reservation — reserves SCALED footprint (255×391)
                          in flow so the button below sits 20px under the visible
                          card bottom, not under the unscaled 460px DOM extent.
                          No overflow:hidden — overhangs render fully. */}
                      <div style={{ position: "relative", width: 255, height: 391 }}>
                        {/* Scale wrapper — visual scale only, transform-only,
                            transform-origin top-left so the scaled visual aligns
                            with the reservation div's top-left. */}
                        <div
                          style={{
                            transform: "scale(0.85)",
                            transformOrigin: "top left",
                            width: 300,
                            height: 460,
                          }}
                        >
                          {/* Wow-A consolidation : the external .nx-wow-idle
                              wrapper + sheen overlay shipped earlier this
                              session collapsed into AthletePlayerCard's new
                              `animate` prop. The prop applies the same
                              .nx-wow-idle + 4500ms sheen sweep internally —
                              one place to maintain, single mechanism across
                              all visible call sites. */}
                          <AthletePlayerCard a={cardAthlete} format="compact" animate />
                        </div>
                      </div>
                    </div>
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
                </div>
              </div>

              {/* SCREEN 2 — Ta Cote. coteGlobale comes from the existing
                  athletes row load (L155/L254). The 0 key handles the
                  not-yet-evaluated state ; the CTA block is a static
                  styled div (no routing per founder). */}
              {(() => {
                /* Defensive : coteGlobale is athletes.cote_globale_entraineur (numeric,
                   can be DECIMAL like 2.5 or null). Normalize to 0-5 integer once ;
                   the ?? rating[0] fallback is belt-and-braces — even with the clamp,
                   any future key drift falls back to the "Pas encore évalué" copy
                   instead of crashing on undefined.hero. */
                const coteKey = normalizeCoteKey(coteGlobale);
                const ratingCopy = MON_PARCOURS_COTE_COPY.rating[coteKey] ?? MON_PARCOURS_COTE_COPY.rating[0];
                return (
                  <div
                    className="snap-start shrink-0 flex"
                    style={{ width: "calc(100vw - 64px)", height: 560 }}
                  >
                    <div className="w-full rounded-2xl bg-[#1A1D24] border border-[#2D3748] overflow-hidden flex flex-col" style={{ borderLeft: "3px solid #E63946" }}>
                      <div className="px-5 pt-4 pb-3">
                        <p className="text-[10px] font-black tracking-[0.25em] uppercase text-[#E63946]">Ta cote</p>
                      </div>
                      <div className="px-5 pb-5 flex-1 flex flex-col gap-3 overflow-y-auto nx-no-scrollbar">
                        {/* Star row uses coteKey so the rendered star count matches the
                            copy : a 2.5 athlete is normalized to 3 (Math.round), so 3
                            gold stars + the 3★ rating-copy. Star count and copy agree. */}
                        <div className="flex items-center gap-1.5" aria-label={`Cote ${coteKey} sur 5`}>
                          {[1, 2, 3, 4, 5].map((i) => {
                            const filled = i <= coteKey;
                            return (
                              <svg
                                key={i}
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                fill={filled ? "#F59E0B" : "none"}
                                stroke={filled ? "#F59E0B" : "#4a4d56"}
                                strokeWidth="2"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            );
                          })}
                        </div>
                        <h3 className="font-head text-[20px] font-black text-white leading-tight">{ratingCopy.hero}</h3>
                        <p className="text-[13px] text-[#E0E0E0] leading-relaxed font-semibold">{ratingCopy.sub}</p>
                        {/* Long-form motivational body — fills the empty space the
                            mockup showed below the sub line. Slightly muted vs sub
                            so the hierarchy reads hero → sub → detail at a glance. */}
                        <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{ratingCopy.detail}</p>
                        <div className="mt-auto rounded-xl bg-[#13151a] border border-[#E63946]/25 px-4 py-3.5">
                          <p className="text-[13px] font-bold text-white leading-snug">{ratingCopy.cta}</p>
                          <p className="text-[12px] text-[#9CA3AF] mt-1 leading-snug">Il peut t&apos;aider à atteindre ton objectif.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SCREEN 3 — Badges à viser (B-3b-2b). Same Ta Cote-style box.
                  Renders the 6 named badges (BADGE_ORDER minus "custom" — custom
                  is free-text, not a goal). Each badge marked OBTENU (full color,
                  red label) or À VISER (locked : opacity 0.35 + grayscale(1) +
                  muted label) via an EXTERNAL wrapper div — the shared
                  DistinctionBadge component is NOT modified (used by /athlete/profil
                  + partner views). */}
              <div
                className="snap-start shrink-0 flex"
                style={{ width: "calc(100vw - 64px)", height: 560 }}
              >
                <div className="w-full rounded-2xl bg-[#1A1D24] border border-[#2D3748] overflow-hidden flex flex-col" style={{ borderLeft: "3px solid #E63946" }}>
                  <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
                    <p className="text-[10px] font-black tracking-[0.25em] uppercase text-[#E63946]">Badges à viser</p>
                  </div>
                  <div className="px-5 py-3 flex-1 flex flex-col gap-2 overflow-hidden">
                    <p className="text-[12px] text-[#9CA3AF] leading-snug">
                      Décernés par ton coach — voici ce qui t&apos;attend.
                    </p>
                    {(() => {
                      /* Obtenu vs à-viser derivation per the brief : 6 named
                         badges (BADGE_ORDER minus "custom"). The OBTENU/À VISER
                         pill labels were dropped in favor of pure visual signal
                         (full-color + drop-shadow vs grayscale + opacity 0.35)
                         so all 6 badges fit the 560px box without scroll. */
                      const obtainedKeys = new Set(distinctions.map((d) => d.badge));
                      const aimableBadges = BADGE_ORDER
                        .filter((k) => k !== "custom")
                        .map((badgeKey) => ({
                          badge: badgeKey,
                          detail: distinctions.find((o) => o.badge === badgeKey)?.detail,
                          obtained: obtainedKeys.has(badgeKey),
                        }));
                      return (
                        <div className="grid grid-cols-2 gap-2 flex-1">
                          {aimableBadges.map((b) => (
                            <div
                              key={b.badge}
                              className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-[#13151a]/40 border border-transparent"
                            >
                              {/* Locked styling via EXTERNAL wrapper — opacity
                                  + grayscale filter applied to the wrapper, NOT
                                  to DistinctionBadge itself (shared component
                                  stays untouched). The colored vs grayscale
                                  signal carries the obtenu/à-viser meaning on
                                  its own — no per-cell text label needed. */}
                              <div
                                style={{
                                  opacity: b.obtained ? 1 : 0.35,
                                  filter: b.obtained ? "none" : "grayscale(1)",
                                  transition: "opacity 200ms ease, filter 200ms ease",
                                }}
                              >
                                <DistinctionBadge badge={b.badge} detail={b.detail} size="sm" />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* SCREEN 4 — Langue commune. 5 rungs ordered index 0 = 5★.
                  Current rung index = 5 - coteGlobale (so a 4★ athlete is on
                  the index-1 rung). If coteGlobale is 0/null, no "TOI" pill
                  fires — the athlete isn't on any rung yet. */}
              <div
                className="snap-start shrink-0 flex"
                style={{ width: "calc(100vw - 64px)", height: 560 }}
              >
                <div className="w-full rounded-2xl bg-[#1A1D24] border border-[#2D3748] overflow-hidden flex flex-col">
                  <div className="px-5 pt-4 pb-3 border-b border-white/[0.06]">
                    <p className="text-[10px] font-black tracking-[0.25em] uppercase text-[#E63946]">Langue commune</p>
                  </div>
                  <div className="px-5 py-4 flex-1 flex flex-col gap-3 overflow-y-auto nx-no-scrollbar">
                    <p className="text-[13px] text-[#E0E0E0] leading-relaxed">{MON_PARCOURS_COTE_COPY.langueIntro}</p>
                    {/* Rung spacing bumped from space-y-1.5 → space-y-2 and rung
                        py-2.5 → py-3 — the screen has ~165px headroom under the
                        old layout, this lets the rungs breathe and matches the
                        screenshot's slightly more generous vertical rhythm. */}
                    <div className="space-y-2">
                      {(() => {
                        /* Same normalization as screen 2 so the "TOI" rung matches
                           the Ta Cote copy : a 2.5 athlete → coteKey=3 → marked on
                           the 3★ rung (index 2). coteKey===0 means not yet rated,
                           guard skips the pill entirely. */
                        const coteKey = normalizeCoteKey(coteGlobale);
                        return MON_PARCOURS_COTE_COPY.rungs.map((rung, i) => {
                        const stars = 5 - i;
                        const isCurrent = coteKey > 0 && stars === coteKey;
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-3 px-3 py-3 rounded-lg ${
                              isCurrent
                                ? "bg-[#E63946]/10 border border-[#E63946]/30"
                                : "bg-[#13151a]/40 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-0.5 shrink-0 pt-0.5" aria-hidden>
                              {Array.from({ length: stars }).map((_, j) => (
                                <svg key={j} width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden>
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              ))}
                            </div>
                            <p className={`flex-1 text-[12px] leading-snug ${isCurrent ? "text-white font-semibold" : "text-[#9CA3AF]"}`}>
                              {rung}
                            </p>
                            {isCurrent && (
                              <span className="text-[9px] font-black tracking-[0.18em] uppercase bg-[#E63946] text-white px-2 py-0.5 rounded-full shrink-0">
                                TOI
                              </span>
                            )}
                          </div>
                        );
                        });
                      })()}
                    </div>
                    {/* Closing line — short reinforcement of the "même étoile partout"
                        framing. Centered + muted, doesn't compete with the rungs. */}
                    <p className="text-[11px] text-[#6b7280] leading-relaxed text-center italic mt-1">
                      {MON_PARCOURS_COTE_COPY.langueClosing}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dot indicators — 4 dots (Carte → Ta Cote → Badges → Langue commune),
                active dot ~16px red, idle 6px white at 20%. */}
            <div className="flex justify-center gap-1.5 mt-4" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-200"
                  style={{
                    width: i === activeIndex ? 16 : 6,
                    backgroundColor: i === activeIndex ? "#E63946" : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
          </>
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

      {/* ── Mes Cibles (B-3) — horizontal carousel of targets +
            SearchSheet picker + optional Pro recruiter-view badge.
            Replaces the B-1 ComingSoonCard stub.  The carousel
            uses the canon contained-scroll pattern (w-full +
            min-w-0 + overflow-x-auto + nx-no-scrollbar + snap-x)
            so the page never pans horizontally — same firewall
            the WizardPills + Ma Carte (pre-collapse) carousel
            rely on. ── */}
      <div className="pt-6">
        <div className="px-5">
          <SectionHeader index="02" title="Mes cibles" />
          <p className="text-[12px] text-white/55 leading-relaxed -mt-2 mb-3 max-w-[32ch]">
            Choisis les CÉGEPs où tu veux jouer.
          </p>
        </div>

        {targets.length === 0 ? (
          /* Empty state — verbatim copy from desktop page.tsx :698-700.
             Renders a single prominent AddCard so the call to action
             is obvious without an "Ajouter" button below the list. */
          <div className="px-5">
            <button
              type="button"
              onClick={() => { setSearch(""); setPickerOpen(true); }}
              disabled={!athleteId}
              className="w-full rounded-2xl border-2 border-dashed border-[#2D3748] bg-[#1A1D24]/40 py-8 flex flex-col items-center gap-3 active:bg-[#1A1D24]/70 disabled:opacity-50"
            >
              <span className="w-12 h-12 rounded-full bg-[#13151a] border border-[#2D3748] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
              </span>
              <span className="text-[13px] text-white/70">
                Ajoute ton premier CÉGEP.
              </span>
            </button>
          </div>
        ) : (
          <>
            <div
              className="w-full min-w-0 overflow-x-auto nx-no-scrollbar flex gap-3 snap-x snap-mandatory px-5"
              style={{ scrollPaddingLeft: 20, scrollPaddingRight: 20 }}
            >
              {targets.map((t) => (
                <div
                  key={t.id}
                  className="snap-start shrink-0 flex"
                  style={{ width: 280 }}
                >
                  <TargetCard
                    target={t}
                    busy={busy}
                    onRemove={() => removeTarget(t.id)}
                    /* badgeMap is null when free OR when Pro
                       fetch hasn't completed ; TargetCard renders
                       nothing in that gap. Hand-off below. */
                    badgeMap={recruiterBadgeMap}
                  />
                </div>
              ))}
              {/* Trailing AddCard — always the last slide so the
                  add affordance is reachable mid-swipe without
                  scrolling back to the start. */}
              <div
                className="snap-start shrink-0 flex"
                style={{ width: 200 }}
              >
                <button
                  type="button"
                  onClick={() => { setSearch(""); setPickerOpen(true); }}
                  disabled={!athleteId || busy}
                  className="w-full rounded-2xl border-2 border-dashed border-[#2D3748] bg-transparent flex flex-col items-center justify-center gap-2 py-8 active:bg-white/[0.03] disabled:opacity-50"
                >
                  <span className="w-10 h-10 rounded-full bg-[#13151a] border border-[#2D3748] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14" /><path d="M5 12h14" />
                    </svg>
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">
                    Ajouter
                  </span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Pro recruiter-view data loader OR free-tier nudge.
            Tier is checked ONCE via useSubscription's canSee
            ("who_viewed") below ; the actual recruiter fetch
            happens inside a Pro-only sub-component so the hook
            never fires for free users (no wasted Supabase query,
            no recruiter PII reaches a free browser). Free users
            see ONE subtle row below the carousel — not a per-card
            FeatureGate (which would render N UpgradePlaceholders
            and clutter the row). */}
        {showProBadges ? (
          <ProRecruiterBadgesLoader onLoad={setRecruiterBadgeMap} />
        ) : targets.length > 0 ? (
          <div className="px-5 pt-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <span className="w-7 h-7 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
              <p className="text-[12px] text-white/65 leading-snug">
                Passe Pro pour voir quels CÉGEPs ont consulté ton profil.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── CÉGEP picker — SearchSheet (canon mobile pattern from
            AthleteOnboardingMobile.tsx :1108-1142). Bottom sheet
            via createPortal to document.body — escapes the
            AnimatedRoute containing block so position:fixed
            anchors to the viewport. items={addableCegeps}
            already excludes targeted CÉGEPs + applies the
            search filter. The native <select> is intentionally
            NOT used (canon — every mobile choice surface is a
            sheet). ── */}
      <SearchSheet<Cegep>
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Ajouter un CÉGEP"
        searchPlaceholder="Rechercher un CÉGEP…"
        searchValue={search}
        onSearchChange={setSearch}
        items={addableCegeps}
        keyOf={(c) => c.id}
        onSelect={(c) => { void addTarget(c.id); }}
        renderItem={(c, onTap) => {
          const loc = locationLine(c.city, c.region);
          return (
            <button
              type="button"
              onClick={onTap}
              disabled={busy}
              className="w-full text-left p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors disabled:opacity-40"
            >
              <p className="text-[15px] font-semibold text-white truncate">{c.name}</p>
              {loc && <p className="text-[12px] text-white/55 truncate mt-0.5">{loc}</p>}
            </button>
          );
        }}
        emptyContent={
          <p className="text-[13px] text-white/55 text-center py-8">
            {cegeps.length > 0 && targetedIds.size >= cegeps.length
              ? "Tu as ajouté tous les CÉGEPs disponibles."
              : "Aucun CÉGEP trouvé."}
          </p>
        }
      />

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
            <AthletePlayerCard
              a={capturePhotoUrl ? { ...cardAthlete, photoUrl: capturePhotoUrl } : cardAthlete}
              format="publication"
              clipOverflow={true}
            />
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

/* ── TargetCard — one CÉGEP slide inside the Mes Cibles carousel.
   Reads-only ; the parent owns the data + mutators (removeTarget).
   badgeMap is the Pro-only Map<cegepName, CegepDetail> ; renders a
   small recruiter pill when the CÉGEP has been viewed, nothing
   otherwise (the muted "Pas encore vu" alternative was considered
   but adds noise to every card the recruiter hasn't reached yet —
   silence reads better). On free tier the parent passes null and
   the badge slot stays empty by construction. */
function TargetCard({
  target,
  busy,
  onRemove,
  badgeMap,
}: {
  target: TargetRow;
  busy: boolean;
  onRemove: () => void;
  badgeMap: Map<string, CegepDetail> | null;
}) {
  const loc = locationLine(target.city, target.region);
  const detail = badgeMap?.get(target.name) ?? null;
  return (
    <div className="w-full flex flex-col bg-[#1A1D24] border border-[#2D3748] rounded-2xl p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white leading-snug">{target.name}</p>
          {loc && <p className="text-[11px] text-white/55 truncate mt-0.5">{loc}</p>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Retirer ${target.name}`}
          className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-white/40 active:text-[#E63946] active:bg-[#E63946]/10 disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
      {detail && (() => {
        /* B-3a — "Intérêt mutuel" : when a recruiter from THIS
           CÉGEP has favorited the athlete (favCount > 0 from the
           Pro hook's CegepDetail), surface a green dominant pill
           ABOVE the existing red views pill. Reads ONLY data
           already in badgeMap — no new fetches, no new hook
           calls. Pro-gating is structural : badgeMap is null for
           free users so this entire block evaluates `null` and
           neither pill renders. */
        const isMutual = (detail.favCount ?? 0) > 0;
        return (
          <div className="mt-3 flex flex-col items-start gap-1.5">
            {isMutual && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/40">
                {/* Lucide-style handshake — two clasping shapes,
                    stroke green. Sized 11×11 to match the gold
                    bolt's optical weight in the sibling pill. */}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 17l-4 4-4-4 7-7 4 4" />
                  <path d="M13 7l4-4 4 4-7 7-4-4" />
                  <path d="M11 17l2 2" />
                  <path d="M13 7l-2-2" />
                </svg>
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[#22C55E]">
                  Intérêt mutuel
                </span>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                <path d="M13.5 0l-3 9h6l-9 15 3-12H4l9-12z" />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#E63946]">
                {detail.recruiterCount} recruteur{detail.recruiterCount > 1 ? "s" : ""} · {detail.totalViews} vue{detail.totalViews > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── ProRecruiterBadgesLoader — Pro-only sub-component.
   Calls useAthleteVisibilityPro() inside its own scope so the
   React hook never runs for free users (the parent only mounts
   this when canSee("who_viewed") is true ; mounting a component
   conditionally is the canonical way to conditionally fire a
   hook without violating the rules-of-hooks).

   Reduces the cegepDetails array to a Map<cegepName, CegepDetail>
   for O(1) lookup by TargetCard. Pushes the map up via onLoad,
   then renders nothing (no UI — the map IS the contribution). */
function ProRecruiterBadgesLoader({
  onLoad,
}: {
  onLoad: (map: Map<string, CegepDetail>) => void;
}) {
  const { cegepDetails, loading } = useAthleteVisibilityPro();
  useEffect(() => {
    if (loading) return;
    const map = new Map<string, CegepDetail>();
    for (const d of cegepDetails) map.set(d.cegepName, d);
    onLoad(map);
  }, [cegepDetails, loading, onLoad]);
  return null;
}
