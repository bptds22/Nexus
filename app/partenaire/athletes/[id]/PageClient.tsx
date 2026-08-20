"use client";

import {  useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";
/* loadAthleteRaw N'EST PLUS APPELE ICI (2026-08-19, point 5a du chantier RLS
   partenaire). Il projetait 58 colonnes racine via le chemin de donnees COACH,
   dont les 11 interdites : email, telephone, date_naissance, nom_parent,
   telephone_parent, moyenne_generale, programme_cegep_vise,
   regions_cegep_preferees, notes_coach, consentement_parental, et
   rapport_entraineur par l'embed evaluations.

   Il reste partage avec coach, admin, athlete et six composants mobiles — ne
   PAS le modifier. C'est le chemin partenaire qui cesse de l'appeler. */
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import AthleteRecruiterProfileBody from "@/components/shared/AthleteRecruiterProfileBody";
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
  story:       { name: "Story",       formatLabel: "Format story",       size: "1080×1920", previewWidth: 240, previewHeight: 426 } };

function safeFilenamePart(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ligne rendue par public.partner_athlete_profile — 28 colonnes, aucune
    interdite. Voir le commentaire de la fonction en base. */
type PartnerAthleteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  age: number | null;
  genre: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  cote_globale: number | string | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | string | null;
  bio: string | null;
  sport_nom: string | null;
  position_nom: string | null;
  position_abbr: string | null;
  school_name: string | null;
  school_region: string | null;
  school_city: string | null;
  school_type: string | null;
  is_civil: boolean | null;
  team_name: string | null;
  league_name: string | null;
  distinctions: unknown;
  video_faits_saillants_url: string | null;
  hudl_url: string | null;
  youtube_url: string | null;
};

/* PostgREST rend les colonnes `numeric` en CHAINE JSON ("5.00"), pas en nombre.
   Sans conversion, la cote passerait telle quelle a un composant qui attend un
   number — meme piege que dans partnerFilters.sortPartnerRows. */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Adapte la ligne de la RPC a la forme attendue par AthletePlayerCard.
 *
 * Les champs LAISSES VIDES le sont PAR CONSTRUCTION, pas par oubli : la RPC ne
 * les projette pas, et la fiche partenaire ne les affiche pas (elle est forcee
 * en mode « simple » et masque deja le bloc academique et le nom de
 * l'entraineur). Les remplir supposerait de rouvrir la porte que le point 5
 * ferme.
 *
 * `dateOfBirth: ""` en particulier : le type le declare requis, heritage du
 * chemin coach. Un partenaire ne recoit JAMAIS la date de naissance — l'age
 * derive suffit a tout ce que la carte affiche.
 */
function mapPartnerRpcToRecruiterView(r: PartnerAthleteRow): AthleteProfileRecruiterView {
  const ft = r.taille_pieds ?? 0;
  const inch = r.taille_pouces ?? 0;
  const lbs = num(r.poids_lbs);
  const genre = r.genre === "M" || r.genre === "F" ? r.genre : "Autre";

  return {
    id: r.id,
    identityVisible: true,
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    age: r.age ?? 0,
    gender: genre,
    photoUrl: r.photo_url ?? undefined,
    schoolName: r.school_name ?? "",
    city: r.school_city ?? "",
    region: r.school_region ?? "",
    graduationYear: r.annee_diplomation ?? 0,
    dateOfBirth: "", // jamais projetee a un partenaire

    primarySport: r.sport_nom ?? "",
    primaryPosition: r.position_abbr ?? r.position_nom ?? "",
    jerseyNumber: r.numero_jersey ?? "",
    teamName: r.team_name ?? undefined,
    leagueName: r.league_name ?? undefined,

    heightFeet: ft,
    heightInches: inch,
    heightDisplay: ft ? `${ft}'${inch}"` : "",
    weightLbs: lbs,
    weightDisplay: lbs ? `${lbs} lb` : "",

    // Dossier scolaire et preferences d'etablissement — HORS PERIMETRE.
    strongSubjects: [],
    academicHonors: [],
    targetCegepProgram: [],
    openToRelocate: false,
    openToPrivate: false,
    openToAnglophone: false,
    wantsDEC: false,
    preferredRegions: [],

    // Texte libre d'un adulte sur un mineur — HORS PERIMETRE, definitivement.
    coachName: "",
    coachSchool: "",

    overallRating: num(r.cote_globale),
    /* La carte ne consomme pas les distinctions ; le corps partage les rend
       lui-meme depuis la RPC. On evite de dupliquer ici la conversion
       jsonb -> DistinctionEntry[]. */
    distinctions: [],

    highlightVideoUrl: r.video_faits_saillants_url ?? undefined,
    hudlUrl: r.hudl_url ?? undefined,
    youtubeUrl: r.youtube_url ?? undefined,

    isCivil: r.is_civil ?? false,
    isVerified: r.verified ?? false,
    parentalConsent: false, // donnee de conformite, jamais projetee
    lastValidation: r.last_profile_validation,
    profileCompleteness: 0,
    favoriteCount: 0,
    viewsThisMonth: 0,
    isOpenToOffers: false,
  };
}

export default function PartnerAthleteProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
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

      /* PROJECTION SERVEUR. La RPC porte son propre gate (is_approved_partner
         ET is_partner_eligible_athlete) et ne rend AUCUNE des 11 colonnes
         interdites — l'age arrive derive, date_naissance ne franchit jamais la
         frontiere. Elle rend 0 ligne si l'appelant n'est pas un partenaire
         approuve, ce qui retombe sur le meme message d'erreur que le garde
         d'eligibilite ci-dessus. */
      const { data: row, error: rpcErr } = await supabase
        .rpc("partner_athlete_profile", { p_athlete_id: id })
        .maybeSingle();
      if (rpcErr || !row) {
        setError("Cet athlète n'est pas disponible pour les partenaires.");
        setLoading(false);
        return;
      }
      setAthlete(mapPartnerRpcToRecruiterView(row as PartnerAthleteRow));
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
        // pixelRatio 1: AthletePlayerCard's outer container already
        // renders at the exact target dimensions (publication =
        // 1080×1350, story = 1080×1920), so no oversampling needed.
        pixelRatio: 1,
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

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      <Link href="/partenaire/athletes" className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors inline-flex items-center gap-1">
        ← Retour
      </Link>

      {/* Compact card download — format selector + single button.
          The card itself renders inside the editorial profile body
          below; no need for a separate preview here. */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={activeFormat}
          onChange={(e) => setActiveFormat(e.target.value as CardFormat)}
          aria-label="Format de la carte"
          className="nx-filter-select bg-[#1A1D24] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-white focus:border-[#E63946] outline-none transition-colors"
        >
          <option value="publication">Format publication (1080×1350)</option>
          <option value="story">Format story (1080×1920)</option>
        </select>
        <button
          type="button"
          onClick={() => handleDownload(activeFormat)}
          disabled={downloading !== null}
          className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading === activeFormat ? "Génération…" : "Télécharger la carte"}
        </button>
        <span className="text-[12px] text-[#6b7280]">PNG haute résolution · enregistrement automatique</span>
      </div>

      {/* Off-screen full-size renderings for capture (one per format, both kept ready) */}
      <div aria-hidden="true" className="nx-capture-clean" style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", zIndex: -1 }}>
        <div ref={captureRefPub}>
          <AthletePlayerCard a={athlete} format="publication" clipOverflow={true} />
        </div>
        <div ref={captureRefStory}>
          <AthletePlayerCard a={athlete} format="story" clipOverflow={true} />
        </div>
      </div>

      {/* Canonical recruiter-style profile body. Partner viewerMode
          hides recruiter-specific UI (no pipeline chip, no
          favorite toggle, no sticky CTA bar), swaps academic
          sections for locked placeholders, hides Réputation du
          coach, and skips the recruiter_athlete_views write so
          partner sessions don't pollute view counts. */}
      <AthleteRecruiterProfileBody athleteId={id} viewerMode="partner" />

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
