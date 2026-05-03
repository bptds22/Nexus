"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import AthletePhoto from "@/components/shared/AthletePhoto";
import AthleteProfileView from "@/components/shared/AthleteProfileView";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/athletes/[id]
   Athlete profile page for partners. RLS gates the read — if
   the athlete isn't partner-eligible, the load fails and we
   render the not-available state.

   Two preview tabs (publication / story) with download buttons.
   Capture is client-side via html-to-image; the
   /api/partner/cards/log-download endpoint logs the audit row
   before the PNG actually saves.

   Filename: nexus-{firstname}-{lastname}-{format}.png
═══════════════════════════════════════════════════════════════ */

type CardFormat = "publication" | "story";

const FORMAT_META: Record<CardFormat, { name: string; formatLabel: string; size: string; previewWidth: number; previewHeight: number }> = {
  publication: { name: "Publication", formatLabel: "Format publication", size: "1080×1350", previewWidth: 270, previewHeight: 338 },
  story:       { name: "Story",       formatLabel: "Format story",       size: "1080×1920", previewWidth: 240, previewHeight: 426 },
};

function safeFilenamePart(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function PartnerAthleteProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [athlete, setAthlete] = useState<AthleteProfileRecruiterView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<CardFormat>("publication");
  const [downloading, setDownloading] = useState<CardFormat | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const captureRefPub = useRef<HTMLDivElement | null>(null);
  const captureRefStory = useRef<HTMLDivElement | null>(null);

  const showToast = (kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (async () => {
      // Eligibility guard runs first (defense in depth — RLS on
      // athletes also gates the row, but the explicit check gives
      // us a clean error path instead of a silent empty result).
      const supabase = createClient();
      const { data: eligibleResult, error: eligibleErr } = await supabase.rpc(
        "is_partner_eligible_athlete",
        { p_athlete_id: id },
      );
      if (eligibleErr || !eligibleResult) {
        setError("Cet athlète n'est pas disponible pour les partenaires.");
        setLoading(false);
        return;
      }

      const result = await loadAthleteRaw(id);
      if (!result?.data) {
        setError("Cet athlète n'est pas disponible pour les partenaires.");
        setLoading(false);
        return;
      }
      setAthlete(mapToRecruiterView(result.data as Record<string, unknown>));
      setLoading(false);

      // Fire-and-forget profile-view audit log. Failures are
      // swallowed — auditing shouldn't block the page from
      // rendering (but the route still validates partner status
      // + eligibility server-side and refuses to log if either
      // fails, so no false rows can land).
      fetch("/api/partner/profile-views/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athlete_id: id }),
      }).catch((err) => {
        console.warn("[partner profile-view audit] log failed:", err);
      });
    })();
  }, [id]);

  async function handleDownload(format: CardFormat) {
    if (!athlete) return;
    setDownloading(format);
    try {
      // 1. Log the download server-side first. If logging fails,
      //    abort — we don't ship cards we can't account for.
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Session expirée — reconnecte-toi.");
        setDownloading(null);
        return;
      }
      const logRes = await fetch("/api/partner/cards/log-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athlete_id: id, format }),
      });
      if (!logRes.ok) {
        const json = await logRes.json().catch(() => ({}));
        showToast("error", json.error || `Erreur ${logRes.status}`);
        setDownloading(null);
        return;
      }

      // 2. Wait for fonts so the captured PNG has the right typography
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }

      // 3. Capture the off-screen rendering of the matching format
      const node = format === "publication" ? captureRefPub.current : captureRefStory.current;
      if (!node) {
        showToast("error", "Impossible de générer la carte.");
        setDownloading(null);
        return;
      }
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: undefined,
      });

      // 4. Trigger browser download
      const filename = `nexus-${safeFilenamePart(athlete.firstName)}-${safeFilenamePart(athlete.lastName)}-${format}.png`;
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();

      showToast("success", `Carte ${format} téléchargée.`);
    } catch (e) {
      console.error("[partner card download]", e);
      showToast("error", "Échec du téléchargement.");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto">
        <p className="text-[13px] text-[#6B7280]">Chargement…</p>
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto">
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <p className="text-[13px] text-[#9CA3AF] font-semibold">{error || "Athlète introuvable."}</p>
          <button type="button" onClick={() => router.push("/partenaire/athletes")} className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] mt-4">
            ← Retour aux athlètes
          </button>
        </div>
      </div>
    );
  }

  const meta = FORMAT_META[activeFormat];
  const previewScale = activeFormat === "publication" ? meta.previewWidth / 1080 : meta.previewWidth / 1080;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      <Link href="/partenaire/athletes" className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors inline-flex items-center gap-1">
        ← Retour
      </Link>

      {/* Compact context strip — the rich identity hero lives in
          AthleteProfileView below, this just anchors the
          download UI with a "you're looking at X" signal. */}
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 flex items-center gap-4">
        <AthletePhoto
          photoUrl={athlete.photoUrl}
          firstName={athlete.firstName}
          lastName={athlete.lastName}
          size={56}
        />
        <div className="flex-1 min-w-0">
          <h1 className="font-head text-[20px] sm:text-[22px] font-bold text-white uppercase tracking-tight truncate">
            {athlete.firstName} {athlete.lastName}
          </h1>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">
            {[athlete.primarySport, athlete.primaryPosition, athlete.schoolName].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Carte officielle Nexus — primary partner CTA */}
      <div>
        <h2 className="font-head text-[18px] sm:text-[20px] font-black text-white uppercase tracking-tight">
          Carte officielle Nexus
        </h2>
        <p className="text-[12px] text-[#9CA3AF] mt-1">
          Téléchargez la carte pour publication. Format de votre choix.
        </p>
      </div>

      {/* Format tabs */}
      <div className="flex items-center gap-2 border-b border-[#2D3748]">
        {(Object.keys(FORMAT_META) as CardFormat[]).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => setActiveFormat(fmt)}
            className={`px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeFormat === fmt
                ? "border-[#E63946] text-[#E63946]"
                : "border-transparent text-[#9CA3AF] hover:text-white"
            }`}
          >
            {FORMAT_META[fmt].name}
          </button>
        ))}
      </div>

      {/* Preview + download */}
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6">
        <div className="flex flex-col items-center gap-5">
          <div
            className="bg-[#13151a] border border-white/5 rounded-lg overflow-hidden"
            style={{ width: meta.previewWidth, height: meta.previewHeight }}
          >
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
              <AthletePlayerCard a={athlete} format={activeFormat} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDownload(activeFormat)}
            disabled={downloading !== null}
            className="px-6 py-3 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 uppercase tracking-wider flex items-center gap-2"
          >
            {downloading === activeFormat ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Génération…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Télécharger la carte ({meta.name.toUpperCase()})
              </>
            )}
          </button>

          <p className="text-[11px] text-[#6b7280]">
            {meta.formatLabel} · {meta.size}px · PNG haute résolution · enregistrement automatique
          </p>
        </div>
      </div>

      {/* Off-screen full-size renderings for capture (one per format, both kept ready) */}
      <div aria-hidden="true" style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", zIndex: -1 }}>
        <div ref={captureRefPub}>
          <AthletePlayerCard a={athlete} format="publication" />
        </div>
        <div ref={captureRefStory}>
          <AthletePlayerCard a={athlete} format="story" />
        </div>
      </div>

      {/* Full editorial profile — partner mode hides academic +
          coach-reputation sections and renders a prominent
          recruitment-status banner with committed-school name. */}
      <AthleteProfileView athleteId={id} viewMode="partner" />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`bg-[#1A1D24] border rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 ${toast.kind === "success" ? "border-[#22C55E]/30" : "border-[#EF4444]/30"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toast.kind === "success" ? "#22C55E" : "#EF4444"} strokeWidth="2.5" strokeLinecap="round">
              {toast.kind === "success" ? <path d="M20 6L9 17l-5-5" /> : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /></>}
            </svg>
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
